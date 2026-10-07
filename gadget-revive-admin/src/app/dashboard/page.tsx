'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import {
  Wallet, ShoppingCart, Receipt, Users, Star, Ticket, Clock, Plus,
  TrendingUp, TrendingDown, CircleDollarSign, Truck,
} from 'lucide-react';
import {
  AreaChart, Area, BarChart, Bar, Legend, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { AdminLayout } from '@/components/layout';
import { Badge, LoadingSpinner, ErrorState } from '@/components/ui';
import { DateRange, DateRangeBar, KpiTile, Panel, presetRange } from '@/components/reports/shared';
import { formatCurrency, formatDate, getErrorMessage } from '@/lib/utils';
import adminService from '@/lib/adminService';

interface DashboardResponse {
  statistics: {
    users: { total: number; customers: number; new_customers: number };
    orders: { total: number; sales: number; pending: number; completed: number; cancelled: number };
    revenue: { total: number; expenses: number; net: number };
    dues: {
      receivable: { total: number; count: number };
      payable: { total: number; count: number };
    };
    cash_balance: { current: number };
    pending_actions: { tickets: number; reviews: number };
  };
  trends: { revenue_change: number | null; orders_change: number | null };
  revenue_chart: { date: string; revenue: number; orders: number; sales_orders: number }[];
  recent_orders: {
    id: number;
    order_number: string;
    customer?: { name?: string } | null;
    customer_name?: string | null;
    customer_phone?: string | null;
    total: number | string;
    payment_status: string;
    payment_method?: string | null;
    order_status: string;
    items_count?: number;
    created_at: string;
  }[];
}

const QUICK_LINKS = [
  { title: 'Create order', href: '/orders/create', primary: true },
  { title: 'Add product', href: '/products' },
  { title: 'Add expense', href: '/expenses' },
  { title: 'Cash book', href: '/accounts/cash-book' },
  { title: 'Reports', href: '/reports/sales' },
];

const DATE_PRESETS: DateRange['preset'][] = ['7d', '30d', 'month', '90d', 'custom'];

function dayLabel(date: string): string {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

function statusVariant(status: string): 'success' | 'danger' | 'warning' | 'info' {
  if (status === 'completed') return 'success';
  if (status === 'cancelled' || status === 'refunded') return 'danger';
  if (status === 'pending') return 'warning';
  return 'info';
}

function paymentVariant(status: string): 'success' | 'danger' | 'warning' | 'default' {
  if (status === 'paid' || status === 'verified') return 'success';
  if (status === 'failed' || status === 'cancelled') return 'danger';
  if (status === 'refunded') return 'default';
  return 'warning'; // pending, awaiting_confirmation, partially_paid
}

function TrendNote({ change }: { change: number | null | undefined }) {
  if (change === null || change === undefined) {
    return <span className="opacity-70">No previous period to compare</span>;
  }
  const up = change >= 0;
  return (
    <span className={`font-semibold ${up ? 'text-emerald-700' : 'text-rose-700'}`}>
      {up ? '+' : ''}{change}% <span className="font-normal opacity-70">vs previous period</span>
    </span>
  );
}

export default function DashboardPage() {
  const [range, setRange] = useState<DateRange>(() => presetRange('30d'));
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const fetchDashboard = useCallback(async () => {
    if (!range.start || !range.end) return;
    if (range.start > range.end) {
      toast.error('The start date must be on or before the end date.');
      return;
    }
    setLoading(true);
    setError(false);
    try {
      const res = await adminService.getDashboardStats({ start_date: range.start, end_date: range.end });
      setData(res.data.data as unknown as DashboardResponse);
    } catch (err) {
      toast.error(getErrorMessage(err));
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [range]);

  useEffect(() => { fetchDashboard(); }, [fetchDashboard]);

  if (loading && !data) {
    return (
      <AdminLayout>
        <div className="flex h-96 items-center justify-center"><LoadingSpinner size="lg" text="Loading dashboard…" /></div>
      </AdminLayout>
    );
  }

  if (error && !data) {
    return (
      <AdminLayout>
        <ErrorState title="Failed to load dashboard" message="Could not fetch dashboard data. Please try again." onRetry={fetchDashboard} />
      </AdminLayout>
    );
  }

  const st = data?.statistics;
  const chart = data?.revenue_chart ?? [];
  const periodRevenue = chart.reduce((n, r) => n + r.revenue, 0);
  const periodOrders = chart.reduce((n, r) => n + r.orders, 0);
  const periodPaid = chart.reduce((n, r) => n + r.sales_orders, 0);
  const averageOrder = st && st.orders.sales > 0 ? st.revenue.total / st.orders.sales : 0;

  const attention = st
    ? [
        { label: 'Pending orders', value: st.orders.pending, href: '/orders?status=pending', kpiTone: 'orange' as const, icon: <Clock className="h-4 w-4 opacity-60" /> },
        { label: 'Open tickets', value: st.pending_actions.tickets, href: '/tickets', kpiTone: 'rose' as const, icon: <Ticket className="h-4 w-4 opacity-60" /> },
        { label: 'Pending reviews', value: st.pending_actions.reviews, href: '/reviews', kpiTone: 'amber' as const, icon: <Star className="h-4 w-4 opacity-60" /> },
      ]
    : [];

  return (
    <AdminLayout>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-baseline gap-2">
          <h1 className="text-lg font-bold text-gray-900">Dashboard</h1>
          <p className="text-xs text-gray-500">Sales, money and stock for the selected period</p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {QUICK_LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold transition-colors ${
                l.primary ? 'bg-indigo-600 text-white hover:bg-indigo-700' : 'border border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
              }`}
            >
              {l.primary && <Plus className="h-3 w-3" />}
              {l.title}
            </Link>
          ))}
        </div>
      </div>

      <div className="mb-3">
        <DateRangeBar
          range={range}
          onChange={setRange}
          presets={DATE_PRESETS}
          right={loading ? <span className="text-xs text-gray-400">Updating…</span> : undefined}
        />
      </div>

      {st && (
        <div className="space-y-2">
          {/* One consistent grid for everything — backlog alerts (clickable) and money/order
              stats side by side, same tile size throughout. The old split into a differently
              styled "pills" row plus two unevenly-sized KPI rows (5 then 4 columns) left tile
              edges misaligned row to row, which read as cluttered; one grid fixes that and is
              shorter overall, which is what keeps the whole dashboard inside the viewport. */}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
            {attention.map((a) => (
              <Link key={a.label} href={a.href} className="block">
                <KpiTile label={a.label} value={a.value.toLocaleString()} tone={a.kpiTone} icon={a.icon} />
              </Link>
            ))}
            <KpiTile
              label="Revenue"
              value={formatCurrency(st.revenue.total)}
              tone="emerald"
              icon={<Receipt className="h-4 w-4 opacity-60" />}
              sub={<TrendNote change={data?.trends.revenue_change} />}
            />
            <KpiTile
              label="Orders placed"
              value={st.orders.total.toLocaleString()}
              tone="indigo"
              icon={<ShoppingCart className="h-4 w-4 opacity-60" />}
              sub={<>{st.orders.sales} paid · {st.orders.cancelled} cancelled<br /><TrendNote change={data?.trends.orders_change} /></>}
            />
            <KpiTile
              label="Average order value"
              value={formatCurrency(averageOrder)}
              tone="amber"
              sub="Revenue ÷ paid orders"
            />
            <KpiTile
              label="Customers"
              value={st.users.customers.toLocaleString()}
              tone="sky"
              icon={<Users className="h-4 w-4 opacity-60" />}
              sub={`${st.users.new_customers} new in period · all-time total`}
            />
            <KpiTile
              label="Cash balance"
              value={formatCurrency(st.cash_balance.current)}
              tone="rose"
              icon={<Wallet className="h-4 w-4 opacity-60" />}
              sub="Cash account today"
            />
            <KpiTile
              label="Expenses"
              value={formatCurrency(st.revenue.expenses)}
              tone="rose"
              icon={<Receipt className="h-4 w-4 opacity-60" />}
              sub="All expense categories in period"
            />
            <KpiTile
              label="Net revenue"
              value={formatCurrency(st.revenue.net)}
              tone={st.revenue.net >= 0 ? 'sky' : 'orange'}
              icon={st.revenue.net >= 0 ? <TrendingUp className="h-4 w-4 opacity-60" /> : <TrendingDown className="h-4 w-4 opacity-60" />}
              sub="Revenue minus expenses"
            />
            <KpiTile
              label="Owed to us"
              value={formatCurrency(st.dues.receivable.total)}
              tone="emerald"
              icon={<CircleDollarSign className="h-4 w-4 opacity-60" />}
              sub={`${st.dues.receivable.count} open order${st.dues.receivable.count === 1 ? '' : 's'} · all-time`}
            />
            <KpiTile
              label="We owe suppliers"
              value={formatCurrency(st.dues.payable.total)}
              tone="amber"
              icon={<Truck className="h-4 w-4 opacity-60" />}
              sub={`${st.dues.payable.count} purchase order${st.dues.payable.count === 1 ? '' : 's'} · all-time`}
            />
          </div>

          <div className="grid grid-cols-1 gap-2 lg:grid-cols-2">
            <Panel title="Revenue" hint="Paid orders by order date" right={<span className="text-sm font-bold tabular-nums text-emerald-700">{formatCurrency(periodRevenue)}</span>}>
              <div className="p-3">
                {chart.length === 0 ? (
                  <p className="flex h-40 items-center justify-center text-xs text-gray-400">No revenue in this period.</p>
                ) : (
                  <ResponsiveContainer width="100%" height={160}>
                    <AreaChart data={chart} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="dashRevenue" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10B981" stopOpacity={0.35} />
                          <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                      <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={dayLabel} />
                      <YAxis
                        tick={{ fontSize: 11 }}
                        width={56}
                        tickFormatter={(v: number) => (v >= 1000 ? `৳${(v / 1000).toFixed(0)}k` : `৳${v}`)}
                      />
                      <Tooltip formatter={(v: number) => [formatCurrency(v), 'Revenue']} labelFormatter={(l: string) => dayLabel(l)} />
                      <Area type="monotone" dataKey="revenue" stroke="#10B981" strokeWidth={2} fill="url(#dashRevenue)" />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </div>
            </Panel>

            <Panel title="Orders" hint="Placed vs paid" right={<span className="text-[11px] tabular-nums text-gray-500">{periodPaid} paid of {periodOrders} placed</span>}>
              <div className="p-3">
                {chart.length === 0 ? (
                  <p className="flex h-40 items-center justify-center text-xs text-gray-400">No orders in this period.</p>
                ) : (
                  <ResponsiveContainer width="100%" height={160}>
                    <BarChart data={chart} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                      <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={dayLabel} />
                      <YAxis tick={{ fontSize: 11 }} width={32} allowDecimals={false} />
                      <Tooltip labelFormatter={(l: string) => dayLabel(l)} />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                      <Bar dataKey="orders" name="Placed" fill="#C7D2FE" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="sales_orders" name="Paid" fill="#6366F1" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </Panel>
          </div>

          <Panel title="Latest orders" hint="Most recent, all-time" right={<Link href="/orders" className="text-xs font-semibold text-indigo-700 hover:underline">View all</Link>}>
            <div className="max-h-[300px] overflow-auto">
              <table className="min-w-full text-sm">
                <thead className="sticky top-0 z-10 bg-slate-50 text-xs uppercase tracking-wide text-slate-500 shadow-[0_1px_0_0_rgb(226,232,240)]">
                  <tr>
                    <th className="px-2.5 py-1.5 text-left font-semibold">Order</th>
                    <th className="px-2.5 py-1.5 text-left font-semibold">Customer</th>
                    <th className="px-2.5 py-1.5 text-center font-semibold">Items</th>
                    <th className="px-2.5 py-1.5 text-right font-semibold">Total</th>
                    <th className="px-2.5 py-1.5 text-left font-semibold">Payment</th>
                    <th className="px-2.5 py-1.5 text-left font-semibold">Method</th>
                    <th className="px-2.5 py-1.5 text-left font-semibold">Status</th>
                    <th className="whitespace-nowrap px-2.5 py-1.5 text-left font-semibold">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {(data?.recent_orders ?? []).length === 0 && (
                    <tr><td colSpan={8} className="px-3 py-6 text-center text-xs text-gray-400">No orders yet.</td></tr>
                  )}
                  {data?.recent_orders.map((o, i) => (
                    <tr key={o.id} className={`${i % 2 ? 'bg-slate-50/50' : 'bg-white'} hover:bg-indigo-50/40`}>
                      <td className="px-2.5 py-1.5">
                        <Link href={`/orders/${o.id}`} className="font-mono font-semibold text-indigo-700 hover:underline">{o.order_number}</Link>
                      </td>
                      <td className="px-2.5 py-1.5 text-gray-700">
                        <p>{o.customer?.name || o.customer_name || '—'}</p>
                        {o.customer_phone && <p className="text-[11px] text-gray-400">{o.customer_phone}</p>}
                      </td>
                      <td className="px-2.5 py-1.5 text-center tabular-nums text-gray-500">{o.items_count ?? '—'}</td>
                      <td className="px-2.5 py-1.5 text-right font-semibold tabular-nums text-gray-900">{formatCurrency(Number(o.total))}</td>
                      <td className="px-2.5 py-1.5">
                        <Badge variant={paymentVariant(o.payment_status)} className="px-1.5 py-0.5 text-[11px]">{o.payment_status.replace(/_/g, ' ')}</Badge>
                      </td>
                      <td className="px-2.5 py-1.5 text-xs capitalize text-gray-500">{o.payment_method?.replace(/_/g, ' ') || '—'}</td>
                      <td className="px-2.5 py-1.5">
                        <Badge variant={statusVariant(o.order_status)}>{o.order_status.replace(/_/g, ' ')}</Badge>
                      </td>
                      <td className="whitespace-nowrap px-2.5 py-1.5 text-xs tabular-nums text-gray-500">{formatDate(o.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>

          <p className="text-[11px] text-gray-400">
            Revenue counts orders whose payment is recognized (paid, partially paid or verified), by order date.
            Expenses include every active expense in the period, including Asset and Purchase categories.
            Owed to us and we owe suppliers match the Dues page and are all-time. Attention counts are current backlogs.
          </p>
        </div>
      )}
    </AdminLayout>
  );
}
