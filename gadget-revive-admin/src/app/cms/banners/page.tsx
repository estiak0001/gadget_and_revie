'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { Plus, Edit, Trash2, Image as ImageIcon, ExternalLink, Info } from 'lucide-react';
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
} from '@/components/ui';
import { getErrorMessage } from '@/lib/utils';
import adminService from '@/lib/adminService';
import { Banner } from '@/types';
import toast from 'react-hot-toast';
import { useForm } from 'react-hook-form';

interface BannerFormData {
  title: string;
  subtitle?: string;
  position: string;
  link_url?: string;
  link_text?: string;
  sort_order: number;
  is_active: boolean;
  meta_gradient_from?: string;
  meta_gradient_to?: string;
  meta_icon?: string;
}

const POSITIONS = [
  { value: 'homepage_slider', label: 'Homepage Slider (Main Carousel)' },
  { value: 'homepage_banner', label: 'Homepage Side Banner' },
  { value: 'sidebar', label: 'Sidebar' },
  { value: 'category_page', label: 'Category Page' },
  { value: 'popup', label: 'Popup' },
];

const TW_HEX: Record<string, string> = {
  'orange-500': '#f97316', 'red-500': '#ef4444', 'red-600': '#dc2626',
  'blue-500': '#3b82f6', 'blue-600': '#2563eb', 'indigo-600': '#4f46e5',
  'green-500': '#22c55e', 'teal-600': '#0d9488', 'emerald-500': '#10b981',
  'cyan-600': '#0891b2', 'purple-500': '#a855f7', 'pink-500': '#ec4899',
  'yellow-400': '#facc15', 'amber-500': '#f59e0b',
};

const GRADIENT_PRESETS = [
  { label: 'Orange→Red', from: 'orange-500', to: 'red-500' },
  { label: 'Blue→Indigo', from: 'blue-500', to: 'indigo-600' },
  { label: 'Green→Teal', from: 'green-500', to: 'teal-600' },
  { label: 'Purple→Pink', from: 'purple-500', to: 'pink-500' },
  { label: 'Emerald→Cyan', from: 'emerald-500', to: 'cyan-600' },
  { label: 'Yellow→Orange', from: 'yellow-400', to: 'orange-500' },
];

export default function BannersPage() {
  const [banners, setBanners] = useState<Banner[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedBanner, setSelectedBanner] = useState<Banner | null>(null);
  const [showFormModal, setShowFormModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageRemoved, setImageRemoved] = useState(false);
  const [filterPosition, setFilterPosition] = useState('');

  const { register, handleSubmit, reset, setValue, watch, formState: { errors } } = useForm<BannerFormData>();
  const watchPosition = watch('position');

  const fetchBanners = useCallback(async () => {
    setIsLoading(true);
    try {
      const params: Record<string, string | number> = { page: currentPage, per_page: 12 };
      if (filterPosition) params.position = filterPosition;
      const response = await adminService.getBanners(params);
      setBanners(response.data.data || response.data || []);
      setTotalPages(response.data.meta?.last_page || 1);
    } catch (error) {
      toast.error(getErrorMessage(error));
      setBanners([]);
    } finally {
      setIsLoading(false);
    }
  }, [currentPage, filterPosition]);

  useEffect(() => { fetchBanners(); }, [fetchBanners]);

  const handleOpenForm = (banner?: Banner) => {
    if (banner) {
      setSelectedBanner(banner);
      setValue('title', banner.title);
      setValue('subtitle', banner.subtitle || '');
      setValue('position', banner.position);
      setValue('link_url', banner.link_url || banner.link || '');
      setValue('link_text', banner.link_text || '');
      setValue('sort_order', banner.sort_order);
      setValue('is_active', banner.is_active);
      setValue('meta_gradient_from', banner.meta?.gradient_from || '');
      setValue('meta_gradient_to', banner.meta?.gradient_to || '');
      setValue('meta_icon', banner.meta?.icon || '');
      setImagePreview(banner.image || null);
      setImageFile(null);
      setImageRemoved(false);
    } else {
      setSelectedBanner(null);
      reset({ title: '', subtitle: '', position: 'homepage_slider', link_url: '', link_text: '', sort_order: 1, is_active: true, meta_gradient_from: '', meta_gradient_to: '', meta_icon: '' });
      setImagePreview(null);
      setImageFile(null);
      setImageRemoved(false);
    }
    setShowFormModal(true);
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => setImagePreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const onSubmit = async (data: BannerFormData) => {
    // Side banners use icon+gradient, image is optional
    const imageRequired = data.position !== 'homepage_banner';
    if (!selectedBanner && !imageFile && imageRequired) {
      toast.error('Please select a banner image');
      return;
    }
    setIsSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('title', data.title);
      formData.append('subtitle', data.subtitle ?? '');
      formData.append('position', data.position);
      formData.append('link_url', data.link_url ?? '');
      formData.append('link_text', data.link_text ?? '');
      formData.append('sort_order', String(data.sort_order ?? 0));
      formData.append('is_active', data.is_active ? '1' : '0');

      if (data.position === 'homepage_banner') {
        formData.append('meta[gradient_from]', data.meta_gradient_from || 'blue-500');
        formData.append('meta[gradient_to]', data.meta_gradient_to || 'indigo-600');
        formData.append('meta[icon]', data.meta_icon ?? '');
      }

      if (imageFile) {
        formData.append('image', imageFile);
      } else if (imageRemoved) {
        formData.append('remove_image', '1');
      }

      if (selectedBanner) {
        await adminService.updateBanner(selectedBanner.id, formData);
        toast.success('Banner updated successfully');
      } else {
        await adminService.createBanner(formData);
        toast.success('Banner created successfully');
      }
      closeModal();
      fetchBanners();
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedBanner) return;
    try {
      await adminService.deleteBanner(selectedBanner.id);
      toast.success('Banner deleted');
      setShowDeleteModal(false);
      setSelectedBanner(null);
      fetchBanners();
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  const closeModal = () => {
    setShowFormModal(false);
    setSelectedBanner(null);
    setImageFile(null);
    setImagePreview(null);
    setImageRemoved(false);
    reset();
  };

  return (
    <AdminLayout>
      <div className="page-header flex items-center justify-between">
        <div>
          <h1 className="page-title">Banners</h1>
          <p className="page-description">Manage homepage sliders, side banners, and promotional images</p>
        </div>
        <Button onClick={() => handleOpenForm()}>
          <Plus className="w-4 h-4 mr-2" />
          Add Banner
        </Button>
      </div>

      {/* Position filter */}
      <Card className="mb-4">
        <CardContent className="py-3 px-4">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm text-gray-500 mr-1">Filter:</span>
            {[{ value: '', label: 'All' }, ...POSITIONS].map(p => (
              <button
                key={p.value}
                onClick={() => { setFilterPosition(p.value); setCurrentPage(1); }}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${filterPosition === p.value ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>All Banners</CardTitle></CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12"><LoadingSpinner size="lg" /></div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 p-6">
                {banners.map((banner) => (
                  <div key={banner.id} className="group relative bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200">
                    {/* Thumbnail */}
                    <div className="relative h-44 bg-gray-50 overflow-hidden">
                      {banner.image ? (
                        <img src={banner.image} alt={banner.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                      ) : banner.meta?.gradient_from ? (
                        <div
                          className="w-full h-full flex flex-col items-center justify-center gap-2"
                          style={{ background: `linear-gradient(135deg, ${TW_HEX[banner.meta.gradient_from] ?? '#3b82f6'}, ${TW_HEX[banner.meta.gradient_to ?? ''] ?? '#4f46e5'})` }}
                        >
                          {banner.meta.icon && <span className="text-4xl drop-shadow">{banner.meta.icon}</span>}
                          <span className="text-white/80 text-xs font-medium">{banner.meta.gradient_from} → {banner.meta.gradient_to}</span>
                        </div>
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-100 to-gray-200">
                          <ImageIcon className="w-12 h-12 text-gray-300" />
                        </div>
                      )}

                      {/* Sort order badge */}
                      <div className="absolute top-2 right-2 w-7 h-7 bg-black/50 backdrop-blur-sm rounded-full flex items-center justify-center">
                        <span className="text-white text-xs font-bold">#{banner.sort_order}</span>
                      </div>

                      {/* Position pill */}
                      <div className="absolute top-2 left-2">
                        <span className="bg-black/60 backdrop-blur-sm text-white text-xs px-2.5 py-1 rounded-full font-medium">
                          {banner.position === 'homepage_slider' ? '🎠 Slider' : banner.position === 'homepage_banner' ? '📌 Side Banner' : banner.position}
                        </span>
                      </div>

                      {/* Active/Inactive ribbon */}
                      <div className={`absolute bottom-0 left-0 right-0 h-1 ${banner.is_active ? 'bg-green-500' : 'bg-gray-300'}`} />
                    </div>

                    {/* Body */}
                    <div className="p-4">
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <h3 className="font-semibold text-gray-900 leading-snug line-clamp-1 flex-1">{banner.title}</h3>
                        <span className={`flex-shrink-0 inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${banner.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${banner.is_active ? 'bg-green-500' : 'bg-gray-400'}`} />
                          {banner.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </div>

                      {banner.subtitle && (
                        <p className="text-sm text-gray-500 line-clamp-1 mb-2">{banner.subtitle}</p>
                      )}

                      {(banner.link_url || banner.link) && (
                        <p className="text-xs text-blue-500 flex items-center gap-1 mb-2 truncate hover:underline">
                          <ExternalLink className="w-3 h-3 flex-shrink-0" />
                          {banner.link_url || banner.link}
                        </p>
                      )}

                      {/* Divider */}
                      <div className="border-t border-gray-100 mt-3 pt-3 flex items-center gap-2">
                        <Button variant="secondary" size="sm" className="flex-1 justify-center" onClick={() => handleOpenForm(banner)}>
                          <Edit className="w-3.5 h-3.5 mr-1.5" /> Edit
                        </Button>
                        <button
                          onClick={() => { setSelectedBanner(banner); setShowDeleteModal(true); }}
                          className="p-2 rounded-lg text-red-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              {banners.length === 0 && (
                <div className="text-center py-12">
                  <ImageIcon className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500">No banners found</p>
                  {filterPosition && <button onClick={() => setFilterPosition('')} className="text-primary-600 text-sm mt-2 hover:underline">Clear filter</button>}
                </div>
              )}
              {totalPages > 1 && (
                <div className="px-6 py-4 border-t border-gray-200">
                  <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Modal */}
      <Modal isOpen={showFormModal} onClose={closeModal} title={selectedBanner ? 'Edit Banner' : 'Add Banner'} size="md">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <Select
            label="Position *"
            {...register('position', { required: 'Position is required' })}
            options={POSITIONS}
            error={errors.position?.message}
          />

          <Input label="Title *" placeholder="Banner title / alt text" {...register('title', { required: 'Title is required' })} error={errors.title?.message} />
          <Input label="Subtitle" placeholder="Short tagline or description" {...register('subtitle')} />
          <Input label="Link URL" placeholder="/services or https://example.com" {...register('link_url')} />

          {/* Side Banner Specific */}
          {watchPosition === 'homepage_banner' && (
            <div className="border border-indigo-200 bg-gradient-to-br from-indigo-50 to-blue-50 rounded-xl p-4 space-y-4">
              <div className="flex items-center gap-2 text-indigo-700 text-sm font-semibold">
                <Info className="w-4 h-4" />
                Side Banner Settings
              </div>
              <Input label="Icon (Emoji)" placeholder="📱" {...register('meta_icon')} />

              {/* Live preview */}
              {(watch('meta_gradient_from') || watch('meta_gradient_to')) && (
                <div
                  className="w-full h-16 rounded-xl flex items-center justify-center gap-3 shadow-inner transition-all duration-300"
                  style={{ background: `linear-gradient(135deg, ${TW_HEX[watch('meta_gradient_from') ?? ''] ?? '#3b82f6'}, ${TW_HEX[watch('meta_gradient_to') ?? ''] ?? '#4f46e5'})` }}
                >
                  {watch('meta_icon') && <span className="text-2xl drop-shadow">{watch('meta_icon')}</span>}
                  <span className="text-white text-sm font-semibold drop-shadow">Preview</span>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Gradient Preset</label>
                <div className="grid grid-cols-3 gap-2">
                  {GRADIENT_PRESETS.map((preset) => {
                    const isSelected = watch('meta_gradient_from') === preset.from;
                    return (
                      <button
                        key={preset.label}
                        type="button"
                        onClick={() => { setValue('meta_gradient_from', preset.from); setValue('meta_gradient_to', preset.to); }}
                        className={`relative h-14 rounded-xl overflow-hidden transition-all duration-200 ${isSelected ? 'ring-2 ring-offset-2 ring-gray-800 scale-105 shadow-lg' : 'hover:scale-102 hover:shadow-md opacity-90 hover:opacity-100'}`}
                        style={{ background: `linear-gradient(135deg, ${TW_HEX[preset.from] ?? preset.from}, ${TW_HEX[preset.to] ?? preset.to})` }}
                      >
                        <span className="absolute inset-0 flex flex-col items-center justify-center">
                          <span className="text-white text-xs font-semibold drop-shadow">{preset.label}</span>
                        </span>
                        {isSelected && (
                          <span className="absolute top-1 right-1 w-4 h-4 bg-white rounded-full flex items-center justify-center shadow">
                            <span className="w-2 h-2 rounded-full bg-gray-800" />
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <Input label="Gradient From" placeholder="orange-500" {...register('meta_gradient_from')} />
                <Input label="Gradient To" placeholder="red-500" {...register('meta_gradient_to')} />
              </div>
            </div>
          )}

          {watchPosition !== 'homepage_banner' && (
            <Input label="Link Button Text" placeholder="e.g. Shop Now" {...register('link_text')} />
          )}

          <Input label="Sort Order" type="number" {...register('sort_order', { valueAsNumber: true })} />

          {/* Image Upload */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Image {!selectedBanner && '*'}
            </label>
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-4">
              {imagePreview ? (
                <div className="relative">
                  <img src={imagePreview} alt="Preview" className="w-full h-32 object-cover rounded-lg" />
                  <button type="button" onClick={() => { setImageFile(null); setImagePreview(null); setImageRemoved(true); }} className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded-full hover:bg-red-600">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <label className="cursor-pointer block text-center py-6">
                  <ImageIcon className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                  <span className="text-sm text-gray-500">Click to upload</span>
                  <input type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
                </label>
              )}
            </div>
            {/* Matches the storefront's actual slot ratio (10-column grid: main slide 6/10,
                side banners 4/10, over a max-w-[1600px] page, main slide 420px tall) so an
                image uploaded at this size needs the least cropping from the object-cover fit
                that fills each card on the homepage. */}
            {watchPosition === 'homepage_slider' && <p className="text-xs text-gray-400 mt-1">Recommended: 1200×550px (~2.2:1) — image is cropped to fill, so keep important content centered</p>}
            {watchPosition === 'homepage_banner' && <p className="text-xs text-gray-400 mt-1">Recommended: 600×200px (~3:1) — image is cropped to fill, so keep important content centered</p>}
          </div>

          <div className="flex items-center gap-2">
            <input type="checkbox" id="is_active" {...register('is_active')} className="rounded border-gray-300 text-primary-600 focus:ring-primary-500" />
            <label htmlFor="is_active" className="text-sm text-gray-700">Active</label>
          </div>

          <div className="flex gap-2 pt-2">
            <Button type="button" variant="secondary" className="flex-1" onClick={closeModal}>Cancel</Button>
            <Button type="submit" className="flex-1" isLoading={isSubmitting}>
              {selectedBanner ? 'Update' : 'Create'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete Modal */}
      <Modal isOpen={showDeleteModal} onClose={() => { setShowDeleteModal(false); setSelectedBanner(null); }} title="Delete Banner" size="sm">
        <div className="space-y-4">
          <p className="text-gray-600">Delete <strong>{selectedBanner?.title}</strong>? This cannot be undone.</p>
          <div className="flex gap-2">
            <Button variant="secondary" className="flex-1" onClick={() => { setShowDeleteModal(false); setSelectedBanner(null); }}>Cancel</Button>
            <Button variant="danger" className="flex-1" onClick={handleDelete}>Delete</Button>
          </div>
        </div>
      </Modal>
    </AdminLayout>
  );
}
