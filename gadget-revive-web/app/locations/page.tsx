'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import {
  MapPinIcon,
  PhoneIcon,
  EnvelopeIcon,
  ClockIcon,
  ArrowLeftIcon,
  ArrowRightIcon,
  BuildingStorefrontIcon,
  WrenchScrewdriverIcon,
} from '@heroicons/react/24/outline';
import { branchLocationService, BranchLocation } from '@/lib/api/branchLocation';

const BranchMap = dynamic(() => import('@/components/BranchMap'), {
  ssr: false,
  loading: () => <div className="w-full h-full bg-gray-100 animate-pulse" />,
});

export default function LocationsPage() {
  const [locations, setLocations] = useState<BranchLocation[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    branchLocationService
      .getAll()
      .then(setLocations)
      .catch(() => setLocations([]))
      .finally(() => setIsLoading(false));
  }, []);

  const featured = locations.find((l) => l.is_featured);
  const others = locations.filter((l) => !l.is_featured);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 border-2 border-gray-300 border-t-gray-900 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-500 text-sm">Loading locations...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-ink text-white">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-gray-400 hover:text-white text-sm mb-6 transition-colors"
          >
            <ArrowLeftIcon className="h-4 w-4" />
            Back to Home
          </Link>

          <div className="flex items-center gap-4 mb-4">
            <div className="w-14 h-14 bg-white rounded-xl flex items-center justify-center">
              <MapPinIcon className="h-7 w-7 text-gray-900" />
            </div>
            <div>
              <h1 className="text-2xl md:text-2xl font-semibold">Our Locations</h1>
              <p className="text-gray-400">
                {locations.length} service {locations.length === 1 ? 'center' : 'centers'} across Dhaka
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Featured / Main Branch */}
        {featured && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 md:p-8 mb-5">
            <div className="flex items-center gap-2 text-sm text-gray-500 mb-4">
              <span className="px-2.5 py-1 bg-ink text-white text-xs font-semibold rounded-full">
                Main Branch
              </span>
              <span>{featured.type}</span>
            </div>

            <div className="grid md:grid-cols-2 gap-5">
              <div>
                <h2 className="text-2xl font-semibold text-gray-900 mb-2">{featured.name}</h2>
                <p className="text-gray-600 mb-6">{featured.address}</p>

                <div className="space-y-3 mb-6">
                  <a
                    href={`tel:${featured.phone}`}
                    className="flex items-center gap-3 text-gray-700 hover:text-gray-900 transition-colors"
                  >
                    <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                      <PhoneIcon className="h-5 w-5 text-gray-600" />
                    </div>
                    <span>{featured.phone}</span>
                  </a>

                  {featured.email && (
                    <a
                      href={`mailto:${featured.email}`}
                      className="flex items-center gap-3 text-gray-700 hover:text-gray-900 transition-colors"
                    >
                      <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                        <EnvelopeIcon className="h-5 w-5 text-gray-600" />
                      </div>
                      <span>{featured.email}</span>
                    </a>
                  )}

                  {featured.hours && (
                    <div className="flex items-center gap-3 text-gray-700">
                      <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                        <ClockIcon className="h-5 w-5 text-gray-600" />
                      </div>
                      <span>{featured.hours}</span>
                    </div>
                  )}
                </div>

                {featured.map_url && (
                  <a
                    href={featured.map_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-ink text-white font-semibold rounded-lg hover:bg-ink/90 transition-all"
                  >
                    <MapPinIcon className="h-4 w-4" />
                    Get Directions
                    <ArrowRightIcon className="h-4 w-4" />
                  </a>
                )}
              </div>

              <div>
                {featured.services && featured.services.length > 0 && (
                  <>
                    <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
                      Services Available
                    </h3>
                    <div className="flex flex-wrap gap-2 mb-6">
                      {featured.services.map((service, idx) => (
                        <span
                          key={idx}
                          className="px-3 py-1.5 bg-gray-100 text-gray-700 text-sm font-medium rounded-full"
                        >
                          {service}
                        </span>
                      ))}
                    </div>
                  </>
                )}

                <div className="h-48 rounded-xl overflow-hidden border border-gray-200">
                  <BranchMap branches={[featured]} mainBranch={featured} />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Other Locations */}
        {others.length > 0 && (
          <>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              {featured ? 'Other Locations' : 'All Locations'}
            </h2>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
              {others.map((location) => (
                <div
                  key={location.id}
                  className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition-all"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                      {location.type.includes('Store') ? (
                        <BuildingStorefrontIcon className="h-5 w-5 text-gray-600" />
                      ) : (
                        <WrenchScrewdriverIcon className="h-5 w-5 text-gray-600" />
                      )}
                    </div>
                    <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
                      {location.type}
                    </span>
                  </div>

                  <h3 className="font-semibold text-gray-900 mb-1">{location.name}</h3>
                  <p className="text-sm text-gray-500 mb-4">{location.address}</p>

                  <div className="space-y-2 text-sm text-gray-600 mb-4">
                    <div className="flex items-center gap-2">
                      <PhoneIcon className="h-4 w-4 text-gray-400" />
                      <span>{location.phone}</span>
                    </div>
                    {location.hours && (
                      <div className="flex items-center gap-2">
                        <ClockIcon className="h-4 w-4 text-gray-400" />
                        <span>{location.hours}</span>
                      </div>
                    )}
                  </div>

                  {location.services && location.services.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-4">
                      {location.services.slice(0, 3).map((service, idx) => (
                        <span
                          key={idx}
                          className="px-2 py-1 bg-gray-100 text-gray-600 text-xs font-medium rounded"
                        >
                          {service}
                        </span>
                      ))}
                    </div>
                  )}

                  {location.map_url && (
                    <a
                      href={location.map_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 bg-gray-100 text-gray-800 font-medium text-sm rounded-lg hover:bg-gray-200 transition-all"
                    >
                      <MapPinIcon className="h-4 w-4" />
                      View on Map
                    </a>
                  )}
                </div>
              ))}
            </div>
          </>
        )}

        {locations.length === 0 && (
          <div className="text-center py-6">
            <MapPinIcon className="h-16 w-16 text-gray-200 mx-auto mb-4" />
            <p className="text-gray-500">No locations available at the moment.</p>
          </div>
        )}

        {/* Contact CTA */}
        <div className="mt-6 bg-ink rounded-xl p-8 text-center">
          <h2 className="text-xl font-semibold text-white mb-2">Can't find a location near you?</h2>
          <p className="text-gray-400 mb-6">Contact us and we'll help you find the best option for your needs.</p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/contact"
              className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-white text-gray-900 font-semibold rounded-lg hover:bg-gray-100 transition-all"
            >
              <EnvelopeIcon className="h-5 w-5" />
              Contact Us
            </Link>
            {featured?.phone && (
              <a
                href={`tel:${featured.phone.replace(/[\s\-()]/g, '')}`}
                className="inline-flex items-center justify-center gap-2 px-6 py-3 border border-gray-700 text-white font-semibold rounded-lg hover:bg-ink/90 transition-all"
              >
                <PhoneIcon className="h-5 w-5" />
                Call: {featured.phone}
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
