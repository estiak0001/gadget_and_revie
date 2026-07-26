'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { productService, reviewService } from '@/lib/api';
import { getStorageUrl } from '@/lib/api/config';
import { Product, ProductCategory, ProductBrand, Review, CategoryFilterAttribute } from '@/lib/types';
import { useCartStore } from '@/lib/stores/cart-store';
import { useAuthStore } from '@/lib/stores/auth-store';
import { useWishlistStore } from '@/lib/stores/wishlist-store';
import { useCompareStore } from '@/lib/stores/compare-store';
import Breadcrumb from '@/components/Breadcrumb';
import Pagination from '@/components/Pagination';
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
  ShieldCheckIcon,
  TruckIcon,
  ArrowPathIcon,
  ShareIcon,
  MagnifyingGlassPlusIcon,
  ArrowsRightLeftIcon,
} from '@heroicons/react/24/outline';
import { HeartIcon as HeartSolidIcon, StarIcon as StarSolidIcon } from '@heroicons/react/24/solid';
import toast from 'react-hot-toast';

// ──────────────────────────────────────────────────────────────
// Helper: build a full /products/{a}/{b}/{c} URL from a category
// ──────────────────────────────────────────────────────────────
function buildCategoryPath(category: ProductCategory): string {
  if (category.breadcrumb && category.breadcrumb.length > 0) {
    return '/products/' + category.breadcrumb.map((b) => b.slug).join('/');
  }
  return '/products/' + category.slug;
}

const sortOptions = [
  { value: 'newest', label: 'Newest First' },
  { value: 'price_low', label: 'Price: Low to High' },
  { value: 'price_high', label: 'Price: High to Low' },
  { value: 'name', label: 'Name A-Z' },
];

type PageType = 'loading' | 'category' | 'product' | 'not-found';

// ═════════════════════════════════════════════════
//  ROOT COMPONENT — resolves slug → category or product
// ═════════════════════════════════════════════════
export default function ProductsSlugPage() {
  const params = useParams();
  const rawSlug = params.slug as string[];
  const slugPath = Array.isArray(rawSlug) ? rawSlug : [rawSlug];
  const lastSlug = slugPath[slugPath.length - 1];
  const requestedPath = slugPath.join('/');

  const [pageType, setPageType] = useState<PageType>('loading');
  const [category, setCategory] = useState<ProductCategory | null>(null);
  const [product, setProduct] = useState<Product | null>(null);

  useEffect(() => {
    let cancelled = false;

    const resolve = async () => {
      setPageType('loading');
      setCategory(null);
      setProduct(null);

      // 1. Try as category
      try {
        const cat = await productService.getCategoryBySlug(lastSlug);
        // Validate that the full path matches the breadcrumb
        const catPath = cat.breadcrumb && cat.breadcrumb.length > 0
          ? cat.breadcrumb.map((b) => b.slug).join('/')
          : cat.slug;
        if (!cancelled && catPath === requestedPath) {
          setCategory(cat);
          setPageType('category');
          return;
        }
      } catch { }

      // 2. Try as product slug (only valid for single-segment paths or if category lookup failed)
      try {
        const prod = await productService.getBySlug(lastSlug);
        if (!cancelled) {
          setProduct(prod);
          setPageType('product');
        }
      } catch {
        if (!cancelled) setPageType('not-found');
      }
    };

    resolve();
    return () => { cancelled = true; };
  }, [lastSlug, requestedPath]);

  if (pageType === 'loading') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin h-12 w-12 border-4 border-ink border-t-transparent rounded-full" />
      </div>
    );
  }

  if (pageType === 'not-found') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Page Not Found</h1>
          <p className="text-gray-600 mb-6">The page you&apos;re looking for doesn&apos;t exist.</p>
          <Link href="/products" className="px-6 py-3 bg-ink text-white rounded-lg hover:bg-ink/90 transition-all">
            Browse Products
          </Link>
        </div>
      </div>
    );
  }

  if (pageType === 'category' && category) {
    return <CategoryView category={category} />;
  }

  if (pageType === 'product' && product) {
    return <ProductDetailView product={product} />;
  }

  return null;
}

// ═════════════════════════════════════════════════
//  CATEGORY VIEW
// ═════════════════════════════════════════════════
function CategoryView({ category }: { category: ProductCategory }) {
  const router = useRouter();
  const { addItem } = useCartStore();
  const { isAuthenticated } = useAuthStore();
  const { toggleItem: toggleWishlist, isInWishlist } = useWishlistStore();
  const { toggleItem: toggleCompare, isInCompare } = useCompareStore();

  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('newest');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [showFilters, setShowFilters] = useState(false);
  const [isMobileCat, setIsMobileCat] = useState(false);
  const [inStockOnly, setInStockOnly] = useState(false);
  const [wishlist, setWishlist] = useState<number[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalProducts, setTotalProducts] = useState(0);

  // Common filters (permanent across all categories)
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [brands, setBrands] = useState<ProductBrand[]>([]);
  const [selectedBrandIds, setSelectedBrandIds] = useState<number[]>([]);

  // Dynamic category filter attributes
  const [filterAttributes, setFilterAttributes] = useState<CategoryFilterAttribute[]>([]);
  // Map attribute_id → selected value IDs (all multi-select in the sidebar UI)
  const [selectedFilterValues, setSelectedFilterValues] = useState<Record<number, number[]>>({});
  const [collapsedAttributeIds, setCollapsedAttributeIds] = useState<Record<number, boolean>>({});

  const flatSelectedValueIds = Object.values(selectedFilterValues).flat();
  const selectedFiltersKey = flatSelectedValueIds.slice().sort((a, b) => a - b).join(',');
  const brandsKey = selectedBrandIds.slice().sort((a, b) => a - b).join(',');

  const fetchProducts = useCallback(async () => {
    try {
      setLoading(true);
      const params: Record<string, unknown> = {
        page: currentPage,
        per_page: 30,
        sort_by: sortBy,
        category_id: category.id,
      };
      if (searchQuery) params.search = searchQuery;
      if (inStockOnly) params.in_stock = true;
      if (flatSelectedValueIds.length > 0) {
        params.attribute_values = flatSelectedValueIds;
      }
      const parsedMin = parseFloat(minPrice);
      const parsedMax = parseFloat(maxPrice);
      if (!isNaN(parsedMin) && parsedMin > 0) params.min_price = parsedMin;
      if (!isNaN(parsedMax) && parsedMax > 0) params.max_price = parsedMax;
      if (selectedBrandIds.length > 0) {
        params.brand_ids = selectedBrandIds;
      }

      const response = await productService.getAll(params as Parameters<typeof productService.getAll>[0]);
      setProducts(response.data);
      setTotalPages(response.meta.last_page);
      setTotalProducts(response.meta.total);
    } catch {
      toast.error('Failed to load products');
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category.id, currentPage, searchQuery, sortBy, inStockOnly, selectedFiltersKey, minPrice, maxPrice, brandsKey]);

  // Load filter attributes and brands whenever the viewed category changes
  useEffect(() => {
    let cancelled = false;
    productService
      .getCategoryFilterAttributes(category.id)
      .then((attrs) => {
        if (cancelled) return;
        setFilterAttributes(attrs);
        setSelectedFilterValues({});
      })
      .catch(() => {
        if (!cancelled) setFilterAttributes([]);
      });
    productService
      .getBrandsByCategory(category.id)
      .then((b) => {
        if (!cancelled) setBrands(b);
      })
      .catch(() => {
        if (!cancelled) setBrands([]);
      });
    // Reset category-specific filters on category change
    setSelectedBrandIds([]);
    return () => {
      cancelled = true;
    };
  }, [category.id]);

  useEffect(() => { fetchProducts(); }, [fetchProducts]);
  useEffect(() => { setCurrentPage(1); }, [searchQuery, sortBy, inStockOnly, selectedFiltersKey, minPrice, maxPrice, brandsKey]);

  // Initialize filter visibility and mobile detection
  useEffect(() => {
    const checkMobile = () => setIsMobileCat(window.innerWidth < 1024);
    checkMobile();
    if (window.innerWidth >= 1024) setShowFilters(true);
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const toggleAttributeValue = (attributeId: number, valueId: number) => {
    setSelectedFilterValues((prev) => {
      const existing = prev[attributeId] || [];
      const next = existing.includes(valueId)
        ? existing.filter((id) => id !== valueId)
        : [...existing, valueId];
      const out = { ...prev };
      if (next.length === 0) {
        delete out[attributeId];
      } else {
        out[attributeId] = next;
      }
      return out;
    });
  };

  const clearAllFilters = () => {
    setSearchQuery('');
    setInStockOnly(false);
    setMinPrice('');
    setMaxPrice('');
    setSelectedBrandIds([]);
    setSelectedFilterValues({});
  };

  const toggleBrand = (brandId: number) => {
    setSelectedBrandIds((prev) =>
      prev.includes(brandId) ? prev.filter((id) => id !== brandId) : [...prev, brandId]
    );
  };

  const handleAddToCart = async (product: Product) => {
    if (!isAuthenticated) { toast.error('Please login to add items to cart'); return; }
    try {
      await addItem('product', product.id, 1);
      toast.success(`${product.name} added to cart!`);
    } catch { toast.error('Failed to add to cart'); }
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

  const toggleWishlist_legacy = (id: number) => { }; // kept for compat

  // Breadcrumb
  const breadcrumbItems = (category.breadcrumb ?? []).map((crumb, i, arr) => ({
    name: crumb.name,
    href: i < arr.length - 1
      ? '/products/' + arr.slice(0, i + 1).map((c) => c.slug).join('/')
      : undefined,
  }));

  const subcategories = category.children ?? [];

  return (
    <div className="bg-gray-50 min-h-screen">
      <div className="max-w-[1800px] mx-auto px-3 sm:px-4 lg:px-6 py-4">
        {/* Breadcrumb */}
        <div className="mb-4">
          <Breadcrumb items={breadcrumbItems} />
        </div>

        <div className="mb-3">
          <div className="flex items-center justify-between mb-3">
            <h1 className="text-lg font-bold text-gray-900">{category.name}</h1>
            <span className="text-xs text-gray-500">{totalProducts} items</span>
          </div>

          {/* Subcategory badges */}
          {subcategories.length > 0 && (
            <div className="mb-4">
              <div className="flex flex-wrap gap-2">
                {subcategories.map((sub) => (
                  <Link
                    key={sub.id}
                    href={buildCategoryPath(sub)}
                    className="px-3 py-1.5 rounded-full text-sm font-medium bg-white border-2 border-gray-200 text-gray-700 hover:border-ink hover:bg-ink/90 hover:text-white transition-all shadow-sm"
                  >
                    {sub.name}
                    {sub.products_count != null && sub.products_count > 0 && (
                      <span className="ml-1.5 opacity-60">({sub.products_count})</span>
                    )}
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Brand badges — only shown on a leaf category (no further
              subcategories), mirroring the brand panel that appears in the
              deepest level of the Products nav dropdown. Chips share state
              with the sidebar brand filter. */}
          {subcategories.length === 0 && brands.length > 0 && (
            <div className="mb-4">
              <div className="flex flex-wrap items-center gap-2">
                {brands.map((brand) => {
                  const active = selectedBrandIds.includes(brand.id);
                  return (
                    <button
                      key={brand.id}
                      type="button"
                      // Chips are single-select: picking a brand replaces any
                      // prior selection; picking the active brand clears it.
                      // (The sidebar checkboxes still support multi-select.)
                      onClick={() => setSelectedBrandIds(active ? [] : [brand.id])}
                      aria-pressed={active}
                      className={`px-3 py-1.5 rounded-full text-sm font-medium border-2 transition-all shadow-sm ${
                        active
                          ? 'bg-ink border-ink text-white hover:bg-ink/90'
                          : 'bg-white border-gray-200 text-gray-700 hover:border-ink hover:bg-ink/90 hover:text-white'
                      }`}
                    >
                      {brand.name}
                    </button>
                  );
                })}
                {selectedBrandIds.length > 0 && (
                  <button
                    onClick={() => setSelectedBrandIds([])}
                    className="text-xs text-gray-500 hover:text-gray-900 underline underline-offset-2 ml-1"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Toolbar */}
        <div className="flex items-center justify-between gap-2 mb-3 bg-white rounded-lg px-3 py-2 shadow-sm border border-gray-200">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center space-x-1 px-2 py-1 text-gray-600 hover:bg-gray-100 rounded text-sm"
          >
            <FunnelIcon className="h-4 w-4" />
            <span className="hidden sm:inline">Filters</span>
          </button>
          <div className="flex items-center space-x-2">
            <div className="flex border border-gray-200 rounded p-0.5">
              <button onClick={() => setViewMode('grid')} className={`p-1.5 rounded transition-all ${viewMode === 'grid' ? 'bg-ink text-white' : 'text-gray-500 hover:bg-gray-100'}`}>
                <Squares2X2Icon className="h-4 w-4" />
              </button>
              <button onClick={() => setViewMode('list')} className={`p-1.5 rounded transition-all ${viewMode === 'list' ? 'bg-ink text-white' : 'text-gray-500 hover:bg-gray-100'}`}>
                <Bars3Icon className="h-4 w-4" />
              </button>
            </div>
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="text-xs pl-2 pr-6 py-1.5 border border-gray-200 rounded bg-white text-gray-600 focus:ring-1 focus:ring-gray-400">
              {sortOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
        </div>

        <div className="flex flex-col lg:flex-row gap-3">
          {/* Mobile Filter Overlay Backdrop */}
          {showFilters && isMobileCat && (
            <div
              className="fixed inset-0 z-40 bg-black/50 lg:hidden"
              onClick={() => setShowFilters(false)}
            />
          )}

          {/* Sidebar */}
          {showFilters && (
            <aside className={`${isMobileCat ? 'fixed inset-y-0 left-0 z-50 w-[85%] max-w-xs overflow-y-auto bg-gray-50 shadow-lg p-4 animate-[fadeIn_0.2s_ease-out]' : 'w-full lg:w-60 flex-shrink-0'}`}>
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3 lg:sticky lg:top-4 space-y-3 max-h-[calc(100vh-2rem)] overflow-y-auto">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-sm text-gray-900">Filters</h3>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={clearAllFilters}
                      className="text-xs text-gray-500 hover:text-gray-700"
                    >
                      Clear all
                    </button>
                    {isMobileCat && (
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
                <div className="pb-3 border-b border-gray-100">
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Search..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-7 pr-7 py-1.5 text-xs bg-gray-50 border border-gray-200 rounded focus:ring-1 focus:ring-gray-400 text-gray-900 placeholder:text-gray-400"
                    />
                    <MagnifyingGlassIcon className="h-3.5 w-3.5 text-gray-400 absolute left-2 top-1/2 -translate-y-1/2" />
                    {searchQuery && (
                      <button
                        onClick={() => setSearchQuery('')}
                        className="absolute right-2 top-1/2 -translate-y-1/2"
                      >
                        <XMarkIcon className="h-3 w-3 text-gray-400" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Stock */}
                <div className="pb-3 border-b border-gray-100">
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={inStockOnly}
                      onChange={(e) => setInStockOnly(e.target.checked)}
                      className="w-3.5 h-3.5 text-gray-800 border-gray-300 rounded"
                    />
                    <span className="text-xs text-gray-600">In Stock Only</span>
                  </label>
                </div>

                {/* Price Range */}
                <div className="pb-3 border-b border-gray-100">
                  <p className="text-xs font-semibold text-gray-900 mb-2">Price Range</p>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      placeholder="Min"
                      value={minPrice}
                      onChange={(e) => setMinPrice(e.target.value)}
                      min="0"
                      className="w-full px-2 py-1.5 text-xs bg-gray-50 border border-gray-200 rounded focus:ring-1 focus:ring-gray-400 text-gray-900 placeholder:text-gray-400"
                    />
                    <span className="text-gray-400 text-xs">–</span>
                    <input
                      type="number"
                      placeholder="Max"
                      value={maxPrice}
                      onChange={(e) => setMaxPrice(e.target.value)}
                      min="0"
                      className="w-full px-2 py-1.5 text-xs bg-gray-50 border border-gray-200 rounded focus:ring-1 focus:ring-gray-400 text-gray-900 placeholder:text-gray-400"
                    />
                  </div>
                </div>

                {/* Brands */}
                {brands.length > 0 && (
                  <div className="pb-3 border-b border-gray-100">
                    <p className="text-xs font-semibold text-gray-900 mb-2">Brands</p>
                    <div className="space-y-1 max-h-36 overflow-y-auto pr-1 scrollbar-thin">
                      {brands.map((brand) => (
                        <label
                          key={brand.id}
                          className="flex items-center justify-between gap-2 cursor-pointer text-xs hover:bg-gray-50 px-1 py-1 rounded"
                        >
                          <span className="flex items-center gap-2 flex-1 min-w-0">
                            <input
                              type="checkbox"
                              checked={selectedBrandIds.includes(brand.id)}
                              onChange={() => toggleBrand(brand.id)}
                              className="w-3.5 h-3.5 text-gray-800 border-gray-300 rounded"
                            />
                            <span className="text-gray-600 truncate">{brand.name}</span>
                          </span>
                          {brand.products_count != null && (
                            <span className="text-gray-400 text-[10px]">({brand.products_count})</span>
                          )}
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                {/* Dynamic category filter groups */}
                {filterAttributes.map((attr) => {
                  const selected = selectedFilterValues[attr.id] || [];
                  const isCollapsed = collapsedAttributeIds[attr.id] ?? false;
                  return (
                    <div key={attr.id} className="pb-3 border-b border-gray-100 last:border-b-0">
                      <button
                        type="button"
                        onClick={() =>
                          setCollapsedAttributeIds((prev) => ({
                            ...prev,
                            [attr.id]: !isCollapsed,
                          }))
                        }
                        className="w-full flex items-center justify-between text-xs font-semibold text-gray-900 mb-2"
                      >
                        <span>
                          {attr.name}
                          {attr.unit && (
                            <span className="text-gray-400 font-normal ml-1">({attr.unit})</span>
                          )}
                        </span>
                        <span className="text-gray-400">{isCollapsed ? '+' : '−'}</span>
                      </button>
                      {!isCollapsed && (
                        <div className="space-y-1 max-h-36 overflow-y-auto pr-1 scrollbar-thin">
                          {attr.values.length === 0 ? (
                            <p className="text-xs text-gray-400 italic">No options</p>
                          ) : (
                            attr.values.map((v) => {
                              const isChecked = selected.includes(v.id);
                              return (
                                <label
                                  key={v.id}
                                  className="flex items-center justify-between gap-2 cursor-pointer text-xs hover:bg-gray-50 px-1 py-1 rounded"
                                >
                                  <span className="flex items-center gap-2 flex-1 min-w-0">
                                    <input
                                      type="checkbox"
                                      checked={isChecked}
                                      onChange={() => toggleAttributeValue(attr.id, v.id)}
                                      className="w-3.5 h-3.5 text-gray-800 border-gray-300 rounded"
                                    />
                                    <span className="text-gray-600 truncate">{v.value}</span>
                                  </span>
                                  <span className="text-gray-400 text-[10px]">
                                    ({v.products_count})
                                  </span>
                                </label>
                              );
                            })
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </aside>
          )}

          {/* Product grid / list */}
          <div className="flex-1">
            {loading ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
                {[...Array(8)].map((_, i) => (
                  <div key={i} className="bg-white rounded-lg border border-gray-200 animate-pulse">
                    <div className="aspect-square bg-gray-100" />
                    <div className="p-3 space-y-2"><div className="h-4 bg-gray-100 rounded w-3/4" /><div className="h-5 bg-gray-100 rounded w-1/2" /></div>
                  </div>
                ))}
              </div>
            ) : products.length === 0 ? (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 text-center">
                <MagnifyingGlassIcon className="h-10 w-10 text-gray-300 mx-auto mb-3" />
                <h3 className="text-sm font-semibold text-gray-900 mb-1">No products found</h3>
                <p className="text-xs text-gray-500">Try adjusting your filters</p>
              </div>
            ) : viewMode === 'grid' ? (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
                  {products.map((p) => <ProductCard key={p.id} product={p} onAddToCart={handleAddToCart} onWishlist={handleToggleWishlist} onCompare={handleToggleCompare} isWishlisted={isInWishlist(p.id)} isCompared={isInCompare(p.id)} />)}
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
              <>
              <div className="space-y-2">
                {products.map((p) => (
                  <div key={p.id} className="bg-white rounded-lg border border-gray-200 overflow-hidden hover:shadow-sm transition-all">
                    <div className="flex">
                      <div className="relative w-24 h-24 flex-shrink-0 bg-gray-50">
                        <Link href={`/products/${p.slug}`}><img src={getStorageUrl(p.image)} alt={p.name} className="w-full h-full object-cover" /></Link>
                      </div>
                      <div className="flex-1 p-3 flex items-center justify-between">
                        <div className="flex-1">
                          <Link href={`/products/${p.slug}`}><h3 className="text-sm font-medium text-gray-900 line-clamp-1 hover:text-gray-600">{p.name}</h3></Link>
                          <div className="flex items-center gap-2 mt-2">
                            <span className="text-lg font-bold text-gray-900">৳{p.discount_price || p.price}</span>
                            {p.discount_price && <span className="text-xs text-gray-500 line-through">৳{p.price}</span>}
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => handleToggleWishlist(p)}
                            className={`p-2 rounded transition-all ${isInWishlist(p.id) ? 'text-rose-500 bg-rose-50' : 'text-gray-400 hover:text-rose-500 hover:bg-rose-50'}`}
                            title="Wishlist"
                          >
                            {isInWishlist(p.id) ? <HeartSolidIcon className="h-4 w-4" /> : <HeartIcon className="h-4 w-4" />}
                          </button>
                          <button
                            onClick={() => handleToggleCompare(p)}
                            className={`p-2 rounded transition-all ${isInCompare(p.id) ? 'text-violet-600 bg-violet-50' : 'text-gray-400 hover:text-violet-600 hover:bg-violet-50'}`}
                            title="Compare"
                          >
                            <ArrowsRightLeftIcon className="h-4 w-4" />
                          </button>
                          <button onClick={() => handleAddToCart(p)} disabled={p.stock_qty <= 0} className={`p-2 rounded ${p.stock_qty > 0 ? 'bg-ink text-white hover:bg-ink/90' : 'bg-gray-100 text-gray-400 cursor-not-allowed'}`}>
                            <ShoppingCartIcon className="h-4 w-4" />
                          </button>
                        </div>
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
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────
// Reusable product card
// ─────────────────────────────────────────────────
function ProductCard({ product: p, onWishlist, onCompare, onAddToCart, isWishlisted, isCompared }: {
  product: Product;
  isWishlisted: boolean;
  isCompared: boolean;
  onWishlist: (p: Product) => void;
  onCompare: (p: Product) => void;
  onAddToCart: (p: Product) => void;
}) {
  return (
    <div className="group bg-white rounded-lg border border-gray-200 overflow-hidden hover:shadow-md hover:border-gray-300 transition-all">
      <div className="relative h-44 sm:h-52 overflow-hidden bg-gray-100">
        <Link href={`/products/${p.slug}`}>
          <img
            src={getStorageUrl(p.image)}
            alt={p.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            onError={(e) => { (e.target as HTMLImageElement).src = '/images/placeholder.png'; }}
          />
        </Link>
        <div className="absolute top-2 right-2 flex flex-col gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={() => onWishlist(p)}
            className={`p-1.5 rounded-full shadow-md transition-all ${isWishlisted ? 'bg-rose-500 text-white' : 'bg-white text-gray-500 hover:bg-rose-50 hover:text-rose-500'}`}
            title={isWishlisted ? 'Remove from wishlist' : 'Add to wishlist'}
          >
            {isWishlisted ? <HeartSolidIcon className="h-4 w-4" /> : <HeartIcon className="h-4 w-4" />}
          </button>
          <button
            onClick={() => onCompare(p)}
            className={`p-1.5 rounded-full shadow-md transition-all ${isCompared ? 'bg-violet-600 text-white' : 'bg-white text-gray-500 hover:bg-violet-50 hover:text-violet-600'}`}
            title={isCompared ? 'Remove from compare' : 'Add to compare'}
          >
            <ArrowsRightLeftIcon className="h-4 w-4" />
          </button>
        </div>
        {p.stock_qty <= 0 && (
          <div className="absolute top-2 left-2">
            <span className="px-2 py-0.5 bg-ink text-white text-xs font-medium rounded">Out of Stock</span>
          </div>
        )}
      </div>
      <div className="p-3">
        {p.discount_price && (
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2 py-0.5 bg-red-500 text-white text-xs font-bold rounded">
              {Math.round(((p.price - p.discount_price) / p.price) * 100)}% OFF
            </span>
            <span className="text-xs text-gray-500 line-through">৳{p.price}</span>
          </div>
        )}
        <Link href={`/products/${p.slug}`}>
          <h3 className="text-sm font-medium text-gray-900 line-clamp-2 hover:text-gray-600 mb-2 min-h-[2.5rem]">{p.name}</h3>
        </Link>
        <div className="flex items-end justify-between">
          <div>
            <div className="text-lg font-bold text-gray-900">৳{p.discount_price || p.price}</div>
            {p.stock_qty > 0 && <div className="text-[10px] text-green-600">In Stock</div>}
          </div>
          <button
            onClick={() => onAddToCart(p)}
            disabled={p.stock_qty <= 0}
            className={`p-2 rounded transition-all ${p.stock_qty > 0 ? 'bg-ink text-white hover:bg-ink/90' : 'bg-gray-100 text-gray-400 cursor-not-allowed'}`}
          >
            <ShoppingCartIcon className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════
//  PRODUCT DETAIL VIEW
// ═════════════════════════════════════════════════
function ProductDetailView({ product: initialProduct }: { product: Product }) {
  const router = useRouter();
  const { addItem } = useCartStore();
  const { isAuthenticated } = useAuthStore();

  const [product] = useState<Product>(initialProduct);
  const [relatedProducts, setRelatedProducts] = useState<Product[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [quantity, setQuantity] = useState(1);
  const [selectedImage, setSelectedImage] = useState(0);
  const [activeTab, setActiveTab] = useState('description');
  const [isImageModalOpen, setIsImageModalOpen] = useState(false);
  const [modalZoom, setModalZoom] = useState(1);

  const { toggleItem: toggleWishlist, isInWishlist } = useWishlistStore();
  const { toggleItem: toggleCompare, isInCompare } = useCompareStore();
  const isWishlisted = isInWishlist(product.id);
  const isCompared = isInCompare(product.id);

  const handleToggleWishlist = () => {
    toggleWishlist(product);
    if (isWishlisted) {
      toast.success('Removed from wishlist');
    } else {
      toast.success('Added to wishlist ❤️');
    }
  };

  const handleToggleCompare = () => {
    const success = toggleCompare(product);
    if (!success) {
      toast.error('You can compare up to 4 products at a time');
    }
  };

  useEffect(() => {
    const load = async () => {
      const catId = (product as any).product_category_id || product.category_id;
      if (catId) {
        try {
          const rel = await productService.getByCategory(catId, { per_page: 12 });
          setRelatedProducts(rel.data.filter((p) => p.id !== product.id).slice(0, 10));
        } catch { }
      }
      if (product.vendor_id) {
        try {
          const r = await reviewService.getVendorReviews(product.vendor_id, { per_page: 10 });
          setReviews(r.data);
        } catch { }
      }
    };
    load();
  }, [product]);

  useEffect(() => {
    if (!isImageModalOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsImageModalOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isImageModalOpen]);

  const openImageModal = () => {
    setModalZoom(1);
    setIsImageModalOpen(true);
  };

  const productImages: string[] = [];
  if (product.image) productImages.push(getStorageUrl(product.image));
  if (product.gallery?.length) productImages.push(...product.gallery.map((img) => getStorageUrl(img)));
  if (productImages.length === 0) productImages.push('/images/placeholder.jpg');

  const handleAddToCart = async () => {
    if (!isAuthenticated) { router.push('/auth/login'); return; }
    try { await addItem('product', product.id, quantity); toast.success(`${quantity} × ${product.name} added to cart!`); }
    catch { toast.error('Failed to add to cart'); }
  };

  const handleBuyNow = async () => {
    if (!isAuthenticated) { router.push('/auth/login'); return; }
    try { await addItem('product', product.id, quantity); router.push('/checkout'); }
    catch { toast.error('Failed to add to cart'); }
  };

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({ title: product.name, text: product.description, url: window.location.href });
    } else {
      navigator.clipboard.writeText(window.location.href);
      toast.success('Link copied!');
    }
  };

  // Build breadcrumb — all category levels + product name
  const breadcrumbItems: { name: string; href?: string }[] = [];
  if (product.category) {
    const crumbs = product.category.breadcrumb ?? [];
    if (crumbs.length > 0) {
      crumbs.forEach((crumb, i) => {
        breadcrumbItems.push({
          name: crumb.name,
          href: '/products/' + crumbs.slice(0, i + 1).map((c) => c.slug).join('/'),
        });
      });
    } else {
      breadcrumbItems.push({
        name: product.category.name,
        href: buildCategoryPath(product.category),
      });
    }
  }
  breadcrumbItems.push({ name: product.name });

  const brandName = product.brand_name || product.brand_details?.name || product.brand || '';
  const avgRating = reviews.length > 0 ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length : 0;

  return (
    <div className="bg-gray-50 min-h-screen">
      {/* Breadcrumb */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <Breadcrumb items={breadcrumbItems} />
        </div>
      </div>

      <div className="max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className={relatedProducts.length > 0 ? 'flex flex-col lg:flex-row gap-4 mb-6' : 'mb-6'}>
          {/* Similar Products sidebar (desktop) — spans the full height of the content column beside it, no internal scroll */}
          {relatedProducts.length > 0 && (
            <div className="hidden lg:block lg:w-[310px] lg:flex-shrink-0">
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 h-full lg:sticky lg:top-6">
                <h3 className="font-bold text-gray-900 mb-3 text-sm">Similar Products</h3>
                <div className="divide-y divide-gray-100">
                  {relatedProducts.map((rp) => (
                    <Link key={rp.id} href={`/products/${rp.slug}`} className="flex gap-3 group py-3 first:pt-0 last:pb-0">
                      <div className="w-16 h-16 flex-shrink-0 rounded-lg overflow-hidden bg-gray-100 border border-gray-200">
                        <img src={getStorageUrl(rp.image)} alt={rp.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-gray-800 line-clamp-2 leading-snug group-hover:text-gray-600">{rp.name}</p>
                        <div className="flex items-baseline gap-1.5 mt-1">
                          <span className="text-sm font-bold text-gray-900">৳{rp.discount_price || rp.price}</span>
                          {rp.discount_price && <span className="text-xs text-gray-400 line-through">৳{rp.price}</span>}
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          )}

          <div className="flex-1 min-w-0 space-y-6">
          {/* Image Gallery + Product Info — single card */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 sm:p-5">
            <div className="grid md:grid-cols-2 md:divide-x md:divide-gray-200">
              {/* Image Gallery */}
              <div className="md:pr-6 flex flex-col justify-center">
                <div
                  className="relative aspect-square w-full bg-white rounded-lg overflow-hidden mb-2.5 border border-gray-100 group cursor-zoom-in"
                  onClick={openImageModal}
                >
                  <img
                    src={productImages[selectedImage]}
                    alt={product.name}
                    className="w-full h-full object-contain p-3"
                  />
                  {product.stock_qty <= 0 && (
                    <span className="absolute top-3 left-3 px-3 py-1 bg-ink text-white text-xs font-semibold rounded-full">Out of Stock</span>
                  )}
                  {product.discount_price && (
                    <span className="absolute top-3 left-3 mt-5 px-3 py-1 bg-red-500 text-white text-xs font-semibold rounded-full">
                      -{Math.round(((product.price - product.discount_price) / product.price) * 100)}% OFF
                    </span>
                  )}
                  <button onClick={(e) => { e.stopPropagation(); openImageModal(); }} className="absolute bottom-3 right-3 p-1.5 bg-white/90 rounded-full shadow-lg hover:bg-white">
                    <MagnifyingGlassPlusIcon className="h-4 w-4 text-gray-700" />
                  </button>
                  {productImages.length > 1 && (
                    <>
                      <button onClick={(e) => { e.stopPropagation(); setSelectedImage((i) => (i > 0 ? i - 1 : productImages.length - 1)); }} className="absolute left-3 top-1/2 -translate-y-1/2 p-1.5 bg-white/90 rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-all">
                        <ChevronLeftIcon className="h-4 w-4 text-gray-700" />
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); setSelectedImage((i) => (i < productImages.length - 1 ? i + 1 : 0)); }} className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 bg-white/90 rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-all">
                        <ChevronRightIcon className="h-4 w-4 text-gray-700" />
                      </button>
                    </>
                  )}
                </div>
                {productImages.length > 1 && (
                  <div className="flex flex-wrap gap-1.5">
                    {productImages.map((img, i) => (
                      <button key={i} onClick={() => setSelectedImage(i)} className={`w-12 h-12 flex-shrink-0 rounded-md overflow-hidden border-2 transition-all ${selectedImage === i ? 'border-ink shadow-sm' : 'border-gray-200 hover:border-gray-300'}`}>
                        <img src={img} alt={`View ${i + 1}`} className="w-full h-full object-contain bg-white" />
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Product Info */}
              <div className="md:pl-6 mt-6 md:mt-0">
                {product.category && (
                  <Link href={buildCategoryPath(product.category)} className="inline-block text-xs font-medium text-gray-900 bg-gray-100 px-3 py-1 rounded-full mb-2 hover:bg-gray-200 transition-colors">
                    {product.category.name}
                  </Link>
                )}
                <h1 className="text-lg sm:text-xl font-bold text-gray-900 mb-2">{product.name}</h1>

                {/* Info badges: stock, code, brand, model, warranty */}
                <div className="flex flex-wrap items-center gap-2 mb-2.5">
                  <span className={`inline-flex items-center text-xs font-semibold px-2.5 py-1 rounded-md border ${product.stock_qty > 0 ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700'}`}>
                    Stock: {product.stock_qty > 0 ? 'In Stock' : 'Out of Stock'}
                  </span>
                  {product.sku && (
                    <span className="inline-flex items-center text-xs font-medium px-2.5 py-1 rounded-md border border-blue-200 bg-blue-50 text-blue-700">
                      Code: {product.sku}
                    </span>
                  )}
                  {brandName && (
                    <span className="inline-flex items-center text-xs font-medium px-2.5 py-1 rounded-md border border-blue-200 bg-blue-50 text-blue-700">
                      Brand: {brandName}
                    </span>
                  )}
                  {product.model && (
                    <span className="inline-flex items-center text-xs font-medium px-2.5 py-1 rounded-md border border-blue-200 bg-blue-50 text-blue-700">
                      Model: {product.model}
                    </span>
                  )}
                  {product.warranty_period && (
                    <span className="inline-flex items-center text-xs font-medium px-2.5 py-1 rounded-md border border-blue-200 bg-blue-50 text-blue-700">
                      Warranty: {product.warranty_period}
                    </span>
                  )}
                </div>

                {/* Rating */}
                <div className="flex items-center gap-1.5 mb-3">
                  <div className="flex">
                    {[...Array(5)].map((_, i) => (
                      <StarSolidIcon key={i} className={`h-4 w-4 ${i < Math.round(avgRating) ? 'text-yellow-400' : 'text-gray-200'}`} />
                    ))}
                  </div>
                  <button onClick={() => setActiveTab('reviews')} className="text-xs text-gray-500 hover:text-gray-700 hover:underline">
                    {reviews.length} {reviews.length === 1 ? 'Review' : 'Reviews'}
                  </button>
                </div>

                {/* Short description */}
                {product.short_description && (
                  <p className="text-sm text-gray-600 leading-relaxed mb-3">{product.short_description}</p>
                )}

                {/* Vendor attribution hidden — vendor feature disabled */}

                {/* Price box */}
                <div className="rounded-xl border border-gray-200 bg-gray-50 p-3 mb-3">
                  <p className="text-xs text-gray-500 mb-1">{product.discount_price ? 'Discount Price' : 'Price'}</p>
                  <div className="flex items-baseline gap-3">
                    <span className="text-xl sm:text-2xl font-bold text-gray-900">৳{product.discount_price || product.price}</span>
                    {product.discount_price && (
                      <>
                        <span className="text-base text-gray-400 line-through">৳{product.price}</span>
                        <span className="text-sm font-semibold text-red-500">-{Math.round(((product.price - product.discount_price) / product.price) * 100)}%</span>
                      </>
                    )}
                  </div>
                  {product.discount_price && (
                    <p className="text-sm text-green-600 font-medium mt-1">You save ৳{(product.price - product.discount_price).toFixed(0)}</p>
                  )}
                </div>

                {/* Quantity + Actions — single row */}
                <div className="flex flex-wrap items-center gap-2.5 mb-3">
                  {product.stock_qty > 0 && (
                    <div className="flex items-center border-2 border-gray-300 rounded-lg">
                      <button onClick={() => setQuantity((q) => Math.max(1, q - 1))} className="px-3 py-2 text-gray-600 hover:bg-gray-50">-</button>
                      <span className="px-4 py-2 font-semibold text-gray-900 border-x-2 border-gray-300">{quantity}</span>
                      <button onClick={() => setQuantity((q) => Math.min(product.stock_qty, q + 1))} className="px-3 py-2 text-gray-600 hover:bg-gray-50">+</button>
                    </div>
                  )}
                  <button onClick={handleAddToCart} disabled={product.stock_qty <= 0} className={`flex-1 min-w-[140px] px-5 py-2.5 font-bold text-sm sm:text-base rounded-xl border-2 transition-all ${product.stock_qty > 0 ? 'border-ink text-gray-900 hover:bg-gray-100' : 'border-gray-200 text-gray-400 cursor-not-allowed'}`}>
                    <ShoppingCartIcon className="h-5 w-5 inline mr-1.5" />Add to Cart
                  </button>
                  <button onClick={handleBuyNow} disabled={product.stock_qty <= 0} className={`flex-1 min-w-[120px] px-5 py-2.5 font-bold text-sm sm:text-base rounded-xl transition-all ${product.stock_qty > 0 ? 'bg-gradient-to-r from-ink to-ink text-white hover:shadow-lg' : 'bg-gray-200 text-gray-400 cursor-not-allowed'}`}>
                    Buy Now
                  </button>
                  <button onClick={handleToggleWishlist} aria-label="Wishlist" className={`p-2.5 rounded-xl border-2 transition-all ${isWishlisted ? 'border-rose-500 bg-rose-50 text-rose-600' : 'border-gray-200 text-gray-600 hover:border-rose-400 hover:bg-rose-50 hover:text-rose-600'}`}>
                    {isWishlisted ? <HeartSolidIcon className="h-5 w-5 text-rose-500" /> : <HeartIcon className="h-5 w-5" />}
                  </button>
                  <button onClick={handleToggleCompare} aria-label="Compare" className={`p-2.5 rounded-xl border-2 transition-all ${isCompared ? 'border-violet-600 bg-violet-50 text-violet-700' : 'border-gray-200 text-gray-600 hover:border-violet-500 hover:bg-violet-50 hover:text-violet-700'}`}>
                    <ArrowsRightLeftIcon className="h-5 w-5" />
                  </button>
                  <button onClick={handleShare} aria-label="Share" className="p-2.5 rounded-xl border-2 border-gray-200 text-gray-600 hover:border-ink hover:bg-gray-100 transition-all">
                    <ShareIcon className="h-5 w-5" />
                  </button>
                </div>

                {/* Trust badges */}
                <div className="grid grid-cols-3 gap-2 pt-3 border-t border-gray-200">
                  <div className="text-center p-2 bg-gray-50 rounded-xl">
                    <TruckIcon className="h-5 w-5 text-gray-800 mx-auto mb-1" />
                    <p className="text-[10px] sm:text-xs font-semibold text-gray-900">Fast Delivery</p>
                  </div>
                  <div className="text-center p-2 bg-gray-50 rounded-xl">
                    <ShieldCheckIcon className="h-5 w-5 text-gray-800 mx-auto mb-1" />
                    <p className="text-[10px] sm:text-xs font-semibold text-gray-900">{product.warranty_period || 'Warranty'}</p>
                  </div>
                  <div className="text-center p-2 bg-gray-50 rounded-xl">
                    <ArrowPathIcon className="h-5 w-5 text-gray-800 mx-auto mb-1" />
                    <p className="text-[10px] sm:text-xs font-semibold text-gray-900">Easy Returns</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Tabs / Specification card — stacked with the product card, aligned beside the sidebar */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 sm:p-5">
            <div className="flex space-x-4 sm:space-x-8 border-b border-gray-200 mb-4 overflow-x-auto scrollbar-none">
              {['description', 'specifications', 'reviews'].map((tab) => (
                <button key={tab} onClick={() => setActiveTab(tab)} className={`pb-2.5 sm:pb-3 px-1 sm:px-2 font-semibold capitalize transition-all whitespace-nowrap text-sm sm:text-base ${activeTab === tab ? 'text-gray-900 border-b-2 border-ink' : 'text-gray-600 hover:text-gray-900'}`}>
                  {tab}{tab === 'reviews' && <span className="ml-1.5 sm:ml-2 text-xs bg-gray-100 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-full">{reviews.length}</span>}
                </button>
              ))}
            </div>

            {activeTab === 'description' && (
              <div className="text-gray-700 leading-relaxed prose prose-sm sm:prose max-w-none break-words overflow-x-auto prose-img:max-w-full prose-img:h-auto" dangerouslySetInnerHTML={{ __html: product.description }} />
            )}
            {activeTab === 'specifications' && (
              product.specifications && Object.keys(product.specifications).length > 0 ? (
                <div className="overflow-hidden rounded-xl border border-gray-200">
                  <table className="w-full table-fixed text-sm">
                    <tbody className="divide-y divide-gray-200">
                      {Object.entries(product.specifications).map(([k, v], i) => (
                        <tr key={k} className={i % 2 === 1 ? 'bg-gray-50' : 'bg-white'}>
                          <th
                            scope="row"
                            className="w-1/3 sm:w-56 px-4 py-3 text-left align-top font-medium text-gray-500 break-words"
                          >
                            {k}
                          </th>
                          <td className="px-4 py-3 align-top text-gray-900 break-words whitespace-normal leading-relaxed">
                            {String(v)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-gray-500">No specifications available.</p>
              )
            )}
            {activeTab === 'reviews' && (
              reviews.length === 0 ? (
                <p className="text-center text-gray-500 py-6">No reviews yet.</p>
              ) : (
                <div className="space-y-6">
                  {reviews.map((review) => (
                    <div key={review.id} className="bg-gray-50 rounded-xl p-6">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 bg-ink rounded-full flex items-center justify-center text-white font-bold">
                            {review.customer?.name?.charAt(0) || 'U'}
                          </div>
                          <div>
                            <p className="font-semibold text-gray-900">{review.customer?.name || 'Anonymous'}</p>
                            <p className="text-sm text-gray-600">{new Date(review.created_at).toLocaleDateString()}</p>
                          </div>
                        </div>
                        <div className="flex">
                          {[...Array(5)].map((_, i) => <StarSolidIcon key={i} className={`h-4 w-4 ${i < review.rating ? 'text-yellow-400' : 'text-gray-300'}`} />)}
                        </div>
                      </div>
                      <p className="text-gray-700">{review.comment}</p>
                      {review.vendor_reply && (
                        <div className="mt-4 pl-4 border-l-4 border-ink bg-gray-100 rounded-r-lg p-3">
                          <p className="text-sm font-semibold text-gray-900 mb-1">Vendor Reply:</p>
                          <p className="text-sm text-gray-700">{review.vendor_reply}</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )
            )}
          </div>
          </div>
        </div>

        {/* Image zoom modal */}
        {isImageModalOpen && (
          <div
            className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
            onClick={() => setIsImageModalOpen(false)}
          >
            <button
              onClick={() => setIsImageModalOpen(false)}
              aria-label="Close"
              className="absolute top-4 right-4 p-2 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors"
            >
              <XMarkIcon className="h-6 w-6" />
            </button>

            <div className="absolute top-4 left-4 flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
              <button onClick={() => setModalZoom((z) => Math.max(1, z - 0.5))} className="w-9 h-9 flex items-center justify-center bg-white/10 hover:bg-white/20 rounded-full text-white text-lg font-bold transition-colors">
                −
              </button>
              <span className="text-white text-sm font-medium w-14 text-center">{Math.round(modalZoom * 100)}%</span>
              <button onClick={() => setModalZoom((z) => Math.min(3, z + 0.5))} className="w-9 h-9 flex items-center justify-center bg-white/10 hover:bg-white/20 rounded-full text-white text-lg font-bold transition-colors">
                +
              </button>
            </div>

            {productImages.length > 1 && (
              <>
                <button
                  onClick={(e) => { e.stopPropagation(); setModalZoom(1); setSelectedImage((i) => (i > 0 ? i - 1 : productImages.length - 1)); }}
                  className="absolute left-4 top-1/2 -translate-y-1/2 p-2 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors"
                >
                  <ChevronLeftIcon className="h-6 w-6" />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); setModalZoom(1); setSelectedImage((i) => (i < productImages.length - 1 ? i + 1 : 0)); }}
                  className="absolute right-4 top-1/2 -translate-y-1/2 p-2 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors"
                >
                  <ChevronRightIcon className="h-6 w-6" />
                </button>
              </>
            )}

            <div className="w-full h-full overflow-auto flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
              <img
                src={productImages[selectedImage]}
                alt={product.name}
                onClick={() => setModalZoom((z) => (z >= 2 ? 1 : 2))}
                className="select-none cursor-zoom-in"
                style={{
                  width: modalZoom === 1 ? 'auto' : `${modalZoom * 900}px`,
                  maxWidth: modalZoom === 1 ? '90vw' : 'none',
                  maxHeight: modalZoom === 1 ? '85vh' : 'none',
                }}
              />
            </div>
          </div>
        )}

        {/* Related products */}
        {relatedProducts.length > 0 && (
          <div className="lg:hidden">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg sm:text-xl font-bold text-gray-900">Related Products</h2>
              {product.category && (
                <Link href={buildCategoryPath(product.category)} className="text-gray-900 hover:text-gray-600 font-semibold text-sm">
                  View All &rarr;
                </Link>
              )}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {relatedProducts.slice(0, 4).map((rp) => (
                <Link
                  key={rp.id}
                  href={`/products/${rp.slug}`}
                  className="group flex flex-col h-full bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden hover:shadow-md hover:border-gray-300 transition-all duration-300 hover:-translate-y-1"
                >
                  <div className="relative overflow-hidden bg-gray-100 h-50 flex-shrink-0">
                    <img src={getStorageUrl(rp.image)} alt={rp.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                  </div>
                  <div className="p-4 border-t border-gray-100 flex flex-col flex-1">
                    <h3 className="text-base font-semibold text-gray-900 line-clamp-2 mb-3 leading-snug min-h-[2.75rem] group-hover:text-gray-700">{rp.name}</h3>
                    <div className="flex items-center gap-2 mt-auto">
                      <span className="text-lg font-bold text-gray-900">৳{rp.discount_price || rp.price}</span>
                      {rp.discount_price && <span className="text-sm text-gray-400 line-through">৳{rp.price}</span>}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
