'use client';

import Link from 'next/link';
import { getStorageUrl } from '@/lib/api/config';
import { Service } from '@/lib/types';
import { ClockIcon, WrenchScrewdriverIcon } from '@heroicons/react/24/outline';

export default function ServiceCard({ service }: { service: Service }) {
  const currentPrice = service.discount_price ?? service.base_price;
  const originalPrice = service.discount_price ? service.base_price : null;
  const discountPct = originalPrice
    ? Math.round((1 - Number(currentPrice) / Number(originalPrice)) * 100)
    : null;

  return (
    <Link
      href={`/services/${service.slug || service.id}`}
      className="group flex flex-col h-full bg-gray-50 rounded-xl border border-gray-200 shadow-sm overflow-hidden hover:shadow-md hover:border-gray-300 transition-all duration-300 hover:-translate-y-1"
    >
      {/* Image */}
      <div className="relative overflow-hidden bg-gradient-to-br from-gray-100 to-gray-200 h-32 flex-shrink-0">
        {service.image ? (
          <img
            src={getStorageUrl(service.image)}
            alt={service.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <WrenchScrewdriverIcon className="w-12 h-12 text-gray-400" />
          </div>
        )}
        {discountPct !== null && discountPct > 0 && (
          <span className="absolute top-3 left-3 bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-lg">
            -{discountPct}%
          </span>
        )}
        {service.duration_estimate && (
          <span className="absolute top-3 right-3 bg-black/70 text-white text-xs font-medium px-2 py-1 rounded-lg flex items-center gap-1">
            <ClockIcon className="w-3 h-3" />
            {service.duration_estimate}
          </span>
        )}
      </div>

      {/* Info */}
      <div className="p-4 flex flex-col flex-1">
        <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">
          {service.category?.name || 'Service'}
        </p>
        <h3 className="text-base font-semibold text-gray-900 line-clamp-2 mb-3 leading-snug min-h-[2.75rem] group-hover:text-gray-700">
          {service.name}
        </h3>
        <div className="flex items-center gap-2 mt-auto">
          <span className="text-lg font-bold text-gray-900">
            ৳{Number(currentPrice).toLocaleString()}
          </span>
          {originalPrice !== null && (
            <span className="text-sm text-gray-400 line-through">
              ৳{Number(originalPrice).toLocaleString()}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
