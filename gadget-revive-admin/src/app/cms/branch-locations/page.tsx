'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { Plus, Search, Edit, Trash2, MapPin, Star } from 'lucide-react';
import { AdminLayout } from '@/components/layout';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Button,
  Input,
  Select,
  Badge,
  Pagination,
  Modal,
  LoadingSpinner,
  Textarea,
} from '@/components/ui';
import { formatDate, getErrorMessage } from '@/lib/utils';
import adminService from '@/lib/adminService';
import { BranchLocation, PaginatedResponse } from '@/types';
import toast from 'react-hot-toast';
import { useForm } from 'react-hook-form';

interface BranchLocationFormData {
  name: string;
  type: string;
  address: string;
  phone: string;
  email: string;
  hours: string;
  services: string; // comma-separated
  map_url: string;
  map_embed_url: string;
  latitude: string;
  longitude: string;
  is_featured: boolean;
  is_active: boolean;
  sort_order: number;
}

const LOCATION_TYPES = [
  { value: 'Service Center', label: 'Service Center' },
  { value: 'Service Center & Store', label: 'Service Center & Store' },
  { value: 'Parts Store', label: 'Parts Store' },
  { value: 'Showroom', label: 'Showroom' },
  { value: 'Office', label: 'Office' },
];

export default function BranchLocationsPage() {
  const [locations, setLocations] = useState<BranchLocation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [selectedLocation, setSelectedLocation] = useState<BranchLocation | null>(null);
  const [showFormModal, setShowFormModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { register, handleSubmit, reset, setValue, formState: { errors } } = useForm<BranchLocationFormData>();

  const fetchLocations = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await adminService.getBranchLocations({
        page: currentPage,
        per_page: 15,
        ...(search ? { search } : {}),
      });
      const paginated = response.data?.data;
      setLocations(paginated?.data ?? []);
      setTotalPages(paginated?.meta?.last_page ?? 1);
    } catch (error) {
      toast.error(getErrorMessage(error));
      setLocations([]);
    } finally {
      setIsLoading(false);
    }
  }, [currentPage, search]);

  useEffect(() => {
    fetchLocations();
  }, [fetchLocations]);

  const handleOpenForm = (location?: BranchLocation) => {
    if (location) {
      setSelectedLocation(location);
      setValue('name', location.name);
      setValue('type', location.type);
      setValue('address', location.address);
      setValue('phone', location.phone);
      setValue('email', location.email ?? '');
      setValue('hours', location.hours ?? '');
      setValue('services', (location.services ?? []).join(', '));
      setValue('map_url', location.map_url ?? '');
      setValue('map_embed_url', location.map_embed_url ?? '');
      setValue('latitude', location.latitude?.toString() ?? '');
      setValue('longitude', location.longitude?.toString() ?? '');
      setValue('is_featured', location.is_featured);
      setValue('is_active', location.is_active);
      setValue('sort_order', location.sort_order);
    } else {
      setSelectedLocation(null);
      reset({
        name: '',
        type: 'Service Center',
        address: '',
        phone: '',
        email: '',
        hours: '',
        services: '',
        map_url: '',
        map_embed_url: '',
        latitude: '',
        longitude: '',
        is_featured: false,
        is_active: true,
        sort_order: 0,
      });
    }
    setShowFormModal(true);
  };

  const onSubmit = async (data: BranchLocationFormData) => {
    setIsSubmitting(true);
    try {
      const payload = {
        ...data,
        services: data.services
          ? data.services.split(',').map((s) => s.trim()).filter(Boolean)
          : [],
        latitude: data.latitude ? parseFloat(data.latitude) : null,
        longitude: data.longitude ? parseFloat(data.longitude) : null,
        sort_order: Number(data.sort_order),
      };

      if (selectedLocation) {
        await adminService.updateBranchLocation(selectedLocation.id, payload);
        toast.success('Branch location updated successfully');
      } else {
        await adminService.createBranchLocation(payload);
        toast.success('Branch location created successfully');
      }
      setShowFormModal(false);
      setSelectedLocation(null);
      reset();
      fetchLocations();
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedLocation) return;
    try {
      await adminService.deleteBranchLocation(selectedLocation.id);
      toast.success('Branch location deleted successfully');
      setShowDeleteModal(false);
      setSelectedLocation(null);
      fetchLocations();
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  return (
    <AdminLayout>
      <div className="page-header flex items-center justify-between">
        <div>
          <h1 className="page-title">Branch Locations</h1>
          <p className="page-description">Manage physical store and service center locations</p>
        </div>
        <Button onClick={() => handleOpenForm()}>
          <Plus className="w-4 h-4 mr-2" />
          Add Location
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <CardTitle>All Branch Locations</CardTitle>
            <form
              onSubmit={(e) => { e.preventDefault(); setCurrentPage(1); fetchLocations(); }}
              className="flex gap-2"
            >
              <Input
                placeholder="Search locations..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full sm:w-64"
              />
              <Button type="submit" variant="secondary">
                <Search className="w-4 h-4" />
              </Button>
            </form>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <LoadingSpinner size="lg" />
            </div>
          ) : (
            <>
              <div className="divide-y divide-gray-200">
                {locations.map((location) => (
                  <div key={location.id} className="p-5 hover:bg-gray-50">
                    <div className="flex items-start gap-4">
                      <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                        <MapPin className="w-5 h-5 text-gray-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <div className="flex items-center gap-2 mb-0.5">
                              <h3 className="font-semibold text-gray-900">{location.name}</h3>
                              {location.is_featured && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 text-xs font-medium">
                                  <Star className="w-3 h-3" />
                                  Main Branch
                                </span>
                              )}
                            </div>
                            <p className="text-sm text-gray-500">{location.type}</p>
                            <p className="text-sm text-gray-600 mt-1">{location.address}</p>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <Badge variant={location.is_active ? 'success' : 'default'}>
                              {location.is_active ? 'Active' : 'Inactive'}
                            </Badge>
                          </div>
                        </div>
                        <div className="flex items-center gap-4 mt-2 text-xs text-gray-400">
                          <span>{location.phone}</span>
                          {location.hours && <span>{location.hours}</span>}
                          {location.services && location.services.length > 0 && (
                            <span>{location.services.length} services</span>
                          )}
                          <span>Order: {location.sort_order}</span>
                          <span>Added: {formatDate(location.created_at)}</span>
                          <div className="flex items-center gap-2 ml-auto">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleOpenForm(location)}
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setSelectedLocation(location);
                                setShowDeleteModal(true);
                              }}
                            >
                              <Trash2 className="w-4 h-4 text-red-600" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {locations.length === 0 && (
                <div className="text-center py-12">
                  <MapPin className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500">No branch locations found</p>
                </div>
              )}

              {totalPages > 1 && (
                <div className="px-6 py-4 border-t border-gray-200">
                  <Pagination
                    currentPage={currentPage}
                    totalPages={totalPages}
                    onPageChange={setCurrentPage}
                  />
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Form Modal */}
      <Modal
        isOpen={showFormModal}
        onClose={() => {
          setShowFormModal(false);
          setSelectedLocation(null);
          reset();
        }}
        title={selectedLocation ? 'Edit Branch Location' : 'Add Branch Location'}
        size="xl"
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Name *"
              placeholder="e.g. Dhanmondi Branch"
              {...register('name', { required: 'Name is required' })}
              error={errors.name?.message}
            />
            <Select
              label="Type *"
              {...register('type', { required: 'Type is required' })}
              options={LOCATION_TYPES}
              error={errors.type?.message}
            />
          </div>

          <Input
            label="Address *"
            placeholder="e.g. House 45, Road 27, Dhanmondi, Dhaka 1209"
            {...register('address', { required: 'Address is required' })}
            error={errors.address?.message}
          />

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Phone *"
              placeholder="+880 1711-123456"
              {...register('phone', { required: 'Phone is required' })}
              error={errors.phone?.message}
            />
            <Input
              label="Email"
              type="email"
              placeholder="branch@gadgetrevive.com"
              {...register('email')}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Working Hours"
              placeholder="e.g. Sat-Thu: 10AM-8PM"
              {...register('hours')}
            />
            <Input
              label="Sort Order"
              type="number"
              min={0}
              {...register('sort_order', { valueAsNumber: true })}
            />
          </div>

          <Input
            label="Services (comma-separated)"
            placeholder="e.g. Phone Repair, Data Recovery, Laptop Service"
            {...register('services')}
          />

          <Input
            label="Google Maps Link URL"
            placeholder="https://maps.google.com/?q=..."
            {...register('map_url')}
          />

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Google Maps Embed URL
            </label>
            <Textarea
              rows={2}
              placeholder="https://www.google.com/maps/embed?pb=..."
              {...register('map_embed_url')}
            />
            <p className="mt-1 text-xs text-gray-400">
              From Google Maps → Share → Embed a map → copy the <code>src</code> value of the iframe.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Latitude"
              type="number"
              step="any"
              placeholder="23.7465"
              {...register('latitude')}
            />
            <Input
              label="Longitude"
              type="number"
              step="any"
              placeholder="90.3760"
              {...register('longitude')}
            />
          </div>

          <div className="flex items-center gap-6">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                {...register('is_featured')}
                className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              />
              <span className="text-sm text-gray-700">
                Main Branch <span className="text-xs text-gray-400">(only one allowed)</span>
              </span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                {...register('is_active')}
                className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              />
              <span className="text-sm text-gray-700">Active</span>
            </label>
          </div>

          <div className="flex gap-2 pt-4">
            <Button
              type="button"
              variant="secondary"
              className="flex-1"
              onClick={() => {
                setShowFormModal(false);
                setSelectedLocation(null);
                reset();
              }}
            >
              Cancel
            </Button>
            <Button type="submit" className="flex-1" isLoading={isSubmitting}>
              {selectedLocation ? 'Update Location' : 'Create Location'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete Modal */}
      <Modal
        isOpen={showDeleteModal}
        onClose={() => {
          setShowDeleteModal(false);
          setSelectedLocation(null);
        }}
        title="Delete Branch Location"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-gray-600">
            Are you sure you want to delete <strong>{selectedLocation?.name}</strong>? This action cannot be undone.
          </p>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              className="flex-1"
              onClick={() => {
                setShowDeleteModal(false);
                setSelectedLocation(null);
              }}
            >
              Cancel
            </Button>
            <Button variant="danger" className="flex-1" onClick={handleDelete}>
              Delete
            </Button>
          </div>
        </div>
      </Modal>
    </AdminLayout>
  );
}
