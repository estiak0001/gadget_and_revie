'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Plus, Trash2, Save, ChevronDown, ChevronUp, X } from 'lucide-react';
import { AdminLayout } from '@/components/layout';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Button,
  Input,
  Select,
  Badge,
  LoadingSpinner,
  EmptyState,
} from '@/components/ui';
import adminService from '@/lib/adminService';
import { getErrorMessage } from '@/lib/utils';
import type { CategoryAttribute, AttributeValue, ProductCategory } from '@/types';
import toast from 'react-hot-toast';

type DraftValue = {
  id?: number;
  value: string;
  value_bn?: string;
  sort_order: number;
  is_active: boolean;
  _new?: boolean;
};

type DraftAttribute = {
  id?: number;
  category_id: number;
  name: string;
  name_bn?: string;
  slug?: string;
  unit?: string;
  input_type: 'select' | 'multiselect' | 'text' | 'number';
  is_filterable: boolean;
  is_required: boolean;
  is_active: boolean;
  sort_order: number;
  values: DraftValue[];
  _expanded?: boolean;
  _new?: boolean;
  _dirty?: boolean;
};

export default function CategoryAttributesPage() {
  const params = useParams();
  const router = useRouter();
  const categoryId = Number(params?.id);

  const [category, setCategory] = useState<ProductCategory | null>(null);
  const [attributes, setAttributes] = useState<DraftAttribute[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [savingAttrId, setSavingAttrId] = useState<number | 'new' | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const loadData = useCallback(async () => {
    if (!categoryId) return;
    setIsLoading(true);
    try {
      const [catRes, attrsRes] = await Promise.all([
        adminService.getProductCategories({ per_page: 200 }),
        adminService.getCategoryAttributes({ category_id: categoryId }),
      ]);

      const foundCategory = (catRes.data.data as ProductCategory[] | undefined)?.find(
        (c) => c.id === categoryId
      );
      setCategory(foundCategory || null);

      const raw = (attrsRes.data?.data as CategoryAttribute[] | undefined) || [];
      const drafts: DraftAttribute[] = raw.map((a) => ({
        id: a.id,
        category_id: a.category_id,
        name: a.name,
        name_bn: a.name_bn || '',
        slug: a.slug,
        unit: a.unit || '',
        input_type: a.input_type,
        is_filterable: a.is_filterable,
        is_required: a.is_required,
        is_active: a.is_active,
        sort_order: a.sort_order,
        values: (a.values || []).map((v: AttributeValue) => ({
          id: v.id,
          value: v.value,
          value_bn: v.value_bn || '',
          sort_order: v.sort_order,
          is_active: v.is_active,
        })),
        _expanded: false,
      }));
      setAttributes(drafts);
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  }, [categoryId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const addNewAttribute = () => {
    setAttributes((prev) => [
      ...prev,
      {
        category_id: categoryId,
        name: '',
        name_bn: '',
        unit: '',
        input_type: 'select',
        is_filterable: true,
        is_required: false,
        is_active: true,
        sort_order: prev.length,
        values: [],
        _expanded: true,
        _new: true,
        _dirty: true,
      },
    ]);
  };

  const updateAttribute = (index: number, patch: Partial<DraftAttribute>) => {
    setAttributes((prev) =>
      prev.map((a, i) => (i === index ? { ...a, ...patch, _dirty: true } : a))
    );
  };

  const toggleExpanded = (index: number) => {
    setAttributes((prev) =>
      prev.map((a, i) => (i === index ? { ...a, _expanded: !a._expanded } : a))
    );
  };

  const addValueRow = (attrIndex: number) => {
    setAttributes((prev) =>
      prev.map((a, i) =>
        i === attrIndex
          ? {
              ...a,
              values: [
                ...a.values,
                {
                  value: '',
                  value_bn: '',
                  sort_order: a.values.length,
                  is_active: true,
                  _new: true,
                },
              ],
              _dirty: true,
            }
          : a
      )
    );
  };

  const updateValueRow = (
    attrIndex: number,
    valueIndex: number,
    patch: Partial<DraftValue>
  ) => {
    setAttributes((prev) =>
      prev.map((a, i) =>
        i === attrIndex
          ? {
              ...a,
              values: a.values.map((v, j) =>
                j === valueIndex ? { ...v, ...patch } : v
              ),
              _dirty: true,
            }
          : a
      )
    );
  };

  const removeValueRow = (attrIndex: number, valueIndex: number) => {
    setAttributes((prev) =>
      prev.map((a, i) =>
        i === attrIndex
          ? {
              ...a,
              values: a.values.filter((_, j) => j !== valueIndex),
              _dirty: true,
            }
          : a
      )
    );
  };

  const saveAttribute = async (index: number) => {
    const attr = attributes[index];
    if (!attr.name.trim()) {
      toast.error('Attribute name is required');
      return;
    }

    const trimmedValues = attr.values
      .map((v, idx) => ({
        id: v.id,
        value: v.value.trim(),
        value_bn: v.value_bn?.trim() || null,
        sort_order: idx,
        is_active: v.is_active,
      }))
      .filter((v) => v.value.length > 0);

    setSavingAttrId(attr.id ?? 'new');
    try {
      let savedId = attr.id;

      if (attr._new || !attr.id) {
        const payload = {
          category_id: attr.category_id,
          name: attr.name,
          name_bn: attr.name_bn || null,
          unit: attr.unit || null,
          input_type: attr.input_type,
          is_filterable: attr.is_filterable,
          is_required: attr.is_required,
          is_active: attr.is_active,
          sort_order: attr.sort_order,
          values: trimmedValues.map((v) => ({
            value: v.value,
            value_bn: v.value_bn,
            sort_order: v.sort_order,
            is_active: v.is_active,
          })),
        };
        const res = await adminService.createCategoryAttribute(payload);
        savedId = (res.data?.data as CategoryAttribute | undefined)?.id;
        toast.success('Attribute created');
      } else {
        await adminService.updateCategoryAttribute(attr.id, {
          name: attr.name,
          name_bn: attr.name_bn || null,
          unit: attr.unit || null,
          input_type: attr.input_type,
          is_filterable: attr.is_filterable,
          is_required: attr.is_required,
          is_active: attr.is_active,
          sort_order: attr.sort_order,
        });
        await adminService.syncCategoryAttributeValues(attr.id, trimmedValues);
        toast.success('Attribute updated');
      }

      if (savedId) {
        await loadData();
      }
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setSavingAttrId(null);
    }
  };

  const deleteAttribute = async (index: number) => {
    const attr = attributes[index];
    if (!attr.id) {
      setAttributes((prev) => prev.filter((_, i) => i !== index));
      return;
    }
    if (!confirm(`Delete attribute "${attr.name}"? Products using it will lose this spec.`)) {
      return;
    }
    setDeletingId(attr.id);
    try {
      await adminService.deleteCategoryAttribute(attr.id);
      toast.success('Attribute deleted');
      await loadData();
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <AdminLayout>
      <div className="page-header flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Button variant="ghost" size="sm" onClick={() => router.back()}>
              <ArrowLeft className="w-4 h-4 mr-1" />
              Back
            </Button>
          </div>
          <h1 className="page-title">
            Filter Attributes{category ? ` — ${category.name}` : ''}
          </h1>
          <p className="page-description">
            Define filterable specifications (e.g. &quot;Volt Ampere&quot;, &quot;Screen Size&quot;) for this
            category. Descendant categories inherit these attributes automatically.
          </p>
        </div>
        <Button onClick={addNewAttribute}>
          <Plus className="w-4 h-4 mr-2" />
          Add Attribute
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <LoadingSpinner size="lg" text="Loading attributes..." />
        </div>
      ) : attributes.length === 0 ? (
        <Card>
          <CardContent className="py-12">
            <EmptyState
              title="No attributes yet"
              description="Add filterable specs so customers can narrow products in this category."
              action={{ label: 'Add First Attribute', onClick: addNewAttribute }}
            />
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {attributes.map((attr, index) => (
            <Card key={attr.id ?? `new-${index}`}>
              <CardHeader className="flex flex-row items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => toggleExpanded(index)}
                  className="flex items-center gap-2 text-left flex-1 min-w-0"
                >
                  {attr._expanded ? (
                    <ChevronUp className="w-4 h-4 text-gray-500" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-gray-500" />
                  )}
                  <CardTitle className="truncate">
                    {attr.name || <span className="text-gray-400">Untitled attribute</span>}
                    {attr.unit && <span className="text-gray-400 text-sm ml-2">({attr.unit})</span>}
                  </CardTitle>
                  <Badge variant={attr.is_filterable ? 'success' : 'default'}>
                    {attr.is_filterable ? 'Filterable' : 'Spec only'}
                  </Badge>
                  <Badge variant="default">{attr.values.length} values</Badge>
                  {attr._dirty && <Badge variant="warning">Unsaved</Badge>}
                </button>
                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    size="sm"
                    onClick={() => saveAttribute(index)}
                    disabled={savingAttrId !== null}
                  >
                    <Save className="w-4 h-4 mr-1" />
                    Save
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => deleteAttribute(index)}
                    disabled={deletingId === attr.id}
                  >
                    <Trash2 className="w-4 h-4 text-red-500" />
                  </Button>
                </div>
              </CardHeader>

              {attr._expanded && (
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        Name *
                      </label>
                      <Input
                        value={attr.name}
                        onChange={(e) => updateAttribute(index, { name: e.target.value })}
                        placeholder="e.g. Volt Ampere"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        Name (Bengali)
                      </label>
                      <Input
                        value={attr.name_bn || ''}
                        onChange={(e) => updateAttribute(index, { name_bn: e.target.value })}
                        placeholder="বাংলা নাম"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        Unit
                      </label>
                      <Input
                        value={attr.unit || ''}
                        onChange={(e) => updateAttribute(index, { unit: e.target.value })}
                        placeholder="VA, W, inch, GB..."
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        Input Type
                      </label>
                      <Select
                        options={[
                          { value: 'select', label: 'Single Select' },
                          { value: 'multiselect', label: 'Multi Select' },
                          { value: 'text', label: 'Text' },
                          { value: 'number', label: 'Number' },
                        ]}
                        value={attr.input_type}
                        onChange={(e) =>
                          updateAttribute(index, {
                            input_type: e.target.value as DraftAttribute['input_type'],
                          })
                        }
                      />
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-4 text-sm">
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={attr.is_filterable}
                        onChange={(e) =>
                          updateAttribute(index, { is_filterable: e.target.checked })
                        }
                      />
                      Show in filter sidebar
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={attr.is_required}
                        onChange={(e) =>
                          updateAttribute(index, { is_required: e.target.checked })
                        }
                      />
                      Required on products
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={attr.is_active}
                        onChange={(e) => updateAttribute(index, { is_active: e.target.checked })}
                      />
                      Active
                    </label>
                  </div>

                  <div className="border-t pt-4">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-sm font-semibold text-gray-700">Values</h4>
                      <Button size="sm" variant="ghost" onClick={() => addValueRow(index)}>
                        <Plus className="w-4 h-4 mr-1" />
                        Add Value
                      </Button>
                    </div>

                    {attr.values.length === 0 ? (
                      <p className="text-xs text-gray-400 italic">
                        No values yet — add options like &quot;650VA&quot;, &quot;750VA&quot;, etc.
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {attr.values.map((v, vIdx) => (
                          <div
                            key={v.id ?? `v-${vIdx}`}
                            className="flex items-center gap-2"
                          >
                            <span className="w-6 text-xs text-gray-400">{vIdx + 1}.</span>
                            <Input
                              className="flex-1"
                              value={v.value}
                              onChange={(e) =>
                                updateValueRow(index, vIdx, { value: e.target.value })
                              }
                              placeholder="Value (e.g. 650VA)"
                            />
                            <Input
                              className="w-40"
                              value={v.value_bn || ''}
                              onChange={(e) =>
                                updateValueRow(index, vIdx, { value_bn: e.target.value })
                              }
                              placeholder="Bengali (optional)"
                            />
                            <label className="flex items-center gap-1 text-xs text-gray-500">
                              <input
                                type="checkbox"
                                checked={v.is_active}
                                onChange={(e) =>
                                  updateValueRow(index, vIdx, { is_active: e.target.checked })
                                }
                              />
                              Active
                            </label>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => removeValueRow(index, vIdx)}
                            >
                              <X className="w-4 h-4 text-red-500" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </CardContent>
              )}
            </Card>
          ))}
        </div>
      )}
    </AdminLayout>
  );
}
