'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { Plus, Eye, Pencil, XCircle, Package, RefreshCw, Filter, History, Undo2, Trash2, Search, Wallet, Truck, Banknote } from 'lucide-react';
import { AdminLayout } from '@/components/layout';
import {
  Button, Input, Select, SearchableSelect, ConfirmModal, Badge, Modal,
  LoadingSpinner, Pagination, EmptyState, ErrorState, HistoryModal,
} from '@/components/ui';
import { KpiTile, chipClass } from '@/components/reports/shared';
import { PurchaseOrder, PurchaseOrderStatus, PaginatedResponse, Supplier } from '@/types';
import { formatCurrency, formatDate, getErrorMessage } from '@/lib/utils';
import adminService from '@/lib/adminService';
import toast from 'react-hot-toast';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

const STATUSES: { value: PurchaseOrderStatus; label: string; variant: 'default' | 'info' | 'warning' | 'success' | 'danger' }[] = [
  { value: 'draft', label: 'Draft', variant: 'default' },
  { value: 'ordered', label: 'Ordered', variant: 'info' },
  { value: 'partially_received', label: 'Partially Received', variant: 'warning' },
  { value: 'received', label: 'Received', variant: 'success' },
  { value: 'cancelled', label: 'Cancelled', variant: 'danger' },
];

const STATUS_CHIP_ACTIVE: Record<string, string> = {
  default: 'border-slate-700 bg-slate-700 text-white',
  info: 'border-sky-600 bg-sky-600 text-white',
  warning: 'border-amber-500 bg-amber-500 text-white',
  success: 'border-emerald-600 bg-emerald-600 text-white',
  danger: 'border-rose-600 bg-rose-600 text-white',
};

const STATUS_CHIP_IDLE: Record<string, string> = {
  default: 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50',
  info: 'border-sky-200 bg-white text-sky-700 hover:bg-sky-50',
  warning: 'border-amber-200 bg-white text-amber-700 hover:bg-amber-50',
  success: 'border-emerald-200 bg-white text-emerald-700 hover:bg-emerald-50',
  danger: 'border-rose-200 bg-white text-rose-700 hover:bg-rose-50',
};

function statusBadge(status: string) {
  const config = STATUSES.find((s) => s.value === status);
  return <Badge variant={config?.variant || 'default'}>{config?.label || status}</Badge>;
}

function canCancel(status: string) {
  return ['draft', 'ordered', 'partially_received'].includes(status);
}

/**
 * "Returned" isn't a value `status` can hold — a PO can be `received` (or `partially_received`)
 * *and* have some of its items sent back to the supplier afterward. So whether a return happened,
 * and whether it's since been undone via Restock from Return, has to be derived from the item
 * lines rather than read off status directly. Mirrors the has_returns filter added to
 * PurchaseOrderController::index() and the same distinction already drawn on the PO detail page's
 * Restock feature.
 */
function returnBadge(po: PurchaseOrder) {
  const items = po.items || [];
  if (items.length === 0) {
    // items aren't loaded on the list response fallback path — fall back to the aggregate value.
    if (po.returned_value > 0) return <Badge variant="warning">Returned</Badge>;
    return null;
  }
  const totalReturned = items.reduce((sum, i) => sum + (i.returned_qty || 0), 0);
  if (totalReturned <= 0) return null;
  const totalReceived = items.reduce((sum, i) => sum + (i.received_qty || 0), 0);
  const fullyReturned = totalReceived > 0 && totalReturned >= totalReceived;
  return <Badge variant={fullyReturned ? 'danger' : 'warning'}>{fullyReturned ? 'Fully Returned' : 'Partially Returned'}</Badge>;
}

const PAYMENT_STATUSES: { value: string; label: string; variant: 'default' | 'warning' | 'success' }[] = [
  { value: 'unpaid', label: 'Unpaid', variant: 'default' },
  { value: 'partial', label: 'Partially Paid', variant: 'warning' },
  { value: 'paid', label: 'Paid', variant: 'success' },
];

function paymentBadge(status: string) {
  const config = PAYMENT_STATUSES.find((s) => s.value === status);
  return <Badge variant={config?.variant || 'default'}>{config?.label || status}</Badge>;
}

export default function PurchasesPage() {
  const router = useRouter();
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Filters
  const [filterStatus, setFilterStatus] = useState('');
  const [filterSupplier, setFilterSupplier] = useState<string | number>('');
  const [filterPaymentStatus, setFilterPaymentStatus] = useState('');
  const [filterHasReturns, setFilterHasReturns] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Cancel confirm
  const [cancelTarget, setCancelTarget] = useState<PurchaseOrder | null>(null);
  const [historyPO, setHistoryPO] = useState<PurchaseOrder | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);

  // Supplier payments (handled here in Purchases, not on the Payments page)
  const [payTarget, setPayTarget] = useState<PurchaseOrder | null>(null);
  const [payAmount, setPayAmount] = useState('');
  const [isPaying, setIsPaying] = useState(false);
  const [owed, setOwed] = useState<{ total: number; count: number } | null>(null);

  const fetchSuppliers = useCallback(async () => {
    try {
      const res = await adminService.getSuppliers({ per_page: 200, is_active: 'true' });
      const payload = res.data?.data as unknown;
      const list = Array.isArray(payload) ? payload : (payload as { data?: Supplier[] })?.data;
      setSuppliers(Array.isArray(list) ? (list as Supplier[]) : []);
    } catch {
      // silent — supplier filter just won't populate
    }
  }, []);

  const fetchOrders = useCallback(async () => {
    setIsLoading(true);
    setError(false);
    try {
      const params: Record<string, string | number> = { page: currentPage, per_page: 15 };
      if (filterStatus) params.status = filterStatus;
      if (filterSupplier) params.supplier_id = filterSupplier;
      if (filterPaymentStatus) params.payment_status = filterPaymentStatus;
      if (filterHasReturns) params.has_returns = 1;
      if (searchQuery) params.search = searchQuery;

      const res = await adminService.getPurchases(params);
      const payload = res.data?.data as unknown;
      const paged: Partial<PaginatedResponse<PurchaseOrder>> = (Array.isArray(payload)
        ? { data: payload }
        : (payload as PaginatedResponse<PurchaseOrder>)) ?? { data: [] };
      setOrders(Array.isArray(paged.data) ? paged.data : []);
      setTotalPages(paged.meta?.last_page || 1);
      setTotalCount(paged.meta?.total || 0);
    } catch (err) {
      toast.error(getErrorMessage(err));
      setError(true);
      setOrders([]);
    } finally {
      setIsLoading(false);
    }
  }, [currentPage, filterStatus, filterSupplier, filterPaymentStatus, filterHasReturns, searchQuery]);

  useEffect(() => { fetchSuppliers(); }, [fetchSuppliers]);

  const loadOwed = useCallback(async () => {
    try {
      const res = await adminService.getDues({ type: 'payable', per_page: 1 });
      const body = res.data as unknown as { summary: { payable: { total: number; count: number } } };
      setOwed(body.summary.payable);
    } catch {
      setOwed(null);
    }
  }, []);
  useEffect(() => { loadOwed(); }, [loadOwed]);
  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  const handleSearch = () => {
    setCurrentPage(1);
    fetchOrders();
  };

  const clearFilters = () => {
    setFilterStatus('');
    setFilterSupplier('');
    setFilterPaymentStatus('');
    setFilterHasReturns(false);
    setSearchQuery('');
    setCurrentPage(1);
  };

  const handleCancel = async () => {
    if (!cancelTarget) return;
    setIsCancelling(true);
    try {
      await adminService.cancelPurchase(cancelTarget.id);
      toast.success('Purchase order cancelled.');
      setCancelTarget(null);
      fetchOrders();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setIsCancelling(false);
    }
  };

  const from = totalCount === 0 ? 0 : (currentPage - 1) * 15 + 1;
  const to = Math.min(totalCount, currentPage * 15);

  return (
    <AdminLayout>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <h1 className="text-lg font-bold text-gray-900">Purchase Orders</h1>
          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-semibold text-gray-600">
            {totalCount} order{totalCount !== 1 ? 's' : ''}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* Deleted POs are hard-deleted and can never appear in this list — the only place
              to see them (or the full return trail) is the dedicated History page. */}
          <Link href="/purchases/history?tab=returns">
            <Button variant="outline" size="sm" leftIcon={<Undo2 className="w-3.5 h-3.5" />}>Return History</Button>
          </Link>
          <Link href="/purchases/history?tab=deletes">
            <Button variant="outline" size="sm" leftIcon={<Trash2 className="w-3.5 h-3.5" />}>Delete History</Button>
          </Link>
          <Button size="sm" onClick={() => router.push('/purchases/create')} leftIcon={<Plus className="w-3.5 h-3.5" />}>
            Create Purchase Order
          </Button>
        </div>
      </div>

      <div className="mb-3 grid grid-cols-2 gap-2 lg:grid-cols-3">
        <KpiTile label="Owed to suppliers" value={formatCurrency(owed?.total ?? 0)} tone="rose" icon={<Truck className="h-4 w-4 opacity-60" />} sub={`${owed?.count ?? 0} open purchase orders`} />
        <KpiTile label="Paid this page" value={formatCurrency(orders.reduce((s, o) => s + Number(o.paid_amount || 0), 0))} tone="emerald" icon={<Banknote className="h-4 w-4 opacity-60" />} sub="Already paid on these orders" />
        <KpiTile label="Still open (page)" value={formatCurrency(orders.reduce((s, o) => s + Number(o.outstanding_payable || 0), 0))} tone="amber" icon={<Wallet className="h-4 w-4 opacity-60" />} sub="Owed on these orders" />
      </div>

      <div className="mb-3 space-y-2 rounded-xl border border-gray-200 bg-white p-2.5">
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => { setFilterStatus(''); setCurrentPage(1); }}
            className={`rounded-full border px-2.5 py-1 text-xs font-semibold transition-colors ${
              filterStatus === '' ? 'border-slate-700 bg-slate-700 text-white' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
            }`}
          >
            All
          </button>
          {STATUSES.map((s) => (
            <button
              key={s.value}
              type="button"
              onClick={() => { setFilterStatus(s.value); setCurrentPage(1); }}
              className={`rounded-full border px-2.5 py-1 text-xs font-semibold transition-colors ${
                filterStatus === s.value ? STATUS_CHIP_ACTIVE[s.variant] : STATUS_CHIP_IDLE[s.variant]
              }`}
            >
              {s.label}
            </button>
          ))}
          {/* Not a `status` value — a PO keeps its receive/partial status even after some of its
              items are sent back, so "has returns" is a separate, combinable toggle. */}
          <button
            type="button"
            onClick={() => { setFilterHasReturns((v) => !v); setCurrentPage(1); }}
            className={`rounded-full border px-2.5 py-1 text-xs font-semibold transition-colors ${
              filterHasReturns ? 'border-amber-500 bg-amber-500 text-white' : 'border-amber-200 bg-white text-amber-700 hover:bg-amber-50'
            }`}
          >
            Has returns
          </button>
          <span className="mx-1 self-center text-gray-300">|</span>
          <div className="flex gap-1.5">
            <button type="button" onClick={() => { setFilterPaymentStatus(''); setCurrentPage(1); }} className={chipClass(filterPaymentStatus === '')}>All payments</button>
            <button type="button" onClick={() => { setFilterPaymentStatus('unpaid'); setCurrentPage(1); }} className={chipClass(filterPaymentStatus === 'unpaid')}>Unpaid</button>
            <button type="button" onClick={() => { setFilterPaymentStatus('partial'); setCurrentPage(1); }} className={chipClass(filterPaymentStatus === 'partial')}>Partial</button>
            <button type="button" onClick={() => { setFilterPaymentStatus('paid'); setCurrentPage(1); }} className={chipClass(filterPaymentStatus === 'paid')}>Paid</button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[200px] flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
            <Input
              placeholder="Search by PO number…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              className="h-8 pl-8 text-xs"
            />
          </div>
          <div className="w-44 shrink-0">
            <SearchableSelect
              placeholder="All suppliers"
              allowClear
              value={filterSupplier}
              onChange={(v) => { setFilterSupplier(v); setCurrentPage(1); }}
              options={suppliers.map((s) => ({ value: s.id, label: s.name }))}
            />
          </div>
          <Button size="sm" onClick={handleSearch} leftIcon={<Filter className="w-3.5 h-3.5" />}>Filter</Button>
          <Button size="sm" variant="ghost" onClick={clearFilters}>Clear</Button>
          <Button size="sm" variant="ghost" onClick={fetchOrders} leftIcon={<RefreshCw className="w-3.5 h-3.5" />}>Refresh</Button>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        {isLoading ? (
          <div className="flex justify-center py-10"><LoadingSpinner /></div>
        ) : error ? (
          <ErrorState message="Failed to load purchase orders." onRetry={fetchOrders} />
        ) : orders.length === 0 ? (
          <EmptyState
            icon={<Package className="w-8 h-8 text-gray-400" />}
            title="No purchase orders found"
            description="Create your first purchase order to start recording stock procurement."
            action={<Button onClick={() => router.push('/purchases/create')} leftIcon={<Plus className="w-4 h-4" />}>Create Purchase Order</Button>}
          />
        ) : (
          <div className="max-h-[calc(100vh-17rem)] overflow-auto">
            <table className="min-w-full text-sm">
              <thead className="sticky top-0 z-10 bg-slate-50 text-xs uppercase tracking-wide text-slate-500 shadow-[0_1px_0_0_rgb(226,232,240)]">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold">PO number</th>
                  <th className="px-3 py-2 text-left font-semibold">Supplier</th>
                  <th className="px-3 py-2 text-left font-semibold">Status</th>
                  <th className="px-3 py-2 text-right font-semibold">Total</th>
                  <th className="px-3 py-2 text-left font-semibold">Payment</th>
                  <th className="whitespace-nowrap px-3 py-2 text-left font-semibold">Expected</th>
                  <th className="whitespace-nowrap px-3 py-2 text-left font-semibold">Created</th>
                  <th className="px-3 py-2 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {orders.map((po, i) => (
                  <tr key={po.id} className={`${i % 2 ? 'bg-slate-50/50' : 'bg-white'} hover:bg-indigo-50/40`}>
                    <td className="px-3 py-2">
                      <Link href={`/purchases/${po.id}`} className="whitespace-nowrap font-mono font-semibold text-primary-600 hover:underline">
                        {po.po_number}
                      </Link>
                    </td>
                    <td className="px-3 py-2 text-gray-700">{po.supplier?.name || '—'}</td>
                    <td className="px-3 py-2">
                      <div className="flex flex-col items-start gap-1">
                        {statusBadge(po.status)}
                        {returnBadge(po)}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-right font-semibold tabular-nums text-gray-900">{formatCurrency(Number(po.total))}</td>
                    <td className="px-3 py-2">
                      {paymentBadge(po.payment_status)}
                      {po.payment_status === 'partial' && (
                        <div className="mt-0.5 text-[11px] text-gray-500">
                          Paid {formatCurrency(Number(po.paid_amount))} of {formatCurrency(po.received_value)}
                        </div>
                      )}
                      {po.payment_status === 'unpaid' && po.outstanding_payable > 0 && (
                        <div className="mt-0.5 text-[11px] font-semibold text-rose-600">
                          Owed {formatCurrency(po.outstanding_payable)}
                        </div>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-xs tabular-nums text-gray-500">{po.expected_date ? formatDate(po.expected_date) : '—'}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-xs tabular-nums text-gray-500">{formatDate(po.created_at)}</td>
                    <td className="px-3 py-2">
                      <div className="flex items-center justify-end gap-0.5">
                        {po.outstanding_payable > 0 && po.status !== 'cancelled' && (
                          <Button size="sm" onClick={() => { setPayTarget(po); setPayAmount(String(po.outstanding_payable)); }} className="mr-1 whitespace-nowrap">
                            <Wallet className="mr-1 h-3.5 w-3.5" /> Pay
                          </Button>
                        )}
                        <Link href={`/purchases/${po.id}`} title="View" className="rounded-md p-1 text-indigo-600 hover:bg-indigo-50">
                          <Eye className="h-3.5 w-3.5" />
                        </Link>
                        <button type="button" title="View history" onClick={() => setHistoryPO(po)} className="rounded-md p-1 text-slate-500 hover:bg-slate-100">
                          <History className="h-3.5 w-3.5" />
                        </button>
                        {['draft', 'ordered'].includes(po.status) && (
                          <Link href={`/purchases/${po.id}/edit`} title="Edit" className="rounded-md p-1 text-sky-600 hover:bg-sky-50">
                            <Pencil className="h-3.5 w-3.5" />
                          </Link>
                        )}
                        {canCancel(po.status) && (
                          <button type="button" title="Cancel" onClick={() => setCancelTarget(po)} className="rounded-md p-1 text-rose-500 hover:bg-rose-50">
                            <XCircle className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {totalCount > 0 && (
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-gray-500">
          <span>
            Showing <span className="font-semibold text-gray-700">{from}–{to}</span> of{' '}
            <span className="font-semibold text-gray-700">{totalCount}</span>
          </span>
          {totalPages > 1 && (
            <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
          )}
        </div>
      )}

      {/* Pay a supplier — full or partial, capped at what's still owed on this PO */}
      <Modal isOpen={!!payTarget} onClose={() => setPayTarget(null)} title={payTarget ? `Pay supplier — ${payTarget.po_number}` : ''} size="sm">
        {payTarget && (() => {
          const due = Number(payTarget.outstanding_payable || 0);
          const amt = Number(payAmount);
          const valid = amt > 0 && amt <= due + 0.001;
          const after = Math.max(0, due - (valid ? amt : 0));
          const handlePay = async () => {
            setIsPaying(true);
            try {
              await adminService.payPurchase(payTarget.id, amt);
              toast.success(amt >= due - 0.001 ? `${payTarget.po_number} paid in full` : `Partial payment of ${formatCurrency(amt)} recorded`);
              setPayTarget(null);
              loadOwed();
              fetchOrders();
            } catch (err) {
              toast.error(getErrorMessage(err));
            } finally {
              setIsPaying(false);
            }
          };
          return (
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-2 rounded-lg border border-gray-200 bg-slate-50 p-3 text-center">
                <div><p className="text-[10px] uppercase tracking-wide text-gray-500">Supplier</p><p className="truncate text-xs font-semibold">{payTarget.supplier?.name || '—'}</p></div>
                <div><p className="text-[10px] uppercase tracking-wide text-gray-500">Paid</p><p className="text-sm font-bold tabular-nums text-emerald-700">{formatCurrency(Number(payTarget.paid_amount || 0))}</p></div>
                <div><p className="text-[10px] uppercase tracking-wide text-gray-500">Owed</p><p className="text-sm font-bold tabular-nums text-rose-700">{formatCurrency(due)}</p></div>
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-gray-500">Amount now</label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    min={0.01}
                    max={due}
                    step="0.01"
                    value={payAmount}
                    onChange={(e) => setPayAmount(e.target.value)}
                    className="h-9 flex-1 rounded-lg border border-gray-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <Button variant="outline" size="sm" onClick={() => setPayAmount(String(due))}>Full</Button>
                </div>
                <p className="mt-1 text-[11px] text-gray-500">
                  {valid
                    ? after > 0.001 ? `Partial — ${formatCurrency(after)} stays owed after this payment.` : 'Settles the full amount owed.'
                    : `Enter an amount between 0.01 and ${formatCurrency(due)}.`}
                </p>
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <Button variant="ghost" onClick={() => setPayTarget(null)}>Cancel</Button>
                <Button onClick={handlePay} isLoading={isPaying} disabled={!valid}>Pay supplier</Button>
              </div>
            </div>
          );
        })()}
      </Modal>

      <ConfirmModal
        isOpen={!!cancelTarget}
        onClose={() => setCancelTarget(null)}
        onConfirm={handleCancel}
        title="Cancel Purchase Order"
        message={`Cancel purchase order "${cancelTarget?.po_number}"? Any already-received stock will not be reversed.`}
        confirmLabel="Cancel Order"
        variant="danger"
        isLoading={isCancelling}
      />

      {historyPO && (
        <HistoryModal
          isOpen={!!historyPO}
          onClose={() => setHistoryPO(null)}
          resourceType="PurchaseOrder"
          resourceId={historyPO.id}
          resourceLabel={`PO #${historyPO.po_number}`}
          createdBy={historyPO.creator}
          createdAt={historyPO.created_at}
          updatedAt={historyPO.updated_at}
        />
      )}
    </AdminLayout>
  );
}
