'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  Plus,
  Search,
  Edit,
  Trash2,
  Eye,
  Package,
  Star,
  Clock,
  CheckCircle,
  XCircle,
  ToggleLeft,
  ToggleRight,
} from 'lucide-react';
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
import { formatCurrency, getErrorMessage } from '@/lib/utils';
import adminService from '@/lib/adminService';
import toast from 'react-hot-toast';

interface VendorService {
  id: number;
  name: string;
  slug: string;
  description: string;
  category_id: number;
  category?: { id: number; name: string };
  price: number;
  discount_price?: number;
  duration: string;
  warranty_days: number;
  is_featured: boolean;
  is_active: boolean;
  rating: number;
  total_reviews: number;
  total_orders: number;
  image?: string;
  created_at: string;
}

interface Category {
  id: number;
  name: string;
}

function VendorServicesContent() {
  const searchParams = useSearchParams();
  const vendorId = searchParams.get('vendor_id');
  
  const [services, setServices] = useState<VendorService[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedService, setSelectedService] = useState<VendorService | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    category_id: '',
    price: '',
    discount_price: '',
    duration: '',
    warranty_days: '',
    is_active: true,
  });

  const fetchServices = async () => {
    setIsLoading(true);
    try {
      const params: any = {
        page: currentPage,
        ...(searchQuery && { search: searchQuery }),
        ...(filterCategory && { category: filterCategory }),
        ...(filterStatus && { status: filterStatus }),
        ...(vendorId && { vendor_id: parseInt(vendorId) }),
      };
      const response = await adminService.getVendorServices(params);
      setServices(response.data.data);
      setTotalPages(response.data.meta?.last_page || 1);
      if (categories.length === 0) {
        const catRes = await adminService.getServiceCategories();
        setCategories((catRes.data.data || catRes.data).map((c: any) => ({ id: c.id, name: c.name })));
      }
    } catch (error) {
      toast.error(getErrorMessage(error));
      setServices([]);
      setTotalPages(1);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchServices();
  }, [currentPage, filterCategory, filterStatus, vendorId]);

  const handleSearch = () => {
    setCurrentPage(1);
    fetchServices();
  };

  const openCreateModal = () => {
    setSelectedService(null);
    setFormData({
      name: '',
      description: '',
      category_id: '',
      price: '',
      discount_price: '',
      duration: '',
      warranty_days: '',
      is_active: true,
    });
    setIsFormModalOpen(true);
  };

  const openEditModal = (service: VendorService) => {
    setSelectedService(service);
    setFormData({
      name: service.name,
      description: service.description,
      category_id: service.category_id.toString(),
      price: service.price.toString(),
      discount_price: service.discount_price?.toString() || '',
      duration: service.duration,
      warranty_days: service.warranty_days.toString(),
      is_active: service.is_active,
    });
    setIsFormModalOpen(true);
  };

  const openViewModal = (service: VendorService) => {
    setSelectedService(service);
    setIsViewModalOpen(true);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const payload = {
        ...formData,
        category_id: parseInt(formData.category_id),
        price: parseFloat(formData.price),
        discount_price: formData.discount_price ? parseFloat(formData.discount_price) : null,
        warranty_days: parseInt(formData.warranty_days),
      };

      if (selectedService) {
        await adminService.updateVendorService(selectedService.id, payload);
      } else {
        await adminService.createVendorService(payload);
      }
      setIsFormModalOpen(false);
      fetchServices();
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedService) return;
    setIsSaving(true);
    try {
      await adminService.deleteVendorService(selectedService.id);
      setIsDeleteModalOpen(false);
      fetchServices();
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setIsSaving(false);
    }
  };

  const toggleStatus = async (service: VendorService) => {
    try {
      await adminService.toggleVendorServiceStatus(service.id);
      fetchServices();
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  const renderStars = (rating: number) => {
    return (
      <div className="flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`w-3 h-3 ${star <= rating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}`}
          />
        ))}
      </div>
    );
  };

  return (
    <AdminLayout>
      <div className="page-header flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="page-title">My Services</h1>
          <p className="page-description">Manage your repair services</p>
        </div>
        <Button onClick={openCreateModal}>
          <Plus className="w-4 h-4 mr-2" />
          Add Service
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Package className="w-8 h-8 text-blue-600" />
              <div>
                <p className="text-2xl font-bold">{services.length}</p>
                <p className="text-xs text-gray-500">Total Services</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <CheckCircle className="w-8 h-8 text-green-600" />
              <div>
                <p className="text-2xl font-bold">{services.filter(s => s.is_active).length}</p>
                <p className="text-xs text-gray-500">Active</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Star className="w-8 h-8 text-yellow-600" />
              <div>
                <p className="text-2xl font-bold">{services.filter(s => s.is_featured).length}</p>
                <p className="text-xs text-gray-500">Featured</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Star className="w-8 h-8 text-orange-600" />
              <div>
                <p className="text-2xl font-bold">
                  {services.length > 0 ? (services.reduce((sum, s) => sum + s.rating, 0) / services.length).toFixed(1) : '0.0'}
                </p>
                <p className="text-xs text-gray-500">Avg Rating</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <Input
                placeholder="Search services..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                className="pl-10"
              />
            </div>
            <Select 
              options={[
                { value: '', label: 'All Categories' },
                ...categories.map((cat) => ({
                  value: cat.id,
                  label: cat.name
                }))
              ]}
              value={filterCategory} 
              onChange={(e) => setFilterCategory(e.target.value)}
            />
            <Select 
              options={[
                { value: '', label: 'All Status' },
                { value: 'active', label: 'Active' },
                { value: 'inactive', label: 'Inactive' }
              ]}
              value={filterStatus} 
              onChange={(e) => setFilterStatus(e.target.value)}
            />
            <Button onClick={handleSearch}>Search</Button>
          </div>
        </CardContent>
      </Card>

      {/* Services Grid */}
      {isLoading ? (
        <Card>
          <CardContent className="py-12">
            <LoadingSpinner size="lg" text="Loading services..." />
          </CardContent>
        </Card>
      ) : services.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Package className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">No services found</p>
            <Button onClick={openCreateModal} className="mt-4">
              <Plus className="w-4 h-4 mr-2" />
              Add Your First Service
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {services.map((service) => (
            <Card key={service.id} className={!service.is_active ? 'opacity-60' : ''}>
              <CardContent className="p-0">
                <div className="h-40 bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
                  <Package className="w-16 h-16 text-primary/50" />
                </div>
                <div className="p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h3 className="font-medium">{service.name}</h3>
                      <p className="text-xs text-gray-500">{service.category?.name}</p>
                    </div>
                    {service.is_featured && (
                      <Badge variant="warning">Featured</Badge>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-2 mb-3">
                    {renderStars(service.rating)}
                    <span className="text-sm text-gray-600">{service.rating}</span>
                    <span className="text-xs text-gray-400">({service.total_reviews} reviews)</span>
                  </div>

                  <div className="flex items-baseline gap-2 mb-3">
                    {service.discount_price ? (
                      <>
                        <span className="text-lg font-bold text-primary">{formatCurrency(service.discount_price)}</span>
                        <span className="text-sm text-gray-400 line-through">{formatCurrency(service.price)}</span>
                      </>
                    ) : (
                      <span className="text-lg font-bold text-primary">{formatCurrency(service.price)}</span>
                    )}
                  </div>

                  <div className="flex items-center gap-4 text-xs text-gray-500 mb-4">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" /> {service.duration}
                    </span>
                    {service.warranty_days > 0 && (
                      <span className="flex items-center gap-1">
                        <CheckCircle className="w-3 h-3" /> {service.warranty_days} days warranty
                      </span>
                    )}
                  </div>

                  <div className="flex items-center justify-between pt-3 border-t">
                    <button onClick={() => toggleStatus(service)} className="flex items-center gap-2 text-sm">
                      {service.is_active ? (
                        <ToggleRight className="w-5 h-5 text-green-600" />
                      ) : (
                        <ToggleLeft className="w-5 h-5 text-gray-400" />
                      )}
                      <span className={service.is_active ? 'text-green-600' : 'text-gray-400'}>
                        {service.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </button>
                    <div className="flex gap-2">
                      <Button variant="ghost" size="sm" onClick={() => openViewModal(service)}>
                        <Eye className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => openEditModal(service)}>
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => { setSelectedService(service); setIsDeleteModalOpen(true); }}>
                        <Trash2 className="w-4 h-4 text-red-600" />
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="mt-6">
          <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
        </div>
      )}

      {/* Form Modal */}
      <Modal
        isOpen={isFormModalOpen}
        onClose={() => setIsFormModalOpen(false)}
        title={selectedService ? 'Edit Service' : 'Add New Service'}
        size="lg"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Service Name *</label>
            <Input
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g., iPhone Screen Replacement"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description *</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full border rounded-lg p-3 h-24"
              placeholder="Describe your service..."
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Category *</label>
            <Select
              options={[
                { value: '', label: 'Select Category' },
                ...categories.map(cat => ({ value: cat.id.toString(), label: cat.name }))
              ]}
              value={formData.category_id}
              onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Price (৳) *</label>
              <Input
                type="number"
                value={formData.price}
                onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                placeholder="0"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Discount Price (৳)</label>
              <Input
                type="number"
                value={formData.discount_price}
                onChange={(e) => setFormData({ ...formData, discount_price: e.target.value })}
                placeholder="Optional"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Duration *</label>
              <Input
                value={formData.duration}
                onChange={(e) => setFormData({ ...formData, duration: e.target.value })}
                placeholder="e.g., 45 minutes"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Warranty (Days)</label>
              <Input
                type="number"
                value={formData.warranty_days}
                onChange={(e) => setFormData({ ...formData, warranty_days: e.target.value })}
                placeholder="0"
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="is_active"
              checked={formData.is_active}
              onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
              className="rounded border-gray-300"
            />
            <label htmlFor="is_active" className="text-sm text-gray-700">Active (visible to customers)</label>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button variant="outline" onClick={() => setIsFormModalOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} isLoading={isSaving}>
              {selectedService ? 'Update Service' : 'Add Service'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* View Modal */}
      <Modal isOpen={isViewModalOpen} onClose={() => setIsViewModalOpen(false)} title="Service Details">
        {selectedService && (
          <div className="space-y-4">
            <div className="text-center pb-4 border-b">
              <h3 className="text-xl font-semibold">{selectedService.name}</h3>
              <p className="text-gray-500">{selectedService.category?.name}</p>
            </div>
            <p className="text-gray-600">{selectedService.description}</p>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-gray-50 p-3 rounded-lg">
                <p className="text-xs text-gray-500">Price</p>
                <p className="font-bold text-lg">{formatCurrency(selectedService.discount_price || selectedService.price)}</p>
              </div>
              <div className="bg-gray-50 p-3 rounded-lg">
                <p className="text-xs text-gray-500">Duration</p>
                <p className="font-bold text-lg">{selectedService.duration}</p>
              </div>
              <div className="bg-gray-50 p-3 rounded-lg">
                <p className="text-xs text-gray-500">Warranty</p>
                <p className="font-bold text-lg">{selectedService.warranty_days} days</p>
              </div>
              <div className="bg-gray-50 p-3 rounded-lg">
                <p className="text-xs text-gray-500">Total Orders</p>
                <p className="font-bold text-lg">{selectedService.total_orders}</p>
              </div>
            </div>
            <div className="flex items-center justify-center gap-2 py-4">
              {renderStars(selectedService.rating)}
              <span className="font-bold">{selectedService.rating}</span>
              <span className="text-gray-500">({selectedService.total_reviews} reviews)</span>
            </div>
            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button variant="outline" onClick={() => setIsViewModalOpen(false)}>Close</Button>
              <Button onClick={() => { setIsViewModalOpen(false); openEditModal(selectedService); }}>Edit Service</Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Delete Modal */}
      <Modal isOpen={isDeleteModalOpen} onClose={() => setIsDeleteModalOpen(false)} title="Delete Service">
        <div className="space-y-4">
          <p className="text-gray-600">Are you sure you want to delete "{selectedService?.name}"? This action cannot be undone.</p>
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="outline" onClick={() => setIsDeleteModalOpen(false)}>Cancel</Button>
            <Button variant="outline" className="border-red-300 text-red-600 hover:bg-red-50" onClick={handleDelete} isLoading={isSaving}>
              <Trash2 className="w-4 h-4 mr-2" />
              Delete Service
            </Button>
          </div>
        </div>
      </Modal>
    </AdminLayout>
  );
}

export default function VendorServicesPage() {
  return (
    <Suspense fallback={<AdminLayout><div className="flex items-center justify-center min-h-screen"><LoadingSpinner size="lg" text="Loading..." /></div></AdminLayout>}>
      <VendorServicesContent />
    </Suspense>
  );
}
