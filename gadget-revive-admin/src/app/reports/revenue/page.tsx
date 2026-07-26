'use client';

import React, { useState, useCallback } from 'react';
import { TrendingUp, TrendingDown, ShoppingCart, BarChart2, Wallet } from 'lucide-react';
import { AdminLayout } from '@/components/layout';
import {
  Card, CardContent, CardHeader, CardTitle,
  Button, Input, Select, LoadingSpinner, EmptyState,
} from '@/components/ui';
import { ExpenseReport, CashPosition } from '@/types';
import { formatCurrency, formatDate, getErrorMessage } from '@/lib/utils';
import adminService from '@/lib/adminService';
import toast from 'react-hot-toast';
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer, PieChart, Pie, Cell,
} from 'recharts';

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#14B8A6', '#F97316'];

const today = new Date().toISOString().split('T')[0];
const firstOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];

export default function RevenueReportPage() {
  const [startDate, setStartDate] = useState(firstOfMonth);
  const [endDate, setEndDate] = useState(today);
  const [groupBy, setGroupBy] = useState('day');
  const [report, setReport] = useState<ExpenseReport | null>(null);
  const [cashPosition, setCashPosition] = useState<CashPosition | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const fetchReport = useCallback(async () => {
    if (!startDate || !endDate) {
      toast.error('Select a date range.');
      return;
    }
    setIsLoading(true);
    try {
      const [reportRes, cashRes] = await Promise.all([
        adminService.getExpenseReport({ start_date: startDate, end_date: endDate, group_by: groupBy }),
        adminService.getCashPosition(startDate, endDate),
      ]);
      setReport(reportRes.data.data);
      setCashPosition(cashRes.data?.data ?? null);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  }, [startDate, endDate, groupBy]);

  // Merge sales and expense trends into one array for the combo chart
  const trendData = React.useMemo(() => {
    if (!report) return [];
    const map = new Map<string, { period: string; sales: number; expenses: number }>();
    report.sales_trend.forEach((r) => {
      map.set(r.period, { period: r.period, sales: Number(r.total), expenses: 0 });
    });
    report.expense_trend.forEach((r) => {
      const existing = map.get(r.period);
      if (existing) {
        existing.expenses = Number(r.total);
      } else {
        map.set(r.period, { period: r.period, sales: 0, expenses: Number(r.total) });
      }
    });
    return Array.from(map.values()).sort((a, b) => a.period.localeCompare(b.period));
  }, [report]);

  const summary = report?.summary;
  const netPositive = (summary?.net_revenue ?? 0) >= 0;

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Revenue Report</h1>
            <p className="text-sm text-gray-500 mt-1">Sales − Expenses = Net Revenue</p>
          </div>
          <div className="flex gap-2 text-sm text-gray-500">
            <a href="/reports/sales" className="hover:text-gray-900">Sales Report</a>
            <span>·</span>
            <a href="/expenses" className="hover:text-gray-900">Expenses</a>
          </div>
        </div>

        {/* Filter Bar */}
        <Card>
          <CardContent className="pt-4">
            <div className="flex flex-wrap gap-3 items-end">
              <div className="flex-1 min-w-[140px]">
                <Input
                  label="From"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              <div className="flex-1 min-w-[140px]">
                <Input
                  label="To"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
              <div className="w-36">
                <Select
                  label="Group by"
                  value={groupBy}
                  onChange={(e) => setGroupBy(e.target.value)}
                  options={[
                    { value: 'day', label: 'Daily' },
                    { value: 'month', label: 'Monthly' },
                  ]}
                />
              </div>
              <Button onClick={fetchReport} isLoading={isLoading} leftIcon={<BarChart2 className="w-4 h-4" />}>
                Generate
              </Button>
            </div>
          </CardContent>
        </Card>

        {isLoading && (
          <div className="flex justify-center py-16"><LoadingSpinner /></div>
        )}

        {!isLoading && !report && (
          <EmptyState
            title="No report generated"
            description="Select a date range and click Generate."
          />
        )}

        {!isLoading && report && (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardContent className="pt-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-100">
                      <ShoppingCart className="w-5 h-5 text-green-600" />
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 uppercase tracking-wide">Total Sales</p>
                      <p className="text-xl font-bold text-gray-900">{formatCurrency(summary!.total_sales)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-100">
                      <TrendingDown className="w-5 h-5 text-red-600" />
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 uppercase tracking-wide">Total Expenses</p>
                      <p className="text-xl font-bold text-gray-900">{formatCurrency(summary!.total_expenses)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-4">
                  <div className="flex items-center gap-3">
                    <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${netPositive ? 'bg-blue-100' : 'bg-orange-100'}`}>
                      {netPositive
                        ? <TrendingUp className="w-5 h-5 text-blue-600" />
                        : <TrendingDown className="w-5 h-5 text-orange-600" />
                      }
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 uppercase tracking-wide">Net Revenue</p>
                      <p className={`text-xl font-bold ${netPositive ? 'text-blue-700' : 'text-orange-600'}`}>
                        {formatCurrency(summary!.net_revenue)}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-100">
                      <Wallet className="w-5 h-5 text-primary-600" />
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 uppercase tracking-wide">Cash Balance</p>
                      <p className="text-xl font-bold text-primary-700">
                        {cashPosition ? formatCurrency(cashPosition.closing_balance) : '—'}
                      </p>
                      <p className="text-[11px] text-gray-400">as of {endDate}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Sales vs Expenses Trend Chart */}
            {trendData.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Sales vs Expenses ({groupBy === 'month' ? 'Monthly' : 'Daily'})</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={280}>
                    <LineChart data={trendData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="period" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `৳${(v / 1000).toFixed(0)}k`} />
                      <Tooltip formatter={(value: number) => formatCurrency(value)} />
                      <Legend />
                      <Line type="monotone" dataKey="sales" stroke="#10B981" name="Sales" strokeWidth={2} dot={false} />
                      <Line type="monotone" dataKey="expenses" stroke="#EF4444" name="Expenses" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              {/* Expenses by Category — Bar chart */}
              {report.by_category.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Expenses by Category</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={240}>
                      <BarChart data={report.by_category} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                        <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v) => `৳${(v / 1000).toFixed(0)}k`} />
                        <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={100} />
                        <Tooltip formatter={(value: number) => formatCurrency(value)} />
                        <Bar dataKey="total" name="Amount" radius={[0, 4, 4, 0]}>
                          {report.by_category.map((_, i) => (
                            <Cell key={i} fill={COLORS[i % COLORS.length]} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              )}

              {/* Category Breakdown — Pie chart */}
              {report.by_category.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Category Share</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-col items-center">
                      <ResponsiveContainer width="100%" height={200}>
                        <PieChart>
                          <Pie
                            data={report.by_category}
                            dataKey="total"
                            nameKey="name"
                            cx="50%"
                            cy="50%"
                            outerRadius={80}
                            label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                            labelLine={false}
                          >
                            {report.by_category.map((_, i) => (
                              <Cell key={i} fill={COLORS[i % COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip formatter={(value: number) => formatCurrency(value)} />
                        </PieChart>
                      </ResponsiveContainer>
                      {/* Legend */}
                      <div className="mt-2 flex flex-wrap justify-center gap-x-4 gap-y-1">
                        {report.by_category.map((cat, i) => (
                          <div key={cat.id} className="flex items-center gap-1.5 text-xs">
                            <span className="inline-block h-3 w-3 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
                            <span className="text-gray-600">{cat.name}</span>
                            <span className="font-medium text-gray-900">{formatCurrency(cat.total)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Recent Expenses Table */}
            {report.recent_expenses.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Recent Expenses in Period</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-200 text-left">
                          <th className="pb-2 pr-4 font-semibold text-gray-600">Title</th>
                          <th className="pb-2 pr-4 font-semibold text-gray-600">Category</th>
                          <th className="pb-2 pr-4 font-semibold text-gray-600 text-right">Amount</th>
                          <th className="pb-2 font-semibold text-gray-600">Date</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {report.recent_expenses.map((exp) => (
                          <tr key={exp.id} className="hover:bg-gray-50">
                            <td className="py-2 pr-4 font-medium text-gray-900">{exp.title}</td>
                            <td className="py-2 pr-4 text-gray-500">{exp.category?.name ?? '—'}</td>
                            <td className="py-2 pr-4 text-right font-medium text-red-600">{formatCurrency(Number(exp.amount))}</td>
                            <td className="py-2 text-gray-500">{formatDate(exp.expense_date)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
    </AdminLayout>
  );
}
