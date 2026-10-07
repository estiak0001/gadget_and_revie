'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { ShoppingCart, Receipt, Wallet, TrendingUp, TrendingDown } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { AdminLayout } from '@/components/layout';
import { Button, LoadingSpinner, EmptyState, ErrorState } from '@/components/ui';
import {
  DateRange, DateRangeBar, KpiTile, Panel, CHART_COLORS, presetRange, chipClass,
} from '@/components/reports/shared';
import { ExpenseReport, CashPosition } from '@/types';
import { formatCurrency, formatDate, getErrorMessage } from '@/lib/utils';
import adminService from '@/lib/adminService';

type GroupBy = 'day' | 'month';

function periodLabel(period: string): string {
  if (period.length === 7) {
    const [y, m] = period.split('-').map(Number);
    return new Date(y, m - 1, 1).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });
  }
  const [y, m, d] = period.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

export default function RevenueReportPage() {
  const [range, setRange] = useState<DateRange>(() => presetRange('month'));
  const [groupBy, setGroupBy] = useState<GroupBy>('day');
  const [report, setReport] = useState<ExpenseReport | null>(null);
  const [cash, setCash] = useState<CashPosition | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const fetchReport = useCallback(async () => {
    if (!range.start || !range.end) return;
    if (range.start > range.end) {
      toast.error('The start date must be on or before the end date.');
      return;
    }
    setLoading(true);
    setError(false);
    try {
      const [reportRes, cashRes] = await Promise.all([
        adminService.getExpenseReport({ start_date: range.start, end_date: range.end, group_by: groupBy }),
        adminService.getCashPosition(range.start, range.end),
      ]);
      setReport(reportRes.data.data);
      setCash(cashRes.data?.data ?? null);
    } catch (err) {
      toast.error(getErrorMessage(err));
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [range, groupBy]);

  useEffect(() => { fetchReport(); }, [fetchReport]);

  const trend = useMemo(() => {
    if (!report) return [];
    const map = new Map<string, { period: string; sales: number; expenses: number }>();
    report.sales_trend.forEach((r) => {
      map.set(r.period, { period: r.period, sales: Number(r.total), expenses: 0 });
    });
    report.expense_trend.forEach((r) => {
      const existing = map.get(r.period);
      if (existing) existing.expenses = Number(r.total);
      else map.set(r.period, { period: r.period, sales: 0, expenses: Number(r.total) });
    });
    return Array.from(map.values()).sort((a, b) => a.period.localeCompare(b.period));
  }, [report]);

  const summary = report?.summary;
  const salesOrders = report?.sales_trend.reduce((n, r) => n + Number(r.order_count), 0) ?? 0;
  const expenseShare = summary && summary.total_sales > 0 ? (summary.total_expenses / summary.total_sales) * 100 : null;
  const categories = useMemo(
    () => [...(report?.by_category ?? [])].sort((a, b) => b.total - a.total),
    [report]
  );
  const categoryTotal = categories.reduce((n, c) => n + c.total, 0);
  const isEmpty = !!summary && summary.total_sales === 0 && summary.total_expenses === 0;

  return (
    <AdminLayout>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-baseline gap-2">
          <h1 className="text-lg font-bold text-gray-900">Revenue report</h1>
          <p className="text-xs text-gray-500">Sales − expenses = net revenue</p>
        </div>
        <div className="flex items-center gap-3 text-xs font-semibold">
          <Link href="/reports/sales" className="text-indigo-700 hover:underline">Sales report</Link>
          <Link href="/expenses" className="text-indigo-700 hover:underline">Expenses</Link>
        </div>
      </div>

      <div className="mb-3">
        <DateRangeBar
          range={range}
          onChange={setRange}
          right={
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Trend</span>
              {(['day', 'month'] as const).map((g) => (
                <button key={g} type="button" onClick={() => setGroupBy(g)} className={chipClass(groupBy === g)}>
                  {g === 'day' ? 'Daily' : 'Monthly'}
                </button>
              ))}
              <Button size="sm" variant="outline" onClick={fetchReport} isLoading={loading}>Refresh</Button>
            </div>
          }
        />
      </div>

      {loading && !report ? (
        <div className="flex justify-center py-16"><LoadingSpinner /></div>
      ) : error && !report ? (
        <ErrorState message="Failed to load the revenue report." onRetry={fetchReport} />
      ) : isEmpty ? (
        <EmptyState title="Nothing recorded in this period" description="Pick a wider date range to see sales and expenses." />
      ) : summary ? (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
            <KpiTile
              label="Sales"
              value={formatCurrency(summary.total_sales)}
              tone="emerald"
              icon={<ShoppingCart className="h-4 w-4 opacity-60" />}
              sub={`${salesOrders} order${salesOrders === 1 ? '' : 's'} with payment recognized`}
            />
            <KpiTile
              label="Expenses"
              value={formatCurrency(summary.total_expenses)}
              tone="rose"
              icon={<Receipt className="h-4 w-4 opacity-60" />}
              sub={expenseShare !== null ? `${expenseShare.toFixed(1)}% of sales` : 'No sales in this period'}
            />
            <KpiTile
              label="Net revenue"
              value={formatCurrency(summary.net_revenue)}
              tone={summary.net_revenue >= 0 ? 'sky' : 'orange'}
              icon={summary.net_revenue >= 0
                ? <TrendingUp className="h-4 w-4 opacity-60" />
                : <TrendingDown className="h-4 w-4 opacity-60" />}
              sub={summary.net_revenue >= 0 ? 'Sales exceed expenses' : 'Expenses exceed sales'}
            />
            <KpiTile
              label="Cash balance"
              value={cash ? formatCurrency(cash.closing_balance) : '—'}
              tone="indigo"
              icon={<Wallet className="h-4 w-4 opacity-60" />}
              sub={cash
                ? `As of ${formatDate(range.end)} · period change ${cash.net_change >= 0 ? '+' : ''}${formatCurrency(cash.net_change)}`
                : undefined}
            />
          </div>

          <div className="grid grid-cols-1 items-start gap-3 lg:grid-cols-3">
            <Panel title="Sales vs expenses" hint={`Grouped ${groupBy === 'day' ? 'daily' : 'monthly'}`} className="lg:col-span-2">
              <div className="p-3">
                {trend.length === 0 ? (
                  <p className="py-16 text-center text-xs text-gray-400">No activity in this period.</p>
                ) : (
                  <ResponsiveContainer width="100%" height={240}>
                    <LineChart data={trend} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                      <XAxis dataKey="period" tick={{ fontSize: 11 }} tickFormatter={periodLabel} />
                      <YAxis
                        tick={{ fontSize: 11 }}
                        width={56}
                        tickFormatter={(v: number) => (Math.abs(v) >= 1000 ? `৳${(v / 1000).toFixed(0)}k` : `৳${v}`)}
                      />
                      <Tooltip
                        formatter={(value: number, name: string) => [formatCurrency(value), name]}
                        labelFormatter={(label: string) => periodLabel(label)}
                      />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                      <Line type="monotone" dataKey="sales" name="Sales" stroke="#10B981" strokeWidth={2} dot={false} />
                      <Line type="monotone" dataKey="expenses" name="Expenses" stroke="#F43F5E" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>
            </Panel>

            <Panel title="Expenses by category" hint="Share of period expenses">
              <div className="max-h-[260px] space-y-2.5 overflow-auto p-3">
                {categories.length === 0 && <p className="text-xs text-gray-400">No expenses in this period.</p>}
                {categories.map((c, i) => {
                  const share = categoryTotal > 0 ? (c.total / categoryTotal) * 100 : 0;
                  const color = CHART_COLORS[i % CHART_COLORS.length];
                  return (
                    <div key={c.id}>
                      <div className="flex items-center justify-between gap-2 text-xs">
                        <span className="flex min-w-0 items-center gap-1.5">
                          <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: color }} />
                          <span className="truncate font-semibold text-gray-800">{c.name}</span>
                        </span>
                        <span className="whitespace-nowrap font-semibold tabular-nums text-gray-900">
                          {formatCurrency(c.total)} <span className="font-normal text-gray-400">({share.toFixed(1)}%)</span>
                        </span>
                      </div>
                      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-gray-100">
                        <div className="h-full rounded-full" style={{ width: `${share}%`, background: color }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </Panel>
          </div>

          <Panel title="Latest expenses in period" hint="Up to the 50 most recent, newest first">
            <div className="max-h-[calc(100vh-30rem)] overflow-auto">
              <table className="min-w-full text-sm">
                <thead className="sticky top-0 z-10 bg-slate-50 text-xs uppercase tracking-wide text-slate-500 shadow-[0_1px_0_0_rgb(226,232,240)]">
                  <tr>
                    <th className="whitespace-nowrap px-3 py-2 text-left font-semibold">Date</th>
                    <th className="px-3 py-2 text-left font-semibold">Title</th>
                    <th className="px-3 py-2 text-left font-semibold">Category</th>
                    <th className="px-3 py-2 text-right font-semibold">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {report?.recent_expenses.length === 0 && (
                    <tr><td colSpan={4} className="px-3 py-6 text-center text-xs text-gray-400">No expenses in this period.</td></tr>
                  )}
                  {report?.recent_expenses.map((exp, i) => (
                    <tr key={exp.id} className={`${i % 2 ? 'bg-slate-50/50' : 'bg-white'} hover:bg-rose-50/40`}>
                      <td className="whitespace-nowrap px-3 py-2 text-xs tabular-nums text-gray-500">{formatDate(exp.expense_date)}</td>
                      <td className="px-3 py-2 font-semibold text-gray-900">{exp.title}</td>
                      <td className="px-3 py-2 text-gray-600">{exp.category?.name ?? '—'}</td>
                      <td className="whitespace-nowrap px-3 py-2 text-right font-semibold tabular-nums text-rose-600">
                        {formatCurrency(Number(exp.amount))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>

          <p className="text-[11px] text-gray-400">
            Sales are orders whose payment is recognized (paid, partially paid or verified), counted at order total by order date.
            Expenses include every active expense in the period across all categories, including Asset and Purchase.
            Reversed expenses are excluded.
          </p>
        </div>
      ) : null}
    </AdminLayout>
  );
}
