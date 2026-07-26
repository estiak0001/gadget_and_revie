'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/stores/auth-store';
import { ticketService } from '@/lib/api/ticket';
import { Ticket, TicketMessage } from '@/lib/types';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import {
  ArrowLeftIcon,
  PaperAirplaneIcon,
  CheckCircleIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  XMarkIcon,
  UserCircleIcon,
  ShieldCheckIcon,
} from '@heroicons/react/24/outline';

const statusConfig: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  open: { label: 'Open', color: 'bg-blue-100 text-blue-800', icon: ClockIcon },
  in_progress: { label: 'In Progress', color: 'bg-yellow-100 text-yellow-800', icon: ExclamationTriangleIcon },
  waiting_vendor: { label: 'Awaiting Response', color: 'bg-gray-200 text-gray-800', icon: ClockIcon },
  waiting_customer: { label: 'Awaiting Your Reply', color: 'bg-purple-100 text-purple-800', icon: ExclamationTriangleIcon },
  resolved: { label: 'Resolved', color: 'bg-green-100 text-green-800', icon: CheckCircleIcon },
  closed: { label: 'Closed', color: 'bg-gray-100 text-gray-800', icon: XMarkIcon },
};

const priorityConfig: Record<string, { label: string; color: string }> = {
  low: { label: 'Low', color: 'bg-green-100 text-green-800' },
  medium: { label: 'Medium', color: 'bg-yellow-100 text-yellow-800' },
  high: { label: 'High', color: 'bg-red-100 text-red-800' },
};

const safeFormat = (dateValue: string | undefined | null, pattern: string): string => {
  if (!dateValue) return 'N/A';
  try {
    return format(new Date(dateValue), pattern);
  } catch {
    return 'N/A';
  }
};

export default function TicketDetailPage() {
  const params = useParams();
  const router = useRouter();
  const ticketId = Number(params.id);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { user, isAuthenticated } = useAuthStore();
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [loading, setLoading] = useState(true);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) return;
    fetchTicket();
  }, [isAuthenticated, ticketId]);

  useEffect(() => {
    scrollToBottom();
  }, [ticket?.messages]);

  const fetchTicket = async () => {
    setLoading(true);
    try {
      const data = await ticketService.getById(ticketId);
      setTicket(data);
    } catch (error: any) {
      toast.error('Failed to load ticket');
      router.push('/dashboard');
    } finally {
      setLoading(false);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || sending) return;

    setSending(true);
    try {
      const updatedTicket = await ticketService.addMessage(ticketId, {
        message: newMessage.trim(),
      });
      setTicket(updatedTicket);
      setNewMessage('');
      toast.success('Message sent');
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Failed to send message');
    } finally {
      setSending(false);
    }
  };

  const handleCloseTicket = async () => {
    if (!confirm('Are you sure you want to close this ticket?')) return;

    setClosing(true);
    try {
      const updatedTicket = await ticketService.close(ticketId);
      setTicket(updatedTicket);
      toast.success('Ticket closed successfully');
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Failed to close ticket');
    } finally {
      setClosing(false);
    }
  };

  // Auth gate
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900">Please Login</h2>
          <p className="mt-2 text-gray-600">You need to be logged in to view tickets.</p>
          <button
            onClick={() => router.push('/auth/login')}
            className="mt-4 bg-ink text-white px-6 py-2 rounded-lg hover:bg-ink/90 transition"
          >
            Login
          </button>
        </div>
      </div>
    );
  }

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-4xl mx-auto px-4">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-gray-200 rounded w-1/3" />
            <div className="bg-white rounded-lg shadow p-6 space-y-4">
              <div className="h-6 bg-gray-200 rounded w-2/3" />
              <div className="h-4 bg-gray-200 rounded w-1/4" />
              <div className="space-y-3 mt-6">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-20 bg-gray-100 rounded" />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!ticket) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900">Ticket Not Found</h2>
          <p className="mt-2 text-gray-600">The ticket you&apos;re looking for doesn&apos;t exist.</p>
          <button
            onClick={() => router.push('/dashboard')}
            className="mt-4 bg-ink text-white px-6 py-2 rounded-lg hover:bg-ink/90 transition"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  const status = statusConfig[ticket.status] || statusConfig.open;
  const priority = priorityConfig[ticket.priority] || priorityConfig.medium;
  const isClosed = ticket.status === 'closed' || ticket.status === 'resolved';
  const StatusIcon = status.icon;

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-6">
          <button
            onClick={() => router.push('/dashboard')}
            className="flex items-center text-sm text-gray-600 hover:text-gray-900 mb-4 transition"
          >
            <ArrowLeftIcon className="h-4 w-4 mr-1" />
            Back to Dashboard
          </button>

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{ticket.subject}</h1>
              <div className="mt-1 flex items-center gap-3 text-sm text-gray-500">
                <span>{ticket.ticket_number}</span>
                <span>&middot;</span>
                <span>Created {safeFormat(ticket.created_at, 'MMM d, yyyy h:mm a')}</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium ${status.color}`}>
                <StatusIcon className="h-3.5 w-3.5" />
                {status.label}
              </span>
              <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${priority.color}`}>
                {priority.label} Priority
              </span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Messages Section */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow">
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900">Conversation</h2>
              </div>

              {/* Messages List */}
              <div className="p-4 sm:p-6 space-y-4 max-h-[350px] sm:max-h-[500px] overflow-y-auto">
                {ticket.messages && ticket.messages.length > 0 ? (
                  ticket.messages.map((msg: TicketMessage) => {
                    const isCustomer = msg.sender?.role === 'customer' || msg.user_id === user?.id;
                    return (
                      <div
                        key={msg.id}
                        className={`flex ${isCustomer ? 'justify-end' : 'justify-start'}`}
                      >
                        <div
                          className={`max-w-[80%] rounded-lg p-4 ${isCustomer
                            ? 'bg-ink text-white'
                            : 'bg-gray-100 text-gray-900'
                            }`}
                        >
                          <div className="flex items-center gap-2 mb-1">
                            {isCustomer ? (
                              <UserCircleIcon className="h-4 w-4" />
                            ) : (
                              <ShieldCheckIcon className="h-4 w-4" />
                            )}
                            <span className={`text-xs font-medium ${isCustomer ? 'text-white/70' : 'text-gray-500'}`}>
                              {msg.sender?.name || (isCustomer ? 'You' : 'Support')}
                            </span>
                            <span className={`text-xs ${isCustomer ? 'text-white/70' : 'text-gray-400'}`}>
                              {safeFormat(msg.created_at, 'MMM d, h:mm a')}
                            </span>
                          </div>
                          <p className="text-sm whitespace-pre-wrap">{msg.message}</p>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <p>No messages yet. Start the conversation below.</p>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Message Input */}
              {!isClosed ? (
                <div className="px-6 py-4 border-t border-gray-200">
                  <form onSubmit={handleSendMessage} className="flex gap-3">
                    <input
                      type="text"
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      placeholder="Type your message..."
                      className="flex-1 border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-ink focus:border-ink"
                      disabled={sending}
                    />
                    <button
                      type="submit"
                      disabled={sending || !newMessage.trim()}
                      className="inline-flex items-center px-4 py-2.5 bg-ink text-white rounded-lg hover:bg-ink/90 disabled:opacity-50 disabled:cursor-not-allowed transition"
                    >
                      {sending ? (
                        <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                      ) : (
                        <PaperAirplaneIcon className="h-5 w-5" />
                      )}
                    </button>
                  </form>
                </div>
              ) : (
                <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 text-center">
                  <p className="text-sm text-gray-500">
                    This ticket is {ticket.status}. You cannot send more messages.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Ticket Info */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider mb-4">
                Ticket Details
              </h3>
              <dl className="space-y-3">
                <div>
                  <dt className="text-xs text-gray-500">Ticket Number</dt>
                  <dd className="text-sm font-medium text-gray-900">{ticket.ticket_number}</dd>
                </div>
                <div>
                  <dt className="text-xs text-gray-500">Status</dt>
                  <dd>
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${status.color}`}>
                      <StatusIcon className="h-3 w-3" />
                      {status.label}
                    </span>
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-gray-500">Priority</dt>
                  <dd>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${priority.color}`}>
                      {priority.label}
                    </span>
                  </dd>
                </div>
                {ticket.order && (
                  <div>
                    <dt className="text-xs text-gray-500">Related Order</dt>
                    <dd className="text-sm font-medium text-ink">
                      {ticket.order.order_number}
                    </dd>
                  </div>
                )}
                <div>
                  <dt className="text-xs text-gray-500">Created</dt>
                  <dd className="text-sm text-gray-900">
                    {safeFormat(ticket.created_at, 'MMM d, yyyy h:mm a')}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-gray-500">Last Updated</dt>
                  <dd className="text-sm text-gray-900">
                    {safeFormat(ticket.updated_at, 'MMM d, yyyy h:mm a')}
                  </dd>
                </div>
              </dl>
            </div>

            {/* Actions */}
            {!isClosed && (
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider mb-4">
                  Actions
                </h3>
                <button
                  onClick={handleCloseTicket}
                  disabled={closing}
                  className="w-full px-4 py-2.5 border border-red-300 text-red-700 rounded-lg hover:bg-red-50 text-sm font-medium disabled:opacity-50 transition"
                >
                  {closing ? 'Closing...' : 'Close Ticket'}
                </button>
                <p className="mt-2 text-xs text-gray-500">
                  Close this ticket if your issue has been resolved.
                </p>
              </div>
            )}

            {/* Quick Links */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider mb-4">
                Quick Links
              </h3>
              <div className="space-y-2">
                <button
                  onClick={() => router.push('/support/new')}
                  className="w-full text-left text-sm text-gray-700 hover:text-ink transition"
                >
                  Create New Ticket
                </button>
                <button
                  onClick={() => router.push('/dashboard')}
                  className="w-full text-left text-sm text-gray-700 hover:text-ink transition"
                >
                  View All Tickets
                </button>
                <button
                  onClick={() => router.push('/contact')}
                  className="w-full text-left text-sm text-gray-700 hover:text-ink transition"
                >
                  Contact Support
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
