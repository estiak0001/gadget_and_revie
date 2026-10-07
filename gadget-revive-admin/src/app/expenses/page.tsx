'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import {
  Plus, Pencil, Trash2, ArrowUpCircle, Undo2, History, Download, Search,
  Receipt, Trophy, AlertTriangle, TrendingUp, TrendingDown,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { AdminLayout } from '@/components/layout';
import {
  Button, Input, Select, Modal, Badge, LoadingSpinner, Pagination, EmptyState, ErrorState, HistoryModal,
} from '@/components/ui';
import { Expense, ExpenseCategory, ExpenseAnalytics } from '@/types';
import { formatCurrency, formatDate, getErrorMessage, downloadBlob } from '@/lib/utils';
import adminService from '@/lib/adminService';

const EMPTY_FORM = {
  expense_category_id: '',
  title: '',
  amount: '',
  expense_date: new Date().toISOString().split('T')[0],
  description: '',
  reference: '',
};

type Tab = 'list' | 'report';
type ListView = 'active' | 'reversed';
type Preset = 'all' | 'today' | '7d' | 'month' | 'last_month' | 'year' | 'custom';
type LedgerFilter = '' | 'synced' | 'unsynced';
type GroupBy = 'auto' | 'day' | 'week' | 'month';

interface Filters {
  preset: Preset;
  start: string;
  end: string;
  categories: number[];
  ledger: LedgerFilter;
  search: string;
  minAmount: string;
  maxAmount: string;
}

const EMPTY_FILTERS: Filters = {
  preset: 'all', start: '', end: '', categories: [], ledger: '', search: '', minAmount: '', maxAmount: '',
};

const PRESETS: { value: Preset; label: string }[] = [
  { value: 'all', label: 'All time' },
  { value: 'today', label: 'Today' },
  { value: '7d', label: 'Last 7 days' },
  { value: 'month', label: 'This month' },
  { value: 'last_month', label: 'Last month' },
  { value: 'year', label: 'This year' },
  { value: 'custom', label: 'Custom' },
];

const GROUP_OPTIONS: { value: GroupBy; label: string }[] = [
  { value: 'auto', label: 'Auto' },
  { value: 'day', label: 'Daily' },
  { value: 'week', label: 'Weekly' },
  { value: 'month', label: 'Monthly' },
];

const CHART_COLORS = ['#6366F1', '#0EA5E9', '#10B981', '#F59E0B', '#F43F5E', '#8B5CF6', '#14B8A6', '#F97316', '#EC4899', '#84CC16'];

const FIELD = 'h-8 rounded-lg border border-gray-300 bg-white px-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500';

function chipClass(on: boolean) {
  return `rounded-full border px-2.5 py-1 text-xs font-semibold transition-colors ${
    on ? 'border-indigo-600 bg-indigo-600 text-white' : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
  }`;
}

function ymd(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function presetRange(preset: Preset): { start: string; end: string } | null {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  switch (preset) {
    case 'today':
      return { start: ymd(now), end: ymd(now) };
    case '7d': {
      const s = new Date(now);
      s.setDate(s.getDate() - 6);
      return { start: ymd(s), end: ymd(now) };
    }
    case 'month':
      return { start: ymd(new Date(y, m, 1)), end: ymd(now) };
    case 'last_month':
      return { start: ymd(new Date(y, m - 1, 1)), end: ymd(new Date(y, m, 0)) };
    case 'year':
      return { start: ymd(new Date(y, 0, 1)), end: ymd(now) };
    default:
      return null;
  }
}

function buildFilterParams(f: Filters): Record<string, string | number> {
  const p: Record<string, string | number> = {};
  if (f.start) p.start_date = f.start;
  if (f.end) p.end_date = f.end;
  if (f.categories.length) p.expense_category_ids = f.categories.join(',');
  if (f.ledger) p.ledger_status = f.ledger;
  if (f.search.trim()) p.search = f.search.trim();
  if (f.minAmount) p.min_amount = f.minAmount;
  if (f.maxAmount) p.max_amount = f.maxAmount;
  return p;
}

function resolveGroupBy(groupBy: GroupBy, start: string, end: string): 'day' | 'week' | 'month' {
  if (groupBy !== 'auto') return groupBy;
  if (!start || !end) return 'month';
  const days = (new Date(end).getTime() - new Date(start).getTime()) / 86400000 + 1;
  if (days <= 62) return 'day';
  if (days <= 366) return 'week';
  return 'month';
}

function hasActiveFilters(f: Filters) {
  return f.preset !== 'all' || f.categories.length > 0 || !!f.ledger || !!f.search || !!f.minAmount || !!f.maxAmount;
}

function FilterBar({
  filters, setFilters, categories, onExport, exporting,
}: {
  filters: Filters;
  setFilters: React.Dispatch<React.SetStateAction<Filters>>;
  categories: ExpenseCategory[];
  onExport: () => void;
  exporting: boolean;
}) {
  const patch = (p: Partial<Filters>) => setFilters((f) => ({ ...f, ...p }));

  const choosePreset = (preset: Preset) => {
    if (preset === 'all') return patch({ preset, start: '', end: '' });
    const range = presetRange(preset);
    if (range) return patch({ preset, ...range });
    patch({ preset });
  };

  const setDate = (key: 'start' | 'end', value: string) => patch({ [key]: value, preset: 'custom' } as Partial<Filters>);

  const toggleCategory = (id: number) =>
    patch({
      categories: filters.categories.includes(id)
        ? filters.categories.filter((c) => c !== id)
        : [...filters.categories, id],
    });

  return (
    <div className="space-y-2 rounded-xl border border-gray-200 bg-white p-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1.5">
          {PRESETS.map((p) => (
            <button key={p.value} type="button" onClick={() => choosePreset(p.value)} className={chipClass(filters.preset === p.value)}>
              {p.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          {hasActiveFilters(filters) && (
            <Button size="sm" variant="ghost" onClick={() => setFilters(EMPTY_FILTERS)}>Reset</Button>
          )}
          <Button size="sm" variant="outline" onClick={onExport} isLoading={exporting} leftIcon={<Download className="h-3.5 w-3.5" />}>
            Export CSV
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
          From
          <input type="date" value={filters.start} onChange={(e) => setDate('start', e.target.value)} className={`${FIELD} w-36`} />
        </label>
        <label className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
          To
          <input type="date" value={filters.end} onChange={(e) => setDate('end', e.target.value)} className={`${FIELD} w-36`} />
        </label>
        <div className="relative min-w-[200px] flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
          <input
            value={filters.search}
            onChange={(e) => patch({ search: e.target.value })}
            placeholder="Search title, reference or description…"
            className={`${FIELD} w-full pl-8`}
          />
        </div>
        <select value={filters.ledger} onChange={(e) => patch({ ledger: e.target.value as LedgerFilter })} className={`${FIELD} w-40`}>
          <option value="">All ledger status</option>
          <option value="synced">Posted to ledger</option>
          <option value="unsynced">Not posted</option>
        </select>
        <input
          type="number"
          min={0}
          value={filters.minAmount}
          onChange={(e) => patch({ minAmount: e.target.value })}
          placeholder="Min ৳"
          className={`${FIELD} w-24`}
        />
        <input
          type="number"
          min={0}
          value={filters.maxAmount}
          onChange={(e) => patch({ maxAmount: e.target.value })}
          placeholder="Max ৳"
          className={`${FIELD} w-24`}
        />
      </div>

      {categories.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {categories.map((c) => (
            <button key={c.id} type="button" onClick={() => toggleCategory(c.id)} className={chipClass(filters.categories.includes(c.id))}>
              {c.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function KpiTile({
  label, value, sub, tone, icon,
}: {
  label: string;
  value: string;
  sub?: React.ReactNode;
  tone: 'rose' | 'indigo' | 'amber' | 'orange' | 'emerald';
  icon: React.ReactNode;
}) {
  const tones: Record<typeof tone, string> = {
    rose: 'border-rose-200 bg-rose-50/60 text-rose-800',
    indigo: 'border-indigo-200 bg-indigo-50/60 text-indigo-800',
    amber: 'border-amber-200 bg-amber-50/60 text-amber-800',
    orange: 'border-orange-200 bg-orange-50/60 text-orange-800',
    emerald: 'border-emerald-200 bg-emerald-50/60 text-emerald-800',
  };
  return (
    <div className={`rounded-xl border p-3 ${tones[tone]}`}>
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-semibold uppercase tracking-wide opacity-70">{label}</p>
        {icon}
      </div>
      <p className="mt-1 text-lg font-bold tabular-nums">{value}</p>
      {sub && <div className="mt-0.5 text-[11px] opacity-80">{sub}</div>}
    </div>
  );
}

export default function ExpensesPage() {
  const [tab, setTab] = useState<Tab>('list');
  const [listView, setListView] = useState<ListView>('active');
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [applied, setApplied] = useState<Filters>(EMPTY_FILTERS);
  const [groupBy, setGroupBy] = useState<GroupBy>('auto');
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);

  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  const [analytics, setAnalytics] = useState<ExpenseAnalytics | null>(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportError, setReportError] = useState(false);
  const [exporting, setExporting] = useState(false);

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null);
  const [historyExpense, setHistoryExpense] = useState<Expense | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [syncingId, setSyncingId] = useState<number | null>(null);

  useEffect(() => {
    adminService.getExpenseCategories()
      .then((res) => {
        const payload = res.data?.data as unknown;
        const list = Array.isArray(payload) ? payload : (payload as { data?: ExpenseCategory[] })?.data;
        setCategories(Array.isArray(list) ? (list as ExpenseCategory[]) : []);
      })
      .catch(() => setCategories([]));
  }, []);

  // Filters apply after a short pause so typing in search or amount doesn't fire a request per keystroke.
  useEffect(() => {
    const timer = setTimeout(() => {
      setApplied(filters);
      setCurrentPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [filters]);

  const fetchExpenses = useCallback(async () => {
    setListLoading(true);
    setListError(false);
    try {
      const params: Record<string, string | number> = { ...buildFilterParams(applied), page: currentPage, per_page: 15 };
      if (listView === 'reversed') params.reversed = 'true';
      const res = await adminService.getExpenses(params);
      setExpenses(res.data.data ?? []);
      setTotalPages(res.data.meta?.last_page || 1);
      setTotalCount(res.data.meta?.total || 0);
    } catch (err) {
      toast.error(getErrorMessage(err));
      setListError(true);
      setExpenses([]);
    } finally {
      setListLoading(false);
    }
  }, [applied, currentPage, listView]);

  const fetchAnalytics = useCallback(async () => {
    setReportLoading(true);
    setReportError(false);
    try {
      const res = await adminService.getExpenseAnalytics({
        ...buildFilterParams(applied),
        group_by: resolveGroupBy(groupBy, applied.start, applied.end),
      });
      setAnalytics(res.data.data);
    } catch (err) {
      toast.error(getErrorMessage(err));
      setReportError(true);
      setAnalytics(null);
    } finally {
      setReportLoading(false);
    }
  }, [applied, groupBy]);

  useEffect(() => { if (tab === 'list') fetchExpenses(); }, [tab, fetchExpenses]);
  useEffect(() => { if (tab === 'report') fetchAnalytics(); }, [tab, fetchAnalytics]);

  const openCreate = () => {
    setSelectedExpense(null);
    setForm(EMPTY_FORM);
    setFormErrors({});
    setIsFormOpen(true);
  };

  const openEdit = (expense: Expense) => {
    setSelectedExpense(expense);
    setForm({
      expense_category_id: String(expense.expense_category_id),
      title: expense.title,
      amount: String(expense.amount),
      expense_date: expense.expense_date.slice(0, 10),
      description: expense.description || '',
      reference: expense.reference || '',
    });
    setFormErrors({});
    setIsFormOpen(true);
  };

  const openDelete = (expense: Expense) => {
    setSelectedExpense(expense);
    setIsDeleteOpen(true);
  };

  const validateForm = () => {
    const errors: Record<string, string> = {};
    if (!form.expense_category_id) errors.expense_category_id = 'Category is required';
    if (!form.title.trim()) errors.title = 'Title is required';
    if (!form.amount || isNaN(Number(form.amount)) || Number(form.amount) <= 0)
      errors.amount = 'Enter a valid amount';
    if (!form.expense_date) errors.expense_date = 'Date is required';
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const refreshCurrentTab = () => {
    if (tab === 'list') fetchExpenses();
    else fetchAnalytics();
  };

  const handleSave = async () => {
    if (!validateForm()) return;
    setIsSaving(true);
    try {
      const payload = {
        expense_category_id: Number(form.expense_category_id),
        title: form.title.trim(),
        amount: Number(form.amount),
        expense_date: form.expense_date,
        description: form.description.trim() || null,
        reference: form.reference.trim() || null,
      };

      if (selectedExpense) {
        await adminService.updateExpense(selectedExpense.id, payload);
        toast.success('Expense updated.');
      } else {
        await adminService.createExpense(payload);
        toast.success('Expense recorded.');
      }
      setIsFormOpen(false);
      refreshCurrentTab();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedExpense) return;
    setIsDeleting(true);
    try {
      const res = await adminService.deleteExpense(selectedExpense.id);
      const result = res.data?.data as { ledger_reversed?: boolean } | undefined;
      toast.success(
        result?.ledger_reversed
          ? 'Expense reversed and journal entry reversed.'
          : 'Expense reversed.'
      );
      setIsDeleteOpen(false);
      refreshCurrentTab();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setIsDeleting(false);
    }
  };

  const handleSyncToLedger = async (expense: Expense) => {
    setSyncingId(expense.id);
    try {
      await adminService.processExpenseSync(expense.id);
      toast.success(`Synced "${expense.title}" to the ledger.`);
      setExpenses((prev) => prev.map((e) => (e.id === expense.id ? { ...e, is_ledger_synced: true } : e)));
      if (analytics) fetchAnalytics();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSyncingId(null);
    }
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const params: Record<string, string | number> = { ...buildFilterParams(applied) };
      if (tab === 'list' && listView === 'reversed') params.reversed = 'true';
      const res = await adminService.exportExpenses(params);
      const stamp = ymd(new Date());
      downloadBlob(new Blob([res.data], { type: 'text/csv' }), `expenses_${stamp}.csv`);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setExporting(false);
    }
  };

  const formCategories = categories.filter((c) => c.is_active || String(c.id) === form.expense_category_id);

  const summary = analytics?.summary;
  const previous = analytics?.previous ?? null;
  const delta = summary && previous && previous.total > 0
    ? ((summary.total - previous.total) / previous.total) * 100
    : null;
  const headerCount = tab === 'list' ? totalCount : (summary?.count ?? 0);

  return (
    <AdminLayout>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <h1 className="text-lg font-bold text-gray-900">Expenses</h1>
          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-semibold text-gray-600">
            {headerCount} record{headerCount !== 1 ? 's' : ''}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/expenses/categories">
            <Button variant="outline" size="sm">Manage categories</Button>
          </Link>
          <Link href="/reports/revenue">
            <Button variant="outline" size="sm">Revenue report</Button>
          </Link>
          <Button size="sm" onClick={openCreate} leftIcon={<Plus className="h-3.5 w-3.5" />}>Add expense</Button>
        </div>
      </div>

      <div className="mb-3">
        <FilterBar
          filters={filters}
          setFilters={setFilters}
          categories={categories}
          onExport={handleExport}
          exporting={exporting}
        />
      </div>

      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-1.5">
          <button
            type="button"
            onClick={() => setTab('list')}
            className={`rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
              tab === 'list' ? 'border-indigo-600 bg-indigo-600 text-white' : 'border-indigo-200 bg-white text-indigo-700 hover:bg-indigo-50'
            }`}
          >
            Expense list
          </button>
          <button
            type="button"
            onClick={() => setTab('report')}
            className={`rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
              tab === 'report' ? 'border-violet-600 bg-violet-600 text-white' : 'border-violet-200 bg-white text-violet-700 hover:bg-violet-50'
            }`}
          >
            Reporting
          </button>
        </div>

        {tab === 'list' && (
          <div className="flex gap-1.5">
            {(['active', 'reversed'] as const).map((view) => (
              <button
                key={view}
                type="button"
                onClick={() => { setListView(view); setCurrentPage(1); }}
                title={view === 'reversed' ? 'Expenses deleted (reversed) from the ledger' : undefined}
                className={`rounded-full border px-2.5 py-1 text-xs font-semibold transition-colors ${
                  listView === view
                    ? (view === 'reversed' ? 'border-amber-500 bg-amber-500 text-white' : 'border-slate-700 bg-slate-700 text-white')
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                {view === 'active' ? 'Active' : 'Reversed'}
              </button>
            ))}
          </div>
        )}

        {tab === 'report' && (
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Group by</span>
            {GROUP_OPTIONS.map((g) => (
              <button key={g.value} type="button" onClick={() => setGroupBy(g.value)} className={chipClass(groupBy === g.value)}>
                {g.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {tab === 'list' && (
        <>
          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
            {listLoading ? (
              <div className="flex justify-center py-10"><LoadingSpinner /></div>
            ) : listError ? (
              <ErrorState message="Failed to load expenses." onRetry={fetchExpenses} />
            ) : expenses.length === 0 ? (
              <EmptyState
                title={listView === 'reversed' ? 'No reversed expenses' : 'No expenses found'}
                description={
                  listView === 'reversed'
                    ? 'Expenses you delete show up here, along with their reversed journal entry.'
                    : hasActiveFilters(applied) ? 'Try clearing a filter.' : 'Add your first expense to start tracking.'
                }
                action={listView === 'active' && !hasActiveFilters(applied) ? <Button onClick={openCreate} leftIcon={<Plus className="h-4 w-4" />}>Add expense</Button> : undefined}
              />
            ) : (
              <div className="max-h-[calc(100vh-19rem)] overflow-auto">
                <table className="min-w-full text-sm">
                  <thead className="sticky top-0 z-10 bg-slate-50 text-xs uppercase tracking-wide text-slate-500 shadow-[0_1px_0_0_rgb(226,232,240)]">
                    <tr>
                      <th className="whitespace-nowrap px-3 py-2 text-left font-semibold">Date</th>
                      <th className="px-3 py-2 text-left font-semibold">Title</th>
                      <th className="px-3 py-2 text-left font-semibold">Category</th>
                      <th className="px-3 py-2 text-left font-semibold">Reference</th>
                      {listView === 'active' && <th className="px-3 py-2 text-left font-semibold">Ledger</th>}
                      <th className="px-3 py-2 text-right font-semibold">Amount</th>
                      <th className="px-3 py-2 text-right font-semibold">{listView === 'reversed' ? 'Reversed' : 'Actions'}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {expenses.map((expense, i) => (
                      <tr key={expense.id} className={`${i % 2 ? 'bg-slate-50/50' : 'bg-white'} hover:bg-indigo-50/40`}>
                        <td className="whitespace-nowrap px-3 py-2 text-xs tabular-nums text-gray-500">{formatDate(expense.expense_date)}</td>
                        <td className="px-3 py-2">
                          <p className="font-semibold text-gray-900">{expense.title}</p>
                          {expense.description && (
                            <p className="max-w-[260px] truncate text-[11px] text-gray-500">{expense.description}</p>
                          )}
                        </td>
                        <td className="px-3 py-2"><Badge variant="default">{expense.category?.name ?? '—'}</Badge></td>
                        <td className="px-3 py-2 font-mono text-[11px] text-gray-500">{expense.reference || '—'}</td>
                        {listView === 'active' && (
                          <td className="px-3 py-2">
                            {expense.is_ledger_synced
                              ? <Badge variant="success">Posted</Badge>
                              : <Badge variant="warning">Not posted</Badge>}
                          </td>
                        )}
                        <td className="whitespace-nowrap px-3 py-2 text-right font-semibold tabular-nums text-rose-600">
                          {formatCurrency(Number(expense.amount))}
                        </td>
                        <td className="px-3 py-2">
                          {listView === 'reversed' ? (
                            <div className="flex items-center justify-end gap-1.5">
                              <Badge variant="warning" className="inline-flex items-center gap-1">
                                <Undo2 className="h-3 w-3" /> Reversed
                              </Badge>
                              {expense.reversed_at && (
                                <span className="whitespace-nowrap text-[11px] text-gray-500">
                                  {formatDate(expense.reversed_at)}
                                  {expense.reverser?.name ? ` by ${expense.reverser.name}` : ''}
                                </span>
                              )}
                              <button type="button" title="View history" onClick={() => setHistoryExpense(expense)} className="rounded-md p-1 text-slate-500 hover:bg-slate-100">
                                <History className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center justify-end gap-0.5">
                              <button type="button" title="View history" onClick={() => setHistoryExpense(expense)} className="rounded-md p-1 text-slate-500 hover:bg-slate-100">
                                <History className="h-3.5 w-3.5" />
                              </button>
                              {!expense.is_ledger_synced && (
                                <button
                                  type="button"
                                  title="Not yet posted to the ledger — post it now"
                                  onClick={() => handleSyncToLedger(expense)}
                                  disabled={syncingId === expense.id}
                                  className="rounded-md p-1 text-amber-600 hover:bg-amber-50 disabled:opacity-50"
                                >
                                  <ArrowUpCircle className="h-3.5 w-3.5" />
                                </button>
                              )}
                              <button
                                type="button"
                                title={expense.is_ledger_synced ? 'Posted to the ledger — delete and add a new expense to change it' : 'Edit'}
                                onClick={() => openEdit(expense)}
                                disabled={expense.is_ledger_synced}
                                className="rounded-md p-1 text-sky-600 hover:bg-sky-50 disabled:cursor-not-allowed disabled:opacity-40"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </button>
                              <button type="button" title="Delete" onClick={() => openDelete(expense)} className="rounded-md p-1 text-rose-500 hover:bg-rose-50">
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {totalCount > 0 && (
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-gray-500">
              <span>
                Showing <span className="font-semibold text-gray-700">{(currentPage - 1) * 15 + 1}–{Math.min(totalCount, currentPage * 15)}</span> of{' '}
                <span className="font-semibold text-gray-700">{totalCount}</span>
              </span>
              {totalPages > 1 && (
                <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
              )}
            </div>
          )}
        </>
      )}

      {tab === 'report' && (
        <div className="space-y-3">
          {reportLoading && !analytics ? (
            <div className="flex justify-center py-16"><LoadingSpinner /></div>
          ) : reportError || !analytics ? (
            <ErrorState message="Failed to load the expense report." onRetry={fetchAnalytics} />
          ) : summary && summary.count === 0 ? (
            <EmptyState title="No expenses for these filters" description="Widen the date range or clear a filter to see spending." />
          ) : summary && (
            <>
              <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
                <KpiTile
                  label="Total spent"
                  value={formatCurrency(summary.total)}
                  tone="rose"
                  icon={<Receipt className="h-4 w-4 opacity-60" />}
                  sub={
                    delta !== null ? (
                      <span className="inline-flex items-center gap-1">
                        {delta >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                        {delta >= 0 ? '+' : ''}{delta.toFixed(1)}% vs previous period
                      </span>
                    ) : previous ? (
                      previous.total === 0 ? 'Nothing spent in the previous period' : null
                    ) : (
                      'Pick a date range to compare'
                    )
                  }
                />
                <KpiTile
                  label="Transactions"
                  value={String(summary.count)}
                  tone="indigo"
                  icon={<Receipt className="h-4 w-4 opacity-60" />}
                  sub={`Average ${formatCurrency(summary.average)} each`}
                />
                <KpiTile
                  label="Largest single expense"
                  value={summary.largest ? formatCurrency(summary.largest.amount) : '—'}
                  tone="amber"
                  icon={<Trophy className="h-4 w-4 opacity-60" />}
                  sub={summary.largest ? `${summary.largest.title} · ${formatDate(summary.largest.expense_date)}` : undefined}
                />
                <KpiTile
                  label="Not posted to ledger"
                  value={formatCurrency(summary.unposted_total)}
                  tone={summary.unposted_count > 0 ? 'orange' : 'emerald'}
                  icon={<AlertTriangle className="h-4 w-4 opacity-60" />}
                  sub={
                    summary.unposted_count > 0
                      ? `${summary.unposted_count} expense${summary.unposted_count === 1 ? '' : 's'} missing from the books — use Sync in the list`
                      : 'Everything in this view is posted'
                  }
                />
              </div>

              <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
                <section className="overflow-hidden rounded-xl border border-gray-200 bg-white lg:col-span-2">
                  <header className="flex items-center justify-between border-b border-gray-100 px-3 py-2">
                    <h2 className="text-sm font-semibold text-gray-900">Spending over time</h2>
                    <span className="text-[11px] text-gray-500">Grouped {analytics.period.group_by === 'day' ? 'daily' : analytics.period.group_by === 'week' ? 'weekly' : 'monthly'}</span>
                  </header>
                  <div className="p-3">
                    <ResponsiveContainer width="100%" height={230}>
                      <BarChart data={analytics.trend} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                        <XAxis dataKey="period" tick={{ fontSize: 11 }} />
                        <YAxis
                          tick={{ fontSize: 11 }}
                          width={56}
                          tickFormatter={(v: number) => (v >= 1000 ? `৳${(v / 1000).toFixed(0)}k` : `৳${v}`)}
                        />
                        <Tooltip
                          formatter={(value: number, _name: string, item) => [
                            `${formatCurrency(value)} · ${item?.payload?.count ?? 0} expense(s)`,
                            'Spent',
                          ]}
                          labelFormatter={(label) => `Period ${label}`}
                        />
                        <Bar dataKey="total" name="Spent" fill="#6366F1" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </section>

                <section className="overflow-hidden rounded-xl border border-gray-200 bg-white">
                  <header className="border-b border-gray-100 px-3 py-2">
                    <h2 className="text-sm font-semibold text-gray-900">By category</h2>
                  </header>
                  <div className="space-y-2.5 p-3">
                    {analytics.by_category.length === 0 && <p className="text-xs text-gray-400">No categorised spending.</p>}
                    {analytics.by_category.map((c, i) => {
                      const share = summary.total > 0 ? (c.total / summary.total) * 100 : 0;
                      return (
                        <div key={c.id}>
                          <div className="flex items-center justify-between gap-2 text-xs">
                            <span className="flex min-w-0 items-center gap-1.5">
                              <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: CHART_COLORS[i % CHART_COLORS.length] }} />
                              <span className="truncate font-semibold text-gray-800">{c.name}</span>
                              <span className="text-gray-400">· {c.count}</span>
                            </span>
                            <span className="whitespace-nowrap font-semibold tabular-nums text-gray-900">
                              {formatCurrency(c.total)} <span className="font-normal text-gray-400">({share.toFixed(1)}%)</span>
                            </span>
                          </div>
                          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-gray-100">
                            <div className="h-full rounded-full" style={{ width: `${share}%`, background: CHART_COLORS[i % CHART_COLORS.length] }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>
              </div>

              <section className="overflow-hidden rounded-xl border border-gray-200 bg-white">
                <header className="flex items-center justify-between border-b border-gray-100 px-3 py-2">
                  <h2 className="text-sm font-semibold text-gray-900">Top spend by title</h2>
                  <span className="text-[11px] text-gray-500">Top {analytics.top_titles.length}</span>
                </header>
                <div className="max-h-[calc(100vh-30rem)] overflow-auto">
                  <table className="min-w-full text-sm">
                    <thead className="sticky top-0 z-10 bg-slate-50 text-xs uppercase tracking-wide text-slate-500 shadow-[0_1px_0_0_rgb(226,232,240)]">
                      <tr>
                        <th className="px-3 py-2 text-left font-semibold">#</th>
                        <th className="px-3 py-2 text-left font-semibold">Title</th>
                        <th className="px-3 py-2 text-right font-semibold">Count</th>
                        <th className="px-3 py-2 text-right font-semibold">Total</th>
                        <th className="px-3 py-2 text-right font-semibold">Share</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {analytics.top_titles.map((t, i) => (
                        <tr key={`${t.title}-${i}`} className={`${i % 2 ? 'bg-slate-50/50' : 'bg-white'} hover:bg-violet-50/40`}>
                          <td className="px-3 py-2 text-xs tabular-nums text-gray-400">{i + 1}</td>
                          <td className="px-3 py-2 font-semibold text-gray-900">{t.title}</td>
                          <td className="px-3 py-2 text-right tabular-nums text-gray-600">{t.count}</td>
                          <td className="px-3 py-2 text-right font-semibold tabular-nums text-rose-600">{formatCurrency(t.total)}</td>
                          <td className="px-3 py-2 text-right tabular-nums text-gray-500">
                            {summary.total > 0 ? `${((t.total / summary.total) * 100).toFixed(1)}%` : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>

              <p className="text-[11px] text-gray-400">
                Reversed expenses are excluded from reporting. Export CSV gives the full row detail behind these figures.
              </p>
            </>
          )}
        </div>
      )}

      <Modal
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        title={selectedExpense ? 'Edit Expense' : 'Add Expense'}
        size="md"
      >
        <div className="space-y-4">
          <Select
            label="Category *"
            value={form.expense_category_id}
            onChange={(e) => setForm({ ...form, expense_category_id: e.target.value })}
            error={formErrors.expense_category_id}
            options={[
              { value: '', label: 'Select category…' },
              ...formCategories.map((c) => ({ value: String(c.id), label: c.name })),
            ]}
          />
          <Input
            label="Title *"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            error={formErrors.title}
            placeholder="e.g. Office Rent"
          />
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Amount (BDT) *"
              type="number"
              min="0.01"
              step="0.01"
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
              error={formErrors.amount}
              placeholder="0.00"
            />
            <Input
              label="Date *"
              type="date"
              value={form.expense_date}
              onChange={(e) => setForm({ ...form, expense_date: e.target.value })}
              error={formErrors.expense_date}
            />
          </div>
          <Input
            label="Reference / Voucher No."
            value={form.reference}
            onChange={(e) => setForm({ ...form, reference: e.target.value })}
            placeholder="Optional"
          />
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Description</label>
            <textarea
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              rows={3}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Optional notes…"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => setIsFormOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} isLoading={isSaving}>
              {selectedExpense ? 'Update' : 'Save'}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={isDeleteOpen}
        onClose={() => setIsDeleteOpen(false)}
        title="Delete Expense"
        size="sm"
      >
        <p className="mb-4 text-sm text-gray-600">
          Delete <strong>{selectedExpense?.title}</strong> ({formatCurrency(Number(selectedExpense?.amount))})?
        </p>
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3">
          <p className="text-xs text-amber-800">
            {selectedExpense?.is_ledger_synced
              ? <>This expense is posted to your accounting ledger (Dr Operating Expenses / Cr Cash —{' '}
                {formatCurrency(Number(selectedExpense?.amount))}). Deleting it will automatically post a
                reversing journal entry so your account balances stay correct.</>
              : 'This expense was never posted to the ledger, so there\'s nothing to reverse there.'}
            {' '}It won&apos;t be permanently erased — you can still find it under the <strong>Reversed</strong> view.
          </p>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setIsDeleteOpen(false)}>Cancel</Button>
          <Button variant="danger" onClick={handleDelete} isLoading={isDeleting}>Delete</Button>
        </div>
      </Modal>

      {historyExpense && (
        <HistoryModal
          isOpen={!!historyExpense}
          onClose={() => setHistoryExpense(null)}
          resourceType="Expense"
          resourceId={historyExpense.id}
          resourceLabel={historyExpense.title}
          createdBy={historyExpense.creator}
          createdAt={historyExpense.created_at}
          updatedAt={historyExpense.updated_at}
        />
      )}
    </AdminLayout>
  );
}
