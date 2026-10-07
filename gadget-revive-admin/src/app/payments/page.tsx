'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Search, CheckCircle, Wallet, ShoppingCart, X, Banknote, ExternalLink, Settings2 } from 'lucide-react';
import { AdminLayout } from '@/components/layout';
import { Button, Modal, Badge, Pagination, LoadingSpinner, EmptyState, ErrorState } from '@/components/ui';
import { KpiTile, chipClass } from '@/components/reports/shared';
import { formatCurrency, formatDateTime, getErrorMessage } from '@/lib/utils';
import adminService from '@/lib/adminService';
import toast from 'react-hot-toast';

/**
 * Payments — customer (order) payments only. Supplier payments are handled in the Purchases module.
 * Filters: Due (outstanding balance), Partial, Paid, All.
 */

type Filter = 'due' | 'partial' | 'paid' | 'all';

interface Row {
  id: number;
  reference: string;
  party: string;
  phone: string;
  date: string;
  total: number;
  paid: number;
  outstanding: number;
  status: string;
  method: string;
  canPay: boolean;
  canVerify: boolean;
}

interface Summary {
  receivable: { total: number; count: number };
}

const FILTERS: { value: Filter; label: string }[] = [
  { value: 'due', label: 'Due' },
  { value: 'partial', label: 'Partial' },
  { value: 'paid', label: 'Paid' },
  { value: 'all', label: 'All' },
];

const ORDER_STATUS_LABEL: Record<string, string> = {
  pending: 'Pending', awaiting_confirmation: 'Awaiting confirm', partially_paid: 'Partially paid',
  paid: 'Paid', verified: 'Verified', failed: 'Failed', refunded: 'Refunded', cancelled: 'Cancelled',
};
const ORDER_STATUS_TONE: Record<string, 'success' | 'warning' | 'danger' | 'default'> = {
  pending: 'warning', awaiting_confirmation: 'warning', partially_paid: 'warning',
  paid: 'success', verified: 'success', failed: 'danger', refunded: 'default', cancelled: 'danger',
};

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: 'pending', label: 'Pending' },
  { value: 'awaiting_confirmation', label: 'Awaiting confirm' },
  { value: 'failed', label: 'Failed' },
  { value: 'cancelled', label: 'Cancelled' },
];

const METHOD_LABEL: Record<string, string> = {
  bkash: 'bKash', nagad: 'Nagad', rocket: 'Rocket', bank_transfer: 'Bank transfer', cash: 'Cash', card: 'Card',
};

const INPUT = 'h-8 rounded-lg border border-gray-300 bg-white px-2 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500';
const SEARCH = 'h-8 w-full rounded-lg border border-gray-300 bg-white pl-8 pr-3 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500';

function toRowFromDue(r: Record<string, unknown>): Row {
  const outstanding = Number(r.outstanding ?? 0);
  const status = String(r.payment_status ?? '');
  return {
    id: Number(r.id),
    reference: String(r.reference ?? ''),
    party: String(r.party_name ?? '—'),
    phone: String(r.party_phone ?? ''),
    date: String(r.date ?? ''),
    total: Number(r.total ?? 0),
    paid: Number(r.paid_amount ?? 0),
    outstanding,
    status,
    method: '',
    canPay: outstanding > 0,
    canVerify: ['pending', 'awaiting_confirmation'].includes(status),
  };
}

function toRowFromOrder(o: Record<string, any>): Row {
  const outstanding = Number(o.outstanding_receivable ?? 0);
  const closed = ['cancelled', 'refunded', 'rejected'].includes(String(o.order_status ?? ''));
  const status = String(o.payment_status ?? '');
  return {
    id: Number(o.id),
    reference: String(o.order_number ?? ''),
    party: String(o.customer_name ?? o.customer?.name ?? '—'),
    phone: String(o.customer_phone ?? o.customer?.phone ?? ''),
    date: String(o.created_at ?? ''),
    total: Number(o.total ?? 0),
    paid: Number(o.paid_amount ?? 0),
    outstanding,
    status,
    method: String(o.payment_method ?? ''),
    canPay: outstanding > 0 && !closed,
    canVerify: ['pending', 'awaiting_confirmation'].includes(status),
  };
}

export default function PaymentsPage() {
  const [filter, setFilter] = useState<Filter>('due');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [minAmount, setMinAmount] = useState('');
  const [method, setMethod] = useState('');
  const [page, setPage] = useState(1);

  const [rows, setRows] = useState<Row[]>([]);
  const [lastPage, setLastPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);
  const [summary, setSummary] = useState<Summary | null>(null);

  const [payRow, setPayRow] = useState<Row | null>(null);
  const [payAmount, setPayAmount] = useState('');
  const [isPaying, setIsPaying] = useState(false);

  // Manual payment-status change (cancel / fail / back to pending) — Verify and Record stay separate.
  const [statusRow, setStatusRow] = useState<Row | null>(null);
  const [statusValue, setStatusValue] = useState('');
  const [statusNote, setStatusNote] = useState('');
  const [isStatusSaving, setIsStatusSaving] = useState(false);

  // Debounce search so typing doesn't fire a request per keystroke.
  useEffect(() => {
    const t = setTimeout(() => { setSearch(searchInput.trim()); setPage(1); }, 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  const loadSummary = useCallback(async () => {
    try {
      const res = await adminService.getDues({ type: 'receivable', per_page: 1 });
      const body = res.data as unknown as { summary: { receivable: { total: number; count: number } } };
      setSummary({ receivable: body.summary.receivable });
    } catch {
      setSummary(null);
    }
  }, []);

  const fetchRows = useCallback(async () => {
    setIsLoading(true);
    setError(false);
    try {
      let list: Row[] = [];
      let meta: { last_page?: number; total?: number } = {};

      if (filter === 'due') {
        // Outstanding balances: the dues endpoint is the source of truth for "what is owed".
        const res = await adminService.getDues({
          type: 'receivable',
          search: search || undefined,
          from_date: fromDate || undefined,
          to_date: toDate || undefined,
          min_amount: minAmount || undefined,
          page,
          per_page: 20,
        });
        const body = res.data as unknown as { data: Record<string, unknown>[]; meta: typeof meta };
        list = (body.data ?? []).map(toRowFromDue);
        meta = body.meta ?? {};
      } else {
        const statusParam = filter === 'partial' ? 'partially_paid' : filter === 'paid' ? 'paid' : undefined;
        const res = await adminService.getPayments({
          page,
          per_page: 20,
          payment_status: statusParam,
          payment_method: method || undefined,
          search: search || undefined,
          start_date: fromDate || undefined,
          end_date: toDate || undefined,
        } as Record<string, string | number>);
        const body = res.data as unknown as { data: Record<string, any>[]; meta: typeof meta };
        list = (body.data ?? []).map(toRowFromOrder);
        meta = body.meta ?? {};
      }

      // Min-amount applies client-side where the endpoint doesn't filter on it.
      if (minAmount && filter !== 'due') {
        const min = Number(minAmount);
        list = list.filter((r) => r.outstanding >= min);
      }

      setRows(list);
      setLastPage(meta.last_page ?? 1);
      setTotal(meta.total ?? list.length);
    } catch (err) {
      toast.error(getErrorMessage(err));
      setError(true);
      setRows([]);
    } finally {
      setIsLoading(false);
    }
  }, [filter, search, fromDate, toDate, minAmount, method, page]);

  useEffect(() => { loadSummary(); }, [loadSummary]);
  useEffect(() => { fetchRows(); }, [fetchRows]);

  const clearFilters = () => {
    setSearchInput('');
    setFromDate('');
    setToDate('');
    setMinAmount('');
    setMethod('');
    setFilter('due');
    setPage(1);
  };

  const filtered = !!search || !!fromDate || !!toDate || !!minAmount || !!method || filter !== 'due';

  const openPay = (row: Row) => {
    setPayRow(row);
    setPayAmount(String(row.outstanding));
  };

  const amountNum = Number(payAmount);
  const amountValid = !!payRow && amountNum > 0 && amountNum <= (payRow?.outstanding ?? 0) + 0.001;
  const remainingAfter = payRow ? Math.max(0, payRow.outstanding - (amountValid ? amountNum : 0)) : 0;

  const handlePay = async () => {
    if (!payRow || !amountValid) return;
    setIsPaying(true);
    try {
      await adminService.recordOrderPayment(payRow.id, amountNum);
      toast.success(amountNum >= payRow.outstanding - 0.001
        ? `Order ${payRow.reference} settled`
        : `Partial payment of ${formatCurrency(amountNum)} recorded`);
      setPayRow(null);
      loadSummary();
      fetchRows();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setIsPaying(false);
    }
  };

  const handleVerify = async (row: Row) => {
    try {
      await adminService.updatePaymentStatus(row.id, 'verified', '');
      toast.success(`Payment for ${row.reference} verified`);
      fetchRows();
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const openStatus = (row: Row) => {
    setStatusRow(row);
    setStatusValue(row.status === 'cancelled' ? 'pending' : row.status || 'pending');
    setStatusNote('');
  };

  const handleStatusSave = async () => {
    if (!statusRow) return;
    setIsStatusSaving(true);
    try {
      await adminService.updatePaymentStatus(statusRow.id, statusValue, statusNote.trim());
      toast.success(`${statusRow.reference} payment set to ${STATUS_OPTIONS.find((s) => s.value === statusValue)?.label ?? statusValue}`);
      setStatusRow(null);
      fetchRows();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setIsStatusSaving(false);
    }
  };

  const pageTotals = useMemo(() => ({
    paid: rows.reduce((s, r) => s + r.paid, 0),
    outstanding: rows.reduce((s, r) => s + r.outstanding, 0),
  }), [rows]);

  if (error && rows.length === 0) {
    return (<AdminLayout><ErrorState title="Failed to load payments" onRetry={fetchRows} /></AdminLayout>);
  }

  return (
    <AdminLayout>
      <div className="mb-3 flex flex-wrap items-center gap-2.5">
        <h1 className="text-lg font-bold text-gray-900">Customer payments</h1>
        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-semibold text-gray-600">
          {summary ? `${summary.receivable.count} due` : '…'}
        </span>
        <span className="text-[11px] text-gray-500">Supplier payments are in <Link href="/purchases" className="font-semibold text-indigo-600 hover:underline">Purchases</Link></span>
      </div>

      <div className="mb-3 grid grid-cols-2 gap-2 lg:grid-cols-3">
        <KpiTile label="Customer due" value={formatCurrency(summary?.receivable.total ?? 0)} tone="amber" icon={<ShoppingCart className="h-4 w-4 opacity-60" />} sub={`${summary?.receivable.count ?? 0} open orders`} />
        <KpiTile label="Collected (page)" value={formatCurrency(pageTotals.paid)} tone="emerald" icon={<CheckCircle className="h-4 w-4 opacity-60" />} sub="Already paid on this page" />
        <KpiTile label="Open (page)" value={formatCurrency(pageTotals.outstanding)} tone="indigo" icon={<Banknote className="h-4 w-4 opacity-60" />} sub="Still open on this page" />
      </div>

      <div className="mb-3 space-y-2 rounded-xl border border-gray-200 bg-white p-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex gap-1.5">
            {FILTERS.map((f) => (
              <button key={f.value} type="button" onClick={() => { setFilter(f.value); setPage(1); }} className={chipClass(filter === f.value)}>
                {f.label}
              </button>
            ))}
          </div>
          <span className="ml-auto text-[11px] text-gray-500">
            {filter === 'due' ? 'Orders with a balance still owed'
              : filter === 'partial' ? 'Partly paid — balance still open'
              : filter === 'paid' ? 'Fully paid'
              : 'Every order payment'}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[220px] flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
            <input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Order number, customer name or phone…"
              className={SEARCH}
            />
          </div>
          <select className={INPUT} value={method} onChange={(e) => { setMethod(e.target.value); setPage(1); }} disabled={filter === 'due'} title={filter === 'due' ? 'Method filter applies to Partial / Paid / All' : 'Payment method'}>
            <option value="">All methods</option>
            {Object.entries(METHOD_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          <input type="date" className={INPUT} value={fromDate} onChange={(e) => { setFromDate(e.target.value); setPage(1); }} title="From date" />
          <input type="date" className={INPUT} value={toDate} onChange={(e) => { setToDate(e.target.value); setPage(1); }} title="To date" />
          <input
            type="number"
            min={0}
            step="0.01"
            placeholder="Min due"
            className={`${INPUT} w-24`}
            value={minAmount}
            onChange={(e) => { setMinAmount(e.target.value); setPage(1); }}
          />
          {filtered && (
            <button type="button" onClick={clearFilters} className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-gray-600 hover:bg-gray-100">
              <X className="h-3.5 w-3.5" /> Clear
            </button>
          )}
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        {isLoading ? (
          <div className="flex justify-center py-12"><LoadingSpinner size="md" text="Loading…" /></div>
        ) : rows.length === 0 ? (
          <div className="p-4">
            <EmptyState
              icon={<Wallet className="h-8 w-8 text-gray-400" />}
              title={filtered ? 'Nothing matches these filters' : 'No customer payments to show'}
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold">Order</th>
                  <th className="px-3 py-2 text-left font-semibold">Customer</th>
                  <th className="whitespace-nowrap px-3 py-2 text-left font-semibold">Date</th>
                  <th className="px-3 py-2 text-right font-semibold">Total</th>
                  <th className="px-3 py-2 text-right font-semibold">Paid</th>
                  <th className="px-3 py-2 text-right font-semibold">Outstanding</th>
                  <th className="px-3 py-2 text-left font-semibold">Status</th>
                  <th className="px-3 py-2 text-left font-semibold">Method</th>
                  <th className="px-3 py-2 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rows.map((row, i) => (
                  <tr key={row.id} className={`${i % 2 ? 'bg-slate-50/40' : 'bg-white'} hover:bg-indigo-50/40`}>
                    <td className="whitespace-nowrap px-3 py-2 font-mono text-xs font-semibold text-gray-900">{row.reference}</td>
                    <td className="px-3 py-2">
                      <p className="font-medium text-gray-900">{row.party}</p>
                      {row.phone && <p className="text-[11px] text-gray-500">{row.phone}</p>}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-xs tabular-nums text-gray-500">{row.date ? formatDateTime(row.date) : '—'}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums text-gray-700">{formatCurrency(row.total)}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums text-emerald-700">{formatCurrency(row.paid)}</td>
                    <td className={`whitespace-nowrap px-3 py-2 text-right font-semibold tabular-nums ${row.outstanding > 0 ? 'text-amber-700' : 'text-gray-400'}`}>
                      {row.outstanding > 0 ? formatCurrency(row.outstanding) : '—'}
                    </td>
                    <td className="px-3 py-2">
                      <Badge variant={ORDER_STATUS_TONE[row.status] ?? 'default'} className="text-[11px]">{ORDER_STATUS_LABEL[row.status] ?? (row.status || '—')}</Badge>
                    </td>
                    <td className="px-3 py-2 text-xs text-gray-600">{METHOD_LABEL[row.method] ?? (row.method || '—')}</td>
                    <td className="px-3 py-2">
                      <div className="flex items-center justify-end gap-1">
                        {row.canVerify && (
                          <Button size="sm" variant="outline" onClick={() => handleVerify(row)} className="whitespace-nowrap border-emerald-300 text-emerald-700 hover:bg-emerald-50">
                            <CheckCircle className="mr-1 h-3.5 w-3.5" /> Verify
                          </Button>
                        )}
                        {row.canPay && (
                          <Button size="sm" onClick={() => openPay(row)} className="whitespace-nowrap">
                            <Wallet className="mr-1 h-3.5 w-3.5" /> Record
                          </Button>
                        )}
                        <button type="button" title="Update payment status" onClick={() => openStatus(row)} className="rounded-md p-1 text-slate-500 hover:bg-slate-100">
                          <Settings2 className="h-3.5 w-3.5" />
                        </button>
                        <Link href={`/orders/${row.id}`} title="Open order" className="rounded-md p-1 text-indigo-600 hover:bg-indigo-50">
                          <ExternalLink className="h-3.5 w-3.5" />
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-gray-500">
        <span>{total.toLocaleString()} record{total === 1 ? '' : 's'}</span>
        {lastPage > 1 && <Pagination currentPage={page} totalPages={lastPage} onPageChange={setPage} />}
      </div>

      {/* Manual payment-status change */}
      <Modal isOpen={!!statusRow} onClose={() => setStatusRow(null)} title={statusRow ? `Payment status — ${statusRow.reference}` : ''} size="sm">
        {statusRow && (
          <div className="space-y-3">
            <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-slate-50 px-3 py-2 text-xs">
              <span className="text-gray-500">Current</span>
              <Badge variant={ORDER_STATUS_TONE[statusRow.status] ?? 'default'} className="text-[11px]">{ORDER_STATUS_LABEL[statusRow.status] ?? (statusRow.status || '—')}</Badge>
            </div>
            {statusRow.paid > 0 && (
              <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-800">
                {formatCurrency(statusRow.paid)} is already recorded on this order. Cancelling or failing it is blocked here — use <b>Refund</b> on the order page so the money is reversed properly.
              </p>
            )}
            <div>
              <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-gray-500">New status</label>
              <select className={`${INPUT} w-full`} value={statusValue} onChange={(e) => setStatusValue(e.target.value)}>
                {STATUS_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                Note {statusValue === 'cancelled' ? <span className="text-rose-600">*</span> : '(optional)'}
              </label>
              <textarea
                value={statusNote}
                onChange={(e) => setStatusNote(e.target.value)}
                rows={2}
                placeholder={statusValue === 'cancelled' ? 'Why is this payment being cancelled?' : 'Reason for this change'}
                className="w-full rounded-lg border border-gray-300 p-2 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="ghost" onClick={() => setStatusRow(null)}>Cancel</Button>
              <Button
                onClick={handleStatusSave}
                isLoading={isStatusSaving}
                disabled={statusValue === statusRow.status || (statusValue === 'cancelled' && !statusNote.trim())}
                variant={statusValue === 'cancelled' || statusValue === 'failed' ? 'danger' : 'primary'}
              >
                Update status
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Record a full or partial customer payment */}
      <Modal isOpen={!!payRow} onClose={() => setPayRow(null)} title={payRow ? `Record payment — ${payRow.reference}` : ''} size="sm">
        {payRow && (
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-2 rounded-lg border border-gray-200 bg-slate-50 p-3 text-center">
              <div><p className="text-[10px] uppercase tracking-wide text-gray-500">Total</p><p className="text-sm font-bold tabular-nums">{formatCurrency(payRow.total)}</p></div>
              <div><p className="text-[10px] uppercase tracking-wide text-gray-500">Paid</p><p className="text-sm font-bold tabular-nums text-emerald-700">{formatCurrency(payRow.paid)}</p></div>
              <div><p className="text-[10px] uppercase tracking-wide text-gray-500">Due</p><p className="text-sm font-bold tabular-nums text-amber-700">{formatCurrency(payRow.outstanding)}</p></div>
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-gray-500">Amount now</label>
              <div className="flex gap-2">
                <input
                  type="number"
                  min={0.01}
                  max={payRow.outstanding}
                  step="0.01"
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                  className="h-9 flex-1 rounded-lg border border-gray-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <Button variant="outline" size="sm" onClick={() => setPayAmount(String(payRow.outstanding))}>Full</Button>
              </div>
              <p className="mt-1 text-[11px] text-gray-500">
                {amountValid
                  ? remainingAfter > 0.001
                    ? `Partial — ${formatCurrency(remainingAfter)} stays due after this payment.`
                    : 'Settles the full balance.'
                  : `Enter an amount between 0.01 and ${formatCurrency(payRow.outstanding)}.`}
              </p>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="ghost" onClick={() => setPayRow(null)}>Cancel</Button>
              <Button onClick={handlePay} isLoading={isPaying} disabled={!amountValid}>Record payment</Button>
            </div>
          </div>
        )}
      </Modal>
    </AdminLayout>
  );
}
