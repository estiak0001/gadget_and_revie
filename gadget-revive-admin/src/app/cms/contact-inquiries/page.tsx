'use client';

import React, { useEffect, useState } from 'react';
import {
  Search, Eye, Trash2, Mail, CheckCircle, Clock, AlertCircle,
  MessageSquare, User, RefreshCw,
} from 'lucide-react';
import { AdminLayout } from '@/components/layout';
import {
  Card, CardContent, CardHeader, CardTitle, Button, Input, Select, Modal,
  Badge, LoadingSpinner, EmptyState, ErrorState,
} from '@/components/ui';
import { formatDateTime, getErrorMessage } from '@/lib/utils';
import adminService from '@/lib/adminService';
import toast from 'react-hot-toast';

// ── Types ─────────────────────────────────────────────────────────────────────

interface ContactInquiry {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
  subject: string;
  message: string;
  status: 'new' | 'read' | 'in_progress' | 'resolved' | 'closed';
  admin_notes?: string;
  ip_address?: string;
  created_at: string;
  updated_at: string;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const STATUSES = [
  { value: 'new',         label: 'New',         color: 'danger'  },
  { value: 'read',        label: 'Read',         color: 'default' },
  { value: 'in_progress', label: 'In Progress',  color: 'warning' },
  { value: 'resolved',    label: 'Resolved',     color: 'success' },
  { value: 'closed',      label: 'Closed',       color: 'default' },
] as const;

// ── Helpers ───────────────────────────────────────────────────────────────────

function getStatusBadge(status: ContactInquiry['status']) {
  const s = STATUSES.find((x) => x.value === status);
  return (
    <Badge variant={(s?.color ?? 'default') as 'success' | 'warning' | 'danger' | 'default'}>
      {s?.label ?? status}
    </Badge>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ContactInquiriesPage() {
  const [inquiries, setInquiries] = useState<ContactInquiry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);

  // View modal
  const [selected, setSelected] = useState<ContactInquiry | null>(null);
  const [isViewOpen, setIsViewOpen] = useState(false);
  const [editStatus, setEditStatus] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // ── Data fetching ──────────────────────────────────────────────────────────

  const fetchInquiries = async () => {
    setIsLoading(true);
    setHasError(false);
    try {
      const params: Record<string, string | number> = { page: currentPage };
      if (searchQuery) params.search = searchQuery;
      if (filterStatus) params.status = filterStatus;
      const res = await adminService.getContactInquiries(params);
      const data = res.data?.data;
      setInquiries(data?.data ?? []);
      setTotalPages(data?.last_page ?? 1);
      setTotalItems(data?.total ?? 0);
    } catch (err) {
      toast.error(getErrorMessage(err));
      setHasError(true);
      setInquiries([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchInquiries(); }, [currentPage, filterStatus]);
  const handleSearch = () => { setCurrentPage(1); fetchInquiries(); };

  // ── Open view modal ────────────────────────────────────────────────────────

  const openView = async (inquiry: ContactInquiry) => {
    setSelected(inquiry);
    setEditStatus(inquiry.status);
    setEditNotes(inquiry.admin_notes ?? '');
    setIsViewOpen(true);
    // If new, mark as read optimistically
    if (inquiry.status === 'new') {
      try {
        await adminService.updateContactInquiry(inquiry.id, { status: 'read' });
        setInquiries((prev) =>
          prev.map((i) => (i.id === inquiry.id ? { ...i, status: 'read' } : i))
        );
      } catch { /* silent */ }
    }
  };

  // ── Save changes ───────────────────────────────────────────────────────────

  const handleSave = async () => {
    if (!selected) return;
    setIsSaving(true);
    try {
      await adminService.updateContactInquiry(selected.id, {
        status: editStatus,
        admin_notes: editNotes,
      });
      toast.success('Inquiry updated');
      setIsViewOpen(false);
      fetchInquiries();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setIsSaving(false);
    }
  };

  // ── Delete ─────────────────────────────────────────────────────────────────

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this inquiry? This cannot be undone.')) return;
    try {
      await adminService.deleteContactInquiry(id);
      toast.success('Inquiry deleted');
      fetchInquiries();
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  // ── Stats ──────────────────────────────────────────────────────────────────

  const newCount        = inquiries.filter((i) => i.status === 'new').length;
  const inProgressCount = inquiries.filter((i) => i.status === 'in_progress').length;
  const resolvedCount   = inquiries.filter((i) => i.status === 'resolved').length;

  if (hasError && inquiries.length === 0) {
    return <AdminLayout><ErrorState title="Failed to load inquiries" onRetry={fetchInquiries} /></AdminLayout>;
  }

  return (
    <AdminLayout>
      {/* Header */}
      <div className="page-header">
        <h1 className="page-title">Contact Inquiries</h1>
        <p className="page-description">Messages submitted through the website contact form</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Total',       count: totalItems,      icon: <Mail className="w-5 h-5 text-blue-600" />,   bg: 'bg-blue-100'   },
          { label: 'New',         count: newCount,         icon: <AlertCircle className="w-5 h-5 text-red-600" />,    bg: 'bg-red-100'    },
          { label: 'In Progress', count: inProgressCount, icon: <Clock className="w-5 h-5 text-yellow-600" />, bg: 'bg-yellow-100' },
          { label: 'Resolved',    count: resolvedCount,   icon: <CheckCircle className="w-5 h-5 text-green-600" />, bg: 'bg-green-100'  },
        ].map((s) => (
          <Card key={s.label}>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 ${s.bg} rounded-lg flex items-center justify-center`}>{s.icon}</div>
                <div>
                  <p className="text-xs text-gray-500">{s.label}</p>
                  <p className="text-xl font-bold">{s.count}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
              <Input
                placeholder="Search by name, email or subject..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                className="pl-10"
              />
            </div>
            <Select
              options={[{ value: '', label: 'All Status' }, ...STATUSES.map((s) => ({ value: s.value, label: s.label }))]}
              value={filterStatus}
              onChange={(e) => { setFilterStatus(e.target.value); setCurrentPage(1); }}
            />
            <Button onClick={handleSearch}>Search</Button>
            <Button variant="outline" onClick={() => { setSearchQuery(''); setFilterStatus(''); setCurrentPage(1); fetchInquiries(); }}>
              <RefreshCw className="w-4 h-4 mr-1" />
              Reset
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardHeader><CardTitle>All Inquiries</CardTitle></CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <LoadingSpinner size="lg" text="Loading inquiries..." />
            </div>
          ) : inquiries.length === 0 ? (
            <EmptyState
              icon={<MessageSquare className="w-8 h-8 text-gray-400" />}
              title="No inquiries found"
              description="Contact form submissions will appear here."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-y">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Sender</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Subject</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Received</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {inquiries.map((inquiry) => (
                    <tr
                      key={inquiry.id}
                      className={`hover:bg-gray-50 ${inquiry.status === 'new' ? 'bg-blue-50/40 font-medium' : ''}`}
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0">
                            <User className="w-4 h-4 text-gray-500" />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-900">
                              {inquiry.first_name} {inquiry.last_name}
                              {inquiry.status === 'new' && (
                                <span className="ml-2 inline-block w-2 h-2 rounded-full bg-red-500" />
                              )}
                            </p>
                            <p className="text-xs text-gray-500">{inquiry.email}</p>
                            {inquiry.phone && <p className="text-xs text-gray-400">{inquiry.phone}</p>}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-sm font-medium text-gray-900 max-w-xs truncate">{inquiry.subject}</p>
                        <p className="text-xs text-gray-500 max-w-xs truncate">{inquiry.message}</p>
                      </td>
                      <td className="px-6 py-4">{getStatusBadge(inquiry.status)}</td>
                      <td className="px-6 py-4 text-sm text-gray-500">{formatDateTime(inquiry.created_at)}</td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-end gap-2">
                          <Button variant="ghost" size="sm" onClick={() => openView(inquiry)}>
                            <Eye className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => handleDelete(inquiry.id)}>
                            <Trash2 className="w-4 h-4 text-red-500" />
                          </Button>
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

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-6">
          <p className="text-sm text-gray-500">Page {currentPage} of {totalPages}</p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={currentPage <= 1} onClick={() => setCurrentPage((p) => p - 1)}>
              Previous
            </Button>
            <Button variant="outline" size="sm" disabled={currentPage >= totalPages} onClick={() => setCurrentPage((p) => p + 1)}>
              Next
            </Button>
          </div>
        </div>
      )}

      {/* View / Edit Modal */}
      <Modal isOpen={isViewOpen} onClose={() => setIsViewOpen(false)} title="Contact Inquiry" size="lg">
        {selected && (
          <div className="space-y-5">
            {/* Sender info */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-xs text-gray-500 mb-1">From</p>
                <p className="font-semibold text-gray-900">{selected.first_name} {selected.last_name}</p>
                <p className="text-sm text-gray-600">{selected.email}</p>
                {selected.phone && <p className="text-sm text-gray-500">{selected.phone}</p>}
              </div>
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-xs text-gray-500 mb-1">Details</p>
                <p className="text-sm"><span className="text-gray-500">Subject:</span> {selected.subject}</p>
                <p className="text-sm"><span className="text-gray-500">Received:</span> {formatDateTime(selected.created_at)}</p>
                {selected.ip_address && (
                  <p className="text-xs text-gray-400 mt-1">IP: {selected.ip_address}</p>
                )}
              </div>
            </div>

            {/* Message */}
            <div>
              <p className="text-xs font-medium text-gray-500 mb-2 uppercase tracking-wide">Message</p>
              <div className="bg-gray-50 rounded-lg p-4 text-sm text-gray-800 whitespace-pre-wrap">
                {selected.message}
              </div>
            </div>

            {/* Admin controls */}
            <div className="border-t pt-4 space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Status</label>
                <Select
                  options={STATUSES.map((s) => ({ value: s.value, label: s.label }))}
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Admin Notes</label>
                <textarea
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  rows={3}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary focus:border-transparent resize-none"
                  placeholder="Internal notes about this inquiry..."
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-between items-center pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => { setIsViewOpen(false); handleDelete(selected.id); }}
                className="text-red-600 border-red-200 hover:bg-red-50"
              >
                <Trash2 className="w-4 h-4 mr-1" />
                Delete
              </Button>
              <div className="flex gap-3">
                <Button variant="outline" onClick={() => setIsViewOpen(false)}>Cancel</Button>
                <Button onClick={handleSave} isLoading={isSaving}>Save Changes</Button>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </AdminLayout>
  );
}
