'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { Plus, Pencil, Trash2, RefreshCw, Filter, Search } from 'lucide-react';
import { AdminLayout } from '@/components/layout';
import {
  Button, Input, Select, Modal, ConfirmModal, Badge,
  LoadingSpinner, Pagination, EmptyState, ErrorState,
} from '@/components/ui';
import { Supplier, PaginatedResponse } from '@/types';
import { getErrorMessage } from '@/lib/utils';
import adminService from '@/lib/adminService';
import toast from 'react-hot-toast';

const PER_PAGE = 20;

const EMPTY_FORM = {
  name: '',
  contact_person: '',
  phone: '',
  email: '',
  address: '',
  is_active: true,
};

export default function SuppliersPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [filterActive, setFilterActive] = useState('');

  // Modals
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchSuppliers = useCallback(async () => {
    setIsLoading(true);
    setError(false);
    try {
      const params: Record<string, string | number> = { page: currentPage, per_page: PER_PAGE };
      if (searchQuery) params.search = searchQuery;
      if (filterActive) params.is_active = filterActive;

      const res = await adminService.getSuppliers(params);
      const payload = res.data?.data as unknown;
      const paged: Partial<PaginatedResponse<Supplier>> = (Array.isArray(payload)
        ? { data: payload }
        : (payload as PaginatedResponse<Supplier>)) ?? { data: [] };
      setSuppliers(Array.isArray(paged.data) ? paged.data : []);
      setTotalPages(paged.meta?.last_page || 1);
      setTotalCount(paged.meta?.total || 0);
    } catch (err) {
      toast.error(getErrorMessage(err));
      setError(true);
      setSuppliers([]);
    } finally {
      setIsLoading(false);
    }
  }, [currentPage, searchQuery, filterActive]);

  useEffect(() => { fetchSuppliers(); }, [fetchSuppliers]);

  const openCreate = () => {
    setSelectedSupplier(null);
    setForm(EMPTY_FORM);
    setFormErrors({});
    setIsFormOpen(true);
  };

  const openEdit = (supplier: Supplier) => {
    setSelectedSupplier(supplier);
    setForm({
      name: supplier.name,
      contact_person: supplier.contact_person || '',
      phone: supplier.phone || '',
      email: supplier.email || '',
      address: supplier.address || '',
      is_active: supplier.is_active,
    });
    setFormErrors({});
    setIsFormOpen(true);
  };

  const openDelete = (supplier: Supplier) => {
    setSelectedSupplier(supplier);
    setIsDeleteOpen(true);
  };

  const validateForm = () => {
    const errors: Record<string, string> = {};
    if (!form.name.trim()) errors.name = 'Name is required';
    if (form.email && !/^\S+@\S+\.\S+$/.test(form.email)) errors.email = 'Enter a valid email';
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSave = async () => {
    if (!validateForm()) return;
    setIsSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        contact_person: form.contact_person.trim() || null,
        phone: form.phone.trim() || null,
        email: form.email.trim() || null,
        address: form.address.trim() || null,
        is_active: form.is_active,
      };

      if (selectedSupplier) {
        await adminService.updateSupplier(selectedSupplier.id, payload);
        toast.success('Supplier updated.');
      } else {
        await adminService.createSupplier(payload);
        toast.success('Supplier created.');
      }
      setIsFormOpen(false);
      fetchSuppliers();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedSupplier) return;
    setIsDeleting(true);
    try {
      await adminService.deleteSupplier(selectedSupplier.id);
      toast.success('Supplier deleted.');
      setIsDeleteOpen(false);
      fetchSuppliers();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setIsDeleting(false);
    }
  };

  const handleFilter = () => {
    setCurrentPage(1);
    fetchSuppliers();
  };

  const clearFilters = () => {
    setSearchQuery('');
    setFilterActive('');
    setCurrentPage(1);
  };

  const from = totalCount === 0 ? 0 : (currentPage - 1) * PER_PAGE + 1;
  const to = Math.min(totalCount, currentPage * PER_PAGE);

  return (
    <AdminLayout>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <h1 className="text-lg font-bold text-gray-900">Suppliers</h1>
          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-semibold text-gray-600">
            {totalCount} supplier{totalCount !== 1 ? 's' : ''}
          </span>
        </div>
        <Button size="sm" onClick={openCreate} leftIcon={<Plus className="w-3.5 h-3.5" />}>
          Add supplier
        </Button>
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-gray-200 bg-white p-2.5">
        <div className="relative min-w-[200px] flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
          <Input
            placeholder="Search by name…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleFilter()}
            className="h-8 pl-8 text-xs"
          />
        </div>
        <div className="w-40 shrink-0">
          <Select
            className="h-8 text-xs"
            value={filterActive}
            onChange={(e) => setFilterActive(e.target.value)}
            options={[
              { value: '', label: 'All statuses' },
              { value: 'true', label: 'Active' },
              { value: 'false', label: 'Inactive' },
            ]}
          />
        </div>
        <Button size="sm" onClick={handleFilter} leftIcon={<Filter className="w-3.5 h-3.5" />}>Filter</Button>
        <Button size="sm" variant="ghost" onClick={clearFilters}>Clear</Button>
        <Button size="sm" variant="ghost" onClick={fetchSuppliers} leftIcon={<RefreshCw className="w-3.5 h-3.5" />}>Refresh</Button>
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        {isLoading ? (
          <div className="flex justify-center py-10"><LoadingSpinner /></div>
        ) : error ? (
          <ErrorState message="Failed to load suppliers." onRetry={fetchSuppliers} />
        ) : suppliers.length === 0 ? (
          <EmptyState
            title="No suppliers found"
            description="Add your first supplier to start creating purchase orders."
            action={<Button onClick={openCreate} leftIcon={<Plus className="w-4 h-4" />}>Add Supplier</Button>}
          />
        ) : (
          <div className="max-h-[calc(100vh-17rem)] overflow-auto">
            <table className="min-w-full text-sm">
              <thead className="sticky top-0 z-10 bg-slate-50 text-xs uppercase tracking-wide text-slate-500 shadow-[0_1px_0_0_rgb(226,232,240)]">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold">Name</th>
                  <th className="px-3 py-2 text-left font-semibold">Contact person</th>
                  <th className="px-3 py-2 text-left font-semibold">Phone</th>
                  <th className="px-3 py-2 text-left font-semibold">Email</th>
                  <th className="px-3 py-2 text-left font-semibold">Status</th>
                  <th className="px-3 py-2 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {suppliers.map((supplier, i) => (
                  <tr key={supplier.id} className={`${i % 2 ? 'bg-slate-50/50' : 'bg-white'} hover:bg-indigo-50/40`}>
                    <td className="px-3 py-2">
                      <p className="font-semibold text-gray-900">{supplier.name}</p>
                      {supplier.address && (
                        <p className="max-w-[260px] truncate text-[11px] text-gray-500">{supplier.address}</p>
                      )}
                    </td>
                    <td className="px-3 py-2 text-gray-700">{supplier.contact_person || '—'}</td>
                    <td className="whitespace-nowrap px-3 py-2 tabular-nums text-gray-700">{supplier.phone || '—'}</td>
                    <td className="px-3 py-2 text-gray-700">{supplier.email || '—'}</td>
                    <td className="px-3 py-2">
                      <Badge variant={supplier.is_active ? 'success' : 'default'}>
                        {supplier.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center justify-end gap-0.5">
                        <button type="button" title="Edit" onClick={() => openEdit(supplier)} className="rounded-md p-1 text-sky-600 hover:bg-sky-50">
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button type="button" title="Delete" onClick={() => openDelete(supplier)} className="rounded-md p-1 text-rose-500 hover:bg-rose-50">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
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
            Showing <span className="font-semibold text-gray-700">{from}–{to}</span> of{' '}
            <span className="font-semibold text-gray-700">{totalCount}</span>
          </span>
          {totalPages > 1 && (
            <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
          )}
        </div>
      )}

      {/* Add / Edit Modal */}
      <Modal
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        title={selectedSupplier ? 'Edit Supplier' : 'Add Supplier'}
        size="md"
      >
        <div className="space-y-4">
          <Input
            label="Name *"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            error={formErrors.name}
            placeholder="e.g. ABC Electronics Ltd."
          />
          <Input
            label="Contact Person"
            value={form.contact_person}
            onChange={(e) => setForm({ ...form, contact_person: e.target.value })}
            placeholder="Optional"
          />
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Phone"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              placeholder="Optional"
            />
            <Input
              label="Email"
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              error={formErrors.email}
              placeholder="Optional"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
            <textarea
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              rows={2}
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              placeholder="Optional"
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={form.is_active}
              onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
              className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
            />
            Active
          </label>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => setIsFormOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} isLoading={isSaving}>
              {selectedSupplier ? 'Update' : 'Save'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirm Modal */}
      <ConfirmModal
        isOpen={isDeleteOpen}
        onClose={() => setIsDeleteOpen(false)}
        onConfirm={handleDelete}
        title="Delete Supplier"
        message={`Delete "${selectedSupplier?.name}"? This cannot be undone.`}
        confirmLabel="Delete"
        variant="danger"
        isLoading={isDeleting}
      />
    </AdminLayout>
  );
}
