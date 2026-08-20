'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { serviceService, locationService, orderService, guestCartService, cmsService } from '@/lib/api';
import { getStorageUrl } from '@/lib/api/config';
import { pickString } from '@/lib/seo';
import { Service, ServiceCategory, Division, District, Area } from '@/lib/types';
import { useAuthStore } from '@/lib/stores/auth-store';
import Breadcrumb from '@/components/Breadcrumb';
import { resolveIcon } from '@/lib/resolve-icon';
import {
  ClockIcon,
  CheckCircleIcon,
  ShieldCheckIcon,
  WrenchScrewdriverIcon,
  ArrowLeftIcon,
  CreditCardIcon,
  BoltIcon,
  UserGroupIcon,
  TrophyIcon,
  PhoneIcon,
  ClipboardDocumentCheckIcon,
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

// Same trust copy already used sitewide on /services ("Why Choose Gadget Revive?") — reused
// here rather than invented per-category, since it's real, vetted marketing copy already live.
const TRUST_ITEMS = [
  { icon: ShieldCheckIcon, title: '90-Day Warranty' },
  { icon: BoltIcon, title: 'Same Day Service' },
  { icon: UserGroupIcon, title: 'Expert Technicians' },
  { icon: TrophyIcon, title: 'Genuine Parts' },
];

// Generic booking flow, true for every category (see ServiceDetailView's order form below) —
// not category-specific claims, just how ordering actually works on this site.
const HOW_IT_WORKS_STEPS = [
  { icon: WrenchScrewdriverIcon, title: 'Choose Your Service', description: 'Browse the list below and pick the exact service you need.' },
  { icon: ClipboardDocumentCheckIcon, title: 'Book & Confirm', description: 'Add your details, address and preferred payment method.' },
  { icon: ClockIcon, title: 'We Get To Work', description: 'Our technician takes care of it at your convenience.' },
  { icon: CreditCardIcon, title: "Pay & You're Done", description: 'Pay via bKash, cash, or bank transfer once it’s complete.' },
];

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
  const [phone, setPhone] = useState('');

  useEffect(() => {
    cmsService.getSettings().then((s) => {
      // topbar_phone is the real, filled-in number (same one Header/Footer/HomeClient show);
      // contact_phone is an unfilled placeholder in current site settings — prefer topbar_phone.
      setPhone(pickString(s.topbar_phone, s.contact_phone));
    }).catch(() => {});
  }, []);

  // Breadcrumb items
  const breadcrumbItems = [
    { name: 'Services', href: '/services' },
    ...(category.breadcrumb ?? [{ id: category.id, name: category.name, slug: category.slug }]).map((b) => ({
      name: b.name,
      href: buildServiceCategoryPath({ ...category, breadcrumb: category.breadcrumb?.slice(0, (category.breadcrumb?.findIndex(x => x.id === b.id) ?? 0) + 1) }),
    })),
  ];

  const totalServices = category.services_count ?? 0;
  const tierServices = category.tier_services ?? [];
  const CategoryIcon = resolveIcon(category.icon);

  return (
    <div className="bg-white min-h-screen">
      {/* Hero — category identity, real "starting from" price, and a single Book CTA that
          jumps straight to the services grid (a category has many bookable services, so there's
          no one thing to "book" from up here — this just gets shoppers to the list fast). */}
      <div className="bg-gradient-to-r from-ink to-ink">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
          <Breadcrumb items={breadcrumbItems} darkBg={true} />

          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 mt-5">
            {/* Left: Title, description, stats, CTA */}
            <div className="max-w-2xl">
              <h1 className="text-2xl sm:text-3xl font-bold text-white">{category.name}</h1>
              {category.description && (
                <p className="text-sm sm:text-base text-gray-300 mt-2 leading-relaxed">{category.description}</p>
              )}

              <div className="flex flex-wrap items-center gap-2 mt-4">
                {category.starting_price != null && (
                  <span className="inline-flex items-center rounded-full bg-white/10 border border-white/20 px-3 py-1 text-xs font-semibold text-white">
                    Starting from ৳{Number(category.starting_price).toLocaleString()}
                  </span>
                )}
                <span className="inline-flex items-center rounded-full bg-white/10 border border-white/20 px-3 py-1 text-xs font-semibold text-white">
                  {totalServices}+ Services
                </span>
              </div>

              <a
                href="#services-grid"
                className="inline-flex items-center gap-2 mt-5 rounded-xl bg-white px-6 py-3 text-sm font-bold text-ink hover:bg-gray-100 transition-colors"
              >
                Book A Service
              </a>
            </div>

            {/* Right: category image / icon watermark */}
            <div className="relative w-full sm:w-72 lg:w-80 aspect-[4/3] flex-shrink-0 rounded-2xl overflow-hidden bg-white/5 border border-white/10">
              {category.image ? (
                <img src={getStorageUrl(category.image)} alt={category.name} className="h-full w-full object-contain p-6" />
              ) : (
                <div className="flex h-full w-full items-center justify-center">
                  <CategoryIcon className="h-20 w-20 text-white/25" />
                </div>
              )}
            </div>
          </div>

          {/* Trust strip — real, sitewide copy (see TRUST_ITEMS), not per-category claims */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-7 pt-6 border-t border-white/10">
            {TRUST_ITEMS.map((item) => (
              <div key={item.title} className="flex items-center gap-2">
                <item.icon className="h-5 w-5 text-white/70 flex-shrink-0" />
                <span className="text-xs sm:text-sm text-gray-300 leading-tight">{item.title}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Book a service — 3 real services (cheapest/middle/priciest) relabeled as a simple
          Basic/Minor/Major pricing ladder, centered, instead of the full catalog grid. */}
      <div id="services-grid" className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10 scroll-mt-4">
        <div className="text-center mb-7">
          <h3 className="text-lg sm:text-xl font-bold text-gray-900">Book {category.name}</h3>
          {totalServices > 0 && (
            <p className="text-sm text-gray-500 mt-1">{totalServices} service{totalServices === 1 ? '' : 's'} available in this category</p>
          )}
        </div>

        {tierServices.length === 0 ? (
          <div className="text-center py-8">
            <div className="text-gray-400 text-2xl mb-4">🔧</div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">No services found</h3>
            <p className="text-gray-600">Please check back soon</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 max-w-4xl mx-auto">
            {tierServices.map((svc) => (
              <Link
                key={svc.id}
                href={`/services/${svc.slug}`}
                className="group flex flex-col rounded-2xl border border-gray-200 bg-white overflow-hidden hover:border-ink hover:shadow-lg transition-all duration-200"
              >
                <div className="relative h-36 bg-gray-50 overflow-hidden flex-shrink-0">
                  {svc.image ? (
                    <img src={getStorageUrl(svc.image)} alt={svc.name} className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center">
                      <CategoryIcon className="h-10 w-10 text-gray-300" />
                    </div>
                  )}
                  {svc.tier && (
                    <span className="absolute top-3 left-3 rounded-full bg-ink text-white text-xs font-bold px-3 py-1">{svc.tier}</span>
                  )}
                </div>
                <div className="p-5 flex flex-col flex-1 text-center">
                  <h4 className="font-semibold text-gray-900 group-hover:text-ink transition-colors">{svc.name}</h4>
                  {svc.short_description && (
                    <p className="text-xs text-gray-500 mt-1 line-clamp-2">{svc.short_description}</p>
                  )}
                  <div className="mt-3 flex items-center justify-center gap-2">
                    <span className="text-lg font-bold text-gray-900">৳{Number(svc.price).toLocaleString()}</span>
                    {svc.duration_estimate && (
                      <span className="text-xs text-gray-400">• {svc.duration_estimate}</span>
                    )}
                  </div>
                  <span className="mt-4 inline-flex items-center justify-center gap-1 rounded-lg bg-ink/5 text-ink text-sm font-semibold py-2 group-hover:bg-ink group-hover:text-white transition-colors">
                    Book Now
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}

        {totalServices > tierServices.length && (
          <p className="text-center text-sm text-gray-500 mt-6">
            Looking for something else? <Link href="/services" className="font-semibold text-ink hover:underline">Browse all services</Link>
          </p>
        )}
      </div>

      {/* How It Works — the real booking flow (see ServiceDetailView's order form), not
          category-specific claims, so it holds true on every category page. */}
      <div className="bg-gray-50 border-t border-gray-200 py-8 sm:py-10">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-lg sm:text-xl font-bold text-gray-900 text-center mb-6">How It Works</h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {HOW_IT_WORKS_STEPS.map((step, i) => (
              <div key={step.title} className="bg-white rounded-xl border border-gray-200 p-4 text-center">
                <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-ink/5">
                  <step.icon className="h-5 w-5 text-ink" />
                </div>
                <h3 className="text-sm font-semibold text-gray-900">{i + 1}. {step.title}</h3>
                <p className="text-xs text-gray-500 mt-1 leading-snug">{step.description}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* CTA */}
      <div className="bg-gradient-to-r from-gray-700 to-ink py-8">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-xl sm:text-2xl font-bold text-white mb-3">Need Help With {category.name}?</h2>
          <p className="text-gray-200 mb-5 max-w-xl mx-auto">Book online in minutes, or speak to our team for a free consultation.</p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <a href="#services-grid" className="inline-flex items-center justify-center gap-2 bg-white text-gray-900 px-6 py-3 rounded-xl font-bold hover:bg-gray-50 transition-all">
              Book A Service
            </a>
            {phone && (
              <a href={`tel:${phone}`} className="inline-flex items-center justify-center gap-2 bg-white/10 border-2 border-white/30 text-white px-6 py-3 rounded-xl font-bold hover:bg-white/20 transition-all">
                <PhoneIcon className="h-5 w-5" />Call: {phone}
              </a>
            )}
          </div>
        </div>
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
      {/* Hero — same visual language as the category page: dark gradient, breadcrumb, real
          price/duration, trust strip, single CTA that jumps to the booking card below. */}
      <div className="bg-gradient-to-r from-ink to-ink">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
          <Breadcrumb items={breadcrumbItems} darkBg={true} />

          <div className="mt-5 max-w-2xl">
            <div className="flex flex-wrap items-center gap-2 mb-3">
              {service.category && (
                <span className="inline-flex items-center rounded-full bg-white/10 border border-white/20 px-3 py-1 text-xs font-semibold text-white">
                  {service.category.name}
                </span>
              )}
              {service.is_active ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-400/15 border border-emerald-400/30 px-3 py-1 text-xs font-semibold text-emerald-300">
                  <CheckCircleIcon className="h-3.5 w-3.5" />Available Now
                </span>
              ) : (
                <span className="inline-flex items-center rounded-full bg-white/10 border border-white/20 px-3 py-1 text-xs font-semibold text-gray-300">
                  Currently Unavailable
                </span>
              )}
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-white">{service.name}</h1>

            <div className="flex flex-wrap items-center gap-2 mt-4">
              <span className="inline-flex items-center rounded-full bg-white/10 border border-white/20 px-3 py-1 text-xs font-semibold text-white">
                ৳{Number(service.discount_price ?? service.base_price).toLocaleString()}
                {service.discount_price && (
                  <span className="ml-1.5 text-gray-400 line-through font-normal">৳{Number(service.base_price).toLocaleString()}</span>
                )}
              </span>
              {service.duration_estimate && (
                <span className="inline-flex items-center rounded-full bg-white/10 border border-white/20 px-3 py-1 text-xs font-semibold text-white">
                  {service.duration_estimate}
                </span>
              )}
            </div>

            <a
              href="#booking-card"
              className="inline-flex items-center gap-2 mt-5 rounded-xl bg-white px-6 py-3 text-sm font-bold text-ink hover:bg-gray-100 transition-colors"
            >
              Book This Service
            </a>
          </div>

          {/* Trust strip — same real, sitewide copy as the category page */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-7 pt-6 border-t border-white/10">
            {TRUST_ITEMS.map((item) => (
              <div key={item.title} className="flex items-center gap-2">
                <item.icon className="h-5 w-5 text-white/70 flex-shrink-0" />
                <span className="text-xs sm:text-sm text-gray-300 leading-tight">{item.title}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid lg:grid-cols-3 gap-5">
          {/* Left Column — Service Details */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden mb-6">
              <div className="aspect-video bg-gray-100 flex items-center justify-center overflow-hidden">
                {service.image ? (
                  <img src={getStorageUrl(service.image)} alt={service.name} className="w-full h-full object-cover" />
                ) : (
                  <WrenchScrewdriverIcon className="h-24 w-24 text-gray-300" />
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

              <div className="p-6 sm:p-8">
                <h2 className="text-lg font-bold text-gray-900 mb-3">About This Service</h2>
                {/* Vendor attribution hidden — vendor feature disabled */}
                <div className="rich-content text-gray-700" dangerouslySetInnerHTML={{ __html: service.description || '' }} />

                {service.features && service.features.length > 0 && (
                  <div className="mt-6">
                    <h3 className="text-sm font-bold text-gray-900 mb-3">What&apos;s Included</h3>
                    <ul className="grid sm:grid-cols-2 gap-2">
                      {service.features.map((f, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                          <CheckCircleIcon className="h-4 w-4 text-emerald-500 flex-shrink-0 mt-0.5" />
                          {f}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="mt-6 grid sm:grid-cols-2 gap-3">
                  {service.duration_estimate && (
                    <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-ink/5 flex-shrink-0">
                        <ClockIcon className="h-5 w-5 text-ink" />
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Estimated Duration</p>
                        <p className="font-semibold text-gray-900 text-sm">{service.duration_estimate}</p>
                      </div>
                    </div>
                  )}
                  <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-ink/5 flex-shrink-0">
                      <ShieldCheckIcon className="h-5 w-5 text-ink" />
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Warranty</p>
                      <p className="font-semibold text-gray-900 text-sm">90 Days</p>
                    </div>
                  </div>
                  {service.code && (
                    <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-ink/5 flex-shrink-0">
                        <WrenchScrewdriverIcon className="h-5 w-5 text-ink" />
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Service Code</p>
                        <p className="font-semibold text-gray-900 text-sm">{service.code}</p>
                      </div>
                    </div>
                  )}
                  <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-ink/5 flex-shrink-0">
                      <CreditCardIcon className="h-5 w-5 text-ink" />
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Price</p>
                      <p className="font-semibold text-gray-900 text-sm">
                        ৳{Number(service.discount_price ?? service.base_price).toLocaleString()}
                        {service.discount_price && (
                          <span className="ml-1.5 text-xs text-gray-400 line-through font-normal">৳{Number(service.base_price).toLocaleString()}</span>
                        )}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* How It Works — same real booking-flow steps as the category page */}
            <div className="bg-white rounded-2xl border border-gray-200 p-6 sm:p-8">
              <h2 className="text-lg font-bold text-gray-900 mb-5">How It Works</h2>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {HOW_IT_WORKS_STEPS.map((step, i) => (
                  <div key={step.title} className="text-center">
                    <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-ink/5">
                      <step.icon className="h-5 w-5 text-ink" />
                    </div>
                    <h3 className="text-sm font-semibold text-gray-900">{i + 1}. {step.title}</h3>
                    <p className="text-xs text-gray-500 mt-1 leading-snug">{step.description}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right Column — Booking Card or Order Form */}
          <div id="booking-card">
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
