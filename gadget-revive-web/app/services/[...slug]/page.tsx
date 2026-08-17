'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { serviceService, locationService, orderService, guestCartService } from '@/lib/api';
import { getStorageUrl } from '@/lib/api/config';
import { Service, ServiceCategory, Division, District, Area } from '@/lib/types';
import { useAuthStore } from '@/lib/stores/auth-store';
import Breadcrumb from '@/components/Breadcrumb';
import ServiceCard from '@/components/ServiceCard';
import {
  ClockIcon,
  CheckCircleIcon,
  ShieldCheckIcon,
  WrenchScrewdriverIcon,
  ArrowLeftIcon,
  CreditCardIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

// ──────────────────────────────────────────────────────────────
// Helper: build a full /services/{a}/{b}/{c} URL from a category
// ──────────────────────────────────────────────────────────────
function buildServiceCategoryPath(category: ServiceCategory): string {
  if (category.breadcrumb && category.breadcrumb.length > 0) {
    return '/services/' + category.breadcrumb.map((b) => b.slug).join('/');
  }
  return '/services/' + category.slug;
}

// ──────────────────────────────────────────────────────────────
// Main resolver component
// ──────────────────────────────────────────────────────────────
export default function ServicesSlugPage() {
  const params = useParams();
  const slugs = params.slug as string[];
  const lastSlug = slugs[slugs.length - 1];
  const requestedPath = slugs.join('/');

  const [view, setView] = useState<'loading' | 'category' | 'detail' | 'notfound'>('loading');
  const [category, setCategory] = useState<ServiceCategory | null>(null);
  const [service, setService] = useState<Service | null>(null);

  useEffect(() => {
    const resolve = async () => {
      // 1. Try category-by-slug first
      try {
        const cat = await serviceService.getCategoryBySlug(lastSlug);
        const catPath = cat.breadcrumb?.map((b) => b.slug).join('/') ?? cat.slug;
        if (catPath === requestedPath) {
          setCategory(cat);
          setView('category');
          return;
        }
      } catch {}

      // 2. Fall back to service detail
      try {
        const svc = await serviceService.getById(lastSlug);
        setService(svc);
        setView('detail');
      } catch {
        setView('notfound');
      }
    };
    resolve();
  }, [lastSlug, requestedPath]);

  if (view === 'loading') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin h-12 w-12 border-4 border-ink border-t-transparent rounded-full" />
      </div>
    );
  }

  if (view === 'notfound') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Not Found</h1>
          <p className="text-gray-600 mb-6">The service or category you&apos;re looking for doesn&apos;t exist.</p>
          <Link href="/services" className="px-6 py-3 bg-ink text-white rounded-lg hover:bg-ink/90 transition-colors">
            Browse Services
          </Link>
        </div>
      </div>
    );
  }

  if (view === 'category' && category) return <CategoryView category={category} />;
  if (view === 'detail' && service) return <ServiceDetailView initialService={service} />;
  return null;
}

// ──────────────────────────────────────────────────────────────
// CategoryView — lists services under a category
// ──────────────────────────────────────────────────────────────
function CategoryView({ category }: { category: ServiceCategory }) {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalServices, setTotalServices] = useState(0);

  // Breadcrumb items
  const breadcrumbItems = [
    { name: 'Services', href: '/services' },
    ...(category.breadcrumb ?? [{ id: category.id, name: category.name, slug: category.slug }]).map((b) => ({
      name: b.name,
      href: buildServiceCategoryPath({ ...category, breadcrumb: category.breadcrumb?.slice(0, (category.breadcrumb?.findIndex(x => x.id === b.id) ?? 0) + 1) }),
    })),
  ];

  const fetchServices = useCallback(async () => {
    try {
      setLoading(true);
      const params: any = { category_id: category.id, page: currentPage, per_page: 10 };
      const result = await serviceService.getAll(params);
      setServices(result.data);
      setTotalServices(result.meta.total);
      setTotalPages(result.meta.last_page);
    } catch {
      toast.error('Failed to load services');
    } finally {
      setLoading(false);
    }
  }, [category.id, currentPage]);

  useEffect(() => { fetchServices(); }, [fetchServices]);

  const subcategories = category.children ?? [];

  return (
    <div className="bg-white min-h-screen">
      {/* Hero */}
      <div className="bg-gradient-to-r from-ink to-ink">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
          {/* Breadcrumb - top left */}
          <Breadcrumb items={breadcrumbItems} darkBg={true} />

          {/* Main Layout Row: Title + Count (mirrors /services hero) */}
          <div className="flex items-center justify-between gap-4 mt-4">
            {/* Left: Title + Description */}
            <div className="flex-shrink-0">
              <h1 className="text-xl font-bold text-white">{category.name}</h1>
              {category.description && (
                <p className="text-sm text-gray-300 mt-1">{category.description}</p>
              )}
            </div>

            {/* Right: Service Count */}
            <div className="flex items-center gap-4 flex-shrink-0">
              <div className="text-right">
                <div className="text-lg font-bold text-white">{totalServices}+</div>
                <div className="text-xs text-gray-400">Services</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Subcategory badges */}
      {subcategories.length > 0 && (
        <div className="bg-white border-b border-gray-200">
          <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-3">
            <div className="flex flex-wrap gap-1.5">
              {subcategories.map((sub) => (
                <Link
                  key={sub.id}
                  href={`${buildServiceCategoryPath(category)}/${sub.slug}`}
                  className="px-3 py-1 rounded-md text-sm font-medium bg-gray-100 text-gray-600 hover:bg-ink/90 hover:text-white transition-colors"
                >
                  {sub.name}
                  {sub.services_count !== undefined && (
                    <span className="ml-1 text-xs opacity-70">({sub.services_count})</span>
                  )}
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Services grid */}
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-bold text-gray-900">
            {category.name}
            <span className="ml-2 text-gray-500 text-sm">({totalServices})</span>
          </h3>
        </div>

        {/* Category description — real body copy for both shoppers and search engines to
            match against, not just a service grid. The hero above carries a short one-line
            subtitle; this is the fuller version. */}
        {category.description && (
          <p className="text-sm text-gray-600 leading-relaxed max-w-3xl mb-5 whitespace-pre-line">
            {category.description}
          </p>
        )}

        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-5">
            {[...Array(10)].map((_, i) => (
              <div key={i} className="bg-gray-50 rounded-xl border border-gray-200 shadow-sm overflow-hidden animate-pulse">
                <div className="w-full h-32 bg-gray-200" />
                <div className="p-4 space-y-2">
                  <div className="h-3 bg-gray-200 rounded w-1/2" />
                  <div className="h-4 bg-gray-200 rounded w-3/4" />
                  <div className="h-5 bg-gray-200 rounded w-1/3 mt-2" />
                </div>
              </div>
            ))}
          </div>
        ) : services.length === 0 ? (
          <div className="text-center py-8">
            <div className="text-gray-400 text-2xl mb-4">🔧</div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">No services found</h3>
            <p className="text-gray-600">Try browsing a subcategory instead</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-5">
              {services.map((service) => (
                <ServiceCard key={service.id} service={service} />
              ))}
            </div>
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-5">
                <button onClick={() => setCurrentPage((p) => Math.max(1, p - 1))} disabled={currentPage === 1} className="p-1.5 rounded border border-gray-200 disabled:opacity-50 hover:bg-gray-50">
                  <ChevronLeftIcon className="h-4 w-4" />
                </button>
                <span className="text-sm text-gray-600">Page {currentPage} of {totalPages}</span>
                <button onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="p-1.5 rounded border border-gray-200 disabled:opacity-50 hover:bg-gray-50">
                  <ChevronRightIcon className="h-4 w-4" />
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────
// ServiceDetailView — full booking page (ported from [id]/page.tsx)
// ──────────────────────────────────────────────────────────────
function ServiceDetailView({ initialService }: { initialService: Service }) {
  const router = useRouter();
  const { isAuthenticated, user } = useAuthStore();

  const service = initialService;
  const [showOrderForm, setShowOrderForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState<string | null>(null);

  // Location data
  const [divisions, setDivisions] = useState<Division[]>([]);
  const [districts, setDistricts] = useState<District[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);

  // Form fields
  const [customerName, setCustomerName] = useState(user?.name || '');
  const [customerPhone, setCustomerPhone] = useState(user?.phone || '');
  const [customerEmail, setCustomerEmail] = useState(user?.email || '');
  const [customerAddress, setCustomerAddress] = useState('');
  const [divisionId, setDivisionId] = useState<number>(0);
  const [districtId, setDistrictId] = useState<number>(0);
  const [areaId, setAreaId] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<string>('bkash');
  const [customerNotes, setCustomerNotes] = useState('');

  useEffect(() => {
    if (showOrderForm && divisions.length === 0) {
      locationService.getDivisions().then(setDivisions).catch(() => {});
    }
  }, [showOrderForm, divisions.length]);

  useEffect(() => {
    if (divisionId) {
      locationService.getDistricts(divisionId).then(setDistricts).catch(() => setDistricts([]));
      setDistrictId(0);
      setAreaId(0);
      setAreas([]);
    }
  }, [divisionId]);

  useEffect(() => {
    if (districtId) {
      locationService.getAreas(districtId).then(setAreas).catch(() => setAreas([]));
      setAreaId(0);
    }
  }, [districtId]);

  const handleBookNow = () => {
    setShowOrderForm(true);
  };

  const handlePlaceOrder = async () => {
    if (!customerName || !customerPhone || !customerAddress || !divisionId || !districtId) {
      toast.error('Please fill in all required fields');
      return;
    }
    setSubmitting(true);
    try {
      const orderPayload: any = {
        service_id: service.id,
        payment_method: paymentMethod,
        customer_name: customerName,
        customer_phone: customerPhone,
        customer_email: customerEmail || undefined,
        customer_address: customerAddress,
        division_id: divisionId,
        district_id: districtId,
        area_id: areaId || undefined,
        customer_notes: customerNotes || undefined,
      };
      if (typeof service.vendor_profile_id === 'number') {
        orderPayload.vendor_profile_id = service.vendor_profile_id;
      }
      const order = isAuthenticated
        ? await orderService.placeServiceOrder(orderPayload)
        : await guestCartService.placeServiceOrder({
            ...orderPayload,
            session_id: typeof window !== 'undefined'
              ? (localStorage.getItem('guest_session_id') || undefined)
              : undefined,
          });
      setOrderSuccess(order.order_number || `#${order.id}`);
      toast.success('Service order placed successfully!');
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Failed to place order');
    } finally {
      setSubmitting(false);
    }
  };

  // Build breadcrumb from service's category
  const breadcrumbItems = [
    { name: 'Services', href: '/services' },
    ...(service.category?.breadcrumb ?? (service.category ? [{ id: service.category.id, name: service.category.name, slug: service.category.slug }] : [])).map((b, i, arr) => ({
      name: b.name,
      href: '/services/' + arr.slice(0, i + 1).map(x => x.slug).join('/'),
    })),
    { name: service.name },
  ];

  // Order success screen
  if (orderSuccess) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-5 sm:p-8 text-center mx-4">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircleIcon className="h-12 w-12 text-green-500" />
          </div>
          <h1 className="text-2xl sm:text-2xl font-bold text-gray-900 mb-3">Service Booked!</h1>
          <p className="text-gray-600 mb-2">Your service order has been placed.</p>
          <div className="bg-gray-50 rounded-xl p-4 mb-6">
            <p className="text-sm text-gray-600 mb-1">Order Number:</p>
            <p className="font-bold text-gray-900 text-xl">{orderSuccess}</p>
            <p className="text-sm text-gray-500 mt-2">Service: {service.name}</p>
          </div>
          <p className="text-sm text-gray-500 mb-6">
            {paymentMethod === 'bkash' && 'Please complete your bKash payment. Check your order details for payment instructions.'}
            {paymentMethod === 'cash' && 'You will pay cash when the service is provided.'}
            {paymentMethod === 'bank_transfer' && 'Please transfer to the bank account shown in your order details.'}
          </p>
          <div className="flex space-x-3">
            <Link
              href={isAuthenticated ? '/dashboard' : '/orders/track'}
              className="flex-1 px-6 py-3 bg-gradient-to-r from-ink to-ink text-white font-semibold rounded-xl hover:shadow-lg transition-all text-center"
            >
              {isAuthenticated ? 'View Orders' : 'Track Order'}
            </Link>
            <Link href="/services" className="flex-1 px-6 py-3 border-2 border-gray-200 text-gray-700 font-semibold rounded-xl hover:bg-gray-50 transition-all text-center">
              More Services
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-50 min-h-screen">
      {/* Breadcrumb */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <Breadcrumb items={breadcrumbItems} />
        </div>
      </div>

      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid lg:grid-cols-3 gap-5">
          {/* Left Column — Service Details */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden mb-6">
              <div className="aspect-video bg-gradient-to-br from-gray-200 to-red-50 flex items-center justify-center overflow-hidden">
                {service.image ? (
                  <img src={getStorageUrl(service.image)} alt={service.name} className="w-full h-full object-cover" />
                ) : (
                  <WrenchScrewdriverIcon className="h-24 w-24 text-gray-500" />
                )}
              </div>

              {service.gallery && service.gallery.length > 0 && (
                <div className="grid grid-cols-3 gap-2 p-4 bg-gray-50 border-t border-gray-100">
                  {service.gallery.map((img, idx) => (
                    <div key={idx} className="aspect-square overflow-hidden rounded-lg border border-gray-200">
                      <img src={getStorageUrl(img)} alt={`${service.name} ${idx + 1}`} className="w-full h-full object-cover hover:scale-105 transition-transform cursor-pointer" />
                    </div>
                  ))}
                </div>
              )}

              <div className="p-8">
                <div className="flex items-center gap-3 mb-4">
                  {service.category && (
                    <span className="text-sm font-medium text-gray-900 bg-gray-100 px-3 py-1 rounded-full">{service.category.name}</span>
                  )}
                  {service.is_active && (
                    <span className="text-sm font-medium text-green-600 bg-green-50 px-3 py-1 rounded-full flex items-center gap-1">
                      <CheckCircleIcon className="h-4 w-4" />Available
                    </span>
                  )}
                </div>
                <h1 className="text-2xl font-bold text-gray-900 mb-4">{service.name}</h1>
                {/* Vendor attribution hidden — vendor feature disabled */}
                <div className="rich-content text-gray-700" dangerouslySetInnerHTML={{ __html: service.description || '' }} />

                <div className="mt-5 grid md:grid-cols-2 gap-4">
                  {service.duration_estimate && (
                    <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl">
                      <ClockIcon className="h-6 w-6 text-gray-800" />
                      <div>
                        <p className="text-sm text-gray-600">Estimated Duration</p>
                        <p className="font-semibold text-gray-900">{service.duration_estimate}</p>
                      </div>
                    </div>
                  )}
                  <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl">
                    <ShieldCheckIcon className="h-6 w-6 text-gray-800" />
                    <div>
                      <p className="text-sm text-gray-600">Warranty</p>
                      <p className="font-semibold text-gray-900">90 Days</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl">
                    <WrenchScrewdriverIcon className="h-6 w-6 text-gray-800" />
                    <div>
                      <p className="text-sm text-gray-600">Service Code</p>
                      <p className="font-semibold text-gray-900">{service.code}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl">
                    <CreditCardIcon className="h-6 w-6 text-gray-800" />
                    <div>
                      <p className="text-sm text-gray-600">Price</p>
                      <p className="font-semibold text-gray-900">
                        ৳{Number(service.discount_price ?? service.base_price).toLocaleString()}
                      </p>
                      {service.discount_price && (
                        <p className="text-xs text-gray-400 line-through">৳{Number(service.base_price).toLocaleString()}</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column — Booking Card or Order Form */}
          <div>
            {!showOrderForm ? (
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 sticky top-6">
                <div className="text-center mb-6">
                  <p className="text-sm text-gray-500">Service Price</p>
                  <div className="flex items-baseline justify-center gap-2 mt-1">
                    <span className="text-xl font-bold text-gray-900">৳{Number(service.discount_price ?? service.base_price).toLocaleString()}</span>
                    {service.discount_price && (
                      <span className="text-lg text-gray-400 line-through">৳{Number(service.base_price).toLocaleString()}</span>
                    )}
                  </div>
                </div>
                <button
                  onClick={handleBookNow}
                  disabled={!service.is_active}
                  className={`w-full px-6 py-4 font-bold text-lg rounded-xl transition-all ${
                    service.is_active
                      ? 'bg-gradient-to-r from-ink to-ink text-white hover:shadow-md hover:scale-105'
                      : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                  }`}
                >
                  {service.is_active ? 'Book This Service' : 'Currently Unavailable'}
                </button>
                <div className="mt-6 space-y-3">
                  <div className="flex items-center text-sm text-gray-600">
                    <CheckCircleIcon className="h-5 w-5 text-green-500 mr-2" />No hidden charges
                  </div>
                  <div className="flex items-center text-sm text-gray-600">
                    <ShieldCheckIcon className="h-5 w-5 text-green-500 mr-2" />Service warranty included
                  </div>
                  <div className="flex items-center text-sm text-gray-600">
                    <ClockIcon className="h-5 w-5 text-green-500 mr-2" />Fast turnaround time
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 sticky top-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-bold text-gray-900">Book Service</h2>
                  <button onClick={() => setShowOrderForm(false)} className="text-gray-500 hover:text-gray-600">
                    <ArrowLeftIcon className="h-5 w-5" />
                  </button>
                </div>
                <div className="bg-gray-100 rounded-xl p-4 mb-6">
                  <p className="font-semibold text-gray-900">{service.name}</p>
                  <p className="text-gray-900 font-bold text-lg">৳{Number(service.discount_price ?? service.base_price).toLocaleString()}</p>
                  {service.discount_price && (
                    <p className="text-gray-600 text-xs line-through">৳{Number(service.base_price).toLocaleString()}</p>
                  )}
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Full Name *</label>
                    <input type="text" value={customerName} onChange={(e) => setCustomerName(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-ink focus:border-ink outline-none text-sm" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Phone *</label>
                    <input type="tel" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-ink focus:border-ink outline-none text-sm" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                    <input type="email" value={customerEmail} onChange={(e) => setCustomerEmail(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-ink focus:border-ink outline-none text-sm" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Division *</label>
                    <select value={divisionId} onChange={(e) => setDivisionId(Number(e.target.value))} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-ink focus:border-ink outline-none text-sm">
                      <option value={0}>Select Division</option>
                      {divisions.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">District *</label>
                    <select value={districtId} onChange={(e) => setDistrictId(Number(e.target.value))} disabled={!divisionId} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-ink focus:border-ink outline-none text-sm disabled:bg-gray-100">
                      <option value={0}>Select District</option>
                      {districts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Area</label>
                    <select value={areaId} onChange={(e) => setAreaId(Number(e.target.value))} disabled={!districtId} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-ink focus:border-ink outline-none text-sm disabled:bg-gray-100">
                      <option value={0}>Select Area</option>
                      {areas.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Address *</label>
                    <textarea value={customerAddress} onChange={(e) => setCustomerAddress(e.target.value)} rows={2} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-ink focus:border-ink outline-none text-sm" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Payment Method</label>
                    <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-ink focus:border-ink outline-none text-sm">
                      <option value="bkash">bKash</option>
                      <option value="cash">Cash</option>
                      <option value="bank_transfer">Bank Transfer</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                    <textarea value={customerNotes} onChange={(e) => setCustomerNotes(e.target.value)} rows={2} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-ink focus:border-ink outline-none text-sm" placeholder="Describe your issue..." />
                  </div>
                </div>
                <button
                  onClick={handlePlaceOrder}
                  disabled={submitting}
                  className={`w-full mt-6 px-6 py-4 font-bold text-lg rounded-xl transition-all ${
                    submitting ? 'bg-gray-300 text-gray-500 cursor-not-allowed' : 'bg-gradient-to-r from-ink to-ink text-white hover:shadow-md'
                  }`}
                >
                  {submitting ? 'Processing...' : `Confirm Booking • ৳${Number(service.discount_price ?? service.base_price).toLocaleString()}`}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
