'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  Search,
  Eye,
  ShoppingCart,
  Clock,
  CheckCircle,
  XCircle,
  Truck,
  Package,
  Download,
} from 'lucide-react';
import { AdminLayout } from '@/components/layout';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Button,
  Input,
  Select,
  Modal,
  Badge,
  LoadingSpinner,
  Pagination,
} from '@/components/ui';
import { formatCurrency, formatDateTime, getErrorMessage } from '@/lib/utils';
import adminService from '@/lib/adminService';
import toast from 'react-hot-toast';

interface OrderItem {
  id: number;
  service_id?: number;
  product_id?: number;
  quantity: number;
  price: number;
  total: number;
  service?: { id: number; name: string };
  product?: { id: number; name: string };
}

interface VendorOrder {
  id: number;
  order_number: string;
  customer: {
    id: number;
    name: string;
    email: string;
    phone: string;
  };
  items: OrderItem[];
  subtotal: number;
  commission: number;
  net_amount: number;
  status: string;
  payment_status: string;
  shipping_address: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

const ORDER_STATUSES = [
  { value: 'pending', label: 'Pending', color: 'warning' },
  { value: 'confirmed', label: 'Confirmed', color: 'default' },
  { value: 'processing', label: 'Processing', color: 'default' },
  { value: 'shipped', label: 'Shipped', color: 'default' },
  { value: 'delivered', label: 'Delivered', color: 'success' },
  { value: 'completed', label: 'Completed', color: 'success' },
  { value: 'cancelled', label: 'Cancelled', color: 'danger' },
];

function VendorOrdersContent() {
  const searchParams = useSearchParams();
  const vendorId = searchParams.get('vendor_id');
  
  const [orders, setOrders] = useState<VendorOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [isUpdateStatusModalOpen, setIsUpdateStatusModalOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<VendorOrder | null>(null);
  const [newStatus, setNewStatus] = useState('');
  const [statusNote, setStatusNote] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const fetchOrders = async () => {
    setIsLoading(true);
    try {
      const params: any = {
        page: currentPage,
        ...(searchQuery && { search: searchQuery }),
        ...(filterStatus && { status: filterStatus }),
        ...(vendorId && { vendor_id: parseInt(vendorId) }),
      };
      const response = await adminService.getVendorOrders(params);
      setOrders(response.data.data);
      setTotalPages(response.data.meta?.last_page || 1);
    } catch (error) {
      toast.error(getErrorMessage(error));
      setOrders([]);
      setTotalPages(1);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, [currentPage, filterStatus, vendorId]);

  const handleSearch = () => {
    setCurrentPage(1);
    fetchOrders();
  };

  const openViewModal = (order: VendorOrder) => {
    setSelectedOrder(order);
    setIsViewModalOpen(true);
  };

  const openUpdateStatusModal = (order: VendorOrder) => {
    setSelectedOrder(order);
    setNewStatus(order.status);
    setStatusNote('');
    setIsUpdateStatusModalOpen(true);
  };

  const handleStatusUpdate = async () => {
    if (!selectedOrder) return;
    setIsSaving(true);
    try {
      await adminService.updateVendorOrderStatus(selectedOrder.id, {
        status: newStatus,
        note: statusNote,
      });
      setIsUpdateStatusModalOpen(false);
      fetchOrders();
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setIsSaving(false);
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

  const getStatusIcon = (status: string) => {
    const icons: Record<string, React.ReactNode> = {
      pending: <Clock className="w-4 h-4 text-yellow-600" />,
      confirmed: <CheckCircle className="w-4 h-4 text-blue-600" />,
      processing: <Package className="w-4 h-4 text-blue-600" />,
      shipped: <Truck className="w-4 h-4 text-purple-600" />,
      delivered: <CheckCircle className="w-4 h-4 text-green-600" />,
      completed: <CheckCircle className="w-4 h-4 text-green-600" />,
      cancelled: <XCircle className="w-4 h-4 text-red-600" />,
    };
    return icons[status] || <Clock className="w-4 h-4" />;
  };

  const pendingCount = orders.filter(o => o.status === 'pending').length;
  const processingCount = orders.filter(o => ['confirmed', 'processing', 'shipped'].includes(o.status)).length;
  const completedCount = orders.filter(o => o.status === 'completed').length;

  return (
    <AdminLayout>
      <div className="page-header flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="page-title">My Orders</h1>
          <p className="page-description">Manage and track your orders</p>
        </div>
        <Button variant="outline">
          <Download className="w-4 h-4 mr-2" />
          Export
        </Button>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <Card className="bg-yellow-50 border-yellow-200">
          <CardContent className="p-4 flex items-center gap-3">
            <Clock className="w-8 h-8 text-yellow-600" />
            <div>
              <p className="text-2xl font-bold text-yellow-700">{pendingCount}</p>
              <p className="text-sm text-yellow-600">Pending</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="p-4 flex items-center gap-3">
            <Package className="w-8 h-8 text-blue-600" />
            <div>
              <p className="text-2xl font-bold text-blue-700">{processingCount}</p>
              <p className="text-sm text-blue-600">In Progress</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-green-50 border-green-200">
          <CardContent className="p-4 flex items-center gap-3">
            <CheckCircle className="w-8 h-8 text-green-600" />
            <div>
              <p className="text-2xl font-bold text-green-700">{completedCount}</p>
              <p className="text-sm text-green-600">Completed</p>
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
                placeholder="Search by order #, customer name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                className="pl-10"
              />
            </div>
            <Select 
              options={[
                { value: '', label: 'All Status' },
                ...ORDER_STATUSES.map((status) => ({
                  value: status.value,
                  label: status.label
                }))
              ]}
              value={filterStatus} 
              onChange={(e) => setFilterStatus(e.target.value)}
            />
            <Button onClick={handleSearch}>Search</Button>
          </div>
        </CardContent>
      </Card>

      {/* Orders List */}
      <Card>
        <CardHeader>
          <CardTitle>Orders ({orders.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <LoadingSpinner size="lg" text="Loading orders..." />
            </div>
          ) : orders.length === 0 ? (
            <div className="text-center py-12 text-gray-500">No orders found</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-y">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Order</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Customer</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Items</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Net Amount</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {orders.map((order) => (
                    <tr key={order.id} className={`hover:bg-gray-50 ${order.status === 'pending' ? 'bg-yellow-50' : ''}`}>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                            <ShoppingCart className="w-5 h-5 text-primary" />
                          </div>
                          <div>
                            <p className="font-medium">{order.order_number}</p>
                            <Badge variant={order.payment_status === 'paid' ? 'success' : 'warning'} className="text-xs">
                              {order.payment_status}
                            </Badge>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <p className="font-medium">{order.customer.name}</p>
                        <p className="text-xs text-gray-500">{order.customer.phone}</p>
                      </td>
                      <td className="px-6 py-4 text-gray-600">{order.items.length} item(s)</td>
                      <td className="px-6 py-4">
                        <p className="font-medium text-green-600">{formatCurrency(order.net_amount)}</p>
                        <p className="text-xs text-gray-500">Fee: {formatCurrency(order.commission)}</p>
                      </td>
                      <td className="px-6 py-4">
                        <button onClick={() => openUpdateStatusModal(order)} className="flex items-center gap-2 hover:opacity-80">
                          {getStatusIcon(order.status)}
                          {getStatusBadge(order.status)}
                        </button>
                      </td>
                      <td className="px-6 py-4 text-gray-600 text-sm">{formatDateTime(order.created_at)}</td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-end gap-2">
                          <Button variant="ghost" size="sm" onClick={() => openViewModal(order)}>
                            <Eye className="w-4 h-4" />
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

      {/* View Order Modal */}
      <Modal isOpen={isViewModalOpen} onClose={() => setIsViewModalOpen(false)} title="Order Details" size="lg">
        {selectedOrder && (
          <div className="space-y-6">
            {/* Header */}
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-lg font-semibold">{selectedOrder.order_number}</h3>
                <p className="text-sm text-gray-500">{formatDateTime(selectedOrder.created_at)}</p>
              </div>
              <div className="flex items-center gap-2">
                {getStatusBadge(selectedOrder.status)}
                <Badge variant={selectedOrder.payment_status === 'paid' ? 'success' : 'warning'}>
                  {selectedOrder.payment_status}
                </Badge>
              </div>
            </div>

            {/* Customer */}
            <div className="bg-gray-50 p-4 rounded-lg">
              <p className="text-xs text-gray-500 mb-2">Customer Information</p>
              <p className="font-medium">{selectedOrder.customer.name}</p>
              <p className="text-sm text-gray-600">{selectedOrder.customer.email}</p>
              <p className="text-sm text-gray-600">{selectedOrder.customer.phone}</p>
              <div className="mt-3 pt-3 border-t">
                <p className="text-xs text-gray-500 mb-1">Shipping Address</p>
                <p className="text-gray-700">{selectedOrder.shipping_address}</p>
              </div>
            </div>

            {/* Items */}
            <div>
              <p className="text-sm font-medium mb-2">Order Items</p>
              <div className="border rounded-lg divide-y">
                {selectedOrder.items.map((item) => (
                  <div key={item.id} className="p-4 flex justify-between items-center">
                    <div>
                      <p className="font-medium">{item.service?.name || item.product?.name}</p>
                      <p className="text-xs text-gray-500">
                        {formatCurrency(item.price)} × {item.quantity}
                      </p>
                    </div>
                    <p className="font-medium">{formatCurrency(item.total)}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Summary */}
            <div className="border-t pt-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Subtotal</span>
                <span>{formatCurrency(selectedOrder.subtotal)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Platform Commission (10%)</span>
                <span className="text-red-500">-{formatCurrency(selectedOrder.commission)}</span>
              </div>
              <div className="flex justify-between font-medium text-lg pt-2 border-t">
                <span>Your Earnings</span>
                <span className="text-green-600">{formatCurrency(selectedOrder.net_amount)}</span>
              </div>
            </div>

            {/* Notes */}
            {selectedOrder.notes && (
              <div className="bg-yellow-50 p-4 rounded-lg">
                <p className="text-xs text-yellow-700 mb-1">Customer Notes</p>
                <p className="text-yellow-800">{selectedOrder.notes}</p>
              </div>
            )}

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button variant="outline" onClick={() => setIsViewModalOpen(false)}>Close</Button>
              <Button onClick={() => { setIsViewModalOpen(false); openUpdateStatusModal(selectedOrder); }}>
                Update Status
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Update Status Modal */}
      <Modal isOpen={isUpdateStatusModalOpen} onClose={() => setIsUpdateStatusModalOpen(false)} title="Update Order Status">
        {selectedOrder && (
          <div className="space-y-4">
            <div className="bg-gray-50 p-4 rounded-lg">
              <p className="text-sm text-gray-600">Order: <span className="font-medium">{selectedOrder.order_number}</span></p>
              <p className="text-sm text-gray-600">Current Status: {getStatusBadge(selectedOrder.status)}</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">New Status</label>
              <Select 
                options={ORDER_STATUSES.map(status => ({ value: status.value, label: status.label }))}
                value={newStatus} 
                onChange={(e) => setNewStatus(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Note (Optional)</label>
              <Input
                value={statusNote}
                onChange={(e) => setStatusNote(e.target.value)}
                placeholder="Add a note about this status update"
              />
            </div>

            {/* Status Flow */}
            <div className="bg-blue-50 p-4 rounded-lg">
              <p className="text-xs text-blue-700 mb-2">Recommended Flow</p>
              <div className="flex items-center gap-2 flex-wrap text-xs">
                <span className="px-2 py-1 bg-white rounded">Pending</span>
                <span className="text-gray-400">→</span>
                <span className="px-2 py-1 bg-white rounded">Confirmed</span>
                <span className="text-gray-400">→</span>
                <span className="px-2 py-1 bg-white rounded">Processing</span>
                <span className="text-gray-400">→</span>
                <span className="px-2 py-1 bg-white rounded">Shipped</span>
                <span className="text-gray-400">→</span>
                <span className="px-2 py-1 bg-white rounded">Completed</span>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button variant="outline" onClick={() => setIsUpdateStatusModalOpen(false)}>Cancel</Button>
              <Button onClick={handleStatusUpdate} isLoading={isSaving}>Update Status</Button>
            </div>
          </div>
        )}
      </Modal>
    </AdminLayout>
  );
}

export default function VendorOrdersPage() {
  return (
    <Suspense fallback={<AdminLayout><div className="flex items-center justify-center min-h-screen"><LoadingSpinner size="lg" text="Loading..." /></div></AdminLayout>}>
      <VendorOrdersContent />
    </Suspense>
  );
}
