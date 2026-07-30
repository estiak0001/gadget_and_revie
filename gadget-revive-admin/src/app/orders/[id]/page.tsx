'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
    ArrowLeft,
    Package,
    User,
    MapPin,
    Phone,
    Mail,
    CreditCard,
    Clock,
    CheckCircle,
    XCircle,
    RefreshCw,
    FileText,
    Store,
    Truck,
    ArrowUpCircle,
    Wallet,
    Eye,
    Plus,
    Undo2,
    DollarSign,
    History,
} from 'lucide-react';
import { AdminLayout } from '@/components/layout';
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
    Button,
    Badge,
    LoadingSpinner,
    Select,
    Input,
    Textarea,
    ErrorState,
    Modal,
    HistoryModal,
} from '@/components/ui';
import { Order, OrderItem, ExpenseCategory } from '@/types';
import { formatCurrency, formatDate, formatDateTime, getStatusColor, getErrorMessage } from '@/lib/utils';
import adminService from '@/lib/adminService';
import toast from 'react-hot-toast';
import Link from 'next/link';

const ORDER_STATUSES = [
    { value: 'pending', label: 'Pending' },
    { value: 'accepted', label: 'Accepted' },
    { value: 'confirmed', label: 'Confirmed' },
    { value: 'in_progress', label: 'In Progress' },
    { value: 'processing', label: 'Processing' },
    { value: 'awaiting_payment', label: 'Awaiting Payment' },
    { value: 'completed', label: 'Completed' },
    { value: 'cancelled', label: 'Cancelled' },
    { value: 'refunded', label: 'Refunded' },
];

function safeFormatDate(dateValue: string | null | undefined): string {
    if (!dateValue) return 'N/A';
    try {
        return formatDateTime(dateValue);
    } catch {
        return 'N/A';
    }
}

export default function OrderDetailPage() {
    const params = useParams();
    const router = useRouter();
    const orderId = Number(params.id);

    const [order, setOrder] = useState<Order | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(false);
    const [newStatus, setNewStatus] = useState('');
    const [adminNotes, setAdminNotes] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [downloadingInvoice, setDownloadingInvoice] = useState(false);
    const [previewingInvoice, setPreviewingInvoice] = useState(false);
    const [sendingInvoice, setSendingInvoice] = useState(false);
    const [isSyncingLedger, setIsSyncingLedger] = useState(false);
    const [isHistoryOpen, setIsHistoryOpen] = useState(false);

    const [isRecordPaymentOpen, setIsRecordPaymentOpen] = useState(false);
    const [recordPaymentAmount, setRecordPaymentAmount] = useState('');
    const [isRecordingPayment, setIsRecordingPayment] = useState(false);

    const [isReturnOpen, setIsReturnOpen] = useState(false);
    const [returnAmount, setReturnAmount] = useState('');
    const [returnReason, setReturnReason] = useState('');
    const [isProcessingReturn, setIsProcessingReturn] = useState(false);

    // Costs — money spent fulfilling a line item (outsourced repair, parts bought, etc.),
    // tracked as real Expense records linked back to that order item.
    const [isCostModalOpen, setIsCostModalOpen] = useState(false);
    const [costItem, setCostItem] = useState<OrderItem | null>(null);
    const [costCategories, setCostCategories] = useState<ExpenseCategory[]>([]);
    const [costForm, setCostForm] = useState({ expense_category_id: '', title: '', amount: '', expense_date: '', description: '' });
    const [isSavingCost, setIsSavingCost] = useState(false);
    const [reversingCostId, setReversingCostId] = useState<number | null>(null);

    const fetchOrder = async () => {
        setIsLoading(true);
        setError(false);
        try {
            const response = await adminService.getOrder(orderId);
            const orderData = response.data?.data || response.data;
            setOrder(orderData);
            setNewStatus(orderData.status || orderData.order_status || 'pending');
        } catch (err) {
            console.error('Error fetching order:', err);
            toast.error(getErrorMessage(err));
            setError(true);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (orderId) fetchOrder();
    }, [orderId]);

    const handleSyncLedger = async () => {
        if (!order) return;
        setIsSyncingLedger(true);
        try {
            await adminService.processOrderSync(order.id);
            toast.success('Order synced to the ledger.');
            fetchOrder();
        } catch (err) {
            toast.error(getErrorMessage(err));
        } finally {
            setIsSyncingLedger(false);
        }
    };

    const openRecordPayment = () => {
        if (!order) return;
        setRecordPaymentAmount(order.outstanding_receivable ? String(order.outstanding_receivable) : '');
        setIsRecordPaymentOpen(true);
    };

    const handleRecordPayment = async () => {
        if (!order) return;
        const amount = parseFloat(recordPaymentAmount);
        if (!amount || amount <= 0) {
            toast.error('Enter a valid amount');
            return;
        }
        if (amount > (order.outstanding_receivable ?? 0)) {
            toast.error(`Amount cannot exceed the outstanding balance of ${formatCurrency(order.outstanding_receivable ?? 0)}`);
            return;
        }

        setIsRecordingPayment(true);
        try {
            await adminService.recordOrderPayment(order.id, amount);
            toast.success('Payment recorded.');
            setIsRecordPaymentOpen(false);
            fetchOrder();
        } catch (err) {
            toast.error(getErrorMessage(err));
        } finally {
            setIsRecordingPayment(false);
        }
    };

    const openReturn = () => {
        if (!order) return;
        setReturnAmount(order.paid_amount ? String(order.paid_amount) : '');
        setReturnReason('');
        setIsReturnOpen(true);
    };

    const handleProcessReturn = async () => {
        if (!order) return;
        if (!returnReason.trim()) {
            toast.error('Enter a reason for the return');
            return;
        }
        const amount = parseFloat(returnAmount);
        if (!amount || amount <= 0) {
            toast.error('Enter a valid refund amount');
            return;
        }
        if (amount > (order.paid_amount ?? 0)) {
            toast.error(`Refund cannot exceed the amount actually paid (${formatCurrency(order.paid_amount ?? 0)})`);
            return;
        }

        setIsProcessingReturn(true);
        try {
            await adminService.refundOrder(order.id, { reason: returnReason.trim(), refund_amount: amount });
            toast.success('Return processed — order refunded and stock restored.');
            setIsReturnOpen(false);
            fetchOrder();
        } catch (err) {
            toast.error(getErrorMessage(err));
        } finally {
            setIsProcessingReturn(false);
        }
    };

    const openCostModal = async (item: OrderItem) => {
        setCostItem(item);
        setCostForm({
            expense_category_id: '',
            title: `Cost: ${item.item_name}`,
            amount: '',
            expense_date: new Date().toISOString().split('T')[0],
            description: '',
        });
        setIsCostModalOpen(true);
        if (costCategories.length === 0) {
            try {
                const res = await adminService.getExpenseCategories({ active_only: true });
                const payload = res.data?.data as unknown;
                const list = Array.isArray(payload) ? payload : (payload as { data?: ExpenseCategory[] })?.data;
                setCostCategories(Array.isArray(list) ? (list as ExpenseCategory[]) : []);
            } catch {
                // silent — category dropdown just won't populate
            }
        }
    };

    const handleAddCost = async () => {
        if (!costItem) return;
        if (!costForm.expense_category_id) {
            toast.error('Select a category');
            return;
        }
        if (!costForm.title.trim()) {
            toast.error('Enter a title');
            return;
        }
        const amount = parseFloat(costForm.amount);
        if (!amount || amount <= 0) {
            toast.error('Enter a valid amount');
            return;
        }

        setIsSavingCost(true);
        try {
            await adminService.createExpense({
                expense_category_id: Number(costForm.expense_category_id),
                order_item_id: costItem.id,
                title: costForm.title.trim(),
                amount,
                expense_date: costForm.expense_date,
                description: costForm.description.trim() || null,
            });
            toast.success('Cost recorded and posted to the ledger.');
            setCostForm((f) => ({ ...f, title: `Cost: ${costItem.item_name}`, amount: '', description: '' }));
            const response = await adminService.getOrder(orderId);
            const orderData = response.data?.data || response.data;
            setOrder(orderData);
            // Keep the modal's selected item in sync with the freshly-fetched order data
            const refreshed = orderData.items?.find((i: OrderItem) => i.id === costItem.id);
            if (refreshed) setCostItem(refreshed);
        } catch (err) {
            toast.error(getErrorMessage(err));
        } finally {
            setIsSavingCost(false);
        }
    };

    const handleReverseCost = async (costId: number) => {
        if (!costItem) return;
        setReversingCostId(costId);
        try {
            await adminService.deleteExpense(costId);
            toast.success('Cost reversed.');
            const response = await adminService.getOrder(orderId);
            const orderData = response.data?.data || response.data;
            setOrder(orderData);
            const refreshed = orderData.items?.find((i: OrderItem) => i.id === costItem.id);
            if (refreshed) setCostItem(refreshed);
        } catch (err) {
            toast.error(getErrorMessage(err));
        } finally {
            setReversingCostId(null);
        }
    };

    const handleStatusUpdate = async () => {
        if (!order) return;
        setIsSaving(true);
        try {
            await adminService.updateOrderStatus(order.id, {
                order_status: newStatus,
                note: adminNotes.trim() || undefined,
            });
            toast.success('Order status updated');
            setAdminNotes('');
            fetchOrder();
        } catch (err) {
            toast.error(getErrorMessage(err));
        } finally {
            setIsSaving(false);
        }
    };

    const handleDownloadInvoice = async () => {
        if (!order) return;
        setDownloadingInvoice(true);
        try {
            const response = await adminService.downloadInvoice(order.id);
            const blob = new Blob([response.data as BlobPart], { type: 'application/pdf' });
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `Invoice-${order.order_number}.pdf`;
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);
            toast.success('Invoice downloaded!');
        } catch (err) {
            toast.error(getErrorMessage(err));
        } finally {
            setDownloadingInvoice(false);
        }
    };

    // Opens the PDF in a new tab via a blob URL (rather than navigating to the
    // authenticated API route directly, which the browser would hit without
    // the Bearer token and get a 401).
    //
    // The tab must be opened synchronously, in direct response to the click —
    // if we wait for the `await` below to resolve first, the browser no longer
    // considers it a user-initiated action and blocks the popup. So we open a
    // blank tab immediately and fill it in once the PDF is ready.
    //
    // Navigating the tab's location straight to a blob: URL of type
    // application/pdf triggers a download in some browsers instead of the
    // inline viewer, so instead we write a minimal HTML page into the tab with
    // an <embed> pointing at the blob — that reliably renders the browser's
    // native PDF viewer (with its own Print/Save controls) rather than
    // downloading.
    const handlePreviewInvoice = async () => {
        if (!order) return;
        const newTab = window.open('', '_blank');
        setPreviewingInvoice(true);
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
            // Revoke well after the new tab has had time to load the blob.
            setTimeout(() => window.URL.revokeObjectURL(url), 60_000);
        } catch (err) {
            newTab?.close();
            toast.error(getErrorMessage(err));
        } finally {
            setPreviewingInvoice(false);
        }
    };

    const handleSendInvoiceEmail = async () => {
        if (!order) return;
        setSendingInvoice(true);
        try {
            await adminService.sendInvoiceEmail(order.id);
            toast.success('Invoice emailed to customer!');
        } catch (err) {
            toast.error(getErrorMessage(err));
        } finally {
            setSendingInvoice(false);
        }
    };

    if (error && !order) {
        return (
            <AdminLayout>
                <ErrorState
                    title="Failed to load order"
                    message="Could not fetch order details."
                    onRetry={fetchOrder}
                />
            </AdminLayout>
        );
    }

    return (
        <AdminLayout>
            {/* Header */}
            <div className="page-header">
                <div className="flex items-center gap-4 mb-2">
                    <Button variant="ghost" size="sm" onClick={() => router.push('/orders')}>
                        <ArrowLeft className="w-4 h-4 mr-1" />
                        Back to Orders
                    </Button>
                </div>
                {!isLoading && order && (
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                        <div>
                            <h1 className="page-title">Order {order.order_number}</h1>
                            <p className="page-description">
                                Placed on {safeFormatDate(order.created_at)}
                            </p>
                        </div>
                        <div className="flex items-center gap-3">
                            <Badge variant={
                                ['completed'].includes(order.status || order.order_status || '') ? 'success' :
                                    ['cancelled', 'rejected', 'refunded'].includes(order.status || order.order_status || '') ? 'danger' :
                                        ['pending', 'awaiting_payment'].includes(order.status || order.order_status || '') ? 'warning' : 'default'
                            }>
                                {(order.status || order.order_status || 'N/A').replace('_', ' ')}
                            </Badge>
                            <Badge variant={
                                order.payment_status === 'paid' ? 'success' :
                                    order.payment_status === 'failed' ? 'danger' :
                                        order.payment_status === 'partially_paid' || order.payment_status === 'pending' || order.payment_status === 'awaiting_confirmation' ? 'warning' : 'default'
                            }>
                                Payment: {(order.payment_status || 'N/A').replace('_', ' ')}
                            </Badge>
                            <Button variant="ghost" size="sm" onClick={() => setIsHistoryOpen(true)} title="View History">
                                <History className="w-4 h-4" />
                            </Button>
                            {order.can_be_edited && (
                                <Link href={`/orders/${order.id}/edit`}>
                                    <Button variant="outline" size="sm">Edit Order</Button>
                                </Link>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {isLoading ? (
                <div className="flex items-center justify-center py-16">
                    <LoadingSpinner size="lg" text="Loading order details..." />
                </div>
            ) : order ? (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Main Content */}
                    <div className="lg:col-span-2 space-y-6">
                        {/* Order Items */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Package className="w-5 h-5" />
                                    Order Items
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="p-0">
                                {order.items && order.items.length > 0 ? (
                                    <>
                                        <div className="overflow-x-auto">
                                        <table className="w-full">
                                            <thead className="bg-gray-50 border-y">
                                                <tr>
                                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Item</th>
                                                    <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase">Qty</th>
                                                    <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase">Price</th>
                                                    <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase">Total</th>
                                                    <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase">Cost / Margin</th>
                                                    <th className="pl-2 pr-4 py-3"></th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-200">
                                                {order.items.map((item) => {
                                                    const totalCost = item.total_cost ?? 0;
                                                    const margin = item.margin ?? ((item.total_price ?? item.total ?? 0) - totalCost);
                                                    return (
                                                    <tr key={item.id} className="hover:bg-gray-50">
                                                        <td className="px-4 py-4">
                                                            <p className="font-medium text-gray-900">{item.item_name || item.name}</p>
                                                            <div className="flex items-center gap-1.5 mt-0.5">
                                                                <Badge variant="default" className="text-[10px]">{item.item_type}</Badge>
                                                                {item.item_sku && <p className="text-xs text-gray-400">{item.item_sku}</p>}
                                                            </div>
                                                        </td>
                                                        <td className="px-3 py-4 text-right text-gray-600 whitespace-nowrap">{item.quantity}</td>
                                                        <td className="px-3 py-4 text-right text-gray-600 whitespace-nowrap">{formatCurrency(item.unit_price ?? item.price ?? 0)}</td>
                                                        <td className="px-3 py-4 text-right font-semibold whitespace-nowrap">{formatCurrency(item.total_price ?? item.total ?? 0)}</td>
                                                        <td className="px-3 py-4 text-right whitespace-nowrap">
                                                            {totalCost > 0 ? (
                                                                <>
                                                                    <p className="text-xs text-gray-500">Cost {formatCurrency(totalCost)}</p>
                                                                    <p className={`text-sm font-medium ${margin >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                                                        {formatCurrency(margin)}
                                                                    </p>
                                                                </>
                                                            ) : (
                                                                <span className="text-gray-300 text-sm">—</span>
                                                            )}
                                                        </td>
                                                        <td className="pl-2 pr-4 py-4 text-right">
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                onClick={() => openCostModal(item)}
                                                                title="Manage costs for this item"
                                                            >
                                                                <DollarSign className="w-4 h-4" />
                                                            </Button>
                                                        </td>
                                                    </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                        </div>

                                        {/* Pricing Summary */}
                                        <div className="px-6 py-4 bg-gray-50 space-y-2">
                                            <div className="flex justify-between text-sm text-gray-600">
                                                <span>Subtotal</span>
                                                <span>{formatCurrency(order.subtotal)}</span>
                                            </div>
                                            {(order.shipping ?? order.delivery_charge ?? 0) > 0 && (
                                                <div className="flex justify-between text-sm text-gray-600">
                                                    <span>Shipping</span>
                                                    <span>{formatCurrency(order.shipping ?? order.delivery_charge ?? 0)}</span>
                                                </div>
                                            )}
                                            {(order.tax ?? 0) > 0 && (
                                                <div className="flex justify-between text-sm text-gray-600">
                                                    <span>Tax</span>
                                                    <span>{formatCurrency(order.tax ?? 0)}</span>
                                                </div>
                                            )}
                                            {(order.discount ?? 0) > 0 && (
                                                <div className="flex justify-between text-sm text-gray-600">
                                                    <span>Discount</span>
                                                    <span>-{formatCurrency(order.discount ?? 0)}</span>
                                                </div>
                                            )}
                                            <div className="flex justify-between font-bold text-lg border-t pt-2">
                                                <span>Total</span>
                                                <span>{formatCurrency(order.total)}</span>
                                            </div>
                                            {(() => {
                                                const totalCost = order.items.reduce((sum, i) => sum + (i.total_cost ?? 0), 0);
                                                if (totalCost <= 0) return null;
                                                const netProfit = order.total - totalCost;
                                                return (
                                                    <>
                                                        <div className="flex justify-between text-sm text-gray-600 border-t pt-2">
                                                            <span>Total Cost</span>
                                                            <span>-{formatCurrency(totalCost)}</span>
                                                        </div>
                                                        <div className="flex justify-between font-bold">
                                                            <span>Net Profit</span>
                                                            <span className={netProfit >= 0 ? 'text-green-600' : 'text-red-600'}>
                                                                {formatCurrency(netProfit)}
                                                            </span>
                                                        </div>
                                                    </>
                                                );
                                            })()}
                                        </div>
                                    </>
                                ) : (
                                    <div className="px-6 py-8 text-center text-gray-500">No items in this order</div>
                                )}
                            </CardContent>
                        </Card>

                        {/* Cost Breakdown — every individual cost recorded across all items on
                            this order, so revenue vs. cost is fully auditable in one place. */}
                        {(order.items ?? []).some((i) => (i.costs?.length ?? 0) > 0) && (
                            <Card>
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2">
                                        <DollarSign className="w-5 h-5" />
                                        Cost Breakdown
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="p-0">
                                    <div className="overflow-x-auto">
                                        <table className="w-full">
                                            <thead className="bg-gray-50 border-y">
                                                <tr>
                                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Item</th>
                                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Cost</th>
                                                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Amount</th>
                                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                                                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Status</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-200">
                                                {(order.items ?? []).flatMap((item) =>
                                                    (item.costs ?? []).map((cost) => (
                                                        <tr key={cost.id} className="hover:bg-gray-50">
                                                            <td className="px-6 py-3 text-gray-900">{item.item_name || item.name}</td>
                                                            <td className="px-6 py-3 text-gray-600">{cost.title}</td>
                                                            <td className="px-6 py-3 text-right font-medium text-gray-900">{formatCurrency(cost.amount)}</td>
                                                            <td className="px-6 py-3 text-gray-500">{formatDate(cost.expense_date)}</td>
                                                            <td className="px-6 py-3 text-center">
                                                                {cost.is_reversed ? (
                                                                    <Badge variant="warning">Reversed</Badge>
                                                                ) : (
                                                                    <Badge variant="success">Active</Badge>
                                                                )}
                                                            </td>
                                                        </tr>
                                                    ))
                                                )}
                                            </tbody>
                                            <tfoot>
                                                <tr className="border-t bg-gray-50">
                                                    <td colSpan={2} className="px-6 py-3 font-semibold text-gray-900">Total Cost (active)</td>
                                                    <td className="px-6 py-3 text-right font-bold text-gray-900">
                                                        {formatCurrency((order.items ?? []).reduce((sum, i) => sum + (i.total_cost ?? 0), 0))}
                                                    </td>
                                                    <td colSpan={2} />
                                                </tr>
                                            </tfoot>
                                        </table>
                                    </div>
                                </CardContent>
                            </Card>
                        )}

                        {/* Update Status */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <RefreshCw className="w-5 h-5" />
                                    Update Order Status
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-4">
                                    <div className="bg-gray-50 p-3 rounded-lg">
                                        <p className="text-sm text-gray-600">
                                            Current Status: <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${getStatusColor(order.status || order.order_status || 'pending')}`}>
                                                {(order.status || order.order_status || 'N/A').replace('_', ' ')}
                                            </span>
                                        </p>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">New Status</label>
                                        <Select
                                            options={ORDER_STATUSES.map(s => ({ value: s.value, label: s.label }))}
                                            value={newStatus}
                                            onChange={(e) => setNewStatus(e.target.value)}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Admin Notes (Optional)</label>
                                        <Textarea
                                            value={adminNotes}
                                            onChange={(e) => setAdminNotes(e.target.value)}
                                            placeholder="Add notes about this status change..."
                                            rows={3}
                                        />
                                    </div>
                                    <Button onClick={handleStatusUpdate} isLoading={isSaving} className="w-full">
                                        Update Status
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Notes Section */}
                        {(order.customer_notes || order.admin_notes) && (
                            <Card>
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2">
                                        <FileText className="w-5 h-5" />
                                        Notes
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="space-y-4">
                                        {order.customer_notes && (
                                            <div>
                                                <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Customer Notes</p>
                                                <p className="text-sm text-gray-700 bg-gray-50 rounded-lg p-3 whitespace-pre-wrap">{order.customer_notes}</p>
                                            </div>
                                        )}
                                        {order.admin_notes && (
                                            <div>
                                                <p className="text-xs font-medium text-orange-600 uppercase tracking-wider mb-1">Admin Notes</p>
                                                <p className="text-sm text-gray-700 bg-orange-50 rounded-lg p-3 whitespace-pre-wrap">{order.admin_notes}</p>
                                            </div>
                                        )}
                                    </div>
                                </CardContent>
                            </Card>
                        )}
                    </div>

                    {/* Sidebar */}
                    <div className="space-y-6">
                        {/* Payment Status */}
                        {Number(order.paid_amount ?? 0) > 0 || order.payment_status === 'partially_paid' ? (
                            <Card>
                                <CardHeader>
                                    <CardTitle className="text-sm flex items-center gap-2">
                                        <CreditCard className="w-4 h-4" />
                                        Payment Status
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <dl className="space-y-2 text-sm">
                                        <div className="flex justify-between">
                                            <dt className="text-gray-500">Order Total</dt>
                                            <dd className="font-medium">{formatCurrency(order.total)}</dd>
                                        </div>
                                        <div className="flex justify-between">
                                            <dt className="text-gray-500">Paid by Customer</dt>
                                            <dd className="font-medium text-green-600">{formatCurrency(Number(order.paid_amount ?? 0))}</dd>
                                        </div>
                                        <div className="flex justify-between border-t pt-2">
                                            <dt className="text-gray-500">
                                                {Number(order.outstanding_receivable ?? 0) < 0 ? 'Refund Owed' : 'Outstanding'}
                                            </dt>
                                            <dd className={`font-bold ${
                                                Number(order.outstanding_receivable ?? 0) > 0
                                                    ? 'text-amber-600'
                                                    : Number(order.outstanding_receivable ?? 0) < 0
                                                        ? 'text-red-600'
                                                        : 'text-green-600'
                                            }`}>
                                                {formatCurrency(Math.abs(Number(order.outstanding_receivable ?? 0)))}
                                            </dd>
                                        </div>
                                        {Number(order.outstanding_receivable ?? 0) < 0 && (
                                            <p className="text-xs text-red-600 bg-red-50 rounded-md px-2 py-1.5">
                                                This order was amended to a lower total after payment — the customer has
                                                paid more than the current total and is owed a refund.
                                            </p>
                                        )}
                                    </dl>
                                </CardContent>
                            </Card>
                        ) : null}

                        {/* Order Info */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-sm">Order Details</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <dl className="space-y-4">
                                    <div>
                                        <dt className="text-xs text-gray-500">Order Number</dt>
                                        <dd className="text-sm font-medium">{order.order_number}</dd>
                                    </div>
                                    <div>
                                        <dt className="text-xs text-gray-500">Payment Method</dt>
                                        <dd className="text-sm font-medium flex items-center gap-1.5">
                                            <CreditCard className="w-4 h-4 text-gray-400" />
                                            {(order.payment_method || 'N/A').toUpperCase()}
                                        </dd>
                                    </div>
                                    <div>
                                        <dt className="text-xs text-gray-500">Order Date</dt>
                                        <dd className="text-sm">{safeFormatDate(order.created_at)}</dd>
                                    </div>
                                    <div>
                                        <dt className="text-xs text-gray-500">Last Updated</dt>
                                        <dd className="text-sm">{safeFormatDate(order.updated_at)}</dd>
                                    </div>
                                </dl>
                            </CardContent>
                        </Card>

                        {/* Linked Service Intake */}
                        {order.service_intake && (
                            <Card>
                                <CardHeader>
                                    <CardTitle className="text-sm flex items-center gap-2">
                                        <FileText className="w-4 h-4" />
                                        Service Intake
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <dl className="space-y-3">
                                        <div>
                                            <dt className="text-xs text-gray-500">Receipt Number</dt>
                                            <dd className="text-sm font-mono font-medium">{order.service_intake.receipt_number}</dd>
                                        </div>
                                        <div>
                                            <dt className="text-xs text-gray-500">Intake Status</dt>
                                            <dd className="text-sm capitalize">{order.service_intake.status.replace(/_/g, ' ')}</dd>
                                        </div>
                                        <a href="/service-intakes" className="inline-block text-sm font-medium text-blue-600 hover:underline">
                                            Open in Service Intakes →
                                        </a>
                                    </dl>
                                </CardContent>
                            </Card>
                        )}

                        {/* Customer Info */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-sm flex items-center gap-2">
                                    <User className="w-4 h-4" />
                                    Customer
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <dl className="space-y-3">
                                    <div className="flex items-center gap-2">
                                        <User className="w-4 h-4 text-gray-400" />
                                        <span className="text-sm">{order.customer_name || order.customer?.name}</span>
                                    </div>
                                    {(order.customer_email || order.customer?.email) && (
                                        <div className="flex items-center gap-2">
                                            <Mail className="w-4 h-4 text-gray-400" />
                                            <span className="text-sm text-gray-600">{order.customer_email || order.customer?.email}</span>
                                        </div>
                                    )}
                                    {(order.customer_phone || order.customer?.phone) && (
                                        <div className="flex items-center gap-2">
                                            <Phone className="w-4 h-4 text-gray-400" />
                                            <span className="text-sm text-gray-600">{order.customer_phone || order.customer?.phone}</span>
                                        </div>
                                    )}
                                    {(order.customer_address || order.delivery_address) && (
                                        <div className="flex items-start gap-2 pt-2 border-t">
                                            <MapPin className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                                            <div className="text-sm text-gray-600">
                                                <p>{order.customer_address || order.delivery_address}</p>
                                                {(order.area || order.district || order.division) && (
                                                    <p className="text-xs text-gray-400 mt-0.5">
                                                        {[order.area?.name, order.district?.name, order.division?.name].filter(Boolean).join(', ')}
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </dl>
                            </CardContent>
                        </Card>

                        {/* Vendor Info */}
                        {order.vendor && (
                            <Card>
                                <CardHeader>
                                    <CardTitle className="text-sm flex items-center gap-2">
                                        <Store className="w-4 h-4" />
                                        Vendor
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <p className="text-sm font-medium">{order.vendor.business_name}</p>
                                    {order.vendor.owner_name && (
                                        <p className="text-xs text-gray-500 mt-1">Owner: {order.vendor.owner_name}</p>
                                    )}
                                </CardContent>
                            </Card>
                        )}

                        {/* Quick Actions */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-sm">Quick Actions</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-2">
                                    <Link href="/orders" className="block">
                                        <Button variant="outline" className="w-full justify-start">
                                            <Package className="w-4 h-4 mr-2" />
                                            All Orders
                                        </Button>
                                    </Link>
                                    {order.customer && (
                                        <Link href={`/users`} className="block">
                                            <Button variant="outline" className="w-full justify-start">
                                                <User className="w-4 h-4 mr-2" />
                                                View Customer
                                            </Button>
                                        </Link>
                                    )}
                                    {(order.outstanding_receivable ?? 0) > 0 && !['cancelled', 'refunded', 'rejected'].includes(order.order_status) && (
                                        <Button onClick={openRecordPayment} className="w-full justify-start bg-blue-600 hover:bg-blue-700">
                                            <Wallet className="w-4 h-4 mr-2" />
                                            Record Payment
                                        </Button>
                                    )}
                                    {order.payment_status === 'paid' && order.is_payment_ledger_synced === false && (
                                        <Button
                                            onClick={handleSyncLedger}
                                            isLoading={isSyncingLedger}
                                            className="w-full justify-start bg-amber-500 hover:bg-amber-600 text-white"
                                        >
                                            <ArrowUpCircle className="w-4 h-4 mr-2" />
                                            Sync to Ledger
                                        </Button>
                                    )}
                                    {Number(order.paid_amount ?? 0) > 0 && !['cancelled', 'refunded', 'rejected'].includes(order.order_status) && (
                                        <Button onClick={openReturn} variant="outline" className="w-full justify-start border-red-300 text-red-700 hover:bg-red-50">
                                            <RefreshCw className="w-4 h-4 mr-2" />
                                            Process Return
                                        </Button>
                                    )}
                                </div>
                            </CardContent>
                        </Card>

                        {/* Invoice Card */}
                        <Card className="border-orange-200 bg-gradient-to-br from-orange-50 to-amber-50">
                            <CardHeader>
                                <CardTitle className="text-sm flex items-center gap-2 text-orange-800">
                                    <FileText className="w-4 h-4 text-orange-500" />
                                    Invoice
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <p className="text-xs text-orange-700 mb-3">Generate and share the official invoice for this order.</p>
                                <div className="space-y-2">
                                    <Button
                                        variant="outline"
                                        onClick={handlePreviewInvoice}
                                        isLoading={previewingInvoice}
                                        className="w-full justify-start border-orange-300 text-orange-700 hover:bg-orange-50"
                                    >
                                        <Eye className="w-4 h-4 mr-2" />
                                        {previewingInvoice ? 'Opening…' : 'Preview & Print Invoice'}
                                    </Button>
                                    <Button
                                        onClick={handleDownloadInvoice}
                                        isLoading={downloadingInvoice}
                                        className="w-full bg-orange-500 hover:bg-orange-600 text-white justify-start"
                                    >
                                        <FileText className="w-4 h-4 mr-2" />
                                        {downloadingInvoice ? 'Generating PDF...' : 'Download Invoice PDF'}
                                    </Button>
                                    {(order.customer_email || order.customer?.email) && (
                                        <Button
                                            variant="outline"
                                            onClick={handleSendInvoiceEmail}
                                            isLoading={sendingInvoice}
                                            className="w-full justify-start border-orange-300 text-orange-700 hover:bg-orange-50"
                                        >
                                            <Mail className="w-4 h-4 mr-2" />
                                            {sendingInvoice ? 'Sending...' : 'Email Invoice to Customer'}
                                        </Button>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            ) : null}

            {/* Record Payment Modal */}
            <Modal isOpen={isRecordPaymentOpen} onClose={() => setIsRecordPaymentOpen(false)} title="Record Payment" size="sm">
                <div className="space-y-4">
                    <p className="text-sm text-gray-600">
                        Outstanding balance: <span className="font-semibold text-gray-900">{formatCurrency(order?.outstanding_receivable ?? 0)}</span>
                    </p>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Amount received</label>
                        <input
                            type="number"
                            min={0.01}
                            max={order?.outstanding_receivable ?? 0}
                            step="0.01"
                            value={recordPaymentAmount}
                            onChange={(e) => setRecordPaymentAmount(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                        />
                        <p className="text-xs text-gray-400 mt-1">
                            Enter less than the full outstanding amount to record a partial payment — the order will be marked &quot;partially paid&quot; until the rest comes in.
                        </p>
                    </div>
                    <div className="flex justify-end gap-2 pt-2">
                        <Button variant="ghost" onClick={() => setIsRecordPaymentOpen(false)}>Cancel</Button>
                        <Button onClick={handleRecordPayment} isLoading={isRecordingPayment}>Confirm Payment</Button>
                    </div>
                </div>
            </Modal>

            {/* Process Return Modal */}
            <Modal isOpen={isReturnOpen} onClose={() => setIsReturnOpen(false)} title="Process Return" size="sm">
                <div className="space-y-4">
                    <p className="text-sm text-gray-600">
                        This reverses the recognized revenue for this order, refunds the amount below, and restores stock for every product line item. Order and payment status will both be set to &quot;Refunded&quot;.
                    </p>
                    <p className="text-sm text-gray-600">
                        Amount paid: <span className="font-semibold text-gray-900">{formatCurrency(order?.paid_amount ?? 0)}</span>
                    </p>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Refund amount</label>
                        <input
                            type="number"
                            min={0.01}
                            max={order?.paid_amount ?? 0}
                            step="0.01"
                            value={returnAmount}
                            onChange={(e) => setReturnAmount(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Reason *</label>
                        <textarea
                            value={returnReason}
                            onChange={(e) => setReturnReason(e.target.value)}
                            rows={3}
                            placeholder="Why is this order being returned?"
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
                        />
                    </div>
                    <div className="flex justify-end gap-2 pt-2">
                        <Button variant="ghost" onClick={() => setIsReturnOpen(false)}>Cancel</Button>
                        <Button variant="danger" onClick={handleProcessReturn} isLoading={isProcessingReturn}>Process Return</Button>
                    </div>
                </div>
            </Modal>

            {/* Costs Modal — money spent fulfilling this line item (outsourced repair, parts
                bought, etc.). Each cost is a real Expense record posted to Cost of Goods Sold,
                so it shows up in Expenses too and can be reversed the same way any expense is. */}
            <Modal isOpen={isCostModalOpen} onClose={() => setIsCostModalOpen(false)} title="Costs" size="md">
                {costItem && (
                    <div className="space-y-4">
                        <div className="rounded-lg bg-gray-50 p-3 text-sm">
                            <p className="font-medium text-gray-900">{costItem.item_name}</p>
                            <div className="flex items-center gap-4 mt-1 text-xs text-gray-500">
                                <span>Revenue: <span className="font-semibold text-gray-700">{formatCurrency(costItem.total_price ?? costItem.total ?? 0)}</span></span>
                                <span>Total cost: <span className="font-semibold text-gray-700">{formatCurrency(costItem.total_cost ?? 0)}</span></span>
                                <span>
                                    Margin:{' '}
                                    <span className={`font-semibold ${(costItem.margin ?? 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                        {formatCurrency(costItem.margin ?? (costItem.total_price ?? 0))}
                                    </span>
                                </span>
                            </div>
                        </div>

                        {costItem.costs && costItem.costs.length > 0 && (
                            <div className="space-y-2 max-h-48 overflow-y-auto">
                                {costItem.costs.map((cost) => (
                                    <div key={cost.id} className="flex items-center justify-between rounded-lg border border-gray-200 px-3 py-2">
                                        <div className="min-w-0">
                                            <p className="text-sm font-medium text-gray-900 truncate">{cost.title}</p>
                                            <p className="text-xs text-gray-500">{formatDate(cost.expense_date)}</p>
                                        </div>
                                        <div className="flex items-center gap-2 flex-shrink-0">
                                            <span className="text-sm font-semibold text-gray-700">{formatCurrency(cost.amount)}</span>
                                            {cost.is_reversed ? (
                                                <Badge variant="warning" className="inline-flex items-center gap-1">
                                                    <Undo2 className="w-3 h-3" /> Reversed
                                                </Badge>
                                            ) : (
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => handleReverseCost(cost.id)}
                                                    isLoading={reversingCostId === cost.id}
                                                    className="text-red-500 hover:text-red-700 hover:bg-red-50"
                                                >
                                                    Reverse
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        <div className="border-t border-gray-200 pt-4 space-y-3">
                            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Add a cost</p>
                            <Select
                                label="Category *"
                                value={costForm.expense_category_id}
                                onChange={(e) => setCostForm((f) => ({ ...f, expense_category_id: e.target.value }))}
                                options={[
                                    { value: '', label: 'Select category…' },
                                    ...costCategories.map((c) => ({ value: String(c.id), label: c.name })),
                                ]}
                            />
                            <Input
                                label="Title *"
                                value={costForm.title}
                                onChange={(e) => setCostForm((f) => ({ ...f, title: e.target.value }))}
                                placeholder="e.g. Outsourced motherboard repair"
                            />
                            <div className="grid grid-cols-2 gap-3">
                                <Input
                                    label="Amount (BDT) *"
                                    type="number"
                                    min="0.01"
                                    step="0.01"
                                    value={costForm.amount}
                                    onChange={(e) => setCostForm((f) => ({ ...f, amount: e.target.value }))}
                                    placeholder="0.00"
                                />
                                <Input
                                    label="Date *"
                                    type="date"
                                    value={costForm.expense_date}
                                    onChange={(e) => setCostForm((f) => ({ ...f, expense_date: e.target.value }))}
                                />
                            </div>
                            <Textarea
                                label="Description"
                                value={costForm.description}
                                onChange={(e) => setCostForm((f) => ({ ...f, description: e.target.value }))}
                                rows={2}
                                placeholder="Optional — e.g. which shop, part sourced from"
                            />
                            <div className="flex justify-end gap-2">
                                <Button variant="ghost" onClick={() => setIsCostModalOpen(false)}>Close</Button>
                                <Button onClick={handleAddCost} isLoading={isSavingCost} leftIcon={<Plus className="w-4 h-4" />}>
                                    Add Cost
                                </Button>
                            </div>
                        </div>
                    </div>
                )}
            </Modal>

            {order && (
                <HistoryModal
                    isOpen={isHistoryOpen}
                    onClose={() => setIsHistoryOpen(false)}
                    resourceType="Order"
                    resourceId={order.id}
                    resourceLabel={`Order #${order.order_number}`}
                    createdBy={order.creator}
                    createdAt={order.created_at}
                    updatedAt={order.updated_at}
                />
            )}
        </AdminLayout>
    );
}
