'use client';

import { useEffect, useMemo, useState, useCallback } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { Plus, Pencil, Trash2, RefreshCw, Search, Tags, Receipt, CheckCircle2 } from 'lucide-react';
import { AdminLayout } from '@/components/layout';
import { Button, Input, Modal, Badge, LoadingSpinner, EmptyState, ErrorState } from '@/components/ui';
import { KpiTile } from '@/components/reports/shared';
import { ExpenseCategory } from '@/types';
import { formatCurrency, getErrorMessage } from '@/lib/utils';
import adminService from '@/lib/adminService';

const EMPTY_FORM = { name: '', description: '', is_active: true };

type StatusFilter = 'all' | 'active' | 'inactive';

const STATUS_CHIPS: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
];

export default function ExpenseCategoriesPage() {
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<StatusFilter>('all');

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [selected, setSelected] = useState<ExpenseCategory | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchCategories = useCallback(async () => {
    setIsLoading(true);
    setError(false);
    try {
      const res = await adminService.getExpenseCategories();
      const payload = res.data?.data as unknown;
      const list = Array.isArray(payload)
        ? payload
        : (payload as { data?: ExpenseCategory[] })?.data;
      setCategories(Array.isArray(list) ? (list as ExpenseCategory[]) : []);
    } catch (err) {
      toast.error(getErrorMessage(err));
      setError(true);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { fetchCategories(); }, [fetchCategories]);

  const spendOf = (cat: ExpenseCategory) => Number(cat.expenses_sum_amount ?? 0);
  const totalSpend = useMemo(() => categories.reduce((n, c) => n + spendOf(c), 0), [categories]);
  const activeCount = categories.filter((c) => c.is_active).length;

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return categories
      .filter((c) => status === 'all' || (status === 'active' ? c.is_active : !c.is_active))
      .filter((c) => !q || c.name.toLowerCase().includes(q) || (c.description ?? '').toLowerCase().includes(q))
      .sort((a, b) => spendOf(b) - spendOf(a) || a.name.localeCompare(b.name));
  }, [categories, search, status]);

  const openCreate = () => {
    setSelected(null);
    setForm(EMPTY_FORM);
    setFormErrors({});
    setIsFormOpen(true);
  };

  const openEdit = (cat: ExpenseCategory) => {
    setSelected(cat);
    setForm({ name: cat.name, description: cat.description || '', is_active: cat.is_active });
    setFormErrors({});
    setIsFormOpen(true);
  };

  const openDelete = (cat: ExpenseCategory) => {
    setSelected(cat);
    setIsDeleteOpen(true);
  };

  const validate = () => {
    const errors: Record<string, string> = {};
    if (!form.name.trim()) errors.name = 'Name is required';
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setIsSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        description: form.description.trim() || null,
        is_active: form.is_active,
      };
      if (selected) {
        await adminService.updateExpenseCategory(selected.id, payload);
        toast.success('Category updated.');
      } else {
        await adminService.createExpenseCategory(payload);
        toast.success('Category created.');
      }
      setIsFormOpen(false);
      fetchCategories();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selected) return;
    setIsDeleting(true);
    try {
      await adminService.deleteExpenseCategory(selected.id);
      toast.success('Category deleted.');
      setIsDeleteOpen(false);
      fetchCategories();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <AdminLayout>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <h1 className="text-lg font-bold text-gray-900">Expense categories</h1>
          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-semibold text-gray-600">
            {categories.length} categor{categories.length === 1 ? 'y' : 'ies'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/expenses" className="text-xs font-semibold text-indigo-700 hover:underline">← Expenses</Link>
          <Button size="sm" onClick={openCreate} leftIcon={<Plus className="h-3.5 w-3.5" />}>Add category</Button>
        </div>
      </div>

      <div className="mb-3 grid grid-cols-2 gap-2 lg:grid-cols-3">
        <KpiTile label="Categories" value={String(categories.length)} tone="indigo" icon={<Tags className="h-4 w-4 opacity-60" />} sub={`${activeCount} active`} />
        <KpiTile label="Total spent" value={formatCurrency(totalSpend)} tone="rose" icon={<Receipt className="h-4 w-4 opacity-60" />} sub="All-time, across every category" />
        <KpiTile label="Active categories" value={String(activeCount)} tone="emerald" icon={<CheckCircle2 className="h-4 w-4 opacity-60" />} sub={`${categories.length - activeCount} inactive`} />
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-gray-200 bg-white p-2.5">
        <div className="relative min-w-[200px] flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name or description…"
            className="h-8 w-full rounded-lg border border-gray-300 pl-8 pr-3 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <div className="flex gap-1.5">
          {STATUS_CHIPS.map((c) => (
            <button
              key={c.value}
              type="button"
              onClick={() => setStatus(c.value)}
              className={`rounded-full border px-2.5 py-1 text-xs font-semibold transition-colors ${
                status === c.value ? 'border-indigo-600 bg-indigo-600 text-white' : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>
        <Button size="sm" variant="ghost" onClick={fetchCategories} leftIcon={<RefreshCw className="h-3.5 w-3.5" />}>Refresh</Button>
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        {isLoading ? (
          <div className="flex justify-center py-10"><LoadingSpinner /></div>
        ) : error ? (
          <ErrorState message="Failed to load categories." onRetry={fetchCategories} />
        ) : categories.length === 0 ? (
          <EmptyState
            title="No categories yet"
            description="Create your first expense category."
            action={<Button onClick={openCreate} leftIcon={<Plus className="h-4 w-4" />}>Add category</Button>}
          />
        ) : visible.length === 0 ? (
          <EmptyState title="No matching categories" description="Clear the search or change the status filter." />
        ) : (
          <div className="max-h-[calc(100vh-22rem)] overflow-auto">
            <table className="min-w-full text-sm">
              <thead className="sticky top-0 z-10 bg-slate-50 text-xs uppercase tracking-wide text-slate-500 shadow-[0_1px_0_0_rgb(226,232,240)]">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold">Category</th>
                  <th className="px-3 py-2 text-left font-semibold">Status</th>
                  <th className="px-3 py-2 text-right font-semibold">Entries</th>
                  <th className="px-3 py-2 text-right font-semibold">Total spent</th>
                  <th className="w-56 px-3 py-2 text-left font-semibold">Share of spend</th>
                  <th className="px-3 py-2 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {visible.map((cat, i) => {
                  const spend = spendOf(cat);
                  const share = totalSpend > 0 ? (spend / totalSpend) * 100 : 0;
                  const hasEntries = (cat.expenses_count ?? 0) > 0;
                  return (
                    <tr key={cat.id} className={`${i % 2 ? 'bg-slate-50/50' : 'bg-white'} hover:bg-indigo-50/40`}>
                      <td className="px-3 py-2">
                        <p className="font-semibold text-gray-900">{cat.name}</p>
                        {cat.description && <p className="max-w-md truncate text-[11px] text-gray-500">{cat.description}</p>}
                      </td>
                      <td className="px-3 py-2">
                        <Badge variant={cat.is_active ? 'success' : 'default'}>{cat.is_active ? 'Active' : 'Inactive'}</Badge>
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-gray-600">{cat.expenses_count ?? 0}</td>
                      <td className="whitespace-nowrap px-3 py-2 text-right font-semibold tabular-nums text-gray-900">{formatCurrency(spend)}</td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-gray-100">
                            <div className="h-full rounded-full bg-rose-400" style={{ width: `${share}%` }} />
                          </div>
                          <span className="w-12 text-right text-[11px] tabular-nums text-gray-500">{share.toFixed(1)}%</span>
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex items-center justify-end gap-0.5">
                          <button type="button" title="Edit" onClick={() => openEdit(cat)} className="rounded-md p-1 text-sky-600 hover:bg-sky-50">
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            title={hasEntries ? 'Cannot delete: has expenses. Deactivate it instead.' : 'Delete'}
                            onClick={() => openDelete(cat)}
                            disabled={hasEntries}
                            className="rounded-md p-1 text-rose-500 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-30"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {categories.length > 0 && (
        <p className="mt-2 text-xs text-gray-500">
          Showing <span className="font-semibold text-gray-700">{visible.length}</span> of{' '}
          <span className="font-semibold text-gray-700">{categories.length}</span>. Categories with entries can&apos;t be deleted; deactivate them instead.
        </p>
      )}

      <Modal
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        title={selected ? 'Edit category' : 'Add category'}
        size="sm"
      >
        <div className="space-y-4">
          <Input
            label="Name *"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            error={formErrors.name}
            placeholder="e.g. Office Supplies"
          />
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Description</label>
            <textarea
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              rows={2}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Optional"
            />
          </div>
          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              className="rounded border-gray-300 text-primary-600"
              checked={form.is_active}
              onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
            />
            <span className="text-sm text-gray-700">Active</span>
          </label>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => setIsFormOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} isLoading={isSaving}>
              {selected ? 'Update' : 'Create'}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={isDeleteOpen} onClose={() => setIsDeleteOpen(false)} title="Delete category" size="sm">
        <p className="mb-4 text-sm text-gray-600">
          Delete category <strong>{selected?.name}</strong>? This cannot be undone.
        </p>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setIsDeleteOpen(false)}>Cancel</Button>
          <Button variant="danger" onClick={handleDelete} isLoading={isDeleting}>Delete</Button>
        </div>
      </Modal>
    </AdminLayout>
  );
}
