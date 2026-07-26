'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { Plus, Pencil, Trash2, RefreshCw } from 'lucide-react';
import { AdminLayout } from '@/components/layout';
import {
  Card, CardContent, CardHeader, CardTitle,
  Button, Input, Modal, Badge,
  LoadingSpinner, EmptyState, ErrorState,
} from '@/components/ui';
import { ExpenseCategory } from '@/types';
import { getErrorMessage } from '@/lib/utils';
import adminService from '@/lib/adminService';
import toast from 'react-hot-toast';
import Link from 'next/link';

const EMPTY_FORM = { name: '', description: '', is_active: true };

export default function ExpenseCategoriesPage() {
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);

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
      <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Expense Categories</h1>
            <p className="text-sm text-gray-500 mt-1">{categories.length} categories</p>
          </div>
          <div className="flex gap-2">
            <Link href="/expenses">
              <Button variant="outline" size="sm">← All Expenses</Button>
            </Link>
            <Button onClick={openCreate} leftIcon={<Plus className="w-4 h-4" />}>
              Add Category
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Categories</CardTitle>
            <Button variant="ghost" size="sm" onClick={fetchCategories} leftIcon={<RefreshCw className="w-4 h-4" />}>
              Refresh
            </Button>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center py-12"><LoadingSpinner /></div>
            ) : error ? (
              <ErrorState message="Failed to load categories." onRetry={fetchCategories} />
            ) : categories.length === 0 ? (
              <EmptyState
                title="No categories yet"
                description="Create your first expense category."
                action={<Button onClick={openCreate} leftIcon={<Plus className="w-4 h-4" />}>Add Category</Button>}
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 text-left">
                      <th className="pb-3 pr-4 font-semibold text-gray-600">Name</th>
                      <th className="pb-3 pr-4 font-semibold text-gray-600">Description</th>
                      <th className="pb-3 pr-4 font-semibold text-gray-600">Expenses</th>
                      <th className="pb-3 pr-4 font-semibold text-gray-600">Status</th>
                      <th className="pb-3 font-semibold text-gray-600 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {categories.map((cat) => (
                      <tr key={cat.id} className="hover:bg-gray-50">
                        <td className="py-3 pr-4 font-medium text-gray-900">{cat.name}</td>
                        <td className="py-3 pr-4 text-gray-500 max-w-xs truncate">
                          {cat.description || '—'}
                        </td>
                        <td className="py-3 pr-4 text-gray-600">{cat.expenses_count ?? 0}</td>
                        <td className="py-3 pr-4">
                          <Badge variant={cat.is_active ? 'success' : 'default'}>
                            {cat.is_active ? 'Active' : 'Inactive'}
                          </Badge>
                        </td>
                        <td className="py-3 text-right">
                          <div className="flex justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openEdit(cat)}
                              leftIcon={<Pencil className="w-3.5 h-3.5" />}
                            >
                              Edit
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openDelete(cat)}
                              className="text-red-500 hover:text-red-700 hover:bg-red-50"
                              leftIcon={<Trash2 className="w-3.5 h-3.5" />}
                              disabled={(cat.expenses_count ?? 0) > 0}
                              title={(cat.expenses_count ?? 0) > 0 ? 'Cannot delete: has expenses' : undefined}
                            >
                              Delete
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Form Modal */}
      <Modal
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        title={selected ? 'Edit Category' : 'Add Category'}
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
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              rows={2}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Optional"
            />
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
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

      {/* Delete Confirm */}
      <Modal
        isOpen={isDeleteOpen}
        onClose={() => setIsDeleteOpen(false)}
        title="Delete Category"
        size="sm"
      >
        <p className="text-sm text-gray-600 mb-4">
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
