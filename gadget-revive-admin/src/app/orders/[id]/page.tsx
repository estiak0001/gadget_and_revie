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
    Edit3,
    Receipt,
    ClipboardList,
    Download,
    MessageSquare,
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
    ConfirmModal,
} from '@/components/ui';
import { Order, OrderItem, ExpenseCategory, CustomInvoice } from '@/types';
import { formatCurrency, formatDate, formatDateTime, getStatusColor, getErrorMessage } from '@/lib/utils';
import adminService from '@/lib/adminService';
import { useAuthStore } from '@/store/auth';
import toast from 'react-hot-toast';
import Link from 'next/link';

type SmsKind = 'status' | 'delivered' | 'due' | 'custom_invoice';

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

    const currentUser = useAuthStore((s) => s.user);
    const isSuperAdmin = currentUser?.role === 'super_admin';
    // The backend already accepts these granular permissions as an alternative to super_admin
    // for amending a paid order / correcting its payment / issuing a custom invoice — this mirrors
    // that on the frontend so a custom role granted just the permission actually sees the button,
    // instead of only ever showing it to literal super_admins.
    const hasPermission = (perm: string) => isSuperAdmin || !!currentUser?.permissions?.includes(perm);

    const [order, setOrder] = useState<Order | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(false);
    const [newStatus, setNewStatus] = useState('');
    const [showStatusConfirm, setShowStatusConfirm] = useState(false);
    const [adminNotes, setAdminNotes] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [downloadingInvoice, setDownloadingInvoice] = useState(false);
    const [previewingInvoice, setPreviewingInvoice] = useState(false);
    const [sendingInvoice, setSendingInvoice] = useState(false);
    const [downloadingMoneyReceipt, setDownloadingMoneyReceipt] = useState(false);
    const [previewingMoneyReceipt, setPreviewingMoneyReceipt] = useState(false);
    const [downloadingChalan, setDownloadingChalan] = useState(false);
    const [previewingChalan, setPreviewingChalan] = useState(false);
    const [isSyncingLedger, setIsSyncingLedger] = useState(false);
    // Manual order/invoice SMS — one shared preview-then-confirm flow for all 4 send types
    // (status / delivered / due / custom invoice) instead of a bare browser confirm(), so the
    // admin sees the exact rendered text before it goes out.
    const [pendingSms, setPendingSms] = useState<{ kind: SmsKind; invoiceId?: number } | null>(null);
    const [smsPreview, setSmsPreview] = useState<{ phone: string; message: string } | null>(null);
    const [loadingPreviewKey, setLoadingPreviewKey] = useState<string | null>(null);
    const [isSendingSms, setIsSendingSms] = useState(false);
    const [isHistoryOpen, setIsHistoryOpen] = useState(false);

    const [isRecordPaymentOpen, setIsRecordPaymentOpen] = useState(false);
    const [recordPaymentAmount, setRecordPaymentAmount] = useState('');
    const [isRecordingPayment, setIsRecordingPayment] = useState(false);

    // Correct Payment Amount — fixes what was mis-recorded as PAID (e.g. staff typed the wrong
    // cash amount), as opposed to amending the order which fixes what was CHARGED.
    const [isCorrectPaymentOpen, setIsCorrectPaymentOpen] = useState(false);
    const [correctedPaidAmount, setCorrectedPaidAmount] = useState('');
    const [correctPaymentReason, setCorrectPaymentReason] = useState('');
    const [isCorrectingPayment, setIsCorrectingPayment] = useState(false);

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

    // Bulk "Create Purchase Order" — bundles any/all out-of-stock product lines on this order
    // into a single PO (one supplier, picked on the next screen); the per-item truck icon covers
    // just one line at a time, this covers several at once.
    const [isBulkPOModalOpen, setIsBulkPOModalOpen] = useState(false);
    const [bulkPOSelected, setBulkPOSelected] = useState<Record<number, boolean>>({});

    // Custom Invoice — a document-only alternate invoice for a customer (e.g. for their own
    // reimbursement paperwork). Never touches the real order/stock/ledger; every one created is
    // persisted so there's a record of what was issued, when, and by whom.
    const [customInvoices, setCustomInvoices] = useState<CustomInvoice[]>([]);
    const [isCustomInvoiceOpen, setIsCustomInvoiceOpen] = useState(false);
    const [customInvoiceForm, setCustomInvoiceForm] = useState({
        invoice_number: '',
        invoice_date: '',
        customer_name: '',
        customer_phone: '',
        customer_email: '',
        customer_address: '',
        items: [] as { item_name: string; item_sku: string; notes: string; quantity: string; unit_price: string }[],
        discount: '',
        shipping: '',
        tax: '',
        notes: '',
    });
    const [isSavingCustomInvoice, setIsSavingCustomInvoice] = useState(false);
    const [downloadingCustomInvoiceId, setDownloadingCustomInvoiceId] = useState<number | null>(null);

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

    const fetchCustomInvoices = async () => {
        try {
            const response = await adminService.getCustomInvoices(orderId);
            setCustomInvoices(response.data?.data || []);
        } catch (err) {
            console.error('Error fetching custom invoices:', err);
        }
    };

    useEffect(() => {
        if (orderId) {
            fetchOrder();
            fetchCustomInvoices();
        }
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

    // Opens the confirm modal pre-loaded with the exact rendered SMS text (fetched from the
    // preview endpoint) rather than a bare browser confirm() with no visibility into what the
    // customer will actually receive.
    const openSmsPreview = async (kind: SmsKind, invoiceId?: number) => {
        if (!order) return;
        const key = kind === 'custom_invoice' ? `custom_invoice-${invoiceId}` : kind;
        setLoadingPreviewKey(key);
        try {
            const res = kind === 'custom_invoice'
                ? await adminService.previewCustomInvoiceSms(invoiceId!)
                : await adminService.previewOrderSms(order.id, kind);
            setSmsPreview(res.data.data);
            setPendingSms({ kind, invoiceId });
        } catch (err) {
            toast.error(getErrorMessage(err));
        } finally {
            setLoadingPreviewKey(null);
        }
    };

    const handleConfirmSendSms = async () => {
        if (!pendingSms || !order) return;
        setIsSendingSms(true);
        try {
            if (pendingSms.kind === 'status') await adminService.sendOrderStatusSms(order.id);
            else if (pendingSms.kind === 'delivered') await adminService.sendOrderDeliveredSms(order.id);
            else if (pendingSms.kind === 'due') await adminService.sendOrderDueSms(order.id);
            else if (pendingSms.kind === 'custom_invoice') await adminService.sendCustomInvoiceSms(pendingSms.invoiceId!);
            toast.success('SMS sent.');
            setPendingSms(null);
            setSmsPreview(null);
        } catch (err) {
            toast.error(getErrorMessage(err));
        } finally {
            setIsSendingSms(false);
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

    const openCorrectPayment = () => {
        if (!order) return;
        setCorrectedPaidAmount(String(order.paid_amount ?? 0));
        setCorrectPaymentReason('');
        setIsCorrectPaymentOpen(true);
    };

    const handleCorrectPayment = async () => {
        if (!order) return;
        const amount = parseFloat(correctedPaidAmount);
        if (isNaN(amount) || amount < 0) {
            toast.error('Enter a valid amount');
            return;
        }
        if (!correctPaymentReason.trim()) {
            toast.error('Enter a reason for this correction');
            return;
        }

        setIsCorrectingPayment(true);
        try {
            await adminService.correctOrderPayment(order.id, {
                corrected_paid_amount: amount,
                reason: correctPaymentReason.trim(),
            });
            toast.success('Payment amount corrected.');
            setIsCorrectPaymentOpen(false);
            fetchOrder();
        } catch (err) {
            toast.error(getErrorMessage(err));
        } finally {
            setIsCorrectingPayment(false);
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
        setShowStatusConfirm(false);
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

    const triggerPdfDownload = (data: BlobPart, filename: string) => {
        const blob = new Blob([data], { type: 'application/pdf' });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(url);
    };

    const handleDownloadInvoice = async () => {
        if (!order) return;
        setDownloadingInvoice(true);
        try {
            const response = await adminService.downloadInvoice(order.id);
            triggerPdfDownload(response.data as BlobPart, `Invoice-${order.order_number}.pdf`);
            toast.success('Invoice downloaded!');
        } catch (err) {
            toast.error(getErrorMessage(err));
        } finally {
            setDownloadingInvoice(false);
        }
    };

    const handleDownloadMoneyReceipt = async () => {
        if (!order) return;
        setDownloadingMoneyReceipt(true);
        try {
            const response = await adminService.downloadMoneyReceipt(order.id);
            triggerPdfDownload(response.data as BlobPart, `Money-Receipt-${order.order_number}.pdf`);
            toast.success('Money receipt downloaded!');
        } catch (err) {
            toast.error(getErrorMessage(err));
        } finally {
            setDownloadingMoneyReceipt(false);
        }
    };

    const handleDownloadChalan = async () => {
        if (!order) return;
        setDownloadingChalan(true);
        try {
            const response = await adminService.downloadDeliveryChalan(order.id);
            triggerPdfDownload(response.data as BlobPart, `Delivery-Chalan-${order.order_number}.pdf`);
            toast.success('Delivery chalan downloaded!');
        } catch (err) {
            toast.error(getErrorMessage(err));
        } finally {
            setDownloadingChalan(false);
        }
    };

    const openCustomInvoiceModal = () => {
        if (!order) return;
        setCustomInvoiceForm({
            invoice_number: '',
            invoice_date: new Date().toISOString().split('T')[0],
            customer_name: order.customer_name ?? order.customer?.name ?? '',
            customer_phone: order.customer_phone ?? '',
            customer_email: order.customer_email ?? order.customer?.email ?? '',
            customer_address: order.customer_address ?? '',
            items: (order.items ?? []).map((item) => ({
                item_name: item.item_name,
                item_sku: item.item_sku ?? '',
                notes: item.notes ?? '',
                quantity: String(item.quantity),
                unit_price: String(item.unit_price),
            })),
            discount: order.discount ? String(order.discount) : '',
            shipping: order.shipping ? String(order.shipping) : '',
            tax: order.tax ? String(order.tax) : '',
            notes: '',
        });
        setIsCustomInvoiceOpen(true);
    };

    const addCustomInvoiceItem = () => {
        setCustomInvoiceForm((f) => ({
            ...f,
            items: [...f.items, { item_name: '', item_sku: '', notes: '', quantity: '1', unit_price: '' }],
        }));
    };

    const removeCustomInvoiceItem = (index: number) => {
        setCustomInvoiceForm((f) => ({ ...f, items: f.items.filter((_, i) => i !== index) }));
    };

    const updateCustomInvoiceItem = (index: number, field: 'item_name' | 'item_sku' | 'notes' | 'quantity' | 'unit_price', value: string) => {
        setCustomInvoiceForm((f) => ({
            ...f,
            items: f.items.map((item, i) => (i === index ? { ...item, [field]: value } : item)),
        }));
    };

    const customInvoiceSubtotal = customInvoiceForm.items.reduce(
        (sum, item) => sum + (parseFloat(item.quantity) || 0) * (parseFloat(item.unit_price) || 0),
        0
    );
    const customInvoiceTotal = customInvoiceSubtotal
        - (parseFloat(customInvoiceForm.discount) || 0)
        + (parseFloat(customInvoiceForm.shipping) || 0)
        + (parseFloat(customInvoiceForm.tax) || 0);

    const handleCreateCustomInvoice = async () => {
        if (!order) return;
        if (customInvoiceForm.items.length === 0 || customInvoiceForm.items.some((i) => !i.item_name.trim() || !i.quantity || !i.unit_price)) {
            toast.error('Every item needs a name, quantity, and unit price.');
            return;
        }

        setIsSavingCustomInvoice(true);
        try {
            const response = await adminService.createCustomInvoice(order.id, {
                invoice_number: customInvoiceForm.invoice_number.trim() || undefined,
                invoice_date: customInvoiceForm.invoice_date || undefined,
                customer_name: customInvoiceForm.customer_name.trim() || undefined,
                customer_phone: customInvoiceForm.customer_phone.trim() || undefined,
                customer_email: customInvoiceForm.customer_email.trim() || undefined,
                customer_address: customInvoiceForm.customer_address.trim() || undefined,
                items: customInvoiceForm.items.map((item) => ({
                    item_name: item.item_name.trim(),
                    item_sku: item.item_sku.trim() || undefined,
                    notes: item.notes.trim() || undefined,
                    quantity: Number(item.quantity),
                    unit_price: Number(item.unit_price),
                })),
                discount: customInvoiceForm.discount ? Number(customInvoiceForm.discount) : undefined,
                shipping: customInvoiceForm.shipping ? Number(customInvoiceForm.shipping) : undefined,
                tax: customInvoiceForm.tax ? Number(customInvoiceForm.tax) : undefined,
                notes: customInvoiceForm.notes.trim() || undefined,
            });
            const created = response.data?.data;
            if (created) {
                const pdf = await adminService.downloadCustomInvoice(created.id);
                triggerPdfDownload(pdf.data as BlobPart, `Custom-Invoice-${created.invoice_number}.pdf`);
            }
            toast.success('Custom invoice created and downloaded.');
            setIsCustomInvoiceOpen(false);
            fetchCustomInvoices();
        } catch (err) {
            toast.error(getErrorMessage(err));
        } finally {
            setIsSavingCustomInvoice(false);
        }
    };

    const handleDownloadCustomInvoice = async (invoice: CustomInvoice) => {
        setDownloadingCustomInvoiceId(invoice.id);
        try {
            const response = await adminService.downloadCustomInvoice(invoice.id);
            triggerPdfDownload(response.data as BlobPart, `Custom-Invoice-${invoice.invoice_number}.pdf`);
        } catch (err) {
            toast.error(getErrorMessage(err));
        } finally {
            setDownloadingCustomInvoiceId(null);
        }
    };

    const handleSendCustomInvoiceSms = (invoice: CustomInvoice) => {
        if (!invoice.customer_phone) {
            toast.error('This invoice has no customer phone number.');
            return;
        }
        openSmsPreview('custom_invoice', invoice.id);
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

    const handlePreviewMoneyReceipt = async () => {
        if (!order) return;
        const newTab = window.open('', '_blank');
        setPreviewingMoneyReceipt(true);
        try {
            const response = await adminService.downloadMoneyReceipt(order.id);
            const blob = new Blob([response.data as BlobPart], { type: 'application/pdf' });
            const url = window.URL.createObjectURL(blob);
            if (newTab) {
                newTab.document.write(
                    `<!DOCTYPE html><html><head><title>Money-Receipt-${order.order_number}</title></head>` +
                    `<body style="margin:0"><embed src="${url}" type="application/pdf" width="100%" height="100%" style="border:none;position:fixed;inset:0" /></body></html>`
                );
                newTab.document.close();
            } else {
                toast.error('Please allow pop-ups to preview the money receipt.');
            }
            setTimeout(() => window.URL.revokeObjectURL(url), 60_000);
        } catch (err) {
            newTab?.close();
            toast.error(getErrorMessage(err));
        } finally {
            setPreviewingMoneyReceipt(false);
        }
    };

    const handlePreviewChalan = async () => {
        if (!order) return;
        const newTab = window.open('', '_blank');
        setPreviewingChalan(true);
        try {
            const response = await adminService.downloadDeliveryChalan(order.id);
            const blob = new Blob([response.data as BlobPart], { type: 'application/pdf' });
            const url = window.URL.createObjectURL(blob);
            if (newTab) {
                newTab.document.write(
                    `<!DOCTYPE html><html><head><title>Delivery-Chalan-${order.order_number}</title></head>` +
                    `<body style="margin:0"><embed src="${url}" type="application/pdf" width="100%" height="100%" style="border:none;position:fixed;inset:0" /></body></html>`
                );
                newTab.document.close();
            } else {
                toast.error('Please allow pop-ups to preview the delivery chalan.');
            }
            setTimeout(() => window.URL.revokeObjectURL(url), 60_000);
        } catch (err) {
            newTab?.close();
            toast.error(getErrorMessage(err));
        } finally {
            setPreviewingChalan(false);
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

    // The most recently created PO (highest id) already covering this product within this
    // order, if any — once one exists, the per-item action becomes a status badge instead of
    // the "create PO" icon, regardless of what stock does afterward.
    const linkedPOForProduct = (productId: number | null | undefined) => {
        if (!productId || !order?.purchase_orders) return null;
        const matches = order.purchase_orders.filter((po) => po.product_ids.includes(productId));
        if (matches.length === 0) return null;
        return matches.reduce((latest, po) => (po.id > latest.id ? po : latest));
    };

    const outOfStockItems = (order?.items ?? []).filter(
        (i) =>
            i.item_type === 'product' &&
            i.product_id &&
            !i.product?.always_in_stock &&
            (i.product?.stock_qty ?? 0) <= 0 &&
            !linkedPOForProduct(i.product_id)
    );

    const openBulkPOModal = () => {
        const defaults: Record<number, boolean> = {};
        outOfStockItems.forEach((i) => { if (i.product_id) defaults[i.product_id] = true; });
        setBulkPOSelected(defaults);
        setIsBulkPOModalOpen(true);
    };

    const toggleBulkPOItem = (productId: number) => {
        setBulkPOSelected((prev) => ({ ...prev, [productId]: !prev[productId] }));
    };

    const handleBulkPOContinue = () => {
        if (!order) return;
        const items = outOfStockItems
            .filter((i) => i.product_id && bulkPOSelected[i.product_id])
            .map((i) => ({ product_id: i.product_id, quantity: i.quantity }));
        if (items.length === 0) {
            toast.error('Select at least one item to source.');
            return;
        }
        const params = new URLSearchParams({ order_id: String(order.id), items: JSON.stringify(items) });
        router.push(`/purchases/create?${params.toString()}`);
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
                            {(order.can_be_edited || (order.requires_super_admin_to_amend && hasPermission('amend_paid_orders'))) && (
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
                                <div className="flex items-center justify-between gap-3">
                                    <CardTitle className="flex items-center gap-2">
                                        <Package className="w-5 h-5" />
                                        Order Items
                                    </CardTitle>
                                    {outOfStockItems.length > 0 && (
                                        <Button variant="outline" size="sm" onClick={openBulkPOModal} className="border-orange-300 text-orange-700 hover:bg-orange-50">
                                            <Truck className="w-4 h-4 mr-1.5" />
                                            Create Purchase Order
                                        </Button>
                                    )}
                                </div>
                            </CardHeader>
                            {order.purchase_orders && order.purchase_orders.length > 0 && (
                                <div className="px-4 py-2.5 bg-blue-50 border-b border-blue-100 flex flex-wrap gap-2">
                                    {order.purchase_orders.map((po) => (
                                        <Link
                                            key={po.id}
                                            href={`/purchases/${po.id}`}
                                            className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-700 bg-white px-2.5 py-1 rounded-lg border border-blue-200 hover:bg-blue-100"
                                        >
                                            <Truck className="w-3.5 h-3.5" />
                                            Awaiting stock via {po.po_number} ({po.status.replace('_', ' ')})
                                        </Link>
                                    ))}
                                </div>
                            )}
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
                                                    const linkedPO = item.item_type === 'product' ? linkedPOForProduct(item.product_id) : null;
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
                                                            <div className="flex items-center justify-end gap-1">
                                                                <Button
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    onClick={() => openCostModal(item)}
                                                                    title="Manage costs for this item"
                                                                >
                                                                    <DollarSign className="w-4 h-4" />
                                                                </Button>
                                                                {linkedPO ? (
                                                                    <Link
                                                                        href={`/purchases/${linkedPO.id}`}
                                                                        title={`Sourced via ${linkedPO.po_number}`}
                                                                        className="inline-flex"
                                                                    >
                                                                        <Badge variant={linkedPO.status === 'received' ? 'success' : linkedPO.status === 'cancelled' ? 'danger' : 'info'} className="text-[10px] whitespace-nowrap">
                                                                            {linkedPO.status.replace('_', ' ')}
                                                                        </Badge>
                                                                    </Link>
                                                                ) : (
                                                                    item.item_type === 'product' && item.product_id && !item.product?.always_in_stock && (item.product?.stock_qty ?? 0) <= 0 && (
                                                                        <Button
                                                                            variant="ghost"
                                                                            size="sm"
                                                                            onClick={() => router.push(`/purchases/create?order_id=${order.id}&product_id=${item.product_id}&quantity=${item.quantity}`)}
                                                                            title="Out of stock — create a Purchase Order to source this item"
                                                                        >
                                                                            <Truck className="w-4 h-4 text-orange-600" />
                                                                        </Button>
                                                                    )
                                                                )}
                                                            </div>
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
                                    <Button
                                        onClick={() => setShowStatusConfirm(true)}
                                        isLoading={isSaving}
                                        disabled={newStatus === (order.status || order.order_status)}
                                        className="w-full"
                                    >
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
                                    {order.customer_phone && (order.outstanding_receivable ?? 0) > 0 && !['cancelled', 'refunded', 'rejected'].includes(order.order_status) && (
                                        <Button
                                            onClick={() => openSmsPreview('due')}
                                            isLoading={loadingPreviewKey === 'due'}
                                            variant="outline"
                                            className="w-full justify-start border-amber-300 text-amber-700 hover:bg-amber-50"
                                            title="Manually remind the customer about their outstanding balance."
                                        >
                                            <MessageSquare className="w-4 h-4 mr-2" />
                                            Send Due SMS
                                        </Button>
                                    )}
                                    {order.requires_super_admin_to_amend && hasPermission('correct_payment_amounts') && (
                                        <Button onClick={openCorrectPayment} variant="outline" className="w-full justify-start border-indigo-300 text-indigo-700 hover:bg-indigo-50">
                                            <Edit3 className="w-4 h-4 mr-2" />
                                            Correct Payment Amount
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
                                    {order.customer_phone && !['cancelled', 'refunded', 'rejected'].includes(order.order_status) && (
                                        <Button
                                            onClick={() => openSmsPreview('status')}
                                            isLoading={loadingPreviewKey === 'status'}
                                            variant="outline"
                                            className="w-full justify-start border-gray-300 text-gray-700 hover:bg-gray-50"
                                            title={`Manually notify the customer the order is now "${order.order_status}" — not sent automatically on status change.`}
                                        >
                                            <MessageSquare className="w-4 h-4 mr-2" />
                                            Send Status SMS
                                        </Button>
                                    )}
                                    {order.customer_phone && !['cancelled', 'refunded', 'rejected'].includes(order.order_status) && (
                                        <Button
                                            onClick={() => openSmsPreview('delivered')}
                                            isLoading={loadingPreviewKey === 'delivered'}
                                            variant="outline"
                                            className="w-full justify-start border-green-300 text-green-700 hover:bg-green-50"
                                            title="Manually notify the customer their order has arrived — not tied to any status change."
                                        >
                                            <MessageSquare className="w-4 h-4 mr-2" />
                                            Send Delivery SMS
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

                        {/* Documents — Invoice, Money Receipt, Delivery Chalan, Custom Invoice.
                            One compact card with an icon row per document type instead of four
                            full cards, so the sidebar doesn't turn into an endless scroll. */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-sm flex items-center gap-2">
                                    <FileText className="w-4 h-4" />
                                    Documents
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="divide-y divide-gray-100">
                                {/* Invoice */}
                                <div className="flex items-center justify-between gap-2 py-3 first:pt-0">
                                    <div className="flex items-center gap-2.5 min-w-0">
                                        <div className="w-8 h-8 rounded-lg bg-orange-100 flex items-center justify-center flex-shrink-0">
                                            <FileText className="w-4 h-4 text-orange-600" />
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-sm font-medium text-gray-900">Invoice</p>
                                            <p className="text-xs text-gray-500 truncate" title="Generate and share the official invoice for this order.">Official invoice for this order</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-0.5 flex-shrink-0">
                                        <Button variant="ghost" size="sm" onClick={handlePreviewInvoice} isLoading={previewingInvoice} title="Preview & Print Invoice">
                                            <Eye className="w-4 h-4" />
                                        </Button>
                                        <Button variant="ghost" size="sm" onClick={handleDownloadInvoice} isLoading={downloadingInvoice} title="Download Invoice PDF">
                                            <Download className="w-4 h-4" />
                                        </Button>
                                        {(order.customer_email || order.customer?.email) && (
                                            <Button variant="ghost" size="sm" onClick={handleSendInvoiceEmail} isLoading={sendingInvoice} title="Email Invoice to Customer">
                                                <Mail className="w-4 h-4" />
                                            </Button>
                                        )}
                                    </div>
                                </div>

                                {/* Money Receipt — proof of payment, separate from the Invoice */}
                                {Number(order.paid_amount ?? 0) > 0 && (
                                    <div className="flex items-center justify-between gap-2 py-3">
                                        <div className="flex items-center gap-2.5 min-w-0">
                                            <div className="w-8 h-8 rounded-lg bg-green-100 flex items-center justify-center flex-shrink-0">
                                                <Receipt className="w-4 h-4 text-green-600" />
                                            </div>
                                            <div className="min-w-0">
                                                <p className="text-sm font-medium text-gray-900">Money Receipt</p>
                                                <p className="text-xs text-gray-500 truncate" title="BD-style money receipt (counterfoil + main receipt) — proof of payment received.">BD-style receipt — proof of payment</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-0.5 flex-shrink-0">
                                            <Button variant="ghost" size="sm" onClick={handlePreviewMoneyReceipt} isLoading={previewingMoneyReceipt} title="Preview & Print Receipt">
                                                <Eye className="w-4 h-4" />
                                            </Button>
                                            <Button variant="ghost" size="sm" onClick={handleDownloadMoneyReceipt} isLoading={downloadingMoneyReceipt} title="Download Money Receipt">
                                                <Download className="w-4 h-4" />
                                            </Button>
                                        </div>
                                    </div>
                                )}

                                {/* Delivery Chalan — goods-delivery note, items/qty/serials, no prices */}
                                <div className="flex items-center justify-between gap-2 py-3">
                                    <div className="flex items-center gap-2.5 min-w-0">
                                        <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center flex-shrink-0">
                                            <ClipboardList className="w-4 h-4 text-amber-600" />
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-sm font-medium text-gray-900">Delivery Chalan</p>
                                            <p className="text-xs text-gray-500 truncate" title="Goods-delivery note — items, serials & quantity only, no prices. For delivery verification.">Items &amp; quantity only, no prices</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-0.5 flex-shrink-0">
                                        <Button variant="ghost" size="sm" onClick={handlePreviewChalan} isLoading={previewingChalan} title="Preview & Print Chalan">
                                            <Eye className="w-4 h-4" />
                                        </Button>
                                        <Button variant="ghost" size="sm" onClick={handleDownloadChalan} isLoading={downloadingChalan} title="Download Delivery Chalan">
                                            <Download className="w-4 h-4" />
                                        </Button>
                                    </div>
                                </div>

                                {/* Custom Invoice — document-only, doesn't touch the real order */}
                                <div className="py-3 last:pb-0">
                                    <div className="flex items-center justify-between gap-2">
                                        <div className="flex items-center gap-2.5 min-w-0">
                                            <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center flex-shrink-0">
                                                <FileText className="w-4 h-4 text-indigo-600" />
                                            </div>
                                            <div className="min-w-0">
                                                <p className="text-sm font-medium text-gray-900">Custom Invoice</p>
                                                <p className="text-xs text-gray-500 truncate" title="A document-only invoice with amounts/details you choose — doesn't change this order's real total, stock, or accounting.">Document-only — doesn&apos;t affect real totals</p>
                                            </div>
                                        </div>
                                        {hasPermission('create_custom_invoices') && (
                                            <Button variant="outline" size="sm" onClick={openCustomInvoiceModal} className="flex-shrink-0 border-indigo-300 text-indigo-700 hover:bg-indigo-50">
                                                Create
                                            </Button>
                                        )}
                                    </div>
                                    {customInvoices.length > 0 && (
                                        <div className="mt-2 space-y-1.5 pl-[42px]">
                                            {customInvoices.map((inv) => (
                                                <div key={inv.id} className="flex items-center justify-between gap-2 bg-gray-50 border border-gray-100 rounded-lg px-2.5 py-1.5 text-xs">
                                                    <div className="min-w-0">
                                                        <p className="font-semibold text-gray-900 truncate">{inv.invoice_number}</p>
                                                        <p className="text-gray-500">
                                                            {formatDate(inv.invoice_date)} &middot; {formatCurrency(inv.total)}
                                                            {inv.creator?.name ? ` · by ${inv.creator.name}` : ''}
                                                        </p>
                                                    </div>
                                                    <div className="flex items-center gap-0.5 flex-shrink-0">
                                                        {inv.customer_phone && (
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                onClick={() => handleSendCustomInvoiceSms(inv)}
                                                                isLoading={loadingPreviewKey === `custom_invoice-${inv.id}`}
                                                                title="Send SMS"
                                                            >
                                                                <MessageSquare className="w-3.5 h-3.5" />
                                                            </Button>
                                                        )}
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => handleDownloadCustomInvoice(inv)}
                                                            isLoading={downloadingCustomInvoiceId === inv.id}
                                                            title="Download"
                                                        >
                                                            <Download className="w-3.5 h-3.5" />
                                                        </Button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                    {customInvoices.length === 0 && !hasPermission('create_custom_invoices') && (
                                        <p className="text-xs text-gray-400 mt-1 pl-[42px]">No custom invoices have been issued for this order.</p>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            ) : null}

            {/* SMS Confirm Modal — shared by status / delivery / due / custom-invoice sends, so
                the admin always sees the exact rendered text before it goes out. */}
            <Modal isOpen={!!pendingSms} onClose={() => { setPendingSms(null); setSmsPreview(null); }} title="Confirm SMS" size="sm">
                {smsPreview && (
                    <div className="space-y-4">
                        <div>
                            <p className="text-xs font-medium text-gray-500 uppercase mb-1">To</p>
                            <p className="text-sm font-medium text-gray-900">{smsPreview.phone}</p>
                        </div>
                        <div>
                            <p className="text-xs font-medium text-gray-500 uppercase mb-1">Message</p>
                            <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-sm text-gray-800 whitespace-pre-wrap">
                                {smsPreview.message}
                            </div>
                        </div>
                        <div className="flex justify-end gap-2 pt-2 border-t">
                            <Button variant="outline" onClick={() => { setPendingSms(null); setSmsPreview(null); }}>Cancel</Button>
                            <Button onClick={handleConfirmSendSms} isLoading={isSendingSms} leftIcon={<MessageSquare className="w-4 h-4" />}>
                                Send SMS
                            </Button>
                        </div>
                    </div>
                )}
            </Modal>

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

            {/* Correct Payment Amount Modal */}
            <Modal isOpen={isCorrectPaymentOpen} onClose={() => setIsCorrectPaymentOpen(false)} title="Correct Payment Amount" size="sm">
                <div className="space-y-4">
                    <p className="text-sm text-gray-600">
                        Fixes what was recorded as <em>received</em> (e.g. staff typed the wrong cash amount) — not the order&apos;s total. This reverses the recorded payment entries and posts a fresh one for the correct amount.
                    </p>
                    <p className="text-sm text-gray-600">
                        Currently recorded as paid: <span className="font-semibold text-gray-900">{formatCurrency(order?.paid_amount ?? 0)}</span>
                    </p>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Correct amount actually received</label>
                        <input
                            type="number"
                            min={0}
                            step="0.01"
                            value={correctedPaidAmount}
                            onChange={(e) => setCorrectedPaidAmount(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Reason</label>
                        <Textarea
                            value={correctPaymentReason}
                            onChange={(e) => setCorrectPaymentReason(e.target.value)}
                            placeholder="e.g. Staff recorded ৳12,000 by mistake — customer actually paid ৳6,000 cash"
                            rows={2}
                        />
                    </div>
                    <div className="flex justify-end gap-2 pt-2">
                        <Button variant="ghost" onClick={() => setIsCorrectPaymentOpen(false)}>Cancel</Button>
                        <Button onClick={handleCorrectPayment} isLoading={isCorrectingPayment}>Confirm Correction</Button>
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

            {/* Create Custom Invoice Modal */}
            <Modal isOpen={isCustomInvoiceOpen} onClose={() => setIsCustomInvoiceOpen(false)} title="Create Custom Invoice" size="lg">
                <div className="space-y-4">
                    <p className="text-sm text-gray-600">
                        Pre-filled from this order &mdash; change anything below. This does not affect the order&apos;s real total, stock, or accounting.
                    </p>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">Invoice Number</label>
                            <input
                                type="text"
                                placeholder={order ? `${order.order_number}-A${customInvoices.length + 1}` : ''}
                                value={customInvoiceForm.invoice_number}
                                onChange={(e) => setCustomInvoiceForm((f) => ({ ...f, invoice_number: e.target.value }))}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">Invoice Date</label>
                            <input
                                type="date"
                                value={customInvoiceForm.invoice_date}
                                onChange={(e) => setCustomInvoiceForm((f) => ({ ...f, invoice_date: e.target.value }))}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">Customer Name</label>
                            <input
                                type="text"
                                value={customInvoiceForm.customer_name}
                                onChange={(e) => setCustomInvoiceForm((f) => ({ ...f, customer_name: e.target.value }))}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">Phone</label>
                            <input
                                type="text"
                                value={customInvoiceForm.customer_phone}
                                onChange={(e) => setCustomInvoiceForm((f) => ({ ...f, customer_phone: e.target.value }))}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">Email</label>
                            <input
                                type="email"
                                value={customInvoiceForm.customer_email}
                                onChange={(e) => setCustomInvoiceForm((f) => ({ ...f, customer_email: e.target.value }))}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">Address</label>
                            <input
                                type="text"
                                value={customInvoiceForm.customer_address}
                                onChange={(e) => setCustomInvoiceForm((f) => ({ ...f, customer_address: e.target.value }))}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                            />
                        </div>
                    </div>

                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <label className="block text-xs font-medium text-gray-700">Items</label>
                            <Button type="button" variant="ghost" size="sm" onClick={addCustomInvoiceItem} leftIcon={<Plus className="w-3.5 h-3.5" />}>
                                Add Item
                            </Button>
                        </div>
                        <div className="space-y-2">
                            {customInvoiceForm.items.map((item, index) => (
                                <div key={index} className="grid grid-cols-12 gap-2 items-center bg-gray-50 border border-gray-200 rounded-lg p-2">
                                    <input
                                        type="text"
                                        placeholder="Item name"
                                        value={item.item_name}
                                        onChange={(e) => updateCustomInvoiceItem(index, 'item_name', e.target.value)}
                                        className="col-span-5 px-2 py-1.5 border border-gray-300 rounded text-xs focus:outline-none focus:ring-2 focus:ring-primary-500"
                                    />
                                    <input
                                        type="number"
                                        min={1}
                                        placeholder="Qty"
                                        value={item.quantity}
                                        onChange={(e) => updateCustomInvoiceItem(index, 'quantity', e.target.value)}
                                        className="col-span-2 px-2 py-1.5 border border-gray-300 rounded text-xs focus:outline-none focus:ring-2 focus:ring-primary-500"
                                    />
                                    <input
                                        type="number"
                                        min={0}
                                        step="0.01"
                                        placeholder="Unit price"
                                        value={item.unit_price}
                                        onChange={(e) => updateCustomInvoiceItem(index, 'unit_price', e.target.value)}
                                        className="col-span-3 px-2 py-1.5 border border-gray-300 rounded text-xs focus:outline-none focus:ring-2 focus:ring-primary-500"
                                    />
                                    <div className="col-span-1 text-xs text-gray-600 text-right">
                                        {formatCurrency((parseFloat(item.quantity) || 0) * (parseFloat(item.unit_price) || 0))}
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => removeCustomInvoiceItem(index)}
                                        className="col-span-1 text-red-500 hover:text-red-700 flex justify-center"
                                    >
                                        <XCircle className="w-4 h-4" />
                                    </button>
                                </div>
                            ))}
                            {customInvoiceForm.items.length === 0 && (
                                <p className="text-xs text-gray-400 text-center py-3">No items yet — add at least one.</p>
                            )}
                        </div>
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                        <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">Discount</label>
                            <input
                                type="number" min={0} step="0.01"
                                value={customInvoiceForm.discount}
                                onChange={(e) => setCustomInvoiceForm((f) => ({ ...f, discount: e.target.value }))}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">Shipping</label>
                            <input
                                type="number" min={0} step="0.01"
                                value={customInvoiceForm.shipping}
                                onChange={(e) => setCustomInvoiceForm((f) => ({ ...f, shipping: e.target.value }))}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">Tax</label>
                            <input
                                type="number" min={0} step="0.01"
                                value={customInvoiceForm.tax}
                                onChange={(e) => setCustomInvoiceForm((f) => ({ ...f, tax: e.target.value }))}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Notes</label>
                        <Textarea
                            value={customInvoiceForm.notes}
                            onChange={(e) => setCustomInvoiceForm((f) => ({ ...f, notes: e.target.value }))}
                            rows={2}
                        />
                    </div>

                    <div className="flex items-center justify-between border-t pt-3">
                        <div className="text-sm text-gray-600">
                            Subtotal: {formatCurrency(customInvoiceSubtotal)}
                        </div>
                        <div className="text-base font-bold text-gray-900">
                            Total: {formatCurrency(customInvoiceTotal)}
                        </div>
                    </div>

                    <div className="flex justify-end gap-2 pt-2">
                        <Button variant="ghost" onClick={() => setIsCustomInvoiceOpen(false)}>Cancel</Button>
                        <Button onClick={handleCreateCustomInvoice} isLoading={isSavingCustomInvoice}>Create &amp; Download</Button>
                    </div>
                </div>
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

            {order && (
                <ConfirmModal
                    isOpen={showStatusConfirm}
                    onClose={() => setShowStatusConfirm(false)}
                    onConfirm={handleStatusUpdate}
                    title="Change order status?"
                    message={
                        ['cancelled', 'refunded'].includes(newStatus)
                            ? `Change status from "${(order.status || order.order_status || '').replace('_', ' ')}" to "${newStatus.replace('_', ' ')}"? This will restock inventory and reverse the accounting entries already posted for this order.`
                            : newStatus === 'completed'
                                ? `Change status from "${(order.status || order.order_status || '').replace('_', ' ')}" to "completed"? This recognizes the sale (and cost of goods sold) in the accounts.`
                                : `Change status from "${(order.status || order.order_status || '').replace('_', ' ')}" to "${newStatus.replace('_', ' ')}"?`
                    }
                    confirmLabel="Yes, update status"
                    variant={['cancelled', 'refunded'].includes(newStatus) ? 'danger' : 'warning'}
                    isLoading={isSaving}
                />
            )}

            {/* Bulk Create Purchase Order — bundle several out-of-stock lines into one PO */}
            <Modal isOpen={isBulkPOModalOpen} onClose={() => setIsBulkPOModalOpen(false)} title="Create Purchase Order" size="sm">
                <div className="space-y-4">
                    <p className="text-sm text-gray-600">
                        Select which out-of-stock items to source. They&apos;ll go into a single Purchase Order —
                        pick the supplier on the next screen. Uncheck any you want to order separately (e.g. from a different supplier).
                    </p>
                    <div className="space-y-2">
                        {outOfStockItems.map((item) => (
                            <label key={item.id} className="flex items-center gap-3 bg-gray-50 hover:bg-gray-100 p-3 rounded-lg cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={item.product_id ? !!bulkPOSelected[item.product_id] : false}
                                    onChange={() => item.product_id && toggleBulkPOItem(item.product_id)}
                                    className="rounded border-gray-300 text-primary focus:ring-primary"
                                />
                                <div>
                                    <p className="text-sm font-medium text-gray-900">{item.item_name || item.name}</p>
                                    <p className="text-xs text-gray-500">Qty needed: {item.quantity}</p>
                                </div>
                            </label>
                        ))}
                    </div>
                    <div className="flex justify-end gap-3 pt-2">
                        <Button variant="outline" onClick={() => setIsBulkPOModalOpen(false)}>Cancel</Button>
                        <Button onClick={handleBulkPOContinue} className="bg-orange-600 hover:bg-orange-700">Continue</Button>
                    </div>
                </div>
            </Modal>
        </AdminLayout>
    );
}
