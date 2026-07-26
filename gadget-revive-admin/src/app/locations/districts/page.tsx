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
  Select,
  Modal,
  Badge,
  LoadingSpinner,
  Pagination,
} from '@/components/ui';
import { District, Division, PaginatedResponse } from '@/types';
import adminService from '@/lib/adminService';
import { getErrorMessage } from '@/lib/utils';
import toast from 'react-hot-toast';

export default function DistrictsPage() {
  const [districts, setDistricts] = useState<District[]>([]);
  const [divisions, setDivisions] = useState<Division[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterDivision, setFilterDivision] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedDistrict, setSelectedDistrict] = useState<District | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState({
    division_id: '',
    name: '',
    bn_name: '',
    status: 'active',
  });

  const fetchDistricts = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        ...(searchQuery && { search: searchQuery }),
        ...(filterDivision && { division_id: filterDivision }),
      });
      const url = filterDivision 
        ? `/locations/divisions/${filterDivision}/districts?${params}`
        : `/locations/districts?${params}`;
      const response = await adminService.getDistricts({ page: currentPage, ...(searchQuery ? { search: searchQuery } : {}), ...(filterDivision ? { division_id: filterDivision } : {}) });
      const raw = response.data;
      const list = Array.isArray(raw.data) ? raw.data : Array.isArray(raw) ? raw : [];
      setDistricts(list);
      setTotalPages(raw.meta?.last_page || raw.last_page || 1);
    } catch (error) {
      toast.error(getErrorMessage(error));
      setDistricts([]);
      setTotalPages(1);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchDivisions = async () => {
    try {
      const response = await adminService.getDivisions();
      const divisionsData = (response.data.data || response.data).map((div: any) => ({
        id: div.id,
        name: div.name,
        bn_name: div.name_bn || div.bn_name,
      }));
      setDivisions(divisionsData);
    } catch (error) {
      toast.error(getErrorMessage(error));
      setDivisions([]);
    }
  };

  useEffect(() => {
    fetchDivisions();
  }, []);

  useEffect(() => {
    fetchDistricts();
  }, [currentPage, filterDivision]);

  const handleSearch = () => {
    setCurrentPage(1);
    fetchDistricts();
  };

  const openCreateModal = () => {
    setSelectedDistrict(null);
    setFormData({ division_id: '', name: '', bn_name: '', status: 'active' });
    setIsModalOpen(true);
  };

  const openEditModal = (district: District) => {
    setSelectedDistrict(district);
    setFormData({
      division_id: district.division_id.toString(),
      name: district.name,
      bn_name: district.bn_name || '',
      status: district.status || 'active',
    });
    setIsModalOpen(true);
  };

  const openDeleteModal = (district: District) => {
    setSelectedDistrict(district);
    setIsDeleteModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const payload = { ...formData, division_id: parseInt(formData.division_id) };
      if (selectedDistrict) {
        await adminService.updateDistrict(selectedDistrict.id, payload);
      } else {
        await adminService.createDistrict(payload);
      }
      setIsModalOpen(false);
      fetchDistricts();
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedDistrict) return;
    try {
      await adminService.deleteDistrict(selectedDistrict.id);
      setIsDeleteModalOpen(false);
      fetchDistricts();
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  return (
    <AdminLayout>
      <div className="page-header flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="page-title">Districts</h1>
          <p className="page-description">Manage districts within divisions</p>
        </div>
        <Button onClick={openCreateModal}>
          <Plus className="w-4 h-4 mr-2" />
          Add District
        </Button>
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <Input
                placeholder="Search districts..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                className="pl-10"
              />
            </div>
            <Select 
              options={[
                { value: '', label: 'All Divisions' },
                ...divisions.map((division) => ({
                  value: division.id,
                  label: division.name
                }))
              ]}
              value={filterDivision} 
              onChange={(e) => setFilterDivision(e.target.value)}
            />
            <Button onClick={handleSearch}>Search</Button>
          </div>
        </CardContent>
      </Card>

      {/* Districts Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Districts ({districts.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <LoadingSpinner size="lg" text="Loading districts..." />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-y">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">ID</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Bengali Name</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Division</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Areas</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {districts.map((district) => (
                    <tr key={district.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 text-sm text-gray-500">#{district.id}</td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <MapPin className="w-4 h-4 text-gray-400" />
                          <span className="font-medium">{district.name}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-gray-600">{district.bn_name}</td>
                      <td className="px-6 py-4">
                        <Badge variant="default">{district.division?.name}</Badge>
                      </td>
                      <td className="px-6 py-4">
                        <Badge variant="default">{district.areas_count || 0} areas</Badge>
                      </td>
                      <td className="px-6 py-4">
                        <Badge variant={district.status === 'active' ? 'success' : 'danger'}>
                          {district.status}
                        </Badge>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-end gap-2">
                          <Button variant="ghost" size="sm" onClick={() => openEditModal(district)}>
                            <Edit2 className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => openDeleteModal(district)}>
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
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={selectedDistrict ? 'Edit District' : 'Add District'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Division</label>
            <Select
              value={formData.division_id}
              onChange={(e) => setFormData({ ...formData, division_id: e.target.value })}
              options={[
                { value: '', label: 'Select Division' },
                ...divisions.map((division) => ({
                  value: division.id,
                  label: division.name
                }))
              ]}
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name (English)</label>
            <Input
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Enter district name"
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
              options={[
                { value: 'active', label: 'Active' },
                { value: 'inactive', label: 'Inactive' }
              ]}
              value={formData.status} 
              onChange={(e) => setFormData({ ...formData, status: e.target.value })}
            />
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>Cancel</Button>
            <Button type="submit" isLoading={isSaving}>{selectedDistrict ? 'Update' : 'Create'}</Button>
          </div>
        </form>
      </Modal>

      {/* Delete Modal */}
      <Modal isOpen={isDeleteModalOpen} onClose={() => setIsDeleteModalOpen(false)} title="Delete District">
        <p className="text-gray-600 mb-4">
          Are you sure you want to delete &quot;{selectedDistrict?.name}&quot;? This will also affect all associated areas.
        </p>
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={() => setIsDeleteModalOpen(false)}>Cancel</Button>
          <Button variant="danger" onClick={handleDelete}>Delete</Button>
        </div>
      </Modal>
    </AdminLayout>
  );
}
