'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Save, Plus, Trash2, RefreshCw, Tag, GripVertical, Edit2, Check, X, ChevronRight } from 'lucide-react';
import { AdminLayout } from '@/components/layout';
import { Card, CardContent, CardHeader, CardTitle, Button, Input, Textarea, Select, SearchableSelect, Badge, LoadingSpinner, RichTextEditor, Modal, ImageUpload } from '@/components/ui';
import { ProductCategory, ProductBrand, CategoryAttribute } from '@/types';
import { getErrorMessage } from '@/lib/utils';
import adminService from '@/lib/adminService';
import toast from 'react-hot-toast';

export default function CreateProductPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [brands, setBrands] = useState<ProductBrand[]>([]);

  // Form state
  const [formData, setFormData] = useState({
    vendor_profile_id: '',
    category_id: '',
    name: '',
    name_bn: '',
    sku: '',
    description: '',
    short_description: '',
    price: '',
    discount_price: '',
    stock_qty: '',
    low_stock_threshold: '5',
    unit: 'piece',
    brand_id: '',
    model: '',
    warranty: '',
    is_active: true,
    is_featured: false,
    sort_order: '0',
  });

  // Image state
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState('');
  const [galleryFiles, setGalleryFiles] = useState<File[]>([]);
  const [galleryPreviews, setGalleryPreviews] = useState<string[]>([]);

  // Specifications state
  type SpecItem = { id: string; key: string; value: string };
  const [specifications, setSpecifications] = useState<SpecItem[]>([]);
  const [newSpecKey, setNewSpecKey] = useState('');
  const [newSpecValue, setNewSpecValue] = useState('');
  // Spec names/values reused from other products already in the selected category
  const [specSuggestions, setSpecSuggestions] = useState<{ key: string; values: string[] }[]>([]);
  const [editingSpecId, setEditingSpecId] = useState<string | null>(null);
  const [editingSpecKey, setEditingSpecKey] = useState('');
  const [editingSpecValue, setEditingSpecValue] = useState('');
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  // Quick-create brand state
  const [isQuickBrandModalOpen, setIsQuickBrandModalOpen] = useState(false);
  const [isCreatingBrand, setIsCreatingBrand] = useState(false);
  const [quickBrandData, setQuickBrandData] = useState({
    name: '',
    slug: '',
    logo: '',
  });

  // Category hierarchy state
  const [catLevel1, setCatLevel1] = useState('');
  const [catLevel2, setCatLevel2] = useState('');
  const [catLevel3, setCatLevel3] = useState('');

  // Dynamic category attributes (filterable specs inherited from selected category + ancestors)
  const [categoryAttributes, setCategoryAttributes] = useState<CategoryAttribute[]>([]);
  const [isLoadingAttributes, setIsLoadingAttributes] = useState(false);
  // Map of attribute_id → selected value(s). Single-select stores number, multiselect
  // stores number[], free-entry text/number attributes store a string.
  const [selectedAttributeValues, setSelectedAttributeValues] = useState<
    Record<number, number | number[] | string | null>
  >({});

  useEffect(() => {
    fetchCategories();
    fetchBrands();
  }, []);

  useEffect(() => {
    const catId = formData.category_id;
    if (!catId) {
      setCategoryAttributes([]);
      setSelectedAttributeValues({});
      return;
    }

    let cancelled = false;
    setIsLoadingAttributes(true);
    adminService
      .getFormAttributesForCategory(Number(catId))
      .then((res) => {
        if (cancelled) return;
        const attrs = (res.data?.data as CategoryAttribute[] | undefined) || [];
        setCategoryAttributes(attrs);
        // Reset selections to empty for new attribute set
        setSelectedAttributeValues((prev) => {
          const next: Record<number, number | number[] | string | null> = {};
          for (const a of attrs) {
            if (a.id in prev) {
              next[a.id] = prev[a.id];
            } else if (a.input_type === 'multiselect') {
              next[a.id] = [];
            } else if (a.input_type === 'text' || a.input_type === 'number') {
              next[a.id] = '';
            } else {
              next[a.id] = null;
            }
          }
          return next;
        });
      })
      .catch((err) => {
        if (!cancelled) toast.error(getErrorMessage(err));
      })
      .finally(() => {
        if (!cancelled) setIsLoadingAttributes(false);
      });

    return () => {
      cancelled = true;
    };
  }, [formData.category_id]);

  // Suggest spec names/values already used on other products in this category
  useEffect(() => {
    const catId = formData.category_id;
    if (!catId) {
      setSpecSuggestions([]);
      return;
    }
    let cancelled = false;
    adminService
      .getProductSpecSuggestions(Number(catId))
      .then((res) => {
        if (!cancelled) setSpecSuggestions(res.data?.data || []);
      })
      .catch(() => {
        if (!cancelled) setSpecSuggestions([]);
      });
    return () => {
      cancelled = true;
    };
  }, [formData.category_id]);

  const applySpecSuggestion = (key: string, value?: string) => {
    setNewSpecKey(key);
    setNewSpecValue(value ?? '');
  };

  const buildAttributeValuesPayload = () => {
    const rows: Array<{ attribute_id: number; value_ids?: number[]; text_value?: string }> = [];
    for (const attr of categoryAttributes) {
      const selected = selectedAttributeValues[attr.id];
      if (selected === null || selected === undefined) continue;
      if (typeof selected === 'string') {
        const trimmed = selected.trim();
        if (trimmed) rows.push({ attribute_id: attr.id, text_value: trimmed });
        continue;
      }
      const ids = Array.isArray(selected) ? selected : [selected];
      const valid = ids.filter((n): n is number => typeof n === 'number' && n > 0);
      if (valid.length > 0) {
        rows.push({ attribute_id: attr.id, value_ids: valid });
      }
    }
    return rows;
  };

  const fetchCategories = async () => {
    try {
      const response = await adminService.getProductCategories({ per_page: 200 });
      const data = response.data?.data || response.data;
      setCategories(Array.isArray(data) ? data : []);
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const fetchBrands = async () => {
    try {
      const response = await adminService.getProductBrands({ per_page: 1000 });
      const data = response.data?.data?.data || [];
      setBrands(data.filter((b: ProductBrand) => b.is_active));
    } catch (err) {
      toast.error(getErrorMessage(err));
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

  const generateSlug = (name: string) => {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  };

  const handleQuickCreateBrand = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreatingBrand(true);
    try {
      const response = await adminService.createProductBrand({
        ...quickBrandData,
        is_active: true,
        sort_order: brands.length + 1,
      });
      const newBrand = response.data?.data;
      toast.success('Brand created successfully');
      await fetchBrands();
      setFormData({ ...formData, brand_id: newBrand.id.toString() });
      setIsQuickBrandModalOpen(false);
      setQuickBrandData({ name: '', slug: '', logo: '' });
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setIsCreatingBrand(false);
    }
  };

  const generateSKU = () => {
    return `PROD-${Date.now()}-${Math.random().toString(36).substr(2, 5).toUpperCase()}`;
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const maxSize = 4 * 1024 * 1024; // 4MB
    if (file.size > maxSize) {
      toast.error('Image must be less than 4MB');
      return;
    }

    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }

    setImageFile(file);
    const reader = new FileReader();
    reader.onloadend = () => setImagePreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleGallerySelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const maxSize = 4 * 1024 * 1024; // 4MB

    const validFiles = files.filter(file => {
      if (file.size > maxSize) {
        toast.error(`${file.name} is larger than 4MB`);
        return false;
      }
      if (!file.type.startsWith('image/')) {
        toast.error(`${file.name} is not an image`);
        return false;
      }
      return true;
    });

    setGalleryFiles(prev => [...prev, ...validFiles]);

    validFiles.forEach(file => {
      const reader = new FileReader();
      reader.onloadend = () => {
        setGalleryPreviews(prev => [...prev, reader.result as string]);
      };
      reader.readAsDataURL(file);
    });
  };

  const removeGalleryImage = (index: number) => {
    setGalleryFiles(prev => prev.filter((_, i) => i !== index));
    setGalleryPreviews(prev => prev.filter((_, i) => i !== index));
  };

  const addSpecification = () => {
    if (!newSpecKey.trim() || !newSpecValue.trim()) {
      toast.error('Please enter both key and value for specification');
      return;
    }
    const newSpec: SpecItem = {
      id: `spec-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      key: newSpecKey.trim(),
      value: newSpecValue.trim(),
    };
    setSpecifications(prev => [...prev, newSpec]);
    setNewSpecKey('');
    setNewSpecValue('');
  };

  const removeSpecification = (id: string) => {
    setSpecifications(prev => prev.filter(spec => spec.id !== id));
  };

  const startEditingSpec = (spec: SpecItem) => {
    setEditingSpecId(spec.id);
    setEditingSpecKey(spec.key);
    setEditingSpecValue(spec.value);
  };

  const saveEditingSpec = () => {
    if (!editingSpecKey.trim() || !editingSpecValue.trim()) {
      toast.error('Both key and value are required');
      return;
    }
    setSpecifications(prev =>
      prev.map(spec =>
        spec.id === editingSpecId
          ? { ...spec, key: editingSpecKey.trim(), value: editingSpecValue.trim() }
          : spec
      )
    );
    cancelEditingSpec();
  };

  const cancelEditingSpec = () => {
    setEditingSpecId(null);
    setEditingSpecKey('');
    setEditingSpecValue('');
  };

  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;

    const newSpecs = [...specifications];
    const draggedItem = newSpecs[draggedIndex];
    newSpecs.splice(draggedIndex, 1);
    newSpecs.splice(index, 0, draggedItem);

    setSpecifications(newSpecs);
    setDraggedIndex(index);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const hasFiles = imageFile || galleryFiles.length > 0;

      if (hasFiles) {
        const formDataToSend = new FormData();
        
        // Append all text fields
        Object.entries(formData).forEach(([key, value]) => {
          if (value !== '' && value !== null && value !== undefined) {
            formDataToSend.append(key, value.toString());
          }
        });

        // Append specifications as JSON
        if (specifications.length > 0) {
          const specsObj = specifications.reduce((acc, spec) => {
            acc[spec.key] = spec.value;
            return acc;
          }, {} as Record<string, string>);
          formDataToSend.append('specifications', JSON.stringify(specsObj));
        }

        // Append structured attribute values (filter-category attributes)
        const attrPayload = buildAttributeValuesPayload();
        if (attrPayload.length > 0) {
          formDataToSend.append('attribute_values', JSON.stringify(attrPayload));
        }

        // Append main image
        if (imageFile) {
          formDataToSend.append('image', imageFile);
        }

        // Append gallery images
        galleryFiles.forEach(file => {
          formDataToSend.append('gallery[]', file);
        });

        await adminService.createProduct(formDataToSend);
      } else {
        // JSON payload without files
        const payload: any = { ...formData };
        if (specifications.length > 0) {
          payload.specifications = specifications.reduce((acc, spec) => {
            acc[spec.key] = spec.value;
            return acc;
          }, {} as Record<string, string>);
        }
        const attrPayload = buildAttributeValuesPayload();
        if (attrPayload.length > 0) {
          payload.attribute_values = attrPayload;
        }
        await adminService.createProduct(payload);
      }

      toast.success('Product created successfully');
      router.push('/products');
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AdminLayout>
      <form onSubmit={handleSubmit}>
        {/* Header */}
        <div className="page-header flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => router.back()}
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
            <div>
              <h1 className="page-title">Create New Product</h1>
              <p className="page-description">Add a new product to your inventory</p>
            </div>
          </div>
          <div className="flex gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push('/products')}
            >
              Cancel
            </Button>
            <Button type="submit" isLoading={isLoading}>
              <Save className="w-4 h-4 mr-2" />
              Create Product
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content - Left Side (2/3) */}
          <div className="lg:col-span-2 space-y-6">
            {/* Basic Information */}
            <Card>
              <CardHeader>
                <CardTitle>Basic Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Product Name <span className="text-red-500">*</span>
                    </label>
                    <Input
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="Enter product name"
                      required
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Name (Bengali)</label>
                    <Input
                      value={formData.name_bn}
                      onChange={(e) => setFormData({ ...formData, name_bn: e.target.value })}
                      placeholder="পণ্যের নাম (বাংলায়)"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      SKU
                    </label>
                    <div className="flex gap-2">
                      <Input
                        value={formData.sku}
                        onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                        placeholder="Product SKU"
                        className="flex-1"
                      />
                      <Button 
                        type="button" 
                        variant="outline" 
                        size="sm" 
                        onClick={() => setFormData({ ...formData, sku: generateSKU() })}
                        title="Generate SKU"
                      >
                        <RefreshCw className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
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
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Short Description</label>
                    <Input
                      value={formData.short_description}
                      onChange={(e) => setFormData({ ...formData, short_description: e.target.value })}
                      placeholder="Brief product description (max 500 characters)"
                      maxLength={500}
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Full Description (Rich Text Editor)</label>
                    <RichTextEditor
                      value={formData.description}
                      onChange={(value) => setFormData({ ...formData, description: value })}
                      placeholder="Detailed product description with rich formatting"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Images */}
            <Card>
              <CardHeader>
                <CardTitle>Product Images</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Main Image */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Main Image</label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageSelect}
                    className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100"
                  />
                  {imagePreview && (
                    <div className="mt-3 relative inline-block">
                      <img src={imagePreview} alt="Preview" className="w-32 h-32 object-cover rounded-lg border" />
                      <button
                        type="button"
                        onClick={() => { setImageFile(null); setImagePreview(''); }}
                        className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center hover:bg-red-600"
                      >
                        ×
                      </button>
                    </div>
                  )}
                </div>

                {/* Gallery Images */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Gallery Images (Multiple)</label>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleGallerySelect}
                    className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100"
                  />
                  {galleryPreviews.length > 0 && (
                    <div className="mt-3 grid grid-cols-4 gap-3">
                      {galleryPreviews.map((preview, idx) => (
                        <div key={idx} className="relative">
                          <img src={preview} alt={`Gallery ${idx + 1}`} className="w-full h-24 object-cover rounded-lg border" />
                          <button
                            type="button"
                            onClick={() => removeGalleryImage(idx)}
                            className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs hover:bg-red-600"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Specifications */}
            <Card>
              <CardHeader>
                <CardTitle>Technical Specifications</CardTitle>
                <p className="text-sm text-gray-500 mt-1">Drag items to reorder, click to edit</p>
              </CardHeader>
              <CardContent className="space-y-4">
                {specSuggestions.length > 0 && (() => {
                  const usedKeys = new Set(specifications.map((s) => s.key.toLowerCase()));
                  const available = specSuggestions.filter((s) => !usedKeys.has(s.key.toLowerCase()));
                  if (available.length === 0) return null;
                  return (
                    <div>
                      <p className="text-xs font-medium text-gray-500 mb-1.5">
                        Reuse from other products in this category
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {available.map((s) => (
                          <button
                            key={s.key}
                            type="button"
                            onClick={() => applySpecSuggestion(s.key, s.values[0])}
                            title={s.values.length > 0 ? `e.g. ${s.values.join(', ')}` : undefined}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full border border-gray-300 bg-gray-50 text-xs text-gray-700 hover:border-primary-400 hover:bg-primary-50 hover:text-primary-700 transition-colors"
                          >
                            <Plus className="w-3 h-3" />
                            {s.key}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })()}
                <div className="flex gap-2">
                  <Input
                    className="flex-1"
                    value={newSpecKey}
                    onChange={(e) => setNewSpecKey(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addSpecification())}
                    placeholder="Spec name (e.g., Memory)"
                  />
                  <Input
                    className="flex-1"
                    value={newSpecValue}
                    onChange={(e) => setNewSpecValue(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addSpecification())}
                    placeholder="Spec value (e.g., 16GB)"
                  />
                  <Button type="button" variant="outline" onClick={addSpecification}>
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>

                {specifications.length > 0 && (
                  <div className="space-y-2">
                    {specifications.map((spec, index) => (
                      <div
                        key={spec.id}
                        draggable={editingSpecId !== spec.id}
                        onDragStart={() => handleDragStart(index)}
                        onDragOver={(e) => handleDragOver(e, index)}
                        onDragEnd={handleDragEnd}
                        className={`group flex items-center gap-2 bg-gray-50 hover:bg-gray-100 p-3 rounded-lg border-2 transition-all ${
                          draggedIndex === index
                            ? 'border-primary-500 shadow-lg opacity-50'
                            : 'border-transparent'
                        } ${editingSpecId === spec.id ? 'ring-2 ring-primary-500' : ''}`}
                      >
                        {/* Drag Handle */}
                        <div className="cursor-move text-gray-400 hover:text-gray-600">
                          <GripVertical className="w-5 h-5" />
                        </div>

                        {/* Content */}
                        {editingSpecId === spec.id ? (
                          <>
                            <Input
                              className="flex-1"
                              value={editingSpecKey}
                              onChange={(e) => setEditingSpecKey(e.target.value)}
                              onKeyPress={(e) => e.key === 'Enter' && saveEditingSpec()}
                              placeholder="Spec name"
                              autoFocus
                            />
                            <Input
                              className="flex-1"
                              value={editingSpecValue}
                              onChange={(e) => setEditingSpecValue(e.target.value)}
                              onKeyPress={(e) => e.key === 'Enter' && saveEditingSpec()}
                              placeholder="Spec value"
                            />
                            <div className="flex gap-1">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={saveEditingSpec}
                                className="text-green-600 hover:text-green-700"
                              >
                                <Check className="w-4 h-4" />
                              </Button>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={cancelEditingSpec}
                                className="text-gray-600 hover:text-gray-700"
                              >
                                <X className="w-4 h-4" />
                              </Button>
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="flex-1 cursor-pointer" onClick={() => startEditingSpec(spec)}>
                              <span className="text-sm font-medium text-gray-700">{spec.key}:</span>
                              <span className="text-sm text-gray-600 ml-2">{spec.value}</span>
                            </div>
                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => startEditingSpec(spec)}
                                className="text-primary-600 hover:text-primary-700"
                              >
                                <Edit2 className="w-4 h-4" />
                              </Button>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => removeSpecification(spec.id)}
                                className="text-red-600 hover:text-red-700"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {specifications.length === 0 && (
                  <div className="text-center py-8 text-gray-400 border-2 border-dashed border-gray-200 rounded-lg">
                    <p className="text-sm">No specifications added yet</p>
                    <p className="text-xs mt-1">Add technical details about the product</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Category Filter Attributes (dynamic, per selected category + inherited) */}
            <Card>
              <CardHeader>
                <CardTitle>Category Filter Attributes</CardTitle>
                <p className="text-sm text-gray-500 mt-1">
                  Attributes defined on the selected category (and inherited from its parents).
                  These drive the filter sidebar on the storefront.
                </p>
              </CardHeader>
              <CardContent>
                {!formData.category_id ? (
                  <div className="text-center py-8 text-gray-400 border-2 border-dashed border-gray-200 rounded-lg">
                    <p className="text-sm">Select a category to load its filter attributes</p>
                  </div>
                ) : isLoadingAttributes ? (
                  <div className="flex justify-center py-6">
                    <LoadingSpinner />
                  </div>
                ) : categoryAttributes.length === 0 ? (
                  <div className="text-center py-8 text-gray-400 border-2 border-dashed border-gray-200 rounded-lg">
                    <p className="text-sm">No filter attributes defined for this category yet</p>
                    <p className="text-xs mt-1">
                      Go to Categories → click the sliders icon to define attributes
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {categoryAttributes.map((attr) => {
                      const current = selectedAttributeValues[attr.id];
                      return (
                        <div key={attr.id}>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            {attr.name}
                            {attr.unit && (
                              <span className="text-gray-400 font-normal ml-1">
                                ({attr.unit})
                              </span>
                            )}
                            {attr.is_required && <span className="text-red-500 ml-1">*</span>}
                          </label>
                          {attr.input_type === 'multiselect' ? (
                            <div className="flex flex-wrap gap-2">
                              {(attr.values || []).map((v) => {
                                const arr = Array.isArray(current) ? current : [];
                                const isSelected = arr.includes(v.id);
                                return (
                                  <button
                                    key={v.id}
                                    type="button"
                                    onClick={() => {
                                      setSelectedAttributeValues((prev) => {
                                        const existing = Array.isArray(prev[attr.id])
                                          ? (prev[attr.id] as number[])
                                          : [];
                                        const next = isSelected
                                          ? existing.filter((id) => id !== v.id)
                                          : [...existing, v.id];
                                        return { ...prev, [attr.id]: next };
                                      });
                                    }}
                                    className={`px-3 py-1 rounded-full border text-sm transition-colors ${
                                      isSelected
                                        ? 'bg-primary-100 border-primary-500 text-primary-700'
                                        : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'
                                    }`}
                                  >
                                    {v.value}
                                  </button>
                                );
                              })}
                            </div>
                          ) : attr.input_type === 'select' ? (
                            <Select
                              options={[
                                { value: '', label: `-- Select ${attr.name} --` },
                                ...(attr.values || []).map((v) => ({
                                  value: v.id.toString(),
                                  label: v.value,
                                })),
                              ]}
                              value={
                                typeof current === 'number' && current > 0
                                  ? current.toString()
                                  : ''
                              }
                              onChange={(e) => {
                                const val = e.target.value ? Number(e.target.value) : null;
                                setSelectedAttributeValues((prev) => ({
                                  ...prev,
                                  [attr.id]: val,
                                }));
                              }}
                            />
                          ) : (
                            <Input
                              type={attr.input_type === 'number' ? 'number' : 'text'}
                              placeholder={`Enter ${attr.name}`}
                              value={typeof current === 'string' ? current : ''}
                              onChange={(e) => {
                                const val = e.target.value;
                                setSelectedAttributeValues((prev) => ({
                                  ...prev,
                                  [attr.id]: val,
                                }));
                              }}
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Sidebar - Right Side (1/3) */}
          <div className="space-y-6">
            {/* Pricing */}
            <Card>
              <CardHeader>
                <CardTitle>Pricing</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Price (৳) <span className="text-red-500">*</span>
                  </label>
                  <Input
                    type="number"
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                    placeholder="0.00"
                    required
                    min={0}
                    step="0.01"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Discount Price (৳)</label>
                  <Input
                    type="number"
                    value={formData.discount_price}
                    onChange={(e) => setFormData({ ...formData, discount_price: e.target.value })}
                    placeholder="Leave empty if no discount"
                    min={0}
                    step="0.01"
                  />
                  {formData.discount_price && formData.price && parseFloat(formData.discount_price) < parseFloat(formData.price) && (
                    <p className="text-xs text-green-600 mt-1">
                      💰 {Math.round(((parseFloat(formData.price) - parseFloat(formData.discount_price)) / parseFloat(formData.price)) * 100)}% OFF (Save ৳{(parseFloat(formData.price) - parseFloat(formData.discount_price)).toFixed(2)})
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Inventory */}
            <Card>
              <CardHeader>
                <CardTitle>Inventory</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Stock Quantity <span className="text-red-500">*</span>
                  </label>
                  <Input
                    type="number"
                    value={formData.stock_qty}
                    onChange={(e) => setFormData({ ...formData, stock_qty: e.target.value })}
                    min={0}
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Low Stock Threshold</label>
                  <Input
                    type="number"
                    value={formData.low_stock_threshold}
                    onChange={(e) => setFormData({ ...formData, low_stock_threshold: e.target.value })}
                    min={0}
                    placeholder="5"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Unit</label>
                  <Input
                    value={formData.unit}
                    onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                    placeholder="piece / kg / meter"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Product Details */}
            <Card>
              <CardHeader>
                <CardTitle>Product Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="flex items-end gap-2">
                    <div className="flex-1">
                      <SearchableSelect
                        label="Brand"
                        placeholder="Search and select brand..."
                        searchPlaceholder="Type to search brands..."
                        emptyMessage="No brands found"
                        allowClear
                        options={brands.map((brand) => ({
                          value: brand.id.toString(),
                          label: brand.name,
                          description: brand.description,
                          icon: brand.logo ? (
                            <img src={brand.logo} alt={brand.name} className="w-5 h-5 object-contain" />
                          ) : (
                            <Tag className="w-5 h-5 text-gray-400" />
                          ),
                        }))}
                        value={formData.brand_id}
                        onChange={(value) => setFormData({ ...formData, brand_id: value.toString() })}
                      />
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setIsQuickBrandModalOpen(true)}
                      className="px-3"
                      title="Quick create brand"
                    >
                      <Plus className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Model</label>
                  <Input
                    value={formData.model}
                    onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                    placeholder="e.g., RTX 3060, Galaxy S23"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Warranty</label>
                  <Input
                    value={formData.warranty}
                    onChange={(e) => setFormData({ ...formData, warranty: e.target.value })}
                    placeholder="e.g., 3 years, 1 year"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Status */}
            <Card>
              <CardHeader>
                <CardTitle>Status</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <label className="flex items-center gap-3 cursor-pointer">
                  <div className="relative">
                    <input
                      type="checkbox"
                      checked={formData.is_active}
                      onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                      className="sr-only peer"
                    />
                    <div className="w-10 h-6 bg-gray-200 rounded-full peer peer-checked:bg-primary-600 transition-colors"></div>
                    <div className="absolute left-0.5 top-0.5 w-5 h-5 bg-white rounded-full shadow-sm peer-checked:translate-x-4 transition-transform"></div>
                  </div>
                  <span className="text-sm text-gray-700">Active</span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer">
                  <div className="relative">
                    <input
                      type="checkbox"
                      checked={formData.is_featured}
                      onChange={(e) => setFormData({ ...formData, is_featured: e.target.checked })}
                      className="sr-only peer"
                    />
                    <div className="w-10 h-6 bg-gray-200 rounded-full peer peer-checked:bg-amber-500 transition-colors"></div>
                    <div className="absolute left-0.5 top-0.5 w-5 h-5 bg-white rounded-full shadow-sm peer-checked:translate-x-4 transition-transform"></div>
                  </div>
                  <span className="text-sm text-gray-700">Featured Product</span>
                </label>
              </CardContent>
            </Card>
          </div>
        </div>
      </form>

      {/* Quick Create Brand Modal */}
      <Modal
        isOpen={isQuickBrandModalOpen}
        onClose={() => {
          setIsQuickBrandModalOpen(false);
          setQuickBrandData({ name: '', slug: '', logo: '' });
        }}
        title="Quick Create Brand"
        size="md"
      >
        <form onSubmit={handleQuickCreateBrand} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Brand Name <span className="text-red-500">*</span>
            </label>
            <Input
              value={quickBrandData.name}
              onChange={(e) =>
                setQuickBrandData({
                  ...quickBrandData,
                  name: e.target.value,
                  slug: generateSlug(e.target.value),
                })
              }
              placeholder="Enter brand name"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Slug <span className="text-red-500">*</span>
            </label>
            <Input
              value={quickBrandData.slug}
              onChange={(e) => setQuickBrandData({ ...quickBrandData, slug: e.target.value })}
              placeholder="brand-slug"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Logo (Optional)
            </label>
            <ImageUpload
              value={quickBrandData.logo}
              onChange={(url) => setQuickBrandData({ ...quickBrandData, logo: url })}
              onRemove={() => setQuickBrandData({ ...quickBrandData, logo: '' })}
              maxSize={2}
              placeholder="Upload brand logo (max 2MB)"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setIsQuickBrandModalOpen(false);
                setQuickBrandData({ name: '', slug: '', logo: '' });
              }}
            >
              Cancel
            </Button>
            <Button type="submit" isLoading={isCreatingBrand}>
              Create & Select
            </Button>
          </div>
        </form>
      </Modal>
    </AdminLayout>
  );
}
