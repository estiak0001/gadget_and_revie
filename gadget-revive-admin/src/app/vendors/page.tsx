'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { Search, Eye, Store, Star, MapPin, CheckCircle, XCircle } from 'lucide-react';
import { AdminLayout } from '@/components/layout';
import {
  Card, CardContent, CardHeader, CardTitle, Button, Input, Select,
  Modal, Badge, LoadingSpinner, Pagination, EmptyState, ErrorState,
} from '@/components/ui';
import { VendorProfile, PaginatedResponse } from '@/types';
import { formatDate, getErrorMessage } from '@/lib/utils';
import adminService from '@/lib/adminService';
import toast from 'react-hot-toast';
import Link from 'next/link';

export default function VendorsPage() {
  const [vendors, setVendors] = useState<VendorProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);
  const [selectedVendor, setSelectedVendor] = useState<VendorProfile | null>(null);
  const [newStatus, setNewStatus] = useState('');
  const [statusReason, setStatusReason] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const fetchVendors = useCallback(async () => {
    setIsLoading(true);
    setError(false);
    try {
      const params: Record<string, string | number> = { page: currentPage };
      if (searchQuery) params.search = searchQuery;
      if (filterStatus) params.status = filterStatus;

      const response = await adminService.getVendors(params);
      const data = response.data?.data || response.data;
      if (Array.isArray(data)) {
        setVendors(data);
        setTotalPages(1);
      } else {
        setVendors(data.data);
        setTotalPages(data.meta?.last_page || 1);
      }
    } catch (err) {
      console.error('Error fetching vendors:', err);
      toast.error(getErrorMessage(err));
      setError(true);
      setVendors([]);
    } finally {
      setIsLoading(false);
    }
  }, [currentPage, searchQuery, filterStatus]);

  useEffect(() => { fetchVendors(); }, [fetchVendors]);

  const handleSearch = () => { setCurrentPage(1); fetchVendors(); };

  const openViewModal = (vendor: VendorProfile) => { setSelectedVendor(vendor); setIsViewModalOpen(true); };

  const openStatusModal = (vendor: VendorProfile, status: string) => {
    setSelectedVendor(vendor);
    setNewStatus(status);
    setStatusReason('');
    setIsStatusModalOpen(true);
  };

  const handleStatusUpdate = async () => {
    if (!selectedVendor) return;
    setIsSaving(true);
    try {
      await adminService.updateVendorStatus(selectedVendor.id, { status: newStatus, reason: statusReason });
      toast.success(`Vendor ${newStatus} successfully`);
      setIsStatusModalOpen(false);
      fetchVendors();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setIsSaving(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const colors: Record<string, 'success' | 'warning' | 'danger' | 'default'> = {
      approved: 'success', pending: 'warning', rejected: 'danger', suspended: 'danger',
    };
    return <Badge variant={colors[status] || 'default'}>{status}</Badge>;
  };

  if (error && vendors.length === 0) {
    return (<AdminLayout><ErrorState title="Failed to load vendors" onRetry={fetchVendors} /></AdminLayout>);
  }

  return (
    <AdminLayout>
      <div className="page-header flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="page-title">Vendors</h1>
          <p className="page-description">Manage vendor accounts and approvals</p>
        </div>
        <Link href="/vendors/pending">
          <Button variant="outline">Pending Approvals</Button>
        </Link>
      </div>

      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <Input placeholder="Search vendors..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSearch()} className="pl-10" />
            </div>
            <Select options={[{ value: '', label: 'All Status' }, { value: 'approved', label: 'Approved' }, { value: 'pending', label: 'Pending' }, { value: 'rejected', label: 'Rejected' }, { value: 'suspended', label: 'Suspended' }]} value={filterStatus} onChange={(e) => { setFilterStatus(e.target.value); setCurrentPage(1); }} />
            <Button onClick={handleSearch}>Search</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>All Vendors</CardTitle></CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12"><LoadingSpinner size="lg" text="Loading vendors..." /></div>
          ) : vendors.length === 0 ? (
            <EmptyState icon={<Store className="w-8 h-8 text-gray-400" />} title="No vendors found" />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-y">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Vendor</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Owner</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Rating</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Joined</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {vendors.map((vendor) => (
                    <tr key={vendor.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                            <Store className="w-5 h-5 text-gray-400" />
                          </div>
                          <div>
                            <p className="font-medium">{vendor.business_name}</p>
                            <p className="text-xs text-gray-500 flex items-center gap-1"><MapPin className="w-3 h-3" />{vendor.address}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">{vendor.owner_name}</td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1">
                          <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
                          <span className="text-sm font-medium">{Number(vendor.rating || 0).toFixed(1)}</span>
                          <span className="text-xs text-gray-400">({vendor.total_reviews})</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">{getStatusBadge(vendor.status)}</td>
                      <td className="px-6 py-4 text-sm text-gray-500">{formatDate(vendor.created_at)}</td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-end gap-2">
                          <Button variant="ghost" size="sm" onClick={() => openViewModal(vendor)}><Eye className="w-4 h-4" /></Button>
                          {vendor.status === 'approved' && (
                            <Button variant="ghost" size="sm" onClick={() => openStatusModal(vendor, 'suspended')}><XCircle className="w-4 h-4 text-red-500" /></Button>
                          )}
                          {vendor.status === 'suspended' && (
                            <Button variant="ghost" size="sm" onClick={() => openStatusModal(vendor, 'approved')}><CheckCircle className="w-4 h-4 text-green-500" /></Button>
                          )}
                          {vendor.status === 'pending' && (
                            <>
                              <Button variant="ghost" size="sm" onClick={() => openStatusModal(vendor, 'approved')}><CheckCircle className="w-4 h-4 text-green-500" /></Button>
                              <Button variant="ghost" size="sm" onClick={() => openStatusModal(vendor, 'rejected')}><XCircle className="w-4 h-4 text-red-500" /></Button>
                            </>
                          )}
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
      <Modal isOpen={isViewModalOpen} onClose={() => setIsViewModalOpen(false)} title="Vendor Details" size="lg">
        {selectedVendor && (
          <div className="space-y-4">
            <div className="flex items-start gap-4">
              <div className="w-16 h-16 bg-gray-100 rounded-xl flex items-center justify-center"><Store className="w-8 h-8 text-gray-400" /></div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold">{selectedVendor.business_name}</h3>
                <p className="text-sm text-gray-500">{selectedVendor.owner_name}</p>
                <div className="flex items-center gap-2 mt-2">
                  {getStatusBadge(selectedVendor.status)}
                  {selectedVendor.is_featured && <Badge variant="warning">Featured</Badge>}
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 bg-gray-50 p-4 rounded-lg">
              <div><p className="text-xs text-gray-500">Rating</p><div className="flex items-center gap-1"><Star className="w-4 h-4 text-amber-400 fill-amber-400" /><span className="font-medium">{Number(selectedVendor.rating || 0).toFixed(1)}</span><span className="text-xs text-gray-400">({selectedVendor.total_reviews} reviews)</span></div></div>
              <div><p className="text-xs text-gray-500">Location</p><p className="text-sm">{selectedVendor.address}</p></div>
              <div><p className="text-xs text-gray-500">Email</p><p className="text-sm">{selectedVendor.user?.email || '-'}</p></div>
              <div><p className="text-xs text-gray-500">Joined</p><p className="text-sm">{formatDate(selectedVendor.created_at)}</p></div>
            </div>
            {selectedVendor.description && (
              <div><p className="text-sm font-medium text-gray-500 mb-1">Description</p><p className="text-sm text-gray-700">{selectedVendor.description}</p></div>
            )}
          </div>
        )}
      </Modal>

      {/* Status Modal */}
      <Modal isOpen={isStatusModalOpen} onClose={() => setIsStatusModalOpen(false)} title={`${newStatus.charAt(0).toUpperCase() + newStatus.slice(1)} Vendor`}>
        <div className="space-y-4">
          <p className="text-gray-600">Are you sure you want to <strong>{newStatus}</strong> vendor <strong>{selectedVendor?.business_name}</strong>?</p>
          <div><label className="block text-sm font-medium text-gray-700 mb-1">Reason</label><Input value={statusReason} onChange={(e) => setStatusReason(e.target.value)} placeholder="Reason for status change" /></div>
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="outline" onClick={() => setIsStatusModalOpen(false)}>Cancel</Button>
            <Button variant={newStatus === 'approved' ? 'primary' : 'danger'} onClick={handleStatusUpdate} isLoading={isSaving}>{newStatus.charAt(0).toUpperCase() + newStatus.slice(1)}</Button>
          </div>
        </div>
      </Modal>
    </AdminLayout>
  );
}
