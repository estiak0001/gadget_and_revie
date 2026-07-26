'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/stores/auth-store';
import { orderService } from '@/lib/api';
import { Order } from '@/lib/types';
import toast from 'react-hot-toast';
import Link from 'next/link';
import {
    ArrowLeftIcon,
    ShoppingBagIcon,
    TruckIcon,
    CheckCircleIcon,
    XCircleIcon,
    ClockIcon,
    CreditCardIcon,
    MapPinIcon,
    PhoneIcon,
    EnvelopeIcon,
    UserIcon,
    DocumentTextIcon,
    ExclamationTriangleIcon,
    ArrowDownTrayIcon,
    PaperAirplaneIcon,
    DocumentArrowDownIcon,
} from '@heroicons/react/24/outline';

const statusConfig: Record<string, { label: string; color: string; bgColor: string; icon: React.ElementType }> = {
    pending: { label: 'Pending', color: 'text-yellow-800', bgColor: 'bg-yellow-100', icon: ClockIcon },
    confirmed: { label: 'Confirmed', color: 'text-blue-800', bgColor: 'bg-blue-100', icon: CheckCircleIcon },
    accepted: { label: 'Accepted', color: 'text-blue-800', bgColor: 'bg-blue-100', icon: CheckCircleIcon },
    in_progress: { label: 'In Progress', color: 'text-indigo-800', bgColor: 'bg-indigo-100', icon: TruckIcon },
    completed: { label: 'Completed', color: 'text-green-800', bgColor: 'bg-green-100', icon: CheckCircleIcon },
    cancelled: { label: 'Cancelled', color: 'text-red-800', bgColor: 'bg-red-100', icon: XCircleIcon },
    rejected: { label: 'Rejected', color: 'text-red-800', bgColor: 'bg-red-100', icon: XCircleIcon },
    refunded: { label: 'Refunded', color: 'text-gray-800', bgColor: 'bg-gray-200', icon: ExclamationTriangleIcon },
};

const paymentStatusConfig: Record<string, { label: string; color: string }> = {
    pending: { label: 'Pending', color: 'bg-yellow-100 text-yellow-800' },
    awaiting_confirmation: { label: 'Awaiting Confirmation', color: 'bg-gray-200 text-gray-800' },
    paid: { label: 'Paid', color: 'bg-green-100 text-green-800' },
    failed: { label: 'Failed', color: 'bg-red-100 text-red-800' },
    refunded: { label: 'Refunded', color: 'bg-gray-100 text-gray-800' },
};

const safeDate = (dateValue: string | null | undefined): string => {
    if (!dateValue) return 'N/A';
    try {
        return new Date(dateValue).toLocaleDateString('en-US', {
            year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
        });
    } catch {
        return 'N/A';
    }
};

export default function OrderDetailPage() {
    const params = useParams();
    const router = useRouter();
    const orderId = Number(params.id);

    const { isAuthenticated } = useAuthStore();
    const [order, setOrder] = useState<Order | null>(null);
    const [loading, setLoading] = useState(true);
    const [cancelling, setCancelling] = useState(false);
    const [downloadingInvoice, setDownloadingInvoice] = useState(false);
    const [sendingInvoice, setSendingInvoice] = useState(false);

    useEffect(() => {
        if (!isAuthenticated) return;
        fetchOrder();
    }, [isAuthenticated, orderId]);

    const fetchOrder = async () => {
        setLoading(true);
        try {
            const data = await orderService.getById(orderId);
            setOrder(data);
        } catch (error: any) {
            toast.error('Failed to load order');
            router.push('/dashboard');
        } finally {
            setLoading(false);
        }
    };

    const handleDownloadInvoice = async () => {
        if (!order) return;
        setDownloadingInvoice(true);
        try {
            const blob = await orderService.downloadInvoice(order.id);
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `Invoice-${order.order_number}.pdf`;
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);
            toast.success('Invoice downloaded successfully!');
        } catch (error: any) {
            toast.error('Failed to download invoice. Please try again.');
        } finally {
            setDownloadingInvoice(false);
        }
    };

    const handleSendInvoiceEmail = async () => {
        if (!order) return;
        setSendingInvoice(true);
        try {
            const result = await orderService.sendInvoiceEmail(order.id);
            toast.success(`Invoice sent to ${result?.sent_to || 'your email'}!`);
        } catch (error: any) {
            toast.error(error?.response?.data?.message || 'Failed to send invoice email.');
        } finally {
            setSendingInvoice(false);
        }
    };

    const handleCancelOrder = async () => {
        if (!order) return;
        const reason = prompt('Please provide a reason for cancellation:');
        if (!reason) return;

        setCancelling(true);
        try {
            const updated = await orderService.cancel(order.id, reason);
            setOrder(updated);
            toast.success('Order cancelled successfully');
        } catch (error: any) {
            toast.error(error?.response?.data?.message || 'Failed to cancel order');
        } finally {
            setCancelling(false);
        }
    };

    // Auth gate
    if (!isAuthenticated) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="text-center">
                    <h2 className="text-2xl font-bold text-gray-900">Please Login</h2>
                    <p className="mt-2 text-gray-600">You need to be logged in to view orders.</p>
                    <button
                        onClick={() => router.push('/auth/login')}
                        className="mt-4 bg-ink text-white px-6 py-2 rounded-lg hover:bg-ink transition"
                    >
                        Login
                    </button>
                </div>
            </div>
        );
    }

    // Loading state
    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 py-8">
                <div className="max-w-4xl mx-auto px-4">
                    <div className="animate-pulse space-y-6">
                        <div className="h-8 bg-gray-200 rounded w-1/3" />
                        <div className="bg-white rounded-xl shadow p-8 space-y-4">
                            <div className="h-6 bg-gray-200 rounded w-2/3" />
                            <div className="h-4 bg-gray-200 rounded w-1/4" />
                            <div className="grid grid-cols-2 gap-4 mt-6">
                                {[1, 2, 3, 4].map((i) => (
                                    <div key={i} className="h-20 bg-gray-100 rounded-xl" />
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    if (!order) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="text-center">
                    <ShoppingBagIcon className="mx-auto h-16 w-16 text-gray-300" />
                    <h2 className="mt-4 text-2xl font-bold text-gray-900">Order Not Found</h2>
                    <p className="mt-2 text-gray-600">The order you&apos;re looking for doesn&apos;t exist.</p>
                    <button
                        onClick={() => router.push('/dashboard')}
                        className="mt-4 bg-ink text-white px-6 py-2 rounded-lg hover:bg-ink transition"
                    >
                        Back to Dashboard
                    </button>
                </div>
            </div>
        );
    }

    const orderStatus = (order.order_status || order.status || 'pending') as string;
    const status = statusConfig[orderStatus] || statusConfig.pending;
    const paymentStatus = paymentStatusConfig[order.payment_status] || paymentStatusConfig.pending;
    const StatusIcon = status.icon;

    return (
        <div className="min-h-screen bg-gray-50 py-8">
            <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
                {/* Header */}
                <div className="mb-6">
                    <button
                        onClick={() => router.push('/dashboard')}
                        className="flex items-center text-sm text-gray-600 hover:text-gray-900 mb-4 transition"
                    >
                        <ArrowLeftIcon className="h-4 w-4 mr-1" />
                        Back to Dashboard
                    </button>

                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900">Order {order.order_number}</h1>
                            <p className="mt-1 text-sm text-gray-500">
                                Placed on {safeDate(order.created_at)}
                            </p>
                        </div>

                        <div className="flex items-center gap-3">
                            <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold ${status.bgColor} ${status.color}`}>
                                <StatusIcon className="h-4 w-4" />
                                {status.label}
                            </span>
                            <span className={`inline-flex items-center px-3 py-1.5 rounded-full text-xs font-semibold ${paymentStatus.color}`}>
                                {paymentStatus.label}
                            </span>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                    {/* Main Content */}
                    <div className="lg:col-span-2 space-y-6">
                        {/* Order Items */}
                        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                            <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-gray-100 to-red-50">
                                <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                                    <ShoppingBagIcon className="h-5 w-5 text-gray-800" />
                                    Order Items
                                </h2>
                            </div>

                            <div className="divide-y divide-gray-100">
                                {order.items && order.items.length > 0 ? (
                                    order.items.map((item) => {
                                        const itemName = item.item_name || item.product?.name || item.service?.name || 'Item';
                                        const unitPrice = Number(item.unit_price) || 0;
                                        const totalPrice = Number(item.total_price || item.subtotal) || unitPrice * item.quantity;

                                        return (
                                            <div key={item.id} className="px-6 py-4 flex items-center gap-4">
                                                <div className="h-16 w-16 bg-gradient-to-br from-gray-200 to-red-100 rounded-xl flex items-center justify-center flex-shrink-0">
                                                    <ShoppingBagIcon className="h-8 w-8 text-gray-800" />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="font-semibold text-gray-900 truncate">{itemName}</p>
                                                    <p className="text-sm text-gray-500">
                                                        {item.item_type === 'service' ? 'Service' : 'Product'}
                                                        {item.item_sku ? ` • SKU: ${item.item_sku}` : ''}
                                                    </p>
                                                    <p className="text-sm text-gray-600 mt-0.5">
                                                        ৳{unitPrice.toLocaleString()} × {item.quantity}
                                                    </p>
                                                </div>
                                                <div className="text-right">
                                                    <p className="font-bold text-gray-900 text-lg">৳{totalPrice.toLocaleString()}</p>
                                                </div>
                                            </div>
                                        );
                                    })
                                ) : (
                                    <div className="px-6 py-8 text-center text-gray-500">
                                        No items in this order
                                    </div>
                                )}
                            </div>

                            {/* Order Summary */}
                            <div className="px-6 py-4 bg-gray-50 space-y-2">
                                {order.subtotal !== undefined && (
                                    <div className="flex justify-between text-sm text-gray-600">
                                        <span>Subtotal</span>
                                        <span>৳{Number(order.subtotal).toLocaleString()}</span>
                                    </div>
                                )}
                                {Number(order.tax) > 0 && (
                                    <div className="flex justify-between text-sm text-gray-600">
                                        <span>Tax</span>
                                        <span>৳{Number(order.tax).toLocaleString()}</span>
                                    </div>
                                )}
                                {Number(order.shipping) > 0 && (
                                    <div className="flex justify-between text-sm text-gray-600">
                                        <span>Shipping</span>
                                        <span>৳{Number(order.shipping).toLocaleString()}</span>
                                    </div>
                                )}
                                {Number(order.discount) > 0 && (
                                    <div className="flex justify-between text-sm text-green-600">
                                        <span>Discount</span>
                                        <span>-৳{Number(order.discount).toLocaleString()}</span>
                                    </div>
                                )}
                                <div className="flex justify-between font-bold text-gray-900 text-lg pt-2 border-t border-gray-200">
                                    <span>Total</span>
                                    <span>৳{Number(order.total || order.total_amount).toLocaleString()}</span>
                                </div>
                            </div>
                        </div>

                        {/* Customer Notes */}
                        {order.customer_notes && (
                            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                                <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider mb-3 flex items-center gap-2">
                                    <DocumentTextIcon className="h-4 w-4 text-gray-500" />
                                    Your Notes
                                </h3>
                                <p className="text-gray-700 text-sm whitespace-pre-wrap">{order.customer_notes}</p>
                            </div>
                        )}

                        {/* Vendor Notes */}
                        {order.vendor_notes && (
                            <div className="bg-blue-50 rounded-xl border border-blue-200 p-6">
                                <h3 className="text-sm font-semibold text-blue-900 uppercase tracking-wider mb-3">
                                    Vendor Notes
                                </h3>
                                <p className="text-blue-800 text-sm whitespace-pre-wrap">{order.vendor_notes}</p>
                            </div>
                        )}
                    </div>

                    {/* Sidebar */}
                    <div className="space-y-6">
                        {/* Order Info */}
                        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                            <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider mb-4">
                                Order Details
                            </h3>
                            <dl className="space-y-4">
                                <div>
                                    <dt className="text-xs text-gray-500">Order Number</dt>
                                    <dd className="text-sm font-medium text-gray-900">{order.order_number}</dd>
                                </div>
                                <div>
                                    <dt className="text-xs text-gray-500">Payment Method</dt>
                                    <dd className="text-sm font-medium text-gray-900 capitalize flex items-center gap-1.5">
                                        <CreditCardIcon className="h-4 w-4 text-gray-400" />
                                        {(order.payment_method || 'N/A').replace('_', ' ')}
                                    </dd>
                                </div>
                                <div>
                                    <dt className="text-xs text-gray-500">Order Date</dt>
                                    <dd className="text-sm text-gray-900">{safeDate(order.created_at)}</dd>
                                </div>
                                <div>
                                    <dt className="text-xs text-gray-500">Last Updated</dt>
                                    <dd className="text-sm text-gray-900">{safeDate(order.updated_at)}</dd>
                                </div>
                                {order.accepted_at && (
                                    <div>
                                        <dt className="text-xs text-gray-500">Accepted</dt>
                                        <dd className="text-sm text-gray-900">{safeDate(order.accepted_at)}</dd>
                                    </div>
                                )}
                                {order.completed_at && (
                                    <div>
                                        <dt className="text-xs text-gray-500">Completed</dt>
                                        <dd className="text-sm text-green-700">{safeDate(order.completed_at)}</dd>
                                    </div>
                                )}
                                {order.cancelled_at && (
                                    <div>
                                        <dt className="text-xs text-gray-500">Cancelled</dt>
                                        <dd className="text-sm text-red-700">{safeDate(order.cancelled_at)}</dd>
                                    </div>
                                )}
                            </dl>
                        </div>

                        {/* Shipping Info */}
                        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                            <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider mb-4">
                                Shipping Information
                            </h3>
                            <dl className="space-y-3">
                                {(order.customer_name) && (
                                    <div className="flex items-start gap-2">
                                        <UserIcon className="h-4 w-4 text-gray-400 mt-0.5" />
                                        <span className="text-sm text-gray-900">{order.customer_name}</span>
                                    </div>
                                )}
                                {(order.customer_phone || order.contact_phone) && (
                                    <div className="flex items-start gap-2">
                                        <PhoneIcon className="h-4 w-4 text-gray-400 mt-0.5" />
                                        <span className="text-sm text-gray-900">{order.customer_phone || order.contact_phone}</span>
                                    </div>
                                )}
                                {order.customer_email && (
                                    <div className="flex items-start gap-2">
                                        <EnvelopeIcon className="h-4 w-4 text-gray-400 mt-0.5" />
                                        <span className="text-sm text-gray-900">{order.customer_email}</span>
                                    </div>
                                )}
                                {(order.customer_address || order.delivery_address) && (
                                    <div className="flex items-start gap-2">
                                        <MapPinIcon className="h-4 w-4 text-gray-400 mt-0.5" />
                                        <span className="text-sm text-gray-900">{order.customer_address || order.delivery_address}</span>
                                    </div>
                                )}
                                {(order.division || order.district) && (
                                    <div className="flex items-start gap-2 pl-6">
                                        <span className="text-xs text-gray-500">
                                            {[order.area?.name, order.district?.name, order.division?.name].filter(Boolean).join(', ')}
                                        </span>
                                    </div>
                                )}
                            </dl>
                        </div>

                        {/* Vendor Info — hidden, vendor feature disabled */}

                        {/* Actions */}
                        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-3">
                            <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider mb-4">
                                Actions
                            </h3>

                            {order.can_be_cancelled && (
                                <button
                                    onClick={handleCancelOrder}
                                    disabled={cancelling}
                                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 border border-red-300 text-red-700 rounded-xl hover:bg-red-50 text-sm font-medium disabled:opacity-50 transition"
                                >
                                    <XCircleIcon className="h-4 w-4" />
                                    {cancelling ? 'Cancelling...' : 'Cancel Order'}
                                </button>
                            )}

                            {order.can_be_reviewed && (
                                <Link
                                    href={`/orders/${order.id}/review`}
                                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-ink to-ink text-white rounded-xl hover:shadow-lg text-sm font-medium transition"
                                >
                                    Leave a Review
                                </Link>
                            )}

                            {order.payment_status === 'pending' && order.payment_method !== 'cash' && (
                                <Link
                                    href={`/orders/${order.id}/payment`}
                                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-xl hover:shadow-lg text-sm font-medium transition"
                                >
                                    <CreditCardIcon className="h-4 w-4" />
                                    Submit Payment
                                </Link>
                            )}

                            <Link
                                href="/support/new"
                                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 text-sm font-medium transition"
                            >
                                Need Help?
                            </Link>
                        </div>

                        {/* Invoice Actions */}
                        <div className="bg-gradient-to-br from-orange-50 to-amber-50 rounded-xl shadow-sm border border-orange-100 p-6 space-y-3">
                            <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider mb-1 flex items-center gap-2">
                                <DocumentArrowDownIcon className="h-4 w-4 text-orange-500" />
                                Invoice
                            </h3>
                            <p className="text-xs text-gray-500 mb-3">Download or email your official invoice PDF.</p>

                            <button
                                onClick={handleDownloadInvoice}
                                disabled={downloadingInvoice}
                                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-xl hover:shadow-md hover:from-orange-600 hover:to-amber-600 text-sm font-semibold disabled:opacity-50 transition-all duration-200"
                            >
                                <ArrowDownTrayIcon className="h-4 w-4" />
                                {downloadingInvoice ? 'Generating...' : 'Download Invoice PDF'}
                            </button>

                            {(order.customer_email) && (
                                <button
                                    onClick={handleSendInvoiceEmail}
                                    disabled={sendingInvoice}
                                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 border border-orange-300 text-orange-700 rounded-xl hover:bg-orange-50 text-sm font-medium disabled:opacity-50 transition"
                                >
                                    <PaperAirplaneIcon className="h-4 w-4" />
                                    {sendingInvoice ? 'Sending...' : 'Email Invoice'}
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
