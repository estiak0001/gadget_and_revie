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
import { Area, District, Division, PaginatedResponse } from '@/types';
import adminService from '@/lib/adminService';
import { getErrorMessage } from '@/lib/utils';
import toast from 'react-hot-toast';

export default function AreasPage() {
  const [areas, setAreas] = useState<Area[]>([]);
  const [divisions, setDivisions] = useState<Division[]>([]);
  const [districts, setDistricts] = useState<District[]>([]);
  const [filteredDistricts, setFilteredDistricts] = useState<District[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterDivision, setFilterDivision] = useState('');
  const [filterDistrict, setFilterDistrict] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedArea, setSelectedArea] = useState<Area | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState({
    division_id: '',
    district_id: '',
    name: '',
    bn_name: '',
    post_code: '',
    status: 'active',
  });

  const fetchAreas = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        ...(searchQuery && { search: searchQuery }),
        ...(filterDistrict && { district_id: filterDistrict }),
      });
      const url = filterDistrict 
        ? `/locations/districts/${filterDistrict}/areas?${params}`
        : `/locations/areas?${params}`;
      const response = await adminService.getAreas({ page: currentPage, ...(searchQuery ? { search: searchQuery } : {}), ...(filterDistrict ? { district_id: filterDistrict } : {}) });
      const raw = response.data;
      const list = Array.isArray(raw.data) ? raw.data : Array.isArray(raw) ? raw : [];
      setAreas(list);
      setTotalPages(raw.meta?.last_page || raw.last_page || 1);
    } catch (error) {
      toast.error(getErrorMessage(error));
      setAreas([]);
      setTotalPages(1);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchLocations = async () => {
    try {
      const [divRes, distRes] = await Promise.all([
        adminService.getDivisions(),
        adminService.getDistricts(),
      ]);
      const divisionsData = (divRes.data.data || divRes.data).map((div: any) => ({
        id: div.id,
        name: div.name,
        bn_name: div.name_bn || div.bn_name,
      }));
      const districtsData = (distRes.data.data || distRes.data).map((dist: any) => ({
        id: dist.id,
        division_id: dist.division_id,
        name: dist.name,
        bn_name: dist.name_bn || dist.bn_name,
      }));
      setDivisions(divisionsData);
      setDistricts(districtsData);
    } catch (error) {
      toast.error(getErrorMessage(error));
      setDivisions([]);
      setDistricts([]);
    }
  };

  useEffect(() => {
    fetchLocations();
  }, []);

  useEffect(() => {
    fetchAreas();
  }, [currentPage, filterDistrict]);

  useEffect(() => {
    if (filterDivision) {
      setFilteredDistricts(districts.filter(d => d.division_id === parseInt(filterDivision)));
    } else {
      setFilteredDistricts(districts);
    }
    setFilterDistrict('');
  }, [filterDivision, districts]);

  useEffect(() => {
    if (formData.division_id) {
      setFilteredDistricts(districts.filter(d => d.division_id === parseInt(formData.division_id)));
    }
  }, [formData.division_id, districts]);

  const handleSearch = () => {
    setCurrentPage(1);
    fetchAreas();
  };

  const openCreateModal = () => {
    setSelectedArea(null);
    setFormData({ division_id: '', district_id: '', name: '', bn_name: '', post_code: '', status: 'active' });
    setIsModalOpen(true);
  };

  const openEditModal = (area: Area) => {
    setSelectedArea(area);
    const divisionId = area.district?.division_id?.toString() || '';
    setFormData({
      division_id: divisionId,
      district_id: area.district_id.toString(),
      name: area.name,
      bn_name: area.bn_name || '',
      post_code: area.post_code || '',
      status: area.status || 'active',
    });
    if (divisionId) {
      setFilteredDistricts(districts.filter(d => d.division_id === parseInt(divisionId)));
    }
    setIsModalOpen(true);
  };

  const openDeleteModal = (area: Area) => {
    setSelectedArea(area);
    setIsDeleteModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const payload = { 
        district_id: parseInt(formData.district_id),
        name: formData.name,
        bn_name: formData.bn_name,
        post_code: formData.post_code,
        status: formData.status,
      };
      if (selectedArea) {
        await adminService.updateArea(selectedArea.id, payload);
      } else {
        await adminService.createArea(payload);
      }
      setIsModalOpen(false);
      fetchAreas();
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedArea) return;
    try {
      await adminService.deleteArea(selectedArea.id);
      setIsDeleteModalOpen(false);
      fetchAreas();
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  return (
    <AdminLayout>
      <div className="page-header flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="page-title">Areas</h1>
          <p className="page-description">Manage areas within districts</p>
        </div>
        <Button onClick={openCreateModal}>
          <Plus className="w-4 h-4 mr-2" />
          Add Area
        </Button>
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <Input
                placeholder="Search areas..."
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
            <Select 
              options={[
                { value: '', label: 'All Districts' },
                ...filteredDistricts.map((district) => ({
                  value: district.id,
                  label: district.name
                }))
              ]}
              value={filterDistrict} 
              onChange={(e) => setFilterDistrict(e.target.value)}
            />
            <Button onClick={handleSearch}>Search</Button>
          </div>
        </CardContent>
      </Card>

      {/* Areas Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Areas ({areas.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <LoadingSpinner size="lg" text="Loading areas..." />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-y">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">ID</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Bengali</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">District</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Division</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Post Code</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {areas.map((area) => (
                    <tr key={area.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 text-sm text-gray-500">#{area.id}</td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <MapPin className="w-4 h-4 text-gray-400" />
                          <span className="font-medium">{area.name}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-gray-600">{area.bn_name}</td>
                      <td className="px-6 py-4">
                        <Badge variant="default">{area.district?.name}</Badge>
                      </td>
                      <td className="px-6 py-4">
                        <Badge variant="default">{area.district?.division?.name}</Badge>
                      </td>
                      <td className="px-6 py-4 text-gray-600 font-mono">{area.post_code}</td>
                      <td className="px-6 py-4">
                        <Badge variant={area.status === 'active' ? 'success' : 'danger'}>
                          {area.status}
                        </Badge>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-end gap-2">
                          <Button variant="ghost" size="sm" onClick={() => openEditModal(area)}>
                            <Edit2 className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => openDeleteModal(area)}>
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
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={selectedArea ? 'Edit Area' : 'Add Area'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Division</label>
            <Select
              options={[
                { value: '', label: 'Select Division' },
                ...divisions.map((division) => ({
                  value: division.id,
                  label: division.name
                }))
              ]}
              value={formData.division_id}
              onChange={(e) => setFormData({ ...formData, division_id: e.target.value, district_id: '' })}
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">District</label>
            <Select
              options={[
                { value: '', label: 'Select District' },
                ...filteredDistricts.map((district) => ({
                  value: district.id,
                  label: district.name
                }))
              ]}
              value={formData.district_id}
              onChange={(e) => setFormData({ ...formData, district_id: e.target.value })}
              required
              disabled={!formData.division_id}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name (English)</label>
            <Input
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Enter area name"
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
            <label className="block text-sm font-medium text-gray-700 mb-1">Post Code</label>
            <Input
              value={formData.post_code}
              onChange={(e) => setFormData({ ...formData, post_code: e.target.value })}
              placeholder="Enter post code"
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
            <Button type="submit" isLoading={isSaving}>{selectedArea ? 'Update' : 'Create'}</Button>
          </div>
        </form>
      </Modal>

      {/* Delete Modal */}
      <Modal isOpen={isDeleteModalOpen} onClose={() => setIsDeleteModalOpen(false)} title="Delete Area">
        <p className="text-gray-600 mb-4">
          Are you sure you want to delete &quot;{selectedArea?.name}&quot;?
        </p>
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={() => setIsDeleteModalOpen(false)}>Cancel</Button>
          <Button variant="danger" onClick={handleDelete}>Delete</Button>
        </div>
      </Modal>
    </AdminLayout>
  );
}
