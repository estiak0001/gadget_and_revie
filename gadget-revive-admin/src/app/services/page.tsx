'use client';

import React, { useEffect, useState } from 'react';
import { Plus, Edit2, Trash2, Search, Eye, Wrench, Clock, ChevronRight, ListChecks } from 'lucide-react';
import { AdminLayout } from '@/components/layout';
import {
  Card, CardContent, CardHeader, CardTitle, Button, Input, Textarea, Select,
  Modal, Badge, LoadingSpinner, Pagination, EmptyState, ErrorState, ConfirmModal, RichTextEditor,
} from '@/components/ui';
import { Service, ServiceCategory, PaginatedResponse } from '@/types';
import { formatCurrency, getErrorMessage, getImageUrl } from '@/lib/utils';
import adminService from '@/lib/adminService';
import toast from 'react-hot-toast';

export default function ServicesPage() {
  const [services, setServices] = useState<Service[]>([]);
  const [categories, setCategories] = useState<ServiceCategory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState({
    category_id: '', name: '', description: '', base_price: '', discount_price: '',
    duration_estimate: '', is_active: true, is_featured: false,
  });
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState('');
  const [galleryFiles, setGalleryFiles] = useState<File[]>([]);
  const [galleryPreviews, setGalleryPreviews] = useState<string[]>([]);
  const [features, setFeatures] = useState<string[]>([]);
  const [newFeature, setNewFeature] = useState('');

  // Category hierarchy state
  const [catLevel1, setCatLevel1] = useState('');
  const [catLevel2, setCatLevel2] = useState('');
  const [catLevel3, setCatLevel3] = useState('');

  const fetchServices = async () => {
    setIsLoading(true);
    setError(false);
    try {
      const params: Record<string, string | number> = { page: currentPage };
      if (searchQuery) params.search = searchQuery;
      if (filterCategory) params.category_id = filterCategory;
      if (filterStatus) params.status = filterStatus;
      const response = await adminService.getServices(params);
      setServices(response.data.data);
      setTotalPages(response.data.meta?.last_page || 1);
    } catch (err) {
      toast.error(getErrorMessage(err));
      setError(true);
      setServices([]);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const response = await adminService.getServiceCategories({ per_page: 200 });
      const data = response.data?.data || response.data;
      setCategories(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Error fetching categories:', err);
      setCategories([]);
    }
  };

  // Category cascade handlers
  const handleCatLevel1Change = (val: string) => {
    setCatLevel1(val);
    setCatLevel2('');
    setCatLevel3('');
    setFormData(prev => ({ ...prev, category_id: val }));
  };

  const handleCatLevel2Change = (val: string) => {
    setCatLevel2(val);
    setCatLevel3('');
    setFormData(prev => ({ ...prev, category_id: val || catLevel1 }));
  };

  const handleCatLevel3Change = (val: string) => {
    setCatLevel3(val);
    setFormData(prev => ({ ...prev, category_id: val || catLevel2 || catLevel1 }));
  };

  const initCatLevels = (categoryId: number | string) => {
    const cat = categories.find(c => c.id.toString() === categoryId.toString());
    if (!cat) { setCatLevel1(''); setCatLevel2(''); setCatLevel3(''); return; }
    if (!cat.parent_id) {
      setCatLevel1(cat.id.toString()); setCatLevel2(''); setCatLevel3('');
    } else if (!cat.parent?.parent_id) {
      setCatLevel1(cat.parent_id.toString()); setCatLevel2(cat.id.toString()); setCatLevel3('');
    } else {
      setCatLevel1((cat.parent?.parent_id ?? '').toString());
      setCatLevel2(cat.parent_id.toString());
      setCatLevel3(cat.id.toString());
    }
  };

  useEffect(() => { fetchCategories(); }, []);
  useEffect(() => { fetchServices(); }, [currentPage, filterCategory, filterStatus]);

  const handleSearch = () => { setCurrentPage(1); fetchServices(); };

  const openCreateModal = () => {
    setSelectedService(null);
    setFormData({ category_id: '', name: '', description: '', base_price: '', discount_price: '', duration_estimate: '', is_active: true, is_featured: false });
    setCatLevel1(''); setCatLevel2(''); setCatLevel3('');
    setImageFile(null);
    setImagePreview('');
    setGalleryFiles([]);
    setGalleryPreviews([]);
    setFeatures([]);
    setNewFeature('');
    setIsModalOpen(true);
  };

  const openEditModal = (service: Service) => {
    setSelectedService(service);
    setFormData({
      category_id: service.category_id.toString(),
      name: service.name,
      description: service.description || '',
      base_price: service.base_price.toString(),
      discount_price: service.discount_price?.toString() || '',
      duration_estimate: service.duration_estimate || '',
      is_active: service.is_active || true,
      is_featured: service.is_featured || false,
    });
    initCatLevels(service.category_id);
    setImageFile(null);
    setImagePreview(getImageUrl(service.image) || '');
    setGalleryFiles([]);
    setGalleryPreviews((service.gallery || []).map(img => getImageUrl(img) || img));
    setFeatures(service.features || []);
    setNewFeature('');
    setIsModalOpen(true);
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onload = (event) => setImagePreview(event.target?.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleGalleryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files);
      setGalleryFiles([...galleryFiles, ...newFiles]);
      // Create previews for new files
      newFiles.forEach(file => {
        const reader = new FileReader();
        reader.onload = (event) => {
          setGalleryPreviews(prev => [...prev, event.target?.result as string]);
        };
        reader.readAsDataURL(file);
      });
    }
  };

  const addFeature = () => {
    const value = newFeature.trim();
    if (!value) return;
    setFeatures(prev => [...prev, value]);
    setNewFeature('');
  };

  const removeFeature = (index: number) => {
    setFeatures(prev => prev.filter((_, i) => i !== index));
  };

  const removeGalleryPreview = (index: number, isExisting: boolean) => {
    if (isExisting) {
      setGalleryPreviews(prev => prev.filter((_, i) => i !== index));
    } else {
      const newIndex = index - (galleryPreviews.length - galleryFiles.length);
      setGalleryFiles(prev => prev.filter((_, i) => i !== newIndex));
      setGalleryPreviews(prev => prev.filter((_, i) => i !== index));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const fd = new FormData();
      Object.entries(formData).forEach(([key, value]) => {
        if (typeof value === 'boolean') {
          fd.append(key, value ? '1' : '0');
        } else {
          fd.append(key, String(value));
        }
      });
      if (imageFile) fd.append('image', imageFile);
      galleryFiles.forEach(f => fd.append('gallery[]', f));
      // Always mark features as provided so clearing the last item on an
      // edit actually clears it server-side, instead of being ignored
      // because an empty array sends no `features[]` keys at all.
      fd.append('features_provided', '1');
      features.forEach(f => fd.append('features[]', f));
      const payload = fd;

      if (selectedService) {
        await adminService.updateService(selectedService.id, payload);
        toast.success('Service updated');
      } else {
        await adminService.createService(payload);
        toast.success('Service created');
      }
      setIsModalOpen(false);
      fetchServices();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedService) return;
    try {
      await adminService.deleteService(selectedService.id);
      toast.success('Service deleted');
      setIsDeleteModalOpen(false);
      fetchServices();
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  if (error && services.length === 0) {
    return (<AdminLayout><ErrorState title="Failed to load services" onRetry={fetchServices} /></AdminLayout>);
  }

  return (
    <AdminLayout>
      <div className="page-header flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div><h1 className="page-title">Services</h1><p className="page-description">Manage all repair services</p></div>
        <Button onClick={openCreateModal}><Plus className="w-4 h-4 mr-2" />Add Service</Button>
      </div>

      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <Input placeholder="Search services..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSearch()} className="pl-10" />
            </div>
            <Select options={[{ value: '', label: 'All Categories' }, ...categories.map(c => ({ value: c.id, label: c.name }))]} value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)} />
            <Select options={[{ value: '', label: 'All Status' }, { value: 'active', label: 'Active' }, { value: 'inactive', label: 'Inactive' }]} value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} />
            <Button onClick={handleSearch}>Search</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>All Services</CardTitle></CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12"><LoadingSpinner size="lg" text="Loading services..." /></div>
          ) : services.length === 0 ? (
            <EmptyState icon={<Wrench className="w-8 h-8 text-gray-400" />} title="No services found" />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-y">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Service</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Price</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Duration</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {services.map((service) => (
                    <tr key={service.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center overflow-hidden">
                            {service.image ? (
                              <img src={getImageUrl(service.image) || service.image} alt={service.name} className="w-full h-full object-cover" />
                            ) : (
                              <Wrench className="w-5 h-5 text-primary" />
                            )}
                          </div>
                          <div><p className="font-medium">{service.name}</p>{service.is_featured && <Badge variant="warning" className="text-xs mt-1">Featured</Badge>}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4"><Badge variant="default">{service.category?.name}</Badge></td>
                      <td className="px-6 py-4">
                        <p className="font-medium">৳{Number(service.base_price).toLocaleString()}</p>
                        {service.discount_price && <p className="text-xs text-gray-400 line-through">৳{Number(service.discount_price).toLocaleString()}</p>}
                      </td>
                      <td className="px-6 py-4"><div className="flex items-center gap-1 text-gray-600"><Clock className="w-4 h-4" /><span>{service.duration_estimate}</span></div></td>
                      <td className="px-6 py-4"><Badge variant={service.is_active ? 'success' : 'danger'}>{service.is_active ? 'Active' : 'Inactive'}</Badge></td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-end gap-2">
                          <Button variant="ghost" size="sm" onClick={() => { setSelectedService(service); setIsViewModalOpen(true); }}><Eye className="w-4 h-4" /></Button>
                          <Button variant="ghost" size="sm" onClick={() => openEditModal(service)}><Edit2 className="w-4 h-4" /></Button>
                          <Button variant="ghost" size="sm" onClick={() => { setSelectedService(service); setIsDeleteModalOpen(true); }}><Trash2 className="w-4 h-4 text-red-500" /></Button>
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

      {totalPages > 1 && <div className="mt-6"><Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} /></div>}

      {/* Create/Edit Modal */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={selectedService ? 'Edit Service' : 'Add Service'} size="lg">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div><label className="block text-sm font-medium text-gray-700 mb-1">Name</label><Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} required /></div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Category <span className="text-red-500">*</span>
            </label>
            <div className="border border-gray-200 rounded-lg overflow-hidden divide-y divide-gray-100">
              {/* Level 1 — Main Category */}
              <div className="p-3 bg-white">
                <p className="text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wide">Main Category</p>
                <Select
                  options={[
                    { value: '', label: 'Select main category...' },
                    ...categories
                      .filter(c => !c.parent_id)
                      .map(c => ({ value: c.id.toString(), label: c.name })),
                  ]}
                  value={catLevel1}
                  onChange={(e) => handleCatLevel1Change(e.target.value)}
                />
              </div>

              {/* Level 2 — Sub Category */}
              {catLevel1 && categories.filter(c => c.parent_id === parseInt(catLevel1)).length > 0 && (
                <div className="p-3 bg-gray-50">
                  <p className="text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wide">Sub Category</p>
                  <Select
                    options={[
                      { value: '', label: 'None — keep main category' },
                      ...categories
                        .filter(c => c.parent_id === parseInt(catLevel1))
                        .map(c => ({ value: c.id.toString(), label: c.name })),
                    ]}
                    value={catLevel2}
                    onChange={(e) => handleCatLevel2Change(e.target.value)}
                  />
                </div>
              )}

              {/* Level 3 — Sub Sub Category */}
              {catLevel2 && categories.filter(c => c.parent_id === parseInt(catLevel2)).length > 0 && (
                <div className="p-3 bg-gray-100">
                  <p className="text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wide">Sub Sub Category</p>
                  <Select
                    options={[
                      { value: '', label: 'None — keep sub category' },
                      ...categories
                        .filter(c => c.parent_id === parseInt(catLevel2))
                        .map(c => ({ value: c.id.toString(), label: c.name })),
                    ]}
                    value={catLevel3}
                    onChange={(e) => handleCatLevel3Change(e.target.value)}
                  />
                </div>
              )}

              {/* Breadcrumb preview */}
              {catLevel1 && (
                <div className="px-3 py-2 bg-blue-50 flex items-center gap-1.5 flex-wrap">
                  <span className="text-xs font-semibold text-blue-700">
                    {categories.find(c => c.id.toString() === catLevel1)?.name}
                  </span>
                  {catLevel2 && (
                    <>
                      <ChevronRight className="w-3 h-3 text-blue-400 flex-shrink-0" />
                      <span className="text-xs font-semibold text-blue-700">
                        {categories.find(c => c.id.toString() === catLevel2)?.name}
                      </span>
                    </>
                  )}
                  {catLevel3 && (
                    <>
                      <ChevronRight className="w-3 h-3 text-blue-400 flex-shrink-0" />
                      <span className="text-xs font-semibold text-blue-700">
                        {categories.find(c => c.id.toString() === catLevel3)?.name}
                      </span>
                    </>
                  )}
                </div>
              )}
            </div>
            {/* Hidden required field for native form validation */}
            <input
              type="text"
              className="sr-only"
              required
              value={formData.category_id}
              onChange={() => {}}
              tabIndex={-1}
              aria-hidden="true"
            />
          </div>
          <div><label className="block text-sm font-medium text-gray-700 mb-2">Description</label><RichTextEditor value={formData.description} onChange={(value) => setFormData({ ...formData, description: value })} placeholder="Enter service description..." /></div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Base Price (BDT)</label><Input type="number" value={formData.base_price} onChange={(e) => setFormData({ ...formData, base_price: e.target.value })} required min={0} step={0.01} /></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Discount Price</label><Input type="number" value={formData.discount_price} onChange={(e) => setFormData({ ...formData, discount_price: e.target.value })} min={0} step={0.01} /></div>
          </div>
          <div><label className="block text-sm font-medium text-gray-700 mb-1">Estimated Duration</label><Input value={formData.duration_estimate} onChange={(e) => setFormData({ ...formData, duration_estimate: e.target.value })} placeholder="e.g., 1-2 days, 3 days" /></div>

          {/* Image Upload */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Service Image</label>
            <input type="file" accept="image/*" onChange={handleImageChange} className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-primary/10 file:text-primary hover:file:bg-primary/20" />
            {imagePreview && (
              <div className="mt-2 relative group inline-block">
                <img src={imagePreview} alt="Service image preview" className="h-32 rounded-lg object-cover border border-gray-200" />
                <button type="button" onClick={() => { setImageFile(null); setImagePreview(''); }} className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-5 h-5 text-xs flex items-center justify-center">×</button>
              </div>
            )}
          </div>

          {/* Gallery Upload */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Gallery Images</label>
            <input type="file" multiple accept="image/*" onChange={handleGalleryChange} className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-primary/10 file:text-primary hover:file:bg-primary/20" />
            {galleryPreviews.length > 0 && (
              <div className="mt-3 grid grid-cols-3 gap-3">
                {galleryPreviews.map((preview, idx) => {
                  const isExisting = idx < (galleryPreviews.length - galleryFiles.length);
                  const imgSrc = isExisting ? (getImageUrl(preview) || preview) : preview;
                  return (
                    <div key={idx} className="relative group">
                      <img src={imgSrc} alt={`Gallery ${idx}`} className="w-full h-24 object-cover rounded-lg" />
                      <button type="button" onClick={() => removeGalleryPreview(idx, isExisting)} className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg"><span className="text-white text-sm">Remove</span></button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Features */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Features / What&apos;s Included</label>
            <div className="flex gap-2">
              <Input
                className="flex-1"
                value={newFeature}
                onChange={(e) => setNewFeature(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addFeature())}
                placeholder="e.g., Free pickup & drop"
              />
              <Button type="button" variant="outline" onClick={addFeature}>
                <Plus className="w-4 h-4" />
              </Button>
            </div>

            {features.length > 0 ? (
              <div className="mt-2 space-y-2">
                {features.map((feature, index) => (
                  <div key={index} className="group flex items-center gap-2 bg-gray-50 hover:bg-gray-100 p-3 rounded-lg border-2 border-transparent transition-all">
                    <span className="flex-1 text-sm text-gray-700">{feature}</span>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => removeFeature(index)}
                      className="text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-2 text-center py-6 text-gray-400 border-2 border-dashed border-gray-200 rounded-lg">
                <p className="text-sm">No features added yet</p>
                <p className="text-xs mt-1">Add highlights like warranty, pickup, or genuine parts</p>
              </div>
            )}
          </div>

          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2"><input type="checkbox" checked={formData.is_active} onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })} className="rounded border-gray-300" /><span className="text-sm">Active</span></label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={formData.is_featured} onChange={(e) => setFormData({ ...formData, is_featured: e.target.checked })} className="rounded border-gray-300" /><span className="text-sm">Featured</span></label>
          </div>
          <div className="flex justify-end gap-3 pt-4"><Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>Cancel</Button><Button type="submit" isLoading={isSaving}>{selectedService ? 'Update' : 'Create'}</Button></div>
        </form>
      </Modal>

      {/* View Modal */}
      <Modal isOpen={isViewModalOpen} onClose={() => setIsViewModalOpen(false)} title="Service Details" size="lg">
        {selectedService && (
          <div className="space-y-4">
            <div className="flex items-start gap-4">
              <div className="w-16 h-16 bg-primary/10 rounded-lg flex items-center justify-center overflow-hidden flex-shrink-0">
                {selectedService.image ? (
                  <img src={getImageUrl(selectedService.image) || selectedService.image} alt={selectedService.name} className="w-full h-full object-cover" />
                ) : (
                  <Wrench className="w-8 h-8 text-primary" />
                )}
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold">{selectedService.name}</h3>
                <div className="flex items-center gap-4 mt-2">
                  <Badge variant="default">{selectedService.category?.name}</Badge>
                  <Badge variant={selectedService.is_active ? 'success' : 'danger'}>{selectedService.is_active ? 'Active' : 'Inactive'}</Badge>
                  {selectedService.is_featured && <Badge variant="warning">Featured</Badge>}
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div className="bg-gray-50 p-3 rounded-lg"><p className="text-xs text-gray-500">Base Price</p><p className="font-semibold text-lg">৳{Number(selectedService.base_price).toLocaleString()}</p></div>
              {selectedService.discount_price && <div className="bg-gray-50 p-3 rounded-lg"><p className="text-xs text-gray-500">Discount Price</p><p className="font-semibold text-lg">৳{Number(selectedService.discount_price).toLocaleString()}</p></div>}
              <div className="bg-gray-50 p-3 rounded-lg"><p className="text-xs text-gray-500">Duration</p><p className="font-semibold text-lg">{selectedService.duration_estimate}</p></div>
              <div className="bg-gray-50 p-3 rounded-lg"><p className="text-xs text-gray-500">Code</p><p className="font-semibold text-sm">{selectedService.code}</p></div>
              <div className="bg-gray-50 p-3 rounded-lg"><p className="text-xs text-gray-500">Created</p><p className="font-semibold text-sm">{new Date(selectedService.created_at).toLocaleDateString()}</p></div>
            </div>
            {selectedService.description && <div><p className="text-xs text-gray-500 mb-1">Description</p><div className="rich-content text-gray-700 text-sm" dangerouslySetInnerHTML={{ __html: selectedService.description }} /></div>}
            {selectedService.features && selectedService.features.length > 0 && (
              <div>
                <p className="text-xs text-gray-500 mb-1">Features / What&apos;s Included</p>
                <ul className="space-y-1">
                  {selectedService.features.map((feature, idx) => (
                    <li key={idx} className="text-sm text-gray-700 flex items-start gap-2">
                      <ListChecks className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                      {feature}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {selectedService.gallery && selectedService.gallery.length > 0 && (
              <div><p className="text-xs text-gray-500 mb-2">Gallery</p><div className="grid grid-cols-4 gap-3">{selectedService.gallery.map((img, idx) => <img key={idx} src={getImageUrl(img) || img} alt={`Gallery ${idx}`} className="w-full h-20 object-cover rounded-lg" />)}</div></div>
            )}
          </div>
        )}
      </Modal>

      <ConfirmModal isOpen={isDeleteModalOpen} onClose={() => setIsDeleteModalOpen(false)} onConfirm={handleDelete} title="Delete Service" message={`Are you sure you want to delete "${selectedService?.name}"?`} variant="danger" />
    </AdminLayout>
  );
}
