'use client';

import { useState, useEffect, useCallback, useRef, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { productService } from '@/lib/api';
import { getStorageUrl } from '@/lib/api/config';
import OptimizedImage from '@/components/OptimizedImage';
import Pagination from '@/components/Pagination';
import { Product, ProductCategory, ProductBrand } from '@/lib/types';
import { useCartStore } from '@/lib/stores/cart-store';
import { useWishlistStore } from '@/lib/stores/wishlist-store';
import { useCompareStore } from '@/lib/stores/compare-store';
import {
  FunnelIcon,
  MagnifyingGlassIcon,
  ShoppingCartIcon,
  HeartIcon,
  Squares2X2Icon,
  Bars3Icon,
  XMarkIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ArrowsRightLeftIcon,
  AdjustmentsHorizontalIcon,
  TagIcon,
  StarIcon,
  ChevronDownIcon,
  ChevronUpIcon,
} from '@heroicons/react/24/outline';
import { HeartIcon as HeartSolidIcon, StarIcon as StarSolidIcon } from '@heroicons/react/24/solid';
import toast from 'react-hot-toast';

const sortOptions = [
  { value: 'newest', label: 'Newest First' },
  { value: 'price_low', label: 'Price: Low to High' },
  { value: 'price_high', label: 'Price: High to Low' },
  { value: 'name', label: 'Name A–Z' },
  { value: 'name_desc', label: 'Name Z–A' },
];

const PRICE_PRESETS = [
  { label: 'Under ৳500', min: 0, max: 500 },
  { label: '৳500 – ৳2,000', min: 500, max: 2000 },
  { label: '৳2,000 – ৳10,000', min: 2000, max: 10000 },
  { label: '৳10,000 – ৳50,000', min: 10000, max: 50000 },
  { label: 'Over ৳50,000', min: 50000, max: 0 },
];

function FilterSection({ title, children, defaultOpen = true }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-gray-100 pb-3 mb-3 last:border-0 last:mb-0 last:pb-0">
      <button
        className="flex items-center justify-between w-full text-left mb-2"
        onClick={() => setOpen(!open)}
      >
        <span className="text-xs font-semibold text-gray-800 uppercase tracking-wider">{title}</span>
        {open ? <ChevronUpIcon className="h-3.5 w-3.5 text-gray-400" /> : <ChevronDownIcon className="h-3.5 w-3.5 text-gray-400" />}
      </button>
      {open && <div className="space-y-1.5">{children}</div>}
    </div>
  );
}

function ProductsPageInner() {
  const searchParams = useSearchParams();
  const { addItem } = useCartStore();
  const { toggleItem: toggleWishlist, isInWishlist } = useWishlistStore();
  const { toggleItem: toggleCompare, isInCompare } = useCompareStore();

  const [products, setProducts] = useState<Product[]>([]);
  const [allCategories, setAllCategories] = useState<ProductCategory[]>([]);
  const [rootCategories, setRootCategories] = useState<ProductCategory[]>([]);
  const [brands, setBrands] = useState<ProductBrand[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter state
  const [searchQuery, setSearchQuery] = useState(() => searchParams?.get('search') ?? '');
  const [sortBy, setSortBy] = useState('newest');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [showFilters, setShowFilters] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // Initialize filter visibility based on screen size
  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth < 1024;
      setIsMobile(mobile);
    };
    checkMobile();
    // Show filters by default on desktop only
    if (window.innerWidth >= 1024) setShowFilters(true);
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Price filter
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [activePricePreset, setActivePricePreset] = useState<number | null>(null);

  // Other filters
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
  const [selectedBrandId, setSelectedBrandId] = useState<number | null>(null);
  const [inStockOnly, setInStockOnly] = useState(false);
  const [discountOnly, setDiscountOnly] = useState(false);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalProducts, setTotalProducts] = useState(0);

  // Active filter count
  const activeFilterCount = [
    selectedCategoryId !== null,
    selectedBrandId !== null,
    minPrice !== '' || maxPrice !== '',
    inStockOnly,
    discountOnly,
    searchQuery !== '',
  ].filter(Boolean).length;

  const fetchProducts = useCallback(async () => {
    try {
      setLoading(true);
      const params: Record<string, any> = {
        page: currentPage,
        per_page: 30,
        sort_by: sortBy,
      };
      if (searchQuery) params.search = searchQuery;
      if (inStockOnly) params.in_stock = true;
      if (discountOnly) params.has_discount = true;
      if (selectedCategoryId) params.category_id = selectedCategoryId;
      if (selectedBrandId) params.brand_id = selectedBrandId;
      if (minPrice !== '') params.min_price = Number(minPrice);
      if (maxPrice !== '') params.max_price = Number(maxPrice);

      const response = await productService.getAll(params);
      setProducts(response.data);
      setTotalPages(response.meta.last_page);
      setTotalProducts(response.meta.total);
    } catch {
      toast.error('Failed to load products');
    } finally {
      setLoading(false);
    }
  }, [currentPage, searchQuery, sortBy, inStockOnly, discountOnly, selectedCategoryId, selectedBrandId, minPrice, maxPrice]);

  useEffect(() => {
    productService.getCategories().then((cats) => {
      setAllCategories(cats);
      setRootCategories(cats.filter((c) => !c.parent_id));
    }).catch(() => {});
    productService.getBrands().then(setBrands).catch(() => {});
  }, []);

  useEffect(() => { fetchProducts(); }, [fetchProducts]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, sortBy, inStockOnly, discountOnly, selectedCategoryId, selectedBrandId, minPrice, maxPrice]);

  const handleClearFilters = () => {
    setSearchQuery('');
    setMinPrice('');
    setMaxPrice('');
    setActivePricePreset(null);
    setSelectedCategoryId(null);
    setSelectedBrandId(null);
    setInStockOnly(false);
    setDiscountOnly(false);
  };

  const handlePricePreset = (index: number) => {
    if (activePricePreset === index) {
      setActivePricePreset(null);
      setMinPrice('');
      setMaxPrice('');
    } else {
      setActivePricePreset(index);
      const preset = PRICE_PRESETS[index];
      setMinPrice(preset.min > 0 ? String(preset.min) : '');
      setMaxPrice(preset.max > 0 ? String(preset.max) : '');
    }
  };

  const handleAddToCart = async (product: Product) => {
    try {
      await addItem('product', product.id, 1);
      toast.success(`${product.name} added to cart!`);
    } catch {
      toast.error('Failed to add to cart');
    }
  };

  const handleToggleWishlist = (product: Product) => {
    toggleWishlist(product);
    if (isInWishlist(product.id)) {
      toast.success('Removed from wishlist');
    } else {
      toast.success('Added to wishlist ❤️');
    }
  };

  const handleToggleCompare = (product: Product) => {
    const success = toggleCompare(product);
    if (!success) {
      toast.error('You can compare up to 4 products at a time');
    }
  };

  const productPrice = (p: Product) => p.discount_price ?? p.price;
  const discountPercent = (p: Product) =>
    p.discount_price ? Math.round(((p.price - p.discount_price) / p.price) * 100) : 0;

  return (
    <div className="bg-gray-50 min-h-screen">
      <div className="max-w-[1800px] mx-auto px-3 sm:px-4 lg:px-6 py-5">

        {/* Page Header */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-3">
            <h1 className="text-lg font-bold text-gray-900">All Products</h1>
            <span className="text-xs text-gray-500">{totalProducts} items</span>
          </div>

          {/* Category chips — link to full path URLs */}
          {rootCategories.length > 0 && (
            <div className="mb-4 flex flex-wrap gap-1.5">
              {rootCategories.map((cat) => (
                <Link
                  key={cat.id}
                  href={`/products/${cat.slug}`}
                  className="px-3 py-1 rounded-md text-sm font-medium bg-gray-100 border border-gray-200 text-gray-600 hover:bg-ink/90 hover:border-ink hover:text-white transition-colors"
                >
                  {cat.name}
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Toolbar */}
        <div className="flex items-center justify-between gap-2 mb-4 bg-white rounded-xl px-4 py-2.5 shadow-sm border border-gray-200">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
              showFilters ? 'bg-ink text-white' : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <AdjustmentsHorizontalIcon className="h-4 w-4" />
            <span className="hidden sm:inline">Filters</span>
            {activeFilterCount > 0 && (
              <span className={`text-xs rounded-full px-1.5 py-0.5 font-bold ${showFilters ? 'bg-white text-gray-900' : 'bg-ink text-white'}`}>
                {activeFilterCount}
              </span>
            )}
          </button>

          <div className="flex items-center gap-2">
            <div className="flex border border-gray-200 rounded-lg p-0.5">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-1.5 rounded-md transition-all ${viewMode === 'grid' ? 'bg-ink text-white shadow-sm' : 'text-gray-500 hover:bg-gray-100'}`}
                title="Grid view"
              >
                <Squares2X2Icon className="h-4 w-4" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-1.5 rounded-md transition-all ${viewMode === 'list' ? 'bg-ink text-white shadow-sm' : 'text-gray-500 hover:bg-gray-100'}`}
                title="List view"
              >
                <Bars3Icon className="h-4 w-4" />
              </button>
            </div>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="text-xs pl-2.5 pr-7 py-1.5 border border-gray-200 rounded-lg bg-white text-gray-700 focus:ring-2 focus:ring-gray-300 focus:outline-none cursor-pointer"
            >
              {sortOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
        </div>

        <div className="flex flex-col lg:flex-row gap-4">
          {/* ── Mobile Filter Overlay Backdrop ── */}
          {showFilters && isMobile && (
            <div
              className="fixed inset-0 z-40 bg-black/50 lg:hidden"
              onClick={() => setShowFilters(false)}
            />
          )}

          {/* ── Sidebar Filters ── */}
          {showFilters && (
            <aside className={`${isMobile ? 'fixed inset-y-0 left-0 z-50 w-[85%] max-w-xs overflow-y-auto bg-gray-50 shadow-lg p-4 animate-[fadeIn_0.2s_ease-out]' : 'w-full lg:w-56 flex-shrink-0'}`}>
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 lg:sticky lg:top-4 space-y-0">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-sm text-gray-900 flex items-center gap-1.5">
                    <FunnelIcon className="h-4 w-4" />
                    Filters
                  </h3>
                  <div className="flex items-center gap-2">
                    {activeFilterCount > 0 && (
                      <button
                        onClick={handleClearFilters}
                        className="text-xs text-red-500 hover:text-red-700 font-medium"
                      >
                        Clear all
                      </button>
                    )}
                    {isMobile && (
                      <button
                        onClick={() => setShowFilters(false)}
                        className="p-1 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-lg"
                      >
                        <XMarkIcon className="h-5 w-5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Search */}
                <FilterSection title="Search">
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Search products..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-7 pr-7 py-2 text-xs bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-gray-300 focus:outline-none text-gray-900 placeholder:text-gray-400"
                    />
                    <MagnifyingGlassIcon className="h-3.5 w-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                    {searchQuery && (
                      <button onClick={() => setSearchQuery('')} className="absolute right-2 top-1/2 -translate-y-1/2">
                        <XMarkIcon className="h-3.5 w-3.5 text-gray-400 hover:text-gray-600" />
                      </button>
                    )}
                  </div>
                </FilterSection>

                {/* Price Range */}
                <FilterSection title="Price Range">
                  {/* Presets */}
                  <div className="space-y-1">
                    {PRICE_PRESETS.map((preset, i) => (
                      <button
                        key={i}
                        onClick={() => handlePricePreset(i)}
                        className={`w-full text-left text-xs px-2.5 py-1.5 rounded-lg border transition-all ${
                          activePricePreset === i
                            ? 'bg-ink border-ink text-white'
                            : 'bg-transparent border-transparent text-gray-600 hover:bg-gray-50 hover:border-gray-200'
                        }`}
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                  {/* Custom range */}
                  <div className="mt-2 pt-2 border-t border-gray-100">
                    <p className="text-[10px] text-gray-500 mb-1.5 font-medium uppercase tracking-wide">Custom Range</p>
                    <div className="flex gap-1.5 items-center">
                      <input
                        type="number"
                        placeholder="Min ৳"
                        value={minPrice}
                        onChange={(e) => { setMinPrice(e.target.value); setActivePricePreset(null); }}
                        className="w-full py-1.5 px-2 text-xs border border-gray-200 rounded-lg bg-gray-50 focus:outline-none focus:ring-1 focus:ring-gray-400 text-gray-900"
                      />
                      <span className="text-gray-300 text-xs">–</span>
                      <input
                        type="number"
                        placeholder="Max ৳"
                        value={maxPrice}
                        onChange={(e) => { setMaxPrice(e.target.value); setActivePricePreset(null); }}
                        className="w-full py-1.5 px-2 text-xs border border-gray-200 rounded-lg bg-gray-50 focus:outline-none focus:ring-1 focus:ring-gray-400 text-gray-900"
                      />
                    </div>
                  </div>
                </FilterSection>

                {/* Availability */}
                <FilterSection title="Availability">
                  <label className="flex items-center gap-2 cursor-pointer group">
                    <div className="relative">
                      <input
                        type="checkbox"
                        checked={inStockOnly}
                        onChange={(e) => setInStockOnly(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-8 h-4 bg-gray-200 rounded-full peer peer-checked:bg-emerald-500 transition-colors" />
                      <div className="absolute top-0.5 left-0.5 w-3 h-3 bg-white rounded-full shadow transition-all peer-checked:translate-x-4" />
                    </div>
                    <span className="text-xs text-gray-700">In Stock Only</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer group mt-2">
                    <div className="relative">
                      <input
                        type="checkbox"
                        checked={discountOnly}
                        onChange={(e) => setDiscountOnly(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-8 h-4 bg-gray-200 rounded-full peer peer-checked:bg-orange-500 transition-colors" />
                      <div className="absolute top-0.5 left-0.5 w-3 h-3 bg-white rounded-full shadow transition-all peer-checked:translate-x-4" />
                    </div>
                    <span className="text-xs text-gray-700 flex items-center gap-1">
                      <TagIcon className="h-3 w-3 text-orange-500" />
                      On Sale / Discount
                    </span>
                  </label>
                </FilterSection>

                {/* Category */}
                {allCategories.length > 0 && (
                  <FilterSection title="Category">
                    <div className="max-h-36 overflow-y-auto space-y-0.5 pr-0.5 scrollbar-thin">
                      <button
                        onClick={() => setSelectedCategoryId(null)}
                        className={`w-full text-left text-xs px-2.5 py-1.5 rounded-lg transition-all ${
                          selectedCategoryId === null
                            ? 'bg-ink text-white font-medium'
                            : 'text-gray-600 hover:bg-gray-50'
                        }`}
                      >
                        All Categories
                      </button>
                      {allCategories.map((cat) => (
                        <button
                          key={cat.id}
                          onClick={() => setSelectedCategoryId(selectedCategoryId === cat.id ? null : cat.id)}
                          className={`w-full text-left text-xs px-2.5 py-1.5 rounded-lg transition-all ${
                            selectedCategoryId === cat.id
                              ? 'bg-ink text-white font-medium'
                              : 'text-gray-600 hover:bg-gray-50'
                          } ${cat.parent_id ? 'pl-5' : ''}`}
                        >
                          {cat.parent_id && <span className="text-gray-400 mr-1">↳</span>}
                          {cat.name}
                          {cat.products_count != null && (
                            <span className={`ml-1 text-[10px] ${selectedCategoryId === cat.id ? 'text-gray-300' : 'text-gray-400'}`}>
                              ({cat.products_count})
                            </span>
                          )}
                        </button>
                      ))}
                    </div>
                  </FilterSection>
                )}

                {/* Brand */}
                {brands.length > 0 && (
                  <FilterSection title="Brand" defaultOpen={false}>
                    <div className="max-h-36 overflow-y-auto space-y-0.5 pr-0.5 scrollbar-thin">
                      <button
                        onClick={() => setSelectedBrandId(null)}
                        className={`w-full text-left text-xs px-2.5 py-1.5 rounded-lg transition-all ${
                          selectedBrandId === null
                            ? 'bg-ink text-white font-medium'
                            : 'text-gray-600 hover:bg-gray-50'
                        }`}
                      >
                        All Brands
                      </button>
                      {brands.map((brand) => (
                        <button
                          key={brand.id}
                          onClick={() => setSelectedBrandId(selectedBrandId === brand.id ? null : brand.id)}
                          className={`w-full text-left text-xs px-2.5 py-1.5 rounded-lg transition-all flex items-center justify-between ${
                            selectedBrandId === brand.id
                              ? 'bg-ink text-white font-medium'
                              : 'text-gray-600 hover:bg-gray-50'
                          }`}
                        >
                          <span>{brand.name}</span>
                          {brand.products_count != null && (
                            <span className={`text-[10px] ${selectedBrandId === brand.id ? 'text-gray-300' : 'text-gray-400'}`}>
                              {brand.products_count}
                            </span>
                          )}
                        </button>
                      ))}
                    </div>
                  </FilterSection>
                )}
              </div>
            </aside>
          )}

          {/* ── Product Grid ── */}
          <div className="flex-1 min-w-0">
            {/* Active filter tags */}
            {activeFilterCount > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-3">
                {searchQuery && (
                  <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-50 border border-blue-200 text-blue-700 rounded-full text-xs font-medium">
                    Search: "{searchQuery}"
                    <button onClick={() => setSearchQuery('')}><XMarkIcon className="h-3 w-3" /></button>
                  </span>
                )}
                {selectedCategoryId !== null && (
                  <span className="inline-flex items-center gap-1 px-2 py-1 bg-purple-50 border border-purple-200 text-purple-700 rounded-full text-xs font-medium">
                    {allCategories.find(c => c.id === selectedCategoryId)?.name}
                    <button onClick={() => setSelectedCategoryId(null)}><XMarkIcon className="h-3 w-3" /></button>
                  </span>
                )}
                {selectedBrandId !== null && (
                  <span className="inline-flex items-center gap-1 px-2 py-1 bg-indigo-50 border border-indigo-200 text-indigo-700 rounded-full text-xs font-medium">
                    {brands.find(b => b.id === selectedBrandId)?.name}
                    <button onClick={() => setSelectedBrandId(null)}><XMarkIcon className="h-3 w-3" /></button>
                  </span>
                )}
                {(minPrice || maxPrice) && (
                  <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-50 border border-green-200 text-green-700 rounded-full text-xs font-medium">
                    {minPrice ? `৳${Number(minPrice).toLocaleString()}` : '৳0'} – {maxPrice ? `৳${Number(maxPrice).toLocaleString()}` : '∞'}
                    <button onClick={() => { setMinPrice(''); setMaxPrice(''); setActivePricePreset(null); }}><XMarkIcon className="h-3 w-3" /></button>
                  </span>
                )}
                {inStockOnly && (
                  <span className="inline-flex items-center gap-1 px-2 py-1 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-full text-xs font-medium">
                    In Stock
                    <button onClick={() => setInStockOnly(false)}><XMarkIcon className="h-3 w-3" /></button>
                  </span>
                )}
                {discountOnly && (
                  <span className="inline-flex items-center gap-1 px-2 py-1 bg-orange-50 border border-orange-200 text-orange-700 rounded-full text-xs font-medium">
                    On Sale
                    <button onClick={() => setDiscountOnly(false)}><XMarkIcon className="h-3 w-3" /></button>
                  </span>
                )}
              </div>
            )}

            {loading ? (
              <div className={`grid gap-3 ${viewMode === 'grid' ? 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6' : 'grid-cols-1'}`}>
                {[...Array(8)].map((_, i) => (
                  <div key={i} className={`bg-white rounded-xl border border-gray-200 animate-pulse ${viewMode === 'list' ? 'flex h-28' : ''}`}>
                    <div className={`bg-gray-100 ${viewMode === 'list' ? 'w-28 flex-shrink-0' : 'aspect-square'} rounded-t-xl`} />
                    <div className={`p-3 space-y-2 ${viewMode === 'list' ? 'flex-1' : ''}`}>
                      <div className="h-3 bg-gray-100 rounded w-3/4" />
                      <div className="h-4 bg-gray-100 rounded w-1/2" />
                    </div>
                  </div>
                ))}
              </div>
            ) : products.length === 0 ? (
              <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <MagnifyingGlassIcon className="h-8 w-8 text-gray-300" />
                </div>
                <h3 className="text-sm font-semibold text-gray-900 mb-1">No products found</h3>
                <p className="text-xs text-gray-500 mb-4">Try adjusting your filters or search terms.</p>
                <button
                  onClick={handleClearFilters}
                  className="px-4 py-2 bg-ink text-white text-xs font-medium rounded-lg hover:bg-ink/90 transition-colors"
                >
                  Clear all filters
                </button>
              </div>
            ) : viewMode === 'grid' ? (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
                  {products.map((product) => (
                    <div
                      key={product.id}
                      className="group bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-lg hover:border-gray-300 transition-all duration-200"
                    >
                      <div className="relative overflow-hidden bg-gray-50" style={{ aspectRatio: '1' }}>
                        <Link href={`/products/${product.slug}`}>
                          <OptimizedImage
                            src={getStorageUrl(product.image)}
                            alt={product.name}
                            fill
                            className="object-cover group-hover:scale-105 transition-transform duration-300"
                            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                          />
                        </Link>

                        {/* Badges */}
                        <div className="absolute top-2 left-2 flex flex-col gap-1">
                          {product.stock_qty <= 0 && (
                            <span className="px-2 py-0.5 bg-ink/90 text-white text-[10px] font-bold rounded">OUT OF STOCK</span>
                          )}
                          {discountPercent(product) > 0 && (
                            <span className="px-2 py-0.5 bg-red-500 text-white text-[10px] font-bold rounded">-{discountPercent(product)}%</span>
                          )}
                        </div>

                        {/* Hover actions */}
                        <div className="absolute top-2 right-2 flex flex-col gap-1.5 opacity-0 group-hover:opacity-100 translate-x-2 group-hover:translate-x-0 transition-all duration-200">
                          <button
                            onClick={() => handleToggleWishlist(product)}
                            className={`p-1.5 rounded-full shadow-md transition-all ${isInWishlist(product.id) ? 'bg-rose-500 text-white' : 'bg-white text-gray-500 hover:bg-rose-50 hover:text-rose-500'}`}
                            title={isInWishlist(product.id) ? 'Remove from wishlist' : 'Add to wishlist'}
                          >
                            {isInWishlist(product.id) ? <HeartSolidIcon className="h-4 w-4" /> : <HeartIcon className="h-4 w-4" />}
                          </button>
                          <button
                            onClick={() => handleToggleCompare(product)}
                            className={`p-1.5 rounded-full shadow-md transition-all ${isInCompare(product.id) ? 'bg-violet-600 text-white' : 'bg-white text-gray-500 hover:bg-violet-50 hover:text-violet-600'}`}
                            title={isInCompare(product.id) ? 'Remove from compare' : 'Add to compare'}
                          >
                            <ArrowsRightLeftIcon className="h-4 w-4" />
                          </button>
                        </div>
                      </div>

                      <div className="p-3">
                        {product.brand_name && (
                          <p className="text-[10px] text-gray-400 font-medium uppercase tracking-wider mb-0.5">{product.brand_name}</p>
                        )}
                        <Link href={`/products/${product.slug}`}>
                          <h3 className="text-xs font-medium text-gray-900 line-clamp-2 hover:text-gray-600 mb-2 min-h-[2.5rem] leading-relaxed">
                            {product.name}
                          </h3>
                        </Link>
                        <div className="flex items-end justify-between gap-1">
                          <div>
                            <div className="text-base font-bold text-gray-900">৳{productPrice(product).toLocaleString()}</div>
                            {product.discount_price && (
                              <div className="text-[10px] text-gray-400 line-through">৳{product.price.toLocaleString()}</div>
                            )}
                            {product.stock_qty > 0 && (
                              <div className="text-[10px] text-emerald-600 font-medium">● In Stock</div>
                            )}
                          </div>
                          <button
                            onClick={() => handleAddToCart(product)}
                            disabled={product.stock_qty <= 0}
                            className={`p-2 rounded-lg transition-all flex-shrink-0 ${
                              product.stock_qty > 0
                                ? 'bg-ink text-white hover:bg-ink/90 hover:shadow-md active:scale-95'
                                : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                            }`}
                            title="Add to cart"
                          >
                            <ShoppingCartIcon className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <Pagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  totalItems={totalProducts}
                  pageSize={30}
                  onPageChange={setCurrentPage}
                />
              </>
            ) : (
              /* List View */
              <div className="space-y-2">
                {products.map((product) => (
                  <div
                    key={product.id}
                    className="bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-md transition-all group"
                  >
                    <div className="flex">
                      <div className="w-28 sm:w-36 h-28 sm:h-36 flex-shrink-0 bg-gray-50 relative overflow-hidden">
                        <Link href={`/products/${product.slug}`}>
                          <OptimizedImage
                            src={getStorageUrl(product.image)}
                            alt={product.name}
                            fill
                            className="object-cover group-hover:scale-105 transition-transform duration-300"
                            sizes="(max-width: 640px) 112px, 144px"
                          />
                        </Link>
                        {discountPercent(product) > 0 && (
                          <span className="absolute top-1 left-1 px-1.5 py-0.5 bg-red-500 text-white text-[10px] font-bold rounded">
                            -{discountPercent(product)}%
                          </span>
                        )}
                      </div>
                      <div className="flex-1 p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          {product.brand_name && (
                            <p className="text-[10px] text-gray-400 font-medium uppercase tracking-wider mb-0.5">{product.brand_name}</p>
                          )}
                          <Link href={`/products/${product.slug}`}>
                            <h3 className="text-sm font-semibold text-gray-900 line-clamp-2 hover:text-gray-600 leading-snug">
                              {product.name}
                            </h3>
                          </Link>
                          <div className="flex items-center gap-3 mt-2">
                            <div>
                              <span className="text-base font-bold text-gray-900">৳{productPrice(product).toLocaleString()}</span>
                              {product.discount_price && (
                                <span className="ml-2 text-xs text-gray-400 line-through">৳{product.price.toLocaleString()}</span>
                              )}
                            </div>
                            {product.stock_qty > 0
                              ? <span className="text-xs text-emerald-600 font-medium">In Stock</span>
                              : <span className="text-xs text-red-500 font-medium">Out of Stock</span>
                            }
                          </div>
                          {product.warranty_period && (
                            <p className="text-[10px] text-gray-400 mt-1">Warranty: {product.warranty_period}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          <button
                            onClick={() => handleToggleWishlist(product)}
                            className={`p-2 rounded-lg transition-all ${isInWishlist(product.id) ? 'text-rose-500 bg-rose-50' : 'text-gray-400 hover:text-rose-500 hover:bg-rose-50'}`}
                            title="Wishlist"
                          >
                            {isInWishlist(product.id) ? <HeartSolidIcon className="h-4 w-4" /> : <HeartIcon className="h-4 w-4" />}
                          </button>
                          <button
                            onClick={() => handleToggleCompare(product)}
                            className={`p-2 rounded-lg transition-all ${isInCompare(product.id) ? 'text-violet-600 bg-violet-50' : 'text-gray-400 hover:text-violet-600 hover:bg-violet-50'}`}
                            title="Compare"
                          >
                            <ArrowsRightLeftIcon className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleAddToCart(product)}
                            disabled={product.stock_qty <= 0}
                            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                              product.stock_qty > 0
                                ? 'bg-ink text-white hover:bg-ink/90'
                                : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                            }`}
                          >
                            <ShoppingCartIcon className="h-4 w-4" />
                            <span className="hidden sm:inline">Add to Cart</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}

                <Pagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  totalItems={totalProducts}
                  pageSize={30}
                  onPageChange={setCurrentPage}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ProductsPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-50" />}>
      <ProductsPageInner />
    </Suspense>
  );
}
