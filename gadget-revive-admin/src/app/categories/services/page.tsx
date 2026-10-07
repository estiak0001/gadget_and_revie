'use client';

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { Plus, Pencil, Trash2, Search, Wrench, GripVertical, ChevronRight, Eye, EyeOff, RefreshCw } from 'lucide-react';
import * as HeroIcons from '@heroicons/react/24/outline';
import { AdminLayout } from '@/components/layout';
import {
  Button,
  Input,
  Textarea,
  Select,
  Modal,
  LoadingSpinner,
  IconPicker,
  ImageUpload,
  EmptyState,
} from '@/components/ui';
import { ServiceCategory } from '@/types';
import adminService from '@/lib/adminService';
import { getErrorMessage } from '@/lib/utils';
import toast from 'react-hot-toast';

// ServiceCategoryResource always re-wraps `image` as asset('storage/' . $value) on the way
// out, so the column must hold a storage-relative path, not a full URL. ImageUpload's
// onChange hands back the full public URL from the /upload endpoint — strip it back down to
// the relative path before it goes in formData, so round-tripping through save/reload doesn't
// produce a double-wrapped (broken) URL.
const STORAGE_BASE = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api').replace(/\/api$/, '') + '/storage/';
function toStorageRelativePath(url: string): string {
  if (!url) return '';
  return url.startsWith(STORAGE_BASE) ? url.slice(STORAGE_BASE.length) : url;
}

const EMPTY_FORM = {
  name: '',
  slug: '',
  description: '',
  icon: '',
  image: '',
  is_featured: false,
  sort_order: 0,
  is_active: true,
};

const LEVEL_TONE: Record<number, string> = {
  1: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  2: 'bg-slate-100 text-slate-700 border-slate-200',
  3: 'bg-amber-50 text-amber-700 border-amber-200',
};

function getCategoryLevel(category: ServiceCategory): number {
  if (!category.parent_id) return 1;
  if (!category.parent?.parent_id) return 2;
  return 3;
}

function generateSlug(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

export default function ServiceCategoriesPage() {
  const [categories, setCategories] = useState<ServiceCategory[]>([]);
  const totalCount = categories.length;
  const [allCategoriesFlat, setAllCategoriesFlat] = useState<ServiceCategory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [topLevelFilter, setTopLevelFilter] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<ServiceCategory | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  // Separate level-1 and level-2 parent selectors in the form
  const [formLevel1Id, setFormLevel1Id] = useState('');
  const [formLevel2Id, setFormLevel2Id] = useState('');
  const [formData, setFormData] = useState(EMPTY_FORM);

  // Level 1 categories (no parent) from the flat list — used for parent selector & filter
  const level1Categories = useMemo(() => allCategoriesFlat.filter((c) => !c.parent_id), [allCategoriesFlat]);

  // Level 2 categories under the currently selected level-1 — shown in the second selector
  const level2ForSelector = formLevel1Id
    ? allCategoriesFlat.filter((c) => c.parent_id === parseInt(formLevel1Id))
    : [];

  const fetchAllCategoriesFlat = useCallback(async () => {
    try {
      const response = await adminService.getAdminServiceCategories({ per_page: 200 });
      setAllCategoriesFlat(response.data.data || []);
    } catch {
      // silent — selector just won't populate
    }
  }, []);

  const fetchCategories = useCallback(async () => {
    setIsLoading(true);
    try {
      const params: Record<string, string> = {};
      if (search) params.search = search;
      if (topLevelFilter) params.top_level_id = topLevelFilter;

      const response = await adminService.getAdminServiceCategories(params);
      setCategories(response.data.data || []);
    } catch (error) {
      toast.error(getErrorMessage(error));
      setCategories([]);
    } finally {
      setIsLoading(false);
    }
  }, [search, topLevelFilter]);

  useEffect(() => { fetchAllCategoriesFlat(); }, [fetchAllCategoriesFlat]);
  useEffect(() => { fetchCategories(); }, [fetchCategories]);

  // Search waits for a pause in typing, then resets to page one.
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput.trim());
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const isFiltered = search !== '' || topLevelFilter !== '';

  const openCreateModal = () => {
    setSelectedCategory(null);
    setFormLevel1Id('');
    setFormLevel2Id('');
    setFormData({ ...EMPTY_FORM, sort_order: totalCount + 1 });
    setIsModalOpen(true);
  };

  const openEditModal = (category: ServiceCategory) => {
    setSelectedCategory(category);

    // Determine level-1 and level-2 parent IDs from the category hierarchy
    let level1Id = '';
    let level2Id = '';
    if (category.parent_id) {
      if (category.parent?.parent_id) {
        // Level-3 category: direct parent is level-2, grandparent is level-1
        level1Id = category.parent.parent_id.toString();
        level2Id = category.parent_id.toString();
      } else {
        // Level-2 category: direct parent is level-1
        level1Id = category.parent_id.toString();
      }
    }
    setFormLevel1Id(level1Id);
    setFormLevel2Id(level2Id);

    setFormData({
      name: category.name,
      slug: category.slug,
      description: category.description || '',
      icon: category.icon || '',
      image: toStorageRelativePath(category.image || ''),
      is_featured: category.is_featured || false,
      sort_order: category.sort_order || 0,
      is_active: category.is_active ?? true,
    });
    setIsModalOpen(true);
  };

  const openDeleteModal = (category: ServiceCategory) => {
    setSelectedCategory(category);
    setIsDeleteModalOpen(true);
  };

  const refreshAll = () => {
    fetchCategories();
    fetchAllCategoriesFlat();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      // Resolve the actual parent_id: level-2 takes priority over level-1
      const parentId = formLevel2Id
        ? parseInt(formLevel2Id)
        : formLevel1Id
        ? parseInt(formLevel1Id)
        : undefined;

      const payload = { ...formData, parent_id: parentId };

      if (selectedCategory) {
        await adminService.updateServiceCategory(selectedCategory.id, payload);
        toast.success('Category updated.');
      } else {
        await adminService.createServiceCategory(payload);
        toast.success('Category created.');
      }
      setIsModalOpen(false);
      refreshAll();
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setIsSaving(false);
    }
  };

  const handleQuickToggleActive = async (category: ServiceCategory) => {
    try {
      await adminService.updateServiceCategory(category.id, { is_active: !category.is_active });
      toast.success(category.is_active ? 'Category deactivated.' : 'Category activated.');
      refreshAll();
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  const handleDelete = async () => {
    if (!selectedCategory) return;
    try {
      await adminService.deleteServiceCategory(selectedCategory.id);
      toast.success('Category deleted.');
      setIsDeleteModalOpen(false);
      refreshAll();
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  // The full list is returned at once, so the new order is simply the row positions.
  // Disabled while filtered, because a filtered view isn't the whole order.
  const handleDrop = async (dropIndex: number) => {
    if (draggedIndex === null || draggedIndex === dropIndex || isFiltered) {
      setDraggedIndex(null);
      setDragOverIndex(null);
      return;
    }

    const reordered = [...categories];
    const [moved] = reordered.splice(draggedIndex, 1);
    reordered.splice(dropIndex, 0, moved);

    const payload = reordered.map((cat, idx) => ({ id: cat.id, sort_order: idx }));

    try {
      await adminService.reorderServiceCategories(payload);
      toast.success('Order saved.');
      fetchCategories();
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setDraggedIndex(null);
      setDragOverIndex(null);
    }
  };

  return (
    <AdminLayout>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <h1 className="text-lg font-bold text-gray-900">Service categories</h1>
          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-semibold text-gray-600">
            {totalCount} categor{totalCount === 1 ? 'y' : 'ies'}
          </span>
          <span className="text-xs text-gray-500">Up to three levels deep</span>
        </div>
        <Button size="sm" onClick={openCreateModal} leftIcon={<Plus className="h-3.5 w-3.5" />}>Add category</Button>
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-gray-200 bg-white p-2.5">
        <div className="relative min-w-[200px] flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
          <input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search name or slug…"
            className="h-8 w-full rounded-lg border border-gray-300 pl-8 pr-3 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <div className="w-56 shrink-0">
          <Select
            options={[
              { value: '', label: 'All top-level groups' },
              ...level1Categories.map((c) => ({ value: c.id, label: c.name })),
            ]}
            value={topLevelFilter}
            onChange={(e) => setTopLevelFilter(e.target.value)}
          />
        </div>
        <Button size="sm" variant="ghost" onClick={fetchCategories} leftIcon={<RefreshCw className="h-3.5 w-3.5" />}>Refresh</Button>
        {!isFiltered && totalCount > 1 && (
          <span className="ml-auto text-[11px] text-gray-400">Drag rows to reorder</span>
        )}
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        {isLoading ? (
          <div className="flex justify-center py-10"><LoadingSpinner /></div>
        ) : categories.length === 0 ? (
          <EmptyState
            title={isFiltered ? 'No matching categories' : 'No service categories yet'}
            description={isFiltered ? 'Clear the search or the group filter.' : 'Create a category to group your services.'}
            action={!isFiltered ? <Button onClick={openCreateModal} leftIcon={<Plus className="h-4 w-4" />}>Add category</Button> : undefined}
          />
        ) : (
          <div className="max-h-[calc(100vh-17rem)] overflow-auto">
            <table className="min-w-full text-sm">
              <thead className="sticky top-0 z-10 bg-slate-50 text-xs uppercase tracking-wide text-slate-500 shadow-[0_1px_0_0_rgb(226,232,240)]">
                <tr>
                  <th className="w-16 px-3 py-2 text-left font-semibold">Order</th>
                  <th className="px-3 py-2 text-left font-semibold">Category</th>
                  <th className="px-3 py-2 text-left font-semibold">Level</th>
                  <th className="px-3 py-2 text-left font-semibold">Parent</th>
                  <th className="px-3 py-2 text-right font-semibold">Services</th>
                  <th className="px-3 py-2 text-left font-semibold">Status</th>
                  <th className="px-3 py-2 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {categories.map((category, index) => {
                  const level = getCategoryLevel(category);
                  const Icon = category.icon
                    ? ((HeroIcons as Record<string, unknown>)[category.icon] as React.FC<React.SVGProps<SVGSVGElement>> | undefined)
                    : undefined;
                  return (
                    <tr
                      key={category.id}
                      draggable={!isFiltered}
                      onDragStart={(e) => {
                        setDraggedIndex(index);
                        e.dataTransfer.effectAllowed = 'move';
                      }}
                      onDragOver={(e) => { e.preventDefault(); setDragOverIndex(index); }}
                      onDrop={(e) => { e.preventDefault(); handleDrop(index); }}
                      onDragEnd={() => { setDraggedIndex(null); setDragOverIndex(null); }}
                      className={`hover:bg-indigo-50/40 ${draggedIndex === index ? 'opacity-40' : 'bg-white'} ${
                        dragOverIndex === index && draggedIndex !== index ? 'shadow-[inset_0_2px_0_0_#6366F1]' : ''
                      }`}
                    >
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-1.5 text-gray-400" title={isFiltered ? 'Clear filters to reorder' : 'Drag to reorder'}>
                          <GripVertical className={`h-3.5 w-3.5 ${isFiltered ? 'opacity-30' : 'cursor-grab active:cursor-grabbing'}`} />
                          <span className="text-xs tabular-nums">{category.sort_order}</span>
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2.5">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-gray-200 bg-gray-50">
                            {Icon ? <Icon className="h-4 w-4 text-gray-600" /> : <Wrench className="h-4 w-4 text-gray-400" />}
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold text-gray-900">{category.name}</p>
                            {category.description && <p className="max-w-md truncate text-[11px] text-gray-500">{category.description}</p>}
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        <span className={`inline-flex rounded-md border px-1.5 py-0.5 text-[11px] font-semibold ${LEVEL_TONE[level]}`}>L{level}</span>
                      </td>
                      <td className="px-3 py-2">
                        {category.parent ? (
                          category.parent.parent ? (
                            <div className="flex flex-wrap items-center gap-1 text-xs text-gray-600">
                              <span className="text-gray-400">{category.parent.parent.name}</span>
                              <ChevronRight className="h-3 w-3 text-gray-300" />
                              <span className="font-semibold">{category.parent.name}</span>
                            </div>
                          ) : (
                            <span className="text-xs font-semibold text-gray-700">{category.parent.name}</span>
                          )
                        ) : (
                          <span className="text-xs text-gray-400">Top level</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-gray-700">{category.services_count || 0}</td>
                      <td className="px-3 py-2">
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                          category.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                        }`}>
                          {category.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex items-center justify-end gap-0.5">
                          <button
                            type="button"
                            title={category.is_active ? 'Hide from storefront' : 'Show on storefront'}
                            onClick={() => handleQuickToggleActive(category)}
                            className="rounded-md p-1 hover:bg-gray-100"
                          >
                            {category.is_active
                              ? <Eye className="h-3.5 w-3.5 text-emerald-600" />
                              : <EyeOff className="h-3.5 w-3.5 text-gray-400" />}
                          </button>
                          <button type="button" title="Edit" onClick={() => openEditModal(category)} className="rounded-md p-1 text-sky-600 hover:bg-sky-50">
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button type="button" title="Delete" onClick={() => openDeleteModal(category)} className="rounded-md p-1 text-rose-500 hover:bg-rose-50">
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

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={selectedCategory ? 'Edit category' : 'Add category'}
        size="lg"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Name</label>
              <Input
                value={formData.name}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    name: e.target.value,
                    slug: selectedCategory ? formData.slug : generateSlug(e.target.value),
                  })
                }
                placeholder="Enter category name"
                required
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Slug</label>
              <Input
                value={formData.slug}
                onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                placeholder="category-slug"
                required
              />
            </div>
          </div>

          <div className="space-y-3 rounded-lg border border-gray-200 bg-gray-50 p-4">
            <p className="text-sm font-medium text-gray-700">Category hierarchy</p>

            <div>
              <label className="mb-1 block text-xs text-gray-500">Level 1 — top-level parent</label>
              <Select
                options={[
                  { value: '', label: 'None (create as top-level)' },
                  ...level1Categories
                    .filter((c) => c.id !== selectedCategory?.id)
                    .map((c) => ({ value: c.id, label: c.name })),
                ]}
                value={formLevel1Id}
                onChange={(e) => {
                  setFormLevel1Id(e.target.value);
                  setFormLevel2Id('');
                }}
              />
            </div>

            {formLevel1Id && (
              <div>
                <label className="mb-1 block text-xs text-gray-500">
                  Level 2 — sub-category parent <span className="text-gray-400">(optional)</span>
                </label>
                {level2ForSelector.length > 0 ? (
                  <Select
                    options={[
                      { value: '', label: 'Direct child of the selected level-1' },
                      ...level2ForSelector
                        .filter((c) => c.id !== selectedCategory?.id)
                        .map((c) => ({ value: c.id, label: c.name })),
                    ]}
                    value={formLevel2Id}
                    onChange={(e) => setFormLevel2Id(e.target.value)}
                  />
                ) : (
                  <p className="text-xs italic text-gray-400">No level-2 sub-categories yet — this will be created as a direct child.</p>
                )}
              </div>
            )}

            <div className="flex flex-wrap items-center gap-1 pt-1 text-xs text-gray-500">
              <span className="font-medium">Will be placed as:</span>
              {!formLevel1Id ? (
                <span className="font-medium text-emerald-600">Top level (L1)</span>
              ) : formLevel2Id ? (
                <span className="flex items-center gap-1">
                  <span className="text-gray-400">{level1Categories.find((c) => c.id === parseInt(formLevel1Id))?.name}</span>
                  <ChevronRight className="h-3 w-3" />
                  <span className="text-gray-400">{level2ForSelector.find((c) => c.id === parseInt(formLevel2Id))?.name}</span>
                  <ChevronRight className="h-3 w-3" />
                  <span className="font-medium text-indigo-600">{formData.name || 'New category'}</span>
                  <span className="rounded border border-amber-200 bg-amber-50 px-1 text-[10px] font-semibold text-amber-700">L3</span>
                </span>
              ) : (
                <span className="flex items-center gap-1">
                  <span className="text-gray-400">{level1Categories.find((c) => c.id === parseInt(formLevel1Id))?.name}</span>
                  <ChevronRight className="h-3 w-3" />
                  <span className="font-medium text-indigo-600">{formData.name || 'New category'}</span>
                  <span className="rounded border border-slate-200 bg-slate-100 px-1 text-[10px] font-semibold text-slate-700">L2</span>
                </span>
              )}
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Description</label>
            <Textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Enter category description"
              rows={3}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <IconPicker
                label="Icon"
                value={formData.icon}
                onChange={(iconName) => setFormData({ ...formData, icon: iconName })}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Image <span className="font-normal text-gray-400">(shown instead of the icon, if set)</span>
              </label>
              <ImageUpload
                value={formData.image ? (formData.image.startsWith('http') ? formData.image : STORAGE_BASE + formData.image) : ''}
                onChange={(url) => setFormData({ ...formData, image: toStorageRelativePath(url) })}
                onRemove={() => setFormData({ ...formData, image: '' })}
                placeholder="Click to upload an image or SVG"
              />
            </div>
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
                  { value: 'active', label: 'Active' },
                  { value: 'inactive', label: 'Inactive' },
                ]}
                value={formData.is_active ? 'active' : 'inactive'}
                onChange={(e) => setFormData({ ...formData, is_active: e.target.value === 'active' })}
              />
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={formData.is_featured}
              onChange={(e) => setFormData({ ...formData, is_featured: e.target.checked })}
              className="rounded border-gray-300 text-primary focus:ring-primary"
            />
            Featured category
          </label>

          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>Cancel</Button>
            <Button type="submit" isLoading={isSaving}>{selectedCategory ? 'Update' : 'Create'}</Button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={isDeleteModalOpen} onClose={() => setIsDeleteModalOpen(false)} title="Delete category">
        <p className="mb-4 text-gray-600">
          Delete &quot;{selectedCategory?.name}&quot;? This also affects its services and sub-categories.
        </p>
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={() => setIsDeleteModalOpen(false)}>Cancel</Button>
          <Button variant="danger" onClick={handleDelete}>Delete</Button>
        </div>
      </Modal>
    </AdminLayout>
  );
}
