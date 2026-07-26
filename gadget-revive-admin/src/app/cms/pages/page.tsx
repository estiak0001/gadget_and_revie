'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { Plus, Search, Edit, Trash2, Eye, Copy, Check, ExternalLink, FileText } from 'lucide-react';
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
  Pagination,
  Modal,
  LoadingSpinner,
  Textarea,
} from '@/components/ui';
import RichTextEditor from '@/components/ui/RichTextEditor';
import { formatDate, getErrorMessage } from '@/lib/utils';
import adminService from '@/lib/adminService';
import { CMSPage, PaginatedResponse } from '@/types';
import toast from 'react-hot-toast';
import { useForm } from 'react-hook-form';

const WEB_URL = process.env.NEXT_PUBLIC_WEB_URL || 'http://localhost:3000';

interface PageFormData {
  title: string;
  slug: string;
  content: string;
  meta_title?: string;
  meta_description?: string;
  status: string;
}

type ViewMode = 'list' | 'editor';

export default function CMSPagesPage() {
  const [pages, setPages] = useState<CMSPage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [selectedPage, setSelectedPage] = useState<CMSPage | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [copiedSlug, setCopiedSlug] = useState<number | null>(null);
  const [editorContent, setEditorContent] = useState('');

  const { register, handleSubmit, reset, setValue, watch, formState: { errors } } = useForm<PageFormData>({
    defaultValues: { status: 'draft' }
  });

  const watchedSlug = watch('slug');

  const fetchPages = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await adminService.getPages({ page: currentPage, per_page: 10, ...(search ? { search } : {}) });
      setPages(response.data.data);
      setTotalPages(response.data.meta?.last_page || 1);
    } catch (error) {
      toast.error(getErrorMessage(error));
      setPages([]);
      setTotalPages(1);
    } finally {
      setIsLoading(false);
    }
  }, [currentPage, search]);

  useEffect(() => {
    fetchPages();
  }, [fetchPages]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setCurrentPage(1);
    fetchPages();
  };

  const handleOpenEditor = (page?: CMSPage) => {
    if (page) {
      setSelectedPage(page);
      setValue('title', page.title);
      setValue('slug', page.slug);
      setValue('meta_title', page.meta_title || '');
      setValue('meta_description', page.meta_description || '');
      setValue('status', page.status);
      setEditorContent(page.content || '');
    } else {
      setSelectedPage(null);
      reset({ title: '', slug: '', content: '', meta_title: '', meta_description: '', status: 'draft' });
      setEditorContent('');
    }
    setViewMode('editor');
  };

  const handleCloseEditor = () => {
    setViewMode('list');
    setSelectedPage(null);
    reset();
    setEditorContent('');
  };

  const onSubmit = async (data: PageFormData) => {
    setIsSubmitting(true);
    try {
      const payload = { ...data, content: editorContent };
      if (selectedPage) {
        await adminService.updatePage(selectedPage.id, payload);
        toast.success('Page updated successfully');
      } else {
        await adminService.createPage(payload);
        toast.success('Page created successfully');
      }
      handleCloseEditor();
      fetchPages();
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedPage) return;
    try {
      await adminService.deletePage(selectedPage.id);
      toast.success('Page deleted successfully');
      setShowDeleteModal(false);
      setSelectedPage(null);
      fetchPages();
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  const generateSlug = (title: string) =>
    title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

  const copyLink = async (page: CMSPage) => {
    const url = `${WEB_URL}/pages/${page.slug}`;
    await navigator.clipboard.writeText(url);
    setCopiedSlug(page.id);
    toast.success('Link copied!');
    setTimeout(() => setCopiedSlug(null), 2000);
  };

  // ─── Full-page editor view ───────────────────────────────────────────────────
  if (viewMode === 'editor') {
    return (
      <AdminLayout>
        <div className="flex flex-col h-full">
          {/* Editor header */}
          <div className="flex items-center justify-between pb-4 border-b border-gray-200 mb-6">
            <div className="flex items-center gap-3">
              <button
                onClick={handleCloseEditor}
                className="text-sm text-gray-500 hover:text-gray-800 flex items-center gap-1"
              >
                ← Back to Pages
              </button>
              <span className="text-gray-300">|</span>
              <h1 className="text-lg font-semibold text-gray-900">
                {selectedPage ? 'Edit Page' : 'Create New Page'}
              </h1>
            </div>
            <div className="flex items-center gap-2">
              {selectedPage?.status === 'published' && (
                <a
                  href={`${WEB_URL}/pages/${selectedPage.slug}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-800 px-3 py-1.5 border border-blue-200 rounded-lg hover:bg-blue-50"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  View Live
                </a>
              )}
              <Button type="button" variant="secondary" onClick={handleCloseEditor}>
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handleSubmit(onSubmit)}
                isLoading={isSubmitting}
              >
                {selectedPage ? 'Update Page' : 'Create Page'}
              </Button>
            </div>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="flex gap-6 flex-1">
            {/* Main editor area */}
            <div className="flex-1 min-w-0 space-y-4">
              <Input
                label="Page Title *"
                placeholder="Enter page title..."
                {...register('title', { required: 'Title is required' })}
                error={errors.title?.message}
                onChange={(e) => {
                  if (!selectedPage) setValue('slug', generateSlug(e.target.value));
                }}
              />
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Content *
                </label>
                <RichTextEditor
                  value={editorContent}
                  onChange={setEditorContent}
                  placeholder="Start writing your page content..."
                  className="min-h-[500px]"
                />
              </div>
            </div>

            {/* Sidebar settings */}
            <div className="w-72 flex-shrink-0 space-y-4">
              {/* Publish settings */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Publish Settings</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Select
                    label="Status"
                    {...register('status')}
                    options={[
                      { value: 'draft', label: 'Draft' },
                      { value: 'published', label: 'Published' },
                    ]}
                  />

                  {/* Publishable link preview */}
                  {watchedSlug && (
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Publishable Link</label>
                      <div className="bg-gray-50 border border-gray-200 rounded-lg p-2 flex items-center gap-2">
                        <code className="text-xs text-gray-600 flex-1 break-all">
                          /pages/{watchedSlug}
                        </code>
                        <button
                          type="button"
                          onClick={() => navigator.clipboard.writeText(`${WEB_URL}/pages/${watchedSlug}`)}
                          className="flex-shrink-0 p-1 hover:bg-gray-200 rounded"
                          title="Copy link"
                        >
                          <Copy className="w-3 h-3 text-gray-500" />
                        </button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* SEO settings */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">SEO Settings</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Input
                    label="URL Slug *"
                    placeholder="page-url-slug"
                    {...register('slug', { required: 'Slug is required' })}
                    error={errors.slug?.message}
                  />
                  <Input
                    label="Meta Title"
                    placeholder="SEO title..."
                    {...register('meta_title')}
                  />
                  <Textarea
                    label="Meta Description"
                    placeholder="SEO description..."
                    rows={3}
                    {...register('meta_description')}
                  />
                </CardContent>
              </Card>
            </div>
          </form>
        </div>
      </AdminLayout>
    );
  }

  // ─── List view ───────────────────────────────────────────────────────────────
  return (
    <AdminLayout>
      <div className="page-header flex items-center justify-between">
        <div>
          <h1 className="page-title">CMS Pages</h1>
          <p className="page-description">Create and manage publishable pages with rich content</p>
        </div>
        <Button onClick={() => handleOpenEditor()}>
          <Plus className="w-4 h-4 mr-2" />
          New Page
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <CardTitle>All Pages</CardTitle>
            <form onSubmit={handleSearch} className="flex gap-2">
              <Input
                placeholder="Search pages..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full sm:w-64"
              />
              <Button type="submit" variant="secondary">
                <Search className="w-4 h-4" />
              </Button>
            </form>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <LoadingSpinner size="lg" />
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Title</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Publishable Link</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Last Updated</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {pages.map((page) => (
                      <tr key={page.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <FileText className="w-4 h-4 text-gray-400 flex-shrink-0" />
                            <div>
                              <p className="text-sm font-medium text-gray-900">{page.title}</p>
                              {page.meta_title && <p className="text-xs text-gray-400">{page.meta_title}</p>}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <code className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                              /pages/{page.slug}
                            </code>
                            <button
                              onClick={() => copyLink(page)}
                              className="p-1 hover:bg-gray-200 rounded transition-colors"
                              title="Copy link"
                            >
                              {copiedSlug === page.id ? (
                                <Check className="w-3.5 h-3.5 text-green-600" />
                              ) : (
                                <Copy className="w-3.5 h-3.5 text-gray-400" />
                              )}
                            </button>
                            {page.status === 'published' && (
                              <a
                                href={`${WEB_URL}/pages/${page.slug}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-1 hover:bg-gray-200 rounded transition-colors"
                                title="View live page"
                              >
                                <ExternalLink className="w-3.5 h-3.5 text-blue-500" />
                              </a>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <Badge variant={page.status === 'published' ? 'success' : 'default'}>
                            {page.status}
                          </Badge>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-500">
                          {formatDate(page.updated_at)}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button variant="ghost" size="sm" onClick={() => handleOpenEditor(page)} title="Edit">
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => { setSelectedPage(page); setShowDeleteModal(true); }}
                              title="Delete"
                            >
                              <Trash2 className="w-4 h-4 text-red-600" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {pages.length === 0 && (
                <div className="text-center py-12">
                  <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500">No pages yet. Create your first page!</p>
                </div>
              )}

              {totalPages > 1 && (
                <div className="px-6 py-4 border-t border-gray-200">
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

      {/* Delete Modal */}
      <Modal
        isOpen={showDeleteModal}
        onClose={() => { setShowDeleteModal(false); setSelectedPage(null); }}
        title="Delete Page"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-gray-600">
            Are you sure you want to delete <strong>{selectedPage?.title}</strong>? This action cannot be undone.
          </p>
          <div className="flex gap-2">
            <Button variant="secondary" className="flex-1" onClick={() => { setShowDeleteModal(false); setSelectedPage(null); }}>
              Cancel
            </Button>
            <Button variant="danger" className="flex-1" onClick={handleDelete}>
              Delete
            </Button>
          </div>
        </div>
      </Modal>
    </AdminLayout>
  );
}
