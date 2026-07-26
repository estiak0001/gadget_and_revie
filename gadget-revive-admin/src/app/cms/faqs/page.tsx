'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { Plus, Search, Edit, Trash2, HelpCircle, GripVertical } from 'lucide-react';
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
import { formatDate, getErrorMessage } from '@/lib/utils';
import adminService from '@/lib/adminService';
import { FAQ, PaginatedResponse } from '@/types';
import toast from 'react-hot-toast';
import { useForm } from 'react-hook-form';

interface FAQFormData {
  question: string;
  answer: string;
  category: string;
  sort_order: number;
  is_active: boolean;
}

const CATEGORIES = [
  { value: 'General', label: 'General' },
  { value: 'Orders', label: 'Orders' },
  { value: 'Payments', label: 'Payments' },
  { value: 'Services', label: 'Services' },
  { value: 'Products', label: 'Products' },
  { value: 'Vendors', label: 'Vendors' },
  { value: 'Account', label: 'Account' },
];

export default function FAQsPage() {
  const [faqs, setFaqs] = useState<FAQ[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [selectedFaq, setSelectedFaq] = useState<FAQ | null>(null);
  const [showFormModal, setShowFormModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { register, handleSubmit, reset, setValue, formState: { errors } } = useForm<FAQFormData>();

  const fetchFaqs = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        per_page: '10',
      });
      if (search) params.append('search', search);
      if (categoryFilter) params.append('category', categoryFilter);

      const response = await adminService.getFaqs({ page: currentPage, per_page: 10, ...(search ? { search } : {}), ...(categoryFilter ? { category: categoryFilter } : {}) });
      setFaqs(response.data.data);
      setTotalPages(response.data.meta?.last_page || 1);
    } catch (error) {
      toast.error(getErrorMessage(error));
      setFaqs([]);
      setTotalPages(1);
    } finally {
      setIsLoading(false);
    }
  }, [currentPage, search, categoryFilter]);

  useEffect(() => {
    fetchFaqs();
  }, [fetchFaqs]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setCurrentPage(1);
    fetchFaqs();
  };

  const handleOpenForm = (faq?: FAQ) => {
    if (faq) {
      setSelectedFaq(faq);
      setValue('question', faq.question);
      setValue('answer', faq.answer);
      setValue('category', faq.category || 'General');
      setValue('sort_order', faq.sort_order);
      setValue('is_active', faq.is_active);
    } else {
      setSelectedFaq(null);
      reset({
        question: '',
        answer: '',
        category: 'General',
        sort_order: 1,
        is_active: true,
      });
    }
    setShowFormModal(true);
  };

  const onSubmit = async (data: FAQFormData) => {
    setIsSubmitting(true);
    try {
      const payload = { ...data };
      if (selectedFaq) {
        await adminService.updateFaq(selectedFaq.id, payload);
        toast.success('FAQ updated successfully');
      } else {
        await adminService.createFaq(payload);
        toast.success('FAQ created successfully');
      }
      setShowFormModal(false);
      setSelectedFaq(null);
      reset();
      fetchFaqs();
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedFaq) return;

    try {
      await adminService.deleteFaq(selectedFaq.id);
      toast.success('FAQ deleted successfully');
      setShowDeleteModal(false);
      setSelectedFaq(null);
      fetchFaqs();
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  return (
    <AdminLayout>
      <div className="page-header flex items-center justify-between">
        <div>
          <h1 className="page-title">FAQs</h1>
          <p className="page-description">Manage frequently asked questions</p>
        </div>
        <Button onClick={() => handleOpenForm()}>
          <Plus className="w-4 h-4 mr-2" />
          Add FAQ
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <CardTitle>All FAQs</CardTitle>
            <div className="flex flex-col sm:flex-row gap-3">
              <form onSubmit={handleSearch} className="flex gap-2">
                <Input
                  placeholder="Search FAQs..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full sm:w-64"
                />
                <Button type="submit" variant="secondary">
                  <Search className="w-4 h-4" />
                </Button>
              </form>

              <Select
                value={categoryFilter}
                onChange={(e) => {
                  setCategoryFilter(e.target.value);
                  setCurrentPage(1);
                }}
                options={[
                  { value: '', label: 'All Categories' },
                  ...CATEGORIES,
                ]}
              />
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <LoadingSpinner size="lg" />
            </div>
          ) : (
            <>
              <div className="divide-y divide-gray-200">
                {faqs.map((faq) => (
                  <div key={faq.id} className="p-6 hover:bg-gray-50">
                    <div className="flex items-start gap-4">
                      <div className="flex items-center gap-2">
                        <GripVertical className="w-5 h-5 text-gray-300 cursor-move" />
                        <HelpCircle className="w-5 h-5 text-primary-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <h3 className="font-medium text-gray-900">{faq.question}</h3>
                            <p className="text-sm text-gray-500 mt-1 line-clamp-2">{faq.answer}</p>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <Badge variant={faq.is_active ? 'success' : 'default'}>
                              {faq.is_active ? 'Active' : 'Inactive'}
                            </Badge>
                            <Badge>{faq.category}</Badge>
                          </div>
                        </div>
                        <div className="flex items-center gap-4 mt-3">
                          <span className="text-xs text-gray-400">
                            Order: {faq.sort_order}
                          </span>
                          <span className="text-xs text-gray-400">
                            Created: {formatDate(faq.created_at)}
                          </span>
                          <div className="flex items-center gap-2 ml-auto">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleOpenForm(faq)}
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setSelectedFaq(faq);
                                setShowDeleteModal(true);
                              }}
                            >
                              <Trash2 className="w-4 h-4 text-red-600" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {faqs.length === 0 && (
                <div className="text-center py-12">
                  <HelpCircle className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500">No FAQs found</p>
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

      {/* FAQ Form Modal */}
      <Modal
        isOpen={showFormModal}
        onClose={() => {
          setShowFormModal(false);
          setSelectedFaq(null);
          reset();
        }}
        title={selectedFaq ? 'Edit FAQ' : 'Create New FAQ'}
        size="lg"
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <Input
            label="Question *"
            {...register('question', { required: 'Question is required' })}
            error={errors.question?.message}
          />

          <Textarea
            label="Answer *"
            rows={5}
            {...register('answer', { required: 'Answer is required' })}
            error={errors.answer?.message}
          />

          <div className="grid grid-cols-2 gap-4">
            <Select
              label="Category"
              {...register('category')}
              options={CATEGORIES}
            />

            <Input
              label="Sort Order"
              type="number"
              {...register('sort_order', { valueAsNumber: true })}
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="is_active"
              {...register('is_active')}
              className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
            />
            <label htmlFor="is_active" className="text-sm text-gray-700">
              Active
            </label>
          </div>

          <div className="flex gap-2 pt-4">
            <Button
              type="button"
              variant="secondary"
              className="flex-1"
              onClick={() => {
                setShowFormModal(false);
                setSelectedFaq(null);
                reset();
              }}
            >
              Cancel
            </Button>
            <Button type="submit" className="flex-1" isLoading={isSubmitting}>
              {selectedFaq ? 'Update FAQ' : 'Create FAQ'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete Modal */}
      <Modal
        isOpen={showDeleteModal}
        onClose={() => {
          setShowDeleteModal(false);
          setSelectedFaq(null);
        }}
        title="Delete FAQ"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-gray-600">
            Are you sure you want to delete this FAQ? This action cannot be undone.
          </p>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              className="flex-1"
              onClick={() => {
                setShowDeleteModal(false);
                setSelectedFaq(null);
              }}
            >
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
