'use client';

import React, { useEffect, useState } from 'react';
import { Search, Eye, MessageSquare, Clock, CheckCircle, AlertCircle, Send, User, Headphones } from 'lucide-react';
import { AdminLayout } from '@/components/layout';
import {
  Card, CardContent, CardHeader, CardTitle, Button, Input, Select, Modal,
  Badge, LoadingSpinner, Pagination, EmptyState, ErrorState,
} from '@/components/ui';
import { Ticket, TicketMessage, PaginatedResponse } from '@/types';
import { formatDateTime, getErrorMessage } from '@/lib/utils';
import adminService from '@/lib/adminService';
import toast from 'react-hot-toast';

const TICKET_CATEGORIES = [
  { value: 'order', label: 'Order Issue' }, { value: 'payment', label: 'Payment Issue' },
  { value: 'refund', label: 'Refund Request' }, { value: 'service', label: 'Service Complaint' },
  { value: 'vendor', label: 'Vendor Complaint' }, { value: 'technical', label: 'Technical Issue' },
  { value: 'account', label: 'Account Issue' }, { value: 'general', label: 'General Inquiry' },
];

const TICKET_PRIORITIES = [
  { value: 'low', label: 'Low', color: 'default' }, { value: 'medium', label: 'Medium', color: 'warning' },
  { value: 'high', label: 'High', color: 'danger' }, { value: 'urgent', label: 'Urgent', color: 'danger' },
];

const TICKET_STATUSES = [
  { value: 'open', label: 'Open', color: 'warning' }, { value: 'in-progress', label: 'In Progress', color: 'default' },
  { value: 'waiting', label: 'Waiting for Customer', color: 'default' }, { value: 'resolved', label: 'Resolved', color: 'success' },
  { value: 'closed', label: 'Closed', color: 'default' },
];

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
    return <Badge variant={c?.color as 'success' | 'warning' | 'danger' | 'default' || 'default'}>{c?.label || status}</Badge>;
  };
  const getPriorityBadge = (priority: string) => {
    const c = TICKET_PRIORITIES.find(p => p.value === priority);
    return <Badge variant={c?.color as 'success' | 'warning' | 'danger' | 'default' || 'default'}>{c?.label || priority}</Badge>;
  };
  const getCategoryLabel = (cat: string) => TICKET_CATEGORIES.find(c => c.value === cat)?.label || cat;

  if (error && tickets.length === 0) {
    return (<AdminLayout><ErrorState title="Failed to load tickets" onRetry={fetchTickets} /></AdminLayout>);
  }

  return (
    <AdminLayout>
      <div className="page-header"><h1 className="page-title">Support Tickets</h1><p className="page-description">Manage customer support requests</p></div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        {[
          { label: 'Open', count: tickets.filter(t => t.status === 'open').length, icon: <AlertCircle className="w-5 h-5 text-yellow-600" />, bg: 'bg-yellow-100' },
          { label: 'In Progress', count: tickets.filter(t => t.status === 'in-progress').length, icon: <Clock className="w-5 h-5 text-blue-600" />, bg: 'bg-blue-100' },
          { label: 'Waiting', count: tickets.filter(t => t.status === 'waiting').length, icon: <User className="w-5 h-5 text-orange-600" />, bg: 'bg-orange-100' },
          { label: 'Resolved', count: tickets.filter(t => t.status === 'resolved').length, icon: <CheckCircle className="w-5 h-5 text-green-600" />, bg: 'bg-green-100' },
          { label: 'Urgent', count: tickets.filter(t => t.priority === 'urgent').length, icon: <AlertCircle className="w-5 h-5 text-red-600" />, bg: 'bg-red-100' },
        ].map(s => (
          <Card key={s.label}><CardContent className="p-4"><div className="flex items-center gap-3"><div className={`w-10 h-10 ${s.bg} rounded-lg flex items-center justify-center`}>{s.icon}</div><div><p className="text-xs text-gray-500">{s.label}</p><p className="text-xl font-bold">{s.count}</p></div></div></CardContent></Card>
        ))}
      </div>

      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1"><Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" /><Input placeholder="Search tickets..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSearch()} className="pl-10" /></div>
            <Select options={[{ value: '', label: 'All Status' }, ...TICKET_STATUSES.map(s => ({ value: s.value, label: s.label }))]} value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} />
            <Select options={[{ value: '', label: 'All Categories' }, ...TICKET_CATEGORIES.map(c => ({ value: c.value, label: c.label }))]} value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)} />
            <Select options={[{ value: '', label: 'All Priority' }, ...TICKET_PRIORITIES.map(p => ({ value: p.value, label: p.label }))]} value={filterPriority} onChange={(e) => setFilterPriority(e.target.value)} />
            <Button onClick={handleSearch}>Search</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>All Tickets</CardTitle></CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12"><LoadingSpinner size="lg" text="Loading tickets..." /></div>
          ) : tickets.length === 0 ? (
            <EmptyState icon={<Headphones className="w-8 h-8 text-gray-400" />} title="No tickets found" />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-y">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Ticket</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Customer</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Subject</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Priority</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Updated</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {tickets.map((ticket) => (
                    <tr key={ticket.id} className={`hover:bg-gray-50 ${ticket.priority === 'urgent' ? 'bg-red-50' : ''}`}>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${ticket.status === 'open' ? 'bg-yellow-100' : ticket.status === 'resolved' ? 'bg-green-100' : 'bg-gray-100'}`}>
                            <Headphones className={`w-5 h-5 ${ticket.status === 'open' ? 'text-yellow-600' : ticket.status === 'resolved' ? 'text-green-600' : 'text-gray-600'}`} />
                          </div>
                          <div><p className="font-medium font-mono text-sm">{ticket.ticket_number}</p><p className="text-xs text-gray-500">{ticket.messages_count} messages</p></div>
                        </div>
                      </td>
                      <td className="px-6 py-4"><p className="font-medium">{ticket.user?.name}</p><p className="text-xs text-gray-500">{ticket.user?.phone}</p></td>
                      <td className="px-6 py-4"><p className="font-medium max-w-xs truncate">{ticket.subject}</p>{ticket.order && <p className="text-xs text-primary">{ticket.order.order_number}</p>}</td>
                      <td className="px-6 py-4 text-gray-600">{getCategoryLabel(ticket.category || '')}</td>
                      <td className="px-6 py-4">{getPriorityBadge(ticket.priority)}</td>
                      <td className="px-6 py-4">{getStatusBadge(ticket.status)}</td>
                      <td className="px-6 py-4 text-gray-600 text-sm">{formatDateTime(ticket.updated_at)}</td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-end gap-2">
                          <Button variant="ghost" size="sm" onClick={() => openViewModal(ticket)}><Eye className="w-4 h-4" /></Button>
                          <Button variant="ghost" size="sm" onClick={() => openReplyModal(ticket)}><MessageSquare className="w-4 h-4 text-blue-600" /></Button>
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

      {totalPages > 1 && <div className="mt-6"><Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} /></div>}

      {/* View Modal */}
      <Modal isOpen={isViewModalOpen} onClose={() => setIsViewModalOpen(false)} title="Ticket Details" size="lg">
        {selectedTicket && (
          <div className="space-y-6">
            <div className="flex items-start justify-between">
              <div><h3 className="font-mono font-medium">{selectedTicket.ticket_number}</h3><p className="text-sm text-gray-500">{formatDateTime(selectedTicket.created_at)}</p></div>
              <div className="flex gap-2">{getPriorityBadge(selectedTicket.priority)}{getStatusBadge(selectedTicket.status)}</div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-gray-50 p-4 rounded-lg"><p className="text-xs text-gray-500 mb-2">Customer</p><p className="font-medium">{selectedTicket.user?.name}</p><p className="text-sm text-gray-600">{selectedTicket.user?.email}</p></div>
              <div className="bg-gray-50 p-4 rounded-lg"><p className="text-xs text-gray-500 mb-2">Details</p><p className="text-sm">Category: {getCategoryLabel(selectedTicket.category || '')}</p>{selectedTicket.order && <p className="text-sm">Order: <span className="text-primary">{selectedTicket.order.order_number}</span></p>}{selectedTicket.assigned_staff && <p className="text-sm">Assigned: {selectedTicket.assigned_staff.name}</p>}</div>
            </div>
            <div><h4 className="font-medium mb-2">{selectedTicket.subject}</h4><p className="text-gray-600">{selectedTicket.description}</p></div>
            <div className="border-t pt-4">
              <p className="text-sm font-medium mb-4">Conversation</p>
              <div className="space-y-4 max-h-80 overflow-y-auto">
                {ticketMessages.map((msg) => (
                  <div key={msg.id} className={`flex gap-3 ${msg.is_staff ? 'flex-row-reverse' : ''}`}>
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${msg.is_staff ? 'bg-primary text-white' : 'bg-gray-200'}`}>{msg.user?.name?.charAt(0) || 'U'}</div>
                    <div className={`flex-1 max-w-[80%] ${msg.is_staff ? 'text-right' : ''}`}>
                      <div className={`inline-block p-3 rounded-lg ${msg.is_staff ? 'bg-primary text-white' : 'bg-gray-100'}`}><p className="text-sm">{msg.message}</p></div>
                      <p className="text-xs text-gray-500 mt-1">{msg.user?.name} • {formatDateTime(msg.created_at)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex justify-between items-center pt-4 border-t">
              <Select options={TICKET_STATUSES.map(s => ({ value: s.value, label: s.label }))} value={selectedTicket.status} onChange={(e) => handleStatusChange(selectedTicket, e.target.value)} className="w-40" />
              <div className="flex gap-3">
                <Button variant="outline" onClick={() => setIsViewModalOpen(false)}>Close</Button>
                <Button onClick={() => { setIsViewModalOpen(false); openReplyModal(selectedTicket); }}><MessageSquare className="w-4 h-4 mr-2" />Reply</Button>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* Reply Modal */}
      <Modal isOpen={isReplyModalOpen} onClose={() => setIsReplyModalOpen(false)} title="Reply to Ticket">
        {selectedTicket && (
          <div className="space-y-4">
            <div className="bg-gray-50 p-4 rounded-lg"><p className="text-xs text-gray-500">Ticket: {selectedTicket.ticket_number}</p><p className="font-medium">{selectedTicket.subject}</p><p className="text-sm text-gray-600">From: {selectedTicket.user?.name}</p></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Your Reply</label><textarea value={replyMessage} onChange={(e) => setReplyMessage(e.target.value)} className="w-full border rounded-lg p-3 h-32" placeholder="Type your reply..." /></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Update Status</label><Select options={TICKET_STATUSES.map(s => ({ value: s.value, label: s.label }))} value={newStatus} onChange={(e) => setNewStatus(e.target.value)} /></div>
            <div className="flex justify-end gap-3 pt-4"><Button variant="outline" onClick={() => setIsReplyModalOpen(false)}>Cancel</Button><Button onClick={handleReply} isLoading={isSaving} disabled={!replyMessage.trim()}><Send className="w-4 h-4 mr-2" />Send Reply</Button></div>
          </div>
        )}
      </Modal>
    </AdminLayout>
  );
}
