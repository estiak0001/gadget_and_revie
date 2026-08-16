'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Plus, Search, Edit2, Trash2, Download, FileText,
} from 'lucide-react';
import { AdminLayout } from '@/components/layout';
import {
  Card, CardContent, Button, Input, Select, LoadingSpinner, Pagination, EmptyState,
  ErrorState, ConfirmModal,
} from '@/components/ui';
import { Quotation, QuotationStatus } from '@/types';
import { formatCurrency, formatDate, getErrorMessage } from '@/lib/utils';
import adminService from '@/lib/adminService';
import toast from 'react-hot-toast';

const STATUS_OPTIONS: { value: QuotationStatus; label: string }[] = [
  { value: 'draft', label: 'Draft' },
  { value: 'sent', label: 'Sent' },
  { value: 'accepted', label: 'Accepted' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'expired', label: 'Expired' },
];

export default function QuotationsPage() {
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [selected, setSelected] = useState<Quotation | null>(null);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [downloadingId, setDownloadingId] = useState<number | null>(null);

  const fetchQuotations = async () => {
    setIsLoading(true);
    setError(false);
    try {
      const params: Record<string, string | number> = { page: currentPage };
      if (searchQuery) params.search = searchQuery;
      if (filterStatus) params.status = filterStatus;
      const res = await adminService.getQuotations(params);
      const body = res.data as unknown as { data: Quotation[]; meta?: { last_page?: number } };
      setQuotations(Array.isArray(body.data) ? body.data : []);
      setTotalPages(body.meta?.last_page || 1);
    } catch (err) {
      toast.error(getErrorMessage(err));
      setError(true);
      setQuotations([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchQuotations(); }, [currentPage, filterStatus]);

  const handleSearch = () => { setCurrentPage(1); fetchQuotations(); };

  const handleDownload = async (q: Quotation) => {
    setDownloadingId(q.id);
    try {
      const res = await adminService.downloadQuotation(q.id);
      const blob = new Blob([res.data as BlobPart], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Quotation-${q.quotation_number}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setDownloadingId(null);
    }
  };

  const handleStatusChange = async (q: Quotation, status: string) => {
    try {
      await adminService.updateQuotationStatus(q.id, status);
      toast.success('Status updated.');
      fetchQuotations();
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const handleDelete = async () => {
    if (!selected) return;
    setIsDeleting(true);
    try {
      await adminService.deleteQuotation(selected.id);
      toast.success('Quotation deleted.');
      setIsDeleteOpen(false);
      setSelected(null);
      fetchQuotations();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="page-header flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="page-title">Quotations</h1>
            <p className="page-description">Prepare and send price quotations — from catalog products or custom line items</p>
          </div>
          <Link href="/quotations/create">
            <Button><Plus className="w-4 h-4 mr-2" /> New Quotation</Button>
          </Link>
        </div>

        <Card>
          <CardContent className="py-4">
            <div className="flex flex-col md:flex-row gap-3">
              <div className="flex-1 flex gap-2">
                <Input
                  placeholder="Search by quotation no, customer name or phone…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                />
                <Button variant="outline" onClick={handleSearch}><Search className="w-4 h-4" /></Button>
              </div>
              <Select
                className="md:w-56"
                value={filterStatus}
                onChange={(e) => { setFilterStatus(e.target.value); setCurrentPage(1); }}
                placeholder="All statuses"
                options={[{ value: '', label: 'All statuses' }, ...STATUS_OPTIONS]}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="py-16 flex justify-center"><LoadingSpinner /></div>
            ) : error ? (
              <div className="py-12"><ErrorState onRetry={fetchQuotations} /></div>
            ) : quotations.length === 0 ? (
              <div className="py-12">
                <EmptyState
                  icon={<FileText className="w-10 h-10" />}
                  title="No quotations yet"
                  description="Create a quotation to send a priced offer to a prospective customer."
                />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr className="text-left text-gray-500 uppercase text-xs tracking-wide">
                      <th className="px-4 py-3">Quotation No</th>
                      <th className="px-4 py-3">Customer</th>
                      <th className="px-4 py-3">Date</th>
                      <th className="px-4 py-3">Valid Until</th>
                      <th className="px-4 py-3">Total</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {quotations.map((q) => (
                      <tr key={q.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-mono font-semibold text-gray-900">{q.quotation_number}</td>
                        <td className="px-4 py-3">
                          <div className="font-medium text-gray-900">{q.customer_name || '—'}</div>
                          <div className="text-gray-500 text-xs">{q.customer_phone}</div>
                        </td>
                        <td className="px-4 py-3 text-gray-600">{formatDate(q.quotation_date)}</td>
                        <td className="px-4 py-3 text-gray-600">
                          {q.valid_until ? formatDate(q.valid_until) : '—'}
                          {q.is_expired && <span className="ml-1.5 text-amber-600 text-xs font-semibold">(expired)</span>}
                        </td>
                        <td className="px-4 py-3 font-semibold text-gray-900">{formatCurrency(q.total)}</td>
                        <td className="px-4 py-3">
                          <Select
                            className="w-32 text-xs"
                            value={q.status}
                            onChange={(e) => handleStatusChange(q, e.target.value)}
                            options={STATUS_OPTIONS}
                          />
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1">
                            <button title="Download PDF" onClick={() => handleDownload(q)} disabled={downloadingId === q.id} className="p-2 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-lg disabled:opacity-50">
                              <Download className="w-4 h-4" />
                            </button>
                            <Link href={`/quotations/${q.id}/edit`} className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg" title="Edit">
                              <Edit2 className="w-4 h-4" />
                            </Link>
                            <button title="Delete" onClick={() => { setSelected(q); setIsDeleteOpen(true); }} className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg">
                              <Trash2 className="w-4 h-4" />
                            </button>
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
          <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
        )}
      </div>

      <ConfirmModal
        isOpen={isDeleteOpen}
        onClose={() => setIsDeleteOpen(false)}
        onConfirm={handleDelete}
        title="Delete Quotation"
        message={`Delete quotation ${selected?.quotation_number}? This cannot be undone.`}
        confirmLabel="Delete"
        variant="danger"
        isLoading={isDeleting}
      />
    </AdminLayout>
  );
}
