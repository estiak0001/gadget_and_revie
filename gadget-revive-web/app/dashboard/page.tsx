'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/lib/stores/auth-store';
import { useCartStore } from '@/lib/stores/cart-store';
import { orderService, ticketService, authService } from '@/lib/api';
import { Order, Ticket } from '@/lib/types';
import {
  UserIcon,
  ShoppingBagIcon,
  TicketIcon,
  ArrowRightOnRectangleIcon,
  PlusIcon,
  ShoppingCartIcon,
  HomeIcon,
  Cog6ToothIcon,
  EyeIcon,
  XCircleIcon,
  ArrowDownTrayIcon,
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

const statusColors: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  confirmed: 'bg-blue-100 text-blue-800',
  in_progress: 'bg-indigo-100 text-indigo-800',
  completed: 'bg-green-100 text-green-800',
  cancelled: 'bg-red-100 text-red-800',
  rejected: 'bg-red-100 text-red-800',
  open: 'bg-blue-100 text-blue-800',
  closed: 'bg-gray-100 text-gray-800',
  resolved: 'bg-green-100 text-green-800',
};

export default function DashboardPage() {
  const [activeTab, setActiveTab] = useState('overview');
  const { user, isAuthenticated, hasHydrated, logout, updateUser } = useAuthStore();
  const { getTotalItems } = useCartStore();
  const router = useRouter();

  const [orders, setOrders] = useState<Order[]>([]);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [ticketsLoading, setTicketsLoading] = useState(false);
  const [orderStats, setOrderStats] = useState({ total: 0, pending: 0, completed: 0 });
  const [ticketStats, setTicketStats] = useState({ total: 0, open: 0 });
  const [cancellingOrder, setCancellingOrder] = useState<number | null>(null);
  const [downloadingDashboardInvoice, setDownloadingDashboardInvoice] = useState<number | null>(null);

  // Settings form state
  const [profileName, setProfileName] = useState('');
  const [profileEmail, setProfileEmail] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);

  // Sync form with user when user loads or settings tab opens
  useEffect(() => {
    if (user) {
      setProfileName(user.name ?? '');
      setProfileEmail(user.email ?? '');
    }
  }, [user]);

  useEffect(() => {
    if (!hasHydrated) return;
    if (!isAuthenticated) {
      router.push('/auth/login');
    }
  }, [hasHydrated, isAuthenticated, router]);

  useEffect(() => {
    if (!hasHydrated || !isAuthenticated) return;
    loadOrders();
    loadTickets();
  }, [hasHydrated, isAuthenticated]);

  const loadOrders = async () => {
    try {
      setOrdersLoading(true);
      const result = await orderService.getMyOrders({ per_page: 50 });
      setOrders(result.data);
      setOrderStats({
        total: result.meta.total,
        pending: result.data.filter(o => (o.order_status || o.status) === 'pending').length,
        completed: result.data.filter(o => (o.order_status || o.status) === 'completed').length,
      });
    } catch (error) {
      console.error('Failed to load orders:', error);
    } finally {
      setOrdersLoading(false);
    }
  };

  const loadTickets = async () => {
    try {
      setTicketsLoading(true);
      const result = await ticketService.getMyTickets({ per_page: 50 });
      setTickets(result.data);
      setTicketStats({
        total: result.meta.total,
        open: result.data.filter(t => t.status === 'open' || t.status === 'in_progress').length,
      });
    } catch (error) {
      console.error('Failed to load tickets:', error);
    } finally {
      setTicketsLoading(false);
    }
  };

  const handleCancelOrder = async (orderId: number) => {
    const reason = prompt('Please provide a reason for cancellation:');
    if (!reason) return;
    try {
      setCancellingOrder(orderId);
      await orderService.cancel(orderId, reason);
      toast.success('Order cancelled');
      loadOrders();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Failed to cancel order');
    } finally {
      setCancellingOrder(null);
    }
  };

  const handleDownloadOrderInvoice = async (e: React.MouseEvent, order: Order) => {
    e.preventDefault();
    e.stopPropagation();
    setDownloadingDashboardInvoice(order.id);
    try {
      const blob = await orderService.downloadInvoice(order.id);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Invoice-${order.order_number}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success(`Invoice downloaded!`);
    } catch (error: any) {
      toast.error('Failed to download invoice. Please try again.');
    } finally {
      setDownloadingDashboardInvoice(null);
    }
  };

  const handleLogout = async () => {
    await logout();
    toast.success('Logged out successfully');
    router.push('/');
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSavingProfile(true);
      const updated = await authService.updateProfile({
        name: profileName.trim(),
        email: profileEmail.trim() || undefined,
      });
      updateUser(updated);
      toast.success('Profile updated successfully!');
    } catch (error: any) {
      const msg =
        error?.response?.data?.message ??
        error?.response?.data?.errors?.email?.[0] ??
        'Failed to update profile';
      toast.error(msg);
    } finally {
      setSavingProfile(false);
    }
  };

  if (!hasHydrated || !isAuthenticated || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-ink"></div>
      </div>
    );
  }

  const totalItems = getTotalItems();
  const navigation = [
    { id: 'overview', name: 'Overview', shortName: 'Home', icon: HomeIcon },
    { id: 'orders', name: 'Orders', shortName: 'Orders', icon: ShoppingBagIcon },
    { id: 'tickets', name: 'Support Tickets', shortName: 'Tickets', icon: TicketIcon },
    { id: 'settings', name: 'Settings', shortName: 'Settings', icon: Cog6ToothIcon },
  ];

  return (
    <div className="min-h-screen bg-gray-50 py-4 sm:py-8 pb-28 md:pb-8">
      <div className="max-w-[1800px] mx-auto px-3 sm:px-6 lg:px-8">
        <div className="flex gap-4">
          {/* Sidebar */}
          <aside className="hidden md:flex md:flex-shrink-0">
            <div className="flex flex-col w-20 lg:w-56">
              <div className="flex flex-col flex-grow bg-white rounded-xl border border-gray-200 shadow-md pt-5 pb-4 overflow-y-auto">
                <div className="flex items-center flex-shrink-0 px-4 mb-6">
                  <div className="lg:flex lg:items-center lg:space-x-3 hidden">
                    <div className="h-10 w-10 rounded-full bg-gradient-to-r from-ink to-ink flex items-center justify-center flex-shrink-0">
                      <UserIcon className="h-6 w-6 text-white" />
                    </div>
                    <div className="overflow-hidden">
                      <p className="text-sm font-semibold text-gray-900 truncate">{user.name}</p>
                      <p className="text-xs text-gray-500 truncate">{user.email ?? user.phone}</p>
                    </div>
                  </div>
                  <div className="lg:hidden flex justify-center w-full">
                    <div className="h-10 w-10 rounded-full bg-gradient-to-r from-ink to-ink flex items-center justify-center">
                      <UserIcon className="h-6 w-6 text-white" />
                    </div>
                  </div>
                </div>
                <nav className="flex-1 px-2 space-y-1">
                  {navigation.map((item) => (
                    <button key={item.id} onClick={() => setActiveTab(item.id)} className={`group flex items-center px-2 py-3 text-sm font-medium rounded-lg transition-all w-full ${activeTab === item.id ? 'bg-gradient-to-r from-ink to-ink text-white shadow-lg' : 'text-gray-700 hover:bg-gray-100'}`} title={item.name}>
                      <item.icon className={`flex-shrink-0 h-6 w-6 lg:mr-3 ${activeTab === item.id ? 'text-white' : 'text-gray-400 group-hover:text-gray-600'}`} />
                      <span className="hidden lg:block truncate">{item.name}</span>
                    </button>
                  ))}
                </nav>
                <div className="flex-shrink-0 flex border-t border-gray-200 p-2">
                  <button onClick={handleLogout} className="group flex items-center px-2 py-3 text-sm font-medium text-gray-700 rounded-lg hover:bg-red-50 hover:text-gray-900 transition-all w-full" title="Logout">
                    <ArrowRightOnRectangleIcon className="flex-shrink-0 h-6 w-6 lg:mr-3 text-gray-400 group-hover:text-gray-900" />
                    <span className="hidden lg:block">Logout</span>
                  </button>
                </div>
              </div>
            </div>
          </aside>

          {/* Main Content */}
          <main className="flex-1">
            {/* Mobile Header */}
            <div className="md:hidden bg-gradient-to-r from-ink to-ink rounded-xl shadow-lg p-4 mb-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="h-12 w-12 rounded-full bg-white/20 flex items-center justify-center border-2 border-white/30">
                    <UserIcon className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <h1 className="text-lg font-bold text-white">{user.name}</h1>
                    <p className="text-xs text-gray-200">{user.email ?? user.phone}</p>
                  </div>
                </div>
                <button onClick={handleLogout} className="p-2 bg-white/20 hover:bg-white/30 border border-white/30 rounded-lg text-white transition-all">
                  <ArrowRightOnRectangleIcon className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Mobile Tab Navigation */}
            <div className="md:hidden mb-4 -mx-3 px-3 overflow-x-auto scrollbar-none">
              <div className="flex gap-1.5 min-w-max pb-1">
                {navigation.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => setActiveTab(item.id)}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                      activeTab === item.id
                        ? 'bg-ink text-white shadow-md'
                        : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    <item.icon className="h-4 w-4" />
                    {item.shortName}
                  </button>
                ))}
              </div>
            </div>

            {/* Overview Tab */}
            {activeTab === 'overview' && (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 mb-6 sm:mb-5">
                  <div className="bg-white rounded-xl shadow-md p-4 sm:p-6 border border-gray-200">
                    <div className="flex items-center space-x-3 mb-3 sm:mb-4">
                      <div className="p-2 bg-gray-200 rounded-lg"><ShoppingCartIcon className="h-5 w-5 sm:h-6 sm:w-6 text-gray-900" /></div>
                      <div><p className="text-xs sm:text-sm text-gray-500">Cart Items</p><p className="text-xl sm:text-2xl font-bold text-gray-900">{totalItems}</p></div>
                    </div>
                    <Link href="/checkout" className="block text-center w-full px-4 py-2 bg-gray-100 text-gray-900 rounded-lg hover:bg-gray-200 font-medium transition-colors text-sm">View Cart</Link>
                  </div>
                  <div className="bg-white rounded-xl shadow-md p-4 sm:p-6 border border-gray-200">
                    <div className="flex items-center space-x-3 mb-3 sm:mb-4">
                      <div className="p-2 bg-green-100 rounded-lg"><ShoppingBagIcon className="h-5 w-5 sm:h-6 sm:w-6 text-green-600" /></div>
                      <div><p className="text-xs sm:text-sm text-gray-500">Total Orders</p><p className="text-xl sm:text-2xl font-bold text-gray-900">{orderStats.total}</p></div>
                    </div>
                    <button onClick={() => setActiveTab('orders')} className="block text-center w-full px-4 py-2 bg-green-50 text-green-600 rounded-lg hover:bg-green-100 font-medium transition-colors text-sm">View Orders</button>
                  </div>
                  <div className="bg-white rounded-xl shadow-md p-4 sm:p-6 border border-gray-200">
                    <div className="flex items-center space-x-3 mb-3 sm:mb-4">
                      <div className="p-2 bg-blue-100 rounded-lg"><TicketIcon className="h-5 w-5 sm:h-6 sm:w-6 text-blue-600" /></div>
                      <div><p className="text-xs sm:text-sm text-gray-500">Open Tickets</p><p className="text-xl sm:text-2xl font-bold text-gray-900">{ticketStats.open}</p></div>
                    </div>
                    <Link href="/support/new" className="block text-center w-full px-4 py-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 font-medium transition-colors text-sm">New Ticket</Link>
                  </div>
                </div>

                {/* Quick Actions */}
                <div className="bg-white rounded-xl shadow-md p-4 sm:p-6 border border-gray-200 mb-6 sm:mb-5">
                  <h2 className="text-lg sm:text-xl font-bold text-gray-900 mb-4 sm:mb-6">Quick Actions</h2>
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                    <Link href="/products" className="flex flex-col items-center justify-center p-3 sm:p-6 bg-gradient-to-br from-gray-100 to-red-50 rounded-xl hover:shadow-lg transition-all border border-gray-200 text-center">
                      <ShoppingBagIcon className="h-6 w-6 sm:h-8 sm:w-8 text-gray-900 mb-1.5 sm:mb-2" /><span className="text-xs sm:text-sm font-semibold text-gray-900 leading-tight">Browse Products</span>
                    </Link>
                    <Link href="/services" className="flex flex-col items-center justify-center p-3 sm:p-6 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl hover:shadow-lg transition-all border border-blue-100 text-center">
                      <Cog6ToothIcon className="h-6 w-6 sm:h-8 sm:w-8 text-blue-600 mb-1.5 sm:mb-2" /><span className="text-xs sm:text-sm font-semibold text-gray-900 leading-tight">Find Services</span>
                    </Link>
                    <Link href="/support/new" className="flex flex-col items-center justify-center p-3 sm:p-6 bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl hover:shadow-lg transition-all border border-green-100 text-center">
                      <TicketIcon className="h-6 w-6 sm:h-8 sm:w-8 text-green-600 mb-1.5 sm:mb-2" /><span className="text-xs sm:text-sm font-semibold text-gray-900 leading-tight">Get Support</span>
                    </Link>
                    <Link href="/checkout" className="flex flex-col items-center justify-center p-3 sm:p-6 bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl hover:shadow-lg transition-all border border-purple-100 text-center">
                      <ShoppingCartIcon className="h-6 w-6 sm:h-8 sm:w-8 text-purple-600 mb-1.5 sm:mb-2" /><span className="text-xs sm:text-sm font-semibold text-gray-900 leading-tight">Checkout</span>
                    </Link>
                  </div>
                </div>

                {/* Recent Orders */}
                <div className="bg-white rounded-xl shadow-md p-6 border border-gray-200 mb-5">
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-bold text-gray-900">Recent Orders</h2>
                    <button onClick={() => setActiveTab('orders')} className="text-gray-900 hover:text-gray-600 font-semibold text-sm">View All &rarr;</button>
                  </div>
                  {orders.length === 0 ? (
                    <div className="text-center py-8"><p className="text-gray-500">No orders yet</p></div>
                  ) : (
                    <div className="space-y-3">
                      {orders.slice(0, 5).map((order) => (
                        <Link key={order.id} href={`/orders/${order.id}`} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors cursor-pointer">
                          <div>
                            <p className="font-semibold text-gray-900">{order.order_number}</p>
                            <p className="text-sm text-gray-500">{new Date(order.created_at).toLocaleDateString()}</p>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-sm font-bold text-gray-900">৳{order.total || order.total_amount}</span>
                            <span className={`px-2 py-1 rounded-full text-xs font-semibold ${statusColors[(order.order_status || order.status) as string] || 'bg-gray-100 text-gray-800'}`}>{(order.order_status || order.status || '').replace('_', ' ')}</span>
                          </div>
                        </Link>
                      ))}
                    </div>
                  )}
                </div>

                {/* Account Info */}
                <div className="bg-white rounded-xl shadow-md p-6 border border-gray-200">
                  <h2 className="text-lg font-bold text-gray-900 mb-4">Account Information</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div><p className="text-sm text-gray-500 mb-1">Member Since</p><p className="text-base font-semibold text-gray-900">{user.created_at ? new Date(user.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : 'N/A'}</p></div>
                    <div><p className="text-sm text-gray-500 mb-1">Account Status</p><p className="text-base font-semibold text-green-600">Active</p></div>
                  </div>
                </div>
              </>
            )}

            {/* Orders Tab */}
            {activeTab === 'orders' && (
              <div className="bg-white rounded-xl shadow-md p-6 border border-gray-200">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-bold text-gray-900">My Orders</h2>
                  <Link href="/products" className="flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-ink to-ink text-white rounded-lg hover:shadow-lg transition-all font-medium text-sm">
                    <PlusIcon className="h-4 w-4" /><span>Shop More</span>
                  </Link>
                </div>

                {ordersLoading ? (
                  <div className="flex justify-center py-6"><div className="animate-spin h-8 w-8 border-4 border-ink border-t-transparent rounded-full"></div></div>
                ) : orders.length === 0 ? (
                  <div className="text-center py-6">
                    <ShoppingBagIcon className="mx-auto h-16 w-16 text-gray-300" />
                    <h3 className="mt-4 text-xl font-semibold text-gray-900">No Orders Yet</h3>
                    <p className="mt-2 text-gray-500">Start shopping to see your orders here.</p>
                    <Link href="/products" className="mt-6 inline-flex items-center px-6 py-3 bg-gradient-to-r from-ink to-ink text-white rounded-lg hover:shadow-lg transition-all font-medium">Start Shopping</Link>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {orders.map((order) => (
                      <Link key={order.id} href={`/orders/${order.id}`} className="block border border-gray-200 rounded-xl p-4 sm:p-5 hover:shadow-md transition-shadow">
                        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2 mb-3">
                          <div className="min-w-0">
                            <p className="font-bold text-gray-900 text-base sm:text-lg truncate">{order.order_number}</p>
                            <p className="text-sm text-gray-500">{new Date(order.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
                          </div>
                          <div className="text-right">
                            <span className={`px-3 py-1 rounded-full text-xs font-semibold ${statusColors[(order.order_status || order.status) as string] || 'bg-gray-100 text-gray-800'}`}>{((order.order_status || order.status) as string || 'N/A').replace('_', ' ')}</span>
                            <p className="text-lg font-bold text-gray-900 mt-1">৳{order.total || order.total_amount}</p>
                          </div>
                        </div>
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-sm">
                          <div className="flex items-center gap-2 sm:gap-4 flex-wrap">
                            <span className="text-gray-600 text-xs sm:text-sm">Payment: <span className="font-medium">{order.payment_method}</span></span>
                            <span className={`px-2 py-0.5 rounded text-xs font-medium ${order.payment_status === 'paid' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>{order.payment_status}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            {(order.order_status || order.status) === 'pending' && (
                              <button onClick={(e) => { e.preventDefault(); handleCancelOrder(order.id); }} disabled={cancellingOrder === order.id} className="text-gray-900 hover:text-red-700 font-medium flex items-center gap-1 text-xs">
                                <XCircleIcon className="h-4 w-4" />{cancellingOrder === order.id ? 'Cancelling...' : 'Cancel'}
                              </button>
                            )}
                            <button
                              onClick={(e) => handleDownloadOrderInvoice(e, order)}
                              disabled={downloadingDashboardInvoice === order.id}
                              className="flex items-center gap-1 text-xs text-orange-600 hover:text-orange-800 font-medium disabled:opacity-50 transition"
                              title="Download Invoice PDF"
                            >
                              <ArrowDownTrayIcon className="h-4 w-4" />
                              {downloadingDashboardInvoice === order.id ? 'Generating...' : 'Invoice'}
                            </button>
                          </div>
                        </div>
                        {order.items && order.items.length > 0 && (
                          <div className="mt-3 pt-3 border-t border-gray-100">
                            <p className="text-xs text-gray-500 mb-1">Items:</p>
                            {order.items.map((item) => (
                              <p key={item.id} className="text-sm text-gray-700">
                                {item.item_name || item.product?.name || item.service?.name || 'Item'} × {item.quantity} — ৳{item.total_price || item.subtotal}
                              </p>
                            ))}
                          </div>
                        )}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Tickets Tab */}
            {activeTab === 'tickets' && (
              <div className="bg-white rounded-xl shadow-md p-6 border border-gray-200">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-bold text-gray-900">Support Tickets</h2>
                  <Link href="/support/new" className="flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-ink to-ink text-white rounded-lg hover:shadow-lg transition-all font-medium text-sm">
                    <PlusIcon className="h-4 w-4" /><span>New Ticket</span>
                  </Link>
                </div>
                {ticketsLoading ? (
                  <div className="flex justify-center py-6"><div className="animate-spin h-8 w-8 border-4 border-ink border-t-transparent rounded-full"></div></div>
                ) : tickets.length === 0 ? (
                  <div className="text-center py-6">
                    <TicketIcon className="mx-auto h-16 w-16 text-gray-300" />
                    <h3 className="mt-4 text-xl font-semibold text-gray-900">No Tickets Yet</h3>
                    <p className="mt-2 text-gray-500">Create a ticket to get help.</p>
                    <Link href="/support/new" className="mt-6 inline-flex items-center px-6 py-3 bg-gradient-to-r from-ink to-ink text-white rounded-lg hover:shadow-lg transition-all font-medium">Create Ticket</Link>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {tickets.map((ticket) => (
                      <Link key={ticket.id} href={`/support/${ticket.id}`} className="block border border-gray-200 rounded-xl p-5 hover:shadow-md transition-shadow">
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="font-bold text-gray-900">{ticket.subject}</p>
                            <p className="text-sm text-gray-500 mt-1">{ticket.ticket_number} • {new Date(ticket.created_at).toLocaleDateString()}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`px-3 py-1 rounded-full text-xs font-semibold ${statusColors[ticket.status] || 'bg-gray-100 text-gray-800'}`}>{ticket.status}</span>
                            <span className={`px-2 py-1 rounded text-xs font-medium ${ticket.priority === 'high' ? 'bg-red-100 text-red-700' : ticket.priority === 'medium' ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-700'}`}>{ticket.priority}</span>
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Settings Tab */}
            {activeTab === 'settings' && (
              <div className="bg-white rounded-xl shadow-md p-6 border border-gray-200">
                <h2 className="text-xl font-bold text-gray-900 mb-2">Account Settings</h2>
                <p className="text-sm text-gray-500 mb-6">Update your personal information below.</p>

                <form onSubmit={handleUpdateProfile} className="space-y-5">
                  {/* Full Name */}
                  <div>
                    <label htmlFor="profile-name" className="block text-sm font-semibold text-gray-700 mb-2">
                      Full Name
                    </label>
                    <input
                      id="profile-name"
                      type="text"
                      value={profileName}
                      onChange={(e) => setProfileName(e.target.value)}
                      required
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg bg-white text-gray-900 font-medium focus:outline-none focus:border-ink transition-colors"
                      placeholder="Your full name"
                    />
                  </div>

                  {/* Email Address */}
                  <div>
                    <label htmlFor="profile-email" className="block text-sm font-semibold text-gray-700 mb-2">
                      Email Address <span className="text-gray-400 font-normal">(optional)</span>
                    </label>
                    <input
                      id="profile-email"
                      type="email"
                      value={profileEmail}
                      onChange={(e) => setProfileEmail(e.target.value)}
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg bg-white text-gray-900 font-medium focus:outline-none focus:border-ink transition-colors"
                      placeholder="your@email.com"
                    />
                  </div>

                  {/* Phone Number — read-only */}
                  {user.phone && (
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Phone Number</label>
                      <input
                        type="tel"
                        value={user.phone}
                        disabled
                        className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg bg-gray-50 text-gray-500 font-medium cursor-not-allowed"
                      />
                      <p className="mt-1 text-xs text-gray-400">Phone number cannot be changed here.</p>
                    </div>
                  )}

                  {/* Save Button */}
                  <div className="pt-2">
                    <button
                      id="save-profile-btn"
                      type="submit"
                      disabled={savingProfile}
                      className="w-full sm:w-auto px-8 py-3 bg-gradient-to-r from-ink to-ink text-white font-semibold rounded-lg hover:shadow-lg transition-all disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                      {savingProfile ? (
                        <><span className="inline-block h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Saving...</>
                      ) : 'Save Changes'}
                    </button>
                  </div>
                </form>

                {/* Member Since */}
                <div className="mt-5 pt-6 border-t border-gray-200">
                  <p className="text-sm text-gray-500 mb-1">Member Since</p>
                  <p className="text-base font-semibold text-gray-900">
                    {user.created_at ? new Date(user.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : 'N/A'}
                  </p>
                </div>
              </div>
            )}

            {/* Mobile Navigation */}
            <nav
              className="md:hidden fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-gray-200 shadow-[0_-2px_12px_rgba(0,0,0,0.06)] z-50"
              style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
              aria-label="Dashboard navigation"
            >
              <ul className="grid grid-cols-4">
                {navigation.map((item) => {
                  const active = activeTab === item.id;
                  return (
                    <li key={item.id}>
                      <button
                        type="button"
                        onClick={() => setActiveTab(item.id)}
                        aria-current={active ? 'page' : undefined}
                        // min-h 56px keeps each tab a comfortable 44pt+ tap
                        // target on iOS without inflating the dock's overall
                        // height; the active state is a narrow top bar + tint
                        // instead of a full gradient fill.
                        className={`relative w-full flex flex-col items-center justify-center gap-0.5 min-h-[56px] px-1 pt-2 pb-1.5 transition-colors ${
                          active ? 'text-gray-900' : 'text-gray-500 hover:text-gray-800'
                        }`}
                      >
                        {active && (
                          <span className="absolute top-0 left-1/2 -translate-x-1/2 h-0.5 w-8 rounded-full bg-ink" aria-hidden="true" />
                        )}
                        <item.icon className={`h-5 w-5 ${active ? 'text-gray-900' : 'text-gray-500'}`} />
                        <span className={`text-[11px] leading-none tracking-tight ${active ? 'font-semibold' : 'font-medium'}`}>
                          {item.shortName}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </nav>
          </main>
        </div>
      </div>
    </div>
  );
}
