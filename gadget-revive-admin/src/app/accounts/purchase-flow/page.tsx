'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import {
  FileEdit, Truck, PackageCheck, Wallet, ArrowRight, RefreshCw,
  CheckCircle2, AlertTriangle,
} from 'lucide-react';
import { AdminLayout } from '@/components/layout';
import {
  Card, CardContent, CardHeader, CardTitle,
  Button, Badge, TAccountExample, StepFlow,
  LoadingSpinner, ErrorState,
} from '@/components/ui';
import { PurchaseOrder, PurchaseOrderStatus } from '@/types';
import { formatCurrency, getErrorMessage } from '@/lib/utils';
import adminService from '@/lib/adminService';
import toast from 'react-hot-toast';

const STATUS_CONFIG: Record<PurchaseOrderStatus, { label: string; variant: 'default' | 'info' | 'warning' | 'success' | 'danger' }> = {
  draft: { label: 'Draft', variant: 'default' },
  ordered: { label: 'Ordered', variant: 'info' },
  partially_received: { label: 'Partially Received', variant: 'warning' },
  received: { label: 'Received', variant: 'success' },
  cancelled: { label: 'Cancelled', variant: 'danger' },
};

const FLOW_STAGES = [
  { icon: FileEdit, label: 'Draft', note: 'No accounting impact yet' },
  { icon: Truck, label: 'Ordered', note: 'No accounting impact yet' },
  { icon: PackageCheck, label: 'Received', note: 'Posts Inventory / Accounts Payable' },
  { icon: Wallet, label: 'Paid', note: 'Posts Accounts Payable / Cash' },
];

export default function PurchaseOrderFlowPage() {
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [ledgerApBalance, setLedgerApBalance] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(false);
    try {
      const [poRes, tbRes] = await Promise.all([
        adminService.getPurchases({ per_page: 100, status: undefined }),
        adminService.getTrialBalance(),
      ]);
      const payload = poRes.data as unknown as { data: PurchaseOrder[] };
      setOrders(Array.isArray(payload.data) ? payload.data : []);

      const apRow = tbRes.data?.data?.accounts.find((a) => a.code === '2000');
      setLedgerApBalance(apRow ? apRow.credit - apRow.debit : 0);
    } catch (err) {
      toast.error(getErrorMessage(err));
      setError(true);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const nonCancelled = orders.filter((po) => po.status !== 'cancelled');
  const totalOutstandingFromPOs = Math.round(nonCancelled.reduce((s, po) => s + po.outstanding_payable, 0) * 100) / 100;
  const totalReceivedValue = Math.round(nonCancelled.reduce((s, po) => s + po.received_value, 0) * 100) / 100;
  const totalPaid = Math.round(nonCancelled.reduce((s, po) => s + Number(po.paid_amount), 0) * 100) / 100;

  const isReconciled = ledgerApBalance !== null && Math.round((totalOutstandingFromPOs - ledgerApBalance) * 100) === 0;

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Purchase Order Accounting Flow</h1>
          <p className="text-sm text-gray-500 mt-1">
            How every purchase order moves through the ledger, and a live check that Purchases and Accounts agree.
          </p>
        </div>

        {/* Graphical flow */}
        <Card>
          <CardHeader><CardTitle>The Lifecycle</CardTitle></CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              {FLOW_STAGES.map((stage, i) => (
                <React.Fragment key={stage.label}>
                  <div className="flex-1 rounded-lg border border-gray-200 p-4 text-center">
                    <stage.icon className="w-6 h-6 mx-auto mb-2 text-primary-600" />
                    <p className="font-semibold text-gray-900">{stage.label}</p>
                    <p className="text-xs text-gray-500 mt-1">{stage.note}</p>
                  </div>
                  {i < FLOW_STAGES.length - 1 && (
                    <ArrowRight className="w-5 h-5 text-gray-300 mx-auto sm:mx-0 rotate-90 sm:rotate-0 flex-shrink-0" />
                  )}
                </React.Fragment>
              ))}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
              <div>
                <p className="text-sm font-semibold text-gray-900 mb-2">Step 1 — Receiving goods</p>
                <p className="text-xs text-gray-500 mb-2">Posted automatically when you click &quot;Receive Goods&quot; on a purchase order.</p>
                <TAccountExample
                  caption="Example: receiving ৳150 worth of stock"
                  debits={[{ label: 'Inventory', amount: 150 }]}
                  credits={[{ label: 'Accounts Payable - Suppliers', amount: 150 }]}
                />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900 mb-2">Step 2 — Paying the supplier</p>
                <p className="text-xs text-gray-500 mb-2">Posted automatically when you click &quot;Pay Supplier&quot; on a received purchase order.</p>
                <TAccountExample
                  caption="Example: paying that ৳150 in full"
                  debits={[{ label: 'Accounts Payable - Suppliers', amount: 150 }]}
                  credits={[{ label: 'Cash', amount: 150 }]}
                />
              </div>
            </div>

            <div className="mt-6">
              <p className="text-sm font-semibold text-gray-900 mb-2">Why this matters</p>
              <StepFlow steps={[
                'Receiving goods increases what you own (Inventory) and what you owe the supplier (Accounts Payable) — by the same amount, so it stays balanced.',
                'Paying the supplier reduces what you owe (Accounts Payable) and reduces your Cash — again by the same amount.',
                'If a purchase order is received but never paid, its value sits permanently in Accounts Payable until a payment is recorded — that outstanding amount is exactly what the reconciliation check below tracks.',
                'Cancelling a purchase order after some goods were already received does NOT reverse that stock or its accounting — the goods are real and already in your warehouse.',
              ]} />
            </div>
          </CardContent>
        </Card>

        {/* Reconciliation check */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Reconciliation: Purchases vs. Ledger</CardTitle>
            <Button variant="ghost" size="sm" onClick={fetchData} leftIcon={<RefreshCw className="w-4 h-4" />}>
              Refresh
            </Button>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center py-8"><LoadingSpinner /></div>
            ) : error ? (
              <ErrorState message="Failed to load reconciliation data." onRetry={fetchData} />
            ) : (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
                  <div className="rounded-lg border border-gray-200 p-4">
                    <p className="text-xs text-gray-500">Total Received (all POs)</p>
                    <p className="text-lg font-bold text-gray-900">{formatCurrency(totalReceivedValue)}</p>
                  </div>
                  <div className="rounded-lg border border-gray-200 p-4">
                    <p className="text-xs text-gray-500">Total Paid to Suppliers</p>
                    <p className="text-lg font-bold text-green-600">{formatCurrency(totalPaid)}</p>
                  </div>
                  <div className="rounded-lg border border-gray-200 p-4">
                    <p className="text-xs text-gray-500">Outstanding (sum of open POs)</p>
                    <p className="text-lg font-bold text-amber-600">{formatCurrency(totalOutstandingFromPOs)}</p>
                  </div>
                </div>

                <div className={`rounded-md p-3 text-sm font-medium flex items-center gap-2 ${isReconciled ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                  {isReconciled ? <CheckCircle2 className="w-4 h-4 flex-shrink-0" /> : <AlertTriangle className="w-4 h-4 flex-shrink-0" />}
                  {isReconciled ? (
                    <span>
                      Synced — outstanding payable across all purchase orders ({formatCurrency(totalOutstandingFromPOs)})
                      exactly matches the &quot;Accounts Payable - Suppliers&quot; ledger balance ({formatCurrency(ledgerApBalance ?? 0)}).
                    </span>
                  ) : (
                    <span>
                      Out of sync — purchase orders total {formatCurrency(totalOutstandingFromPOs)} outstanding, but the
                      ledger shows {formatCurrency(ledgerApBalance ?? 0)} in Accounts Payable - Suppliers. This should
                      never happen automatically — check for a manual journal entry posted directly to account 2000.
                    </span>
                  )}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Live PO table */}
        <Card>
          <CardHeader><CardTitle>Purchase Orders</CardTitle></CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center py-8"><LoadingSpinner /></div>
            ) : orders.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-8">No purchase orders yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 text-left">
                      <th className="pb-3 pr-4 font-semibold text-gray-600">PO Number</th>
                      <th className="pb-3 pr-4 font-semibold text-gray-600">Supplier</th>
                      <th className="pb-3 pr-4 font-semibold text-gray-600">Status</th>
                      <th className="pb-3 pr-4 font-semibold text-gray-600 text-right">Total</th>
                      <th className="pb-3 pr-4 font-semibold text-gray-600 text-right">Received</th>
                      <th className="pb-3 pr-4 font-semibold text-gray-600 text-right">Paid</th>
                      <th className="pb-3 font-semibold text-gray-600 text-right">Outstanding</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {orders.map((po) => (
                      <tr key={po.id} className="hover:bg-gray-50">
                        <td className="py-3 pr-4 font-mono">
                          <Link href={`/purchases/${po.id}`} className="text-primary-600 hover:underline">{po.po_number}</Link>
                        </td>
                        <td className="py-3 pr-4 text-gray-700">{po.supplier?.name || '—'}</td>
                        <td className="py-3 pr-4"><Badge variant={STATUS_CONFIG[po.status].variant}>{STATUS_CONFIG[po.status].label}</Badge></td>
                        <td className="py-3 pr-4 text-right text-gray-900">{formatCurrency(Number(po.total))}</td>
                        <td className="py-3 pr-4 text-right text-gray-900">{formatCurrency(po.received_value)}</td>
                        <td className="py-3 pr-4 text-right text-green-600">{formatCurrency(Number(po.paid_amount))}</td>
                        <td className={`py-3 text-right font-medium ${po.outstanding_payable > 0 ? 'text-amber-600' : 'text-gray-400'}`}>
                          {formatCurrency(po.outstanding_payable)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
