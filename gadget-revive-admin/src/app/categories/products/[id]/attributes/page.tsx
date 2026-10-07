'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Plus, Trash2, Save, ChevronDown, ChevronRight, X } from 'lucide-react';
import { AdminLayout } from '@/components/layout';
import { Button, Input, Select, ConfirmModal, LoadingSpinner, EmptyState } from '@/components/ui';
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

const INPUT_TYPE_LABEL: Record<DraftAttribute['input_type'], string> = {
  select: 'Single select',
  multiselect: 'Multi select',
  text: 'Text',
  number: 'Number',
};

const FIELD = 'h-8 text-xs';

export default function CategoryAttributesPage() {
  const params = useParams();
  const router = useRouter();
  const categoryId = Number(params?.id);

  const [category, setCategory] = useState<ProductCategory | null>(null);
  const [attributes, setAttributes] = useState<DraftAttribute[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [savingAttrId, setSavingAttrId] = useState<number | 'new' | null>(null);
  const [pendingDeleteIndex, setPendingDeleteIndex] = useState<number | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const loadData = useCallback(async () => {
    if (!categoryId) return;
    setIsLoading(true);
    try {
      const [catRes, attrsRes] = await Promise.all([
        adminService.getAdminProductCategories({ per_page: 200 }),
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

  const updateValueRow = (attrIndex: number, valueIndex: number, patch: Partial<DraftValue>) => {
    setAttributes((prev) =>
      prev.map((a, i) =>
        i === attrIndex
          ? {
              ...a,
              values: a.values.map((v, j) => (j === valueIndex ? { ...v, ...patch } : v)),
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
        toast.success('Attribute created.');
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
        toast.success('Attribute updated.');
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

  const confirmDelete = async () => {
    if (pendingDeleteIndex === null) return;
    const attr = attributes[pendingDeleteIndex];
    if (!attr.id) {
      setAttributes((prev) => prev.filter((_, i) => i !== pendingDeleteIndex));
      setPendingDeleteIndex(null);
      return;
    }
    setIsDeleting(true);
    try {
      await adminService.deleteCategoryAttribute(attr.id);
      toast.success('Attribute deleted.');
      setPendingDeleteIndex(null);
      await loadData();
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setIsDeleting(false);
    }
  };

  const pendingAttr = pendingDeleteIndex !== null ? attributes[pendingDeleteIndex] : null;

  return (
    <AdminLayout>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2.5">
          <Button variant="ghost" size="sm" onClick={() => router.back()}>
            <ArrowLeft className="mr-1 h-3.5 w-3.5" />
            Back
          </Button>
          <h1 className="text-lg font-bold text-gray-900">
            Filter attributes{category ? ` — ${category.name}` : ''}
          </h1>
          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-semibold text-gray-600">
            {attributes.length} attribute{attributes.length === 1 ? '' : 's'}
          </span>
        </div>
        <Button size="sm" onClick={addNewAttribute} leftIcon={<Plus className="h-3.5 w-3.5" />}>Add attribute</Button>
      </div>

      <p className="mb-3 text-xs text-gray-500">
        Specs such as &quot;Volt ampere&quot; or &quot;Screen size&quot; that customers can filter by. Child categories inherit them.
      </p>

      {isLoading ? (
        <div className="flex justify-center py-10"><LoadingSpinner /></div>
      ) : attributes.length === 0 ? (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
          <EmptyState
            title="No attributes yet"
            description="Add filterable specs so customers can narrow products in this category."
            action={<Button onClick={addNewAttribute} leftIcon={<Plus className="h-4 w-4" />}>Add first attribute</Button>}
          />
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
          {attributes.map((attr, index) => (
            <div key={attr.id ?? `new-${index}`} className={index > 0 ? 'border-t border-gray-100' : ''}>
              <div className="flex flex-wrap items-center gap-2 px-3 py-2 hover:bg-indigo-50/40">
                <button
                  type="button"
                  onClick={() => toggleExpanded(index)}
                  className="flex min-w-0 flex-1 items-center gap-2 text-left"
                >
                  {attr._expanded
                    ? <ChevronDown className="h-3.5 w-3.5 shrink-0 text-gray-500" />
                    : <ChevronRight className="h-3.5 w-3.5 shrink-0 text-gray-500" />}
                  <span className="truncate font-semibold text-gray-900">
                    {attr.name || <span className="font-normal text-gray-400">Untitled attribute</span>}
                  </span>
                  {attr.unit && <span className="text-xs text-gray-500">({attr.unit})</span>}
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                    attr.is_filterable ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-600'
                  }`}>
                    {attr.is_filterable ? 'Filterable' : 'Spec only'}
                  </span>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
                    {INPUT_TYPE_LABEL[attr.input_type]}
                  </span>
                  <span className="text-[11px] tabular-nums text-gray-500">{attr.values.length} value{attr.values.length === 1 ? '' : 's'}</span>
                  {!attr.is_active && <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[11px] font-semibold text-rose-700">Inactive</span>}
                  {attr._dirty && <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700">Unsaved</span>}
                </button>
                <div className="flex items-center gap-1">
                  <Button size="sm" onClick={() => saveAttribute(index)} disabled={savingAttrId !== null} leftIcon={<Save className="h-3.5 w-3.5" />}>
                    Save
                  </Button>
                  <button
                    type="button"
                    title="Delete attribute"
                    onClick={() => setPendingDeleteIndex(index)}
                    className="rounded-md p-1 text-rose-500 hover:bg-rose-50"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              {attr._expanded && (
                <div className="space-y-3 border-t border-gray-100 bg-slate-50/60 px-4 py-3">
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
                    <div>
                      <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-gray-500">Name *</label>
                      <Input className={FIELD} value={attr.name} onChange={(e) => updateAttribute(index, { name: e.target.value })} placeholder="e.g. Volt ampere" />
                    </div>
                    <div>
                      <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-gray-500">Name (Bengali)</label>
                      <Input className={FIELD} value={attr.name_bn || ''} onChange={(e) => updateAttribute(index, { name_bn: e.target.value })} placeholder="বাংলা নাম" />
                    </div>
                    <div>
                      <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-gray-500">Unit</label>
                      <Input className={FIELD} value={attr.unit || ''} onChange={(e) => updateAttribute(index, { unit: e.target.value })} placeholder="VA, W, inch, GB" />
                    </div>
                    <div>
                      <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-gray-500">Input type</label>
                      <Select
                        options={[
                          { value: 'select', label: 'Single select' },
                          { value: 'multiselect', label: 'Multi select' },
                          { value: 'text', label: 'Text' },
                          { value: 'number', label: 'Number' },
                        ]}
                        value={attr.input_type}
                        onChange={(e) => updateAttribute(index, { input_type: e.target.value as DraftAttribute['input_type'] })}
                      />
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-4 text-xs text-gray-700">
                    <label className="flex items-center gap-1.5">
                      <input type="checkbox" checked={attr.is_filterable} onChange={(e) => updateAttribute(index, { is_filterable: e.target.checked })} />
                      Show in filter sidebar
                    </label>
                    <label className="flex items-center gap-1.5">
                      <input type="checkbox" checked={attr.is_required} onChange={(e) => updateAttribute(index, { is_required: e.target.checked })} />
                      Required on products
                    </label>
                    <label className="flex items-center gap-1.5">
                      <input type="checkbox" checked={attr.is_active} onChange={(e) => updateAttribute(index, { is_active: e.target.checked })} />
                      Active
                    </label>
                  </div>

                  <div>
                    <div className="mb-2 flex items-center justify-between">
                      <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Values</h4>
                      <Button size="sm" variant="ghost" onClick={() => addValueRow(index)} leftIcon={<Plus className="h-3.5 w-3.5" />}>Add value</Button>
                    </div>

                    {attr.values.length === 0 ? (
                      <p className="text-xs italic text-gray-400">No values yet — add options such as &quot;650VA&quot; or &quot;750VA&quot;.</p>
                    ) : (
                      <div className="space-y-1.5">
                        {attr.values.map((v, vIdx) => (
                          <div key={v.id ?? `v-${vIdx}`} className="flex items-center gap-2">
                            <span className="w-6 text-right text-[11px] tabular-nums text-gray-400">{vIdx + 1}.</span>
                            <Input
                              className={`${FIELD} flex-1`}
                              value={v.value}
                              onChange={(e) => updateValueRow(index, vIdx, { value: e.target.value })}
                              placeholder="Value, e.g. 650VA"
                            />
                            <Input
                              className={`${FIELD} w-40`}
                              value={v.value_bn || ''}
                              onChange={(e) => updateValueRow(index, vIdx, { value_bn: e.target.value })}
                              placeholder="Bengali (optional)"
                            />
                            <label className="flex items-center gap-1 text-[11px] text-gray-500">
                              <input type="checkbox" checked={v.is_active} onChange={(e) => updateValueRow(index, vIdx, { is_active: e.target.checked })} />
                              Active
                            </label>
                            <button
                              type="button"
                              title="Remove value"
                              onClick={() => removeValueRow(index, vIdx)}
                              className="rounded-md p-1 text-rose-500 hover:bg-rose-50"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <ConfirmModal
        isOpen={pendingDeleteIndex !== null}
        onClose={() => setPendingDeleteIndex(null)}
        onConfirm={confirmDelete}
        title="Delete attribute"
        message={`Delete "${pendingAttr?.name || 'this attribute'}"? Products using it will lose this spec.`}
        confirmLabel="Delete"
        variant="danger"
        isLoading={isDeleting}
      />
    </AdminLayout>
  );
}
