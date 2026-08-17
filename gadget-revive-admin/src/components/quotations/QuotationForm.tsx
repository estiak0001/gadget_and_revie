'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Plus, Trash2, Search, X, PackageSearch, PenLine, Download, Save, ListChecks,
} from 'lucide-react';
import {
  Card, CardContent, CardHeader, CardTitle, Button, Input, Textarea, SearchableSelect,
  Modal, LoadingSpinner,
} from '@/components/ui';
import TemplateManagerModal from './TemplateManagerModal';
import { Quotation, QuotationItem, QuotationProductSearchResult, QuotationTemplateType, User } from '@/types';
import { formatCurrency, getErrorMessage } from '@/lib/utils';
import adminService from '@/lib/adminService';
import toast from 'react-hot-toast';

interface ItemRow extends QuotationItem {
  /** Local-only row key — items themselves have no id until saved, and array index alone breaks
   *  once rows are removed from the middle of the list. */
  key: string;
}

const num = (v: unknown) => Number(v ?? 0) || 0;
const newKey = () => Math.random().toString(36).slice(2);

const blankRow = (): ItemRow => ({
  key: newKey(), product_id: null, item_name: '', item_sku: null, item_sn: null, item_warranty: null,
  description: null, quantity: 1, unit_price: 0, total_price: 0, show_details: false,
});

export default function QuotationForm({ quotation }: { quotation?: Quotation }) {
  const router = useRouter();
  const isEdit = !!quotation;

  const [customerMode, setCustomerMode] = useState<'existing' | 'new'>(quotation?.customer_id ? 'existing' : 'new');
  // Deliberately string | number, not forced to a string — SearchableSelect matches the current
  // value against each option's `value` with strict equality (===), and customerOptions below
  // carries numeric ids (c.id), so a coerced string here would never match and the picker would
  // always render as empty even after a customer was actually selected.
  const [customerId, setCustomerId] = useState<string | number>(quotation?.customer_id ?? '');
  const [customerName, setCustomerName] = useState(quotation?.customer_name || '');
  const [customerPhone, setCustomerPhone] = useState(quotation?.customer_phone || '');
  const [customerEmail, setCustomerEmail] = useState(quotation?.customer_email || '');
  const [customerAddress, setCustomerAddress] = useState(quotation?.customer_address || '');
  const [customers, setCustomers] = useState<User[]>([]);

  const [validUntil, setValidUntil] = useState(quotation?.valid_until ? quotation.valid_until.slice(0, 10) : '');
  const [items, setItems] = useState<ItemRow[]>(
    quotation?.items?.length ? quotation.items.map((it) => ({ ...it, key: newKey() })) : [blankRow()]
  );
  const [discount, setDiscount] = useState(String(quotation?.discount ?? 0));
  const [shipping, setShipping] = useState(String(quotation?.shipping ?? 0));
  const [tax, setTax] = useState(String(quotation?.tax ?? 0));
  const [notes, setNotes] = useState(quotation?.notes || '');
  const [terms, setTerms] = useState(quotation?.terms || '');

  const [isProductSearchOpen, setIsProductSearchOpen] = useState(false);
  const [templatePicker, setTemplatePicker] = useState<QuotationTemplateType | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isSavingAndDownloading, setIsSavingAndDownloading] = useState(false);

  useEffect(() => {
    adminService.getCustomers({ per_page: 200 }).then((res) => {
      const body = res.data as unknown as { data?: User[] };
      setCustomers(Array.isArray(body.data) ? body.data : []);
    }).catch(() => setCustomers([]));
  }, []);

  // Brand-new quotation only — quietly pre-fill Notes/Terms from whichever saved template (if
  // any) is marked default, so a repeat boilerplate doesn't have to be picked by hand every time.
  // Never overwrites anything already typed, and never runs again once editing an existing one.
  useEffect(() => {
    if (isEdit) return;
    adminService.getQuotationTemplates().then((res) => {
      const templates = res.data.data || [];
      const defaultNotes = templates.find((t) => t.type === 'notes' && t.is_default);
      const defaultTerms = templates.find((t) => t.type === 'terms' && t.is_default);
      if (defaultNotes) setNotes((prev) => prev || defaultNotes.content);
      if (defaultTerms) setTerms((prev) => prev || defaultTerms.content);
    }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const customerOptions = customers.map((c) => ({
    value: c.id,
    label: `${c.name}${c.phone ? ' — ' + c.phone : c.email ? ' — ' + c.email : ''}`,
  }));

  // ── Item management ──────────────────────────────
  const updateItem = (key: string, patch: Partial<ItemRow>) => {
    setItems((prev) => prev.map((it) => {
      if (it.key !== key) return it;
      const next = { ...it, ...patch };
      next.total_price = num(next.quantity) * num(next.unit_price);
      return next;
    }));
  };

  const removeItem = (key: string) => setItems((prev) => prev.filter((it) => it.key !== key));

  const addCustomItem = () => setItems((prev) => [...prev, blankRow()]);

  const addCatalogProduct = (product: QuotationProductSearchResult) => {
    setItems((prev) => {
      const blankIdx = prev.findIndex((it) => !it.item_name.trim() && !it.product_id);
      const row: ItemRow = {
        key: newKey(), product_id: product.id, item_name: product.name, item_sku: product.sku ?? null,
        item_sn: null, item_warranty: product.warranty ?? null, description: null, quantity: 1,
        unit_price: num(product.current_price), total_price: num(product.current_price), show_details: false,
      };
      if (blankIdx !== -1) {
        const copy = [...prev];
        copy[blankIdx] = row;
        return copy;
      }
      return [...prev, row];
    });
    setIsProductSearchOpen(false);
  };

  // ── Totals ────────────────────────────────────────
  const subtotal = items.reduce((s, it) => s + num(it.total_price), 0);
  const total = subtotal - num(discount) + num(shipping) + num(tax);

  // ── Save ──────────────────────────────────────────
  const buildPayload = () => {
    const validItems = items.filter((it) => it.item_name.trim());
    return {
      valid_until: validUntil || null,
      customer_id: customerMode === 'existing' && customerId ? Number(customerId) : null,
      customer_name: customerName || undefined,
      customer_phone: customerPhone || undefined,
      customer_email: customerEmail || undefined,
      customer_address: customerAddress || undefined,
      items: validItems.map((it) => ({
        product_id: it.product_id ?? undefined,
        item_name: it.item_name,
        item_sku: it.item_sku ?? undefined,
        item_sn: it.item_sn ?? undefined,
        item_warranty: it.item_warranty ?? undefined,
        description: it.description ?? undefined,
        quantity: num(it.quantity) || 1,
        unit_price: num(it.unit_price),
        show_details: !!it.show_details,
      })),
      discount: num(discount), shipping: num(shipping), tax: num(tax),
      notes: notes || undefined, terms: terms || undefined,
    };
  };

  const validate = (): boolean => {
    if (customerMode === 'existing' && !customerId) {
      toast.error('Pick an existing customer, or switch to "New customer".');
      return false;
    }
    if (customerMode === 'new' && !customerName.trim()) {
      toast.error('Enter a customer name.');
      return false;
    }
    if (items.filter((it) => it.item_name.trim()).length === 0) {
      toast.error('Add at least one item.');
      return false;
    }
    return true;
  };

  const handleSave = async (andDownload = false) => {
    if (!validate()) return;
    andDownload ? setIsSavingAndDownloading(true) : setIsSaving(true);
    try {
      const payload = buildPayload();
      const res = isEdit
        ? await adminService.updateQuotation(quotation!.id, payload)
        : await adminService.createQuotation(payload);
      const saved = res.data.data as Quotation;
      toast.success(isEdit ? 'Quotation updated.' : 'Quotation created.');

      if (andDownload) {
        const pdf = await adminService.downloadQuotation(saved.id);
        const blob = new Blob([pdf.data as BlobPart], { type: 'application/pdf' });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `Quotation-${saved.quotation_number}.pdf`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(url);
      }

      router.push('/quotations');
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setIsSaving(false);
      setIsSavingAndDownloading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Customer */}
      <Card>
        <CardHeader><CardTitle className="text-base">Customer</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex rounded-lg border border-gray-200 overflow-hidden text-xs w-fit">
            <button
              type="button"
              onClick={() => setCustomerMode('existing')}
              className={`px-4 py-1.5 ${customerMode === 'existing' ? 'bg-primary-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
            >
              Existing customer
            </button>
            <button
              type="button"
              onClick={() => setCustomerMode('new')}
              className={`px-4 py-1.5 ${customerMode === 'new' ? 'bg-primary-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
            >
              New / walk-in customer
            </button>
          </div>

          {customerMode === 'existing' ? (
            <SearchableSelect
              value={customerId}
              onChange={(v) => setCustomerId(v)}
              placeholder="Search customer by name / phone…"
              options={customerOptions}
              allowClear
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Input placeholder="Name *" value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
              <Input placeholder="Phone" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} />
              <Input placeholder="Email" type="email" value={customerEmail} onChange={(e) => setCustomerEmail(e.target.value)} />
              <Input placeholder="Address" value={customerAddress} onChange={(e) => setCustomerAddress(e.target.value)} />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Items */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Items</CardTitle>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setIsProductSearchOpen(true)} leftIcon={<PackageSearch className="w-4 h-4" />}>
              Add from Catalog
            </Button>
            <Button variant="outline" size="sm" onClick={addCustomItem} leftIcon={<PenLine className="w-4 h-4" />}>
              Add Custom Item
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {items.map((it) => (
            <div key={it.key} className="border border-gray-200 rounded-lg p-3 bg-gray-50">
              <div className="grid grid-cols-1 md:grid-cols-12 gap-2 items-start">
                <div className="md:col-span-5">
                  <Input
                    placeholder="Item name *"
                    value={it.item_name}
                    onChange={(e) => updateItem(it.key, { item_name: e.target.value })}
                  />
                  {it.product_id && (
                    <p className="text-[11px] font-semibold text-primary-600 mt-1">From catalog{it.item_sku ? ` · SKU ${it.item_sku}` : ''}</p>
                  )}
                </div>
                <div className="md:col-span-2">
                  <Input type="number" min={1} placeholder="Qty" value={String(it.quantity)} onChange={(e) => updateItem(it.key, { quantity: num(e.target.value) || 1 })} />
                </div>
                <div className="md:col-span-2">
                  <Input type="number" min={0} step="0.01" placeholder="Unit price" value={String(it.unit_price)} onChange={(e) => updateItem(it.key, { unit_price: num(e.target.value) })} />
                </div>
                <div className="md:col-span-2 flex items-center justify-end font-semibold text-gray-900 text-sm h-10">
                  {formatCurrency(it.total_price)}
                </div>
                <div className="md:col-span-1 flex justify-end">
                  <button onClick={() => removeItem(it.key)} className="text-gray-400 hover:text-red-600 p-2" title="Remove">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <Input
                className="mt-2"
                placeholder="Description (optional)"
                value={it.description || ''}
                onChange={(e) => updateItem(it.key, { description: e.target.value })}
              />

              <label className="mt-2 flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer select-none w-fit">
                <input
                  type="checkbox"
                  checked={!!it.show_details}
                  onChange={(e) => updateItem(it.key, { show_details: e.target.checked })}
                  className="rounded border-gray-300"
                />
                Add SKU / Serial No. / Warranty (shown on the PDF only if checked)
              </label>
              {it.show_details && (
                <div className="mt-2 grid grid-cols-1 md:grid-cols-3 gap-2">
                  <Input
                    placeholder="SKU (optional)"
                    value={it.item_sku || ''}
                    onChange={(e) => updateItem(it.key, { item_sku: e.target.value })}
                  />
                  <Input
                    placeholder="Serial No. (optional)"
                    value={it.item_sn || ''}
                    onChange={(e) => updateItem(it.key, { item_sn: e.target.value })}
                  />
                  <Input
                    placeholder="Warranty (optional)"
                    value={it.item_warranty || ''}
                    onChange={(e) => updateItem(it.key, { item_warranty: e.target.value })}
                  />
                </div>
              )}
            </div>
          ))}
          {subtotal > 0 && (
            <p className="text-right text-sm text-gray-600 pt-1">
              Items subtotal: <span className="font-semibold text-gray-900">{formatCurrency(subtotal)}</span>
            </p>
          )}
        </CardContent>
      </Card>

      {/* Pricing + validity */}
      <Card>
        <CardHeader><CardTitle className="text-base">Pricing &amp; Validity</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <Input label="Discount" type="number" min={0} step="0.01" value={discount} onChange={(e) => setDiscount(e.target.value)} />
            <Input label="Shipping" type="number" min={0} step="0.01" value={shipping} onChange={(e) => setShipping(e.target.value)} />
            <Input label="Tax" type="number" min={0} step="0.01" value={tax} onChange={(e) => setTax(e.target.value)} />
            <Input label="Valid Until" type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} />
          </div>
          <div className="text-right text-lg">
            Total: <span className="font-bold text-gray-900">{formatCurrency(total)}</span>
          </div>
        </CardContent>
      </Card>

      {/* Notes + terms */}
      <Card>
        <CardContent className="space-y-4 pt-6">
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-sm font-medium text-gray-700">Notes (shown on the quotation)</label>
              <button
                type="button"
                onClick={() => setTemplatePicker('notes')}
                className="flex items-center gap-1 text-xs font-medium text-primary-600 hover:text-primary-700"
              >
                <ListChecks className="w-3.5 h-3.5" /> Templates
              </button>
            </div>
            <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-sm font-medium text-gray-700">Terms &amp; Conditions</label>
              <button
                type="button"
                onClick={() => setTemplatePicker('terms')}
                className="flex items-center gap-1 text-xs font-medium text-primary-600 hover:text-primary-700"
              >
                <ListChecks className="w-3.5 h-3.5" /> Templates
              </button>
            </div>
            <Textarea
              rows={3}
              value={terms}
              onChange={(e) => setTerms(e.target.value)}
              placeholder="e.g. 50% advance payment required. Prices valid for the period stated above."
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2 pb-6">
        <Button variant="outline" onClick={() => router.push('/quotations')}>Cancel</Button>
        <Button variant="outline" onClick={() => handleSave(false)} isLoading={isSaving} leftIcon={<Save className="w-4 h-4" />}>
          {isEdit ? 'Save Changes' : 'Save Draft'}
        </Button>
        <Button onClick={() => handleSave(true)} isLoading={isSavingAndDownloading} leftIcon={<Download className="w-4 h-4" />}>
          Save &amp; Download PDF
        </Button>
      </div>

      {isProductSearchOpen && (
        <ProductSearchModal onSelect={addCatalogProduct} onClose={() => setIsProductSearchOpen(false)} />
      )}

      {templatePicker && (
        <TemplateManagerModal
          type={templatePicker}
          onApply={(content) => (templatePicker === 'notes' ? setNotes(content) : setTerms(content))}
          onClose={() => setTemplatePicker(null)}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
function ProductSearchModal({ onSelect, onClose }: {
  onSelect: (p: QuotationProductSearchResult) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<QuotationProductSearchResult[]>([]);
  const [loading, setLoading] = useState(false);

  const search = useCallback(async (q: string) => {
    setLoading(true);
    try {
      const res = await adminService.searchQuotationProducts(q);
      setResults(res.data.data || []);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { search(''); }, [search]);
  useEffect(() => {
    const timer = setTimeout(() => search(query), 300);
    return () => clearTimeout(timer);
  }, [query, search]);

  return (
    <Modal isOpen onClose={onClose} title="Add from Catalog" size="md">
      <div className="space-y-3">
        <div className="relative">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search products by name or SKU…"
            className="w-full pl-9 pr-8 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
          {query && (
            <button onClick={() => setQuery('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <div className="max-h-96 overflow-y-auto divide-y divide-gray-100 border border-gray-100 rounded-lg">
          {loading ? (
            <div className="flex justify-center py-8"><LoadingSpinner /></div>
          ) : results.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-8">No products found.</p>
          ) : (
            results.map((p) => (
              <button
                key={p.id}
                onClick={() => onSelect(p)}
                className="w-full flex items-center justify-between gap-3 px-3 py-2.5 text-left hover:bg-gray-50"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{p.name}</p>
                  {p.sku && <p className="text-xs text-gray-400">SKU: {p.sku}</p>}
                </div>
                <span className="text-sm font-semibold text-gray-700 shrink-0">{formatCurrency(num(p.current_price))}</span>
              </button>
            ))
          )}
        </div>
      </div>
    </Modal>
  );
}
