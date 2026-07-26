'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter, usePathname } from 'next/navigation';
import {
  Bars3Icon,
  XMarkIcon,
  ShoppingCartIcon,
  UserIcon,
  MagnifyingGlassIcon,
  HeartIcon,
  ArrowRightIcon,
  CubeIcon,
  ClockIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  PlusIcon,
  MinusIcon,
} from '@heroicons/react/24/outline';
import { useCartStore } from '@/lib/stores/cart-store';
import { useAuthStore } from '@/lib/stores/auth-store';
import { useWishlistStore } from '@/lib/stores/wishlist-store';
import { useSettingsStore } from '@/lib/stores/settings-store';
import { getBranding } from '@/lib/branding';
import { productService, serviceService } from '@/lib/api';
import { getStorageUrl } from '@/lib/api/config';
import { Product, ProductCategory, ServiceCategory, ProductBrand } from '@/lib/types';
import dynamic from 'next/dynamic';

const Cart = dynamic(() => import('@/components/Cart'), { ssr: false });
const WishlistDrawer = dynamic(() => import('@/components/WishlistDrawer'), { ssr: false });
const CompareDrawer = dynamic(() => import('@/components/CompareDrawer'), { ssr: false });

type CategoryDomain = 'products' | 'services';

const navigation: Array<{
  name: string;
  href: string;
  hasMegaMenu?: boolean;
  menuKey?: 'services';
}> = [
  { name: 'Services', href: '/services', hasMegaMenu: true, menuKey: 'services' },
  { name: 'Data Recovery', href: '/data-recovery' },
  { name: 'About', href: '/about' },
  { name: 'Contact', href: '/contact' },
  { name: 'Track Order', href: '/orders/track' },
];

const SEARCH_HISTORY_KEY = 'gadget_revive_search_history';

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState<T>(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

function buildCategoryTree<T extends { id: number; parent_id?: number | null; children?: T[] }>(flat: T[]): T[] {
  const map = new Map<number, T & { children: T[] }>();
  flat.forEach((item) => map.set(item.id, { ...item, children: [] }));
  const roots: (T & { children: T[] })[] = [];
  flat.forEach((item) => {
    const node = map.get(item.id)!;
    if (item.parent_id != null && map.has(item.parent_id)) {
      map.get(item.parent_id)!.children.push(node);
    } else if (item.parent_id == null) {
      roots.push(node);
    }
  });
  return roots;
}

export default function Header() {
  const router = useRouter();
  const pathname = usePathname();
  // The single search bar adapts to the section: on Services pages it searches
  // services (routing to /services?search=), elsewhere it searches products.
  const inServices = (pathname ?? '').startsWith('/services');

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [wishlistOpen, setWishlistOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  // Search
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Product[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchHistory, setSearchHistory] = useState<string[]>([]);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const mobileInputRef = useRef<HTMLInputElement>(null);

  // Category dropdown — 'services' for the Services mega menu, `cat-${id}` per top-level product category
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [hoveredL1Id, setHoveredL1Id] = useState<number | null>(null);
  const [hoveredL2Id, setHoveredL2Id] = useState<number | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [productCategories, setProductCategories] = useState<ProductCategory[]>([]);
  const [serviceCategories, setServiceCategories] = useState<ServiceCategory[]>([]);

  // Mobile accordion
  const [mobileExpandedMenu, setMobileExpandedMenu] = useState<'services' | null>(null);
  const [mobileExpandedL1, setMobileExpandedL1] = useState<number | null>(null);
  const [mobileExpandedL2, setMobileExpandedL2] = useState<number | null>(null);

  // Brand panel for leaf categories
  const [hoveredL3Id, setHoveredL3Id] = useState<number | null>(null);
  const [brandsByLeaf, setBrandsByLeaf] = useState<Record<number, ProductBrand[]>>({});
  const fetchedLeafIds = useRef<Set<number>>(new Set());

  const debouncedQuery = useDebounce(searchQuery, 350);
  const { getTotalItems } = useCartStore();
  const { user, isAuthenticated } = useAuthStore();
  const { getCount: getWishlistCount } = useWishlistStore();
  const { data: siteSettings, fetched: settingsFetched, fetchSettings } = useSettingsStore();

  useEffect(() => {
    setMounted(true);
    fetchSettings();
    const handleScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener('scroll', handleScroll);

    try {
      const hist = JSON.parse(localStorage.getItem(SEARCH_HISTORY_KEY) || '[]');
      setSearchHistory(Array.isArray(hist) ? hist.slice(0, 5) : []);
    } catch { /* ignore */ }

    productService.getCategories()
      .then((cats) => setProductCategories(buildCategoryTree(cats)))
      .catch(() => {});
    serviceService.getCategories()
      .then((cats) => setServiceCategories(buildCategoryTree(cats)))
      .catch(() => {});

    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setSearchOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    setSearchOpen(false);
    setMobileSearchOpen(false);
    setMobileMenuOpen(false);
    setOpenMenu(null);
  }, [pathname]);

  // Lock body scroll when mobile menu is open — prevents iOS Safari compositor crash
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = 'hidden';
      // iOS Safari needs this to prevent background scrolling behind fixed overlays
      document.body.style.position = 'fixed';
      document.body.style.inset = '0';
      document.body.style.width = '100%';
    } else {
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.inset = '';
      document.body.style.width = '';
    }
    return () => {
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.inset = '';
      document.body.style.width = '';
    };
  }, [mobileMenuOpen]);

  useEffect(() => {
    // Live preview cards are product-specific; on Services pages we skip the
    // preview and let the user submit to the services results page instead.
    if (inServices || debouncedQuery.trim().length < 2) { setSearchResults([]); setSearchLoading(false); return; }
    let cancelled = false;
    setSearchLoading(true);
    productService.getAll({ search: debouncedQuery, per_page: 6 })
      .then((res) => { if (!cancelled) { setSearchResults(res.data); setSearchLoading(false); } })
      .catch(() => { if (!cancelled) setSearchLoading(false); });
    return () => { cancelled = true; };
  }, [debouncedQuery, inServices]);

  const totalItems = mounted ? getTotalItems() : 0;
  const wishlistCount = mounted ? getWishlistCount() : 0;
  const authReady = mounted && isAuthenticated;
  const branding = getBranding(siteSettings);
  // Only surface the site name / tagline once settings have resolved. The
  // branding helper returns hardcoded "Gadget Revive" / "Repair. Shop. Revive."
  // defaults, which otherwise flash on first paint and then swap to whatever
  // the admin has configured in the CMS.
  const companyName = settingsFetched ? branding.name : '';
  const companyTagline = settingsFetched ? branding.tagline : '';
  const companyLogo = branding.logoLight;

  const saveToHistory = (q: string) => {
    const trimmed = q.trim();
    if (!trimmed) return;
    const updated = [trimmed, ...searchHistory.filter((h) => h !== trimmed)].slice(0, 5);
    setSearchHistory(updated);
    try { localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(updated)); } catch { /* ignore */ }
  };

  const handleSearchSubmit = (query?: string) => {
    const q = (query ?? searchQuery).trim();
    if (!q) return;
    saveToHistory(q);
    setSearchOpen(false);
    setMobileSearchOpen(false);
    router.push(`${inServices ? '/services' : '/products'}?search=${encodeURIComponent(q)}`);
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSearchSubmit();
    if (e.key === 'Escape') { setSearchOpen(false); setMobileSearchOpen(false); }
  };

  const removeHistory = (term: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = searchHistory.filter((h) => h !== term);
    setSearchHistory(updated);
    try { localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(updated)); } catch { /* ignore */ }
  };

  // Brands for leaf categories — fetched from /product-brands/by-category/{id}.
  // Category ID is in the URL path so it can never be dropped or cached incorrectly.
  // Returns only brands that have at least one product in this category or its descendants.
  const fetchBrandsForLeaf = (categoryId: number) => {
    if (fetchedLeafIds.current.has(categoryId)) return;
    fetchedLeafIds.current.add(categoryId);
    productService.getBrandsByCategory(categoryId)
      .then((brands) => setBrandsByLeaf((prev) => ({ ...prev, [categoryId]: brands })))
      .catch(() => setBrandsByLeaf((prev) => ({ ...prev, [categoryId]: [] })));
  };

  // Dropdown hover helpers
  const openDropdown = (key: string) => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    if (openMenu !== key) { setHoveredL1Id(null); setHoveredL2Id(null); setHoveredL3Id(null); }
    setOpenMenu(key);
  };
  const scheduleClose = () => {
    closeTimer.current = setTimeout(() => {
      setOpenMenu(null);
      setHoveredL1Id(null);
      setHoveredL2Id(null);
      setHoveredL3Id(null);
    }, 150);
  };
  const cancelClose = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
  };

  const getCategoryUrl = (cat: ProductCategory | ServiceCategory, type: CategoryDomain) => {
    const base = type === 'products' ? '/products' : '/services';
    if (cat.breadcrumb && cat.breadcrumb.length > 0) {
      return base + '/' + cat.breadcrumb.map((b) => b.slug).join('/');
    }
    return `${base}/${cat.slug}`;
  };

  const showDropdown = searchOpen && (searchQuery.length > 0 || searchHistory.length > 0);

  // A plain top-nav link — no dropdown, just the modernized hover/active treatment.
  const renderPlainLink = (label: string, href: string) => {
    const active = pathname === href;
    return (
      <Link
        key={href}
        href={href}
        className={`relative px-2.5 py-2 text-sm font-medium whitespace-nowrap rounded-lg transition-all duration-150 ${
          active ? 'text-gray-900 bg-gray-100' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100/70'
        }`}
      >
        {label}
        {active && <span className="absolute bottom-0 left-1/2 -translate-x-1/2 h-0.5 w-6 bg-ink rounded-full" />}
      </Link>
    );
  };

  // A top-nav item with a hover cascade dropdown (L1→L2→L3→brands). Falls back to a
  // plain link when there's nothing to cascade (e.g. a leaf category with no children).
  const renderMegaMenu = (
    navKey: string,
    label: string,
    href: string,
    cats: (ProductCategory | ServiceCategory)[],
    isProducts: boolean,
    alignRight = false
  ) => {
    if (cats.length === 0) return renderPlainLink(label, href);

    const isActive = pathname === href || pathname.startsWith(href + '/');
    const isOpen = openMenu === navKey;

    const activeL1 = cats.find((c) => c.id === hoveredL1Id) ?? null;
    const l2Cats = activeL1?.children ?? [];
    const activeL2 = l2Cats.find((c) => c.id === hoveredL2Id) ?? null;
    const l3Cats = activeL2?.children ?? [];
    const activeL3 = l3Cats.find((c) => c.id === hoveredL3Id) ?? null;

    // Determine which leaf category to show brands for (products only)
    const leafForBrands = isProducts
      ? (activeL3 ?? (l3Cats.length === 0 && activeL2 ? activeL2 : (l2Cats.length === 0 && activeL1 ? activeL1 : null)))
      : null;
    const brandsToShow = leafForBrands ? (brandsByLeaf[leafForBrands.id] ?? null) : null;
    const domain: CategoryDomain = isProducts ? 'products' : 'services';

    return (
      <div
        key={navKey}
        className="relative h-11 flex items-center"
        onMouseEnter={() => openDropdown(navKey)}
        onMouseLeave={scheduleClose}
      >
        {/* Nav trigger */}
        <Link
          href={href}
          className={`relative flex items-center gap-1 px-2.5 py-2 text-sm font-medium whitespace-nowrap rounded-lg transition-all duration-150 ${
            isActive || isOpen ? 'text-gray-900 bg-gray-100' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100/70'
          }`}
        >
          {label}
          <ChevronDownIcon className={`h-3.5 w-3.5 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
          {isActive && <span className="absolute bottom-0 left-1/2 -translate-x-1/2 h-0.5 w-6 bg-ink rounded-full" />}
        </Link>

        {/* Cascading dropdown — all panels in one container, no gap issue.
            Right-aligned items reverse the stacking direction so deeper panels
            cascade toward the center of the screen instead of off the edge. */}
        {isOpen && (
          <div
            className={`absolute top-full z-50 pt-2 flex animate-[dropdownIn_0.16s_ease-out] ${
              alignRight ? 'right-0 flex-row-reverse' : 'left-0'
            }`}
            onMouseEnter={cancelClose}
            onMouseLeave={scheduleClose}
          >
            {/* L1 panel — always visible */}
            <div className="bg-white border border-gray-100 rounded-xl shadow-lg ring-1 ring-black/5 w-52 overflow-hidden">
              <Link
                href={href}
                className="flex items-center justify-between px-4 py-2.5 text-sm font-semibold text-gray-900 hover:bg-gray-50 border-b border-gray-100 transition-colors"
              >
                All {label}
                <ArrowRightIcon className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
              </Link>
              <div className="max-h-[340px] overflow-y-auto py-1">
                {cats.map((l1) => (
                  <button
                    key={l1.id}
                    onMouseEnter={() => {
                      setHoveredL1Id(l1.id);
                      setHoveredL2Id(null);
                      setHoveredL3Id(null);
                      if (isProducts && (l1.children?.length ?? 0) === 0) {
                        fetchBrandsForLeaf(l1.id);
                      }
                    }}
                    onClick={() => router.push(getCategoryUrl(l1, domain))}
                    className={`w-full flex items-center justify-between px-4 py-2.5 text-sm text-left transition-colors duration-150 ${
                      hoveredL1Id === l1.id
                        ? 'bg-gray-100 text-gray-900 font-medium'
                        : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                    }`}
                  >
                    <span>{l1.name}</span>
                    {(l1.children?.length ?? 0) > 0
                      ? <ChevronRightIcon className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
                      : isProducts && <ChevronRightIcon className="h-3.5 w-3.5 text-gray-300 flex-shrink-0" />
                    }
                  </button>
                ))}
              </div>
            </div>

            {/* L2 panel — appears when an L1 with children is hovered */}
            {l2Cats.length > 0 && (
              <div className="ml-1 bg-white border border-gray-100 rounded-xl shadow-lg ring-1 ring-black/5 w-48 overflow-hidden animate-[dropdownIn_0.16s_ease-out]">
                <Link
                  href={getCategoryUrl(activeL1!, domain)}
                  className="flex items-center justify-between px-4 py-2.5 text-xs font-semibold text-gray-500 hover:text-gray-900 border-b border-gray-100 transition-colors"
                >
                  All in {activeL1?.name}
                  <ArrowRightIcon className="h-3 w-3 flex-shrink-0" />
                </Link>
                <div className="max-h-[340px] overflow-y-auto py-1">
                  {l2Cats.map((l2) => (
                    <button
                      key={l2.id}
                      onMouseEnter={() => {
                        setHoveredL2Id(l2.id);
                        setHoveredL3Id(null);
                        if (isProducts && (l2.children?.length ?? 0) === 0) {
                          fetchBrandsForLeaf(l2.id);
                        }
                      }}
                      onClick={() => router.push(getCategoryUrl(l2, domain))}
                      className={`w-full flex items-center justify-between px-4 py-2 text-sm text-left transition-colors duration-150 ${
                        hoveredL2Id === l2.id
                          ? 'bg-gray-100 text-gray-900 font-medium'
                          : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                      }`}
                    >
                      <span>{l2.name}</span>
                      {(l2.children?.length ?? 0) > 0
                        ? <ChevronRightIcon className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
                        : isProducts && <ChevronRightIcon className="h-3.5 w-3.5 text-gray-300 flex-shrink-0" />
                      }
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* L3 panel — appears when an L2 with children is hovered */}
            {l3Cats.length > 0 && (
              <div className="ml-1 bg-white border border-gray-100 rounded-xl shadow-lg ring-1 ring-black/5 w-48 overflow-hidden animate-[dropdownIn_0.16s_ease-out]">
                <Link
                  href={getCategoryUrl(activeL2!, domain)}
                  className="flex items-center justify-between px-4 py-2.5 text-xs font-semibold text-gray-500 hover:text-gray-900 border-b border-gray-100 transition-colors"
                >
                  All in {activeL2?.name}
                  <ArrowRightIcon className="h-3 w-3 flex-shrink-0" />
                </Link>
                <div className="max-h-[340px] overflow-y-auto py-1">
                  {l3Cats.map((l3) => (
                    <button
                      key={l3.id}
                      onMouseEnter={() => {
                        setHoveredL3Id(l3.id);
                        if (isProducts) fetchBrandsForLeaf(l3.id);
                      }}
                      onClick={() => router.push(getCategoryUrl(l3, domain))}
                      className={`w-full flex items-center justify-between px-4 py-2 text-sm text-left transition-colors duration-150 ${
                        hoveredL3Id === l3.id
                          ? 'bg-gray-100 text-gray-900 font-medium'
                          : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                      }`}
                    >
                      <span>{l3.name}</span>
                      {isProducts && (
                        <ChevronRightIcon className="h-3.5 w-3.5 text-gray-300 flex-shrink-0" />
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Brands panel — appears after the deepest category level (products only) */}
            {brandsToShow !== null && brandsToShow.length > 0 && (
              <div className="ml-1 bg-white border border-gray-100 rounded-xl shadow-lg ring-1 ring-black/5 w-48 overflow-hidden animate-[dropdownIn_0.16s_ease-out]">
                <Link
                  href={getCategoryUrl(leafForBrands!, domain)}
                  className="flex items-center justify-between px-4 py-2.5 text-xs font-semibold text-gray-500 hover:text-gray-900 border-b border-gray-100 transition-colors"
                >
                  All in {leafForBrands!.name}
                  <ArrowRightIcon className="h-3 w-3 flex-shrink-0" />
                </Link>
                <div className="max-h-[340px] overflow-y-auto py-1">
                  {brandsToShow.map((brand: ProductBrand) => (
                    <Link
                      key={brand.id}
                      href={`${getCategoryUrl(leafForBrands!, domain)}?brand=${brand.slug}`}
                      className="block px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-colors"
                    >
                      {brand.name}
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <header className={`sticky top-0 z-40 transition-all duration-300 ${scrolled ? 'shadow-md' : ''}`}>

      {/* ── Top Bar ── */}
      <div className="bg-white border-b border-gray-200">
        <div className="mx-auto max-w-[1800px] px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between gap-4">

            {/* Logo */}
            <Link href="/" className="flex items-center space-x-3 group flex-shrink-0">
              <Image
                src={companyLogo}
                alt={`${companyName} Logo`}
                width={120}
                height={36}
                className="h-9 w-auto transition-transform group-hover:scale-105"
                priority
                unoptimized
              />
              <div className="hidden sm:flex flex-col">
                {settingsFetched ? (
                  <>
                    <span className="text-lg font-bold text-gray-900 tracking-tight">{companyName}</span>
                    {companyTagline && (
                      <span className="text-[10px] text-emerald-600 font-semibold -mt-0.5 tracking-wider uppercase">
                        {companyTagline}
                      </span>
                    )}
                  </>
                ) : (
                  <>
                    <div className="h-5 w-32 bg-gray-200 rounded animate-pulse" />
                    <div className="h-2.5 w-20 bg-gray-100 rounded animate-pulse mt-1" />
                  </>
                )}
              </div>
            </Link>

            {/* Search — Desktop */}
            <div ref={searchRef} className="flex-1 max-w-2xl hidden md:block relative">
              <div className="relative">
                <input
                  ref={inputRef}
                  type="text"
                  placeholder={inServices ? 'Search services...' : 'Search products, brands, categories...'}
                  value={searchQuery}
                  onChange={(e) => { setSearchQuery(e.target.value); setSearchOpen(true); }}
                  onFocus={() => setSearchOpen(true)}
                  onKeyDown={handleSearchKeyDown}
                  className="w-full bg-gray-50 text-gray-900 placeholder-gray-400 px-4 py-2.5 pr-12 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-ink border border-gray-200 transition-all"
                  autoComplete="off"
                />
                {searchQuery && (
                  <button
                    className="absolute right-10 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600"
                    onClick={() => { setSearchQuery(''); setSearchResults([]); inputRef.current?.focus(); }}
                  >
                    <XMarkIcon className="h-4 w-4" />
                  </button>
                )}
                <button
                  onClick={() => handleSearchSubmit()}
                  className="absolute right-0 top-0 h-full px-4 bg-ink hover:bg-ink/90 text-white rounded-r-xl transition-colors"
                >
                  <MagnifyingGlassIcon className="h-4 w-4" />
                </button>
              </div>

              {showDropdown && (
                <div className="absolute top-full left-0 right-0 mt-1.5 bg-white rounded-xl border border-gray-200 shadow-lg z-50 overflow-hidden">
                  {!searchQuery && searchHistory.length > 0 && (
                    <div className="p-3">
                      <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider mb-2 flex items-center gap-1">
                        <ClockIcon className="h-3 w-3" /> Recent Searches
                      </p>
                      <div className="space-y-0.5">
                        {searchHistory.map((term) => (
                          <button
                            key={term}
                            onClick={() => { setSearchQuery(term); handleSearchSubmit(term); }}
                            className="w-full flex items-center justify-between px-2 py-1.5 text-sm text-gray-700 hover:bg-gray-50 rounded-lg group/hist"
                          >
                            <span className="flex items-center gap-2 truncate">
                              <ClockIcon className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
                              {term}
                            </span>
                            <span
                              onClick={(e) => removeHistory(term, e)}
                              className="p-0.5 text-gray-300 hover:text-gray-600"
                            >
                              <XMarkIcon className="h-3 w-3" />
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  {searchLoading && searchQuery.length >= 2 && (
                    <div className="p-4 flex items-center gap-2 text-sm text-gray-500">
                      <div className="w-4 h-4 border-2 border-gray-300 border-t-gray-700 rounded-full animate-spin" />
                      Searching...
                    </div>
                  )}
                  {!searchLoading && searchQuery.length >= 2 && searchResults.length > 0 && (
                    <div>
                      <div className="px-3 pt-3 pb-1">
                        <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider flex items-center gap-1">
                          <CubeIcon className="h-3 w-3" /> Products
                        </p>
                      </div>
                      {searchResults.map((product) => (
                        <Link
                          key={product.id}
                          href={`/products/${product.slug}`}
                          onClick={() => { saveToHistory(searchQuery); setSearchOpen(false); setSearchQuery(''); }}
                          className="flex items-center gap-3 px-3 py-2 hover:bg-gray-50 transition-colors"
                        >
                          <div className="relative w-10 h-10 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0">
                            <Image
                              src={getStorageUrl(product.image)}
                              alt=""
                              fill
                              sizes="40px"
                              className="object-cover"
                              unoptimized={getStorageUrl(product.image).includes('localhost')}
                            />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">{product.name}</p>
                            <p className="text-xs text-gray-500">
                              ৳{(product.discount_price ?? product.price).toLocaleString()}
                              {product.discount_price && (
                                <span className="ml-1.5 text-[10px] text-green-600 font-medium">
                                  -{Math.round(((product.price - product.discount_price) / product.price) * 100)}% OFF
                                </span>
                              )}
                            </p>
                          </div>
                          {product.stock_qty <= 0 && (
                            <span className="text-[10px] text-red-500 font-medium flex-shrink-0">Out of Stock</span>
                          )}
                        </Link>
                      ))}
                      <div className="p-2 border-t border-gray-100">
                        <button
                          onClick={() => handleSearchSubmit()}
                          className="w-full flex items-center justify-center gap-2 py-2 text-sm font-medium text-gray-900 hover:bg-gray-50 rounded-lg transition-colors"
                        >
                          <MagnifyingGlassIcon className="h-4 w-4" />
                          See all results for &quot;{searchQuery}&quot;
                          <ArrowRightIcon className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  )}
                  {inServices && searchQuery.length >= 2 && (
                    <div className="p-2">
                      <button
                        onClick={() => handleSearchSubmit()}
                        className="w-full flex items-center justify-center gap-2 py-2.5 text-sm font-medium text-gray-900 hover:bg-gray-50 rounded-lg transition-colors"
                      >
                        <MagnifyingGlassIcon className="h-4 w-4" />
                        Search services for &quot;{searchQuery}&quot;
                        <ArrowRightIcon className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}
                  {!inServices && !searchLoading && searchQuery.length >= 2 && searchResults.length === 0 && (
                    <div className="p-4 text-center">
                      <MagnifyingGlassIcon className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                      <p className="text-sm text-gray-500">No results for &quot;{searchQuery}&quot;</p>
                      <p className="text-xs text-gray-400 mt-0.5">Try different keywords</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Right Icons */}
            <div className="flex items-center space-x-1 sm:space-x-3">
              <button
                className="md:hidden p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-all"
                onClick={() => { setMobileSearchOpen(!mobileSearchOpen); setTimeout(() => mobileInputRef.current?.focus(), 100); }}
              >
                <MagnifyingGlassIcon className="h-5 w-5" />
              </button>

              <button
                onClick={() => setWishlistOpen(true)}
                className="relative flex items-center space-x-2 p-2 sm:px-3 sm:py-2 text-gray-600 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all"
              >
                <HeartIcon className="h-5 w-5" />
                <span className="hidden sm:block text-sm">Wishlist</span>
                {wishlistCount > 0 && (
                  <span className="absolute -top-1 -right-1 sm:relative sm:top-0 sm:right-0 h-5 w-5 sm:h-auto sm:w-auto bg-rose-500 text-white text-[10px] sm:text-xs rounded-full sm:rounded-md px-1.5 flex items-center justify-center font-bold">
                    {wishlistCount}
                  </span>
                )}
              </button>

              <button
                onClick={() => setCartOpen(true)}
                className="relative flex items-center space-x-2 p-2 sm:px-3 sm:py-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-all"
              >
                <ShoppingCartIcon className="h-5 w-5" />
                <span className="hidden sm:block text-sm">Cart</span>
                {totalItems > 0 && (
                  <span className="absolute -top-1 -right-1 sm:relative sm:top-0 sm:right-0 h-5 w-5 sm:h-auto sm:w-auto bg-ink text-white text-[10px] sm:text-xs rounded-full sm:rounded-md px-1.5 flex items-center justify-center font-bold">
                    {totalItems}
                  </span>
                )}
              </button>

              {authReady ? (
                <Link href="/dashboard" className="flex items-center space-x-2 px-3 py-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-all">
                  <div className="h-7 w-7 bg-ink text-white rounded-full flex items-center justify-center text-xs font-bold">
                    {user?.name?.charAt(0).toUpperCase() || 'U'}
                  </div>
                  <span className="hidden sm:block text-sm font-medium">{user?.name?.split(' ')[0]}</span>
                </Link>
              ) : (
                <Link href="/auth/login" className="flex items-center space-x-2 px-3 py-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-all">
                  <UserIcon className="h-5 w-5" />
                  <div className="hidden sm:block">
                    <span className="text-xs text-gray-500 block leading-none">Account</span>
                    <span className="text-sm font-medium leading-tight">Sign In</span>
                  </div>
                </Link>
              )}

              <button
                type="button"
                className="lg:hidden p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-all"
                onClick={() => setMobileMenuOpen(true)}
              >
                <Bars3Icon className="h-6 w-6" />
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Search */}
        {mobileSearchOpen && (
          <div className="md:hidden border-t border-gray-100 px-4 py-2.5 bg-white">
            <div className="relative">
              <input
                ref={mobileInputRef}
                type="text"
                placeholder={inServices ? 'Search services...' : 'Search products...'}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={handleSearchKeyDown}
                className="w-full bg-gray-50 text-gray-900 placeholder-gray-400 pl-9 pr-10 py-2 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-ink border border-gray-200"
                autoComplete="off"
              />
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <button className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-700" onClick={() => { setMobileSearchOpen(false); setSearchQuery(''); }}>
                <XMarkIcon className="h-4 w-4" />
              </button>
            </div>
            {!searchLoading && searchQuery.length >= 2 && searchResults.length > 0 && (
              <div className="mt-2 bg-white rounded-xl border border-gray-200 shadow-lg overflow-hidden">
                {searchResults.slice(0, 4).map((product) => (
                  <Link key={product.id} href={`/products/${product.slug}`} onClick={() => { saveToHistory(searchQuery); setMobileSearchOpen(false); setSearchQuery(''); }} className="flex items-center gap-2.5 px-3 py-2 hover:bg-gray-50 border-b border-gray-50 last:border-0">
                    <div className="relative w-8 h-8 bg-gray-100 rounded overflow-hidden flex-shrink-0">
                      <Image
                        src={getStorageUrl(product.image)}
                        alt=""
                        fill
                        sizes="32px"
                        className="object-cover"
                        unoptimized={getStorageUrl(product.image).includes('localhost')}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-gray-900 truncate">{product.name}</p>
                      <p className="text-[10px] text-gray-500">৳{(product.discount_price ?? product.price).toLocaleString()}</p>
                    </div>
                  </Link>
                ))}
                <button onClick={() => handleSearchSubmit()} className="w-full py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 flex items-center justify-center gap-1 border-t border-gray-100">
                  See all results <ArrowRightIcon className="h-3 w-3" />
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Bottom Nav ── */}
      <div className="bg-gray-50/80 backdrop-blur-sm border-t border-b border-gray-200 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
        <div className="mx-auto max-w-[1800px] px-4 sm:px-6 lg:px-8">
          <div className="hidden lg:flex items-center h-11 gap-0.5 flex-wrap">
            {renderMegaMenu('services', 'Services', '/services', serviceCategories, false)}
            {renderPlainLink('Data Recovery', '/data-recovery')}
            {productCategories.map((cat, i) =>
              renderMegaMenu(
                `cat-${cat.id}`,
                cat.name,
                getCategoryUrl(cat, 'products'),
                cat.children ?? [],
                true,
                i >= productCategories.length - 3
              )
            )}
          </div>
        </div>
      </div>

      {/* ── Mobile Menu ── */}
      <div
        className="lg:hidden"
        aria-hidden={!mobileMenuOpen}
        style={{ pointerEvents: mobileMenuOpen ? 'auto' : 'none' }}
      >
        {/* Backdrop */}
        <div
          className={`fixed inset-0 z-50 bg-black/50 transition-opacity duration-300 ${mobileMenuOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
          onClick={() => setMobileMenuOpen(false)}
        />
        {/* Panel — slides in from the left (Startech-style) */}
        <div
          className={`fixed inset-y-0 left-0 z-50 flex w-[85%] max-w-sm flex-col bg-white shadow-lg transition-transform duration-300 ease-out ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}
          style={{ WebkitOverflowScrolling: 'touch' }}
        >
            {/* Top bar: X · Logo · Cart */}
            <div className="flex items-center justify-between border-b border-gray-200 bg-ink px-3 py-3">
              <button
                type="button"
                className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
                onClick={() => setMobileMenuOpen(false)}
                aria-label="Close menu"
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
              <Link href="/" className="flex items-center" onClick={() => setMobileMenuOpen(false)}>
                <Image src={companyLogo} alt={`${companyName} Logo`} width={110} height={34} className="h-8 w-auto brightness-0 invert" unoptimized />
              </Link>
              <button
                type="button"
                className="relative flex h-9 w-9 items-center justify-center rounded-full text-white hover:bg-white/10"
                onClick={() => { setMobileMenuOpen(false); setCartOpen(true); }}
                aria-label="Open cart"
              >
                <ShoppingCartIcon className="h-6 w-6" />
                {totalItems > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                    {totalItems}
                  </span>
                )}
              </button>
            </div>

            {/* Scrollable body */}
            <div className="flex-1 overflow-y-auto">
              {/* Services navigation */}
              <div className="divide-y divide-gray-200">
                {navigation.filter((n) => n.menuKey === 'services').map((item) => {
                  const isActive = pathname === item.href;

                  if (item.hasMegaMenu && item.menuKey === 'services') {
                    const cats = serviceCategories;
                    const isExpanded = mobileExpandedMenu === 'services';
                    return (
                      <div key={item.name}>
                        <div className="flex items-center">
                          <Link
                            href={item.href}
                            className={`flex-1 px-5 py-4 text-[15px] font-medium ${isActive ? 'text-gray-900' : 'text-gray-700 hover:bg-gray-50'}`}
                            onClick={() => setMobileMenuOpen(false)}
                          >
                            {item.name}
                          </Link>
                          {cats.length > 0 && (
                            <button
                              type="button"
                              className="flex h-full items-center justify-center px-5 py-4 text-gray-500 hover:bg-gray-50 hover:text-gray-900"
                              onClick={() => setMobileExpandedMenu(isExpanded ? null : 'services')}
                              aria-label={isExpanded ? 'Collapse services' : 'Expand services'}
                            >
                              {isExpanded ? <MinusIcon className="h-5 w-5" /> : <PlusIcon className="h-5 w-5" />}
                            </button>
                          )}
                        </div>
                        {isExpanded && cats.length > 0 && (
                          <div className="bg-gray-50 px-5 py-2">
                            {cats.map((cat) => (
                              <Link
                                key={cat.id}
                                href={getCategoryUrl(cat, 'services')}
                                className="block rounded-md px-3 py-2 text-sm font-medium text-gray-700 hover:bg-white hover:text-gray-900"
                                onClick={() => setMobileMenuOpen(false)}
                              >
                                {cat.name}
                              </Link>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  }

                  return (
                    <Link
                      key={item.name}
                      href={item.href}
                      className={`block px-5 py-4 text-[15px] font-medium ${isActive ? 'bg-gray-100 text-gray-900' : 'text-gray-700 hover:bg-gray-50'}`}
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      {item.name}
                    </Link>
                  );
                })}
              </div>

              {/* Top-level product categories — flat list, Startech-style */}
              <div className="mt-2 border-t-8 border-gray-100 divide-y divide-gray-200">
                {productCategories.map((cat) => {
                  const l2 = cat.children ?? [];
                  const isExpanded = mobileExpandedL1 === cat.id;
                  return (
                    <div key={cat.id}>
                      <div className="flex items-center">
                        <Link
                          href={getCategoryUrl(cat, 'products')}
                          className="flex-1 px-5 py-4 text-[15px] font-medium text-gray-900 hover:bg-gray-50"
                          onClick={() => setMobileMenuOpen(false)}
                        >
                          {cat.name}
                        </Link>
                        {l2.length > 0 && (
                          <button
                            type="button"
                            className="flex h-full items-center justify-center px-5 py-4 text-gray-500 hover:bg-gray-50 hover:text-gray-900"
                            onClick={() => {
                              const next = isExpanded ? null : cat.id;
                              setMobileExpandedL1(next);
                              setMobileExpandedL2(null);
                            }}
                            aria-label={isExpanded ? `Collapse ${cat.name}` : `Expand ${cat.name}`}
                          >
                            {isExpanded ? <MinusIcon className="h-5 w-5" /> : <PlusIcon className="h-5 w-5" />}
                          </button>
                        )}
                      </div>

                      {isExpanded && l2.length > 0 && (
                        <div className="bg-gray-50 px-5 py-2">
                          {l2.map((sub) => {
                            const l3 = sub.children ?? [];
                            const isLeaf = l3.length === 0;
                            const l2Expanded = mobileExpandedL2 === sub.id;
                            const subBrands = isLeaf ? (brandsByLeaf[sub.id] ?? []) : [];
                            const hasExpandable = !isLeaf || (isLeaf && (subBrands.length > 0 || !fetchedLeafIds.current.has(sub.id)));
                            return (
                              <div key={sub.id} className="py-0.5">
                                <div className="flex items-center">
                                  <Link
                                    href={getCategoryUrl(sub, 'products')}
                                    className="flex-1 rounded-md px-3 py-2 text-[15px] font-medium text-gray-700 hover:bg-white hover:text-gray-900"
                                    onClick={() => setMobileMenuOpen(false)}
                                  >
                                    {sub.name}
                                  </Link>
                                  {hasExpandable && (
                                    <button
                                      type="button"
                                      className="flex items-center justify-center px-3 py-2 text-gray-500 hover:text-gray-900"
                                      onClick={() => {
                                        const next = l2Expanded ? null : sub.id;
                                        setMobileExpandedL2(next);
                                        if (next != null && isLeaf) {
                                          fetchBrandsForLeaf(sub.id);
                                        }
                                      }}
                                      aria-label={l2Expanded ? `Collapse ${sub.name}` : `Expand ${sub.name}`}
                                    >
                                      {l2Expanded ? <MinusIcon className="h-4 w-4" /> : <PlusIcon className="h-4 w-4" />}
                                    </button>
                                  )}
                                </div>

                                {l2Expanded && !isLeaf && (
                                  <div className="ml-3 border-l border-gray-200 pl-2">
                                    {l3.map((leaf) => (
                                      <Link
                                        key={leaf.id}
                                        href={getCategoryUrl(leaf, 'products')}
                                        className="block rounded-md px-3 py-2 text-[15px] text-gray-600 hover:bg-white hover:text-gray-900"
                                        onClick={() => setMobileMenuOpen(false)}
                                      >
                                        {leaf.name}
                                      </Link>
                                    ))}
                                  </div>
                                )}

                                {l2Expanded && isLeaf && subBrands.length > 0 && (
                                  <div className="ml-3 border-l border-gray-200 pl-2">
                                    {subBrands.map((brand: ProductBrand) => (
                                      <Link
                                        key={brand.id}
                                        href={`${getCategoryUrl(sub, 'products')}?brand=${brand.slug}`}
                                        className="block rounded-md px-3 py-2 text-[15px] text-gray-600 hover:bg-white hover:text-gray-900"
                                        onClick={() => setMobileMenuOpen(false)}
                                      >
                                        {brand.name}
                                      </Link>
                                    ))}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Other navigation links */}
              <div className="mt-2 border-t-8 border-gray-100 divide-y divide-gray-200">
                {navigation.filter((n) => n.menuKey !== 'services').map((item) => {
                  const isActive = pathname === item.href;
                  return (
                    <Link
                      key={item.name}
                      href={item.href}
                      className={`block px-5 py-4 text-[15px] font-medium ${isActive ? 'bg-gray-100 text-gray-900' : 'text-gray-700 hover:bg-gray-50'}`}
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      {item.name}
                    </Link>
                  );
                })}
              </div>

              {/* Auth */}
              <div className="border-t-8 border-gray-100 p-5">
                {authReady ? (
                  <Link href="/dashboard" className="flex items-center space-x-3 rounded-xl px-4 py-3 text-base font-medium text-gray-700 hover:bg-gray-50 hover:text-gray-900" onClick={() => setMobileMenuOpen(false)}>
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-ink text-sm font-bold text-white">
                      {user?.name?.charAt(0).toUpperCase() || 'U'}
                    </div>
                    <span>Dashboard</span>
                  </Link>
                ) : (
                  <Link href="/auth/login" className="block w-full rounded-xl bg-ink px-4 py-3 text-center text-base font-semibold text-white hover:bg-ink/90" onClick={() => setMobileMenuOpen(false)}>
                    Sign In
                  </Link>
                )}
              </div>
            </div>
          </div>
        </div>

      {cartOpen && <Cart open={cartOpen} onClose={() => setCartOpen(false)} />}
      {wishlistOpen && <WishlistDrawer open={wishlistOpen} onClose={() => setWishlistOpen(false)} />}
      <CompareDrawer />
    </header>
  );
}
