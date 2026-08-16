'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { serviceService } from '@/lib/api';
import { Service, ServiceCategory } from '@/lib/types';
import ServiceCard from '@/components/ServiceCard';
import {
  ShieldCheckIcon,
  PhoneIcon,
  TrophyIcon,
  BoltIcon,
  UserGroupIcon,
  ArrowRightIcon,
  MagnifyingGlassIcon,
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

function ServicesContent() {
  const [services, setServices] = useState<Service[]>([]);
  const [rootCategories, setRootCategories] = useState<ServiceCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalServices, setTotalServices] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);

  // The search term is driven by the shared top-nav search bar via the URL
  // (?search=), so there is no separate search box on this page.
  const searchParams = useSearchParams();
  const searchQuery = (searchParams.get('search') ?? '').trim();

  // Reset to the first page whenever the search term changes.
  useEffect(() => { setCurrentPage(1); }, [searchQuery]);

  const fetchServices = useCallback(async () => {
    try {
      setLoading(true);
      const params: any = { page: currentPage, per_page: 9 };
      if (searchQuery) params.search = searchQuery;

      const result = await serviceService.getAll(params);
      setServices(result.data);
      setTotalServices(result.meta.total);
      setLastPage(result.meta.last_page);
    } catch (error) {
      console.error('Failed to fetch services:', error);
      toast.error('Failed to load services');
    } finally {
      setLoading(false);
    }
  }, [currentPage, searchQuery]);

  useEffect(() => {
    serviceService.getCategories().then((cats) => {
      setRootCategories(cats.filter((c) => !c.parent_id));
    }).catch(() => {});
  }, []);

  useEffect(() => { fetchServices(); }, [fetchServices]);

  return (
    <div className="bg-white">
      {/* Hero Section */}
      <div className="bg-gradient-to-r from-ink to-ink">
        <div className="mx-auto max-w-[1600px] px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between gap-4">
            {/* Left: Title + Description */}
            <div className="flex-shrink-0">
              <h1 className="text-xl font-bold text-white">Repair Services</h1>
              <p className="text-sm text-gray-300">Find the right service for your device</p>
            </div>

            {/* Right: Stats */}
            <div className="flex items-center gap-4 flex-shrink-0">
              <div className="text-right">
                <div className="text-lg font-bold text-white">{totalServices}+</div>
                <div className="text-xs text-gray-400">Services</div>
              </div>
              {/* <div className="border-l border-gray-600 pl-4 text-right">
                <div className="text-base font-bold text-white">Same Day</div>
                <div className="text-xs text-gray-400">Repairs</div>
              </div>
              <div className="border-l border-gray-600 pl-4 text-right hidden sm:block">
                <div className="text-base font-bold text-white">90 Days</div>
                <div className="text-xs text-gray-400">Warranty</div>
              </div> */}
            </div>
          </div>
        </div>
      </div>

      {/* Root Category Links */}
      {rootCategories.length > 0 && (
        <div className="bg-white border-b border-gray-200">
          <div className="mx-auto max-w-[1600px] px-4 sm:px-6 lg:px-8 py-3">
            <div className="flex flex-wrap gap-1.5">
              {rootCategories.map((cat) => (
                <Link
                  key={cat.id}
                  href={`/services/${cat.slug}`}
                  className="px-3 py-1 rounded-md text-sm font-medium bg-gray-100 border border-gray-200 text-gray-600 hover:bg-ink/90 hover:border-ink hover:text-white transition-colors"
                >
                  {cat.name}
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Services Grid */}
      <div className="mx-auto max-w-[1600px] px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-4 flex items-center justify-between gap-4 flex-wrap">
          <h3 className="text-lg font-bold text-gray-900 inline-flex items-center">
            {searchQuery ? (
              <>
                <MagnifyingGlassIcon className="h-5 w-5 text-gray-400 mr-2" />
                Results for &quot;{searchQuery}&quot;
              </>
            ) : (
              'All Services'
            )}
            <span className="ml-2 text-gray-500 text-sm">({totalServices})</span>
          </h3>
          {searchQuery && (
            <Link href="/services" className="text-sm font-medium text-gray-600 hover:text-gray-900">
              Clear search
            </Link>
          )}
        </div>

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
            <p className="text-gray-600">Try selecting a different category or adjusting your search</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-5">
            {services.map((service) => (
              <ServiceCard key={service.id} service={service} />
            ))}
          </div>
        )}

        {/* Pagination */}
        {lastPage > 1 && (
          <div className="flex justify-center mt-6 space-x-2">
            {Array.from({ length: lastPage }, (_, i) => i + 1).map((page) => (
              <button
                key={page}
                onClick={() => setCurrentPage(page)}
                className={`px-4 py-2 rounded-lg font-medium transition-all ${
                  page === currentPage
                    ? 'bg-ink text-white'
                    : 'bg-white border border-gray-200 text-gray-700 hover:border-gray-500'
                }`}
              >
                {page}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Why Choose Us */}
      <div className="bg-gradient-to-b from-gray-50 to-white py-8">
        <div className="mx-auto max-w-[1600px] px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-6">
            <h2 className="text-xl sm:text-2xl lg:text-2xl font-bold text-gray-900 mb-4 leading-tight">Why Choose Gadget Revive?</h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">Professional repair services with guaranteed quality and customer satisfaction</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            {[
              { icon: ShieldCheckIcon, title: '90-Day Warranty', desc: 'All repairs come with our comprehensive 90-day warranty for peace of mind', color: 'from-ink to-ink' },
              { icon: BoltIcon, title: 'Same Day Service', desc: 'Most repairs completed the same day. We value your time as much as you do', color: 'from-blue-500 to-indigo-600' },
              { icon: UserGroupIcon, title: 'Expert Technicians', desc: 'Certified professionals with years of experience in device repairs', color: 'from-green-500 to-emerald-600' },
              { icon: TrophyIcon, title: 'Genuine Parts', desc: 'We use only authentic parts to ensure quality and longevity of repairs', color: 'from-purple-500 to-pink-600' },
            ].map((item) => (
              <div key={item.title} className="group bg-white rounded-xl p-8 shadow-lg border border-gray-200 hover:border-gray-500 hover:shadow-md transition-all text-center">
                <div className={`mx-auto w-16 h-16 flex items-center justify-center rounded-xl bg-gradient-to-br ${item.color} mb-6 group-hover:scale-110 transition-transform`}>
                  <item.icon className="h-8 w-8 text-white" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-3">{item.title}</h3>
                <p className="text-gray-600 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* CTA Section */}
      <div className="bg-gradient-to-r from-gray-700 to-ink py-8">
        <div className="mx-auto max-w-[1600px] px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h2 className="text-xl sm:text-2xl lg:text-2xl font-bold text-white mb-4">Need Help Choosing the Right Service?</h2>
            <p className="text-xl text-gray-200 mb-5 max-w-2xl mx-auto">Our expert team is here to guide you. Contact us for a free consultation!</p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <a href="tel:+8801711123456" className="inline-flex items-center justify-center gap-2 bg-white text-gray-900 px-8 py-4 rounded-xl font-bold text-lg hover:bg-gray-50 transition-all shadow-md">
                <PhoneIcon className="h-6 w-6" />Call: +880 1711-123456
              </a>
              <Link href="/contact" className="inline-flex items-center justify-center gap-2 bg-white/10 border-2 border-white/30 text-white px-8 py-4 rounded-xl font-bold text-lg hover:bg-white/20 transition-all">
                Visit Our Centers<ArrowRightIcon className="h-5 w-5" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ServicesPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-white" />}>
      <ServicesContent />
    </Suspense>
  );
}
