'use client';

import React, { useEffect, useState } from 'react';
import { Search, Plus, Bell, Send, Users, Eye, Trash2, AlertCircle, Info, CheckCircle, Megaphone, ShoppingCart, CreditCard } from 'lucide-react';
import { AdminLayout } from '@/components/layout';
import {
  Card, CardContent, CardHeader, CardTitle, Button, Input, Select, Modal,
  Badge, LoadingSpinner, Pagination, EmptyState, ErrorState, ConfirmModal,
} from '@/components/ui';
import { formatDateTime, getErrorMessage } from '@/lib/utils';
import adminService from '@/lib/adminService';
import toast from 'react-hot-toast';

interface Notification {
  id: number; title: string; message: string; type: string; channel: string;
  target_type: string; target_id?: number; link?: string; sent_at?: string;
  read_count: number; total_sent: number; created_at: string;
  created_by?: { id: number; name: string };
}

const NOTIFICATION_TYPES = [
  { value: 'info', label: 'Information', icon: Info, color: 'bg-blue-100 text-blue-600' },
  { value: 'success', label: 'Success', icon: CheckCircle, color: 'bg-green-100 text-green-600' },
  { value: 'warning', label: 'Warning', icon: AlertCircle, color: 'bg-yellow-100 text-yellow-600' },
  { value: 'promo', label: 'Promotion', icon: Megaphone, color: 'bg-purple-100 text-purple-600' },
  { value: 'order', label: 'Order Update', icon: ShoppingCart, color: 'bg-orange-100 text-orange-600' },
  { value: 'payment', label: 'Payment', icon: CreditCard, color: 'bg-green-100 text-green-600' },
];
const CHANNELS = [{ value: 'push', label: 'Push' }, { value: 'sms', label: 'SMS' }, { value: 'email', label: 'Email' }, { value: 'in-app', label: 'In-App' }];
const TARGET_TYPES = [{ value: 'all', label: 'All Users' }, { value: 'customers', label: 'All Customers' }, { value: 'vendors', label: 'All Vendors' }, { value: 'specific', label: 'Specific User' }];

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterChannel, setFilterChannel] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedNotification, setSelectedNotification] = useState<Notification | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState({ title: '', message: '', type: 'info', channel: 'push', target_type: 'all', target_id: '', link: '', schedule: '' });

  const fetchNotifications = async () => {
    setIsLoading(true);
    setError(false);
    try {
      const params: Record<string, string | number> = { page: currentPage };
      if (searchQuery) params.search = searchQuery;
      if (filterType) params.type = filterType;
      if (filterChannel) params.channel = filterChannel;
      const response = await adminService.getNotifications(params);
      const data = response.data?.data || response.data;
      if (Array.isArray(data)) { setNotifications(data); setTotalPages(1); }
      else { setNotifications(data.data || []); setTotalPages(data.meta?.last_page || 1); }
    } catch (err) {
      toast.error(getErrorMessage(err));
      setError(true);
      setNotifications([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchNotifications(); }, [currentPage, filterType, filterChannel]);
  const handleSearch = () => { setCurrentPage(1); fetchNotifications(); };

  const handleCreate = async () => {
    setIsSaving(true);
    try {
      await adminService.createNotification(formData);
      toast.success('Notification sent');
      setIsCreateModalOpen(false);
      fetchNotifications();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedNotification) return;
    try {
      await adminService.deleteNotification(selectedNotification.id);
      toast.success('Notification deleted');
      setIsDeleteModalOpen(false);
      fetchNotifications();
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const getTypeConfig = (type: string) => NOTIFICATION_TYPES.find(t => t.value === type) || NOTIFICATION_TYPES[0];

  const totalSent = notifications.reduce((s, n) => s + (n.total_sent || 0), 0);
  const totalRead = notifications.reduce((s, n) => s + (n.read_count || 0), 0);

  if (error && notifications.length === 0) {
    return (<AdminLayout><ErrorState title="Failed to load notifications" onRetry={fetchNotifications} /></AdminLayout>);
  }

  return (
    <AdminLayout>
      <div className="page-header flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div><h1 className="page-title">Notifications</h1><p className="page-description">Send and manage user notifications</p></div>
        <Button onClick={() => { setFormData({ title: '', message: '', type: 'info', channel: 'push', target_type: 'all', target_id: '', link: '', schedule: '' }); setIsCreateModalOpen(true); }}><Plus className="w-4 h-4 mr-2" />Send Notification</Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Card><CardContent className="p-4"><div className="flex items-center gap-3"><div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center"><Bell className="w-5 h-5 text-blue-600" /></div><div><p className="text-xs text-gray-500">Total Sent</p><p className="text-xl font-bold">{totalSent.toLocaleString()}</p></div></div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="flex items-center gap-3"><div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center"><Eye className="w-5 h-5 text-green-600" /></div><div><p className="text-xs text-gray-500">Total Read</p><p className="text-xl font-bold">{totalRead.toLocaleString()}</p></div></div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="flex items-center gap-3"><div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center"><Megaphone className="w-5 h-5 text-purple-600" /></div><div><p className="text-xs text-gray-500">Campaigns</p><p className="text-xl font-bold">{notifications.filter(n => n.target_type !== 'specific').length}</p></div></div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="flex items-center gap-3"><div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center"><Users className="w-5 h-5 text-orange-600" /></div><div><p className="text-xs text-gray-500">Read Rate</p><p className="text-xl font-bold">{totalSent > 0 ? ((totalRead / totalSent) * 100).toFixed(1) : 0}%</p></div></div></CardContent></Card>
      </div>

      <Card className="mb-6"><CardContent className="p-4"><div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1"><Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" /><Input placeholder="Search..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSearch()} className="pl-10" /></div>
        <Select options={[{ value: '', label: 'All Types' }, ...NOTIFICATION_TYPES.map(t => ({ value: t.value, label: t.label }))]} value={filterType} onChange={(e) => setFilterType(e.target.value)} />
        <Select options={[{ value: '', label: 'All Channels' }, ...CHANNELS.map(c => ({ value: c.value, label: c.label }))]} value={filterChannel} onChange={(e) => setFilterChannel(e.target.value)} />
        <Button onClick={handleSearch}>Search</Button>
      </div></CardContent></Card>

      <Card>
        <CardHeader><CardTitle>All Notifications</CardTitle></CardHeader>
        <CardContent className="p-0">
          {isLoading ? (<div className="flex items-center justify-center py-12"><LoadingSpinner size="lg" text="Loading..." /></div>
          ) : notifications.length === 0 ? (<EmptyState icon={<Bell className="w-8 h-8 text-gray-400" />} title="No notifications found" />
          ) : (
            <div className="overflow-x-auto"><table className="w-full"><thead className="bg-gray-50 border-y"><tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Notification</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Channel</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Target</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Stats</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Sent</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr></thead><tbody className="divide-y divide-gray-200">
              {notifications.map((n) => {
                const tc = getTypeConfig(n.type); const TI = tc.icon;
                return (<tr key={n.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4"><div className="flex items-start gap-3 max-w-md"><div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${tc.color}`}><TI className="w-5 h-5" /></div><div className="min-w-0"><p className="font-medium truncate">{n.title}</p><p className="text-sm text-gray-500 truncate">{n.message}</p></div></div></td>
                  <td className="px-6 py-4"><Badge variant="default">{tc.label}</Badge></td>
                  <td className="px-6 py-4 text-gray-600">{CHANNELS.find(c => c.value === n.channel)?.label}</td>
                  <td className="px-6 py-4 text-gray-600">{TARGET_TYPES.find(t => t.value === n.target_type)?.label}</td>
                  <td className="px-6 py-4"><div className="text-sm"><p><span className="text-gray-500">Sent:</span> {(n.total_sent || 0).toLocaleString()}</p><p><span className="text-gray-500">Read:</span> {(n.read_count || 0).toLocaleString()}</p></div></td>
                  <td className="px-6 py-4 text-gray-600 text-sm">{n.sent_at ? formatDateTime(n.sent_at) : 'Scheduled'}</td>
                  <td className="px-6 py-4"><div className="flex items-center justify-end gap-2">
                    <Button variant="ghost" size="sm" onClick={() => { setSelectedNotification(n); setIsViewModalOpen(true); }}><Eye className="w-4 h-4" /></Button>
                    <Button variant="ghost" size="sm" onClick={() => { setSelectedNotification(n); setIsDeleteModalOpen(true); }}><Trash2 className="w-4 h-4 text-red-600" /></Button>
                  </div></td>
                </tr>);
              })}
            </tbody></table></div>
          )}
        </CardContent>
      </Card>

      {totalPages > 1 && <div className="mt-6"><Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} /></div>}

      {/* Create Modal */}
      <Modal isOpen={isCreateModalOpen} onClose={() => setIsCreateModalOpen(false)} title="Send Notification" size="lg">
        <div className="space-y-4">
          <div><label className="block text-sm font-medium text-gray-700 mb-1">Title *</label><Input value={formData.title} onChange={(e) => setFormData({ ...formData, title: e.target.value })} /></div>
          <div><label className="block text-sm font-medium text-gray-700 mb-1">Message *</label><textarea value={formData.message} onChange={(e) => setFormData({ ...formData, message: e.target.value })} className="w-full border rounded-lg p-3 h-24" /></div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Type</label><Select value={formData.type} onChange={(e) => setFormData({ ...formData, type: e.target.value })} options={NOTIFICATION_TYPES.map(t => ({ value: t.value, label: t.label }))} /></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Channel</label><Select value={formData.channel} onChange={(e) => setFormData({ ...formData, channel: e.target.value })} options={CHANNELS.map(c => ({ value: c.value, label: c.label }))} /></div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Target</label><Select value={formData.target_type} onChange={(e) => setFormData({ ...formData, target_type: e.target.value })} options={TARGET_TYPES.map(t => ({ value: t.value, label: t.label }))} /></div>
            {formData.target_type === 'specific' && <div><label className="block text-sm font-medium text-gray-700 mb-1">User ID</label><Input value={formData.target_id} onChange={(e) => setFormData({ ...formData, target_id: e.target.value })} /></div>}
          </div>
          <div><label className="block text-sm font-medium text-gray-700 mb-1">Link (Optional)</label><Input value={formData.link} onChange={(e) => setFormData({ ...formData, link: e.target.value })} /></div>
          <div><label className="block text-sm font-medium text-gray-700 mb-1">Schedule (Optional)</label><Input type="datetime-local" value={formData.schedule} onChange={(e) => setFormData({ ...formData, schedule: e.target.value })} /><p className="text-xs text-gray-500 mt-1">Leave empty to send immediately</p></div>
          <div className="bg-gray-50 p-4 rounded-lg"><p className="text-xs text-gray-500 mb-2">Preview</p><div className="flex items-start gap-3"><div className={`w-10 h-10 rounded-lg flex items-center justify-center ${getTypeConfig(formData.type).color}`}>{React.createElement(getTypeConfig(formData.type).icon, { className: 'w-5 h-5' })}</div><div><p className="font-medium">{formData.title || 'Title'}</p><p className="text-sm text-gray-600">{formData.message || 'Message...'}</p></div></div></div>
          <div className="flex justify-end gap-3 pt-4"><Button variant="outline" onClick={() => setIsCreateModalOpen(false)}>Cancel</Button><Button onClick={handleCreate} isLoading={isSaving} disabled={!formData.title || !formData.message}><Send className="w-4 h-4 mr-2" />{formData.schedule ? 'Schedule' : 'Send Now'}</Button></div>
        </div>
      </Modal>

      {/* View Modal */}
      <Modal isOpen={isViewModalOpen} onClose={() => setIsViewModalOpen(false)} title="Notification Details">
        {selectedNotification && (
          <div className="space-y-6">
            <div className="flex items-start gap-4"><div className={`w-12 h-12 rounded-lg flex items-center justify-center ${getTypeConfig(selectedNotification.type).color}`}>{React.createElement(getTypeConfig(selectedNotification.type).icon, { className: 'w-6 h-6' })}</div><div><h3 className="font-medium text-lg">{selectedNotification.title}</h3><p className="text-gray-600 mt-1">{selectedNotification.message}</p></div></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-gray-50 p-4 rounded-lg"><p className="text-xs text-gray-500 mb-1">Type</p><p className="font-medium">{getTypeConfig(selectedNotification.type).label}</p></div>
              <div className="bg-gray-50 p-4 rounded-lg"><p className="text-xs text-gray-500 mb-1">Target</p><p className="font-medium">{TARGET_TYPES.find(t => t.value === selectedNotification.target_type)?.label}</p></div>
            </div>
            <div className="bg-blue-50 p-4 rounded-lg"><p className="text-sm font-medium text-blue-700 mb-2">Delivery Statistics</p><div className="grid grid-cols-3 gap-4">
              <div><p className="text-2xl font-bold text-blue-600">{(selectedNotification.total_sent || 0).toLocaleString()}</p><p className="text-xs text-blue-600">Sent</p></div>
              <div><p className="text-2xl font-bold text-green-600">{(selectedNotification.read_count || 0).toLocaleString()}</p><p className="text-xs text-green-600">Read</p></div>
              <div><p className="text-2xl font-bold text-gray-600">{selectedNotification.total_sent > 0 ? ((selectedNotification.read_count / selectedNotification.total_sent) * 100).toFixed(1) : 0}%</p><p className="text-xs text-gray-600">Read Rate</p></div>
            </div></div>
          </div>
        )}
      </Modal>

      <ConfirmModal isOpen={isDeleteModalOpen} onClose={() => setIsDeleteModalOpen(false)} onConfirm={handleDelete} title="Delete Notification" message="Are you sure you want to delete this notification?" variant="danger" />
    </AdminLayout>
  );
}
