'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { Plus, Edit2, Trash2, Search, Wrench, GripVertical, ChevronRight, Eye, EyeOff } from 'lucide-react';
import * as HeroIcons from '@heroicons/react/24/outline';
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
  IconPicker,
} from '@/components/ui';
import { ServiceCategory } from '@/types';
import adminService from '@/lib/adminService';
import { getErrorMessage } from '@/lib/utils';
import toast from 'react-hot-toast';

export default function ServiceCategoriesPage() {
  const [categories, setCategories] = useState<ServiceCategory[]>([]);
  const [allCategoriesFlat, setAllCategoriesFlat] = useState<ServiceCategory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [topLevelFilter, setTopLevelFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<ServiceCategory | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  // Separate level-1 and level-2 parent selectors in the form
  const [formLevel1Id, setFormLevel1Id] = useState('');
  const [formLevel2Id, setFormLevel2Id] = useState('');

  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    description: '',
    icon: '',
    image: '',
    is_featured: false,
    sort_order: 0,
    is_active: true,
  });

  // Level 1 categories (no parent) from the flat list — used for parent selector & filter
  const level1Categories = allCategoriesFlat.filter(c => !c.parent_id);

  // Level 2 categories under the currently selected level-1 — shown in the second selector
  const level2ForSelector = formLevel1Id
    ? allCategoriesFlat.filter(c => c.parent_id === parseInt(formLevel1Id))
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
      const params: Record<string, string | number> = { page: currentPage };
      if (searchQuery) params.search = searchQuery;
      if (topLevelFilter) params.top_level_id = topLevelFilter;

      const response = await adminService.getAdminServiceCategories(params);
      setCategories(response.data.data || []);
      setTotalPages(response.data.meta?.last_page || 1);
    } catch (error) {
      toast.error(getErrorMessage(error));
      setCategories([]);
      setTotalPages(1);
    } finally {
      setIsLoading(false);
    }
  }, [currentPage, searchQuery, topLevelFilter]);

  useEffect(() => {
    fetchAllCategoriesFlat();
  }, [fetchAllCategoriesFlat]);

  useEffect(() => {
    fetchCategories();
  }, [currentPage, topLevelFilter]);

  const handleSearch = () => {
    setCurrentPage(1);
    fetchCategories();
  };

  const handleTopLevelFilterChange = (value: string) => {
    setTopLevelFilter(value);
    setCurrentPage(1);
  };

  const generateSlug = (name: string) =>
    name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

  const openCreateModal = () => {
    setSelectedCategory(null);
    setFormLevel1Id('');
    setFormLevel2Id('');
    setFormData({
      name: '',
      slug: '',
      description: '',
      icon: '',
      image: '',
      is_featured: false,
      sort_order: categories.length + 1,
      is_active: true,
    });
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
        level2Id = '';
      }
    }
    setFormLevel1Id(level1Id);
    setFormLevel2Id(level2Id);

    setFormData({
      name: category.name,
      slug: category.slug,
      description: category.description || '',
      icon: category.icon || '',
      image: category.image || '',
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
        toast.success('Category updated successfully');
      } else {
        await adminService.createServiceCategory(payload);
        toast.success('Category created successfully');
      }
      setIsModalOpen(false);
      fetchCategories();
      fetchAllCategoriesFlat();
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setIsSaving(false);
    }
  };

  const handleQuickToggleActive = async (category: ServiceCategory) => {
    try {
      await adminService.updateServiceCategory(category.id, { is_active: !category.is_active });
      toast.success(category.is_active ? 'Category deactivated' : 'Category activated');
      fetchCategories();
      fetchAllCategoriesFlat();
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  const handleDelete = async () => {
    if (!selectedCategory) return;
    try {
      await adminService.deleteServiceCategory(selectedCategory.id);
      toast.success('Category deleted successfully');
      setIsDeleteModalOpen(false);
      fetchCategories();
      fetchAllCategoriesFlat();
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/html', e.currentTarget.innerHTML);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    setDragOverIndex(index);
  };

  const handleDrop = async (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === dropIndex) {
      setDraggedIndex(null);
      setDragOverIndex(null);
      return;
    }

    const newCategories = [...filteredCategories];
    const [draggedItem] = newCategories.splice(draggedIndex, 1);
    newCategories.splice(dropIndex, 0, draggedItem);

    const reorderedCategories = newCategories.map((cat, idx) => ({
      id: cat.id,
      sort_order: idx,
    }));

    try {
      await adminService.reorderServiceCategories(reorderedCategories);
      toast.success('Categories reordered successfully');
      fetchCategories();
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setDraggedIndex(null);
      setDragOverIndex(null);
    }
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const filteredCategories = categories.filter(
    c =>
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.slug.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Compute level of a category (1, 2, or 3)
  const getCategoryLevel = (category: ServiceCategory): number => {
    if (!category.parent_id) return 1;
    if (!category.parent?.parent_id) return 2;
    return 3;
  };

  const levelBadgeVariant: Record<number, 'default' | 'warning' | 'success'> = {
    1: 'success',
    2: 'default',
    3: 'warning',
  };

  return (
    <AdminLayout>
      <div className="page-header flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="page-title">Service Categories</h1>
          <p className="page-description">Manage service categories up to 3 levels deep</p>
        </div>
        <Button onClick={openCreateModal}>
          <Plus className="w-4 h-4 mr-2" />
          Add Category
        </Button>
      </div>

      {/* Search & Filters */}
      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <Input
                placeholder="Search categories..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                className="pl-10"
              />
            </div>
            <div className="w-full sm:w-56">
              <Select
                options={[
                  { value: '', label: 'All Top-Level' },
                  ...level1Categories.map(c => ({ value: c.id, label: c.name })),
                ]}
                value={topLevelFilter}
                onChange={(e) => handleTopLevelFilterChange(e.target.value)}
              />
            </div>
            <Button onClick={handleSearch}>Search</Button>
          </div>
        </CardContent>
      </Card>

      {/* Categories Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Categories ({filteredCategories.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <LoadingSpinner size="lg" text="Loading categories..." />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-y">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Order</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Level</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Hierarchy</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Services</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredCategories.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-6 py-12 text-center text-gray-400">
                        No categories found
                      </td>
                    </tr>
                  ) : (
                    filteredCategories.map((category, index) => {
                      const level = getCategoryLevel(category);
                      return (
                        <tr
                          key={category.id}
                          draggable
                          onDragStart={(e) => handleDragStart(e, index)}
                          onDragOver={(e) => handleDragOver(e, index)}
                          onDrop={(e) => handleDrop(e, index)}
                          onDragEnd={handleDragEnd}
                          className={`hover:bg-gray-50 cursor-move transition-all ${
                            draggedIndex === index ? 'opacity-50' : ''
                          } ${
                            dragOverIndex === index && draggedIndex !== index
                              ? 'border-t-2 border-primary-500'
                              : ''
                          }`}
                        >
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2 text-gray-400" title="Drag to reorder">
                              <GripVertical className="w-4 h-4 cursor-grab active:cursor-grabbing" />
                              <span>{category.sort_order}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                                {(() => {
                                  const Icon = category.icon
                                    ? (HeroIcons as Record<string, unknown>)[category.icon] as React.FC<React.SVGProps<SVGSVGElement>>
                                    : null;
                                  return Icon
                                    ? <Icon className="w-5 h-5 text-gray-600" />
                                    : <Wrench className="w-5 h-5 text-gray-400" />;
                                })()}
                              </div>
                              <div>
                                <p className="font-medium">{category.name}</p>
                                {category.description && (
                                  <p className="text-xs text-gray-500 truncate max-w-xs">
                                    {category.description}
                                  </p>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <Badge variant={levelBadgeVariant[level]}>L{level}</Badge>
                          </td>
                          <td className="px-6 py-4">
                            {category.parent ? (
                              category.parent.parent ? (
                                // Level 3: show grandparent → parent
                                <div className="flex items-center gap-1 flex-wrap text-sm">
                                  <span className="text-gray-400 text-xs">
                                    {category.parent.parent.name}
                                  </span>
                                  <ChevronRight className="w-3 h-3 text-gray-300" />
                                  <Badge variant="default">{category.parent.name}</Badge>
                                </div>
                              ) : (
                                // Level 2: show parent
                                <Badge variant="default">{category.parent.name}</Badge>
                              )
                            ) : (
                              <span className="text-gray-400 text-xs">Root</span>
                            )}
                          </td>
                          <td className="px-6 py-4">
                            <Badge variant="default">{category.services_count || 0}</Badge>
                          </td>
                          <td className="px-6 py-4">
                            <Badge variant={category.is_active ? 'success' : 'danger'}>
                              {category.is_active ? 'active' : 'inactive'}
                            </Badge>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center justify-end gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleQuickToggleActive(category)}
                                title={category.is_active ? 'Deactivate' : 'Activate'}
                              >
                                {category.is_active
                                  ? <Eye className="w-4 h-4 text-gray-400" />
                                  : <EyeOff className="w-4 h-4 text-red-500" />}
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => openEditModal(category)}
                              >
                                <Edit2 className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => openDeleteModal(category)}
                              >
                                <Trash2 className="w-4 h-4 text-red-500" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {totalPages > 1 && (
        <div className="mt-6">
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
          />
        </div>
      )}

      {/* Create/Edit Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={selectedCategory ? 'Edit Category' : 'Add Category'}
        size="lg"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
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
              <label className="block text-sm font-medium text-gray-700 mb-1">Slug</label>
              <Input
                value={formData.slug}
                onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                placeholder="category-slug"
                required
              />
            </div>
          </div>

          {/* 3-Level Parent Selection */}
          <div className="space-y-3 border border-gray-200 rounded-lg p-4 bg-gray-50">
            <p className="text-sm font-medium text-gray-700">Category Hierarchy</p>

            <div>
              <label className="block text-xs text-gray-500 mb-1">
                Level 1 — Top-Level Parent
              </label>
              <Select
                options={[
                  { value: '', label: 'None (create as top-level)' },
                  ...level1Categories
                    .filter(c => c.id !== selectedCategory?.id)
                    .map(c => ({ value: c.id, label: c.name })),
                ]}
                value={formLevel1Id}
                onChange={(e) => {
                  setFormLevel1Id(e.target.value);
                  setFormLevel2Id(''); // reset level-2 when level-1 changes
                }}
              />
            </div>

            {formLevel1Id && (
              <div>
                <label className="block text-xs text-gray-500 mb-1">
                  Level 2 — Sub-Category Parent{' '}
                  <span className="text-gray-400">(optional — leave empty to nest under level 1)</span>
                </label>
                {level2ForSelector.length > 0 ? (
                  <Select
                    options={[
                      { value: '', label: `Direct child of selected level-1` },
                      ...level2ForSelector
                        .filter(c => c.id !== selectedCategory?.id)
                        .map(c => ({ value: c.id, label: c.name })),
                    ]}
                    value={formLevel2Id}
                    onChange={(e) => setFormLevel2Id(e.target.value)}
                  />
                ) : (
                  <p className="text-xs text-gray-400 italic">
                    No level-2 sub-categories yet — this will be created as a direct child.
                  </p>
                )}
              </div>
            )}

            {/* Preview of resulting hierarchy */}
            <div className="flex items-center gap-1 text-xs text-gray-500 pt-1">
              <span className="font-medium">Will be placed as:</span>
              {!formLevel1Id ? (
                <span className="text-green-600 font-medium">Root (Level 1)</span>
              ) : formLevel2Id ? (
                <span className="flex items-center gap-1">
                  <span className="text-gray-400">
                    {level1Categories.find(c => c.id === parseInt(formLevel1Id))?.name}
                  </span>
                  <ChevronRight className="w-3 h-3" />
                  <span className="text-gray-400">
                    {level2ForSelector.find(c => c.id === parseInt(formLevel2Id))?.name}
                  </span>
                  <ChevronRight className="w-3 h-3" />
                  <span className="text-blue-600 font-medium">{formData.name || 'New Category'}</span>
                  <Badge variant="warning">L3</Badge>
                </span>
              ) : (
                <span className="flex items-center gap-1">
                  <span className="text-gray-400">
                    {level1Categories.find(c => c.id === parseInt(formLevel1Id))?.name}
                  </span>
                  <ChevronRight className="w-3 h-3" />
                  <span className="text-blue-600 font-medium">{formData.name || 'New Category'}</span>
                  <Badge variant="default">L2</Badge>
                </span>
              )}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <Textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Enter category description"
              rows={3}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <IconPicker
                label="Icon"
                value={formData.icon}
                onChange={(iconName) => setFormData({ ...formData, icon: iconName })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Image URL</label>
              <Input
                value={formData.image}
                onChange={(e) => setFormData({ ...formData, image: e.target.value })}
                placeholder="https://..."
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Sort Order</label>
              <Input
                type="number"
                value={formData.sort_order}
                onChange={(e) =>
                  setFormData({ ...formData, sort_order: parseInt(e.target.value) })
                }
                min={0}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
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

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="is_featured"
              checked={formData.is_featured}
              onChange={(e) => setFormData({ ...formData, is_featured: e.target.checked })}
              className="rounded border-gray-300 text-primary focus:ring-primary"
            />
            <label htmlFor="is_featured" className="text-sm text-gray-700">
              Featured Category
            </label>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" isLoading={isSaving}>
              {selectedCategory ? 'Update' : 'Create'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete Modal */}
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        title="Delete Category"
      >
        <p className="text-gray-600 mb-4">
          Are you sure you want to delete &quot;{selectedCategory?.name}&quot;? This will also
          affect all associated services and sub-categories.
        </p>
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={() => setIsDeleteModalOpen(false)}>
            Cancel
          </Button>
          <Button variant="danger" onClick={handleDelete}>
            Delete
          </Button>
        </div>
      </Modal>
    </AdminLayout>
  );
}
