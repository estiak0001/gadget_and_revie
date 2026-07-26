'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft, Package, Truck, FileText, Download, XCircle, Pencil, CheckCircle2, Wallet, ArrowUpCircle, History,
} from 'lucide-react';
import { AdminLayout } from '@/components/layout';
import {
  Card, CardContent, CardHeader, CardTitle,
  Button, Badge, LoadingSpinner, Modal, ConfirmModal, ErrorState, HistoryModal,
} from '@/components/ui';
import { PurchaseOrder, PurchaseOrderStatus } from '@/types';
import { formatCurrency, formatDate, formatDateTime, getErrorMessage } from '@/lib/utils';
import adminService from '@/lib/adminService';
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

  const [isReceiveOpen, setIsReceiveOpen] = useState(false);
  const [receiveQtys, setReceiveQtys] = useState<Record<number, number>>({});
  const [isReceiving, setIsReceiving] = useState(false);

  const [isPayOpen, setIsPayOpen] = useState(false);
  const [payAmount, setPayAmount] = useState('');
  const [isPaying, setIsPaying] = useState(false);

  const [isSyncingLedger, setIsSyncingLedger] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);

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

  const openReceive = () => {
    if (!po?.items) return;
    const defaults: Record<number, number> = {};
    po.items.forEach((item) => {
      const remaining = item.quantity - item.received_qty;
      if (remaining > 0) defaults[item.id] = remaining;
    });
    setReceiveQtys(defaults);
    setIsReceiveOpen(true);
  };

  const handleReceive = async () => {
    if (!po) return;
    const items = Object.entries(receiveQtys)
      .map(([id, received_qty]) => ({ id: Number(id), received_qty: Number(received_qty) }))
      .filter((i) => i.received_qty > 0);

    if (items.length === 0) {
      toast.error('Enter at least one quantity to receive');
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
  const canPay = po && po.outstanding_payable > 0;
  const canCancel = po && ['draft', 'ordered', 'partially_received'].includes(po.status);
  const canEdit = po?.status === 'draft';
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
                                </div>
                              </td>
                              <td className="px-6 py-4 text-right text-gray-600">{formatCurrency(Number(item.unit_cost))}</td>
                              <td className="px-6 py-4 text-right font-semibold">{formatCurrency(Number(item.total_cost))}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>

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
              return (
                <div key={item.id} className="flex items-center justify-between gap-4 border border-gray-200 rounded-lg p-3">
                  <div className="min-w-0">
                    <p className="font-medium text-gray-900 text-sm truncate">{item.product?.name || `Product #${item.product_id}`}</p>
                    <p className="text-xs text-gray-500">Remaining: {remaining} of {item.quantity}</p>
                  </div>
                  <input
                    type="number"
                    min={0}
                    max={remaining}
                    value={receiveQtys[item.id] ?? 0}
                    onChange={(e) => {
                      const val = Math.max(0, Math.min(remaining, parseInt(e.target.value) || 0));
                      setReceiveQtys((prev) => ({ ...prev, [item.id]: val }));
                    }}
                    className="w-24 px-2 py-1.5 border border-gray-300 rounded-lg text-sm text-right focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
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
