'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { Store, CheckCircle, XCircle, Eye, MapPin, Star } from 'lucide-react';
import { AdminLayout } from '@/components/layout';
import {
  Card, CardContent, CardHeader, CardTitle, Button, Modal, Badge, LoadingSpinner, Pagination, EmptyState, ErrorState,
} from '@/components/ui';
import { VendorProfile } from '@/types';
import { formatDate, getErrorMessage } from '@/lib/utils';
import adminService from '@/lib/adminService';
import toast from 'react-hot-toast';
import { Input } from '@/components/ui';

export default function PendingVendorsPage() {
  const [vendors, setVendors] = useState<VendorProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [isActionModalOpen, setIsActionModalOpen] = useState(false);
  const [selectedVendor, setSelectedVendor] = useState<VendorProfile | null>(null);
  const [actionType, setActionType] = useState<'approved' | 'rejected'>('approved');
  const [reason, setReason] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const fetchVendors = useCallback(async () => {
    setIsLoading(true);
    setError(false);
    try {
      const response = await adminService.getVendors({ page: currentPage, status: 'pending' });
      const data = response.data?.data || response.data;
      if (Array.isArray(data)) {
        setVendors(data);
        setTotalPages(1);
      } else {
        setVendors(data.data);
        setTotalPages(data.meta?.last_page || 1);
      }
    } catch (err) {
      toast.error(getErrorMessage(err));
      setError(true);
      setVendors([]);
    } finally {
      setIsLoading(false);
    }
  }, [currentPage]);

  useEffect(() => { fetchVendors(); }, [fetchVendors]);

  const openAction = (vendor: VendorProfile, type: 'approved' | 'rejected') => {
    setSelectedVendor(vendor);
    setActionType(type);
    setReason('');
    setIsActionModalOpen(true);
  };

  const handleAction = async () => {
    if (!selectedVendor) return;
    setIsSaving(true);
    try {
      await adminService.updateVendorStatus(selectedVendor.id, { status: actionType, reason });
      toast.success(`Vendor ${actionType} successfully`);
      setIsActionModalOpen(false);
      fetchVendors();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setIsSaving(false);
    }
  };

  if (error && vendors.length === 0) {
    return (<AdminLayout><ErrorState title="Failed to load pending vendors" onRetry={fetchVendors} /></AdminLayout>);
  }

  return (
    <AdminLayout>
      <div className="page-header">
        <h1 className="page-title">Pending Vendor Approvals</h1>
        <p className="page-description">Review and approve/reject vendor applications</p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12"><LoadingSpinner size="lg" text="Loading..." /></div>
      ) : vendors.length === 0 ? (
        <EmptyState icon={<Store className="w-8 h-8 text-gray-400" />} title="No pending vendors" description="All vendor applications have been reviewed." />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {vendors.map((vendor) => (
            <Card key={vendor.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-start gap-3 mb-4">
                  <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center shrink-0">
                    <Store className="w-6 h-6 text-gray-400" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-semibold truncate">{vendor.business_name}</h3>
                    <p className="text-sm text-gray-500">{vendor.owner_name}</p>
                    <p className="text-xs text-gray-400 flex items-center gap-1 mt-1"><MapPin className="w-3 h-3" />{vendor.address}</p>
                  </div>
                </div>
                <div className="mb-4">
                  <Badge variant="warning">Pending Approval</Badge>
                  <p className="text-xs text-gray-400 mt-1">Applied {formatDate(vendor.created_at)}</p>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="flex-1" onClick={() => { setSelectedVendor(vendor); setIsViewModalOpen(true); }}>
                    <Eye className="w-4 h-4 mr-1" />View
                  </Button>
                  <Button size="sm" className="flex-1" onClick={() => openAction(vendor, 'approved')}>
                    <CheckCircle className="w-4 h-4 mr-1" />Approve
                  </Button>
                  <Button variant="danger" size="sm" onClick={() => openAction(vendor, 'rejected')}>
                    <XCircle className="w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {totalPages > 1 && <div className="mt-6"><Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} /></div>}

      <Modal isOpen={isViewModalOpen} onClose={() => setIsViewModalOpen(false)} title="Vendor Application" size="lg">
        {selectedVendor && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4 bg-gray-50 p-4 rounded-lg">
              <div><p className="text-xs text-gray-500">Business Name</p><p className="font-medium">{selectedVendor.business_name}</p></div>
              <div><p className="text-xs text-gray-500">Owner</p><p className="font-medium">{selectedVendor.owner_name}</p></div>
              <div><p className="text-xs text-gray-500">Address</p><p className="text-sm">{selectedVendor.address}</p></div>
              <div><p className="text-xs text-gray-500">Applied</p><p className="text-sm">{formatDate(selectedVendor.created_at)}</p></div>
            </div>
            {selectedVendor.description && <div><p className="text-sm font-medium mb-1">Description</p><p className="text-sm text-gray-600">{selectedVendor.description}</p></div>}
            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button variant="danger" onClick={() => { setIsViewModalOpen(false); openAction(selectedVendor, 'rejected'); }}>Reject</Button>
              <Button onClick={() => { setIsViewModalOpen(false); openAction(selectedVendor, 'approved'); }}>Approve</Button>
            </div>
          </div>
        )}
      </Modal>

      <Modal isOpen={isActionModalOpen} onClose={() => setIsActionModalOpen(false)} title={actionType === 'approved' ? 'Approve Vendor' : 'Reject Vendor'}>
        <div className="space-y-4">
          <p className="text-gray-600">{actionType === 'approved' ? 'Approve' : 'Reject'} <strong>{selectedVendor?.business_name}</strong>?</p>
          <div><label className="block text-sm font-medium text-gray-700 mb-1">Reason {actionType === 'rejected' && <span className="text-red-500">*</span>}</label><Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason..." required={actionType === 'rejected'} /></div>
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setIsActionModalOpen(false)}>Cancel</Button>
            <Button variant={actionType === 'approved' ? 'primary' : 'danger'} onClick={handleAction} isLoading={isSaving}>{actionType === 'approved' ? 'Approve' : 'Reject'}</Button>
          </div>
        </div>
      </Modal>
    </AdminLayout>
  );
}
