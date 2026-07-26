'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { Plus, Pencil, Trash2, RefreshCw, Filter } from 'lucide-react';
import { AdminLayout } from '@/components/layout';
import {
  Card, CardContent, CardHeader, CardTitle,
  Button, Input, Select, Modal, ConfirmModal, Badge,
  LoadingSpinner, Pagination, EmptyState, ErrorState,
} from '@/components/ui';
import { Supplier, PaginatedResponse } from '@/types';
import { getErrorMessage } from '@/lib/utils';
import adminService from '@/lib/adminService';
import toast from 'react-hot-toast';

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
      const params: Record<string, string | number> = { page: currentPage, per_page: 20 };
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

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Suppliers</h1>
            <p className="text-sm text-gray-500 mt-1">{totalCount} supplier{totalCount !== 1 ? 's' : ''}</p>
          </div>
          <Button onClick={openCreate} leftIcon={<Plus className="w-4 h-4" />}>
            Add Supplier
          </Button>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="pt-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Input
                label="Search"
                placeholder="Search by name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleFilter()}
              />
              <Select
                label="Status"
                value={filterActive}
                onChange={(e) => setFilterActive(e.target.value)}
                options={[
                  { value: '', label: 'All' },
                  { value: 'true', label: 'Active' },
                  { value: 'false', label: 'Inactive' },
                ]}
              />
              <div className="flex items-end gap-2 lg:col-span-2">
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
            <CardTitle>Supplier Records</CardTitle>
            <Button variant="ghost" size="sm" onClick={fetchSuppliers} leftIcon={<RefreshCw className="w-4 h-4" />}>
              Refresh
            </Button>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center py-12"><LoadingSpinner /></div>
            ) : error ? (
              <ErrorState message="Failed to load suppliers." onRetry={fetchSuppliers} />
            ) : suppliers.length === 0 ? (
              <EmptyState
                title="No suppliers found"
                description="Add your first supplier to start creating purchase orders."
                action={<Button onClick={openCreate} leftIcon={<Plus className="w-4 h-4" />}>Add Supplier</Button>}
              />
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200 text-left">
                        <th className="pb-3 pr-4 font-semibold text-gray-600">Name</th>
                        <th className="pb-3 pr-4 font-semibold text-gray-600">Contact Person</th>
                        <th className="pb-3 pr-4 font-semibold text-gray-600">Phone</th>
                        <th className="pb-3 pr-4 font-semibold text-gray-600">Email</th>
                        <th className="pb-3 pr-4 font-semibold text-gray-600">Status</th>
                        <th className="pb-3 font-semibold text-gray-600 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {suppliers.map((supplier) => (
                        <tr key={supplier.id} className="hover:bg-gray-50">
                          <td className="py-3 pr-4">
                            <p className="font-medium text-gray-900">{supplier.name}</p>
                            {supplier.address && (
                              <p className="text-xs text-gray-500 truncate max-w-[220px]">{supplier.address}</p>
                            )}
                          </td>
                          <td className="py-3 pr-4 text-gray-600">{supplier.contact_person || '—'}</td>
                          <td className="py-3 pr-4 text-gray-600">{supplier.phone || '—'}</td>
                          <td className="py-3 pr-4 text-gray-600">{supplier.email || '—'}</td>
                          <td className="py-3 pr-4">
                            <Badge variant={supplier.is_active ? 'success' : 'default'}>
                              {supplier.is_active ? 'Active' : 'Inactive'}
                            </Badge>
                          </td>
                          <td className="py-3 text-right">
                            <div className="flex justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => openEdit(supplier)}
                                leftIcon={<Pencil className="w-3.5 h-3.5" />}
                              >
                                Edit
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => openDelete(supplier)}
                                className="text-red-500 hover:text-red-700 hover:bg-red-50"
                                leftIcon={<Trash2 className="w-3.5 h-3.5" />}
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
