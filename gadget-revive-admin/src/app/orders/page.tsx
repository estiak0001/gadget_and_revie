'use client';

import React, { useEffect, useState } from 'react';
import { Search, Eye, ShoppingCart, Clock, CheckCircle, XCircle, Truck, Package, Download, FileText, Mail, Plus, Wallet, Undo2, History, SlidersHorizontal, X } from 'lucide-react';
import { AdminLayout } from '@/components/layout';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Button,
  Input,
  Select,
  Textarea,
  Modal,
  Badge,
  LoadingSpinner,
  Pagination,
  EmptyState,
  ErrorState,
  HistoryModal,
} from '@/components/ui';
import { Order, PaginatedResponse, ProductCategory } from '@/types';
import { formatCurrency, formatDateTime, getErrorMessage, downloadBlob } from '@/lib/utils';
import adminService from '@/lib/adminService';
import toast from 'react-hot-toast';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

interface OrderSummary {
  total: number;
  manual: number;
  ecommerce: number;
  by_status: Record<string, number>;
}

const ORDER_STATUSES = [
  { value: 'pending', label: 'Pending', color: 'warning' },
  { value: 'accepted', label: 'Accepted', color: 'info' },
  { value: 'confirmed', label: 'Confirmed', color: 'default' },
  { value: 'in_progress', label: 'In Progress', color: 'info' },
  { value: 'processing', label: 'Processing', color: 'default' },
  { value: 'awaiting_payment', label: 'Awaiting Payment', color: 'warning' },
  { value: 'completed', label: 'Completed', color: 'success' },
  { value: 'cancelled', label: 'Cancelled', color: 'danger' },
  { value: 'refunded', label: 'Refunded', color: 'danger' },
];

export default function OrdersPage() {
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterPayment, setFilterPayment] = useState('');
  const [filterHasPO, setFilterHasPO] = useState('');
  // Which channel tab is active -- '' means "All". Manual = an admin/staff member placed it
  // (walk-in/phone order); Ecommerce = placed through the storefront, logged-in or guest.
  const [filterChannel, setFilterChannel] = useState<'' | 'manual' | 'ecommerce'>('');
  // Advanced filters -- collapsed by default so the common case (search + the three filters
  // above) stays uncluttered; these cover everything else the order/order-item data can be
  // sliced by.
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [filterSerial, setFilterSerial] = useState('');
  const [filterProduct, setFilterProduct] = useState('');
  const [filterCategoryId, setFilterCategoryId] = useState('');
  const [filterItemType, setFilterItemType] = useState('');
  const [filterPaymentMethod, setFilterPaymentMethod] = useState('');
  const [paymentMethodFilterOptions, setPaymentMethodFilterOptions] = useState([
    { value: '', label: 'All payment methods' },
    { value: 'cash', label: 'Cash' },
    { value: 'bkash', label: 'bKash' },
    { value: 'nagad', label: 'Nagad' },
    { value: 'bank_transfer', label: 'Bank transfer' },
  ]);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [minAmount, setMinAmount] = useState('');
  const [maxAmount, setMaxAmount] = useState('');
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRows, setTotalRows] = useState(0);
  const [pageSize, setPageSize] = useState(15);
  const [summary, setSummary] = useState<OrderSummary | null>(null);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [newStatus, setNewStatus] = useState('');
  const [statusNote, setStatusNote] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [sendingInvoice, setSendingInvoice] = useState<number | null>(null);
  const [downloadingInvoice, setDownloadingInvoice] = useState<number | null>(null);
  const [historyOrder, setHistoryOrder] = useState<Order | null>(null);

  const [isRecordingPayment, setIsRecordingPayment] = useState(false);
  const [recordPaymentAmount, setRecordPaymentAmount] = useState('');
  const [returnAmount, setReturnAmount] = useState('');
  const [returnReason, setReturnReason] = useState('');
  const [isProcessingReturn, setIsProcessingReturn] = useState(false);
  const [showRefundForm, setShowRefundForm] = useState(false);

  const TERMINAL_STATUSES = ['cancelled', 'refunded', 'rejected'];
  const isOrderCompleted = (o: Order) => (o.status || o.order_status) === 'completed';
  const isOrderTerminal = (o: Order) => TERMINAL_STATUSES.includes(o.status || o.order_status || '');

  // Shared by the list fetch and the CSV export, so an export always matches exactly what's
  // currently on screen.
  const buildFilterParams = (): Record<string, string> => {
    const params: Record<string, string> = {};
    if (searchQuery) params.search = searchQuery;
    if (filterStatus) params.status = filterStatus;
    if (filterPayment) params.payment_status = filterPayment;
    if (filterHasPO) params.has_purchase_order = filterHasPO;
    if (filterChannel) params.order_channel = filterChannel;
    if (filterSerial) params.serial = filterSerial;
    if (filterProduct) params.product = filterProduct;
    if (filterCategoryId) params.category_id = filterCategoryId;
    if (filterItemType) params.item_type = filterItemType;
    if (filterPaymentMethod) params.payment_method = filterPaymentMethod;
    if (dateFrom) params.start_date = dateFrom;
    if (dateTo) params.end_date = dateTo;
    if (minAmount) params.min_amount = minAmount;
    if (maxAmount) params.max_amount = maxAmount;
    return params;
  };

  // How many advanced filters are actually applied right now -- shown as a badge on the toggle
  // button so it's obvious filters are active even while the panel is collapsed.
  const advancedFilterCount = [
    filterSerial, filterProduct, filterCategoryId, filterItemType, filterPaymentMethod,
    dateFrom, dateTo, minAmount, maxAmount,
  ].filter(Boolean).length;

  const clearAdvancedFilters = () => {
    setFilterSerial(''); setFilterProduct(''); setFilterCategoryId(''); setFilterItemType('');
    setFilterPaymentMethod(''); setDateFrom(''); setDateTo(''); setMinAmount(''); setMaxAmount('');
    setCurrentPage(1);
  };

  const fetchCategories = async () => {
    try {
      const response = await adminService.getProductCategories();
      setCategories(response.data.data || response.data || []);
    } catch (err) {
      console.error('Error fetching categories:', err);
      setCategories([]);
    }
  };

  // Header counts -- under the same filters as the list, so the chips and tabs always agree
  // with what the table shows.
  const fetchSummary = async () => {
    try {
      const res = await adminService.getOrderSummary(buildFilterParams());
      setSummary(res.data.data);
    } catch (err) {
      console.error('Error fetching order summary:', err);
    }
  };

  const fetchOrders = async () => {
    setIsLoading(true);
    setError(false);
    try {
      const params: Record<string, string | number> = { page: currentPage, per_page: 15, ...buildFilterParams() };

      const response = await adminService.getOrders(params);
      setOrders(response.data.data);
      setTotalPages(response.data.meta?.last_page || 1);
      setTotalRows(response.data.meta?.total ?? 0);
      setPageSize(response.data.meta?.per_page ?? 15);
      fetchSummary();
    } catch (err) {
      console.error('Error fetching orders:', err);
      toast.error(getErrorMessage(err));
      setError(true);
      setOrders([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCategories();
    // Unfiltered by is_active — a deactivated method may still be on historical orders, and
    // staff filtering the list needs to be able to find those too.
    adminService.getPaymentMethods().then((res) => {
      const methods = res.data.data;
      if (methods.length > 0) {
        setPaymentMethodFilterOptions([{ value: '', label: 'All payment methods' }, ...methods.map((m) => ({ value: m.code, label: m.name }))]);
      }
    }).catch(() => { /* keep the fallback list */ });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    fetchOrders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    currentPage, filterStatus, filterPayment, filterHasPO, filterChannel, filterSerial, filterProduct,
    filterCategoryId, filterItemType, filterPaymentMethod, dateFrom, dateTo, minAmount, maxAmount,
  ]);

  // If we're not on page 1, changing it fires the effect above, which fetches once with the
  // now-current search text/filters -- calling fetchOrders() directly here too would race that
  // effect (currentPage is still stale in this closure) and whichever response resolves last
  // would win, occasionally showing the wrong page's results. Only fetch directly when the
  // page isn't changing, since then the effect has nothing to react to.
  const handleSearch = () => {
    if (currentPage === 1) {
      fetchOrders();
    } else {
      setCurrentPage(1);
    }
  };

  const handleExport = async () => {
    try {
      const params = buildFilterParams();
      const response = await adminService.exportOrders(params);
      downloadBlob(new Blob([response.data]), `orders-${new Date().toISOString().split('T')[0]}.csv`);
      toast.success('Orders exported successfully');
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const openViewModal = (order: Order) => {
    setSelectedOrder(order);
    setNewStatus(order.status || order.order_status || '');
    setStatusNote('');
    setRecordPaymentAmount(order.outstanding_receivable ? String(order.outstanding_receivable) : '');
    setReturnAmount(order.paid_amount ? String(order.paid_amount) : '');
    setReturnReason('');
    setShowRefundForm(false);
    setIsViewModalOpen(true);
  };

  const refreshSelectedOrder = async (id: number) => {
    try {
      const response = await adminService.getOrder(id);
      const orderData = response.data?.data || response.data;
      setSelectedOrder(orderData);
      setRecordPaymentAmount(orderData.outstanding_receivable ? String(orderData.outstanding_receivable) : '');
      setReturnAmount(orderData.paid_amount ? String(orderData.paid_amount) : '');
    } catch {
      // list refresh below will still keep data reasonably fresh
    }
  };

  const handleStatusUpdate = async () => {
    if (!selectedOrder) return;
    setIsSaving(true);
    try {
      await adminService.updateOrderStatus(selectedOrder.id, {
        order_status: newStatus,
        note: statusNote,
      });
      toast.success('Order status updated');
      setStatusNote('');
      await refreshSelectedOrder(selectedOrder.id);
      fetchOrders();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setIsSaving(false);
    }
  };

  const handleRecordFullPayment = async () => {
    if (!selectedOrder) return;
    const amount = Number(selectedOrder.outstanding_receivable ?? 0);
    if (!amount || amount <= 0) return;
    setIsRecordingPayment(true);
    try {
      await adminService.recordOrderPayment(selectedOrder.id, amount);
      toast.success('Payment recorded — order fully paid.');
      await refreshSelectedOrder(selectedOrder.id);
      fetchOrders();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setIsRecordingPayment(false);
    }
  };

  const handleRecordPayment = async () => {
    if (!selectedOrder) return;
    const amount = parseFloat(recordPaymentAmount);
    if (!amount || amount <= 0) {
      toast.error('Enter a valid amount');
      return;
    }
    if (amount > (selectedOrder.outstanding_receivable ?? 0)) {
      toast.error(`Amount cannot exceed the outstanding balance of ${formatCurrency(selectedOrder.outstanding_receivable ?? 0)}`);
      return;
    }
    setIsRecordingPayment(true);
    try {
      await adminService.recordOrderPayment(selectedOrder.id, amount);
      toast.success('Payment recorded.');
      await refreshSelectedOrder(selectedOrder.id);
      fetchOrders();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setIsRecordingPayment(false);
    }
  };

  const handleProcessReturn = async () => {
    if (!selectedOrder) return;
    if (!returnReason.trim()) {
      toast.error('Enter a reason for the refund');
      return;
    }
    const amount = parseFloat(returnAmount);
    if (!amount || amount <= 0) {
      toast.error('Enter a valid refund amount');
      return;
    }
    if (amount > (selectedOrder.paid_amount ?? 0)) {
      toast.error(`Refund cannot exceed the amount actually paid (${formatCurrency(selectedOrder.paid_amount ?? 0)})`);
      return;
    }

    setIsProcessingReturn(true);
    try {
      await adminService.refundOrder(selectedOrder.id, { reason: returnReason.trim(), refund_amount: amount });
      toast.success('Refund processed — order refunded and stock restored.');
      setShowRefundForm(false);
      await refreshSelectedOrder(selectedOrder.id);
      fetchOrders();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setIsProcessingReturn(false);
    }
  };

  // Opens the PDF in a new tab via a blob URL, same as the receipt preview and the order
  // detail page's own invoice preview. The tab must open synchronously in the click handler —
  // opening it after the `await` below loses the user-gesture context and the browser blocks
  // the popup. Navigating the tab straight to a blob: URL also triggers a download in some
  // browsers instead of the inline viewer, so we write a minimal page with an <embed> instead —
  // that reliably renders the browser's native PDF viewer (with its own Print/Save controls).
  const handlePreviewInvoice = async (order: Order) => {
    const newTab = window.open('', '_blank');
    setDownloadingInvoice(order.id);
    try {
      const response = await adminService.downloadInvoice(order.id);
      const blob = new Blob([response.data as BlobPart], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      if (newTab) {
        newTab.document.write(
          `<!DOCTYPE html><html><head><title>Invoice-${order.order_number}</title></head>` +
          `<body style="margin:0"><embed src="${url}" type="application/pdf" width="100%" height="100%" style="border:none;position:fixed;inset:0" /></body></html>`
        );
        newTab.document.close();
      } else {
        toast.error('Please allow pop-ups to preview the invoice.');
      }
      setTimeout(() => window.URL.revokeObjectURL(url), 60_000);
    } catch (err) {
      newTab?.close();
      toast.error(getErrorMessage(err));
    } finally {
      setDownloadingInvoice(null);
    }
  };

  const handleSendInvoiceEmail = async (order: Order) => {
    setSendingInvoice(order.id);
    try {
      await adminService.sendInvoiceEmail(order.id);
      toast.success(`Invoice emailed for order ${order.order_number}!`);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSendingInvoice(null);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = ORDER_STATUSES.find(s => s.value === status);
    return (
      <Badge variant={statusConfig?.color as 'success' | 'warning' | 'danger' | 'default' || 'default'} className="px-1.5 py-0.5 text-[11px]">
        {statusConfig?.label || status}
      </Badge>
    );
  };

  const getPaymentStatusBadge = (status: string) => {
    const colors: Record<string, 'success' | 'warning' | 'danger' | 'default'> = {
      paid: 'success', pending: 'warning', failed: 'danger', refunded: 'default', awaiting_confirmation: 'warning', partially_paid: 'warning',
      verified: 'success', cancelled: 'danger',
    };
    return <Badge variant={colors[status] || 'default'} className="px-1.5 py-0.5 text-[11px]">{status?.replace('_', ' ')}</Badge>;
  };

  if (error && orders.length === 0) {
    return (
      <AdminLayout>
        <ErrorState title="Failed to load orders" message="Could not fetch order data." onRetry={fetchOrders} />
      </AdminLayout>
    );
  }

  const CHANNEL_TABS = [
    { value: '' as const, label: 'All', count: summary?.total, active: 'bg-slate-800 text-white', idle: 'text-slate-600 hover:bg-white' },
    { value: 'manual' as const, label: 'Manual', count: summary?.manual, active: 'bg-indigo-600 text-white', idle: 'text-indigo-700 hover:bg-white' },
    { value: 'ecommerce' as const, label: 'Ecommerce', count: summary?.ecommerce, active: 'bg-teal-600 text-white', idle: 'text-teal-700 hover:bg-white' },
  ];

  // Status chip colours follow the same tone as each status's badge in ORDER_STATUSES.
  const STATUS_CHIP: Record<string, { on: string; off: string }> = {
    pending: { on: 'bg-amber-500 text-white', off: 'bg-amber-50 text-amber-800 border-amber-200' },
    accepted: { on: 'bg-sky-600 text-white', off: 'bg-sky-50 text-sky-800 border-sky-200' },
    confirmed: { on: 'bg-slate-700 text-white', off: 'bg-slate-50 text-slate-800 border-slate-200' },
    in_progress: { on: 'bg-sky-600 text-white', off: 'bg-sky-50 text-sky-800 border-sky-200' },
    processing: { on: 'bg-slate-700 text-white', off: 'bg-slate-50 text-slate-800 border-slate-200' },
    awaiting_payment: { on: 'bg-amber-500 text-white', off: 'bg-amber-50 text-amber-800 border-amber-200' },
    completed: { on: 'bg-emerald-600 text-white', off: 'bg-emerald-50 text-emerald-800 border-emerald-200' },
    cancelled: { on: 'bg-rose-600 text-white', off: 'bg-rose-50 text-rose-800 border-rose-200' },
    refunded: { on: 'bg-rose-600 text-white', off: 'bg-rose-50 text-rose-800 border-rose-200' },
  };
  const statusChips = ORDER_STATUSES.filter((st) => (summary?.by_status?.[st.value] ?? 0) > 0 || filterStatus === st.value);
  const from = totalRows === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const to = Math.min(totalRows, currentPage * pageSize);

  return (
    <AdminLayout>
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2.5">
          <h1 className="text-lg font-bold text-gray-900">Orders</h1>
          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-semibold text-gray-600">{summary?.total ?? totalRows} total</span>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="w-3.5 h-3.5 mr-1.5" /> Export
          </Button>
          <Button size="sm" onClick={() => router.push('/orders/create')}>
            <Plus className="w-3.5 h-3.5 mr-1.5" /> Create Order
          </Button>
        </div>
      </div>

      {/* Control strip — channel tabs, status chips, filters */}
      <div className="rounded-xl border border-gray-200 bg-white p-2 mb-3 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-lg bg-gray-100 p-0.5">
            {CHANNEL_TABS.map((tab) => (
              <button
                key={tab.label}
                type="button"
                onClick={() => { setFilterChannel(tab.value); setCurrentPage(1); }}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${filterChannel === tab.value ? tab.active : tab.idle}`}
              >
                {tab.label}
                {tab.count !== undefined && <span className="ml-1.5 opacity-80">{tab.count}</span>}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => { setFilterStatus(''); setCurrentPage(1); }}
              className={`px-2.5 py-1 text-[11px] font-semibold rounded-full border transition-colors ${filterStatus === '' ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}
            >
              All statuses
            </button>
            {statusChips.map((st) => {
              const tone = STATUS_CHIP[st.value] ?? STATUS_CHIP.confirmed;
              const on = filterStatus === st.value;
              return (
                <button
                  key={st.value}
                  type="button"
                  onClick={() => { setFilterStatus(on ? '' : st.value); setCurrentPage(1); }}
                  className={`px-2.5 py-1 text-[11px] font-semibold rounded-full border transition-colors ${on ? tone.on : tone.off}`}
                >
                  {st.label} <span className="opacity-80">{summary?.by_status?.[st.value] ?? 0}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 w-3.5 h-3.5" />
            <Input
              placeholder="Order no., customer, phone or email…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              className="h-8 pl-8 text-xs"
            />
          </div>
          <div className="w-36 shrink-0">
          <Select
            className="h-8 text-xs"
            options={[
              { value: '', label: 'All payments' },
              { value: 'pending', label: 'Pending' },
              { value: 'paid', label: 'Paid' },
              { value: 'failed', label: 'Failed' },
              { value: 'refunded', label: 'Refunded' },
              { value: 'cancelled', label: 'Cancelled' },
            ]}
            value={filterPayment}
            onChange={(e) => { setFilterPayment(e.target.value); setCurrentPage(1); }}
          />
          </div>
          <div className="w-44 shrink-0">
          <Select
            className="h-8 text-xs"
            options={[
              { value: '', label: 'Any purchase order' },
              { value: 'true', label: 'Has purchase order' },
              { value: 'false', label: 'No purchase order' },
            ]}
            value={filterHasPO}
            onChange={(e) => { setFilterHasPO(e.target.value); setCurrentPage(1); }}
          />
          </div>
          <Button size="sm" onClick={handleSearch}>Search</Button>
          <Button
            size="sm"
            variant={advancedFilterCount > 0 ? 'primary' : 'outline'}
            onClick={() => setShowAdvancedFilters((v) => !v)}
          >
            <SlidersHorizontal className="w-3.5 h-3.5 mr-1" />
            Advanced
            {advancedFilterCount > 0 && (
              <span className="ml-1.5 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-white/25 text-[11px]">
                {advancedFilterCount}
              </span>
            )}
          </Button>
        </div>

        {showAdvancedFilters && (
          <div className="pt-2 border-t border-gray-100 space-y-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
              <Input className="h-8 text-xs" placeholder="Serial number" value={filterSerial} onChange={(e) => setFilterSerial(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSearch()} />
              <Input className="h-8 text-xs" placeholder="Product / service name or SKU" value={filterProduct} onChange={(e) => setFilterProduct(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSearch()} />
              <Select
                className="h-8 text-xs"
                options={[{ value: '', label: 'All categories' }, ...categories.map((c) => ({ value: c.id, label: c.name }))]}
                value={filterCategoryId}
                onChange={(e) => { setFilterCategoryId(e.target.value); setCurrentPage(1); }}
              />
              <Select
                className="h-8 text-xs"
                options={[
                  { value: '', label: 'All item types' },
                  { value: 'product', label: 'Product' },
                  { value: 'service', label: 'Service' },
                  { value: 'custom', label: 'Custom charge' },
                ]}
                value={filterItemType}
                onChange={(e) => { setFilterItemType(e.target.value); setCurrentPage(1); }}
              />
              <Select
                className="h-8 text-xs"
                options={paymentMethodFilterOptions}
                value={filterPaymentMethod}
                onChange={(e) => { setFilterPaymentMethod(e.target.value); setCurrentPage(1); }}
              />
              <Input type="date" className="h-8 text-xs" title="Order date from" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setCurrentPage(1); }} />
              <Input type="date" className="h-8 text-xs" title="Order date to" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setCurrentPage(1); }} />
              <div className="flex gap-2">
                <Input type="number" min={0} className="h-8 text-xs" placeholder="Min total" value={minAmount} onChange={(e) => setMinAmount(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSearch()} />
                <Input type="number" min={0} className="h-8 text-xs" placeholder="Max total" value={maxAmount} onChange={(e) => setMaxAmount(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSearch()} />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              {advancedFilterCount > 0 && (
                <Button variant="ghost" size="sm" onClick={clearAdvancedFilters}>
                  <X className="w-3.5 h-3.5 mr-1" /> Clear advanced
                </Button>
              )}
              <Button size="sm" onClick={handleSearch}>Apply</Button>
            </div>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <LoadingSpinner size="md" text="Loading orders..." />
          </div>
        ) : orders.length === 0 ? (
          <EmptyState icon={<ShoppingCart className="w-8 h-8 text-gray-400" />} title="No orders found" description="Try clearing a filter, or create an order." />
        ) : (
          <div className="overflow-auto max-h-[calc(100vh-17rem)]">
            <table className="min-w-full text-sm">
              <thead className="sticky top-0 z-10 bg-slate-50 text-xs uppercase tracking-wide text-slate-500 shadow-[0_1px_0_0_rgb(226,232,240)]">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold">Order</th>
                  <th className="px-3 py-2 text-left font-semibold">Customer</th>
                  <th className="px-3 py-2 text-right font-semibold">Amount</th>
                  <th className="px-3 py-2 text-left font-semibold">Status</th>
                  <th className="px-3 py-2 text-left font-semibold">Payment</th>
                  <th className="px-3 py-2 text-left font-semibold whitespace-nowrap">Placed</th>
                  <th className="px-3 py-2 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {orders.map((order, i) => (
                  <tr key={order.id} className={`${i % 2 ? 'bg-slate-50/50' : 'bg-white'} hover:bg-indigo-50/40`}>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-1.5">
                        <Link href={`/orders/${order.id}`} className="font-mono font-semibold text-primary-600 hover:underline whitespace-nowrap">
                          {order.order_number}
                        </Link>
                        {order.is_manual_order && (
                          <span className="rounded bg-indigo-100 px-1 py-px text-[11px] font-semibold text-indigo-700" title="Placed manually by an admin/staff member">Manual</span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-gray-700">
                      <div className="flex items-center gap-1.5">
                        <span className="truncate max-w-[180px]">{order.customer_name || order.customer?.name || '—'}</span>
                        {(order.is_guest || !order.customer_id) && (
                          <span className="rounded bg-amber-100 px-1 py-px text-[11px] font-semibold text-amber-700">Guest</span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <div className="font-semibold tabular-nums text-gray-900">{formatCurrency(order.total)}</div>
                      {order.payment_status === 'partially_paid' && (
                        <div className="text-[11px] font-semibold text-rose-600 tabular-nums">
                          Due {formatCurrency(order.outstanding_receivable ?? (order.total - (order.paid_amount ?? 0)))}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2">{getStatusBadge(order.status || order.order_status || '')}</td>
                    <td className="px-3 py-2">{getPaymentStatusBadge(order.payment_status)}</td>
                    <td className="px-3 py-2 text-xs text-gray-500 whitespace-nowrap tabular-nums">{formatDateTime(order.created_at)}</td>
                    <td className="px-3 py-2">
                      <div className="flex items-center justify-end gap-0.5">
                        <button type="button" onClick={() => openViewModal(order)} title="View & manage" className="rounded-md p-1 text-indigo-600 hover:bg-indigo-50">
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        <button type="button" onClick={() => setHistoryOrder(order)} title="History" className="rounded-md p-1 text-slate-500 hover:bg-slate-100">
                          <History className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handlePreviewInvoice(order)}
                          disabled={downloadingInvoice === order.id}
                          title="Preview & print invoice"
                          className="rounded-md p-1 text-orange-600 hover:bg-orange-50 disabled:opacity-50"
                        >
                          <FileText className={`w-3.5 h-3.5 ${downloadingInvoice === order.id ? 'animate-pulse' : ''}`} />
                        </button>
                        {(order.customer_email || order.customer?.email) && (
                          <button
                            type="button"
                            onClick={() => handleSendInvoiceEmail(order)}
                            disabled={sendingInvoice === order.id}
                            title="Email invoice"
                            className="rounded-md p-1 text-sky-600 hover:bg-sky-50 disabled:opacity-50"
                          >
                            <Mail className={`w-3.5 h-3.5 ${sendingInvoice === order.id ? 'animate-pulse' : ''}`} />
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

      {/* Footer — row range + pagination */}
      {totalRows > 0 && (
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-gray-500">
          <span>Showing <span className="font-semibold text-gray-700">{from}–{to}</span> of <span className="font-semibold text-gray-700">{totalRows}</span></span>
          {totalPages > 1 && (
            <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
          )}
        </div>
      )}

      <Modal isOpen={isViewModalOpen} onClose={() => setIsViewModalOpen(false)} title="Order details" size="lg">
        {selectedOrder && (
          <div className="space-y-3">
            {/* Summary strip: identity + status at a glance */}
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-gray-200 bg-slate-50 px-3 py-2.5">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-mono text-sm font-bold text-gray-900">{selectedOrder.order_number}</p>
                {getStatusBadge(selectedOrder.status || selectedOrder.order_status || '')}
                {getPaymentStatusBadge(selectedOrder.payment_status)}
              </div>
              <p className="text-[11px] tabular-nums text-gray-500">{formatDateTime(selectedOrder.created_at)}</p>
            </div>

            {/* Customer / delivery / payment */}
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              <div className="rounded-lg border border-gray-200 p-3">
                <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-gray-500">Customer</p>
                <div className="flex flex-wrap items-center gap-1.5">
                  <p className="text-sm font-semibold text-gray-900">{selectedOrder.customer_name || selectedOrder.customer?.name || '—'}</p>
                  {(selectedOrder.is_guest || !selectedOrder.customer_id) && (
                    <span className="rounded bg-amber-100 px-1.5 py-px text-[10px] font-semibold text-amber-700">Guest</span>
                  )}
                </div>
                {(selectedOrder.customer_email || selectedOrder.customer?.email) && (
                  <p className="truncate text-xs text-gray-500">{selectedOrder.customer_email || selectedOrder.customer?.email}</p>
                )}
                {(selectedOrder.customer_phone || selectedOrder.customer?.phone) && (
                  <p className="text-xs text-gray-500">{selectedOrder.customer_phone || selectedOrder.customer?.phone}</p>
                )}
              </div>
              <div className="rounded-lg border border-gray-200 p-3">
                <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-gray-500">Delivery</p>
                <p className="text-xs text-gray-800">{selectedOrder.customer_address || selectedOrder.delivery_address || 'No address'}</p>
                {(selectedOrder.area || selectedOrder.district || selectedOrder.division) && (
                  <p className="mt-1 text-[11px] text-gray-500">
                    {[selectedOrder.area?.name, selectedOrder.district?.name, selectedOrder.division?.name].filter(Boolean).join(', ')}
                  </p>
                )}
              </div>
              <div className="rounded-lg border border-gray-200 p-3">
                <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-gray-500">Payment</p>
                <p className="text-xs capitalize text-gray-800">{selectedOrder.payment_method || '—'}</p>
                <p className="mt-1 text-xs tabular-nums text-emerald-700">Paid {formatCurrency(selectedOrder.paid_amount ?? 0)}</p>
                {Number(selectedOrder.outstanding_receivable ?? 0) > 0 && (
                  <p className="text-xs font-semibold tabular-nums text-amber-700">Due {formatCurrency(selectedOrder.outstanding_receivable ?? 0)}</p>
                )}
              </div>
            </div>

            {/* Items */}
            {selectedOrder.items && selectedOrder.items.length > 0 && (
              <div className="overflow-hidden rounded-lg border border-gray-200">
                <table className="min-w-full text-sm">
                  <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-3 py-2 text-left font-semibold">Item</th>
                      <th className="px-3 py-2 text-right font-semibold">Qty</th>
                      <th className="px-3 py-2 text-right font-semibold">Price</th>
                      <th className="px-3 py-2 text-right font-semibold">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {selectedOrder.items.map((item, i) => (
                      <tr key={item.id} className={i % 2 ? 'bg-slate-50/40' : 'bg-white'}>
                        <td className="px-3 py-2">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="font-medium text-gray-900">{item.item_name || item.name}</span>
                            <Badge variant="default" className="text-[10px]">{item.item_type}</Badge>
                          </div>
                          {item.item_sku && <p className="font-mono text-[10px] text-gray-400">{item.item_sku}</p>}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums text-gray-600">{item.quantity}</td>
                        <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums text-gray-600">{formatCurrency(item.unit_price ?? item.price ?? 0)}</td>
                        <td className="whitespace-nowrap px-3 py-2 text-right font-semibold tabular-nums text-gray-900">{formatCurrency(item.total_price ?? item.total ?? 0)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Totals + customer notes */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              {selectedOrder.customer_notes ? (
                <div className="min-w-0 flex-1 rounded-lg border border-amber-200 bg-amber-50 p-3">
                  <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-amber-700">Customer note</p>
                  <p className="text-xs text-amber-900">{selectedOrder.customer_notes}</p>
                </div>
              ) : <div className="flex-1" />}
              <div className="w-full rounded-lg border border-gray-200 p-3 text-sm sm:w-72">
                <div className="flex justify-between text-xs text-gray-600"><span>Subtotal</span><span className="tabular-nums">{formatCurrency(selectedOrder.subtotal)}</span></div>
                {(selectedOrder.shipping ?? selectedOrder.delivery_charge ?? 0) > 0 && (
                  <div className="flex justify-between text-xs text-gray-600"><span>Shipping</span><span className="tabular-nums">{formatCurrency(selectedOrder.shipping ?? selectedOrder.delivery_charge ?? 0)}</span></div>
                )}
                {(selectedOrder.tax ?? 0) > 0 && (
                  <div className="flex justify-between text-xs text-gray-600"><span>Tax</span><span className="tabular-nums">{formatCurrency(selectedOrder.tax ?? 0)}</span></div>
                )}
                {(selectedOrder.discount ?? 0) > 0 && (
                  <div className="flex justify-between text-xs text-gray-600"><span>Discount</span><span className="tabular-nums">−{formatCurrency(selectedOrder.discount ?? 0)}</span></div>
                )}
                <div className="mt-1 flex justify-between border-t border-gray-200 pt-1.5 text-sm font-bold text-gray-900"><span>Total</span><span className="tabular-nums">{formatCurrency(selectedOrder.total)}</span></div>
                {selectedOrder.payment_status === 'partially_paid' && (
                  <div className="mt-1 flex justify-between text-xs font-semibold text-amber-700"><span>Balance due</span><span className="tabular-nums">{formatCurrency(selectedOrder.outstanding_receivable ?? (selectedOrder.total - (selectedOrder.paid_amount ?? 0)))}</span></div>
                )}
              </div>
            </div>

            {/* Actions */}
            {isOrderTerminal(selectedOrder) ? (
              <p className="rounded-lg bg-gray-50 p-3 text-xs text-gray-600">
                This order is {(selectedOrder.status || selectedOrder.order_status || '').replace('_', ' ')} — no further actions are available.
              </p>
            ) : isOrderCompleted(selectedOrder) ? (
              <div className="space-y-3 rounded-lg border border-gray-200 p-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Completed — refund only</p>
                {Number(selectedOrder.outstanding_receivable ?? 0) > 0 && (
                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
                    <div>
                      <p className="text-sm font-semibold text-amber-800">Outstanding {formatCurrency(selectedOrder.outstanding_receivable ?? 0)}</p>
                      <p className="text-[11px] text-amber-700">Must be collected in full — partial payment isn&apos;t allowed once completed.</p>
                    </div>
                    <Button size="sm" onClick={handleRecordFullPayment} isLoading={isRecordingPayment} className="shrink-0 bg-blue-600 hover:bg-blue-700">
                      <Wallet className="mr-1 h-3.5 w-3.5" />
                      Record full payment
                    </Button>
                  </div>
                )}
                {Number(selectedOrder.paid_amount ?? 0) > 0 && (
                  showRefundForm ? (
                    <div className="space-y-3 rounded-lg border border-rose-200 p-3">
                      <p className="text-xs text-gray-600">
                        Paid so far: <span className="font-semibold text-gray-900">{formatCurrency(selectedOrder.paid_amount ?? 0)}</span>
                      </p>
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <div>
                          <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-gray-500">Refund amount</label>
                          <input
                            type="number"
                            min={0.01}
                            max={selectedOrder.paid_amount ?? 0}
                            step="0.01"
                            value={returnAmount}
                            onChange={(e) => setReturnAmount(e.target.value)}
                            className="w-full rounded-lg border border-gray-300 px-2.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                          />
                          <p className="mt-1 text-[11px] text-gray-500">Less than the full amount makes a partial refund.</p>
                        </div>
                        <div>
                          <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-gray-500">Reason *</label>
                          <Textarea value={returnReason} onChange={(e) => setReturnReason(e.target.value)} rows={2} placeholder="Why is this order being refunded?" />
                        </div>
                      </div>
                      <div className="flex justify-end gap-2">
                        <Button size="sm" variant="ghost" onClick={() => setShowRefundForm(false)}>Cancel</Button>
                        <Button size="sm" variant="danger" onClick={handleProcessReturn} isLoading={isProcessingReturn}>Process refund</Button>
                      </div>
                    </div>
                  ) : (
                    <Button size="sm" variant="outline" onClick={() => setShowRefundForm(true)} className="w-full justify-center border-rose-300 text-rose-700 hover:bg-rose-50">
                      <Undo2 className="mr-1.5 h-3.5 w-3.5" />
                      Process refund
                    </Button>
                  )
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {Number(selectedOrder.outstanding_receivable ?? 0) > 0 && (
                  <div className="space-y-2 rounded-lg border border-blue-200 bg-blue-50/60 p-3">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-blue-800">Record payment</p>
                    <p className="text-xs text-blue-900">Outstanding <span className="font-semibold tabular-nums">{formatCurrency(selectedOrder.outstanding_receivable ?? 0)}</span></p>
                    <input
                      type="number"
                      min={0.01}
                      max={selectedOrder.outstanding_receivable ?? 0}
                      step="0.01"
                      value={recordPaymentAmount}
                      onChange={(e) => setRecordPaymentAmount(e.target.value)}
                      className="w-full rounded-lg border border-blue-200 bg-white px-2.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <p className="text-[11px] text-blue-700/80">Less than the full amount records a partial payment.</p>
                    <Button size="sm" onClick={handleRecordPayment} isLoading={isRecordingPayment} className="w-full bg-blue-600 hover:bg-blue-700">
                      <Wallet className="mr-1.5 h-3.5 w-3.5" />
                      Record payment
                    </Button>
                  </div>
                )}
                <div className={`space-y-2 rounded-lg border border-gray-200 p-3 ${Number(selectedOrder.outstanding_receivable ?? 0) > 0 ? '' : 'md:col-span-2'}`}>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Update status</p>
                  <Select
                    options={ORDER_STATUSES.map(s => ({ value: s.value, label: s.label }))}
                    value={newStatus}
                    onChange={(e) => setNewStatus(e.target.value)}
                  />
                  <Input value={statusNote} onChange={(e) => setStatusNote(e.target.value)} placeholder="Note for this change (optional)" />
                  <Button size="sm" onClick={handleStatusUpdate} isLoading={isSaving} className="w-full">Update status</Button>
                </div>
              </div>
            )}

            {/* Footer */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-gray-100 pt-3">
              <Link href={`/orders/${selectedOrder?.id}`}>
                <Button size="sm" variant="outline">Open full page</Button>
              </Link>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => selectedOrder && handlePreviewInvoice(selectedOrder)}
                  disabled={!!(selectedOrder && downloadingInvoice === selectedOrder.id)}
                  className="border-orange-300 text-orange-700 hover:bg-orange-50"
                >
                  <FileText className="mr-1 h-3.5 w-3.5" />
                  {selectedOrder && downloadingInvoice === selectedOrder.id ? 'Opening…' : 'Preview invoice'}
                </Button>
                {(selectedOrder?.customer_email || selectedOrder?.customer?.email) && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => selectedOrder && handleSendInvoiceEmail(selectedOrder)}
                    disabled={!!(selectedOrder && sendingInvoice === selectedOrder.id)}
                  >
                    <Mail className="mr-1 h-3.5 w-3.5" />
                    {selectedOrder && sendingInvoice === selectedOrder.id ? 'Sending…' : 'Email invoice'}
                  </Button>
                )}
              </div>
            </div>
          </div>
        )}
      </Modal>

      {historyOrder && (
        <HistoryModal
          isOpen={!!historyOrder}
          onClose={() => setHistoryOrder(null)}
          resourceType="Order"
          resourceId={historyOrder.id}
          resourceLabel={`Order #${historyOrder.order_number}`}
          createdBy={historyOrder.creator}
          createdAt={historyOrder.created_at}
          updatedAt={historyOrder.updated_at}
        />
      )}
    </AdminLayout>
  );
}
