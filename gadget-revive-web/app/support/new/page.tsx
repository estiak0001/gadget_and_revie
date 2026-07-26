'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/stores/auth-store';
import { ticketService } from '@/lib/api/ticket';
import { orderService } from '@/lib/api/order';
import toast from 'react-hot-toast';
import {
  ExclamationTriangleIcon,
  InformationCircleIcon,
  QuestionMarkCircleIcon,
  TicketIcon,
  CheckCircleIcon,
} from '@heroicons/react/24/outline';

const priorities = [
  { value: 'low' as const, label: 'Low', color: 'text-green-600 bg-green-50 border-green-200', icon: InformationCircleIcon },
  { value: 'medium' as const, label: 'Medium', color: 'text-yellow-600 bg-yellow-50 border-yellow-200', icon: ExclamationTriangleIcon },
  { value: 'high' as const, label: 'High', color: 'text-gray-900 bg-red-50 border-red-200', icon: ExclamationTriangleIcon },
];

interface OrderOption {
  id: number;
  order_number: string;
}

export default function NewTicketPage() {
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [priority, setPriority] = useState<'low' | 'medium' | 'high'>('medium');
  const [orderId, setOrderId] = useState<number | undefined>(undefined);
  const [orders, setOrders] = useState<OrderOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [success, setSuccess] = useState(false);
  const [createdTicketNumber, setCreatedTicketNumber] = useState('');

  const { user, isAuthenticated } = useAuthStore();
  const router = useRouter();

  // Fetch user's orders for the optional order_id dropdown
  useEffect(() => {
    if (!isAuthenticated) return;
    const fetchOrders = async () => {
      setLoadingOrders(true);
      try {
        const response = await orderService.getMyOrders({ per_page: 50 });
        setOrders(
          (response.data || []).map((o: any) => ({
            id: o.id,
            order_number: o.order_number || `Order #${o.id}`,
          }))
        );
      } catch {
        // Non-critical, just won't show order dropdown
      } finally {
        setLoadingOrders(false);
      }
    };
    fetchOrders();
  }, [isAuthenticated]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isAuthenticated || !user) {
      toast.error('Please login to create a ticket');
      router.push('/auth/login');
      return;
    }

    if (!subject.trim() || !message.trim()) {
      toast.error('Please fill in all required fields');
      return;
    }

    setLoading(true);

    try {
      const ticket = await ticketService.create({
        subject: subject.trim(),
        message: message.trim(),
        priority,
        order_id: orderId,
      });

      setCreatedTicketNumber(ticket.ticket_number || `#${ticket.id}`);
      setSuccess(true);
      toast.success('Support ticket created successfully!');
    } catch (error: any) {
      const msg =
        error?.response?.data?.message || 'Failed to create ticket. Please try again.';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  // Auth gate
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <TicketIcon className="mx-auto h-12 w-12 text-gray-400" />
          <h2 className="mt-4 text-2xl font-bold text-gray-900">Please Login</h2>
          <p className="mt-2 text-gray-600">
            You need to be logged in to create a support ticket.
          </p>
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

  // Success screen
  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center max-w-md mx-auto px-4">
          <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-green-100 mb-6">
            <CheckCircleIcon className="h-10 w-10 text-green-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900">Ticket Created!</h2>
          <p className="mt-2 text-gray-600">
            Your support ticket <span className="font-semibold text-ink">{createdTicketNumber}</span> has been created successfully.
          </p>
          <p className="mt-1 text-sm text-gray-500">
            Our support team will review your ticket and respond as soon as possible.
          </p>
          <div className="mt-6 flex flex-col sm:flex-row gap-3 justify-center">
            <button
              onClick={() => router.push('/dashboard')}
              className="px-6 py-2 bg-ink text-white rounded-lg hover:bg-ink/90 transition"
            >
              Go to Dashboard
            </button>
            <button
              onClick={() => {
                setSuccess(false);
                setSubject('');
                setMessage('');
                setPriority('medium');
                setOrderId(undefined);
              }}
              className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition"
            >
              Create Another
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-6">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white shadow rounded-lg">
          <div className="px-6 py-8">
            <div className="text-center mb-5">
              <TicketIcon className="mx-auto h-10 w-10 text-ink" />
              <h1 className="mt-3 text-2xl font-bold text-gray-900">Create Support Ticket</h1>
              <p className="mt-2 text-gray-600">
                Need help? Create a support ticket and our team will get back to you.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Subject */}
              <div>
                <label htmlFor="subject" className="block text-sm font-medium text-gray-700">
                  Subject <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  id="subject"
                  required
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="mt-1 block w-full border border-gray-300 rounded-lg px-4 py-2.5 shadow-sm focus:ring-2 focus:ring-ink focus:border-ink"
                  placeholder="Brief description of your issue"
                />
              </div>

              {/* Related Order (optional) */}
              {orders.length > 0 && (
                <div>
                  <label htmlFor="order" className="block text-sm font-medium text-gray-700">
                    Related Order <span className="text-gray-400">(optional)</span>
                  </label>
                  <select
                    id="order"
                    value={orderId || ''}
                    onChange={(e) => setOrderId(e.target.value ? Number(e.target.value) : undefined)}
                    className="mt-1 block w-full border border-gray-300 rounded-lg px-4 py-2.5 shadow-sm focus:ring-2 focus:ring-ink focus:border-ink"
                  >
                    <option value="">No related order</option>
                    {orders.map((order) => (
                      <option key={order.id} value={order.id}>
                        {order.order_number}
                      </option>
                    ))}
                  </select>
                  <p className="mt-1 text-xs text-gray-500">
                    If your issue is related to an order, select it here for faster resolution.
                  </p>
                </div>
              )}

              {/* Priority */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Priority <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {priorities.map((p) => (
                    <label
                      key={p.value}
                      className={`relative flex cursor-pointer rounded-lg border p-4 focus:outline-none transition ${
                        priority === p.value
                          ? 'border-ink ring-2 ring-ink'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <input
                        type="radio"
                        name="priority"
                        value={p.value}
                        checked={priority === p.value}
                        onChange={() => setPriority(p.value)}
                        className="sr-only"
                      />
                      <div className="flex flex-col items-center w-full">
                        <p.icon className={`h-6 w-6 ${p.color.split(' ')[0]}`} />
                        <span className="mt-2 text-sm font-medium text-gray-900">
                          {p.label}
                        </span>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {/* Message */}
              <div>
                <label htmlFor="message" className="block text-sm font-medium text-gray-700">
                  Message <span className="text-red-500">*</span>
                </label>
                <textarea
                  id="message"
                  rows={6}
                  required
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  className="mt-1 block w-full border border-gray-300 rounded-lg px-4 py-2.5 shadow-sm focus:ring-2 focus:ring-ink focus:border-ink"
                  placeholder="Please provide detailed information about your issue. Include any error messages, device information, and steps to reproduce the problem..."
                />
                <p className="mt-2 text-sm text-gray-500">
                  Be as specific as possible for faster resolution.
                </p>
              </div>

              {/* Submit */}
              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => router.back()}
                  className="px-5 py-2.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-5 py-2.5 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-ink hover:bg-ink/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-ink disabled:opacity-50 disabled:cursor-not-allowed transition"
                >
                  {loading ? (
                    <span className="flex items-center gap-2">
                      <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Creating...
                    </span>
                  ) : (
                    'Create Ticket'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Help Section */}
        <div className="mt-5 bg-blue-50 border border-blue-200 rounded-lg p-6">
          <div className="flex">
            <div className="flex-shrink-0">
              <QuestionMarkCircleIcon className="h-5 w-5 text-blue-400" />
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-blue-800">Need immediate help?</h3>
              <div className="mt-2 text-sm text-blue-700">
                <p>For urgent issues, you can also contact us directly:</p>
                <ul className="mt-2 list-disc list-inside space-y-1">
                  <li>Phone: +880 1234-567890</li>
                  <li>Email: support@gadgetrevibe.com</li>
                  <li>Live Chat: Available Sat-Thu 10AM-8PM</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
