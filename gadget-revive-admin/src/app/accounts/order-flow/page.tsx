'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import {
  Clock, ReceiptText, Wallet, Undo2, ArrowRight, RefreshCw,
  CheckCircle2, AlertTriangle,
} from 'lucide-react';
import { AdminLayout } from '@/components/layout';
import {
  Card, CardContent, CardHeader, CardTitle,
  Button, Badge, TAccountExample, StepFlow,
  LoadingSpinner, ErrorState,
} from '@/components/ui';
import { Order } from '@/types';
import { formatCurrency, getErrorMessage } from '@/lib/utils';
import adminService from '@/lib/adminService';
import toast from 'react-hot-toast';

const FLOW_STAGES = [
  { icon: Clock, label: 'Pending / Accepted', note: 'No accounting impact yet' },
  { icon: ReceiptText, label: 'First Payment', note: 'Recognizes the full sale: Dr Accounts Receivable / Cr Sales Revenue + Tax Payable' },
  { icon: Wallet, label: 'Payment(s) Received', note: 'Each payment posts Dr Cash / Cr Accounts Receivable — full or partial, repeatable' },
  { icon: Undo2, label: 'Cancelled / Refunded', note: 'Reverses every entry posted for the order, however many payments were made' },
];

export default function OrderFlowPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [ledgerRevenueBalance, setLedgerRevenueBalance] = useState<number | null>(null);
  const [ledgerReceivableBalance, setLedgerReceivableBalance] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(false);
    try {
      const [paidRes, partialRes, refundedRes, tbRes] = await Promise.all([
        adminService.getOrders({ per_page: 200, payment_status: 'paid' }),
        adminService.getOrders({ per_page: 200, payment_status: 'partially_paid' }),
        adminService.getOrders({ per_page: 200, payment_status: 'refunded' }),
        adminService.getTrialBalance(),
      ]);
      const paid = paidRes.data?.data ?? [];
      const partial = partialRes.data?.data ?? [];
      const refunded = refundedRes.data?.data ?? [];
      setOrders([...paid, ...partial, ...refunded].sort((a, b) => b.id - a.id));

      const revRow = tbRes.data?.data?.accounts.find((a) => a.code === '4000');
      setLedgerRevenueBalance(revRow ? revRow.credit - revRow.debit : 0);

      const arRow = tbRes.data?.data?.accounts.find((a) => a.code === '1010');
      setLedgerReceivableBalance(arRow ? arRow.debit - arRow.credit : 0);
    } catch (err) {
      toast.error(getErrorMessage(err));
      setError(true);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Revenue is recognized in full the moment ANY payment is made — paid or partially paid orders
  // both contribute their whole (subtotal + shipping - discount) to Sales Revenue.
  const recognizedRevenue = Math.round(
    orders
      .filter((o) => o.payment_status === 'paid' || o.payment_status === 'partially_paid')
      .reduce((s, o) => s + (o.subtotal + (o.shipping ?? 0) - (o.discount ?? 0)), 0) * 100
  ) / 100;

  const totalOutstandingReceivable = Math.round(
    orders
      .filter((o) => o.payment_status === 'paid' || o.payment_status === 'partially_paid')
      .reduce((s, o) => s + (o.outstanding_receivable ?? 0), 0) * 100
  ) / 100;

  const totalRefunded = Math.round(
    orders.filter((o) => o.payment_status === 'refunded').reduce((s, o) => s + (o.refund_amount ?? o.total), 0) * 100
  ) / 100;

  const isRevenueReconciled = ledgerRevenueBalance !== null && Math.round((recognizedRevenue - ledgerRevenueBalance) * 100) === 0;
  const isReceivableReconciled = ledgerReceivableBalance !== null && Math.round((totalOutstandingReceivable - ledgerReceivableBalance) * 100) === 0;

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Order Accounting Flow</h1>
          <p className="text-sm text-gray-500 mt-1">
            How every customer order moves through the ledger — including partial payments — and a live check that Orders and Accounts agree.
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
                <p className="text-sm font-semibold text-gray-900 mb-2">Step 1 — First payment recognizes the whole sale</p>
                <p className="text-xs text-gray-500 mb-2">
                  Posted once, the very first time any payment is recorded — whether that payment covers the full order or just part of it.
                </p>
                <TAccountExample
                  caption="Example: ৳1,050 order (৳1,000 subtotal + ৳50 tax) — sale recognized"
                  debits={[{ label: 'Accounts Receivable', amount: 1050 }]}
                  credits={[{ label: 'Sales Revenue', amount: 1000 }, { label: 'Tax Payable', amount: 50 }]}
                />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900 mb-2">Step 2 — Each payment reduces what&apos;s owed</p>
                <p className="text-xs text-gray-500 mb-2">
                  Posted every time a payment comes in, for exactly that amount — this can happen more than once per order.
                </p>
                <TAccountExample
                  caption="Example: customer pays ৳400 now, ৳650 still owed"
                  debits={[{ label: 'Cash', amount: 400 }]}
                  credits={[{ label: 'Accounts Receivable', amount: 400 }]}
                />
              </div>
            </div>

            <div className="mt-4">
              <p className="text-sm font-semibold text-gray-900 mb-2">If it&apos;s cancelled or refunded afterward</p>
              <p className="text-xs text-gray-500 mb-2">
                Every entry ever posted for the order is reversed — the one-time sale recognition AND every individual
                payment — netting Cash, Accounts Receivable, and Sales Revenue back to exactly zero for that order,
                however many partial payments were made. The refund amount recorded is always what was actually paid
                (e.g. ৳400), never the full order total (e.g. ৳1,050) if it was never fully paid.
              </p>
              <TAccountExample
                caption="Reversal of the ৳400 partial payment above (order then cancelled)"
                debits={[{ label: 'Sales Revenue', amount: 1000 }, { label: 'Tax Payable', amount: 50 }, { label: 'Accounts Receivable', amount: 400 }]}
                credits={[{ label: 'Accounts Receivable', amount: 1050 }, { label: 'Cash', amount: 400 }]}
              />
            </div>

            <div className="mt-6">
              <p className="text-sm font-semibold text-gray-900 mb-2">Why this matters</p>
              <StepFlow steps={[
                'Revenue is recognized once, in full, at the first payment — not spread out per partial payment. This is what actually uses the "Accounts Receivable" account, tracking exactly how much each paid-but-not-fully-settled order still owes.',
                'A partial payment never recognizes partial revenue — the whole sale is booked immediately, and Accounts Receivable tracks the shortfall until it\'s paid off.',
                'Cancelling or refunding reverses every entry for that order, however many partial payments were made — this is enforced no matter which screen or button triggers it.',
                'Every reversal is idempotent — cancelling an already-cancelled order does nothing the second time.',
              ]} />
            </div>
          </CardContent>
        </Card>

        {/* Reconciliation check */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Reconciliation: Orders vs. Ledger</CardTitle>
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
              <div className="space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="rounded-lg border border-gray-200 p-4">
                    <p className="text-xs text-gray-500">Recognized Revenue</p>
                    <p className="text-lg font-bold text-gray-900">{formatCurrency(recognizedRevenue)}</p>
                  </div>
                  <div className="rounded-lg border border-gray-200 p-4">
                    <p className="text-xs text-gray-500">Outstanding Receivable</p>
                    <p className="text-lg font-bold text-amber-600">{formatCurrency(totalOutstandingReceivable)}</p>
                  </div>
                  <div className="rounded-lg border border-gray-200 p-4">
                    <p className="text-xs text-gray-500">Refunded</p>
                    <p className="text-lg font-bold text-red-600">{formatCurrency(totalRefunded)}</p>
                  </div>
                  <div className="rounded-lg border border-gray-200 p-4">
                    <p className="text-xs text-gray-500">Ledger Sales Revenue</p>
                    <p className="text-lg font-bold text-gray-900">{formatCurrency(ledgerRevenueBalance ?? 0)}</p>
                  </div>
                </div>

                <div className={`rounded-md p-3 text-sm font-medium flex items-center gap-2 ${isRevenueReconciled ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                  {isRevenueReconciled ? <CheckCircle2 className="w-4 h-4 flex-shrink-0" /> : <AlertTriangle className="w-4 h-4 flex-shrink-0" />}
                  {isRevenueReconciled ? (
                    <span>
                      Revenue synced — recognized revenue from paid &amp; partially-paid orders ({formatCurrency(recognizedRevenue)})
                      exactly matches the &quot;Sales Revenue&quot; ledger balance ({formatCurrency(ledgerRevenueBalance ?? 0)}).
                    </span>
                  ) : (
                    <span>
                      Revenue out of sync — orders total {formatCurrency(recognizedRevenue)} in recognized revenue, but the
                      ledger shows {formatCurrency(ledgerRevenueBalance ?? 0)} in Sales Revenue.
                    </span>
                  )}
                </div>

                <div className={`rounded-md p-3 text-sm font-medium flex items-center gap-2 ${isReceivableReconciled ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                  {isReceivableReconciled ? <CheckCircle2 className="w-4 h-4 flex-shrink-0" /> : <AlertTriangle className="w-4 h-4 flex-shrink-0" />}
                  {isReceivableReconciled ? (
                    <span>
                      Receivables synced — what customers still owe across all orders ({formatCurrency(totalOutstandingReceivable)})
                      exactly matches the &quot;Accounts Receivable&quot; ledger balance ({formatCurrency(ledgerReceivableBalance ?? 0)}).
                    </span>
                  ) : (
                    <span>
                      Receivables out of sync — orders show {formatCurrency(totalOutstandingReceivable)} still owed, but the
                      ledger&apos;s Accounts Receivable balance is {formatCurrency(ledgerReceivableBalance ?? 0)}.
                    </span>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Live order table */}
        <Card>
          <CardHeader><CardTitle>Paid, Partially Paid &amp; Refunded Orders</CardTitle></CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center py-8"><LoadingSpinner /></div>
            ) : orders.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-8">No paid, partially paid, or refunded orders yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 text-left">
                      <th className="pb-3 pr-4 font-semibold text-gray-600">Order #</th>
                      <th className="pb-3 pr-4 font-semibold text-gray-600">Customer</th>
                      <th className="pb-3 pr-4 font-semibold text-gray-600">Payment Status</th>
                      <th className="pb-3 pr-4 font-semibold text-gray-600 text-right">Total</th>
                      <th className="pb-3 pr-4 font-semibold text-gray-600 text-right">Paid</th>
                      <th className="pb-3 font-semibold text-gray-600 text-right">Outstanding / Refunded</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {orders.map((order) => (
                      <tr key={order.id} className="hover:bg-gray-50">
                        <td className="py-3 pr-4 font-mono">
                          <Link href={`/orders/${order.id}`} className="text-primary-600 hover:underline">{order.order_number}</Link>
                        </td>
                        <td className="py-3 pr-4 text-gray-700">{order.customer_name || order.customer?.name || '—'}</td>
                        <td className="py-3 pr-4">
                          <Badge variant={order.payment_status === 'paid' ? 'success' : order.payment_status === 'refunded' ? 'danger' : 'warning'}>
                            {order.payment_status === 'paid' ? 'Paid' : order.payment_status === 'refunded' ? 'Refunded' : 'Partially Paid'}
                          </Badge>
                        </td>
                        <td className="py-3 pr-4 text-right text-gray-900">{formatCurrency(order.total)}</td>
                        <td className="py-3 pr-4 text-right text-green-600">{formatCurrency(order.paid_amount ?? 0)}</td>
                        <td className="py-3 text-right">
                          {order.payment_status === 'refunded' ? (
                            <span className="text-red-600">{formatCurrency(order.refund_amount ?? order.total)}</span>
                          ) : (
                            <span className="text-amber-600">{formatCurrency(order.outstanding_receivable ?? 0)}</span>
                          )}
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
