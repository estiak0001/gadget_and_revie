'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { Plus, Pencil, Trash2, Search, RefreshCw, Filter, ArrowUpCircle, Undo2 } from 'lucide-react';
import { AdminLayout } from '@/components/layout';
import {
  Card, CardContent, CardHeader, CardTitle,
  Button, Input, Select, Modal, Badge,
  LoadingSpinner, Pagination, EmptyState, ErrorState,
} from '@/components/ui';
import { Expense, ExpenseCategory, PaginatedResponse } from '@/types';
import { formatCurrency, formatDate, getErrorMessage } from '@/lib/utils';
import adminService from '@/lib/adminService';
import toast from 'react-hot-toast';
import Link from 'next/link';

const EMPTY_FORM = {
  expense_category_id: '',
  title: '',
  amount: '',
  expense_date: new Date().toISOString().split('T')[0],
  description: '',
  reference: '',
};

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Filters
  const [filterCategory, setFilterCategory] = useState('');
  const [filterStart, setFilterStart] = useState('');
  const [filterEnd, setFilterEnd] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'reversed'>('all');

  // Modals
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [syncingId, setSyncingId] = useState<number | null>(null);

  const fetchCategories = useCallback(async () => {
    try {
      const res = await adminService.getExpenseCategories({ active_only: true });
      const payload = res.data?.data as unknown;
      const list = Array.isArray(payload)
        ? payload
        : (payload as { data?: ExpenseCategory[] })?.data;
      setCategories(Array.isArray(list) ? (list as ExpenseCategory[]) : []);
    } catch {
      // silent — categories may still load on next refresh
    }
  }, []);

  const fetchExpenses = useCallback(async () => {
    setIsLoading(true);
    setError(false);
    try {
      const params: Record<string, string | number> = { page: currentPage, per_page: 20 };
      if (filterCategory) params.expense_category_id = filterCategory;
      if (filterStart) params.start_date = filterStart;
      if (filterEnd) params.end_date = filterEnd;
      if (activeTab === 'reversed') params.reversed = 'true';

      const res = await adminService.getExpenses(params);
      const payload = res.data?.data as unknown;
      const paged: Partial<PaginatedResponse<Expense>> = (Array.isArray(payload)
        ? { data: payload }
        : (payload as PaginatedResponse<Expense>)) ?? { data: [] };
      setExpenses(Array.isArray(paged.data) ? paged.data : []);
      setTotalPages(paged.meta?.last_page || 1);
      setTotalCount(paged.meta?.total || 0);
    } catch (err) {
      toast.error(getErrorMessage(err));
      setError(true);
      setExpenses([]);
    } finally {
      setIsLoading(false);
    }
  }, [currentPage, filterCategory, filterStart, filterEnd, activeTab]);

  useEffect(() => { fetchCategories(); }, [fetchCategories]);
  useEffect(() => { fetchExpenses(); }, [fetchExpenses]);

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
      fetchExpenses();
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
      fetchExpenses();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setIsDeleting(false);
    }
  };

  const handleFilter = () => {
    setCurrentPage(1);
    fetchExpenses();
  };

  const handleSyncToLedger = async (expense: Expense) => {
    setSyncingId(expense.id);
    try {
      await adminService.processExpenseSync(expense.id);
      toast.success(`Synced "${expense.title}" to the ledger.`);
      setExpenses((prev) => prev.map((e) => (e.id === expense.id ? { ...e, is_ledger_synced: true } : e)));
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSyncingId(null);
    }
  };

  const clearFilters = () => {
    setFilterCategory('');
    setFilterStart('');
    setFilterEnd('');
    setSearchQuery('');
    setCurrentPage(1);
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Expenses</h1>
            <p className="text-sm text-gray-500 mt-1">{totalCount} record{totalCount !== 1 ? 's' : ''}</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Link href="/expenses/categories">
              <Button variant="outline" size="sm">Manage Categories</Button>
            </Link>
            <Link href="/reports/revenue">
              <Button variant="outline" size="sm">Revenue Report</Button>
            </Link>
            <Button onClick={openCreate} leftIcon={<Plus className="w-4 h-4" />}>
              Add Expense
            </Button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200">
          {(['all', 'reversed'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => { setActiveTab(tab); setCurrentPage(1); }}
              className={`px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                activeTab === tab
                  ? 'border-primary-600 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
              title={tab === 'reversed' ? 'Expenses deleted (reversed) from the ledger' : undefined}
            >
              {tab === 'all' ? 'All' : 'Reversed'}
            </button>
          ))}
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="pt-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Select
                label="Category"
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                options={[
                  { value: '', label: 'All Categories' },
                  ...categories.map((c) => ({ value: String(c.id), label: c.name })),
                ]}
              />
              <Input
                label="From Date"
                type="date"
                value={filterStart}
                onChange={(e) => setFilterStart(e.target.value)}
              />
              <Input
                label="To Date"
                type="date"
                value={filterEnd}
                onChange={(e) => setFilterEnd(e.target.value)}
              />
              <div className="flex items-end gap-2">
                <Button onClick={handleFilter} leftIcon={<Filter className="w-4 h-4" />} className="flex-1">
                  Filter
                </Button>
                <Button variant="ghost" onClick={clearFilters} size="sm">
                  Clear
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Table */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Expense Records</CardTitle>
            <Button variant="ghost" size="sm" onClick={fetchExpenses} leftIcon={<RefreshCw className="w-4 h-4" />}>
              Refresh
            </Button>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center py-12"><LoadingSpinner /></div>
            ) : error ? (
              <ErrorState message="Failed to load expenses." onRetry={fetchExpenses} />
            ) : expenses.length === 0 ? (
              <EmptyState
                title={activeTab === 'reversed' ? 'No reversed expenses' : 'No expenses found'}
                description={
                  activeTab === 'reversed'
                    ? "Expenses you delete show up here, along with their reversed journal entry."
                    : 'Add your first expense to start tracking.'
                }
                action={activeTab === 'all' ? <Button onClick={openCreate} leftIcon={<Plus className="w-4 h-4" />}>Add Expense</Button> : undefined}
              />
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200 text-left">
                        <th className="pb-3 pr-4 font-semibold text-gray-600">Title</th>
                        <th className="pb-3 pr-4 font-semibold text-gray-600">Category</th>
                        <th className="pb-3 pr-4 font-semibold text-gray-600 text-right">Amount</th>
                        <th className="pb-3 pr-4 font-semibold text-gray-600">Date</th>
                        <th className="pb-3 pr-4 font-semibold text-gray-600">Reference</th>
                        {activeTab === 'reversed' ? (
                          <th className="pb-3 font-semibold text-gray-600">Reversed</th>
                        ) : (
                          <th className="pb-3 font-semibold text-gray-600 text-right">Actions</th>
                        )}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {expenses.map((expense) => (
                        <tr key={expense.id} className="hover:bg-gray-50">
                          <td className="py-3 pr-4">
                            <p className="font-medium text-gray-900">{expense.title}</p>
                            {expense.description && (
                              <p className="text-xs text-gray-500 truncate max-w-[180px]">{expense.description}</p>
                            )}
                          </td>
                          <td className="py-3 pr-4">
                            <Badge variant="default">{expense.category?.name ?? '—'}</Badge>
                          </td>
                          <td className="py-3 pr-4 text-right font-semibold text-red-600">
                            {formatCurrency(Number(expense.amount))}
                          </td>
                          <td className="py-3 pr-4 text-gray-600">{formatDate(expense.expense_date)}</td>
                          <td className="py-3 pr-4 text-gray-500 text-xs">{expense.reference || '—'}</td>
                          {activeTab === 'reversed' ? (
                            <td className="py-3">
                              <div className="flex items-center gap-1.5">
                                <Badge variant="warning" className="inline-flex items-center gap-1">
                                  <Undo2 className="w-3 h-3" /> Reversed
                                </Badge>
                                {expense.reversed_at && (
                                  <span className="text-xs text-gray-500">
                                    {formatDate(expense.reversed_at)}
                                    {expense.reverser?.name ? ` by ${expense.reverser.name}` : ''}
                                  </span>
                                )}
                              </div>
                            </td>
                          ) : (
                            <td className="py-3 text-right">
                              <div className="flex justify-end gap-1">
                                {!expense.is_ledger_synced && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleSyncToLedger(expense)}
                                    isLoading={syncingId === expense.id}
                                    className="text-amber-600 hover:text-amber-700 hover:bg-amber-50"
                                    leftIcon={<ArrowUpCircle className="w-3.5 h-3.5" />}
                                    title="Not yet posted to the ledger"
                                  >
                                    Sync
                                  </Button>
                                )}
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => openEdit(expense)}
                                  disabled={expense.is_ledger_synced}
                                  leftIcon={<Pencil className="w-3.5 h-3.5" />}
                                  title={
                                    expense.is_ledger_synced
                                      ? 'Posted to the ledger — delete and add a new expense to change it'
                                      : undefined
                                  }
                                >
                                  Edit
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => openDelete(expense)}
                                  className="text-red-500 hover:text-red-700 hover:bg-red-50"
                                  leftIcon={<Trash2 className="w-3.5 h-3.5" />}
                                >
                                  Delete
                                </Button>
                              </div>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {totalPages > 1 && (
                  <div className="mt-4">
                    <Pagination
                      currentPage={currentPage}
                      totalPages={totalPages}
                      onPageChange={setCurrentPage}
                    />
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Add / Edit Modal */}
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
              ...categories.map((c) => ({ value: String(c.id), label: c.name })),
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
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
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

      {/* Delete Confirm Modal */}
      <Modal
        isOpen={isDeleteOpen}
        onClose={() => setIsDeleteOpen(false)}
        title="Delete Expense"
        size="sm"
      >
        <p className="text-sm text-gray-600 mb-4">
          Delete <strong>{selectedExpense?.title}</strong> ({formatCurrency(Number(selectedExpense?.amount))})?
        </p>
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3">
          <p className="text-xs text-amber-800">
            {selectedExpense?.is_ledger_synced
              ? <>This expense is posted to your accounting ledger (Dr Operating Expenses / Cr Cash —{' '}
                {formatCurrency(Number(selectedExpense?.amount))}). Deleting it will automatically post a
                reversing journal entry so your account balances stay correct.</>
              : 'This expense was never posted to the ledger, so there\'s nothing to reverse there.'}
            {' '}It won&apos;t be permanently erased — you can still find it under the <strong>Reversed</strong> filter.
          </p>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setIsDeleteOpen(false)}>Cancel</Button>
          <Button variant="danger" onClick={handleDelete} isLoading={isDeleting}>Delete</Button>
        </div>
      </Modal>
    </AdminLayout>
  );
}
