'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft, Package, Truck, FileText, Download, XCircle, Pencil, CheckCircle2, Wallet, ArrowUpCircle, History,
  Plus, X, Undo2, ShieldAlert, Receipt, Eye,
} from 'lucide-react';
import { AdminLayout } from '@/components/layout';
import {
  Card, CardContent, CardHeader, CardTitle,
  Button, Badge, LoadingSpinner, Modal, ConfirmModal, ErrorState, HistoryModal,
} from '@/components/ui';
import { PurchaseOrder, PurchaseOrderItem, PurchaseOrderStatus } from '@/types';
import { formatCurrency, formatDate, formatDateTime, getErrorMessage } from '@/lib/utils';
import adminService from '@/lib/adminService';
import { useAuthStore } from '@/store/auth';
import toast from 'react-hot-toast';
import Link from 'next/link';

const STATUS_CONFIG: Record<PurchaseOrderStatus, { label: string; variant: 'default' | 'info' | 'warning' | 'success' | 'danger' }> = {
  draft: { label: 'Draft', variant: 'default' },
  ordered: { label: 'Ordered', variant: 'info' },
  partially_received: { label: 'Partially Received', variant: 'warning' },
  received: { label: 'Received', variant: 'success' },
  cancelled: { label: 'Cancelled', variant: 'danger' },
};

export default function PurchaseOrderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const poId = Number(params.id);

  const [po, setPo] = useState<PurchaseOrder | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);

  const [isMarkingOrdered, setIsMarkingOrdered] = useState(false);
  const [isCancelOpen, setIsCancelOpen] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isDownloadingVoucher, setIsDownloadingVoucher] = useState(false);
  const [previewingVoucher, setPreviewingVoucher] = useState(false);

  const [isReceiveOpen, setIsReceiveOpen] = useState(false);
  const [receiveQtys, setReceiveQtys] = useState<Record<number, number>>({});
  const [receiveSerials, setReceiveSerials] = useState<Record<number, string[]>>({});
  const [isReceiving, setIsReceiving] = useState(false);

  const [isReturnOpen, setIsReturnOpen] = useState(false);
  const [returnQtys, setReturnQtys] = useState<Record<number, number>>({});
  const [returnSelectedSerials, setReturnSelectedSerials] = useState<Record<number, string[]>>({});
  const [isReturning, setIsReturning] = useState(false);
  // Asked only when this return would push the PO past "fully paid" — i.e. some of the value
  // being sent back was already paid for, so the supplier now owes a refund. Holds the resolved
  // request items + the refundable portion while the admin confirms whether it was handed back
  // in cash on the spot.
  const [refundCollectPrompt, setRefundCollectPrompt] = useState<{
    items: { id: number; quantity: number; serials?: string[] }[];
    amount: number;
  } | null>(null);

  const [isRestockOpen, setIsRestockOpen] = useState(false);
  const [restockQtys, setRestockQtys] = useState<Record<number, number>>({});
  const [restockSelectedSerials, setRestockSelectedSerials] = useState<Record<number, string[]>>({});
  const [isRestocking, setIsRestocking] = useState(false);

  const [isPayOpen, setIsPayOpen] = useState(false);
  const [payAmount, setPayAmount] = useState('');
  const [isPaying, setIsPaying] = useState(false);

  const [isSyncingLedger, setIsSyncingLedger] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);

  // Correct a mistake in what was recorded at receipt time (unit cost / received qty) — gated
  // more tightly than the rest of this page since it corrects financials already posted to the
  // ledger, not just data entry on a still-open PO.
  const currentUser = useAuthStore((s) => s.user);
  const canCorrectReceipts = currentUser?.role === 'super_admin'
    || !!currentUser?.permissions?.includes('correct_purchase_receipts')
    || !!currentUser?.permissions?.includes('manage_purchases');
  const [correctingItem, setCorrectingItem] = useState<PurchaseOrderItem | null>(null);
  const [correctUnitCost, setCorrectUnitCost] = useState('');
  const [correctReceivedQty, setCorrectReceivedQty] = useState('');
  const [correctReason, setCorrectReason] = useState('');
  const [isCorrecting, setIsCorrecting] = useState(false);

  const fetchPo = async () => {
    setIsLoading(true);
    setError(false);
    try {
      const res = await adminService.getPurchase(poId);
      setPo(res.data?.data ?? null);
    } catch (err) {
      toast.error(getErrorMessage(err));
      setError(true);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (poId) fetchPo();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [poId]);

  const handleMarkOrdered = async () => {
    if (!po) return;
    setIsMarkingOrdered(true);
    try {
      await adminService.markPurchaseOrdered(po.id);
      toast.success('Purchase order marked as ordered.');
      fetchPo();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setIsMarkingOrdered(false);
    }
  };

  const handleCancel = async () => {
    if (!po) return;
    setIsCancelling(true);
    try {
      await adminService.cancelPurchase(po.id);
      toast.success('Purchase order cancelled.');
      setIsCancelOpen(false);
      fetchPo();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setIsCancelling(false);
    }
  };

  const handleDelete = async () => {
    if (!po) return;
    setIsDeleting(true);
    try {
      await adminService.deletePurchase(po.id);
      toast.success('Purchase order deleted.');
      router.push('/purchases');
    } catch (err) {
      toast.error(getErrorMessage(err));
      setIsDeleting(false);
    }
  };

  const handleDownload = async () => {
    if (!po) return;
    setIsDownloading(true);
    try {
      const response = await adminService.downloadPurchasePdf(po.id);
      const blob = new Blob([response.data as BlobPart], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${po.po_number}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success('Purchase order PDF downloaded!');
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setIsDownloading(false);
    }
  };

  const handleDownloadVoucher = async () => {
    if (!po) return;
    setIsDownloadingVoucher(true);
    try {
      const response = await adminService.downloadPaymentVoucher(po.id);
      const blob = new Blob([response.data as BlobPart], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Payment-Voucher-${po.po_number}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success('Payment voucher downloaded!');
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setIsDownloadingVoucher(false);
    }
  };

  // Opens the PDF in a new tab via a blob URL, same approach as the Money Receipt preview on the
  // Order detail page — the tab must open synchronously (before the await) or the browser blocks
  // it as not user-initiated.
  const handlePreviewVoucher = async () => {
    if (!po) return;
    const newTab = window.open('', '_blank');
    setPreviewingVoucher(true);
    try {
      const response = await adminService.downloadPaymentVoucher(po.id);
      const blob = new Blob([response.data as BlobPart], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      if (newTab) {
        newTab.document.write(
          `<!DOCTYPE html><html><head><title>Payment-Voucher-${po.po_number}</title></head>` +
          `<body style="margin:0"><embed src="${url}" type="application/pdf" width="100%" height="100%" style="border:none;position:fixed;inset:0" /></body></html>`
        );
        newTab.document.close();
      } else {
        toast.error('Please allow pop-ups to preview the payment voucher.');
      }
      setTimeout(() => window.URL.revokeObjectURL(url), 60_000);
    } catch (err) {
      newTab?.close();
      toast.error(getErrorMessage(err));
    } finally {
      setPreviewingVoucher(false);
    }
  };

  const openReceive = () => {
    if (!po?.items) return;
    const defaults: Record<number, number> = {};
    po.items.forEach((item) => {
      const remaining = item.quantity - item.received_qty;
      if (remaining > 0) defaults[item.id] = remaining;
    });
    setReceiveQtys(defaults);
    setReceiveSerials({});
    setIsReceiveOpen(true);
  };

  const addSerialInput = (itemId: number) => {
    setReceiveSerials((prev) => ({ ...prev, [itemId]: [...(prev[itemId] ?? []), ''] }));
  };

  const removeSerialInput = (itemId: number, index: number) => {
    setReceiveSerials((prev) => ({ ...prev, [itemId]: (prev[itemId] ?? []).filter((_, i) => i !== index) }));
  };

  const updateSerialInput = (itemId: number, index: number, value: string) => {
    setReceiveSerials((prev) => ({
      ...prev,
      [itemId]: (prev[itemId] ?? []).map((s, i) => (i === index ? value : s)),
    }));
  };

  const handleReceive = async () => {
    if (!po) return;
    const items = Object.entries(receiveQtys)
      .map(([id, received_qty]) => ({ id: Number(id), received_qty: Number(received_qty) }))
      .filter((i) => i.received_qty > 0)
      .map((i): { id: number; received_qty: number; serials?: string[] } => {
        const serials = (receiveSerials[i.id] ?? []).map((s) => s.trim()).filter(Boolean);
        return serials.length > 0 ? { ...i, serials } : i;
      });

    if (items.length === 0) {
      toast.error('Enter at least one quantity to receive');
      return;
    }

    const overCount = items.find((i) => (i.serials?.length ?? 0) > i.received_qty);
    if (overCount) {
      toast.error(`Entered more serial numbers than the quantity being received for one item.`);
      return;
    }

    setIsReceiving(true);
    try {
      await adminService.receivePurchase(po.id, { items });
      toast.success('Goods received successfully.');
      setIsReceiveOpen(false);
      fetchPo();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setIsReceiving(false);
    }
  };

  // A batch's returnable-on-paper quantity (received - already returned) — the modal further
  // caps the default for display by however much is still physically in stock; the rest are out
  // with customers and must come back from an order first (enforced server-side either way).
  const returnableQty = (item: PurchaseOrderItem) =>
    Math.max(0, item.received_qty - item.returned_qty);

  const inStockSerialsFor = (item: PurchaseOrderItem) =>
    (item.serials ?? []).filter((s) => s.status === 'in_stock');

  const openReturn = () => {
    if (!po?.items) return;
    const defaults: Record<number, number> = {};
    po.items.forEach((item) => {
      const returnable = returnableQty(item);
      if (returnable > 0) defaults[item.id] = Math.min(returnable, item.product?.stock_qty ?? returnable);
    });
    setReturnQtys(defaults);
    setReturnSelectedSerials({});
    setIsReturnOpen(true);
  };

  const toggleReturnSerial = (itemId: number, serialNumber: string) => {
    setReturnSelectedSerials((prev) => {
      const current = prev[itemId] ?? [];
      if (current.includes(serialNumber)) {
        return { ...prev, [itemId]: current.filter((s) => s !== serialNumber) };
      }
      const qty = returnQtys[itemId] ?? 0;
      if (current.length >= qty) {
        toast.error(`Only ${qty} unit(s) are being returned for this line — deselect one first, or raise the quantity.`);
        return prev;
      }
      return { ...prev, [itemId]: [...current, serialNumber] };
    });
  };

  const submitReturn = async (items: { id: number; quantity: number; serials?: string[] }[], collectRefundNow: boolean) => {
    if (!po) return;
    setIsReturning(true);
    try {
      await adminService.returnPurchaseItems(po.id, { items, collect_refund_now: collectRefundNow });
      toast.success(collectRefundNow ? 'Goods returned to supplier — refund recorded as collected in cash.' : 'Goods returned to supplier.');
      setIsReturnOpen(false);
      setRefundCollectPrompt(null);
      fetchPo();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setIsReturning(false);
    }
  };

  const handleReturn = async () => {
    if (!po) return;
    const items = Object.entries(returnQtys)
      .map(([id, quantity]) => ({ id: Number(id), quantity: Number(quantity) }))
      .filter((i) => i.quantity > 0)
      .map((i): { id: number; quantity: number; serials?: string[] } => {
        const serials = returnSelectedSerials[i.id] ?? [];
        return serials.length > 0 ? { ...i, serials } : i;
      });

    if (items.length === 0) {
      toast.error('Enter at least one quantity to return');
      return;
    }

    const mismatched = items.find((i) => (i.serials?.length ?? 0) > 0 && i.serials!.length !== i.quantity);
    if (mismatched) {
      toast.error('The number of serials selected must match the quantity being returned for that line.');
      return;
    }

    // Mirrors PurchaseOrderController::returnToSupplier()'s split exactly: whatever's still
    // outstanding gets eaten first, and only the leftover past that is a refund the supplier now
    // owes back — that's the only portion worth asking about here.
    const returnedValue = items.reduce((sum, i) => {
      const item = po.items?.find((it) => it.id === i.id);
      return sum + (item ? i.quantity * Number(item.unit_cost) : 0);
    }, 0);
    const againstUnpaid = Math.min(returnedValue, po.outstanding_payable);
    const againstPaid = Math.round((returnedValue - againstUnpaid) * 100) / 100;

    if (againstPaid > 0) {
      setRefundCollectPrompt({ items, amount: againstPaid });
      return;
    }

    submitReturn(items, false);
  };

  // Undo some or all of a prior return-to-supplier — the mirror image of the Return flow above,
  // built the same way: default quantities from what's actually restockable (returned_qty), and
  // an optional per-serial picker scoped to serials currently sitting at `returned`.
  const returnedSerialsFor = (item: PurchaseOrderItem) =>
    (item.serials ?? []).filter((s) => s.status === 'returned');

  const openRestock = () => {
    if (!po?.items) return;
    const defaults: Record<number, number> = {};
    po.items.forEach((item) => {
      if (item.returned_qty > 0) defaults[item.id] = item.returned_qty;
    });
    setRestockQtys(defaults);
    setRestockSelectedSerials({});
    setIsRestockOpen(true);
  };

  const toggleRestockSerial = (itemId: number, serialNumber: string) => {
    setRestockSelectedSerials((prev) => {
      const current = prev[itemId] ?? [];
      if (current.includes(serialNumber)) {
        return { ...prev, [itemId]: current.filter((s) => s !== serialNumber) };
      }
      const qty = restockQtys[itemId] ?? 0;
      if (current.length >= qty) {
        toast.error(`Only ${qty} unit(s) are being restocked for this line — deselect one first, or raise the quantity.`);
        return prev;
      }
      return { ...prev, [itemId]: [...current, serialNumber] };
    });
  };

  const handleRestock = async () => {
    if (!po) return;
    const items = Object.entries(restockQtys)
      .map(([id, quantity]) => ({ id: Number(id), quantity: Number(quantity) }))
      .filter((i) => i.quantity > 0)
      .map((i): { id: number; quantity: number; serials?: string[] } => {
        const serials = restockSelectedSerials[i.id] ?? [];
        return serials.length > 0 ? { ...i, serials } : i;
      });

    if (items.length === 0) {
      toast.error('Enter at least one quantity to restock');
      return;
    }

    const mismatched = items.find((i) => (i.serials?.length ?? 0) > 0 && i.serials!.length !== i.quantity);
    if (mismatched) {
      toast.error('The number of serials selected must match the quantity being restocked for that line.');
      return;
    }

    setIsRestocking(true);
    try {
      await adminService.restockPurchaseReturn(po.id, { items });
      toast.success('Restocked from the supplier return.');
      setIsRestockOpen(false);
      fetchPo();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setIsRestocking(false);
    }
  };

  const openCorrect = (item: PurchaseOrderItem) => {
    setCorrectingItem(item);
    setCorrectUnitCost(String(item.unit_cost));
    setCorrectReceivedQty(String(item.received_qty));
    setCorrectReason('');
  };

  const handleCorrect = async () => {
    if (!po || !correctingItem) return;

    const unitCost = parseFloat(correctUnitCost);
    const receivedQty = parseInt(correctReceivedQty, 10);
    if (isNaN(unitCost) || unitCost < 0) {
      toast.error('Enter a valid unit cost');
      return;
    }
    if (isNaN(receivedQty) || receivedQty < 0) {
      toast.error('Enter a valid received quantity');
      return;
    }
    if (!correctReason.trim()) {
      toast.error('Enter a reason for this correction');
      return;
    }

    setIsCorrecting(true);
    try {
      await adminService.correctPurchaseReceipt(po.id, {
        items: [{ id: correctingItem.id, unit_cost: unitCost, received_qty: receivedQty, reason: correctReason.trim() }],
      });
      toast.success('Receipt corrected.');
      setCorrectingItem(null);
      fetchPo();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setIsCorrecting(false);
    }
  };

  const openPay = () => {
    if (!po) return;
    setPayAmount(po.outstanding_payable > 0 ? String(po.outstanding_payable) : '');
    setIsPayOpen(true);
  };

  const handlePay = async () => {
    if (!po) return;
    const amount = parseFloat(payAmount);
    if (!amount || amount <= 0) {
      toast.error('Enter a valid amount');
      return;
    }
    if (amount > po.outstanding_payable) {
      toast.error(`Amount cannot exceed the outstanding payable of ${formatCurrency(po.outstanding_payable)}`);
      return;
    }

    setIsPaying(true);
    try {
      await adminService.payPurchase(po.id, amount);
      toast.success('Payment recorded.');
      setIsPayOpen(false);
      fetchPo();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setIsPaying(false);
    }
  };

  const handleSyncLedger = async () => {
    if (!po) return;
    setIsSyncingLedger(true);
    try {
      await adminService.processPurchaseOrderSync(po.id);
      toast.success('Purchase order synced to the ledger.');
      fetchPo();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setIsSyncingLedger(false);
    }
  };

  if (error && !po) {
    return (
      <AdminLayout>
        <ErrorState title="Failed to load purchase order" message="Could not fetch purchase order details." onRetry={fetchPo} />
      </AdminLayout>
    );
  }

  const canReceive = po && ['ordered', 'partially_received'].includes(po.status);
  // Deliberately not tied to PO status — a return is allowed at any stage after anything's been
  // received, including on an already-'received' PO (matches the backend's own guard).
  const canReturn = po?.items?.some((item) => returnableQty(item) > 0) ?? false;
  const canRestock = po?.items?.some((item) => item.returned_qty > 0) ?? false;
  const canPay = po && po.outstanding_payable > 0;
  const canCancel = po && ['draft', 'ordered', 'partially_received'].includes(po.status);
  // Matches the backend's actual lock rule (PurchaseOrder::isLocked() blocks only 'received'
  // and 'cancelled') — editable any time before goods start coming in, not just while draft.
  const canEdit = po && ['draft', 'ordered'].includes(po.status);
  const canDelete = po?.status === 'draft';
  const canDownload = po && po.status !== 'draft';

  return (
    <AdminLayout>
      <div className="page-header">
        <div className="flex items-center gap-4 mb-2">
          <Button variant="ghost" size="sm" onClick={() => router.push('/purchases')}>
            <ArrowLeft className="w-4 h-4 mr-1" />
            Back to Purchase Orders
          </Button>
        </div>
        {!isLoading && po && (
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="page-title">Purchase Order {po.po_number}</h1>
              <p className="page-description">Created on {formatDateTime(po.created_at)}</p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={STATUS_CONFIG[po.status].variant}>{STATUS_CONFIG[po.status].label}</Badge>
              <Button variant="ghost" size="sm" onClick={() => setIsHistoryOpen(true)} title="View History">
                <History className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <LoadingSpinner size="lg" text="Loading purchase order..." />
        </div>
      ) : po ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main content */}
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Package className="w-5 h-5" />
                  Order Items
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {po.items && po.items.length > 0 ? (
                  <>
                    <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50 border-y">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Product</th>
                          <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Ordered</th>
                          <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Received</th>
                          <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Unit Cost</th>
                          <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {po.items.map((item) => {
                          const pct = item.quantity > 0 ? Math.min(100, Math.round((item.received_qty / item.quantity) * 100)) : 0;
                          return (
                            <tr key={item.id} className="hover:bg-gray-50">
                              <td className="px-6 py-4">
                                <p className="font-medium text-gray-900">{item.product?.name || `Product #${item.product_id}`}</p>
                                {item.product?.sku && <p className="text-xs text-gray-400 mt-0.5">{item.product.sku}</p>}
                                {item.warranty_value != null && item.warranty_unit && (
                                  <p className="text-xs text-emerald-600 mt-0.5">
                                    {item.warranty_value} {item.warranty_unit}{item.warranty_value === 1 ? '' : 's'} warranty
                                  </p>
                                )}
                              </td>
                              <td className="px-6 py-4 text-right text-gray-600">{item.quantity}</td>
                              <td className="px-6 py-4 text-right">
                                <div className="flex flex-col items-end gap-1">
                                  <span className="text-gray-600">{item.received_qty} / {item.quantity}</span>
                                  <div className="w-20 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                                    <div
                                      className={`h-full ${pct >= 100 ? 'bg-green-500' : 'bg-amber-500'}`}
                                      style={{ width: `${pct}%` }}
                                    />
                                  </div>
                                  {item.returned_qty > 0 && (
                                    <span className="text-xs text-orange-600">{item.returned_qty} returned</span>
                                  )}
                                </div>
                              </td>
                              <td className="px-6 py-4 text-right text-gray-600">
                                <div className="flex items-center justify-end gap-1.5">
                                  {formatCurrency(Number(item.unit_cost))}
                                  {canCorrectReceipts && item.received_qty > 0 && (
                                    <button
                                      type="button"
                                      onClick={() => openCorrect(item)}
                                      title="Correct this line's received cost/quantity"
                                      className="text-gray-300 hover:text-primary-600"
                                    >
                                      <Pencil className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                </div>
                              </td>
                              <td className="px-6 py-4 text-right font-semibold">{formatCurrency(Number(item.total_cost))}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                    </div>

                    <div className="px-6 py-4 bg-gray-50 space-y-2">
                      <div className="flex justify-between text-sm text-gray-600">
                        <span>Subtotal</span>
                        <span>{formatCurrency(Number(po.subtotal))}</span>
                      </div>
                      <div className="flex justify-between text-sm text-gray-600">
                        <span>Tax</span>
                        <span>{formatCurrency(Number(po.tax))}</span>
                      </div>
                      <div className="flex justify-between text-sm text-gray-600">
                        <span>Shipping</span>
                        <span>{formatCurrency(Number(po.shipping_cost))}</span>
                      </div>
                      <div className="flex justify-between font-bold text-lg border-t pt-2">
                        <span>Total</span>
                        <span>{formatCurrency(Number(po.total))}</span>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="px-6 py-8 text-center text-gray-500">No items in this purchase order</div>
                )}
              </CardContent>
            </Card>

            {po.notes && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="w-5 h-5" />
                    Notes
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-gray-700 bg-gray-50 rounded-lg p-3 whitespace-pre-wrap">{po.notes}</p>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {po.received_value > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Wallet className="w-4 h-4" />
                    Payment Status
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <dl className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <dt className="text-gray-500">Received Value</dt>
                      <dd className="font-medium">{formatCurrency(po.received_value)}</dd>
                    </div>
                    {po.returned_value > 0 && (
                      <div className="flex justify-between">
                        <dt className="text-gray-500">Returned Value</dt>
                        <dd className="font-medium text-orange-600">-{formatCurrency(po.returned_value)}</dd>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <dt className="text-gray-500">Paid to Supplier</dt>
                      <dd className="font-medium text-green-600">{formatCurrency(Number(po.paid_amount))}</dd>
                    </div>
                    <div className="flex justify-between border-t pt-2">
                      <dt className="text-gray-500">Outstanding</dt>
                      <dd className={`font-bold ${po.outstanding_payable > 0 ? 'text-amber-600' : 'text-green-600'}`}>
                        {formatCurrency(po.outstanding_payable)}
                      </dd>
                    </div>
                    {po.refund_due_from_supplier > 0 && (
                      <div className="flex justify-between border-t pt-2">
                        <dt className="text-gray-500">Refund Due From Supplier</dt>
                        <dd className="font-bold text-blue-600">{formatCurrency(po.refund_due_from_supplier)}</dd>
                      </div>
                    )}
                  </dl>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Order Details</CardTitle>
              </CardHeader>
              <CardContent>
                <dl className="space-y-4">
                  <div>
                    <dt className="text-xs text-gray-500">Supplier</dt>
                    <dd className="text-sm font-medium">{po.supplier?.name || '—'}</dd>
                    {po.supplier?.phone && <dd className="text-xs text-gray-500">{po.supplier.phone}</dd>}
                  </div>
                  <div>
                    <dt className="text-xs text-gray-500">Expected Date</dt>
                    <dd className="text-sm">{po.expected_date ? formatDate(po.expected_date) : 'N/A'}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-gray-500">Ordered At</dt>
                    <dd className="text-sm">{po.ordered_at ? formatDateTime(po.ordered_at) : 'N/A'}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-gray-500">Received At</dt>
                    <dd className="text-sm">{po.received_at ? formatDateTime(po.received_at) : 'N/A'}</dd>
                  </div>
                  {po.creator && (
                    <div>
                      <dt className="text-xs text-gray-500">Created By</dt>
                      <dd className="text-sm">{po.creator.name}</dd>
                    </div>
                  )}
                </dl>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {po.status === 'draft' && (
                  <Button onClick={handleMarkOrdered} isLoading={isMarkingOrdered} className="w-full justify-start">
                    <Truck className="w-4 h-4 mr-2" />
                    Mark as Ordered
                  </Button>
                )}
                {canReceive && (
                  <Button onClick={openReceive} className="w-full justify-start bg-green-600 hover:bg-green-700">
                    <CheckCircle2 className="w-4 h-4 mr-2" />
                    Receive Goods
                  </Button>
                )}
                {canReturn && (
                  <Button onClick={openReturn} variant="outline" className="w-full justify-start border-orange-300 text-orange-700 hover:bg-orange-50">
                    <Undo2 className="w-4 h-4 mr-2" />
                    Return to Supplier
                  </Button>
                )}
                {canRestock && (
                  <Button onClick={openRestock} variant="outline" className="w-full justify-start border-teal-300 text-teal-700 hover:bg-teal-50">
                    <Undo2 className="w-4 h-4 mr-2 -scale-x-100" />
                    Restock from Return
                  </Button>
                )}
                {canPay && (
                  <Button onClick={openPay} className="w-full justify-start bg-blue-600 hover:bg-blue-700">
                    <Wallet className="w-4 h-4 mr-2" />
                    Pay Supplier
                  </Button>
                )}
                {po.unposted_received_value > 0 && (
                  <Button onClick={handleSyncLedger} isLoading={isSyncingLedger} className="w-full justify-start bg-amber-500 hover:bg-amber-600">
                    <ArrowUpCircle className="w-4 h-4 mr-2" />
                    Sync to Ledger
                  </Button>
                )}
                {canEdit && (
                  <Link href={`/purchases/${po.id}/edit`} className="block">
                    <Button variant="outline" className="w-full justify-start">
                      <Pencil className="w-4 h-4 mr-2" />
                      Edit
                    </Button>
                  </Link>
                )}
                {canDownload && (
                  <Button
                    variant="outline"
                    onClick={handleDownload}
                    isLoading={isDownloading}
                    className="w-full justify-start"
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Download PDF
                  </Button>
                )}
                {Number(po.paid_amount ?? 0) > 0 && (
                  <>
                    <Button
                      variant="outline"
                      onClick={handlePreviewVoucher}
                      isLoading={previewingVoucher}
                      className="w-full justify-start border-blue-300 text-blue-700 hover:bg-blue-50"
                    >
                      <Eye className="w-4 h-4 mr-2" />
                      Preview & Print Voucher
                    </Button>
                    <Button
                      variant="outline"
                      onClick={handleDownloadVoucher}
                      isLoading={isDownloadingVoucher}
                      className="w-full justify-start border-blue-300 text-blue-700 hover:bg-blue-50"
                    >
                      <Receipt className="w-4 h-4 mr-2" />
                      Download Payment Voucher
                    </Button>
                  </>
                )}
                {canCancel && (
                  <Button
                    variant="outline"
                    onClick={() => setIsCancelOpen(true)}
                    className="w-full justify-start border-red-300 text-red-600 hover:bg-red-50"
                  >
                    <XCircle className="w-4 h-4 mr-2" />
                    Cancel Order
                  </Button>
                )}
                {canDelete && (
                  <Button
                    variant="outline"
                    onClick={() => setIsDeleteOpen(true)}
                    className="w-full justify-start border-red-300 text-red-600 hover:bg-red-50"
                  >
                    <XCircle className="w-4 h-4 mr-2" />
                    Delete
                  </Button>
                )}
                {po.status === 'received' || po.status === 'cancelled' ? (
                  <p className="text-xs text-gray-400 pt-1">
                    This purchase order is {po.status} and is now read-only.
                  </p>
                ) : null}
              </CardContent>
            </Card>
          </div>
        </div>
      ) : null}

      {/* Receive Goods Modal */}
      <Modal isOpen={isReceiveOpen} onClose={() => setIsReceiveOpen(false)} title="Receive Goods" size="md">
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Enter the quantity received for each item. Quantities default to the remaining amount.
          </p>
          <div className="space-y-3">
            {po?.items?.filter((item) => item.quantity - item.received_qty > 0).map((item) => {
              const remaining = item.quantity - item.received_qty;
              const qty = receiveQtys[item.id] ?? 0;
              const serialInputs = receiveSerials[item.id] ?? [];
              const serialCount = serialInputs.map((s) => s.trim()).filter(Boolean).length;
              return (
                <div key={item.id} className="border border-gray-200 rounded-lg p-3 space-y-2">
                  <div className="flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <p className="font-medium text-gray-900 text-sm truncate">{item.product?.name || `Product #${item.product_id}`}</p>
                      <p className="text-xs text-gray-500">Remaining: {remaining} of {item.quantity}</p>
                    </div>
                    <input
                      type="number"
                      min={0}
                      max={remaining}
                      value={qty}
                      onChange={(e) => {
                        const val = Math.max(0, Math.min(remaining, parseInt(e.target.value) || 0));
                        setReceiveQtys((prev) => ({ ...prev, [item.id]: val }));
                      }}
                      className="w-24 px-2 py-1.5 border border-gray-300 rounded-lg text-sm text-right focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                  {qty > 0 && (
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-xs font-medium text-gray-600">Serial numbers (optional)</label>
                        <span className={`text-xs ${serialCount > qty ? 'text-red-600' : 'text-gray-400'}`}>
                          {serialCount} of {qty}
                        </span>
                      </div>
                      <div className="space-y-1.5">
                        {serialInputs.map((value, index) => (
                          <div key={index} className="flex items-center gap-1.5">
                            <input
                              type="text"
                              value={value}
                              onChange={(e) => updateSerialInput(item.id, index, e.target.value)}
                              placeholder={`Serial #${index + 1}`}
                              className="flex-1 px-2 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                            />
                            <button
                              type="button"
                              onClick={() => removeSerialInput(item.id, index)}
                              className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                        <button
                          type="button"
                          onClick={() => addSerialInput(item.id)}
                          disabled={serialInputs.length >= qty}
                          className="flex items-center gap-1 text-xs font-medium text-primary-600 hover:text-primary-700 disabled:text-gray-300 disabled:cursor-not-allowed"
                        >
                          <Plus className="w-3.5 h-3.5" /> Add serial number
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
            {po?.items?.every((item) => item.quantity - item.received_qty <= 0) && (
              <p className="text-sm text-gray-500 text-center py-4">All items have been fully received.</p>
            )}
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => setIsReceiveOpen(false)}>Cancel</Button>
            <Button onClick={handleReceive} isLoading={isReceiving}>Confirm Receive</Button>
          </div>
        </div>
      </Modal>

      {/* Return to Supplier Modal */}
      <Modal isOpen={isReturnOpen} onClose={() => setIsReturnOpen(false)} title="Return to Supplier" size="md">
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Enter the quantity to return for each item. Only units still physically in stock can be
            returned — anything currently sold must be returned/refunded from its order first.
          </p>
          <div className="space-y-3">
            {po?.items?.filter((item) => returnableQty(item) > 0).map((item) => {
              const returnable = returnableQty(item);
              const qty = returnQtys[item.id] ?? 0;
              const availableSerials = inStockSerialsFor(item);
              const selected = returnSelectedSerials[item.id] ?? [];
              const stockShort = item.product && item.product.stock_qty < returnable;
              return (
                <div key={item.id} className="border border-gray-200 rounded-lg p-3 space-y-2">
                  <div className="flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <p className="font-medium text-gray-900 text-sm truncate">{item.product?.name || `Product #${item.product_id}`}</p>
                      <p className="text-xs text-gray-500">
                        Returnable: {returnable}
                        {stockShort && (
                          <span className="text-amber-600"> (only {item.product?.stock_qty} currently in stock — the rest are sold)</span>
                        )}
                      </p>
                    </div>
                    <input
                      type="number"
                      min={0}
                      max={returnable}
                      value={qty}
                      onChange={(e) => {
                        const val = Math.max(0, Math.min(returnable, parseInt(e.target.value) || 0));
                        setReturnQtys((prev) => ({ ...prev, [item.id]: val }));
                      }}
                      className="w-24 px-2 py-1.5 border border-gray-300 rounded-lg text-sm text-right focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                  {qty > 0 && availableSerials.length > 0 && (
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-xs font-medium text-gray-600">Specific units (optional — leave blank to auto-pick the oldest)</label>
                        <span className={`text-xs ${selected.length > qty ? 'text-red-600' : 'text-gray-400'}`}>
                          {selected.length} of {qty}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {availableSerials.map((s) => {
                          const isSelected = selected.includes(s.serial_number);
                          return (
                            <button
                              type="button"
                              key={s.id}
                              onClick={() => toggleReturnSerial(item.id, s.serial_number)}
                              className={`px-2 py-1 rounded-lg text-xs border ${isSelected ? 'bg-orange-100 border-orange-300 text-orange-700' : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'}`}
                            >
                              {s.serial_number}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
            {po?.items?.every((item) => returnableQty(item) <= 0) && (
              <p className="text-sm text-gray-500 text-center py-4">Nothing is currently eligible to return.</p>
            )}
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => setIsReturnOpen(false)}>Cancel</Button>
            <Button onClick={handleReturn} isLoading={isReturning} className="bg-orange-600 hover:bg-orange-700">Confirm Return</Button>
          </div>
        </div>
      </Modal>

      {/* Refund-collected prompt — only shown when the return includes value already paid for,
          meaning the supplier now owes a refund. Doesn't block the return either way; it just
          decides which account (Cash vs. Accounts Receivable) the refund posts to. */}
      <Modal
        isOpen={!!refundCollectPrompt}
        onClose={() => setRefundCollectPrompt(null)}
        title="Refund Due From Supplier"
        size="sm"
      >
        {refundCollectPrompt && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              This purchase order was already paid, so {formatCurrency(refundCollectPrompt.amount)} of this
              return is a refund the supplier now owes back — did they hand it back in cash right now?
            </p>
            <div className="flex flex-col gap-2 pt-1">
              <Button
                onClick={() => submitReturn(refundCollectPrompt.items, true)}
                isLoading={isReturning}
                className="bg-green-600 hover:bg-green-700"
              >
                Yes — collected {formatCurrency(refundCollectPrompt.amount)} in cash now
              </Button>
              <Button
                variant="outline"
                onClick={() => submitReturn(refundCollectPrompt.items, false)}
                isLoading={isReturning}
              >
                Not yet — keep it as a refund due
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setRefundCollectPrompt(null)} disabled={isReturning}>
                Cancel
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Restock from Return Modal — undoes some or all of a prior return-to-supplier */}
      <Modal isOpen={isRestockOpen} onClose={() => setIsRestockOpen(false)} title="Restock from Return" size="md">
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Use this if a return to the supplier needs to be undone — the unit(s) never actually
            left, came back, or the return was logged in error. Stock and the ledger are restored;
            it does not automatically re-link a restocked serial to any order.
          </p>
          <div className="space-y-3">
            {po?.items?.filter((item) => item.returned_qty > 0).map((item) => {
              const returnedQty = item.returned_qty;
              const qty = restockQtys[item.id] ?? 0;
              const availableSerials = returnedSerialsFor(item);
              const selected = restockSelectedSerials[item.id] ?? [];
              return (
                <div key={item.id} className="border border-gray-200 rounded-lg p-3 space-y-2">
                  <div className="flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <p className="font-medium text-gray-900 text-sm truncate">{item.product?.name || `Product #${item.product_id}`}</p>
                      <p className="text-xs text-gray-500">Currently returned to supplier: {returnedQty}</p>
                    </div>
                    <input
                      type="number"
                      min={0}
                      max={returnedQty}
                      value={qty}
                      onChange={(e) => {
                        const val = Math.max(0, Math.min(returnedQty, parseInt(e.target.value) || 0));
                        setRestockQtys((prev) => ({ ...prev, [item.id]: val }));
                      }}
                      className="w-24 px-2 py-1.5 border border-gray-300 rounded-lg text-sm text-right focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                  {qty > 0 && availableSerials.length > 0 && (
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-xs font-medium text-gray-600">Specific units (optional — leave blank to auto-pick the oldest)</label>
                        <span className={`text-xs ${selected.length > qty ? 'text-red-600' : 'text-gray-400'}`}>
                          {selected.length} of {qty}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {availableSerials.map((s) => {
                          const isSelected = selected.includes(s.serial_number);
                          return (
                            <button
                              type="button"
                              key={s.id}
                              onClick={() => toggleRestockSerial(item.id, s.serial_number)}
                              className={`px-2 py-1 rounded-lg text-xs border ${isSelected ? 'bg-teal-100 border-teal-300 text-teal-700' : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'}`}
                            >
                              {s.serial_number}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
            {po?.items?.every((item) => item.returned_qty <= 0) && (
              <p className="text-sm text-gray-500 text-center py-4">Nothing has been returned to the supplier on this order.</p>
            )}
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => setIsRestockOpen(false)}>Cancel</Button>
            <Button onClick={handleRestock} isLoading={isRestocking} className="bg-teal-600 hover:bg-teal-700">Confirm Restock</Button>
          </div>
        </div>
      </Modal>

      {/* Correct Receipt Modal */}
      <Modal isOpen={!!correctingItem} onClose={() => setCorrectingItem(null)} title="Correct Received Cost / Quantity" size="sm">
        <div className="space-y-4">
          {correctingItem && (
            <>
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 flex items-start gap-2">
                <ShieldAlert className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>
                  Use this only to fix a mistake in what was recorded when this batch was received
                  (e.g. the supplier&apos;s actual invoice differs). It posts a correcting entry to
                  Inventory/Accounts Payable for the difference — it does not undo the original receipt.
                </span>
              </div>
              <p className="text-sm text-gray-600">
                <span className="font-medium text-gray-900">{correctingItem.product?.name || `Product #${correctingItem.product_id}`}</span>
                {' '}— currently {correctingItem.received_qty} received @ {formatCurrency(Number(correctingItem.unit_cost))}
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Corrected Unit Cost (৳)</label>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={correctUnitCost}
                    onChange={(e) => setCorrectUnitCost(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Corrected Received Qty</label>
                  <input
                    type="number"
                    min={0}
                    max={correctingItem.quantity}
                    value={correctReceivedQty}
                    onChange={(e) => setCorrectReceivedQty(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Reason (required)</label>
                <input
                  type="text"
                  value={correctReason}
                  onChange={(e) => setCorrectReason(e.target.value)}
                  placeholder="e.g. Supplier invoice showed ৳450/unit, not ৳480"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
            </>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => setCorrectingItem(null)}>Cancel</Button>
            <Button onClick={handleCorrect} isLoading={isCorrecting}>Save Correction</Button>
          </div>
        </div>
      </Modal>

      {/* Pay Supplier Modal */}
      <Modal isOpen={isPayOpen} onClose={() => setIsPayOpen(false)} title="Pay Supplier" size="sm">
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Outstanding payable: <span className="font-semibold text-gray-900">{formatCurrency(po?.outstanding_payable ?? 0)}</span>
          </p>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Amount to pay</label>
            <input
              type="number"
              min={0.01}
              max={po?.outstanding_payable ?? 0}
              step="0.01"
              value={payAmount}
              onChange={(e) => setPayAmount(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
            <p className="text-xs text-gray-400 mt-1">This posts Cash out / Accounts Payable down in the ledger.</p>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => setIsPayOpen(false)}>Cancel</Button>
            <Button onClick={handlePay} isLoading={isPaying}>Confirm Payment</Button>
          </div>
        </div>
      </Modal>

      <ConfirmModal
        isOpen={isCancelOpen}
        onClose={() => setIsCancelOpen(false)}
        onConfirm={handleCancel}
        title="Cancel Purchase Order"
        message={`Cancel purchase order "${po?.po_number}"? Any already-received stock will not be reversed.`}
        confirmLabel="Cancel Order"
        variant="danger"
        isLoading={isCancelling}
      />

      <ConfirmModal
        isOpen={isDeleteOpen}
        onClose={() => setIsDeleteOpen(false)}
        onConfirm={handleDelete}
        title="Delete Purchase Order"
        message={`Delete draft purchase order "${po?.po_number}"? This cannot be undone.`}
        confirmLabel="Delete"
        variant="danger"
        isLoading={isDeleting}
      />

      {po && (
        <HistoryModal
          isOpen={isHistoryOpen}
          onClose={() => setIsHistoryOpen(false)}
          resourceType="PurchaseOrder"
          resourceId={po.id}
          resourceLabel={`PO #${po.po_number}`}
          createdBy={po.creator}
          createdAt={po.created_at}
          updatedAt={po.updated_at}
        />
      )}
    </AdminLayout>
  );
}
