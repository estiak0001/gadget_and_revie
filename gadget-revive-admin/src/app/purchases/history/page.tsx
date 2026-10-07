'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { Truck, Package, Phone, Mail, MapPin, Search, ScanLine, Trash2, Undo2 } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { AdminLayout } from '@/components/layout';
import { Badge, LoadingSpinner, InfoButton, SearchableSelect } from '@/components/ui';
import { Supplier, PurchaseOrder, PurchaseProductHistory, PurchaseSerialHistoryEntry, Product, PurchaseOrderStatus, AuditLog } from '@/types';
import { formatCurrency, formatDate, getErrorMessage } from '@/lib/utils';
import adminService from '@/lib/adminService';
import toast from 'react-hot-toast';

type Mode = 'supplier' | 'product' | 'serial' | 'deletes' | 'returns';

const MODES: { value: Mode; label: string }[] = [
  { value: 'supplier', label: 'By Supplier' },
  { value: 'product', label: 'By Product' },
  { value: 'serial', label: 'By Serial Number' },
  { value: 'returns', label: 'Return History' },
  { value: 'deletes', label: 'Delete History' },
];

const MODE_TONE: Record<Mode, { active: string; idle: string }> = {
  supplier: { active: 'border-indigo-600 bg-indigo-600 text-white', idle: 'border-indigo-200 bg-white text-indigo-700 hover:bg-indigo-50' },
  product: { active: 'border-sky-600 bg-sky-600 text-white', idle: 'border-sky-200 bg-white text-sky-700 hover:bg-sky-50' },
  serial: { active: 'border-violet-600 bg-violet-600 text-white', idle: 'border-violet-200 bg-white text-violet-700 hover:bg-violet-50' },
  returns: { active: 'border-amber-500 bg-amber-500 text-white', idle: 'border-amber-200 bg-white text-amber-700 hover:bg-amber-50' },
  deletes: { active: 'border-rose-600 bg-rose-600 text-white', idle: 'border-rose-200 bg-white text-rose-700 hover:bg-rose-50' },
};

const STATUS_BADGE: Record<PurchaseOrderStatus, 'default' | 'info' | 'warning' | 'success' | 'danger'> = {
  draft: 'default', ordered: 'info', partially_received: 'warning', received: 'success', cancelled: 'danger',
};

function warrantyLabel(value?: number | null, unit?: string | null): string | null {
  if (!value || !unit) return null;
  return `${value} ${unit}${value > 1 ? 's' : ''}`;
}

function isValidMode(v: string | null): v is Mode {
  return v === 'supplier' || v === 'product' || v === 'serial' || v === 'deletes' || v === 'returns';
}

function PurchaseHistoryContent() {
  const searchParams = useSearchParams();
  const initialTab = searchParams.get('tab');
  const [mode, setMode] = useState<Mode>(isValidMode(initialTab) ? initialTab : 'supplier');

  return (
    <AdminLayout>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h1 className="text-lg font-bold text-gray-900">Purchase History</h1>
          <InfoButton title="How Purchase History Works">
            <p>
              Look up every purchase order placed with a specific supplier, every batch a
              specific product has ever been bought in, or trace one exact unit by its serial
              number — including warranty terms and, if it&apos;s been sold, which invoice it
              went out on.
            </p>
            <p>
              This reuses the same purchase order data shown elsewhere in Purchases — it&apos;s
              just filtered and grouped by supplier, product, or serial for a quick trail to follow.
            </p>
          </InfoButton>
        </div>
        <p className="text-xs text-gray-500">Search by supplier, product, or serial number to see the full purchase trail.</p>
      </div>

      <div className="mb-3 flex flex-wrap gap-1.5">
        {MODES.map((m) => (
          <button
            key={m.value}
            type="button"
            onClick={() => setMode(m.value)}
            className={`rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
              mode === m.value ? MODE_TONE[m.value].active : MODE_TONE[m.value].idle
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>

      {mode === 'supplier' && <SupplierHistory />}
      {mode === 'product' && <ProductHistory />}
      {mode === 'serial' && <SerialHistory />}
      {mode === 'returns' && <ReturnHistory />}
      {mode === 'deletes' && <DeleteHistory />}
    </AdminLayout>
  );
}

export default function PurchaseHistoryPage() {
  return (
    <Suspense fallback={<AdminLayout><div className="flex min-h-screen items-center justify-center"><LoadingSpinner size="lg" text="Loading..." /></div></AdminLayout>}>
      <PurchaseHistoryContent />
    </Suspense>
  );
}

function FilterBar({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-gray-200 bg-white p-2.5">{children}</div>
  );
}

function Panel({ title, hint, right, children }: { title: string; hint?: string; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="overflow-hidden rounded-xl border border-gray-200 bg-white">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 px-3 py-2">
        <div>
          <h2 className="text-sm font-semibold text-gray-900">{title}</h2>
          {hint && <p className="mt-0.5 text-[11px] text-gray-500">{hint}</p>}
        </div>
        {right}
      </div>
      {children}
    </section>
  );
}

function TableWrap({ children }: { children: React.ReactNode }) {
  return <div className="max-h-[calc(100vh-17rem)] overflow-auto">{children}</div>;
}

function Th({ children, align = 'left' }: { children: React.ReactNode; align?: 'left' | 'right' }) {
  return (
    <th className={`whitespace-nowrap px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500 ${align === 'right' ? 'text-right' : 'text-left'}`}>
      {children}
    </th>
  );
}

function EmptyHint({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center py-12 text-gray-400">
      {icon}
      <p className="mt-2 text-sm">{children}</p>
    </div>
  );
}

function StatTile({ label, value, tone = 'gray' }: { label: string; value: string; tone?: 'gray' | 'primary' | 'success' | 'amber' }) {
  const toneClasses = {
    gray: 'border-gray-200 bg-gray-50/60 text-gray-900',
    primary: 'border-indigo-200 bg-indigo-50/60 text-indigo-800',
    success: 'border-emerald-200 bg-emerald-50/60 text-emerald-800',
    amber: 'border-amber-200 bg-amber-50/60 text-amber-800',
  }[tone];
  return (
    <div className={`rounded-xl border px-3 py-2 ${toneClasses}`}>
      <p className="text-[10px] font-semibold uppercase tracking-wide opacity-70">{label}</p>
      <p className="mt-0.5 text-base font-bold tabular-nums">{value}</p>
    </div>
  );
}

// ─── By Supplier ────────────────────────────────────────────────────────────

function SupplierHistory() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [supplierId, setSupplierId] = useState<number | ''>('');
  const [supplier, setSupplier] = useState<Supplier | null>(null);
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    adminService.getSuppliers({ per_page: 1000 })
      .then((res) => {
        const payload = res.data?.data as unknown;
        const list = Array.isArray(payload) ? payload : (payload as { data?: Supplier[] })?.data;
        setSuppliers(Array.isArray(list) ? (list as Supplier[]) : []);
      })
      .catch(() => setSuppliers([]));
  }, []);

  useEffect(() => {
    if (!supplierId) { setSupplier(null); setOrders([]); return; }
    setIsLoading(true);
    Promise.all([
      adminService.getSupplier(Number(supplierId)),
      adminService.getPurchases({ supplier_id: supplierId, per_page: 200 }),
    ])
      .then(([supRes, posRes]) => {
        setSupplier(supRes.data?.data ?? null);
        const payload = posRes.data?.data as unknown;
        const list = Array.isArray(payload) ? payload : (payload as { data?: PurchaseOrder[] })?.data;
        setOrders(Array.isArray(list) ? (list as PurchaseOrder[]) : []);
      })
      .catch((err) => toast.error(getErrorMessage(err)))
      .finally(() => setIsLoading(false));
  }, [supplierId]);

  const totals = orders.reduce(
    (acc, po) => ({
      total: acc.total + Number(po.total),
      paid: acc.paid + Number(po.paid_amount),
      outstanding: acc.outstanding + Number(po.outstanding_payable),
    }),
    { total: 0, paid: 0, outstanding: 0 }
  );

  return (
    <div className="space-y-3">
      <FilterBar>
        <span className="text-xs font-semibold text-gray-500">Supplier</span>
        <div className="w-80 max-w-full">
          <SearchableSelect
            value={supplierId}
            onChange={(v) => setSupplierId(v as number)}
            options={suppliers.map((s) => ({ value: s.id, label: s.name, description: s.phone || s.email }))}
            placeholder="Search and select a supplier…"
            searchPlaceholder="Search suppliers…"
            allowClear
          />
        </div>
      </FilterBar>

      {isLoading ? (
        <div className="flex justify-center py-12"><LoadingSpinner /></div>
      ) : supplier ? (
        <>
          <div className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-indigo-200 bg-indigo-50/50 p-3">
            <div>
              <h2 className="text-base font-bold text-gray-900">{supplier.name}</h2>
              <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-gray-600">
                {supplier.contact_person && <span>{supplier.contact_person}</span>}
                {supplier.phone && (
                  <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{supplier.phone}</span>
                )}
                {supplier.email && (
                  <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{supplier.email}</span>
                )}
                {supplier.address && (
                  <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{supplier.address}</span>
                )}
              </div>
            </div>
            <Badge variant={supplier.is_active ? 'success' : 'default'}>{supplier.is_active ? 'Active' : 'Inactive'}</Badge>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <StatTile label="Purchase Orders" value={String(orders.length)} />
            <StatTile label="Total Value" value={formatCurrency(totals.total)} tone="primary" />
            <StatTile label="Total Paid" value={formatCurrency(totals.paid)} tone="success" />
            <StatTile label="Outstanding" value={formatCurrency(totals.outstanding)} tone="amber" />
          </div>

          <Panel title="Purchase orders">
            <TableWrap>
              <table className="min-w-full text-sm">
                <thead className="sticky top-0 z-10 bg-slate-50 shadow-[0_1px_0_0_rgb(226,232,240)]">
                  <tr>
                    <Th>PO number</Th>
                    <Th>Date</Th>
                    <Th>Status</Th>
                    <Th align="right">Total</Th>
                    <Th align="right">Paid</Th>
                    <Th align="right">Outstanding</Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {orders.length === 0 ? (
                    <tr><td colSpan={6} className="px-3 py-6 text-center text-sm text-gray-400">No purchase orders from this supplier yet.</td></tr>
                  ) : orders.map((po, i) => (
                    <tr key={po.id} className={`${i % 2 ? 'bg-slate-50/50' : 'bg-white'} hover:bg-indigo-50/40`}>
                      <td className="px-3 py-2">
                        <Link href={`/purchases/${po.id}`} className="font-mono font-semibold text-primary-600 hover:underline">{po.po_number}</Link>
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-xs tabular-nums text-gray-500">{formatDate(po.created_at)}</td>
                      <td className="px-3 py-2">
                        <Badge variant={STATUS_BADGE[po.status] ?? 'default'} className="capitalize">{po.status.replace('_', ' ')}</Badge>
                      </td>
                      <td className="px-3 py-2 text-right font-semibold tabular-nums text-gray-900">{formatCurrency(Number(po.total))}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-emerald-700">{formatCurrency(Number(po.paid_amount))}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-amber-700">{formatCurrency(po.outstanding_payable ?? 0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableWrap>
          </Panel>
        </>
      ) : (
        <EmptyHint icon={<Truck className="h-8 w-8 opacity-40" />}>
          Select a supplier above to see their full purchase history.
        </EmptyHint>
      )}
    </div>
  );
}

// ─── By Product ─────────────────────────────────────────────────────────────

function ProductHistory() {
  const [products, setProducts] = useState<Product[]>([]);
  const [productId, setProductId] = useState<number | ''>('');
  const [data, setData] = useState<PurchaseProductHistory | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    adminService.getProducts({ per_page: 1000 })
      .then((res) => {
        const payload = res.data as unknown;
        const list = (payload as { data?: Product[] })?.data;
        setProducts(Array.isArray(list) ? list : []);
      })
      .catch(() => setProducts([]));
  }, []);

  useEffect(() => {
    if (!productId) { setData(null); return; }
    setIsLoading(true);
    adminService.getPurchaseProductHistory(Number(productId))
      .then((res) => setData(res.data?.data ?? null))
      .catch((err) => toast.error(getErrorMessage(err)))
      .finally(() => setIsLoading(false));
  }, [productId]);

  const productWarranty = data ? warrantyLabel(data.product.warranty_value, data.product.warranty_unit) : null;

  return (
    <div className="space-y-3">
      <FilterBar>
        <span className="text-xs font-semibold text-gray-500">Product</span>
        <div className="w-80 max-w-full">
          <SearchableSelect
            value={productId}
            onChange={(v) => setProductId(v as number)}
            options={products.map((p) => ({ value: p.id, label: p.name, description: p.sku }))}
            placeholder="Search and select a product…"
            searchPlaceholder="Search products…"
            allowClear
          />
        </div>
      </FilterBar>

      {isLoading ? (
        <div className="flex justify-center py-12"><LoadingSpinner /></div>
      ) : data ? (
        <>
          <div className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-sky-200 bg-sky-50/50 p-3">
            <div>
              <h2 className="text-base font-bold text-gray-900">{data.product.name}</h2>
              <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-gray-600">
                <span>SKU: {data.product.sku}</span>
                <span>Current stock: {data.product.stock_qty}</span>
                <span>Current cost: {formatCurrency(Number(data.product.current_cost ?? 0))}</span>
              </div>
              {data.product.warranty_note && (
                <p className="mt-1 text-[11px] text-gray-500">{data.product.warranty_note}</p>
              )}
            </div>
            {productWarranty && <Badge variant="info">Warranty: {productWarranty}</Badge>}
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <StatTile label="Purchase Orders" value={String(data.summary.total_purchase_orders)} />
            <StatTile label="Qty Received" value={String(data.summary.total_quantity_received)} tone="success" />
            <StatTile label="Total Spent" value={formatCurrency(data.summary.total_spent)} tone="primary" />
            <StatTile label="Avg Unit Cost" value={formatCurrency(data.summary.avg_unit_cost)} tone="amber" />
          </div>

          <Panel
            title="Purchase batches"
            right={
              <div className="flex flex-wrap items-center gap-3 text-[11px] text-gray-500">
                <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm border border-gray-300 bg-gray-100" />In stock</span>
                <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm border border-blue-300 bg-blue-50" />Sold (→ invoice)</span>
                <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm border border-red-300 bg-red-50" />Returned</span>
              </div>
            }
          >
            <TableWrap>
              <table className="min-w-full text-sm">
                <thead className="sticky top-0 z-10 bg-slate-50 shadow-[0_1px_0_0_rgb(226,232,240)]">
                  <tr>
                    <Th>Date</Th>
                    <Th>PO number</Th>
                    <Th>Supplier</Th>
                    <Th align="right">Qty</Th>
                    <Th align="right">Unit cost</Th>
                    <Th align="right">Total</Th>
                    <Th>Warranty</Th>
                    <Th>Serial numbers</Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {data.items.length === 0 ? (
                    <tr><td colSpan={8} className="px-3 py-6 text-center text-sm text-gray-400">This product has never been purchased.</td></tr>
                  ) : data.items.map((item) => (
                    <tr key={item.id} className="align-top hover:bg-indigo-50/40">
                      <td className="whitespace-nowrap px-3 py-2 text-xs tabular-nums text-gray-500">{formatDate(item.date)}</td>
                      <td className="whitespace-nowrap px-3 py-2">
                        <Link href={`/purchases/${item.po_id}`} className="font-mono font-semibold text-primary-600 hover:underline">{item.po_number}</Link>
                      </td>
                      <td className="px-3 py-2 text-gray-700">{item.supplier?.name ?? '—'}</td>
                      <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">{item.received_qty}/{item.quantity}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(Number(item.unit_cost))}</td>
                      <td className="px-3 py-2 text-right font-semibold tabular-nums text-gray-900">{formatCurrency(Number(item.total_cost))}</td>
                      <td className="whitespace-nowrap px-3 py-2 text-xs text-gray-600">{warrantyLabel(item.warranty_value, item.warranty_unit) ?? '—'}</td>
                      <td className="px-3 py-2">
                        {item.serials.length > 0 ? (
                          <div className="flex max-w-sm flex-wrap gap-1">
                            {item.serials.map((s) =>
                              s.sold ? (
                                <Link
                                  key={s.serial_number}
                                  href={`/orders/${s.sold.order_id}`}
                                  title={`Sold on invoice ${s.sold.order_number}${s.sold.customer_name ? ` to ${s.sold.customer_name}` : ''} (${formatDate(s.sold.sold_at)})`}
                                  className="rounded border border-blue-200 bg-blue-50 px-1.5 py-0.5 font-mono text-[11px] text-blue-700 hover:bg-blue-100"
                                >
                                  {s.serial_number} → {s.sold.order_number}
                                </Link>
                              ) : (
                                <span
                                  key={s.serial_number}
                                  title={s.status === 'returned' ? 'Returned to supplier' : 'In stock'}
                                  className={`rounded border px-1.5 py-0.5 font-mono text-[11px] ${
                                    s.status === 'returned'
                                      ? 'border-red-200 bg-red-50 text-red-700'
                                      : 'border-gray-200 bg-gray-100 text-gray-700'
                                  }`}
                                >
                                  {s.serial_number}
                                </span>
                              )
                            )}
                          </div>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableWrap>
          </Panel>
        </>
      ) : (
        <EmptyHint icon={<Package className="h-8 w-8 opacity-40" />}>
          Select a product above to see its full purchase history, including serial numbers.
        </EmptyHint>
      )}
    </div>
  );
}

// ─── By Serial Number ───────────────────────────────────────────────────────

const SERIAL_STATUS_META: Record<PurchaseSerialHistoryEntry['status'], { label: string; badge: 'default' | 'info' | 'success' | 'danger' }> = {
  in_stock: { label: 'In Stock', badge: 'success' },
  sold: { label: 'Sold', badge: 'info' },
  returned: { label: 'Returned to Supplier', badge: 'danger' },
};

function SerialHistory() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<PurchaseSerialHistoryEntry[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) { setResults(null); setSearched(false); return; }

    setIsLoading(true);
    const timer = setTimeout(() => {
      adminService.getPurchaseSerialHistory(q)
        .then((res) => setResults(res.data?.data ?? []))
        .catch((err) => toast.error(getErrorMessage(err)))
        .finally(() => { setIsLoading(false); setSearched(true); });
    }, 400);

    return () => clearTimeout(timer);
  }, [query]);

  return (
    <div className="space-y-3">
      <FilterBar>
        <div className="relative w-full max-w-xl">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type a serial number (min. 2 characters)…"
            className="h-8 w-full rounded-lg border border-gray-300 pl-8 pr-3 text-xs focus:border-transparent focus:outline-none focus:ring-2 focus:ring-violet-500"
          />
        </div>
      </FilterBar>

      {isLoading ? (
        <div className="flex justify-center py-12"><LoadingSpinner /></div>
      ) : results && results.length > 0 ? (
        <div className="space-y-2">
          {results.map((r) => {
            const meta = SERIAL_STATUS_META[r.status];
            const productWarranty = warrantyLabel(r.product?.warranty_value, r.product?.warranty_unit);
            const batchWarranty = warrantyLabel(r.purchase?.warranty_value, r.purchase?.warranty_unit);
            return (
              <div key={r.serial_number + (r.product?.id ?? '')} className="rounded-xl border border-gray-200 bg-white p-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-mono text-sm font-semibold text-gray-900">{r.serial_number}</p>
                    <p className="mt-0.5 text-xs text-gray-600">
                      {r.product ? `${r.product.name} (${r.product.sku})` : 'Unknown product'}
                    </p>
                  </div>
                  <Badge variant={meta.badge}>{meta.label}</Badge>
                </div>

                <div className="mt-2.5 grid grid-cols-1 gap-3 border-t border-gray-100 pt-2.5 sm:grid-cols-2">
                  <div>
                    <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-wide text-gray-400">Purchased</p>
                    {r.purchase ? (
                      <div className="space-y-0.5 text-xs text-gray-700">
                        <p>
                          <Link href={`/purchases/${r.purchase.po_id}`} className="font-mono font-semibold text-primary-600 hover:underline">{r.purchase.po_number}</Link>
                          {' '}from {r.purchase.supplier?.name ?? 'Unknown supplier'}
                        </p>
                        <p className="text-gray-500">{formatDate(r.purchase.date)} · Unit cost: {formatCurrency(Number(r.purchase.unit_cost))}</p>
                        {(batchWarranty || productWarranty) && (
                          <p className="text-gray-500">Warranty: {batchWarranty ?? productWarranty}</p>
                        )}
                      </div>
                    ) : (
                      <p className="text-xs text-gray-400">No purchase batch on record</p>
                    )}
                  </div>
                  <div>
                    <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-wide text-gray-400">Sold</p>
                    {r.sold ? (
                      <div className="space-y-0.5 text-xs text-gray-700">
                        <p>
                          <Link href={`/orders/${r.sold.order_id}`} className="font-mono font-semibold text-primary-600 hover:underline">{r.sold.order_number}</Link>
                          {r.sold.customer_name ? ` — ${r.sold.customer_name}` : ''}
                        </p>
                        <p className="text-gray-500">{formatDate(r.sold.sold_at)}</p>
                      </div>
                    ) : (
                      <p className="text-xs text-gray-400">{r.status === 'returned' ? 'Not applicable — returned to supplier' : 'Still in stock, not yet sold'}</p>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : searched ? (
        <EmptyHint icon={<ScanLine className="h-8 w-8 opacity-40" />}>
          No units found matching &quot;{query.trim()}&quot;.
        </EmptyHint>
      ) : (
        <EmptyHint icon={<ScanLine className="h-8 w-8 opacity-40" />}>
          Type a serial number above to trace it back to its purchase batch and, if sold, its invoice.
        </EmptyHint>
      )}
    </div>
  );
}

// ─── Shared helpers for the two audit-log-backed tabs below ────────────────

function unwrapAuditLogs(payload: unknown): AuditLog[] {
  const list = (payload as { data?: AuditLog[] })?.data;
  return Array.isArray(list) ? list : [];
}

/** A purchase order's own line items, pulled out of an audit log's stored items[] (id + quantity
 *  only — no product name/serials are captured there), summarized as "N unit(s)" per the log. */
function itemsSummary(log: AuditLog): string {
  const items = (log.new_values as { items?: { quantity?: number }[] } | null)?.items;
  if (!items || items.length === 0) return '—';
  const total = items.reduce((sum, i) => sum + (i.quantity ?? 0), 0);
  return `${total} unit${total === 1 ? '' : 's'} across ${items.length} line${items.length === 1 ? '' : 'item'}`;
}

// ─── Return History ─────────────────────────────────────────────────────────

function ReturnHistory() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setIsLoading(true);
    Promise.all([
      adminService.getAuditLogs({ resource_type: 'PurchaseOrder', action_type: 'return_purchase_order_items', per_page: 100 }),
      adminService.getAuditLogs({ resource_type: 'PurchaseOrder', action_type: 'restock_purchase_order_return', per_page: 100 }),
    ])
      .then(([returnsRes, restocksRes]) => {
        const merged = [...unwrapAuditLogs(returnsRes.data), ...unwrapAuditLogs(restocksRes.data)]
          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        setLogs(merged);
      })
      .catch((err) => toast.error(getErrorMessage(err)))
      .finally(() => setIsLoading(false));
  }, []);

  return (
    <Panel title="Return history" hint="Every return-to-supplier and every restock (an undone return), across all purchase orders.">
      {isLoading ? (
        <div className="flex justify-center py-12"><LoadingSpinner /></div>
      ) : (
        <TableWrap>
          <table className="min-w-full text-sm">
            <thead className="sticky top-0 z-10 bg-slate-50 shadow-[0_1px_0_0_rgb(226,232,240)]">
              <tr>
                <Th>Date</Th>
                <Th>Type</Th>
                <Th>Purchase order</Th>
                <Th>Items</Th>
                <Th>By</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {logs.length === 0 ? (
                <tr><td colSpan={5} className="px-3 py-6 text-center text-sm text-gray-400">No returns or restocks recorded yet.</td></tr>
              ) : logs.map((log, i) => {
                const isRestock = log.action_type === 'restock_purchase_order_return';
                return (
                  <tr key={log.id} className={`${i % 2 ? 'bg-slate-50/50' : 'bg-white'} hover:bg-amber-50/40`}>
                    <td className="whitespace-nowrap px-3 py-2 text-xs tabular-nums text-gray-500">{formatDate(log.created_at)}</td>
                    <td className="px-3 py-2">
                      <Badge variant={isRestock ? 'success' : 'warning'} className="inline-flex items-center gap-1">
                        {isRestock ? <Undo2 className="h-3 w-3" /> : <Truck className="h-3 w-3" />}
                        {isRestock ? 'Restocked' : 'Returned'}
                      </Badge>
                    </td>
                    <td className="px-3 py-2">
                      {log.resource_id ? (
                        <Link href={`/purchases/${log.resource_id}`} className="font-semibold text-primary-600 hover:underline">
                          {log.description ?? `PO #${log.resource_id}`}
                        </Link>
                      ) : (log.description ?? '—')}
                    </td>
                    <td className="px-3 py-2 text-gray-600">{itemsSummary(log)}</td>
                    <td className="px-3 py-2 text-gray-600">{log.actor?.name ?? '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </TableWrap>
      )}
    </Panel>
  );
}

// ─── Delete History ─────────────────────────────────────────────────────────

function DeleteHistory() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setIsLoading(true);
    adminService.getAuditLogs({ resource_type: 'PurchaseOrder', action_type: 'delete_purchase_order', per_page: 100 })
      .then((res) => setLogs(unwrapAuditLogs(res.data)))
      .catch((err) => toast.error(getErrorMessage(err)))
      .finally(() => setIsLoading(false));
  }, []);

  return (
    <Panel
      title="Delete history"
      hint="Only draft POs can be deleted, before anything was received or paid, so there is no inventory or ledger impact. The deleted PO's page no longer exists; details are what was captured at deletion."
    >
      {isLoading ? (
        <div className="flex justify-center py-12"><LoadingSpinner /></div>
      ) : (
        <TableWrap>
          <table className="min-w-full text-sm">
            <thead className="sticky top-0 z-10 bg-slate-50 shadow-[0_1px_0_0_rgb(226,232,240)]">
              <tr>
                <Th>Date</Th>
                <Th>PO number</Th>
                <Th>Supplier</Th>
                <Th>Deleted by</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {logs.length === 0 ? (
                <tr><td colSpan={4} className="px-3 py-6 text-center text-sm text-gray-400">No purchase orders have been deleted.</td></tr>
              ) : logs.map((log, i) => {
                const snapshot = log.old_values as { po_number?: string; supplier?: { name?: string } } | null;
                return (
                  <tr key={log.id} className={`${i % 2 ? 'bg-slate-50/50' : 'bg-white'} hover:bg-rose-50/40`}>
                    <td className="whitespace-nowrap px-3 py-2 text-xs tabular-nums text-gray-500">{formatDate(log.created_at)}</td>
                    <td className="px-3 py-2">
                      <span className="flex items-center gap-1.5 font-mono text-gray-700">
                        <Trash2 className="h-3.5 w-3.5 text-red-400" />
                        {snapshot?.po_number ?? `#${log.resource_id}`}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-gray-600">{snapshot?.supplier?.name ?? '—'}</td>
                    <td className="px-3 py-2 text-gray-600">{log.actor?.name ?? '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </TableWrap>
      )}
    </Panel>
  );
}
