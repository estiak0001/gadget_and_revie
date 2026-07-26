'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { RefreshCw, CheckCircle2, Receipt, ShoppingCart, Truck, ArrowUpCircle } from 'lucide-react';
import { AdminLayout } from '@/components/layout';
import {
  Card, CardContent, CardHeader, CardTitle,
  Button, Badge, InfoButton, StepFlow,
  LoadingSpinner, ErrorState, EmptyState,
} from '@/components/ui';
import { Expense, Order, PurchaseOrder } from '@/types';
import { formatCurrency, formatDate, getErrorMessage } from '@/lib/utils';
import adminService from '@/lib/adminService';
import toast from 'react-hot-toast';

export default function PendingLedgerSyncPage() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);
  const [processingKey, setProcessingKey] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(false);
    try {
      const [expRes, ordRes, poRes] = await Promise.all([
        adminService.getPendingExpenses(),
        adminService.getPendingOrders(),
        adminService.getPendingPurchaseOrders(),
      ]);
      setExpenses(expRes.data?.data ?? []);
      setOrders(ordRes.data?.data ?? []);
      setPurchaseOrders(poRes.data?.data ?? []);
    } catch (err) {
      toast.error(getErrorMessage(err));
      setError(true);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const processExpense = async (expense: Expense) => {
    setProcessingKey(`expense-${expense.id}`);
    try {
      await adminService.processExpenseSync(expense.id);
      toast.success(`Synced expense "${expense.title}" to the ledger.`);
      setExpenses((prev) => prev.filter((e) => e.id !== expense.id));
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setProcessingKey(null);
    }
  };

  const processOrder = async (order: Order) => {
    setProcessingKey(`order-${order.id}`);
    try {
      await adminService.processOrderSync(order.id);
      toast.success(`Synced order ${order.order_number} to the ledger.`);
      setOrders((prev) => prev.filter((o) => o.id !== order.id));
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setProcessingKey(null);
    }
  };

  const processPurchaseOrder = async (po: PurchaseOrder) => {
    setProcessingKey(`po-${po.id}`);
    try {
      await adminService.processPurchaseOrderSync(po.id);
      toast.success(`Synced purchase order ${po.po_number} to the ledger.`);
      setPurchaseOrders((prev) => prev.filter((p) => p.id !== po.id));
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setProcessingKey(null);
    }
  };

  const totalPending = expenses.length + orders.length + purchaseOrders.length;

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-gray-900">Pending Ledger Sync</h1>
            <InfoButton title="What is Pending Ledger Sync?">
              <p>
                Posting to the ledger is automatic for new records — but records that existed{' '}
                <strong>before</strong> a module&apos;s ledger integration was added (historical expenses,
                orders that were already marked paid, purchase orders already received) never got their
                journal entry, and never will on their own.
              </p>
              <p>
                This page finds every one of those and lets you process them individually, whenever you&apos;re
                ready. Processing a record here posts exactly the same journal entry it would have gotten
                automatically — for an expense, that&apos;s using its original expense date, not today&apos;s
                date, so your historical books stay accurate.
              </p>
              <div>
                <p className="font-semibold text-gray-900 mb-2">How to use this page</p>
                <StepFlow steps={[
                  'Review each section — Expenses, Orders, and Purchase Orders — for anything listed.',
                  'Click "Sync to Ledger" on a row to post its missing journal entry.',
                  'The row disappears once processed — refresh to confirm the module is now fully synced.',
                  'This is safe to do at any pace; nothing here is time-sensitive or order-dependent between records.',
                ]} />
              </div>
            </InfoButton>
          </div>
          <p className="text-sm text-gray-500 mt-1">
            Historical or otherwise-missed records from Expenses, Orders, and Purchases that haven&apos;t been posted to the ledger yet.
          </p>
        </div>

        <Card>
          <CardContent className="pt-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              {totalPending === 0 ? (
                <Badge variant="success">All modules fully synced</Badge>
              ) : (
                <Badge variant="warning">{totalPending} record{totalPending !== 1 ? 's' : ''} pending</Badge>
              )}
            </div>
            <Button variant="ghost" size="sm" onClick={fetchData} leftIcon={<RefreshCw className="w-4 h-4" />}>
              Refresh
            </Button>
          </CardContent>
        </Card>

        {isLoading ? (
          <div className="flex justify-center py-12"><LoadingSpinner /></div>
        ) : error ? (
          <ErrorState message="Failed to load pending sync data." onRetry={fetchData} />
        ) : totalPending === 0 ? (
          <Card>
            <CardContent className="py-12">
              <EmptyState
                icon={<CheckCircle2 className="w-10 h-10 text-green-500" />}
                title="Everything is synced"
                description="Every expense, paid order, and received purchase order has a matching ledger entry."
              />
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Expenses */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Receipt className="w-5 h-5" />
                  Expenses
                  {expenses.length > 0 && <Badge variant="warning">{expenses.length}</Badge>}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {expenses.length === 0 ? (
                  <p className="text-sm text-gray-500 py-4">All expenses are synced.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-200 text-left">
                          <th className="pb-3 pr-4 font-semibold text-gray-600">Title</th>
                          <th className="pb-3 pr-4 font-semibold text-gray-600">Category</th>
                          <th className="pb-3 pr-4 font-semibold text-gray-600">Date</th>
                          <th className="pb-3 pr-4 font-semibold text-gray-600 text-right">Amount</th>
                          <th className="pb-3 font-semibold text-gray-600 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {expenses.map((expense) => (
                          <tr key={expense.id} className="hover:bg-gray-50">
                            <td className="py-3 pr-4 text-gray-900">
                              <Link href={`/expenses`} className="hover:underline">{expense.title}</Link>
                            </td>
                            <td className="py-3 pr-4 text-gray-500">{expense.category?.name || '—'}</td>
                            <td className="py-3 pr-4 text-gray-500">{formatDate(expense.expense_date)}</td>
                            <td className="py-3 pr-4 text-right text-gray-900">{formatCurrency(Number(expense.amount))}</td>
                            <td className="py-3 text-right">
                              <Button
                                size="sm"
                                onClick={() => processExpense(expense)}
                                isLoading={processingKey === `expense-${expense.id}`}
                                leftIcon={<ArrowUpCircle className="w-3.5 h-3.5" />}
                              >
                                Sync to Ledger
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Orders */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ShoppingCart className="w-5 h-5" />
                  Orders
                  {orders.length > 0 && <Badge variant="warning">{orders.length}</Badge>}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {orders.length === 0 ? (
                  <p className="text-sm text-gray-500 py-4">All paid orders are synced.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-200 text-left">
                          <th className="pb-3 pr-4 font-semibold text-gray-600">Order #</th>
                          <th className="pb-3 pr-4 font-semibold text-gray-600">Customer</th>
                          <th className="pb-3 pr-4 font-semibold text-gray-600 text-right">Total</th>
                          <th className="pb-3 font-semibold text-gray-600 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {orders.map((order) => (
                          <tr key={order.id} className="hover:bg-gray-50">
                            <td className="py-3 pr-4 font-mono">
                              <Link href={`/orders/${order.id}`} className="text-primary-600 hover:underline">{order.order_number}</Link>
                            </td>
                            <td className="py-3 pr-4 text-gray-500">{order.customer_name || order.customer?.name || '—'}</td>
                            <td className="py-3 pr-4 text-right text-gray-900">{formatCurrency(order.total)}</td>
                            <td className="py-3 text-right">
                              <Button
                                size="sm"
                                onClick={() => processOrder(order)}
                                isLoading={processingKey === `order-${order.id}`}
                                leftIcon={<ArrowUpCircle className="w-3.5 h-3.5" />}
                              >
                                Sync to Ledger
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Purchase Orders */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Truck className="w-5 h-5" />
                  Purchase Orders
                  {purchaseOrders.length > 0 && <Badge variant="warning">{purchaseOrders.length}</Badge>}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {purchaseOrders.length === 0 ? (
                  <p className="text-sm text-gray-500 py-4">All received purchase orders are synced.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-200 text-left">
                          <th className="pb-3 pr-4 font-semibold text-gray-600">PO Number</th>
                          <th className="pb-3 pr-4 font-semibold text-gray-600">Supplier</th>
                          <th className="pb-3 pr-4 font-semibold text-gray-600 text-right">Unposted Value</th>
                          <th className="pb-3 font-semibold text-gray-600 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {purchaseOrders.map((po) => (
                          <tr key={po.id} className="hover:bg-gray-50">
                            <td className="py-3 pr-4 font-mono">
                              <Link href={`/purchases/${po.id}`} className="text-primary-600 hover:underline">{po.po_number}</Link>
                            </td>
                            <td className="py-3 pr-4 text-gray-500">{po.supplier?.name || '—'}</td>
                            <td className="py-3 pr-4 text-right text-gray-900">{formatCurrency(po.unposted_received_value)}</td>
                            <td className="py-3 text-right">
                              <Button
                                size="sm"
                                onClick={() => processPurchaseOrder(po)}
                                isLoading={processingKey === `po-${po.id}`}
                                leftIcon={<ArrowUpCircle className="w-3.5 h-3.5" />}
                              >
                                Sync to Ledger
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </AdminLayout>
  );
}
