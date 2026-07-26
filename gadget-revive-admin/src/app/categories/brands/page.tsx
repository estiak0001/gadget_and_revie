'use client';

import React, { useEffect, useState } from 'react';
import { Plus, Edit2, Trash2, Search, Tag, GripVertical, Power } from 'lucide-react';
import { AdminLayout } from '@/components/layout';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Button,
  Input,
  Textarea,
  Select,
  Modal,
  Badge,
  LoadingSpinner,
  Pagination,
  ImageUpload,
} from '@/components/ui';
import { ProductBrand, PaginatedResponse } from '@/types';
import adminService from '@/lib/adminService';
import { getErrorMessage } from '@/lib/utils';
import toast from 'react-hot-toast';

export default function ProductBrandsPage() {
  const [brands, setBrands] = useState<ProductBrand[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedBrand, setSelectedBrand] = useState<ProductBrand | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    name_bn: '',
    slug: '',
    logo: '',
    description: '',
    is_active: true,
    sort_order: 0,
  });

  const fetchBrands = async () => {
    setIsLoading(true);
    try {
      const response = await adminService.getProductBrands({
        page: currentPage,
        ...(searchQuery ? { search: searchQuery } : {}),
      });
      setBrands(response.data.data.data);
      setTotalPages(response.data.data.meta?.last_page || 1);
    } catch (error) {
      toast.error(getErrorMessage(error));
      setBrands([]);
      setTotalPages(1);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchBrands();
  }, [currentPage]);

  const handleSearch = () => {
    setCurrentPage(1);
    fetchBrands();
  };

  const generateSlug = (name: string) => {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  };

  const openCreateModal = () => {
    setSelectedBrand(null);
    setFormData({
      name: '',
      name_bn: '',
      slug: '',
      logo: '',
      description: '',
      is_active: true,
      sort_order: brands.length + 1,
    });
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
        toast.success('Brand updated successfully');
      } else {
        await adminService.createProductBrand(formData);
        toast.success('Brand created successfully');
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
      toast.success('Brand deleted successfully');
      setIsDeleteModalOpen(false);
      fetchBrands();
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  const handleToggleStatus = async (brand: ProductBrand) => {
    try {
      await adminService.toggleProductBrandStatus(brand.id);
      toast.success(`Brand ${brand.is_active ? 'deactivated' : 'activated'} successfully`);
      fetchBrands();
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  const filteredBrands = brands.filter((b) =>
    b.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    b.slug.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (b.name_bn && b.name_bn.includes(searchQuery))
  );

  return (
    <AdminLayout>
      <div className="page-header flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="page-title">Product Brands</h1>
          <p className="page-description">Manage product brands and their logos</p>
        </div>
        <Button onClick={openCreateModal}>
          <Plus className="w-4 h-4 mr-2" />
          Add Brand
        </Button>
      </div>

      {/* Search */}
      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="flex gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <Input
                placeholder="Search brands..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                className="pl-10"
              />
            </div>
            <Button onClick={handleSearch}>Search</Button>
          </div>
        </CardContent>
      </Card>

      {/* Brands Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Brands ({filteredBrands.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <LoadingSpinner size="lg" text="Loading brands..." />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-y">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Order</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Brand</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Slug</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Products</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredBrands.map((brand) => (
                    <tr key={brand.id} className="hover:bg-gray-50 transition-all">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2 text-gray-400">
                          <GripVertical className="w-4 h-4" />
                          <span>{brand.sort_order}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center overflow-hidden">
                            {brand.logo ? (
                              <img
                                src={brand.logo}
                                alt={brand.name}
                                className="w-full h-full object-contain p-1"
                              />
                            ) : (
                              <Tag className="w-6 h-6 text-gray-400" />
                            )}
                          </div>
                          <div>
                            <p className="font-medium">{brand.name}</p>
                            {brand.name_bn && (
                              <p className="text-xs text-gray-500">{brand.name_bn}</p>
                            )}
                            {brand.description && (
                              <p className="text-xs text-gray-500 truncate max-w-xs mt-0.5">{brand.description}</p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-gray-600 font-mono text-sm">{brand.slug}</td>
                      <td className="px-6 py-4">
                        <Badge variant="default">{brand.products_count || 0}</Badge>
                      </td>
                      <td className="px-6 py-4">
                        <Badge variant={brand.is_active ? 'success' : 'danger'}>
                          {brand.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleToggleStatus(brand)}
                            title={brand.is_active ? 'Deactivate' : 'Activate'}
                          >
                            <Power className={`w-4 h-4 ${brand.is_active ? 'text-green-500' : 'text-gray-400'}`} />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => openEditModal(brand)}>
                            <Edit2 className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openDeleteModal(brand)}
                            disabled={(brand.products_count || 0) > 0}
                            title={(brand.products_count || 0) > 0 ? 'Cannot delete brand with products' : 'Delete brand'}
                          >
                            <Trash2 className={`w-4 h-4 ${(brand.products_count || 0) > 0 ? 'text-gray-300' : 'text-red-500'}`} />
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

      {totalPages > 1 && (
        <div className="mt-6">
          <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
        </div>
      )}

      {/* Create/Edit Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={selectedBrand ? 'Edit Brand' : 'Add Brand'}
        size="lg"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
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
              <label className="block text-sm font-medium text-gray-700 mb-1">Name (Bengali)</label>
              <Input
                value={formData.name_bn}
                onChange={(e) => setFormData({ ...formData, name_bn: e.target.value })}
                placeholder="ব্র্যান্ডের নাম"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
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
            <label className="block text-sm font-medium text-gray-700 mb-2">Logo (Max 2MB)</label>
            <ImageUpload
              value={formData.logo}
              onChange={(url) => setFormData({ ...formData, logo: url })}
              onRemove={() => setFormData({ ...formData, logo: '' })}
              maxSize={2}
              placeholder="Click to upload brand logo or drag and drop"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <Textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Enter brand description"
              rows={3}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Sort Order</label>
              <Input
                type="number"
                value={formData.sort_order}
                onChange={(e) => setFormData({ ...formData, sort_order: parseInt(e.target.value) || 0 })}
                min={0}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
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
            <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" isLoading={isSaving}>
              {selectedBrand ? 'Update' : 'Create'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete Modal */}
      <Modal isOpen={isDeleteModalOpen} onClose={() => setIsDeleteModalOpen(false)} title="Delete Brand">
        <p className="text-gray-600 mb-4">
          Are you sure you want to delete &quot;{selectedBrand?.name}&quot;?
          {(selectedBrand?.products_count || 0) > 0 && (
            <span className="block mt-2 text-red-600 font-medium">
              This brand has {selectedBrand?.products_count} products and cannot be deleted.
            </span>
          )}
        </p>
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={() => setIsDeleteModalOpen(false)}>
            Cancel
          </Button>
          <Button
            variant="danger"
            onClick={handleDelete}
            disabled={(selectedBrand?.products_count || 0) > 0}
          >
            Delete
          </Button>
        </div>
      </Modal>
    </AdminLayout>
  );
}
