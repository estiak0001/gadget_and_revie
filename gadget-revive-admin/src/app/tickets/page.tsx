'use client';

import React, { useEffect, useState } from 'react';
import { Search, Eye, MessageSquare, Send, Headphones, X } from 'lucide-react';
import { AdminLayout } from '@/components/layout';
import { Button, Select, Modal, Badge, LoadingSpinner, Pagination, EmptyState, ErrorState } from '@/components/ui';
import { Ticket, TicketMessage } from '@/types';
import { formatDateTime, getErrorMessage } from '@/lib/utils';
import adminService from '@/lib/adminService';
import toast from 'react-hot-toast';

const TICKET_CATEGORIES = [
  { value: 'order', label: 'Order issue' }, { value: 'payment', label: 'Payment issue' },
  { value: 'refund', label: 'Refund request' }, { value: 'service', label: 'Service complaint' },
  { value: 'vendor', label: 'Vendor complaint' }, { value: 'technical', label: 'Technical issue' },
  { value: 'account', label: 'Account issue' }, { value: 'general', label: 'General inquiry' },
];

const TICKET_PRIORITIES = [
  { value: 'low', label: 'Low', color: 'default' }, { value: 'medium', label: 'Medium', color: 'warning' },
  { value: 'high', label: 'High', color: 'danger' }, { value: 'urgent', label: 'Urgent', color: 'danger' },
];

const TICKET_STATUSES = [
  { value: 'open', label: 'Open', color: 'warning' }, { value: 'in-progress', label: 'In progress', color: 'default' },
  { value: 'waiting', label: 'Waiting for customer', color: 'default' }, { value: 'resolved', label: 'Resolved', color: 'success' },
  { value: 'closed', label: 'Closed', color: 'default' },
];

const SELECT = 'h-8 rounded-lg border border-gray-300 bg-white px-2 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500';
const TEXTAREA = 'w-full rounded-lg border border-gray-300 p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500';

export default function TicketsPage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterPriority, setFilterPriority] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [isReplyModalOpen, setIsReplyModalOpen] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [replyMessage, setReplyMessage] = useState('');
  const [newStatus, setNewStatus] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [ticketMessages, setTicketMessages] = useState<TicketMessage[]>([]);

  const fetchTickets = async () => {
    setIsLoading(true);
    setError(false);
    try {
      const params: Record<string, string | number> = { page: currentPage };
      if (searchQuery) params.search = searchQuery;
      if (filterStatus) params.status = filterStatus;
      if (filterCategory) params.category = filterCategory;
      if (filterPriority) params.priority = filterPriority;
      const response = await adminService.getTickets(params);
      setTickets(response.data.data);
      setTotalPages(response.data.meta?.last_page || 1);
    } catch (err) {
      toast.error(getErrorMessage(err));
      setError(true);
      setTickets([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchTickets(); }, [currentPage, filterStatus, filterCategory, filterPriority]);
  const handleSearch = () => { setCurrentPage(1); fetchTickets(); };

  const fetchTicketMessages = async (ticketId: number) => {
    try {
      const response = await adminService.getTicket(ticketId);
      setTicketMessages(response.data.data?.messages || []);
    } catch (err) {
      console.error('Error fetching messages:', err);
      setTicketMessages([]);
    }
  };

  const openViewModal = async (ticket: Ticket) => {
    setSelectedTicket(ticket);
    await fetchTicketMessages(ticket.id);
    setIsViewModalOpen(true);
  };

  const openReplyModal = (ticket: Ticket) => {
    setSelectedTicket(ticket);
    setReplyMessage('');
    setNewStatus(ticket.status);
    setIsReplyModalOpen(true);
  };

  const handleReply = async () => {
    if (!selectedTicket || !replyMessage.trim()) return;
    setIsSaving(true);
    try {
      await adminService.replyToTicket(selectedTicket.id, { message: replyMessage, status: newStatus });
      toast.success('Reply sent');
      setIsReplyModalOpen(false);
      fetchTickets();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setIsSaving(false);
    }
  };

  const handleStatusChange = async (ticket: Ticket, status: string) => {
    try {
      await adminService.updateTicket(ticket.id, { status });
      toast.success('Status updated');
      fetchTickets();
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const getStatusBadge = (status: string) => {
    const c = TICKET_STATUSES.find(s => s.value === status);
    return <Badge variant={c?.color as 'success' | 'warning' | 'danger' | 'default' || 'default'} className="text-[11px]">{c?.label || status}</Badge>;
  };
  const getPriorityBadge = (priority: string) => {
    const c = TICKET_PRIORITIES.find(p => p.value === priority);
    return <Badge variant={c?.color as 'success' | 'warning' | 'danger' | 'default' || 'default'} className="text-[11px]">{c?.label || priority}</Badge>;
  };
  const getCategoryLabel = (cat: string) => TICKET_CATEGORIES.find(c => c.value === cat)?.label || cat;

  // Status chips double as the status filter. Counts reflect the tickets on the current page.
  const statusChips = [
    { value: '', label: 'All', count: tickets.length, tone: 'bg-slate-700 border-slate-700 text-white' },
    { value: 'open', label: 'Open', count: tickets.filter(t => t.status === 'open').length, tone: 'bg-amber-500 border-amber-500 text-white' },
    { value: 'in-progress', label: 'In progress', count: tickets.filter(t => t.status === 'in-progress').length, tone: 'bg-sky-600 border-sky-600 text-white' },
    { value: 'waiting', label: 'Waiting', count: tickets.filter(t => t.status === 'waiting').length, tone: 'bg-orange-500 border-orange-500 text-white' },
    { value: 'resolved', label: 'Resolved', count: tickets.filter(t => t.status === 'resolved').length, tone: 'bg-emerald-600 border-emerald-600 text-white' },
  ];

  const filtered = !!searchQuery || !!filterStatus || !!filterCategory || !!filterPriority;
  const clearFilters = () => {
    setSearchQuery('');
    setFilterStatus('');
    setFilterCategory('');
    setFilterPriority('');
    setCurrentPage(1);
  };

  if (error && tickets.length === 0) {
    return (<AdminLayout><ErrorState title="Failed to load tickets" onRetry={fetchTickets} /></AdminLayout>);
  }

  return (
    <AdminLayout>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2.5">
          <h1 className="text-lg font-bold text-gray-900">Support tickets</h1>
          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-semibold text-gray-600">
            {tickets.length} on this page
          </span>
        </div>
        <div className="inline-flex rounded-lg border border-gray-200 bg-white p-0.5">
          {statusChips.map((s) => (
            <button
              key={s.label}
              type="button"
              onClick={() => { setFilterStatus(s.value); setCurrentPage(1); }}
              className={`rounded-md px-2.5 py-1 text-xs font-semibold transition-colors ${filterStatus === s.value ? s.tone : 'text-gray-600 hover:bg-gray-50'}`}
            >
              {s.label} <span className="ml-1 opacity-70">{s.count}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-gray-200 bg-white p-3">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            placeholder="Search ticket number, subject or customer…"
            className="h-8 w-full rounded-lg border border-gray-300 pl-8 pr-3 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <select className={SELECT} value={filterCategory} onChange={(e) => { setFilterCategory(e.target.value); setCurrentPage(1); }}>
          <option value="">All categories</option>
          {TICKET_CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>
        <select className={SELECT} value={filterPriority} onChange={(e) => { setFilterPriority(e.target.value); setCurrentPage(1); }}>
          <option value="">All priorities</option>
          {TICKET_PRIORITIES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
        </select>
        <Button size="sm" onClick={handleSearch} className="whitespace-nowrap">Search</Button>
        {filtered && (
          <button type="button" onClick={clearFilters} className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-gray-600 hover:bg-gray-100">
            <X className="h-3.5 w-3.5" /> Clear
          </button>
        )}
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        {isLoading ? (
          <div className="flex items-center justify-center py-12"><LoadingSpinner size="lg" text="Loading tickets..." /></div>
        ) : tickets.length === 0 ? (
          <div className="p-4"><EmptyState icon={<Headphones className="h-8 w-8 text-gray-400" />} title={filtered ? 'No tickets match these filters' : 'No tickets yet'} /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold">Ticket</th>
                  <th className="px-3 py-2 text-left font-semibold">Customer</th>
                  <th className="px-3 py-2 text-left font-semibold">Subject</th>
                  <th className="px-3 py-2 text-left font-semibold">Category</th>
                  <th className="px-3 py-2 text-left font-semibold">Priority</th>
                  <th className="px-3 py-2 text-left font-semibold">Status</th>
                  <th className="whitespace-nowrap px-3 py-2 text-left font-semibold">Updated</th>
                  <th className="px-3 py-2 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {tickets.map((ticket, i) => (
                  <tr key={ticket.id} className={`${ticket.priority === 'urgent' ? 'bg-rose-50/60' : i % 2 ? 'bg-slate-50/40' : 'bg-white'} hover:bg-indigo-50/40`}>
                    <td className="whitespace-nowrap px-3 py-2">
                      <p className="font-mono text-xs font-semibold text-gray-900">{ticket.ticket_number}</p>
                      <p className="text-[11px] text-gray-500">{ticket.messages_count} message{ticket.messages_count === 1 ? '' : 's'}</p>
                    </td>
                    <td className="px-3 py-2">
                      <p className="font-semibold text-gray-900">{ticket.user?.name}</p>
                      <p className="text-[11px] text-gray-500">{ticket.user?.phone}</p>
                    </td>
                    <td className="px-3 py-2">
                      <p className="max-w-[260px] truncate font-medium text-gray-900" title={ticket.subject}>{ticket.subject}</p>
                      {ticket.order && <p className="text-[11px] font-semibold text-indigo-600">{ticket.order.order_number}</p>}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-xs text-gray-600">{getCategoryLabel(ticket.category || '')}</td>
                    <td className="px-3 py-2">{getPriorityBadge(ticket.priority)}</td>
                    <td className="px-3 py-2">{getStatusBadge(ticket.status)}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-xs tabular-nums text-gray-500">{formatDateTime(ticket.updated_at)}</td>
                    <td className="px-3 py-2">
                      <div className="flex justify-end gap-0.5">
                        <Button variant="ghost" size="sm" title="View conversation" onClick={() => openViewModal(ticket)}><Eye className="h-3.5 w-3.5" /></Button>
                        <Button variant="ghost" size="sm" title="Reply" onClick={() => openReplyModal(ticket)}><MessageSquare className="h-3.5 w-3.5 text-indigo-600" /></Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {totalPages > 1 && <div className="mt-3 flex justify-end"><Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} /></div>}

      {/* View Modal */}
      <Modal isOpen={isViewModalOpen} onClose={() => setIsViewModalOpen(false)} title="Ticket details" size="lg">
        {selectedTicket && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="font-mono text-sm font-semibold text-gray-900">{selectedTicket.ticket_number}</p>
                <p className="text-xs text-gray-500">Opened {formatDateTime(selectedTicket.created_at)}</p>
              </div>
              <div className="flex gap-1.5">{getPriorityBadge(selectedTicket.priority)}{getStatusBadge(selectedTicket.status)}</div>
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <div className="rounded-lg border border-gray-200 bg-slate-50 p-3">
                <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-gray-500">Customer</p>
                <p className="font-semibold text-gray-900">{selectedTicket.user?.name}</p>
                <p className="text-xs text-gray-600">{selectedTicket.user?.email}</p>
              </div>
              <div className="rounded-lg border border-gray-200 bg-slate-50 p-3">
                <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-gray-500">Details</p>
                <p className="text-xs">Category: {getCategoryLabel(selectedTicket.category || '')}</p>
                {selectedTicket.order && <p className="text-xs">Order: <span className="font-semibold text-indigo-600">{selectedTicket.order.order_number}</span></p>}
                {selectedTicket.assigned_staff && <p className="text-xs">Assigned: {selectedTicket.assigned_staff.name}</p>}
              </div>
            </div>
            <div className="rounded-lg border border-gray-200 p-3">
              <p className="mb-1 text-sm font-semibold text-gray-900">{selectedTicket.subject}</p>
              <p className="whitespace-pre-wrap text-sm text-gray-600">{selectedTicket.description}</p>
            </div>
            <div>
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-gray-500">Conversation</p>
              <div className="max-h-72 space-y-3 overflow-y-auto rounded-lg bg-slate-50 p-3">
                {ticketMessages.length === 0 && <p className="text-center text-xs text-gray-500">No messages yet.</p>}
                {ticketMessages.map((msg) => (
                  <div key={msg.id} className={`flex gap-2.5 ${msg.is_staff ? 'flex-row-reverse' : ''}`}>
                    <div className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold ${msg.is_staff ? 'bg-indigo-600 text-white' : 'bg-gray-200 text-gray-700'}`}>{msg.user?.name?.charAt(0) || 'U'}</div>
                    <div className={`max-w-[80%] ${msg.is_staff ? 'text-right' : ''}`}>
                      <div className={`inline-block rounded-lg px-3 py-2 text-sm ${msg.is_staff ? 'bg-indigo-600 text-white' : 'bg-white text-gray-800 ring-1 ring-gray-200'}`}>{msg.message}</div>
                      <p className="mt-0.5 text-[11px] text-gray-500">{msg.user?.name} • {formatDateTime(msg.created_at)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-gray-100 pt-3">
              <div className="w-44">
                <Select options={TICKET_STATUSES.map(s => ({ value: s.value, label: s.label }))} value={selectedTicket.status} onChange={(e) => handleStatusChange(selectedTicket, e.target.value)} />
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setIsViewModalOpen(false)}>Close</Button>
                <Button onClick={() => { setIsViewModalOpen(false); openReplyModal(selectedTicket); }}><MessageSquare className="mr-2 h-4 w-4" />Reply</Button>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* Reply Modal */}
      <Modal isOpen={isReplyModalOpen} onClose={() => setIsReplyModalOpen(false)} title="Reply to ticket">
        {selectedTicket && (
          <div className="space-y-4">
            <div className="rounded-lg border border-gray-200 bg-slate-50 p-3">
              <p className="font-mono text-xs text-gray-500">{selectedTicket.ticket_number}</p>
              <p className="font-semibold text-gray-900">{selectedTicket.subject}</p>
              <p className="text-xs text-gray-600">From {selectedTicket.user?.name}</p>
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-gray-500">Your reply</label>
              <textarea value={replyMessage} onChange={(e) => setReplyMessage(e.target.value)} className={`${TEXTAREA} h-28`} placeholder="Type your reply…" />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-gray-500">Set status</label>
              <Select options={TICKET_STATUSES.map(s => ({ value: s.value, label: s.label }))} value={newStatus} onChange={(e) => setNewStatus(e.target.value)} />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setIsReplyModalOpen(false)}>Cancel</Button>
              <Button onClick={handleReply} isLoading={isSaving} disabled={!replyMessage.trim()}><Send className="mr-2 h-4 w-4" />Send reply</Button>
            </div>
          </div>
        )}
      </Modal>
    </AdminLayout>
  );
}
