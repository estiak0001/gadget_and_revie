'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { Truck, Package, Phone, Mail, MapPin, Search, ScanLine, Trash2, Undo2 } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { AdminLayout } from '@/components/layout';
import { Card, CardContent, CardHeader, CardTitle, Badge, LoadingSpinner, InfoButton, SearchableSelect } from '@/components/ui';
import { Supplier, PurchaseOrder, PurchaseProductHistory, PurchaseSerialHistoryEntry, Product, PurchaseOrderStatus, AuditLog } from '@/types';
import { formatCurrency, formatDate, getErrorMessage } from '@/lib/utils';
import adminService from '@/lib/adminService';
import toast from 'react-hot-toast';

type Mode = 'supplier' | 'product' | 'serial' | 'deletes' | 'returns';

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
      <div className="space-y-6">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-gray-900">Purchase History</h1>
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
          <p className="text-sm text-gray-500 mt-1">Search by supplier, product, or serial number to see the full purchase trail.</p>
        </div>

        <div className="inline-flex rounded-lg border border-gray-200 bg-white p-1 shadow-sm">
          <button
            type="button"
            onClick={() => setMode('supplier')}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${mode === 'supplier' ? 'bg-primary-600 text-white' : 'text-gray-600 hover:bg-gray-50'}`}
          >
            By Supplier
          </button>
          <button
            type="button"
            onClick={() => setMode('product')}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${mode === 'product' ? 'bg-primary-600 text-white' : 'text-gray-600 hover:bg-gray-50'}`}
          >
            By Product
          </button>
          <button
            type="button"
            onClick={() => setMode('serial')}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${mode === 'serial' ? 'bg-primary-600 text-white' : 'text-gray-600 hover:bg-gray-50'}`}
          >
            By Serial Number
          </button>
          <button
            type="button"
            onClick={() => setMode('returns')}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${mode === 'returns' ? 'bg-primary-600 text-white' : 'text-gray-600 hover:bg-gray-50'}`}
          >
            Return History
          </button>
          <button
            type="button"
            onClick={() => setMode('deletes')}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${mode === 'deletes' ? 'bg-primary-600 text-white' : 'text-gray-600 hover:bg-gray-50'}`}
          >
            Delete History
          </button>
        </div>

        {mode === 'supplier' && <SupplierHistory />}
        {mode === 'product' && <ProductHistory />}
        {mode === 'serial' && <SerialHistory />}
        {mode === 'returns' && <ReturnHistory />}
        {mode === 'deletes' && <DeleteHistory />}
      </div>
    </AdminLayout>
  );
}

export default function PurchaseHistoryPage() {
  return (
    <Suspense fallback={<AdminLayout><div className="flex items-center justify-center min-h-screen"><LoadingSpinner size="lg" text="Loading..." /></div></AdminLayout>}>
      <PurchaseHistoryContent />
    </Suspense>
  );
}

function StatTile({ label, value, tone = 'gray' }: { label: string; value: string; tone?: 'gray' | 'primary' | 'success' | 'amber' }) {
  const toneClasses = {
    gray: 'border-gray-200 bg-gray-50/60 text-gray-900',
    primary: 'border-primary-200 bg-primary-50/60 text-primary-800',
    success: 'border-emerald-200 bg-emerald-50/60 text-emerald-800',
    amber: 'border-amber-200 bg-amber-50/60 text-amber-800',
  }[tone];
  return (
    <div className={`rounded-xl border p-3.5 ${toneClasses}`}>
      <p className="text-[11px] font-semibold uppercase tracking-wide opacity-70">{label}</p>
      <p className="text-lg font-bold mt-1 tabular-nums">{value}</p>
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
    <div className="space-y-4">
      <Card>
        <CardContent className="pt-4">
          <SearchableSelect
            label="Supplier"
            value={supplierId}
            onChange={(v) => setSupplierId(v as number)}
            options={suppliers.map((s) => ({ value: s.id, label: s.name, description: s.phone || s.email }))}
            placeholder="Search and select a supplier..."
            searchPlaceholder="Search suppliers..."
            allowClear
          />
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="flex justify-center py-12"><LoadingSpinner /></div>
      ) : supplier ? (
        <>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                  <h2 className="text-lg font-bold text-gray-900">{supplier.name}</h2>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1.5 text-sm text-gray-600">
                    {supplier.contact_person && <span>{supplier.contact_person}</span>}
                    {supplier.phone && (
                      <span className="flex items-center gap-1"><Phone className="w-3.5 h-3.5" />{supplier.phone}</span>
                    )}
                    {supplier.email && (
                      <span className="flex items-center gap-1"><Mail className="w-3.5 h-3.5" />{supplier.email}</span>
                    )}
                    {supplier.address && (
                      <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" />{supplier.address}</span>
                    )}
                  </div>
                </div>
                <Badge variant={supplier.is_active ? 'success' : 'default'}>{supplier.is_active ? 'Active' : 'Inactive'}</Badge>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatTile label="Purchase Orders" value={String(orders.length)} />
            <StatTile label="Total Value" value={formatCurrency(totals.total)} tone="primary" />
            <StatTile label="Total Paid" value={formatCurrency(totals.paid)} tone="success" />
            <StatTile label="Outstanding" value={formatCurrency(totals.outstanding)} tone="amber" />
          </div>

          <Card>
            <CardHeader><CardTitle className="text-base">Purchase Orders</CardTitle></CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-gray-500">PO Number</th>
                      <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-gray-500">Date</th>
                      <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-gray-500">Status</th>
                      <th className="px-4 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wide text-gray-500">Total</th>
                      <th className="px-4 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wide text-gray-500">Paid</th>
                      <th className="px-4 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wide text-gray-500">Outstanding</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {orders.length === 0 ? (
                      <tr><td colSpan={6} className="px-4 py-6 text-center text-gray-400">No purchase orders from this supplier yet.</td></tr>
                    ) : orders.map((po) => (
                      <tr key={po.id} className="hover:bg-gray-50">
                        <td className="px-4 py-2.5">
                          <Link href={`/purchases/${po.id}`} className="text-primary-600 hover:underline font-medium">{po.po_number}</Link>
                        </td>
                        <td className="px-4 py-2.5 text-gray-600 whitespace-nowrap">{formatDate(po.created_at)}</td>
                        <td className="px-4 py-2.5">
                          <Badge variant={STATUS_BADGE[po.status] ?? 'default'} className="capitalize">{po.status.replace('_', ' ')}</Badge>
                        </td>
                        <td className="px-4 py-2.5 text-right tabular-nums">{formatCurrency(Number(po.total))}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums text-emerald-700">{formatCurrency(Number(po.paid_amount))}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums text-amber-700">{formatCurrency(po.outstanding_payable ?? 0)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      ) : (
        <div className="text-center py-16 text-gray-400">
          <Truck className="w-10 h-10 mx-auto mb-2 opacity-40" />
          <p>Select a supplier above to see their full purchase history.</p>
        </div>
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
    <div className="space-y-4">
      <Card>
        <CardContent className="pt-4">
          <SearchableSelect
            label="Product"
            value={productId}
            onChange={(v) => setProductId(v as number)}
            options={products.map((p) => ({ value: p.id, label: p.name, description: p.sku }))}
            placeholder="Search and select a product..."
            searchPlaceholder="Search products..."
            allowClear
          />
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="flex justify-center py-12"><LoadingSpinner /></div>
      ) : data ? (
        <>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                  <h2 className="text-lg font-bold text-gray-900">{data.product.name}</h2>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1.5 text-sm text-gray-600">
                    <span>SKU: {data.product.sku}</span>
                    <span>Current Stock: {data.product.stock_qty}</span>
                    <span>Current Cost: {formatCurrency(Number(data.product.current_cost ?? 0))}</span>
                  </div>
                </div>
                {productWarranty && <Badge variant="info">Warranty: {productWarranty}</Badge>}
              </div>
              {data.product.warranty_note && (
                <p className="text-xs text-gray-500 mt-2">{data.product.warranty_note}</p>
              )}
            </CardContent>
          </Card>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatTile label="Purchase Orders" value={String(data.summary.total_purchase_orders)} />
            <StatTile label="Qty Received" value={String(data.summary.total_quantity_received)} tone="success" />
            <StatTile label="Total Spent" value={formatCurrency(data.summary.total_spent)} tone="primary" />
            <StatTile label="Avg Unit Cost" value={formatCurrency(data.summary.avg_unit_cost)} tone="amber" />
          </div>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-2">
              <CardTitle className="text-base">Purchase Batches</CardTitle>
              <div className="flex items-center gap-3 text-xs text-gray-500">
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-gray-100 border border-gray-300" />In stock</span>
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-blue-50 border border-blue-300" />Sold (→ invoice)</span>
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-red-50 border border-red-300" />Returned</span>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-gray-500">Date</th>
                      <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-gray-500">PO Number</th>
                      <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-gray-500">Supplier</th>
                      <th className="px-4 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wide text-gray-500">Qty</th>
                      <th className="px-4 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wide text-gray-500">Unit Cost</th>
                      <th className="px-4 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wide text-gray-500">Total</th>
                      <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-gray-500">Warranty</th>
                      <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-gray-500">Serial Numbers</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {data.items.length === 0 ? (
                      <tr><td colSpan={8} className="px-4 py-6 text-center text-gray-400">This product has never been purchased.</td></tr>
                    ) : data.items.map((item) => (
                      <tr key={item.id} className="hover:bg-gray-50 align-top">
                        <td className="px-4 py-2.5 text-gray-600 whitespace-nowrap">{formatDate(item.date)}</td>
                        <td className="px-4 py-2.5 whitespace-nowrap">
                          <Link href={`/purchases/${item.po_id}`} className="text-primary-600 hover:underline font-medium">{item.po_number}</Link>
                        </td>
                        <td className="px-4 py-2.5 text-gray-700">{item.supplier?.name ?? '—'}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums whitespace-nowrap">{item.received_qty}/{item.quantity}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums">{formatCurrency(Number(item.unit_cost))}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums font-medium">{formatCurrency(Number(item.total_cost))}</td>
                        <td className="px-4 py-2.5 text-gray-600 whitespace-nowrap">{warrantyLabel(item.warranty_value, item.warranty_unit) ?? '—'}</td>
                        <td className="px-4 py-2.5">
                          {item.serials.length > 0 ? (
                            <div className="flex flex-wrap gap-1 max-w-sm">
                              {item.serials.map((s) =>
                                s.sold ? (
                                  <Link
                                    key={s.serial_number}
                                    href={`/orders/${s.sold.order_id}`}
                                    title={`Sold on invoice ${s.sold.order_number}${s.sold.customer_name ? ` to ${s.sold.customer_name}` : ''} (${formatDate(s.sold.sold_at)})`}
                                    className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 text-xs font-mono border border-blue-200 hover:bg-blue-100"
                                  >
                                    {s.serial_number} → {s.sold.order_number}
                                  </Link>
                                ) : (
                                  <span
                                    key={s.serial_number}
                                    title={s.status === 'returned' ? 'Returned to supplier' : 'In stock'}
                                    className={`px-1.5 py-0.5 rounded text-xs font-mono border ${
                                      s.status === 'returned'
                                        ? 'bg-red-50 text-red-700 border-red-200'
                                        : 'bg-gray-100 text-gray-700 border-gray-200'
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
              </div>
            </CardContent>
          </Card>
        </>
      ) : (
        <div className="text-center py-16 text-gray-400">
          <Package className="w-10 h-10 mx-auto mb-2 opacity-40" />
          <p>Select a product above to see its full purchase history, including serial numbers.</p>
        </div>
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
    <div className="space-y-4">
      <Card>
        <CardContent className="pt-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Type a serial number (min. 2 characters)..."
              className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="flex justify-center py-12"><LoadingSpinner /></div>
      ) : results && results.length > 0 ? (
        <div className="space-y-3">
          {results.map((r) => {
            const meta = SERIAL_STATUS_META[r.status];
            const productWarranty = warrantyLabel(r.product?.warranty_value, r.product?.warranty_unit);
            const batchWarranty = warrantyLabel(r.purchase?.warranty_value, r.purchase?.warranty_unit);
            return (
              <Card key={r.serial_number + (r.product?.id ?? '')}>
                <CardContent className="pt-4">
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div>
                      <p className="font-mono text-sm font-semibold text-gray-900">{r.serial_number}</p>
                      <p className="text-sm text-gray-600 mt-0.5">
                        {r.product ? `${r.product.name} (${r.product.sku})` : 'Unknown product'}
                      </p>
                    </div>
                    <Badge variant={meta.badge}>{meta.label}</Badge>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4 pt-4 border-t border-gray-100">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 mb-1">Purchased</p>
                      {r.purchase ? (
                        <div className="text-sm text-gray-700 space-y-0.5">
                          <p>
                            <Link href={`/purchases/${r.purchase.po_id}`} className="text-primary-600 hover:underline font-medium">{r.purchase.po_number}</Link>
                            {' '}from {r.purchase.supplier?.name ?? 'Unknown supplier'}
                          </p>
                          <p className="text-gray-500">{formatDate(r.purchase.date)} · Unit Cost: {formatCurrency(Number(r.purchase.unit_cost))}</p>
                          {(batchWarranty || productWarranty) && (
                            <p className="text-gray-500">Warranty: {batchWarranty ?? productWarranty}</p>
                          )}
                        </div>
                      ) : (
                        <p className="text-sm text-gray-400">No purchase batch on record</p>
                      )}
                    </div>
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 mb-1">Sold</p>
                      {r.sold ? (
                        <div className="text-sm text-gray-700 space-y-0.5">
                          <p>
                            <Link href={`/orders/${r.sold.order_id}`} className="text-primary-600 hover:underline font-medium">{r.sold.order_number}</Link>
                            {r.sold.customer_name ? ` — ${r.sold.customer_name}` : ''}
                          </p>
                          <p className="text-gray-500">{formatDate(r.sold.sold_at)}</p>
                        </div>
                      ) : (
                        <p className="text-sm text-gray-400">{r.status === 'returned' ? 'Not applicable — returned to supplier' : 'Still in stock, not yet sold'}</p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : searched ? (
        <div className="text-center py-16 text-gray-400">
          <ScanLine className="w-10 h-10 mx-auto mb-2 opacity-40" />
          <p>No units found matching &quot;{query.trim()}&quot;.</p>
        </div>
      ) : (
        <div className="text-center py-16 text-gray-400">
          <ScanLine className="w-10 h-10 mx-auto mb-2 opacity-40" />
          <p>Type a serial number above to trace it back to its purchase batch and, if sold, its invoice.</p>
        </div>
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
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Return History</CardTitle>
        <p className="text-xs text-gray-500 mt-1">Every return-to-supplier and every restock (an undone return), across all purchase orders.</p>
      </CardHeader>
      <CardContent className="p-0">
        {isLoading ? (
          <div className="flex justify-center py-12"><LoadingSpinner /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-gray-500">Date</th>
                  <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-gray-500">Type</th>
                  <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-gray-500">Purchase Order</th>
                  <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-gray-500">Items</th>
                  <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-gray-500">By</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {logs.length === 0 ? (
                  <tr><td colSpan={5} className="px-4 py-6 text-center text-gray-400">No returns or restocks recorded yet.</td></tr>
                ) : logs.map((log) => {
                  const isRestock = log.action_type === 'restock_purchase_order_return';
                  return (
                    <tr key={log.id} className="hover:bg-gray-50">
                      <td className="px-4 py-2.5 text-gray-600 whitespace-nowrap">{formatDate(log.created_at)}</td>
                      <td className="px-4 py-2.5">
                        <Badge variant={isRestock ? 'success' : 'warning'} className="inline-flex items-center gap-1">
                          {isRestock ? <Undo2 className="w-3 h-3" /> : <Truck className="w-3 h-3" />}
                          {isRestock ? 'Restocked' : 'Returned'}
                        </Badge>
                      </td>
                      <td className="px-4 py-2.5">
                        {log.resource_id ? (
                          <Link href={`/purchases/${log.resource_id}`} className="text-primary-600 hover:underline font-medium">
                            {log.description ?? `PO #${log.resource_id}`}
                          </Link>
                        ) : (log.description ?? '—')}
                      </td>
                      <td className="px-4 py-2.5 text-gray-600">{itemsSummary(log)}</td>
                      <td className="px-4 py-2.5 text-gray-600">{log.actor?.name ?? '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
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
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Delete History</CardTitle>
        <p className="text-xs text-gray-500 mt-1">
          Deleted purchase orders — only ever possible while still a draft, before anything was received or paid, so there&apos;s
          no inventory/ledger impact to reconcile. The deleted PO&apos;s own page no longer exists; details below are what was
          captured at the moment of deletion.
        </p>
      </CardHeader>
      <CardContent className="p-0">
        {isLoading ? (
          <div className="flex justify-center py-12"><LoadingSpinner /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-gray-500">Date</th>
                  <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-gray-500">PO Number</th>
                  <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-gray-500">Supplier</th>
                  <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-gray-500">Deleted By</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {logs.length === 0 ? (
                  <tr><td colSpan={4} className="px-4 py-6 text-center text-gray-400">No purchase orders have been deleted.</td></tr>
                ) : logs.map((log) => {
                  const snapshot = log.old_values as { po_number?: string; supplier?: { name?: string } } | null;
                  return (
                    <tr key={log.id} className="hover:bg-gray-50">
                      <td className="px-4 py-2.5 text-gray-600 whitespace-nowrap">{formatDate(log.created_at)}</td>
                      <td className="px-4 py-2.5 flex items-center gap-1.5 text-gray-700">
                        <Trash2 className="w-3.5 h-3.5 text-red-400" />
                        {snapshot?.po_number ?? `#${log.resource_id}`}
                      </td>
                      <td className="px-4 py-2.5 text-gray-600">{snapshot?.supplier?.name ?? '—'}</td>
                      <td className="px-4 py-2.5 text-gray-600">{log.actor?.name ?? '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
