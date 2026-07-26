'use client';

import React, { useEffect, useState } from 'react';
import { Plus, Edit2, Trash2, Search, MapPin } from 'lucide-react';
import { AdminLayout } from '@/components/layout';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Button,
  Input,
  Modal,
  Badge,
  LoadingSpinner,
  Pagination,
  Select,
} from '@/components/ui';
import { Division, PaginatedResponse } from '@/types';
import adminService from '@/lib/adminService';
import { getErrorMessage } from '@/lib/utils';
import toast from 'react-hot-toast';

export default function DivisionsPage() {
  const [divisions, setDivisions] = useState<Division[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedDivision, setSelectedDivision] = useState<Division | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    bn_name: '',
    status: 'active',
  });

  const fetchDivisions = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        ...(searchQuery && { search: searchQuery }),
      });
      const response = await adminService.getDivisions({ page: currentPage, ...(searchQuery ? { search: searchQuery } : {}) });
      const raw = response.data;
      const list = Array.isArray(raw.data) ? raw.data : Array.isArray(raw) ? raw : [];
      const divisionsData = list.map((div: any) => ({
        id: div.id,
        name: div.name,
        bn_name: div.name_bn || div.bn_name,
        is_active: div.is_active ?? true,
      }));
      setDivisions(divisionsData);
      setTotalPages(raw.meta?.last_page || raw.last_page || 1);
    } catch (error) {
      toast.error(getErrorMessage(error));
      setDivisions([]);
      setTotalPages(1);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDivisions();
  }, [currentPage]);

  const handleSearch = () => {
    setCurrentPage(1);
    fetchDivisions();
  };

  const openCreateModal = () => {
    setSelectedDivision(null);
    setFormData({ name: '', bn_name: '', status: 'active' });
    setIsModalOpen(true);
  };

  const openEditModal = (division: Division) => {
    setSelectedDivision(division);
    setFormData({
      name: division.name,
      bn_name: division.bn_name || '',
      status: division.status || 'active',
    });
    setIsModalOpen(true);
  };

  const openDeleteModal = (division: Division) => {
    setSelectedDivision(division);
    setIsDeleteModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      if (selectedDivision) {
        await adminService.updateDivision(selectedDivision.id, formData);
      } else {
        await adminService.createDivision(formData);
      }
      setIsModalOpen(false);
      fetchDivisions();
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedDivision) return;
    try {
      await adminService.deleteDivision(selectedDivision.id);
      setIsDeleteModalOpen(false);
      fetchDivisions();
    } catch (error) {
      toast.error(getErrorMessage(error));
      setIsDeleteModalOpen(false);
    }
  };

  const filteredDivisions = divisions.filter(d =>
    d.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    d.bn_name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <AdminLayout>
      <div className="page-header flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="page-title">Divisions</h1>
          <p className="page-description">Manage Bangladesh divisions</p>
        </div>
        <Button onClick={openCreateModal}>
          <Plus className="w-4 h-4 mr-2" />
          Add Division
        </Button>
      </div>

      {/* Search */}
      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="flex gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <Input
                placeholder="Search divisions..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                className="pl-10"
              />
            </div>
            <Button onClick={handleSearch}>Search</Button>
          </div>
        </CardContent>
      </Card>

      {/* Divisions Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Divisions ({filteredDivisions.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <LoadingSpinner size="lg" text="Loading divisions..." />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-y">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">ID</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Bengali Name</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Districts</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredDivisions.map((division) => (
                    <tr key={division.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 text-sm text-gray-500">#{division.id}</td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <MapPin className="w-4 h-4 text-gray-400" />
                          <span className="font-medium">{division.name}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-gray-600">{division.bn_name}</td>
                      <td className="px-6 py-4">
                        <Badge variant="default">{division.districts_count || 0} districts</Badge>
                      </td>
                      <td className="px-6 py-4">
                        <Badge variant={division.status === 'active' ? 'success' : 'danger'}>
                          {division.status}
                        </Badge>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-end gap-2">
                          <Button variant="ghost" size="sm" onClick={() => openEditModal(division)}>
                            <Edit2 className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => openDeleteModal(division)}>
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

      {totalPages > 1 && (
        <div className="mt-6">
          <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
        </div>
      )}

      {/* Create/Edit Modal */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={selectedDivision ? 'Edit Division' : 'Add Division'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name (English)</label>
            <Input
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Enter division name"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name (Bengali)</label>
            <Input
              value={formData.bn_name}
              onChange={(e) => setFormData({ ...formData, bn_name: e.target.value })}
              placeholder="বাংলায় নাম লিখুন"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <Select
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value })}
              options={[
                { value: 'active', label: 'Active' },
                { value: 'inactive', label: 'Inactive' }
              ]}
            />
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>Cancel</Button>
            <Button type="submit" isLoading={isSaving}>{selectedDivision ? 'Update' : 'Create'}</Button>
          </div>
        </form>
      </Modal>

      {/* Delete Modal */}
      <Modal isOpen={isDeleteModalOpen} onClose={() => setIsDeleteModalOpen(false)} title="Delete Division">
        <p className="text-gray-600 mb-4">
          Are you sure you want to delete &quot;{selectedDivision?.name}&quot;? This will also affect all associated districts and areas.
        </p>
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={() => setIsDeleteModalOpen(false)}>Cancel</Button>
          <Button variant="danger" onClick={handleDelete}>Delete</Button>
        </div>
      </Modal>
    </AdminLayout>
  );
}
