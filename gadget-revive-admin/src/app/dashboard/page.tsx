'use client';

import React, { useEffect, useState } from 'react';
import {
  Users,
  ShoppingCart,
  DollarSign,
  Wallet,
  Clock,
  TrendingUp,
  TrendingDown,
  Calendar,
  Plus,
  BarChart3,
  BookOpen,
  Wrench,
} from 'lucide-react';
import { AdminLayout } from '@/components/layout';
import { Card, CardContent, CardHeader, CardTitle, Badge, LoadingSpinner, ErrorState } from '@/components/ui';
import { formatCurrency, formatDate, getErrorMessage } from '@/lib/utils';
import adminService from '@/lib/adminService';
import { DashboardStatsWithTrends } from '@/types';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
} from 'recharts';
import Link from 'next/link';
import toast from 'react-hot-toast';

interface StatTileProps {
  title: string;
  value: string;
  icon: React.ReactNode;
  iconBg: string;
  change?: number;
  href?: string;
}

const StatTile: React.FC<StatTileProps> = ({ title, value, icon, iconBg, change, href }) => {
  const body = (
    <Card className="rounded-xl border-gray-100 hover:shadow-md hover:border-primary-200 transition-all h-full">
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${iconBg}`}>
            {icon}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-gray-500 leading-tight">{title}</p>
            <p className="text-base font-bold text-gray-900 leading-snug break-words">{value}</p>
          </div>
        </div>
        {change !== undefined && (
          <div className={`flex items-center gap-1 mt-2 text-xs font-medium ${change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {change >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
            {change >= 0 ? '+' : ''}{change}%
            <span className="text-gray-400 font-normal">vs prev</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
  return href ? <Link href={href}>{body}</Link> : body;
};

interface QuickAction {
  title: string;
  href: string;
  icon: React.ReactNode;
  primary?: boolean;
}

const QUICK_ACTIONS: QuickAction[] = [
  { title: 'Create Order', href: '/orders/create', icon: <Plus className="w-3.5 h-3.5" />, primary: true },
  { title: 'Add Product', href: '/products', icon: <Plus className="w-3.5 h-3.5" /> },
  { title: 'Add Expense', href: '/expenses', icon: <Plus className="w-3.5 h-3.5" /> },
  { title: 'Cash Book', href: '/accounts/cash-book', icon: <Wallet className="w-3.5 h-3.5" /> },
  { title: 'Reports', href: '/reports/sales', icon: <BarChart3 className="w-3.5 h-3.5" /> },
  { title: 'Accounts', href: '/accounts', icon: <BookOpen className="w-3.5 h-3.5" /> },
  { title: 'Services', href: '/services', icon: <Wrench className="w-3.5 h-3.5" /> },
];

const RANGE_PRESETS: { key: string; label: string }[] = [
  { key: '7d', label: 'Last 7 days' },
  { key: '30d', label: 'Last 30 days' },
  { key: 'month', label: 'This month' },
  { key: '90d', label: 'Last 90 days' },
];

const fmtDate = (d: Date) => {
  const tz = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return tz.toISOString().slice(0, 10);
};

function computeRange(key: string, customStart: string, customEnd: string): { start_date: string; end_date: string } {
  if (key === 'custom' && customStart && customEnd) {
    return { start_date: customStart, end_date: customEnd };
  }
  const end = new Date();
  let start = new Date();
  if (key === '7d') start.setDate(end.getDate() - 6);
  else if (key === '90d') start.setDate(end.getDate() - 89);
  else if (key === 'month') start = new Date(end.getFullYear(), end.getMonth(), 1);
  else start.setDate(end.getDate() - 29); // 30d default
  return { start_date: fmtDate(start), end_date: fmtDate(end) };
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStatsWithTrends | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);

  // Date-range filter
  const [rangeKey, setRangeKey] = useState('30d');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');

  useEffect(() => {
    // Wait for both custom dates before fetching a custom range.
    if (rangeKey === 'custom' && (!customStart || !customEnd)) return;
    fetchDashboardStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rangeKey, customStart, customEnd]);

  // Safely extract a numeric count from a value that the API may return as
  // a number, an array (use .length), or an object (fall back to 0).
  const safeCount = (val: unknown): number => {
    if (typeof val === 'number') return val;
    if (Array.isArray(val)) return val.length;
    return 0;
  };

  const fetchDashboardStats = async () => {
    setIsLoading(true);
    setError(false);
    try {
      const response = await adminService.getDashboardStats(computeRange(rangeKey, customStart, customEnd));
      // Cast through unknown because the API response shape does not exactly
      // match the DashboardStats type — it wraps counts in a `statistics` object.
      const raw = response.data.data as unknown as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
      // The API wraps all counts inside a `statistics` object.
      // Fall back to direct fields for backward compatibility.
      const stats = raw.statistics ?? raw;
      setStats({
        ...raw,
        total_users: safeCount(stats.users?.total ?? raw.total_users),
        total_vendors: safeCount(stats.vendors?.total ?? raw.total_vendors),
        total_orders: safeCount(stats.orders?.total ?? raw.total_orders),
        total_revenue: typeof (stats.revenue?.total ?? raw.total_revenue) === 'number'
          ? (stats.revenue?.total ?? raw.total_revenue)
          : 0,
        current_cash_balance: typeof stats.cash_balance?.current === 'number' ? stats.cash_balance.current : 0,
        pending_vendors: safeCount(stats.pending_actions?.vendors ?? stats.vendors?.pending ?? raw.pending_vendors),
        pending_orders: safeCount(stats.orders?.pending ?? raw.pending_orders),
        recent_orders: Array.isArray(raw.recent_orders) ? raw.recent_orders : [],
        revenue_chart: Array.isArray(raw.revenue_chart) ? raw.revenue_chart : [],
      });
    } catch (err) {
      console.error('Error fetching dashboard stats:', err);
      toast.error(getErrorMessage(err));
      setError(true);
      setStats(null);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading && !stats) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-96">
          <LoadingSpinner size="lg" text="Loading dashboard..." />
        </div>
      </AdminLayout>
    );
  }

  if (error && !stats) {
    return (
      <AdminLayout>
        <ErrorState
          title="Failed to load dashboard"
          message="Could not fetch dashboard data. Please try again."
          onRetry={fetchDashboardStats}
        />
      </AdminLayout>
    );
  }

  const setPreset = (key: string) => { setCustomStart(''); setCustomEnd(''); setRangeKey(key); };
  const periodRevenueTotal = (stats?.revenue_chart || []).reduce((sum, r) => sum + (r.revenue || 0), 0);

  return (
    <AdminLayout>
      <div className="page-header flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-description">Welcome to Gadget Revibe Admin Panel</p>
        </div>

        {/* Date-range filter */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center rounded-lg border border-gray-200 bg-white p-0.5">
            {RANGE_PRESETS.map((p) => (
              <button
                key={p.key}
                onClick={() => setPreset(p.key)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  rangeKey === p.key ? 'bg-primary-600 text-white' : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-2 py-1">
            <Calendar className="w-4 h-4 text-gray-400" />
            <input
              type="date"
              value={customStart || (rangeKey !== 'custom' ? computeRange(rangeKey, customStart, customEnd).start_date : '')}
              max={customEnd || undefined}
              onChange={(e) => { setRangeKey('custom'); setCustomStart(e.target.value); }}
              className="text-xs text-gray-700 bg-transparent focus:outline-none"
            />
            <span className="text-gray-400 text-xs">–</span>
            <input
              type="date"
              value={customEnd || (rangeKey !== 'custom' ? computeRange(rangeKey, customStart, customEnd).end_date : '')}
              min={customStart || undefined}
              onChange={(e) => { setRangeKey('custom'); setCustomEnd(e.target.value); }}
              className="text-xs text-gray-700 bg-transparent focus:outline-none"
            />
          </div>
          {isLoading && <span className="text-xs text-gray-400">Updating…</span>}
        </div>
      </div>

      {/* Necessary links — slim quick-access bar (full navigation lives in the sidebar) */}
      <div className="flex flex-wrap gap-2 mb-5">
        {QUICK_ACTIONS.map((action) => (
          <Link
            key={action.href}
            href={action.href}
            className={
              action.primary
                ? 'inline-flex items-center gap-1.5 rounded-full bg-primary-600 px-3.5 py-1.5 text-xs font-medium text-white hover:bg-primary-700 transition-colors'
                : 'inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-white px-3.5 py-1.5 text-xs font-medium text-gray-600 hover:border-primary-200 hover:text-primary-700 hover:bg-primary-50/50 transition-colors'
            }
          >
            {action.icon}
            {action.title}
          </Link>
        ))}
      </div>

      {/* Stats — compact tiles, including pending counters (linked out to their full lists) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-5">
        <StatTile
          title="Users"
          value={stats?.total_users?.toLocaleString() || '0'}
          icon={<Users className="w-5 h-5 text-primary-600" />}
          iconBg="bg-primary-50"
          change={stats?.trends?.users_change}
        />
        <StatTile
          title="Orders"
          value={stats?.total_orders?.toLocaleString() || '0'}
          icon={<ShoppingCart className="w-5 h-5 text-indigo-600" />}
          iconBg="bg-indigo-50"
          change={stats?.trends?.orders_change}
        />
        <StatTile
          title="Revenue"
          value={formatCurrency(stats?.total_revenue || 0)}
          icon={<DollarSign className="w-5 h-5 text-emerald-600" />}
          iconBg="bg-emerald-50"
          change={stats?.trends?.revenue_change}
        />
        <StatTile
          title="Cash Balance"
          value={formatCurrency(stats?.current_cash_balance || 0)}
          icon={<Wallet className="w-5 h-5 text-teal-600" />}
          iconBg="bg-teal-50"
        />
        <StatTile
          title="Pend. Orders"
          value={String(stats?.pending_orders || 0)}
          icon={<Clock className="w-5 h-5 text-orange-600" />}
          iconBg="bg-orange-50"
          href="/orders?status=pending"
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-5">
        <Card className="rounded-xl border-gray-100">
          <CardHeader className="flex flex-row items-center justify-between py-3.5">
            <CardTitle className="text-sm">Revenue Overview</CardTitle>
            <span className="text-sm font-semibold text-gray-900">{formatCurrency(periodRevenueTotal)}</span>
          </CardHeader>
          <CardContent className="pt-2">
            <div className="h-56">
              {stats?.revenue_chart && stats.revenue_chart.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={stats.revenue_chart} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
                    <defs>
                      <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#2563eb" stopOpacity={0.35} />
                        <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis
                      dataKey="date"
                      tickFormatter={(value) => new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      tick={{ fontSize: 11, fill: '#9ca3af' }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      tickFormatter={(value) => `৳${(value / 1000).toFixed(0)}k`}
                      tick={{ fontSize: 11, fill: '#9ca3af' }}
                      axisLine={false}
                      tickLine={false}
                      width={44}
                    />
                    <Tooltip
                      formatter={(value: number) => [formatCurrency(value), 'Revenue']}
                      labelFormatter={(label) => formatDate(label)}
                      contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }}
                    />
                    <Area
                      type="monotone"
                      dataKey="revenue"
                      stroke="#2563eb"
                      strokeWidth={2}
                      fill="url(#revenueGradient)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-gray-400 text-sm">
                  No revenue data available
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-xl border-gray-100">
          <CardHeader className="py-3.5">
            <CardTitle className="text-sm">Daily Orders</CardTitle>
          </CardHeader>
          <CardContent className="pt-2">
            <div className="h-56">
              {stats?.revenue_chart && stats.revenue_chart.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stats.revenue_chart} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis
                      dataKey="date"
                      tickFormatter={(value) => new Date(value).toLocaleDateString('en-US', { weekday: 'short' })}
                      tick={{ fontSize: 11, fill: '#9ca3af' }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} width={28} />
                    <Tooltip
                      formatter={(value: number) => [value, 'Orders']}
                      labelFormatter={(label) => formatDate(label)}
                      contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }}
                    />
                    <Bar dataKey="orders" fill="#6366f1" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-gray-400 text-sm">
                  No order data available
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Orders */}
      <Card className="rounded-xl border-gray-100">
        <CardHeader className="flex flex-row items-center justify-between py-3.5">
          <CardTitle className="text-sm">Recent Orders</CardTitle>
          <Link
            href="/orders"
            className="text-primary-600 hover:text-primary-700 text-xs font-medium"
          >
            View all
          </Link>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2.5 text-left text-[11px] font-medium text-gray-500 uppercase tracking-wide">Order ID</th>
                  <th className="px-4 py-2.5 text-left text-[11px] font-medium text-gray-500 uppercase tracking-wide">Customer</th>
                  <th className="px-4 py-2.5 text-left text-[11px] font-medium text-gray-500 uppercase tracking-wide">Amount</th>
                  <th className="px-4 py-2.5 text-left text-[11px] font-medium text-gray-500 uppercase tracking-wide">Status</th>
                  <th className="px-4 py-2.5 text-left text-[11px] font-medium text-gray-500 uppercase tracking-wide">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {stats?.recent_orders && stats.recent_orders.length > 0 ? (
                  stats.recent_orders.map((order) => (
                    <tr key={order.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">
                        <Link href={`/orders/${order.id}`} className="hover:text-primary-600">
                          {order.order_number}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">
                        {order.customer?.name || order.customer_name || '-'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        {formatCurrency(order.total)}
                      </td>
                      <td className="px-4 py-3">
                        <Badge
                          variant={
                            (order.order_status ?? order.status) === 'completed' ? 'success' :
                              (order.order_status ?? order.status) === 'cancelled' ? 'danger' :
                                (order.order_status ?? order.status) === 'pending' ? 'warning' : 'info'
                          }
                        >
                          {(order.order_status ?? order.status ?? '-').replace(/_/g, ' ')}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">
                        {formatDate(order.created_at)}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="px-4 py-12 text-center text-gray-500">
                      No recent orders
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </AdminLayout>
  );
}
