'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Plus, Trash2, Search, Package, FileText, Save } from 'lucide-react';
import { AdminLayout } from '@/components/layout';
import {
  Card, CardContent, CardHeader, CardTitle,
  Button, Input, SearchableSelect, LoadingSpinner, ErrorState,
} from '@/components/ui';
import { Product, Supplier } from '@/types';
import { formatCurrency, getErrorMessage } from '@/lib/utils';
import adminService from '@/lib/adminService';
import toast from 'react-hot-toast';

// ─── Types ────────────────────────────────────────────────────────────────────

interface PurchaseLineItem {
  id: string;
  product_id?: number;
  product_name: string;
  product_sku: string;
  quantity: number;
  unit_cost: number;
  /** The supplier's warranty on this specific batch — independent of the product's own warranty. */
  warranty_value?: number | null;
  warranty_unit?: string | null;
}

function generateId() {
  return Math.random().toString(36).slice(2, 9);
}

// ─── Product search modal ───────────────────────────────────────────────────

interface ProductSearchModalProps {
  onSelect: (product: Product) => void;
  onClose: () => void;
}

function ProductSearchModal({ onSelect, onClose }: ProductSearchModalProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);

  const search = useCallback(async (q: string) => {
    setLoading(true);
    try {
      const res = await adminService.getProducts({ search: q, per_page: 20 });
      const data = (res.data as { data?: unknown })?.data ?? res.data;
      setResults(Array.isArray(data) ? data : []);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { search(''); }, [search]);

  useEffect(() => {
    const timer = setTimeout(() => search(query), 350);
    return () => clearTimeout(timer);
  }, [query, search]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4 flex flex-col max-h-[80vh]">
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="font-semibold text-gray-900">Search Products</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
        </div>

        <div className="p-4 border-b">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search products..."
              className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
        </div>

        <div className="overflow-y-auto flex-1">
          {loading && (
            <div className="flex justify-center py-8"><LoadingSpinner size="sm" /></div>
          )}
          {!loading && results.length === 0 && (
            <p className="text-center text-gray-500 py-8 text-sm">No results found</p>
          )}
          {!loading && results.map((product) => (
            <button
              key={product.id}
              onClick={() => onSelect(product)}
              className="w-full text-left px-4 py-3 hover:bg-gray-50 border-b last:border-b-0 transition-colors"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-medium text-gray-900 text-sm truncate">{product.name}</p>
                  <p className="text-xs text-gray-500">SKU: {product.sku}</p>
                  <p className="text-xs text-gray-500">Stock: {product.stock_qty}</p>
                </div>
                <span className="text-sm font-semibold text-primary-600 whitespace-nowrap">
                  {formatCurrency(product.discount_price ?? product.price)}
                </span>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function EditPurchaseOrderPage() {
  const params = useParams();
  const router = useRouter();
  const poId = Number(params.id);

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [locked, setLocked] = useState(false);
  const [poNumber, setPoNumber] = useState('');

  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [supplierId, setSupplierId] = useState<string | number>('');

  const [items, setItems] = useState<PurchaseLineItem[]>([]);
  const [searchModalOpen, setSearchModalOpen] = useState(false);

  const [expectedDate, setExpectedDate] = useState('');
  const [tax, setTax] = useState('');
  const [shippingCost, setShippingCost] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    adminService.getSuppliers({ per_page: 1000, is_active: 'true' })
      .then((res) => {
        const payload = res.data?.data as unknown;
        const list = Array.isArray(payload) ? payload : (payload as { data?: Supplier[] })?.data;
        setSuppliers(Array.isArray(list) ? (list as Supplier[]) : []);
      })
      .catch(() => setSuppliers([]));
  }, []);

  useEffect(() => {
    if (!poId) return;
    setIsLoading(true);
    setLoadError(false);
    adminService.getPurchase(poId)
      .then((res) => {
        const po = res.data?.data;
        if (!po) {
          setLoadError(true);
          return;
        }
        if (!['draft', 'ordered'].includes(po.status)) {
          setLocked(true);
          return;
        }
        setPoNumber(po.po_number);
        setSupplierId(po.supplier_id);
        setExpectedDate(po.expected_date ? po.expected_date.slice(0, 10) : '');
        setTax(po.tax ? String(po.tax) : '');
        setShippingCost(po.shipping_cost ? String(po.shipping_cost) : '');
        setNotes(po.notes || '');
        setItems(
          (po.items || []).map((item) => ({
            id: generateId(),
            product_id: item.product_id,
            product_name: item.product?.name || `Product #${item.product_id}`,
            product_sku: item.product?.sku || '',
            quantity: item.quantity,
            unit_cost: Number(item.unit_cost),
            warranty_value: item.warranty_value ?? null,
            warranty_unit: item.warranty_unit ?? null,
          }))
        );
      })
      .catch((err) => {
        toast.error(getErrorMessage(err));
        setLoadError(true);
      })
      .finally(() => setIsLoading(false));
  }, [poId]);

  function addProduct(product: Product) {
    setItems((prev) => {
      const existing = prev.find((i) => i.product_id === product.id);
      if (existing) {
        return prev.map((i) => (i.product_id === product.id ? { ...i, quantity: i.quantity + 1 } : i));
      }
      return [
        ...prev,
        {
          id: generateId(),
          product_id: product.id,
          product_name: product.name,
          product_sku: product.sku,
          quantity: 1,
          unit_cost: product.discount_price ?? product.price,
        },
      ];
    });
    setSearchModalOpen(false);
  }

  function removeItem(id: string) {
    setItems((prev) => prev.filter((i) => i.id !== id));
  }

  function updateItem(id: string, field: 'quantity' | 'unit_cost' | 'warranty_value' | 'warranty_unit', value: number | string | null) {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, [field]: value } : i)));
  }

  const subtotal = items.reduce((sum, i) => sum + i.quantity * i.unit_cost, 0);
  const taxNum = parseFloat(tax || '0') || 0;
  const shippingNum = parseFloat(shippingCost || '0') || 0;
  const total = subtotal + taxNum + shippingNum;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!supplierId) {
      toast.error('Please select a supplier');
      return;
    }
    if (items.length === 0) {
      toast.error('Add at least one product to the purchase order');
      return;
    }
    if (items.some((i) => !i.product_id || i.quantity < 1)) {
      toast.error('Each line item needs a product and a quantity of at least 1');
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        supplier_id: Number(supplierId),
        expected_date: expectedDate || null,
        notes: notes.trim() || null,
        tax: taxNum || null,
        shipping_cost: shippingNum || null,
        items: items.map((i) => ({
          product_id: i.product_id,
          quantity: i.quantity,
          unit_cost: i.unit_cost,
          warranty_value: i.warranty_value || null,
          warranty_unit: i.warranty_unit || null,
        })),
      };

      await adminService.updatePurchase(poId, payload);
      toast.success('Purchase order updated successfully');
      router.push(`/purchases/${poId}`);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setIsSaving(false);
    }
  }

  if (isLoading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center py-16">
          <LoadingSpinner size="lg" text="Loading purchase order..." />
        </div>
      </AdminLayout>
    );
  }

  if (loadError) {
    return (
      <AdminLayout>
        <ErrorState title="Failed to load purchase order" message="Could not fetch purchase order details." />
      </AdminLayout>
    );
  }

  if (locked) {
    return (
      <AdminLayout>
        <ErrorState
          title="This purchase order can no longer be edited"
          message="Purchase orders can only be edited before any goods have been received. View the order for its current status and available actions."
        />
        <div className="flex justify-center mt-4">
          <Button onClick={() => router.push(`/purchases/${poId}`)}>View Purchase Order</Button>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => router.back()}>
            <ArrowLeft className="w-4 h-4 mr-1" />
            Back
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Edit Purchase Order {poNumber}</h1>
            <p className="text-sm text-gray-500 mt-0.5">Update supplier, items, or costs — available any time before goods are received</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* ── Left column ── */}
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Supplier</CardTitle>
              </CardHeader>
              <CardContent>
                <SearchableSelect
                  label="Supplier *"
                  required
                  value={supplierId}
                  onChange={setSupplierId}
                  placeholder="Select a supplier..."
                  options={suppliers.map((s) => ({ value: s.id, label: s.name }))}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Package className="w-4 h-4" /> Order Items
                  </CardTitle>
                  <Button type="button" variant="outline" size="sm" onClick={() => setSearchModalOpen(true)}>
                    <Plus className="w-3.5 h-3.5 mr-1" /> Add Product
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {items.length === 0 ? (
                  <p className="text-center text-gray-400 py-6 text-sm">No items yet. Add a product to begin.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-200 text-left">
                          <th className="pb-2 pr-4 font-semibold text-gray-600">Product</th>
                          <th className="pb-2 pr-4 font-semibold text-gray-600 w-28">Qty</th>
                          <th className="pb-2 pr-4 font-semibold text-gray-600 w-36">Unit Cost (৳)</th>
                          <th className="pb-2 pr-4 font-semibold text-gray-600 w-40">Warranty</th>
                          <th className="pb-2 pr-4 font-semibold text-gray-600 text-right">Line Total</th>
                          <th className="pb-2 w-10"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {items.map((item) => (
                          <tr key={item.id}>
                            <td className="py-2 pr-4">
                              <p className="font-medium text-gray-900">{item.product_name}</p>
                              <p className="text-xs text-gray-500">{item.product_sku}</p>
                            </td>
                            <td className="py-2 pr-4">
                              <input
                                type="number"
                                min={1}
                                value={item.quantity}
                                onChange={(e) => updateItem(item.id, 'quantity', Math.max(1, parseInt(e.target.value) || 1))}
                                className="w-20 px-2 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                              />
                            </td>
                            <td className="py-2 pr-4">
                              <input
                                type="number"
                                min={0}
                                step="0.01"
                                value={item.unit_cost}
                                onChange={(e) => updateItem(item.id, 'unit_cost', parseFloat(e.target.value) || 0)}
                                className="w-28 px-2 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                              />
                            </td>
                            <td className="py-2 pr-4">
                              <div className="flex gap-1">
                                <input
                                  type="number"
                                  min={0}
                                  value={item.warranty_value ?? ''}
                                  onChange={(e) => updateItem(item.id, 'warranty_value', e.target.value ? parseInt(e.target.value) : null)}
                                  placeholder="—"
                                  className="w-14 px-2 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                                />
                                <select
                                  value={item.warranty_unit ?? ''}
                                  onChange={(e) => updateItem(item.id, 'warranty_unit', e.target.value || null)}
                                  className="flex-1 px-1.5 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                                >
                                  <option value="">Unit</option>
                                  <option value="day">Day(s)</option>
                                  <option value="week">Week(s)</option>
                                  <option value="month">Month(s)</option>
                                  <option value="year">Year(s)</option>
                                </select>
                              </div>
                            </td>
                            <td className="py-2 pr-4 text-right font-medium">
                              {formatCurrency(item.quantity * item.unit_cost)}
                            </td>
                            <td className="py-2 text-right">
                              <button
                                type="button"
                                onClick={() => removeItem(item.id)}
                                className="p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <FileText className="w-4 h-4" /> Notes
                </CardTitle>
              </CardHeader>
              <CardContent>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  placeholder="Optional notes about this purchase order"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
                />
              </CardContent>
            </Card>
          </div>

          {/* ── Right column (sidebar) ── */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Order Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Input
                  label="Expected Date"
                  type="date"
                  value={expectedDate}
                  onChange={(e) => setExpectedDate(e.target.value)}
                />

                <div className="flex justify-between text-sm pt-2">
                  <span className="text-gray-600">Subtotal</span>
                  <span className="font-medium">{formatCurrency(subtotal)}</span>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Tax (৳)</label>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={tax}
                    onChange={(e) => setTax(e.target.value)}
                    placeholder="0"
                    className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Shipping (৳)</label>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={shippingCost}
                    onChange={(e) => setShippingCost(e.target.value)}
                    placeholder="0"
                    className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>

                <div className="border-t pt-3 flex justify-between">
                  <span className="font-semibold text-gray-900">Total</span>
                  <span className="font-bold text-lg text-primary-600">{formatCurrency(total)}</span>
                </div>
              </CardContent>
            </Card>

            <Button type="submit" className="w-full" isLoading={isSaving}>
              <Save className="w-4 h-4 mr-2" /> Save Changes
            </Button>

            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={() => router.back()}
              disabled={isSaving}
            >
              Cancel
            </Button>
          </div>
        </form>
      </div>

      {searchModalOpen && (
        <ProductSearchModal onSelect={addProduct} onClose={() => setSearchModalOpen(false)} />
      )}
    </AdminLayout>
  );
}
