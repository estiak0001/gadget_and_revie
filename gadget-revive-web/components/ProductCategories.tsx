'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { useHomepageStore } from '@/lib/stores/homepage-store';
import { ProductCategory } from '@/lib/types';
import { resolveIcon } from '@/lib/resolve-icon';

const GRADIENT_PALETTE = [
  'from-blue-500 to-blue-600',
  'from-green-500 to-green-600',
  'from-purple-500 to-purple-600',
  'from-red-500 to-red-600',
  'from-yellow-500 to-yellow-600',
  'from-indigo-500 to-indigo-600',
  'from-pink-500 to-pink-600',
  'from-teal-500 to-teal-600',
];

export default function ProductCategories() {
  const { featuredCategories: categories, categoriesLoading: isLoading, fetchHomepageData } = useHomepageStore();

  useEffect(() => {
    // No-op if page.tsx or another component already triggered the fetch
    fetchHomepageData();
  }, [fetchHomepageData]);

  return (
    <section className="py-8 bg-gradient-to-br from-gray-50 to-white">
      <div className="max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-6">
          <h2 className="text-2xl font-bold text-gray-900 sm:text-xl mb-4">
            Product Categories
          </h2>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Browse our extensive collection of high-quality replacement parts and accessories
          </p>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-64 rounded-xl bg-gray-200 animate-pulse" />
            ))}
          </div>
        ) : categories.length === 0 ? (
          <div className="text-center py-6 text-gray-400">No featured categories yet.</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {categories.map((category: ProductCategory, index: number) => {
              const IconComponent = resolveIcon(category.icon);
              const gradient = GRADIENT_PALETTE[index % GRADIENT_PALETTE.length];
              return (
                <Link
                  key={category.id}
                  href={category.breadcrumb && category.breadcrumb.length > 0 ? '/products/' + category.breadcrumb.map((b) => b.slug).join('/') : `/products/${category.slug}`}
                  className="group relative overflow-hidden rounded-xl bg-white shadow-lg hover:shadow-md transition-all duration-300 transform hover:-translate-y-1"
                >
                  {/* Background Gradient */}
                  <div className={`absolute top-0 left-0 w-full h-32 bg-gradient-to-r ${gradient} opacity-90 group-hover:opacity-100 transition-opacity`} />

                  {/* Content */}
                  <div className="relative p-6">
                    {/* Icon */}
                    <div className="relative z-10 mb-4">
                      <div className="inline-flex items-center justify-center w-12 h-12 bg-white rounded-xl shadow-lg">
                        <IconComponent className="w-6 h-6 text-gray-800" />
                      </div>
                    </div>

                    {/* Category Info */}
                    <div className="relative z-10 mb-4">
                      <h3 className="text-xl font-bold text-white mb-2 group-hover:text-white transition-colors">
                        {category.name}
                      </h3>
                      {category.description && (
                        <p className="text-white/90 text-sm leading-relaxed line-clamp-2">
                          {category.description}
                        </p>
                      )}
                    </div>

                    {/* Product Count */}
                    {category.products_count !== undefined && (
                      <div className="relative z-10 mb-4">
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-white/20 text-white">
                          {category.products_count}+ items
                        </span>
                      </div>
                    )}

                    {/* Subcategories */}
                    {category.children && category.children.length > 0 && (
                      <div className="mt-6 pt-6 border-t border-gray-200">
                        <div className="flex flex-wrap gap-2">
                          {category.children.slice(0, 4).map((sub) => (
                            <span
                              key={sub.id}
                              className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-gray-100 text-gray-800 hover:bg-gray-200 transition-colors"
                            >
                              {sub.name}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Arrow Icon */}
                    <div className="absolute top-6 right-6 z-10">
                      <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center group-hover:bg-white/30 transition-colors">
                        <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}

        {/* View All Button */}
        <div className="text-center mt-5">
          <Link
            href="/products"
            className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-xl text-white bg-indigo-600 hover:bg-indigo-700 transition-colors shadow-lg hover:shadow-md"
          >
            View All Products
            <svg className="ml-2 w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </Link>
        </div>
      </div>
    </section>
  );
}
