'use client';

import React, { useEffect, useState } from 'react';
import { Search, Eye, CreditCard, CheckCircle, Clock, AlertCircle, RefreshCw, Smartphone, Banknote, Building2, Package, Wrench, User, MapPin, FileText, Settings2 } from 'lucide-react';
import { AdminLayout } from '@/components/layout';
import {
  Card, CardContent, CardHeader, CardTitle, Button, Input, Select, Modal,
  Badge, Pagination, LoadingSpinner, EmptyState, ErrorState,
} from '@/components/ui';
import { formatCurrency, formatDateTime, getErrorMessage } from '@/lib/utils';
import adminService from '@/lib/adminService';
import toast from 'react-hot-toast';

interface OrderItem {
  id: number;
  order_id: number;
  item_type: 'product' | 'service';
  product_id: number | null;
  service_id: number | null;
  item_name: string;
  item_sku: string;
  quantity: number;
  unit_price: string;
  total_price: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

interface Customer {
  id: number;
  name: string;
  email: string;
  phone: string;
  role: string;
  status: string;
  avatar: string | null;
}

interface Payment {
  id: number;
  order_number: string;
  customer_id: number;
  vendor_profile_id: number | null;
  subtotal: string;
  tax: string;
  shipping: string;
  discount: string;
  total: string;
  payment_method: string;
  payment_status: string;
  order_status: string;
  customer_notes: string | null;
  vendor_notes: string | null;
  admin_notes: string | null;
  customer_name: string;
  customer_phone: string;
  customer_email: string;
  customer_address: string;
  division_id: number | null;
  district_id: number | null;
  area_id: number | null;
  accepted_at: string | null;
  completed_at: string | null;
  cancelled_at: string | null;
  created_at: string;
  updated_at: string;
  customer: Customer | null;
  vendor_profile: null;
  items: OrderItem[];
}

const PAYMENT_METHODS: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  bkash:         { label: 'bKash',         icon: <Smartphone className="w-4 h-4" />, color: 'text-pink-600 bg-pink-50' },
  nagad:         { label: 'Nagad',          icon: <Smartphone className="w-4 h-4" />, color: 'text-orange-600 bg-orange-50' },
  rocket:        { label: 'Rocket',         icon: <Smartphone className="w-4 h-4" />, color: 'text-purple-600 bg-purple-50' },
  bank_transfer: { label: 'Bank Transfer',  icon: <Building2 className="w-4 h-4" />,  color: 'text-blue-600 bg-blue-50' },
  cash:          { label: 'Cash',           icon: <Banknote className="w-4 h-4" />,   color: 'text-green-600 bg-green-50' },
  card:          { label: 'Card',           icon: <CreditCard className="w-4 h-4" />, color: 'text-indigo-600 bg-indigo-50' },
};

const PAYMENT_STATUSES = [
  { value: 'pending',               label: 'Pending',            color: 'warning' },
  { value: 'awaiting_confirmation', label: 'Awaiting Confirm',   color: 'warning' },
  { value: 'partially_paid',        label: 'Partially Paid',     color: 'warning' },
  { value: 'paid',                  label: 'Paid',               color: 'success' },
  { value: 'verified',              label: 'Verified',           color: 'success' },
  { value: 'failed',                label: 'Failed',             color: 'danger' },
  { value: 'refunded',              label: 'Refunded',           color: 'default' },
];

const ORDER_STATUS_COLORS: Record<string, 'success' | 'warning' | 'danger' | 'default'> = {
  pending:    'warning',
  processing: 'warning',
  accepted:   'success',
  completed:  'success',
  cancelled:  'danger',
};

function getPaymentStatusBadge(status: string) {
  const s = PAYMENT_STATUSES.find(x => x.value === status);
  return <Badge variant={(s?.color as 'success' | 'warning' | 'danger' | 'default') || 'default'}>{s?.label || status}</Badge>;
}

function getOrderStatusBadge(status: string) {
  const color = ORDER_STATUS_COLORS[status] || 'default';
  return <Badge variant={color}>{status.charAt(0).toUpperCase() + status.slice(1)}</Badge>;
}

function MethodBadge({ method }: { method: string }) {
  const info = PAYMENT_METHODS[method] || { label: method, icon: <CreditCard className="w-4 h-4" />, color: 'text-gray-600 bg-gray-50' };
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium ${info.color}`}>
      {info.icon}
      {info.label}
    </span>
  );
}

export default function PaymentsPage() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterMethod, setFilterMethod] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
  const [isVerifyModalOpen, setIsVerifyModalOpen] = useState(false);
  const [isRefundModalOpen, setIsRefundModalOpen] = useState(false);
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);
  const [verifyNotes, setVerifyNotes] = useState('');
  const [refundNotes, setRefundNotes] = useState('');
  const [statusTarget, setStatusTarget] = useState('');
  const [statusNotes, setStatusNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const fetchPayments = async () => {
    setIsLoading(true);
    setError(false);
    try {
      const params: Record<string, string | number> = { page: currentPage };
      if (searchQuery) params.search = searchQuery;
      if (filterStatus) params.payment_status = filterStatus;
      if (filterMethod) params.payment_method = filterMethod;
      const response = await adminService.getPayments(params);
      setPayments(response.data.data);
      setTotalPages(response.data.meta?.last_page || 1);
      setTotal(response.data.meta?.total || 0);
    } catch (err) {
      toast.error(getErrorMessage(err));
      setError(true);
      setPayments([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchPayments(); }, [currentPage, filterStatus, filterMethod]);
  const handleSearch = () => { setCurrentPage(1); fetchPayments(); };

  const handleVerify = async () => {
    if (!selectedPayment) return;
    setIsSaving(true);
    try {
      await adminService.updatePaymentStatus(selectedPayment.id, 'verified', verifyNotes);
      toast.success('Payment verified');
      setIsVerifyModalOpen(false);
      setVerifyNotes('');
      fetchPayments();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setIsSaving(false);
    }
  };

  const handleRefund = async () => {
    if (!selectedPayment) return;
    setIsSaving(true);
    try {
      await adminService.updatePaymentStatus(selectedPayment.id, 'refunded', refundNotes);
      toast.success('Payment refunded');
      setIsRefundModalOpen(false);
      setRefundNotes('');
      fetchPayments();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setIsSaving(false);
    }
  };

  const handleChangeStatus = async () => {
    if (!selectedPayment || !statusTarget) return;
    setIsSaving(true);
    try {
      await adminService.updatePaymentStatus(selectedPayment.id, statusTarget, statusNotes);
      toast.success(`Payment marked as ${PAYMENT_STATUSES.find(s => s.value === statusTarget)?.label || statusTarget}`);
      setIsStatusModalOpen(false);
      setStatusNotes('');
      fetchPayments();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setIsSaving(false);
    }
  };

  // Stats derived from current page data
  const completedTotal = payments
    .filter(p => p.payment_status === 'verified' || p.payment_status === 'paid')
    .reduce((s, p) => s + parseFloat(p.total), 0);
  const pendingTotal = payments
    .filter(p => p.payment_status === 'pending' || p.payment_status === 'awaiting_confirmation')
    .reduce((s, p) => s + parseFloat(p.total), 0);
  const mobileCount = payments
    .filter(p => ['bkash', 'nagad', 'rocket'].includes(p.payment_method)).length;

  if (error && payments.length === 0) {
    return <AdminLayout><ErrorState title="Failed to load payments" onRetry={fetchPayments} /></AdminLayout>;
  }

  return (
    <AdminLayout>
      <div className="page-header">
        <h1 className="page-title">Payments</h1>
        <p className="page-description">Manage payment transactions — {total} total</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Card><CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center"><CheckCircle className="w-5 h-5 text-green-600" /></div>
            <div><p className="text-xs text-gray-500">Paid (this page)</p><p className="text-xl font-bold">{formatCurrency(completedTotal)}</p></div>
          </div>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-yellow-100 rounded-lg flex items-center justify-center"><Clock className="w-5 h-5 text-yellow-600" /></div>
            <div><p className="text-xs text-gray-500">Pending (this page)</p><p className="text-xl font-bold">{formatCurrency(pendingTotal)}</p></div>
          </div>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center"><Smartphone className="w-5 h-5 text-blue-600" /></div>
            <div><p className="text-xs text-gray-500">Mobile Payments</p><p className="text-xl font-bold">{mobileCount}</p></div>
          </div>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center"><CreditCard className="w-5 h-5 text-purple-600" /></div>
            <div><p className="text-xs text-gray-500">Total Orders</p><p className="text-xl font-bold">{total}</p></div>
          </div>
        </CardContent></Card>
      </div>

      {/* Filters */}
      <Card className="mb-6"><CardContent className="p-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
            <Input
              placeholder="Search order number or customer..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              className="pl-10"
            />
          </div>
          <Select
            options={[{ value: '', label: 'All Payment Status' }, ...PAYMENT_STATUSES.map(s => ({ value: s.value, label: s.label }))]}
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
          />
          <Select
            options={[
              { value: '', label: 'All Methods' },
              ...Object.entries(PAYMENT_METHODS).map(([value, info]) => ({ value, label: info.label })),
            ]}
            value={filterMethod}
            onChange={(e) => setFilterMethod(e.target.value)}
          />
          <Button onClick={handleSearch}>Search</Button>
        </div>
      </CardContent></Card>

      {/* Table */}
      <Card>
        <CardHeader><CardTitle>All Payments</CardTitle></CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12"><LoadingSpinner size="lg" text="Loading payments..." /></div>
          ) : payments.length === 0 ? (
            <EmptyState icon={<CreditCard className="w-8 h-8 text-gray-400" />} title="No payments found" />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-y">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Order</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Customer</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Items</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Method</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Payment</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Order</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {payments.map((payment) => (
                    <tr key={payment.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <p className="font-medium text-primary text-sm">{payment.order_number}</p>
                        <p className="text-xs text-gray-400">#{payment.id}</p>
                      </td>
                      <td className="px-6 py-4">
                        <p className="font-medium text-sm">{payment.customer_name}</p>
                        <p className="text-xs text-gray-500">{payment.customer_phone}</p>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col gap-0.5">
                          {payment.items.slice(0, 2).map(item => (
                            <span key={item.id} className="inline-flex items-center gap-1 text-xs text-gray-600">
                              {item.item_type === 'product' ? <Package className="w-3 h-3 text-blue-500" /> : <Wrench className="w-3 h-3 text-orange-500" />}
                              {item.item_name} ×{item.quantity}
                            </span>
                          ))}
                          {payment.items.length > 2 && <span className="text-xs text-gray-400">+{payment.items.length - 2} more</span>}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <p className="font-semibold text-sm">{formatCurrency(parseFloat(payment.total))}</p>
                        {parseFloat(payment.discount) > 0 && (
                          <p className="text-xs text-green-600">-{formatCurrency(parseFloat(payment.discount))} off</p>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <MethodBadge method={payment.payment_method} />
                      </td>
                      <td className="px-6 py-4">{getPaymentStatusBadge(payment.payment_status)}</td>
                      <td className="px-6 py-4">{getOrderStatusBadge(payment.order_status)}</td>
                      <td className="px-6 py-4 text-gray-500 text-xs">{formatDateTime(payment.created_at)}</td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost" size="sm"
                            onClick={() => { setSelectedPayment(payment); setIsViewModalOpen(true); }}
                            title="View details"
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                          {(payment.payment_status === 'pending' || payment.payment_status === 'awaiting_confirmation') && (
                            <Button
                              variant="ghost" size="sm"
                              onClick={() => { setSelectedPayment(payment); setVerifyNotes(''); setIsVerifyModalOpen(true); }}
                              title="Verify payment"
                            >
                              <CheckCircle className="w-4 h-4 text-green-600" />
                            </Button>
                          )}
                          {(payment.payment_status === 'paid' || payment.payment_status === 'verified') && (
                            <Button
                              variant="ghost" size="sm"
                              onClick={() => { setSelectedPayment(payment); setRefundNotes(''); setIsRefundModalOpen(true); }}
                              title="Refund"
                            >
                              <RefreshCw className="w-4 h-4 text-orange-600" />
                            </Button>
                          )}
                          <Button
                            variant="ghost" size="sm"
                            onClick={() => { setSelectedPayment(payment); setStatusTarget(payment.payment_status); setStatusNotes(''); setIsStatusModalOpen(true); }}
                            title="Change status"
                          >
                            <Settings2 className="w-4 h-4 text-gray-500" />
                          </Button>
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

      {/* View Details Modal */}
      <Modal isOpen={isViewModalOpen} onClose={() => setIsViewModalOpen(false)} title="Payment Details" size="lg">
        {selectedPayment && (
          <div className="space-y-5">
            {/* Header */}
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs text-gray-500 mb-0.5">Order Number</p>
                <p className="text-lg font-bold text-primary">{selectedPayment.order_number}</p>
                <p className="text-xs text-gray-400">{formatDateTime(selectedPayment.created_at)}</p>
              </div>
              <div className="flex flex-col items-end gap-1.5">
                {getPaymentStatusBadge(selectedPayment.payment_status)}
                {getOrderStatusBadge(selectedPayment.order_status)}
              </div>
            </div>

            {/* Amount Breakdown */}
            <div className="bg-blue-50 rounded-lg p-4 border border-blue-100">
              <p className="text-xs font-semibold text-blue-700 uppercase tracking-wider mb-3">Amount Breakdown</p>
              <div className="space-y-1.5">
                <div className="flex justify-between text-sm text-blue-800">
                  <span>Subtotal</span>
                  <span>{formatCurrency(parseFloat(selectedPayment.subtotal))}</span>
                </div>
                {parseFloat(selectedPayment.tax) > 0 && (
                  <div className="flex justify-between text-sm text-blue-800">
                    <span>Tax</span>
                    <span>{formatCurrency(parseFloat(selectedPayment.tax))}</span>
                  </div>
                )}
                {parseFloat(selectedPayment.shipping) > 0 && (
                  <div className="flex justify-between text-sm text-blue-800">
                    <span>Shipping</span>
                    <span>{formatCurrency(parseFloat(selectedPayment.shipping))}</span>
                  </div>
                )}
                {parseFloat(selectedPayment.discount) > 0 && (
                  <div className="flex justify-between text-sm text-green-700">
                    <span>Discount</span>
                    <span>-{formatCurrency(parseFloat(selectedPayment.discount))}</span>
                  </div>
                )}
                <div className="border-t border-blue-200 pt-1.5 mt-1.5 flex justify-between text-base font-bold text-blue-900">
                  <span>Total</span>
                  <span>{formatCurrency(parseFloat(selectedPayment.total))}</span>
                </div>
              </div>
            </div>

            {/* Payment Method */}
            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Payment Method</p>
              <MethodBadge method={selectedPayment.payment_method} />
            </div>

            {/* Customer */}
            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-1.5"><User className="w-3.5 h-3.5" />Customer</p>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><p className="text-xs text-gray-400">Name</p><p className="font-medium">{selectedPayment.customer_name}</p></div>
                <div><p className="text-xs text-gray-400">Phone</p><p className="font-medium">{selectedPayment.customer_phone}</p></div>
                <div className="col-span-2"><p className="text-xs text-gray-400">Email</p><p className="font-medium">{selectedPayment.customer_email}</p></div>
              </div>
            </div>

            {/* Delivery Address */}
            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5" />Delivery Address</p>
              <p className="text-sm text-gray-700">{selectedPayment.customer_address}</p>
            </div>

            {/* Items */}
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Order Items</p>
              <div className="border rounded-lg divide-y overflow-hidden">
                {selectedPayment.items.map(item => (
                  <div key={item.id} className="flex items-center justify-between px-4 py-3 text-sm bg-white hover:bg-gray-50">
                    <div className="flex items-center gap-2 min-w-0">
                      {item.item_type === 'product'
                        ? <Package className="w-4 h-4 text-blue-500 shrink-0" />
                        : <Wrench className="w-4 h-4 text-orange-500 shrink-0" />
                      }
                      <div className="min-w-0">
                        <p className="font-medium truncate">{item.item_name}</p>
                        <p className="text-xs text-gray-400">{item.item_sku} · qty {item.quantity}</p>
                      </div>
                    </div>
                    <p className="font-semibold text-right ml-4 shrink-0">{formatCurrency(parseFloat(item.total_price))}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Timestamps */}
            {(selectedPayment.accepted_at || selectedPayment.completed_at || selectedPayment.cancelled_at) && (
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Timeline</p>
                <div className="space-y-1.5 text-sm">
                  {selectedPayment.accepted_at && (
                    <div className="flex justify-between"><span className="text-gray-500">Accepted</span><span>{formatDateTime(selectedPayment.accepted_at)}</span></div>
                  )}
                  {selectedPayment.completed_at && (
                    <div className="flex justify-between"><span className="text-gray-500">Completed</span><span>{formatDateTime(selectedPayment.completed_at)}</span></div>
                  )}
                  {selectedPayment.cancelled_at && (
                    <div className="flex justify-between text-red-600"><span>Cancelled</span><span>{formatDateTime(selectedPayment.cancelled_at)}</span></div>
                  )}
                </div>
              </div>
            )}

            {/* Notes */}
            {(selectedPayment.customer_notes || selectedPayment.admin_notes || selectedPayment.vendor_notes) && (
              <div className="bg-yellow-50 rounded-lg p-4 border border-yellow-100">
                <p className="text-xs font-semibold text-yellow-700 uppercase tracking-wider mb-2 flex items-center gap-1.5"><FileText className="w-3.5 h-3.5" />Notes</p>
                {selectedPayment.customer_notes && (
                  <div className="mb-1.5">
                    <p className="text-xs text-yellow-600 mb-0.5">Customer</p>
                    <p className="text-sm text-yellow-800">{selectedPayment.customer_notes}</p>
                  </div>
                )}
                {selectedPayment.admin_notes && (
                  <div className="mb-1.5">
                    <p className="text-xs text-yellow-600 mb-0.5">Admin</p>
                    <p className="text-sm text-yellow-800">{selectedPayment.admin_notes}</p>
                  </div>
                )}
                {selectedPayment.vendor_notes && (
                  <div>
                    <p className="text-xs text-yellow-600 mb-0.5">Vendor</p>
                    <p className="text-sm text-yellow-800">{selectedPayment.vendor_notes}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Verify Modal */}
      <Modal isOpen={isVerifyModalOpen} onClose={() => setIsVerifyModalOpen(false)} title="Verify Payment">
        {selectedPayment && (
          <div className="space-y-4">
            <div className="bg-gray-50 p-4 rounded-lg space-y-1 text-sm">
              <p>Order: <span className="font-medium text-primary">{selectedPayment.order_number}</span></p>
              <p>Amount: <span className="font-bold">{formatCurrency(parseFloat(selectedPayment.total))}</span></p>
              <p className="flex items-center gap-1.5">Method: <MethodBadge method={selectedPayment.payment_method} /></p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Notes (Optional)</label>
              <textarea
                value={verifyNotes}
                onChange={(e) => setVerifyNotes(e.target.value)}
                className="w-full border rounded-lg p-3 h-20 text-sm"
                placeholder="Verification notes..."
              />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <Button variant="outline" onClick={() => setIsVerifyModalOpen(false)}>Cancel</Button>
              <Button onClick={handleVerify} isLoading={isSaving}>
                <CheckCircle className="w-4 h-4 mr-2" />Verify Payment
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Refund Modal */}
      <Modal isOpen={isRefundModalOpen} onClose={() => setIsRefundModalOpen(false)} title="Refund Payment">
        {selectedPayment && (
          <div className="space-y-4">
            <div className="bg-red-50 p-4 rounded-lg border border-red-100">
              <div className="flex items-center gap-2 text-red-700 mb-2">
                <AlertCircle className="w-5 h-5" />
                <span className="font-medium">This action cannot be undone</span>
              </div>
              <p className="text-sm text-red-600">Amount to refund: <span className="font-bold">{formatCurrency(parseFloat(selectedPayment.total))}</span></p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Reason for Refund *</label>
              <textarea
                value={refundNotes}
                onChange={(e) => setRefundNotes(e.target.value)}
                className="w-full border rounded-lg p-3 h-20 text-sm"
                placeholder="Enter reason..."
              />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <Button variant="outline" onClick={() => setIsRefundModalOpen(false)}>Cancel</Button>
              <Button variant="danger" onClick={handleRefund} isLoading={isSaving} disabled={!refundNotes.trim()}>
                <RefreshCw className="w-4 h-4 mr-2" />Process Refund
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Change Status Modal */}
      <Modal isOpen={isStatusModalOpen} onClose={() => setIsStatusModalOpen(false)} title="Change Payment Status">
        {selectedPayment && (
          <div className="space-y-4">
            <div className="bg-gray-50 p-4 rounded-lg space-y-1 text-sm">
              <p>Order: <span className="font-medium text-primary">{selectedPayment.order_number}</span></p>
              <p>Amount: <span className="font-bold">{formatCurrency(parseFloat(selectedPayment.total))}</span></p>
              <p className="flex items-center gap-1.5">Current status: {getPaymentStatusBadge(selectedPayment.payment_status)}</p>
            </div>
            <Select
              label="New Status"
              options={PAYMENT_STATUSES.filter(s => s.value !== 'partially_paid').map(s => ({ value: s.value, label: s.label }))}
              value={statusTarget}
              onChange={(e) => setStatusTarget(e.target.value)}
            />
            <p className="text-xs text-gray-400 -mt-2">
              &quot;Partially Paid&quot; can only be reached by recording an actual partial payment on the order page.
            </p>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Notes (Optional)</label>
              <textarea
                value={statusNotes}
                onChange={(e) => setStatusNotes(e.target.value)}
                className="w-full border rounded-lg p-3 h-20 text-sm"
                placeholder="Reason / notes for this status change..."
              />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <Button variant="outline" onClick={() => setIsStatusModalOpen(false)}>Cancel</Button>
              <Button
                onClick={handleChangeStatus}
                isLoading={isSaving}
                disabled={!statusTarget || statusTarget === selectedPayment.payment_status}
              >
                <Settings2 className="w-4 h-4 mr-2" />Update Status
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </AdminLayout>
  );
}
