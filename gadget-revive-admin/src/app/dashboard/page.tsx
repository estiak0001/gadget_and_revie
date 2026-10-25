'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import {
  Wallet, ShoppingCart, Receipt, Users, Star, Ticket, Clock, Plus,
  TrendingUp, TrendingDown, CircleDollarSign,
} from 'lucide-react';
import {
  AreaChart, Area, BarChart, Bar, Legend, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { AdminLayout } from '@/components/layout';
import { Badge, LoadingSpinner, ErrorState } from '@/components/ui';
import { DateRange, DateRangeBar, Panel, presetRange } from '@/components/reports/shared';
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

// Short form for a card's headline number — "BDT 351,606.00" doesn't fit a narrow card at a
// size worth reading; "৳3.5L" does. The exact figure is still one hover away via `title`.
function compactBdt(n: number): string {
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (abs >= 10000000) return `${sign}৳${(abs / 10000000).toFixed(1)}Cr`;
  if (abs >= 100000) return `${sign}৳${(abs / 100000).toFixed(1)}L`;
  if (abs >= 1000) return `${sign}৳${(abs / 1000).toFixed(1)}k`;
  return `${sign}৳${abs.toLocaleString()}`;
}

const STAT_TONES = {
  emerald: 'bg-emerald-50 text-emerald-600',
  indigo: 'bg-indigo-50 text-indigo-600',
  sky: 'bg-sky-50 text-sky-600',
  rose: 'bg-rose-50 text-rose-600',
  amber: 'bg-amber-50 text-amber-600',
  orange: 'bg-orange-50 text-orange-600',
} as const;

// A real stat-tile contract — label, a bold headline value, an optional delta colored by
// direction, an optional one-line caption for the second-tier number it's standing in for
// (e.g. Revenue's card also carries the period's expenses, so that didn't need its own card).
function StatCard({
  label, value, exactValue, icon, tone, deltaPct, caption, href,
}: {
  label: string;
  value: string;
  exactValue?: string;
  icon: React.ReactNode;
  tone: keyof typeof STAT_TONES;
  deltaPct?: number | null;
  caption?: string;
  href?: string;
}) {
  const body = (
    <div className={`flex h-full flex-col gap-1.5 rounded-xl border border-gray-200 bg-white p-3 shadow-sm transition-all ${href ? 'hover:-translate-y-0.5 hover:border-gray-300 hover:shadow-md' : ''}`}>
      <div className="flex items-center justify-between">
        <span className={`flex h-7 w-7 items-center justify-center rounded-lg ${STAT_TONES[tone]}`}>{icon}</span>
        {deltaPct !== undefined && deltaPct !== null && (
          <span className={`inline-flex items-center gap-0.5 text-[11px] font-semibold ${deltaPct >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
            {deltaPct >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
            {Math.abs(deltaPct)}%
          </span>
        )}
      </div>
      <div>
        <p className="text-[11px] font-medium text-gray-500">{label}</p>
        <p className="truncate text-lg font-bold text-gray-900" title={exactValue}>{value}</p>
      </div>
      {caption && <p className="truncate text-[11px] text-gray-400">{caption}</p>}
    </div>
  );
  return href ? <Link href={href} className="block h-full">{body}</Link> : body;
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
        { label: 'Pending orders', value: st.orders.pending, href: '/orders?status=pending', icon: <Clock className="h-3.5 w-3.5" /> },
        { label: 'Open tickets', value: st.pending_actions.tickets, href: '/tickets', icon: <Ticket className="h-3.5 w-3.5" /> },
        { label: 'Pending reviews', value: st.pending_actions.reviews, href: '/reviews', icon: <Star className="h-3.5 w-3.5" /> },
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
          {/* Backlog alerts only take up room when there's actually a backlog — a slim banner,
              not three cards that are usually sitting at "0" taking the same space as the real
              numbers below. */}
          {attention.some((a) => a.value > 0) && (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-amber-700">Needs attention</span>
              {attention.filter((a) => a.value > 0).map((a) => (
                <Link key={a.label} href={a.href} className="flex items-center gap-1 text-xs font-semibold text-amber-900 hover:underline">
                  {a.icon}{a.value} {a.label.toLowerCase()}
                </Link>
              ))}
            </div>
          )}

          {/* Six headline numbers, not twelve — everything else (AOV, expenses, dues detail)
              rides as a caption on the card it explains, instead of getting its own box. */}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
            <StatCard
              label="Revenue"
              value={compactBdt(st.revenue.total)}
              exactValue={formatCurrency(st.revenue.total)}
              icon={<Receipt className="h-3.5 w-3.5" />}
              tone="emerald"
              deltaPct={data?.trends.revenue_change ?? undefined}
              caption={`${compactBdt(st.revenue.expenses)} expenses this period`}
            />
            <StatCard
              label="Orders placed"
              value={st.orders.total.toLocaleString()}
              icon={<ShoppingCart className="h-3.5 w-3.5" />}
              tone="indigo"
              deltaPct={data?.trends.orders_change ?? undefined}
              caption={`${st.orders.sales} paid · AOV ${compactBdt(averageOrder)}`}
              href="/orders"
            />
            <StatCard
              label="Customers"
              value={st.users.customers.toLocaleString()}
              icon={<Users className="h-3.5 w-3.5" />}
              tone="sky"
              caption={`${st.users.new_customers} new in period`}
              href="/users"
            />
            <StatCard
              label="Cash balance"
              value={compactBdt(st.cash_balance.current)}
              exactValue={formatCurrency(st.cash_balance.current)}
              icon={<Wallet className="h-3.5 w-3.5" />}
              tone="rose"
              caption="Cash account today"
              href="/accounts/cash-book"
            />
            <StatCard
              label="Net revenue"
              value={compactBdt(st.revenue.net)}
              exactValue={formatCurrency(st.revenue.net)}
              icon={st.revenue.net >= 0 ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
              tone={st.revenue.net >= 0 ? 'sky' : 'orange'}
              caption="Revenue minus expenses"
            />
            <StatCard
              label="Dues"
              value={`+${compactBdt(st.dues.receivable.total)}`}
              exactValue={`Owed to us ${formatCurrency(st.dues.receivable.total)} · We owe ${formatCurrency(st.dues.payable.total)}`}
              icon={<CircleDollarSign className="h-3.5 w-3.5" />}
              tone="amber"
              caption={`-${compactBdt(st.dues.payable.total)} we owe suppliers`}
              href="/accounts/cash-book"
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
