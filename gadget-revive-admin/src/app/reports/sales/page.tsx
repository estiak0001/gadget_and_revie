'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { ShoppingCart, Receipt, TrendingUp, TrendingDown, Download } from 'lucide-react';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { AdminLayout } from '@/components/layout';
import { Button, LoadingSpinner, EmptyState, ErrorState } from '@/components/ui';
import {
  DateRange, DateRangeBar, KpiTile, Panel, CHART_COLORS, presetRange, chipClass,
} from '@/components/reports/shared';
import { downloadBlob, formatCurrency, getErrorMessage } from '@/lib/utils';
import adminService from '@/lib/adminService';

type GroupBy = 'day' | 'week' | 'month';

interface SalesReport {
  summary: {
    orders_placed: number;
    cancelled_orders: number;
    sales_orders: number;
    total_revenue: number;
    average_order_value: number;
  };
  previous_revenue: number;
  revenue_growth: number | null;
  chart_data: { date: string; revenue: number; orders: number }[];
  top_vendors: { vendor_id: number | null; name: string | null; order_count: number; total_revenue: number }[];
  top_services: { name: string; count: number; revenue: number }[];
  payment_methods: { method: string; count: number; total: number }[];
}

const GROUP_OPTIONS: { value: GroupBy; label: string }[] = [
  { value: 'day', label: 'Daily' },
  { value: 'week', label: 'Weekly' },
  { value: 'month', label: 'Monthly' },
];

function periodLabel(period: string): string {
  if (period.includes('-W')) return `Week ${period.split('-W')[1]}`;
  if (period.length === 7) {
    const [y, m] = period.split('-').map(Number);
    return new Date(y, m - 1, 1).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });
  }
  const [y, m, d] = period.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

function daysInRange(start: string, end: string): number {
  const ms = new Date(end).getTime() - new Date(start).getTime();
  return Math.max(1, Math.round(ms / 86400000) + 1);
}

export default function SalesReportPage() {
  const [range, setRange] = useState<DateRange>(() => presetRange('month'));
  const [groupBy, setGroupBy] = useState<GroupBy>('day');
  const [report, setReport] = useState<SalesReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [exporting, setExporting] = useState<'csv' | 'pdf' | null>(null);

  const fetchReport = useCallback(async () => {
    if (!range.start || !range.end) return;
    if (range.start > range.end) {
      toast.error('The start date must be on or before the end date.');
      return;
    }
    setLoading(true);
    setError(false);
    try {
      const res = await adminService.getSalesReport({ start_date: range.start, end_date: range.end, group_by: groupBy });
      setReport(res.data.data);
    } catch (err) {
      toast.error(getErrorMessage(err));
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [range, groupBy]);

  useEffect(() => { fetchReport(); }, [fetchReport]);

  const handleExport = async (format: 'csv' | 'pdf') => {
    setExporting(format);
    try {
      const res = await adminService.exportReport('sales', format, { start_date: range.start, end_date: range.end });
      downloadBlob(new Blob([res.data]), `sales-report-${range.start}-${range.end}.${format}`);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setExporting(null);
    }
  };

  const s = report?.summary;
  const growth = report?.revenue_growth ?? null;
  const days = daysInRange(range.start, range.end);
  const topServiceRevenue = report?.top_services[0]?.revenue ?? 0;
  const paymentTotal = report?.payment_methods.reduce((n, m) => n + m.total, 0) ?? 0;
  const vendorTotal = report?.top_vendors.reduce((n, v) => n + v.total_revenue, 0) ?? 0;

  return (
    <AdminLayout>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-baseline gap-2">
          <h1 className="text-lg font-bold text-gray-900">Sales report</h1>
          <p className="text-xs text-gray-500">Paid orders by order date</p>
        </div>
        <div className="flex items-center gap-3 text-xs font-semibold">
          <Link href="/reports/revenue" className="text-indigo-700 hover:underline">Revenue report</Link>
          <Button size="sm" variant="outline" onClick={() => handleExport('csv')} isLoading={exporting === 'csv'} leftIcon={<Download className="h-3.5 w-3.5" />}>
            CSV
          </Button>
          <Button size="sm" variant="outline" onClick={() => handleExport('pdf')} isLoading={exporting === 'pdf'} leftIcon={<Download className="h-3.5 w-3.5" />}>
            PDF
          </Button>
        </div>
      </div>

      <div className="mb-3">
        <DateRangeBar
          range={range}
          onChange={setRange}
          right={
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Group</span>
              {GROUP_OPTIONS.map((g) => (
                <button key={g.value} type="button" onClick={() => setGroupBy(g.value)} className={chipClass(groupBy === g.value)}>
                  {g.label}
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
        <ErrorState message="Failed to load the sales report." onRetry={fetchReport} />
      ) : report && s && s.orders_placed === 0 ? (
        <EmptyState title="No orders in this period" description="Pick a wider date range to see sales." />
      ) : report && s ? (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
            <KpiTile
              label="Sales"
              value={formatCurrency(s.total_revenue)}
              tone="emerald"
              icon={<ShoppingCart className="h-4 w-4 opacity-60" />}
              sub={`${s.sales_orders} paid order${s.sales_orders === 1 ? '' : 's'}`}
            />
            <KpiTile
              label="Orders placed"
              value={String(s.orders_placed)}
              tone="indigo"
              icon={<Receipt className="h-4 w-4 opacity-60" />}
              sub={`${s.cancelled_orders} cancelled · ${(s.orders_placed / days).toFixed(1)} per day`}
            />
            <KpiTile
              label="Average order value"
              value={formatCurrency(s.average_order_value)}
              tone="sky"
              sub="Sales ÷ paid orders"
            />
            <KpiTile
              label="Growth vs previous period"
              value={growth === null ? '—' : `${growth >= 0 ? '+' : ''}${growth.toFixed(1)}%`}
              tone={growth === null || growth >= 0 ? 'emerald' : 'rose'}
              icon={growth !== null && growth < 0
                ? <TrendingDown className="h-4 w-4 opacity-60" />
                : <TrendingUp className="h-4 w-4 opacity-60" />}
              sub={growth === null
                ? 'No sales in the previous period to compare'
                : `Previous period ${formatCurrency(report.previous_revenue)}`}
            />
          </div>

          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            <Panel title="Sales trend" hint={`Grouped ${groupBy === 'day' ? 'daily' : groupBy === 'week' ? 'weekly' : 'monthly'}`}>
              <div className="p-3">
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={report.chart_data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={periodLabel} />
                    <YAxis
                      tick={{ fontSize: 11 }}
                      width={56}
                      tickFormatter={(v: number) => (v >= 1000 ? `৳${(v / 1000).toFixed(0)}k` : `৳${v}`)}
                    />
                    <Tooltip
                      formatter={(value: number) => [formatCurrency(value), 'Sales']}
                      labelFormatter={(label: string) => periodLabel(label)}
                    />
                    <Line type="monotone" dataKey="revenue" stroke="#10B981" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </Panel>

            <Panel title="Orders placed" hint="Includes unpaid and cancelled orders">
              <div className="p-3">
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={report.chart_data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={periodLabel} />
                    <YAxis tick={{ fontSize: 11 }} width={32} allowDecimals={false} />
                    <Tooltip
                      formatter={(value: number) => [value, 'Orders']}
                      labelFormatter={(label: string) => periodLabel(label)}
                    />
                    <Bar dataKey="orders" fill="#6366F1" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Panel>
          </div>

          <div className="grid grid-cols-1 items-start gap-3 lg:grid-cols-3">
            <Panel title="Top services" hint="By revenue">
              <div className="max-h-[300px] space-y-2.5 overflow-auto p-3">
                {report.top_services.length === 0 && <p className="text-xs text-gray-400">No service sales in this period.</p>}
                {report.top_services.map((svc, i) => {
                  const width = topServiceRevenue > 0 ? (svc.revenue / topServiceRevenue) * 100 : 0;
                  const color = CHART_COLORS[i % CHART_COLORS.length];
                  return (
                    <div key={`${svc.name}-${i}`}>
                      <div className="flex items-center justify-between gap-2 text-xs">
                        <span className="min-w-0 truncate font-semibold text-gray-800">{svc.name}</span>
                        <span className="whitespace-nowrap font-semibold tabular-nums text-gray-900">{formatCurrency(svc.revenue)}</span>
                      </div>
                      <div className="mt-1 flex items-center gap-2">
                        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-gray-100">
                          <div className="h-full rounded-full" style={{ width: `${width}%`, background: color }} />
                        </div>
                        <span className="text-[11px] text-gray-400">{svc.count} order{svc.count === 1 ? '' : 's'}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Panel>

            <Panel title="Payment methods" hint="Share of sales">
              <div className="max-h-[300px] space-y-2.5 overflow-auto p-3">
                {report.payment_methods.length === 0 && <p className="text-xs text-gray-400">No paid orders in this period.</p>}
                {report.payment_methods.map((m, i) => {
                  const share = paymentTotal > 0 ? (m.total / paymentTotal) * 100 : 0;
                  const color = CHART_COLORS[i % CHART_COLORS.length];
                  return (
                    <div key={`${m.method}-${i}`}>
                      <div className="flex items-center justify-between gap-2 text-xs">
                        <span className="flex min-w-0 items-center gap-1.5 font-semibold capitalize text-gray-800">
                          <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: color }} />
                          <span className="truncate">{m.method.replace(/_/g, ' ')}</span>
                        </span>
                        <span className="whitespace-nowrap font-semibold tabular-nums text-gray-900">
                          {formatCurrency(m.total)} <span className="font-normal text-gray-400">({share.toFixed(1)}%)</span>
                        </span>
                      </div>
                      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-gray-100">
                        <div className="h-full rounded-full" style={{ width: `${share}%`, background: color }} />
                      </div>
                      <p className="mt-0.5 text-[11px] text-gray-400">{m.count} order{m.count === 1 ? '' : 's'}</p>
                    </div>
                  );
                })}
              </div>
            </Panel>

            <Panel title="Top vendors" hint="By sales">
              <div className="max-h-[300px] overflow-auto">
                <table className="min-w-full text-sm">
                  <thead className="sticky top-0 z-10 bg-slate-50 text-[11px] font-semibold uppercase tracking-wide text-slate-500 shadow-[0_1px_0_0_rgb(226,232,240)]">
                    <tr>
                      <th className="px-3 py-2 text-left">Vendor</th>
                      <th className="px-3 py-2 text-right">Orders</th>
                      <th className="px-3 py-2 text-right">Sales</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {report.top_vendors.length === 0 && (
                      <tr><td colSpan={3} className="px-3 py-6 text-center text-xs text-gray-400">No vendor sales in this period.</td></tr>
                    )}
                    {report.top_vendors.map((v, i) => (
                      <tr key={`${v.vendor_id ?? 'in-house'}-${i}`} className={i % 2 ? 'bg-slate-50/50' : 'bg-white'}>
                        <td className="px-3 py-2">
                          <p className="font-semibold text-gray-900">{v.name ?? 'In-house'}</p>
                          <p className="text-[11px] text-gray-400">
                            {vendorTotal > 0 ? `${((v.total_revenue / vendorTotal) * 100).toFixed(1)}% of vendor sales` : ''}
                          </p>
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums text-gray-600">{v.order_count}</td>
                        <td className="px-3 py-2 text-right font-semibold tabular-nums text-gray-900">{formatCurrency(v.total_revenue)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Panel>
          </div>

          <p className="text-[11px] text-gray-400">
            Sales are orders with recognized payment (paid, partially paid or verified), counted at order total by order date.
            Orders placed includes unpaid and cancelled orders. Weekly groups are ISO weeks.
          </p>
        </div>
      ) : null}
    </AdminLayout>
  );
}
