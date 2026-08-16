'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { Plus, Eye, Pencil, XCircle, Package, RefreshCw, Filter, History, Undo2, Trash2 } from 'lucide-react';
import { AdminLayout } from '@/components/layout';
import {
  Card, CardContent, CardHeader, CardTitle,
  Button, Input, Select, SearchableSelect, ConfirmModal, Badge,
  LoadingSpinner, Pagination, EmptyState, ErrorState, HistoryModal,
} from '@/components/ui';
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

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Purchase Orders</h1>
            <p className="text-sm text-gray-500 mt-1">{totalCount} order{totalCount !== 1 ? 's' : ''}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {/* Deleted POs are hard-deleted and can never appear in this list — the only place
                to see them (or the full return trail) is the dedicated History page. */}
            <Link href="/purchases/history?tab=returns">
              <Button variant="outline" size="sm" leftIcon={<Undo2 className="w-4 h-4" />}>
                Return History
              </Button>
            </Link>
            <Link href="/purchases/history?tab=deletes">
              <Button variant="outline" size="sm" leftIcon={<Trash2 className="w-4 h-4" />}>
                Delete History
              </Button>
            </Link>
            <Button onClick={() => router.push('/purchases/create')} leftIcon={<Plus className="w-4 h-4" />}>
              Create Purchase Order
            </Button>
          </div>
        </div>

        {/* Status tab-strip */}
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => { setFilterStatus(''); setCurrentPage(1); }}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              filterStatus === '' ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            All
          </button>
          {STATUSES.map((s) => (
            <button
              key={s.value}
              onClick={() => { setFilterStatus(s.value); setCurrentPage(1); }}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                filterStatus === s.value ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {s.label}
            </button>
          ))}
          {/* Not a `status` value — a PO keeps its receive/partial status even after some of its
              items are sent back, so "has returns" is a separate, combinable toggle rather than
              another mutually-exclusive status tab. */}
          <button
            onClick={() => { setFilterHasReturns((v) => !v); setCurrentPage(1); }}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              filterHasReturns ? 'bg-amber-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            Has Returns
          </button>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="pt-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
              <Input
                placeholder="Search by PO number..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              />
              <SearchableSelect
                placeholder="All Suppliers"
                allowClear
                value={filterSupplier}
                onChange={(v) => { setFilterSupplier(v); setCurrentPage(1); }}
                options={suppliers.map((s) => ({ value: s.id, label: s.name }))}
              />
              <Select
                value={filterPaymentStatus}
                onChange={(e) => { setFilterPaymentStatus(e.target.value); setCurrentPage(1); }}
                options={[{ value: '', label: 'All Payment Status' }, ...PAYMENT_STATUSES.map((p) => ({ value: p.value, label: p.label }))]}
              />
              <div className="flex items-end gap-2 lg:col-span-2">
                <Button onClick={handleSearch} leftIcon={<Filter className="w-4 h-4" />} className="flex-1">
                  Filter
                </Button>
                <Button variant="ghost" onClick={clearFilters} size="sm">
                  Clear
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Table */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>All Purchase Orders</CardTitle>
            <Button variant="ghost" size="sm" onClick={fetchOrders} leftIcon={<RefreshCw className="w-4 h-4" />}>
              Refresh
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex justify-center py-12"><LoadingSpinner /></div>
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
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-y">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">PO Number</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Supplier</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Total</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Payment</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Expected Date</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Created</th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {orders.map((po) => (
                        <tr key={po.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4">
                            <Link href={`/purchases/${po.id}`} className="font-medium text-primary-600 hover:underline">
                              {po.po_number}
                            </Link>
                          </td>
                          <td className="px-6 py-4 text-gray-600">{po.supplier?.name || '—'}</td>
                          <td className="px-6 py-4">
                            <div className="flex flex-col items-start gap-1">
                              {statusBadge(po.status)}
                              {returnBadge(po)}
                            </div>
                          </td>
                          <td className="px-6 py-4 text-right font-medium">{formatCurrency(Number(po.total))}</td>
                          <td className="px-6 py-4">
                            {paymentBadge(po.payment_status)}
                            {po.payment_status === 'partial' && (
                              <div className="text-xs text-gray-500 mt-1">
                                Paid {formatCurrency(Number(po.paid_amount))} of {formatCurrency(po.received_value)}
                              </div>
                            )}
                            {po.payment_status === 'unpaid' && po.outstanding_payable > 0 && (
                              <div className="text-xs text-gray-500 mt-1">
                                Owed {formatCurrency(po.outstanding_payable)}
                              </div>
                            )}
                          </td>
                          <td className="px-6 py-4 text-gray-500">{po.expected_date ? formatDate(po.expected_date) : '—'}</td>
                          <td className="px-6 py-4 text-gray-500">{formatDate(po.created_at)}</td>
                          <td className="px-6 py-4">
                            <div className="flex justify-end gap-1">
                              <Link href={`/purchases/${po.id}`}>
                                <Button variant="ghost" size="sm" title="View">
                                  <Eye className="w-4 h-4" />
                                </Button>
                              </Link>
                              <Button variant="ghost" size="sm" title="View History" onClick={() => setHistoryPO(po)}>
                                <History className="w-4 h-4 text-gray-500" />
                              </Button>
                              {['draft', 'ordered'].includes(po.status) && (
                                <Link href={`/purchases/${po.id}/edit`}>
                                  <Button variant="ghost" size="sm" title="Edit">
                                    <Pencil className="w-4 h-4" />
                                  </Button>
                                </Link>
                              )}
                              {canCancel(po.status) && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  title="Cancel"
                                  onClick={() => setCancelTarget(po)}
                                  className="text-red-500 hover:text-red-700 hover:bg-red-50"
                                >
                                  <XCircle className="w-4 h-4" />
                                </Button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {totalPages > 1 && (
                  <div className="p-4">
                    <Pagination
                      currentPage={currentPage}
                      totalPages={totalPages}
                      onPageChange={setCurrentPage}
                    />
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>

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
