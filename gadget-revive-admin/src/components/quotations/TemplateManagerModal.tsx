'use client';

import React, { useEffect, useState } from 'react';
import { Star, Edit2, Trash2, Plus, ArrowLeft } from 'lucide-react';
import {
  Modal, Button, Input, Textarea, Badge, LoadingSpinner, EmptyState, ConfirmModal,
} from '@/components/ui';
import { QuotationTemplate, QuotationTemplateType } from '@/types';
import { getErrorMessage } from '@/lib/utils';
import adminService from '@/lib/adminService';
import toast from 'react-hot-toast';

/**
 * Saved, reusable Notes / Terms & Conditions snippets. Picking one just copies its text into the
 * quotation's own field at that moment (see QuotationTemplate model docblock) — editing or
 * deleting a template afterward never touches quotations that already used it.
 */
export default function TemplateManagerModal({ type, onApply, onClose }: {
  type: QuotationTemplateType;
  onApply: (content: string) => void;
  onClose: () => void;
}) {
  const label = type === 'notes' ? 'Notes' : 'Terms & Conditions';

  const [templates, setTemplates] = useState<QuotationTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editing, setEditing] = useState<QuotationTemplate | 'new' | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<QuotationTemplate | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchTemplates = async () => {
    setIsLoading(true);
    try {
      const res = await adminService.getQuotationTemplates(type);
      setTemplates(res.data.data || []);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchTemplates(); }, [type]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await adminService.deleteQuotationTemplate(deleteTarget.id);
      toast.success('Template deleted.');
      setDeleteTarget(null);
      fetchTemplates();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setIsDeleting(false);
    }
  };

  if (editing) {
    return (
      <TemplateEditor
        type={type}
        label={label}
        template={editing === 'new' ? null : editing}
        onSaved={() => { setEditing(null); fetchTemplates(); }}
        onCancel={() => setEditing(null)}
      />
    );
  }

  return (
    <Modal isOpen onClose={onClose} title={`${label} Templates`} size="md">
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500">Pick a saved snippet, or manage your list below.</p>
          <Button size="sm" onClick={() => setEditing('new')} leftIcon={<Plus className="w-4 h-4" />}>
            New Template
          </Button>
        </div>

        <div className="max-h-96 overflow-y-auto divide-y divide-gray-100 border border-gray-100 rounded-lg">
          {isLoading ? (
            <div className="flex justify-center py-8"><LoadingSpinner /></div>
          ) : templates.length === 0 ? (
            <div className="py-8">
              <EmptyState
                title={`No ${label.toLowerCase()} templates yet`}
                description="Save one to reuse it across future quotations."
              />
            </div>
          ) : (
            templates.map((t) => (
              <div key={t.id} className="px-3 py-2.5 hover:bg-gray-50">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="text-sm font-medium text-gray-900 truncate">{t.title}</p>
                      {t.is_default && <Badge variant="info">Default</Badge>}
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{t.content}</p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button title="Edit" onClick={() => setEditing(t)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg">
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button title="Delete" onClick={() => setDeleteTarget(t)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                <Button size="sm" variant="outline" className="mt-2" onClick={() => { onApply(t.content); onClose(); }}>
                  Use this
                </Button>
              </div>
            ))
          )}
        </div>
      </div>

      <ConfirmModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete Template"
        message={`Delete "${deleteTarget?.title}"? This cannot be undone.`}
        confirmLabel="Delete"
        variant="danger"
        isLoading={isDeleting}
      />
    </Modal>
  );
}

// ─────────────────────────────────────────────────────────────────────────
function TemplateEditor({ type, label, template, onSaved, onCancel }: {
  type: QuotationTemplateType;
  label: string;
  template: QuotationTemplate | null;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState(template?.title || '');
  const [content, setContent] = useState(template?.content || '');
  const [isDefault, setIsDefault] = useState(template?.is_default || false);
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    if (!title.trim() || !content.trim()) {
      toast.error('Title and content are both required.');
      return;
    }
    setIsSaving(true);
    try {
      const payload = { type, title: title.trim(), content: content.trim(), is_default: isDefault };
      if (template) {
        await adminService.updateQuotationTemplate(template.id, payload);
        toast.success('Template updated.');
      } else {
        await adminService.createQuotationTemplate(payload);
        toast.success('Template saved.');
      }
      onSaved();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal isOpen onClose={onCancel} title={`${template ? 'Edit' : 'New'} ${label} Template`} size="md">
      <div className="space-y-4">
        <button onClick={onCancel} className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-800">
          <ArrowLeft className="w-3.5 h-3.5" /> Back to list
        </button>
        <Input label="Title" placeholder="e.g. Standard Terms" value={title} onChange={(e) => setTitle(e.target.value)} />
        <Textarea label="Content" rows={5} value={content} onChange={(e) => setContent(e.target.value)} />
        <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
          <input type="checkbox" checked={isDefault} onChange={(e) => setIsDefault(e.target.checked)} className="rounded border-gray-300" />
          <span className="flex items-center gap-1">
            <Star className="w-3.5 h-3.5 text-amber-500" />
            Set as default — auto-filled into new quotations
          </span>
        </label>
        <div className="flex justify-end gap-2 pt-1">
          <Button variant="outline" onClick={onCancel}>Cancel</Button>
          <Button onClick={handleSave} isLoading={isSaving}>Save Template</Button>
        </div>
      </div>
    </Modal>
  );
}
