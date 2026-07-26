'use client';

import React, { useEffect, useState } from 'react';
import { Search, Eye, ShoppingCart, Clock, CheckCircle, XCircle, Truck, Package, Download, FileText, Mail, Plus, Wallet, Undo2, History } from 'lucide-react';
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
import { Order, PaginatedResponse } from '@/types';
import { formatCurrency, formatDateTime, getErrorMessage, downloadBlob } from '@/lib/utils';
import adminService from '@/lib/adminService';
import toast from 'react-hot-toast';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

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
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
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

  const fetchOrders = async () => {
    setIsLoading(true);
    setError(false);
    try {
      const params: Record<string, string | number> = { page: currentPage };
      if (searchQuery) params.search = searchQuery;
      if (filterStatus) params.status = filterStatus;
      if (filterPayment) params.payment_status = filterPayment;

      const response = await adminService.getOrders(params);
      setOrders(response.data.data);
      setTotalPages(response.data.meta?.last_page || 1);
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
    fetchOrders();
  }, [currentPage, filterStatus, filterPayment]);

  const handleSearch = () => {
    setCurrentPage(1);
    fetchOrders();
  };

  const handleExport = async () => {
    try {
      const params: Record<string, string> = {};
      if (filterStatus) params.status = filterStatus;
      if (filterPayment) params.payment_status = filterPayment;
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
      <Badge variant={statusConfig?.color as 'success' | 'warning' | 'danger' | 'default' || 'default'}>
        {statusConfig?.label || status}
      </Badge>
    );
  };

  const getPaymentStatusBadge = (status: string) => {
    const colors: Record<string, 'success' | 'warning' | 'danger' | 'default'> = {
      paid: 'success', pending: 'warning', failed: 'danger', refunded: 'default', awaiting_confirmation: 'warning', partially_paid: 'warning',
    };
    return <Badge variant={colors[status] || 'default'}>{status?.replace('_', ' ')}</Badge>;
  };

  if (error && orders.length === 0) {
    return (
      <AdminLayout>
        <ErrorState title="Failed to load orders" message="Could not fetch order data." onRetry={fetchOrders} />
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="page-header flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="page-title">Orders</h1>
          <p className="page-description">Manage all orders and track status</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={handleExport}>
            <Download className="w-4 h-4 mr-2" />
            Export Orders
          </Button>
          <Button onClick={() => router.push('/orders/create')}>
            <Plus className="w-4 h-4 mr-2" />
            Create Order
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-yellow-100 rounded-lg flex items-center justify-center">
                <Clock className="w-5 h-5 text-yellow-600" />
              </div>
              <div>
                <p className="text-xs text-gray-500">Pending</p>
                <p className="text-xl font-bold">{orders.filter(o => (o.order_status || o.status) === 'pending').length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <Package className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-xs text-gray-500">Processing</p>
                <p className="text-xl font-bold">{orders.filter(o => ['confirmed', 'processing', 'in_progress'].includes(o.order_status || o.status || '')).length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                <CheckCircle className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-xs text-gray-500">Completed</p>
                <p className="text-xl font-bold">{orders.filter(o => o.status === 'completed').length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
                <XCircle className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <p className="text-xs text-gray-500">Cancelled</p>
                <p className="text-xl font-bold">{orders.filter(o => o.status === 'cancelled').length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <Input
                placeholder="Search by order number, customer..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                className="pl-10"
              />
            </div>
            <Select
              options={[{ value: '', label: 'All Status' }, ...ORDER_STATUSES.map(s => ({ value: s.value, label: s.label }))]}
              value={filterStatus}
              onChange={(e) => { setFilterStatus(e.target.value); setCurrentPage(1); }}
            />
            <Select
              options={[
                { value: '', label: 'All Payment' },
                { value: 'pending', label: 'Pending' },
                { value: 'paid', label: 'Paid' },
                { value: 'failed', label: 'Failed' },
                { value: 'refunded', label: 'Refunded' },
              ]}
              value={filterPayment}
              onChange={(e) => { setFilterPayment(e.target.value); setCurrentPage(1); }}
            />
            <Button onClick={handleSearch}>Search</Button>
          </div>
        </CardContent>
      </Card>

      {/* Orders Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Orders</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <LoadingSpinner size="lg" text="Loading orders..." />
            </div>
          ) : orders.length === 0 ? (
            <EmptyState icon={<ShoppingCart className="w-8 h-8 text-gray-400" />} title="No orders found" description="Orders will appear here when customers place them." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-y">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Order</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Customer</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Amount</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Payment</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {orders.map((order) => (
                    <tr key={order.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <Link href={`/orders/${order.id}`} className="font-medium text-primary-600 hover:underline">
                          {order.order_number}
                        </Link>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        <div className="flex items-center gap-2">
                          {order.customer_name || order.customer?.name || '-'}
                          {(order.is_guest || !order.customer_id) && (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-100 text-amber-700 border border-amber-200">
                              Guest
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm font-medium">
                        {formatCurrency(order.total)}
                        {order.payment_status === 'partially_paid' && (
                          <p className="text-xs font-normal text-amber-600 mt-0.5">
                            Due {formatCurrency(order.outstanding_receivable ?? (order.total - (order.paid_amount ?? 0)))}
                          </p>
                        )}
                      </td>
                      <td className="px-6 py-4">{getStatusBadge(order.status || order.order_status || '')}</td>
                      <td className="px-6 py-4">{getPaymentStatusBadge(order.payment_status)}</td>
                      <td className="px-6 py-4 text-sm text-gray-500">{formatDateTime(order.created_at)}</td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-end gap-2">
                          <Button variant="ghost" size="sm" onClick={() => openViewModal(order)} title="View & Manage Order">
                            <Eye className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => setHistoryOrder(order)} title="View History">
                            <History className="w-4 h-4 text-gray-500" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handlePreviewInvoice(order)}
                            disabled={downloadingInvoice === order.id}
                            title="Preview & Print Invoice"
                          >
                            <FileText className={`w-4 h-4 ${downloadingInvoice === order.id ? 'animate-pulse text-orange-500' : 'text-orange-600'}`} />
                          </Button>
                          {(order.customer_email || order.customer?.email) && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleSendInvoiceEmail(order)}
                              disabled={sendingInvoice === order.id}
                              title="Email Invoice"
                            >
                              <Mail className={`w-4 h-4 ${sendingInvoice === order.id ? 'animate-pulse text-blue-500' : 'text-blue-600'}`} />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {totalPages > 1 && (
        <div className="mt-6">
          <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
        </div>
      )}

      {/* View Modal */}
      <Modal isOpen={isViewModalOpen} onClose={() => setIsViewModalOpen(false)} title="Order Details" size="lg">
        {selectedOrder && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div><p className="text-xs text-gray-500">Order Number</p><p className="font-semibold">{selectedOrder.order_number}</p></div>
              <div><p className="text-xs text-gray-500">Status</p>{getStatusBadge(selectedOrder.status || selectedOrder.order_status || '')}</div>
              <div>
                <p className="text-xs text-gray-500">Customer</p>
                <div className="flex items-center gap-2">
                  <p className="font-medium">{selectedOrder.customer_name || selectedOrder.customer?.name || '-'}</p>
                  {(selectedOrder.is_guest || !selectedOrder.customer_id) && (
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-100 text-amber-700 border border-amber-200">
                      Guest Order
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-400">{selectedOrder.customer_email || selectedOrder.customer?.email}</p>
                {(selectedOrder.customer_phone || selectedOrder.customer?.phone) && (
                  <p className="text-xs text-gray-400">{selectedOrder.customer_phone || selectedOrder.customer?.phone}</p>
                )}
              </div>
              <div><p className="text-xs text-gray-500">Payment</p>{getPaymentStatusBadge(selectedOrder.payment_status)}<p className="text-xs text-gray-400 mt-1 capitalize">{selectedOrder.payment_method}</p></div>
            </div>
            <div className="border-t pt-4">
              <p className="text-sm font-medium mb-2">Delivery Address</p>
              <p className="text-sm text-gray-600">{selectedOrder.customer_address || selectedOrder.delivery_address || 'N/A'}</p>
              {(selectedOrder.area || selectedOrder.district || selectedOrder.division) && (
                <p className="text-xs text-gray-400 mt-1">
                  {[selectedOrder.area?.name, selectedOrder.district?.name, selectedOrder.division?.name].filter(Boolean).join(', ')}
                </p>
              )}
            </div>
            {selectedOrder.items && selectedOrder.items.length > 0 && (
              <div className="border-t pt-4">
                <p className="text-sm font-medium mb-2">Order Items</p>
                <table className="w-full text-sm">
                  <thead><tr className="text-gray-500"><th className="text-left py-1">Item</th><th className="text-right py-1">Qty</th><th className="text-right py-1">Price</th><th className="text-right py-1">Total</th></tr></thead>
                  <tbody>
                    {selectedOrder.items.map((item) => (
                      <tr key={item.id} className="border-t">
                        <td className="py-2">
                          {item.item_name || item.name}
                          <Badge variant="default" className="ml-1 text-[10px]">{item.item_type}</Badge>
                          {item.item_sku && <p className="text-[10px] text-gray-400">{item.item_sku}</p>}
                        </td>
                        <td className="text-right">{item.quantity}</td>
                        <td className="text-right">{formatCurrency(item.unit_price ?? item.price ?? 0)}</td>
                        <td className="text-right">{formatCurrency(item.total_price ?? item.total ?? 0)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div className="border-t pt-4 space-y-1 text-sm">
              <div className="flex justify-between"><span>Subtotal</span><span>{formatCurrency(selectedOrder.subtotal)}</span></div>
              {(selectedOrder.shipping ?? selectedOrder.delivery_charge ?? 0) > 0 && (
                <div className="flex justify-between"><span>Shipping</span><span>{formatCurrency(selectedOrder.shipping ?? selectedOrder.delivery_charge ?? 0)}</span></div>
              )}
              {(selectedOrder.tax ?? 0) > 0 && (
                <div className="flex justify-between"><span>Tax</span><span>{formatCurrency(selectedOrder.tax ?? 0)}</span></div>
              )}
              {(selectedOrder.discount ?? 0) > 0 && (
                <div className="flex justify-between"><span>Discount</span><span>-{formatCurrency(selectedOrder.discount ?? 0)}</span></div>
              )}
              {selectedOrder.payment_status === 'partially_paid' && (
                <>
                  <div className="flex justify-between text-green-600"><span>Paid</span><span>{formatCurrency(selectedOrder.paid_amount ?? 0)}</span></div>
                  <div className="flex justify-between text-amber-600 font-medium">
                    <span>Balance Due</span>
                    <span>{formatCurrency(selectedOrder.outstanding_receivable ?? (selectedOrder.total - (selectedOrder.paid_amount ?? 0)))}</span>
                  </div>
                </>
              )}
              <div className="flex justify-between font-bold text-lg border-t pt-2"><span>Total</span><span>{formatCurrency(selectedOrder.total)}</span></div>
            </div>
            {selectedOrder.customer_notes && (
              <div className="border-t pt-4">
                <p className="text-sm font-medium mb-1">Customer Notes</p>
                <p className="text-sm text-gray-600">{selectedOrder.customer_notes}</p>
              </div>
            )}
            {/* Dynamic Action Panel */}
            <div className="border-t pt-4">
              {isOrderTerminal(selectedOrder) ? (
                <p className="text-sm text-gray-500 bg-gray-50 rounded-lg p-3">
                  This order is {(selectedOrder.status || selectedOrder.order_status || '').replace('_', ' ')} — no further actions are available.
                </p>
              ) : isOrderCompleted(selectedOrder) ? (
                <div className="space-y-4">
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Order Completed — Refund Only</p>
                  {Number(selectedOrder.outstanding_receivable ?? 0) > 0 && (
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium text-amber-800">Outstanding balance</p>
                        <p className="text-xs text-amber-700">{formatCurrency(selectedOrder.outstanding_receivable ?? 0)} must be collected in full — partial payment is not allowed once an order is completed.</p>
                      </div>
                      <Button onClick={handleRecordFullPayment} isLoading={isRecordingPayment} className="bg-blue-600 hover:bg-blue-700 shrink-0">
                        <Wallet className="w-4 h-4 mr-1" />
                        Record Full Payment
                      </Button>
                    </div>
                  )}
                  {Number(selectedOrder.paid_amount ?? 0) > 0 && (
                    showRefundForm ? (
                      <div className="border border-red-200 rounded-lg p-3 space-y-3">
                        <p className="text-sm text-gray-600">
                          Amount paid: <span className="font-semibold text-gray-900">{formatCurrency(selectedOrder.paid_amount ?? 0)}</span>
                        </p>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Refund amount</label>
                          <input
                            type="number"
                            min={0.01}
                            max={selectedOrder.paid_amount ?? 0}
                            step="0.01"
                            value={returnAmount}
                            onChange={(e) => setReturnAmount(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                          />
                          <p className="text-xs text-gray-400 mt-1">Enter less than the full paid amount to issue a partial refund.</p>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Reason *</label>
                          <Textarea value={returnReason} onChange={(e) => setReturnReason(e.target.value)} rows={2} placeholder="Why is this order being refunded?" />
                        </div>
                        <div className="flex justify-end gap-2">
                          <Button variant="ghost" onClick={() => setShowRefundForm(false)}>Cancel</Button>
                          <Button variant="danger" onClick={handleProcessReturn} isLoading={isProcessingReturn}>Process Refund</Button>
                        </div>
                      </div>
                    ) : (
                      <Button variant="outline" onClick={() => setShowRefundForm(true)} className="w-full justify-center border-red-300 text-red-700 hover:bg-red-50">
                        <Undo2 className="w-4 h-4 mr-2" />
                        Process Refund
                      </Button>
                    )
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  {Number(selectedOrder.outstanding_receivable ?? 0) > 0 && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 space-y-2">
                      <p className="text-xs font-medium text-blue-900 uppercase tracking-wider">Record Payment</p>
                      <p className="text-sm text-blue-800">
                        Outstanding balance: <span className="font-semibold">{formatCurrency(selectedOrder.outstanding_receivable ?? 0)}</span>
                      </p>
                      <input
                        type="number"
                        min={0.01}
                        max={selectedOrder.outstanding_receivable ?? 0}
                        step="0.01"
                        value={recordPaymentAmount}
                        onChange={(e) => setRecordPaymentAmount(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                      />
                      <p className="text-xs text-blue-700/70">Enter less than the full outstanding amount to record a partial payment.</p>
                      <Button onClick={handleRecordPayment} isLoading={isRecordingPayment} className="w-full bg-blue-600 hover:bg-blue-700">
                        <Wallet className="w-4 h-4 mr-2" />
                        Record Payment
                      </Button>
                    </div>
                  )}
                  <div className="space-y-3">
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Update Order Status</p>
                    <Select
                      options={ORDER_STATUSES.map(s => ({ value: s.value, label: s.label }))}
                      value={newStatus}
                      onChange={(e) => setNewStatus(e.target.value)}
                    />
                    <Input value={statusNote} onChange={(e) => setStatusNote(e.target.value)} placeholder="Add a note for this status change (optional)" />
                    <Button onClick={handleStatusUpdate} isLoading={isSaving} className="w-full">Update Status</Button>
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button
                variant="outline"
                onClick={() => selectedOrder && handlePreviewInvoice(selectedOrder)}
                disabled={!!(selectedOrder && downloadingInvoice === selectedOrder.id)}
                className="border-orange-300 text-orange-700 hover:bg-orange-50"
              >
                <FileText className="w-4 h-4 mr-1" />
                {selectedOrder && downloadingInvoice === selectedOrder.id ? 'Opening…' : 'Preview Invoice'}
              </Button>
              {(selectedOrder?.customer_email || selectedOrder?.customer?.email) && (
                <Button
                  variant="outline"
                  onClick={() => selectedOrder && handleSendInvoiceEmail(selectedOrder)}
                  disabled={!!(selectedOrder && sendingInvoice === selectedOrder.id)}
                >
                  <Mail className="w-4 h-4 mr-1" />
                  {selectedOrder && sendingInvoice === selectedOrder.id ? 'Sending...' : 'Email Invoice'}
                </Button>
              )}
              <Link href={`/orders/${selectedOrder?.id}`}>
                <Button variant="outline">View Full Details</Button>
              </Link>
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
