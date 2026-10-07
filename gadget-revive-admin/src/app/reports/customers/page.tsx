'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { Users, UserPlus, Wallet, Repeat, Download } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { AdminLayout } from '@/components/layout';
import { Button, LoadingSpinner, EmptyState, ErrorState } from '@/components/ui';
import {
  DateRange, DateRangeBar, KpiTile, Panel, CHART_COLORS, presetRange,
} from '@/components/reports/shared';
import { downloadBlob, formatCurrency, formatDate, getErrorMessage } from '@/lib/utils';
import adminService from '@/lib/adminService';

interface CustomerReport {
  total_customers: number;
  active_customers: number;
  new_customers: number;
  total_spent: number;
  sales_orders: number;
  average_order_value: number;
  repeat_rate: number;
  top_customers: {
    id: number;
    name: string;
    email: string | null;
    phone: string | null;
    total_spent: number;
    orders: number;
    last_order: string | null;
  }[];
  customer_growth: { date: string; count: number }[];
  customer_segments: { segment: string; count: number }[];
}

const SEGMENT_ORDER = ['No orders', 'One order', '2–4 orders', '5+ orders'];

const RANK_STYLES = ['bg-amber-500', 'bg-gray-400', 'bg-orange-600'];

function dayLabel(date: string): string {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

export default function CustomerReportPage() {
  const [range, setRange] = useState<DateRange>(() => presetRange('month'));
  const [report, setReport] = useState<CustomerReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [exporting, setExporting] = useState(false);

  const fetchReport = useCallback(async () => {
    if (!range.start || !range.end) return;
    if (range.start > range.end) {
      toast.error('The start date must be on or before the end date.');
      return;
    }
    setLoading(true);
    setError(false);
    try {
      const res = await adminService.getCustomerReport({ start_date: range.start, end_date: range.end });
      setReport(res.data.data);
    } catch (err) {
      toast.error(getErrorMessage(err));
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [range]);

  useEffect(() => { fetchReport(); }, [fetchReport]);

  const handleExport = async () => {
    setExporting(true);
    try {
      const res = await adminService.exportReport('customers', 'csv');
      downloadBlob(new Blob([res.data]), `customers-${new Date().toISOString().slice(0, 10)}.csv`);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setExporting(false);
    }
  };

  const segments = [...(report?.customer_segments ?? [])].sort(
    (a, b) => SEGMENT_ORDER.indexOf(a.segment) - SEGMENT_ORDER.indexOf(b.segment)
  );
  const segmentTotal = segments.reduce((n, s) => n + s.count, 0);

  return (
    <AdminLayout>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-baseline gap-2">
          <h1 className="text-lg font-bold text-gray-900">Customer report</h1>
          <p className="text-xs text-gray-500">Activity by date range, with all-time segments</p>
        </div>
        <div className="flex items-center gap-3 text-xs font-semibold">
          <Link href="/reports/sales" className="text-indigo-700 hover:underline">Sales report</Link>
          <Button size="sm" variant="outline" onClick={handleExport} isLoading={exporting} leftIcon={<Download className="h-3.5 w-3.5" />}>
            CSV (all customers)
          </Button>
        </div>
      </div>

      <div className="mb-3">
        <DateRangeBar range={range} onChange={setRange} />
      </div>

      {loading && !report ? (
        <div className="flex justify-center py-16"><LoadingSpinner /></div>
      ) : error && !report ? (
        <ErrorState message="Failed to load the customer report." onRetry={fetchReport} />
      ) : report && report.total_customers === 0 ? (
        <EmptyState title="No customers yet" description="Customers appear here once they register." />
      ) : report ? (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2 lg:grid-cols-5">
            <KpiTile
              label="Active in period"
              value={report.active_customers.toLocaleString()}
              tone="emerald"
              icon={<Users className="h-4 w-4 opacity-60" />}
              sub={`of ${report.total_customers.toLocaleString()} customers in total`}
            />
            <KpiTile
              label="New in period"
              value={report.new_customers.toLocaleString()}
              tone="indigo"
              icon={<UserPlus className="h-4 w-4 opacity-60" />}
              sub="Registered within the range"
            />
            <KpiTile
              label="Sales from customers"
              value={formatCurrency(report.total_spent)}
              tone="sky"
              icon={<Wallet className="h-4 w-4 opacity-60" />}
              sub={`${report.sales_orders} paid order${report.sales_orders === 1 ? '' : 's'}`}
            />
            <KpiTile
              label="Average order value"
              value={formatCurrency(report.average_order_value)}
              tone="amber"
              sub="Sales ÷ paid orders"
            />
            <KpiTile
              label="Repeat rate"
              value={`${report.repeat_rate.toFixed(1)}%`}
              tone="orange"
              icon={<Repeat className="h-4 w-4 opacity-60" />}
              sub="Active customers with 2+ orders, all-time"
            />
          </div>

          <div className="grid grid-cols-1 items-start gap-3 lg:grid-cols-3">
            <Panel title="New customers" hint="Registrations per day" className="lg:col-span-2">
              <div className="p-3">
                {report.customer_growth.length === 0 ? (
                  <p className="py-16 text-center text-xs text-gray-400">No new customers in this period.</p>
                ) : (
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={report.customer_growth} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                      <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={dayLabel} />
                      <YAxis tick={{ fontSize: 11 }} width={32} allowDecimals={false} />
                      <Tooltip
                        formatter={(value: number) => [value, 'New customers']}
                        labelFormatter={(label: string) => dayLabel(label)}
                      />
                      <Bar dataKey="count" fill="#6366F1" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </Panel>

            <Panel title="Customer segments" hint="By lifetime orders, all-time">
              <div className="space-y-2.5 p-3">
                {segments.length === 0 && <p className="text-xs text-gray-400">No customers yet.</p>}
                {segments.map((seg, i) => {
                  const share = segmentTotal > 0 ? (seg.count / segmentTotal) * 100 : 0;
                  const color = CHART_COLORS[i % CHART_COLORS.length];
                  return (
                    <div key={seg.segment}>
                      <div className="flex items-center justify-between gap-2 text-xs">
                        <span className="flex items-center gap-1.5 font-semibold text-gray-800">
                          <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: color }} />
                          {seg.segment}
                        </span>
                        <span className="tabular-nums text-gray-900">
                          {seg.count} <span className="text-gray-400">({share.toFixed(1)}%)</span>
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

          <Panel
            title="Top customers"
            hint="Ranked by paid sales in the period"
            right={<span className="text-[11px] text-gray-500">Top {report.top_customers.length}</span>}
          >
            <div className="max-h-[calc(100vh-30rem)] overflow-auto">
              <table className="min-w-full text-sm">
                <thead className="sticky top-0 z-10 bg-slate-50 text-xs uppercase tracking-wide text-slate-500 shadow-[0_1px_0_0_rgb(226,232,240)]">
                  <tr>
                    <th className="px-3 py-2 text-left font-semibold">#</th>
                    <th className="px-3 py-2 text-left font-semibold">Customer</th>
                    <th className="px-3 py-2 text-right font-semibold">Orders</th>
                    <th className="px-3 py-2 text-right font-semibold">Spent</th>
                    <th className="px-3 py-2 text-right font-semibold">Avg per order</th>
                    <th className="whitespace-nowrap px-3 py-2 text-left font-semibold">Last order</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {report.top_customers.length === 0 && (
                    <tr><td colSpan={6} className="px-3 py-6 text-center text-xs text-gray-400">No paid orders from customers in this period.</td></tr>
                  )}
                  {report.top_customers.map((c, i) => (
                    <tr key={c.id} className={`${i % 2 ? 'bg-slate-50/50' : 'bg-white'} hover:bg-indigo-50/40`}>
                      <td className="px-3 py-2">
                        {i < 3 ? (
                          <span className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-bold text-white ${RANK_STYLES[i]}`}>
                            {i + 1}
                          </span>
                        ) : (
                          <span className="text-xs tabular-nums text-gray-400">{i + 1}</span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <p className="font-semibold text-gray-900">{c.name}</p>
                        <p className="text-[11px] text-gray-500">{[c.phone, c.email].filter(Boolean).join(' · ') || '—'}</p>
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-gray-700">{c.orders}</td>
                      <td className="px-3 py-2 text-right font-semibold tabular-nums text-gray-900">{formatCurrency(c.total_spent)}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-gray-600">
                        {formatCurrency(c.orders > 0 ? Math.round(c.total_spent / c.orders) : 0)}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-xs tabular-nums text-gray-500">
                        {c.last_order ? formatDate(c.last_order) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>

          <p className="text-[11px] text-gray-400">
            Active means the customer placed at least one order that was not cancelled or refunded in the period.
            Sales are paid, partially paid or verified orders. Total customers, segments and repeat rate are all-time
            and exclude deleted accounts. The CSV export covers all customers, not the date range.
          </p>
        </div>
      ) : null}
    </AdminLayout>
  );
}
