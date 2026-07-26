'use client';

import { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { guestCartService } from '@/lib/api';
import {
    MagnifyingGlassIcon,
    CheckCircleIcon,
    ClockIcon,
    XCircleIcon,
    TruckIcon,
    ShoppingBagIcon,
    PhoneIcon,
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
    pending: { label: 'Pending', color: 'text-amber-600 bg-amber-50 border-amber-200', icon: ClockIcon },
    accepted: { label: 'Accepted', color: 'text-blue-600 bg-blue-50 border-blue-200', icon: CheckCircleIcon },
    in_progress: { label: 'In Progress', color: 'text-indigo-600 bg-indigo-50 border-indigo-200', icon: TruckIcon },
    completed: { label: 'Completed', color: 'text-green-600 bg-green-50 border-green-200', icon: CheckCircleIcon },
    cancelled: { label: 'Cancelled', color: 'text-red-600 bg-red-50 border-red-200', icon: XCircleIcon },
};

function TrackOrderContent() {
    const searchParams = useSearchParams();
    const [orderNumber, setOrderNumber] = useState(searchParams.get('order') || '');
    const [phone, setPhone] = useState('');
    const [order, setOrder] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const [searched, setSearched] = useState(false);

    const handleTrack = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!orderNumber.trim() || !phone.trim()) {
            toast.error('Please enter both order number and phone number');
            return;
        }

        try {
            setLoading(true);
            setSearched(true);
            const result = await guestCartService.trackOrder(orderNumber.trim(), phone.trim());
            setOrder(result);
        } catch (error: any) {
            setOrder(null);
            toast.error(error?.response?.data?.message || 'Order not found');
        } finally {
            setLoading(false);
        }
    };

    const statusInfo = order ? STATUS_CONFIG[order.order_status] || STATUS_CONFIG.pending : null;
    const StatusIcon = statusInfo?.icon || ClockIcon;

    return (
        <div className="bg-gray-50 min-h-screen">
            {/* Header */}
            <div className="bg-white border-b border-gray-200">
                <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
                    <div className="flex items-center gap-3 mb-2">
                        <ShoppingBagIcon className="h-7 w-7 sm:h-8 sm:w-8 text-gray-800" />
                        <h1 className="text-2xl sm:text-2xl font-bold text-gray-900">Track Your Order</h1>
                    </div>
                    <p className="text-gray-600">Enter your order number and phone number to check the status of your order.</p>
                </div>
            </div>

            <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
                {/* Search Form */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-6">
                    <form onSubmit={handleTrack} className="space-y-4">
                        <div className="grid md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Order Number *</label>
                                <input
                                    type="text"
                                    value={orderNumber}
                                    onChange={(e) => setOrderNumber(e.target.value)}
                                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-ink focus:border-ink outline-none"
                                    placeholder="e.g. ORD-20260326-ABCDEF"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    <span className="flex items-center gap-1">
                                        <PhoneIcon className="h-4 w-4" /> Phone Number *
                                    </span>
                                </label>
                                <input
                                    type="tel"
                                    value={phone}
                                    onChange={(e) => setPhone(e.target.value)}
                                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-ink focus:border-ink outline-none"
                                    placeholder="01XXXXXXXXX"
                                />
                            </div>
                        </div>
                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full py-3 bg-gradient-to-r from-ink to-ink text-white font-semibold rounded-xl hover:shadow-lg transition-all disabled:opacity-60 flex items-center justify-center gap-2"
                        >
                            {loading ? (
                                <div className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full" />
                            ) : (
                                <>
                                    <MagnifyingGlassIcon className="h-5 w-5" />
                                    Track Order
                                </>
                            )}
                        </button>
                    </form>
                </div>

                {/* Order Details */}
                {searched && !loading && (
                    <>
                        {order ? (
                            <div className="space-y-4">
                                {/* Status Card */}
                                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                                        <div>
                                            <p className="text-sm text-gray-500">Order Number</p>
                                            <p className="text-lg sm:text-xl font-bold text-gray-900 break-all">{order.order_number}</p>
                                        </div>
                                        <span className={`flex items-center gap-2 px-4 py-2 rounded-full border text-sm font-semibold w-fit ${statusInfo?.color}`}>
                                            <StatusIcon className="h-4 w-4" />
                                            {statusInfo?.label}
                                        </span>
                                    </div>

                                    {/* Progress Bar */}
                                    <div className="mt-4">
                                        <div className="flex items-center justify-between mb-2 text-xs text-gray-500">
                                            <span>Placed</span>
                                            <span>Accepted</span>
                                            <span>In Progress</span>
                                            <span>Delivered</span>
                                        </div>
                                        <div className="h-2 bg-gray-100 rounded-full">
                                            <div
                                                className={`h-full rounded-full transition-all ${order.order_status === 'completed'
                                                        ? 'w-full bg-green-500'
                                                        : order.order_status === 'in_progress'
                                                            ? 'w-3/4 bg-indigo-500'
                                                            : order.order_status === 'accepted'
                                                                ? 'w-1/2 bg-blue-500'
                                                                : order.order_status === 'cancelled'
                                                                    ? 'w-full bg-red-500'
                                                                    : 'w-1/4 bg-amber-500'
                                                    }`}
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Order Items */}
                                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                                    <h2 className="text-lg font-bold text-gray-900 mb-4">Order Items</h2>
                                    <div className="space-y-3">
                                        {(order.items || []).map((item: any) => (
                                            <div key={item.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                                                <div>
                                                    <p className="text-sm font-medium text-gray-900">{item.item_name || item.product?.name || item.service?.name}</p>
                                                    <p className="text-xs text-gray-500">Qty: {item.quantity} × ৳{item.unit_price}</p>
                                                </div>
                                                <p className="text-sm font-semibold text-gray-900">৳{item.total_price}</p>
                                            </div>
                                        ))}
                                    </div>
                                    <div className="mt-4 pt-4 border-t border-gray-100">
                                        <div className="flex justify-between text-lg font-bold">
                                            <span>Total</span>
                                            <span>৳{order.total}</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Delivery Info */}
                                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                                    <h2 className="text-lg font-bold text-gray-900 mb-4">Delivery Information</h2>
                                    <div className="grid md:grid-cols-2 gap-4 text-sm">
                                        <div>
                                            <p className="text-gray-500 text-xs mb-1">Customer</p>
                                            <p className="font-medium text-gray-900">{order.customer_name}</p>
                                        </div>
                                        <div>
                                            <p className="text-gray-500 text-xs mb-1">Phone</p>
                                            <p className="font-medium text-gray-900">{order.customer_phone}</p>
                                        </div>
                                        <div className="md:col-span-2">
                                            <p className="text-gray-500 text-xs mb-1">Delivery Address</p>
                                            <p className="font-medium text-gray-900">
                                                {order.customer_address}
                                                {order.area?.name && `, ${order.area.name}`}
                                                {order.district?.name && `, ${order.district.name}`}
                                                {order.division?.name && `, ${order.division.name}`}
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-gray-500 text-xs mb-1">Payment Method</p>
                                            <p className="font-medium text-gray-900 capitalize">{order.payment_method?.replace('_', ' ')}</p>
                                        </div>
                                        <div>
                                            <p className="text-gray-500 text-xs mb-1">Payment Status</p>
                                            <p className={`font-medium capitalize ${order.payment_status === 'paid' ? 'text-green-600' : 'text-amber-600'}`}>
                                                {order.payment_status}
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-gray-500 text-xs mb-1">Order Placed</p>
                                            <p className="font-medium text-gray-900">
                                                {new Date(order.created_at).toLocaleDateString('en-BD', {
                                                    year: 'numeric',
                                                    month: 'long',
                                                    day: 'numeric',
                                                    hour: '2-digit',
                                                    minute: '2-digit',
                                                })}
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                <div className="text-center">
                                    <Link href="/products" className="text-gray-600 hover:text-gray-900 text-sm underline">
                                        Continue Shopping
                                    </Link>
                                </div>
                            </div>
                        ) : (
                            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center">
                                <XCircleIcon className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                                <h2 className="text-xl font-bold text-gray-900 mb-2">Order Not Found</h2>
                                <p className="text-gray-600 mb-6">
                                    We couldn't find an order with that number and phone number.
                                    Please double-check and try again.
                                </p>
                                <p className="text-sm text-gray-500">
                                    If you created an account, you can view your orders in the{' '}
                                    <Link href="/auth/login" className="text-gray-800 font-semibold underline">
                                        dashboard
                                    </Link>.
                                </p>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}

export default function TrackOrderPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="animate-spin h-10 w-10 border-4 border-ink border-t-transparent rounded-full" />
            </div>
        }>
            <TrackOrderContent />
        </Suspense>
    );
}
