'use client';

import React, { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, Search, Tag, Power, RefreshCw } from 'lucide-react';
import { AdminLayout } from '@/components/layout';
import {
  Button,
  Input,
  Textarea,
  Select,
  Modal,
  LoadingSpinner,
  Pagination,
  ImageUpload,
  EmptyState,
} from '@/components/ui';
import { ProductBrand } from '@/types';
import adminService from '@/lib/adminService';
import { getErrorMessage } from '@/lib/utils';
import toast from 'react-hot-toast';

type StatusFilter = 'all' | 'active' | 'inactive';

const STATUS_CHIPS: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
];

const EMPTY_FORM = {
  name: '',
  name_bn: '',
  slug: '',
  logo: '',
  description: '',
  is_active: true,
  sort_order: 0,
};

function generateSlug(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

export default function ProductBrandsPage() {
  const [brands, setBrands] = useState<ProductBrand[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [perPage, setPerPage] = useState(15);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedBrand, setSelectedBrand] = useState<ProductBrand | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState(EMPTY_FORM);

  // Search waits for a pause in typing, then resets to page one.
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput.trim());
      setCurrentPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const fetchBrands = async () => {
    setIsLoading(true);
    try {
      const params: Record<string, string | number> = { page: currentPage };
      if (search) params.search = search;
      if (status !== 'all') params.is_active = status === 'active' ? 'true' : 'false';
      const response = await adminService.getProductBrands(params);
      setBrands(response.data.data.data);
      setTotalPages(response.data.data.meta?.last_page || 1);
      setTotalCount(response.data.data.meta?.total || 0);
      setPerPage(response.data.data.meta?.per_page || 15);
    } catch (error) {
      toast.error(getErrorMessage(error));
      setBrands([]);
      setTotalPages(1);
      setTotalCount(0);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchBrands();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, search, status]);

  const openCreateModal = () => {
    setSelectedBrand(null);
    setFormData({ ...EMPTY_FORM, sort_order: totalCount + 1 });
    setIsModalOpen(true);
  };

  const openEditModal = (brand: ProductBrand) => {
    setSelectedBrand(brand);
    setFormData({
      name: brand.name,
      name_bn: brand.name_bn || '',
      slug: brand.slug,
      logo: brand.logo || '',
      description: brand.description || '',
      is_active: brand.is_active,
      sort_order: brand.sort_order || 0,
    });
    setIsModalOpen(true);
  };

  const openDeleteModal = (brand: ProductBrand) => {
    setSelectedBrand(brand);
    setIsDeleteModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      if (selectedBrand) {
        await adminService.updateProductBrand(selectedBrand.id, formData);
        toast.success('Brand updated.');
      } else {
        await adminService.createProductBrand(formData);
        toast.success('Brand created.');
      }
      setIsModalOpen(false);
      fetchBrands();
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedBrand) return;
    try {
      await adminService.deleteProductBrand(selectedBrand.id);
      toast.success('Brand deleted.');
      setIsDeleteModalOpen(false);
      fetchBrands();
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  const handleToggleStatus = async (brand: ProductBrand) => {
    try {
      await adminService.toggleProductBrandStatus(brand.id);
      toast.success(`Brand ${brand.is_active ? 'deactivated' : 'activated'}.`);
      fetchBrands();
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  const from = totalCount === 0 ? 0 : (currentPage - 1) * perPage + 1;
  const to = Math.min(totalCount, currentPage * perPage);

  return (
    <AdminLayout>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <h1 className="text-lg font-bold text-gray-900">Product brands</h1>
          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-semibold text-gray-600">
            {totalCount} brand{totalCount === 1 ? '' : 's'}
          </span>
        </div>
        <Button size="sm" onClick={openCreateModal} leftIcon={<Plus className="h-3.5 w-3.5" />}>Add brand</Button>
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-gray-200 bg-white p-2.5">
        <div className="relative min-w-[200px] flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
          <input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search name, Bengali name or description…"
            className="h-8 w-full rounded-lg border border-gray-300 pl-8 pr-3 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <div className="flex gap-1.5">
          {STATUS_CHIPS.map((c) => (
            <button
              key={c.value}
              type="button"
              onClick={() => { setStatus(c.value); setCurrentPage(1); }}
              className={`rounded-full border px-2.5 py-1 text-xs font-semibold transition-colors ${
                status === c.value ? 'border-indigo-600 bg-indigo-600 text-white' : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>
        <Button size="sm" variant="ghost" onClick={fetchBrands} leftIcon={<RefreshCw className="h-3.5 w-3.5" />}>Refresh</Button>
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        {isLoading ? (
          <div className="flex justify-center py-10"><LoadingSpinner /></div>
        ) : brands.length === 0 ? (
          <EmptyState
            title={search || status !== 'all' ? 'No matching brands' : 'No brands yet'}
            description={search || status !== 'all' ? 'Clear the search or change the status filter.' : 'Add your first brand to tag products.'}
            action={!search && status === 'all' ? <Button onClick={openCreateModal} leftIcon={<Plus className="h-4 w-4" />}>Add brand</Button> : undefined}
          />
        ) : (
          <div className="max-h-[calc(100vh-17rem)] overflow-auto">
            <table className="min-w-full text-sm">
              <thead className="sticky top-0 z-10 bg-slate-50 text-xs uppercase tracking-wide text-slate-500 shadow-[0_1px_0_0_rgb(226,232,240)]">
                <tr>
                  <th className="w-12 px-3 py-2 text-right font-semibold">#</th>
                  <th className="px-3 py-2 text-left font-semibold">Brand</th>
                  <th className="px-3 py-2 text-left font-semibold">Slug</th>
                  <th className="px-3 py-2 text-right font-semibold">Products</th>
                  <th className="px-3 py-2 text-left font-semibold">Status</th>
                  <th className="px-3 py-2 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {brands.map((brand, i) => {
                  const productCount = brand.products_count || 0;
                  return (
                    <tr key={brand.id} className={`${i % 2 ? 'bg-slate-50/50' : 'bg-white'} hover:bg-indigo-50/40`}>
                      <td className="px-3 py-2 text-right text-xs tabular-nums text-gray-400">{brand.sort_order}</td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2.5">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-md border border-gray-200 bg-gray-50">
                            {brand.logo ? (
                              <img src={brand.logo} alt={brand.name} className="h-full w-full object-contain p-0.5" />
                            ) : (
                              <Tag className="h-4 w-4 text-gray-400" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold text-gray-900">{brand.name}</p>
                            {brand.name_bn && <p className="text-[11px] text-gray-500">{brand.name_bn}</p>}
                            {brand.description && <p className="max-w-md truncate text-[11px] text-gray-500">{brand.description}</p>}
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-2 font-mono text-xs text-gray-600">{brand.slug}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-gray-700">{productCount}</td>
                      <td className="px-3 py-2">
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                          brand.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-600'
                        }`}>
                          {brand.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex items-center justify-end gap-0.5">
                          <button
                            type="button"
                            title={brand.is_active ? 'Deactivate' : 'Activate'}
                            onClick={() => handleToggleStatus(brand)}
                            className="rounded-md p-1 hover:bg-gray-100"
                          >
                            <Power className={`h-3.5 w-3.5 ${brand.is_active ? 'text-emerald-600' : 'text-gray-400'}`} />
                          </button>
                          <button type="button" title="Edit" onClick={() => openEditModal(brand)} className="rounded-md p-1 text-sky-600 hover:bg-sky-50">
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            title={productCount > 0 ? 'Cannot delete a brand that has products' : 'Delete'}
                            onClick={() => openDeleteModal(brand)}
                            disabled={productCount > 0}
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

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={selectedBrand ? 'Edit brand' : 'Add brand'}
        size="lg"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Name <span className="text-red-500">*</span>
              </label>
              <Input
                value={formData.name}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    name: e.target.value,
                    slug: selectedBrand ? formData.slug : generateSlug(e.target.value),
                  })
                }
                placeholder="Enter brand name"
                required
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Name (Bengali)</label>
              <Input
                value={formData.name_bn}
                onChange={(e) => setFormData({ ...formData, name_bn: e.target.value })}
                placeholder="ব্র্যান্ডের নাম"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Slug <span className="text-red-500">*</span>
            </label>
            <Input
              value={formData.slug}
              onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
              placeholder="brand-slug"
              required
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">Logo (max 2 MB)</label>
            <ImageUpload
              value={formData.logo}
              onChange={(url) => setFormData({ ...formData, logo: url })}
              onRemove={() => setFormData({ ...formData, logo: '' })}
              maxSize={2}
              placeholder="Click to upload brand logo or drag and drop"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Description</label>
            <Textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Enter brand description"
              rows={3}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Sort order</label>
              <Input
                type="number"
                value={formData.sort_order}
                onChange={(e) => setFormData({ ...formData, sort_order: parseInt(e.target.value) || 0 })}
                min={0}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Status</label>
              <Select
                options={[
                  { value: 'true', label: 'Active' },
                  { value: 'false', label: 'Inactive' },
                ]}
                value={formData.is_active.toString()}
                onChange={(e) => setFormData({ ...formData, is_active: e.target.value === 'true' })}
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>Cancel</Button>
            <Button type="submit" isLoading={isSaving}>{selectedBrand ? 'Update' : 'Create'}</Button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={isDeleteModalOpen} onClose={() => setIsDeleteModalOpen(false)} title="Delete brand">
        <p className="mb-4 text-gray-600">
          Delete &quot;{selectedBrand?.name}&quot;? This cannot be undone.
          {(selectedBrand?.products_count || 0) > 0 && (
            <span className="mt-2 block font-medium text-red-600">
              This brand has {selectedBrand?.products_count} products and cannot be deleted.
            </span>
          )}
        </p>
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={() => setIsDeleteModalOpen(false)}>Cancel</Button>
          <Button variant="danger" onClick={handleDelete} disabled={(selectedBrand?.products_count || 0) > 0}>Delete</Button>
        </div>
      </Modal>
    </AdminLayout>
  );
}
