'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import type { ServiceCard } from '@/lib/api/cms';
import type { Product } from '@/lib/types';
import { resolveIcon } from '@/lib/resolve-icon';
import OptimizedImage from '@/components/OptimizedImage';
import { useCartStore } from '@/lib/stores/cart-store';
import { useSettingsStore } from '@/lib/stores/settings-store';
import { useHomepageStore } from '@/lib/stores/homepage-store';
import {
  ComputerDesktopIcon,
  CpuChipIcon,
  ServerIcon,
  ShieldCheckIcon,
  ClockIcon,
  BoltIcon,
  StarIcon,
  CheckCircleIcon,
  ArrowRightIcon,
  ChevronRightIcon,
  XMarkIcon,
  WrenchScrewdriverIcon,
  DocumentMagnifyingGlassIcon,
  CloudArrowUpIcon,
  CogIcon,
  UserGroupIcon,
  TrophyIcon,
  CubeIcon,
  MapPinIcon,
  PhoneIcon,
  HeartIcon,
  ShoppingCartIcon,
  EyeIcon,
  ArrowsRightLeftIcon,
  DevicePhoneMobileIcon,
  DeviceTabletIcon,
  MusicalNoteIcon,
  TvIcon,
  SpeakerWaveIcon,
  CameraIcon,
  PuzzlePieceIcon,
  WifiIcon,
  Battery100Icon,
  SignalIcon,
} from '@heroicons/react/24/outline';
import {
  ComputerDesktopIcon as ComputerDesktopSolidIcon,
  CpuChipIcon as CpuChipSolidIcon,
  ServerIcon as ServerSolidIcon,
  HeartIcon as HeartSolidIcon,
} from '@heroicons/react/24/solid';

const stats = [
  { label: 'Devices Repaired', value: '15,000+', icon: ComputerDesktopIcon },
  { label: 'Data Recovery Success', value: '98%', icon: ShieldCheckIcon },
  { label: 'Average Repair Time', value: '24 Hours', icon: ClockIcon },
  { label: 'Service Centers in Dhaka', value: '5+', icon: MapPinIcon },
];

// Tailwind color → CSS hex mapping for dynamic gradient rendering
const TW_COLORS: Record<string, string> = {
  'orange-500': '#f97316', 'red-500': '#ef4444', 'red-600': '#dc2626',
  'blue-500': '#3b82f6', 'blue-600': '#2563eb', 'indigo-600': '#4f46e5',
  'green-500': '#22c55e', 'teal-600': '#0d9488', 'emerald-500': '#10b981',
  'cyan-600': '#0891b2', 'purple-500': '#a855f7', 'pink-500': '#ec4899',
  'yellow-400': '#facc15', 'amber-500': '#f59e0b',
};

const gradientStyle = (from?: string, to?: string) => ({
  background: `linear-gradient(to bottom right, ${TW_COLORS[from || ''] || '#3b82f6'}, ${TW_COLORS[to || ''] || '#4f46e5'})`,
});

// Service descriptions come out of a rich-text editor in the admin panel — strip the markup for
// a plain-text card preview instead of showing literal tags.
function stripHtml(html?: string): string {
  if (!html) return '';
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

export default function Home() {
  const { addItem: addToCartStore } = useCartStore();

  // Shared stores — each API is fetched exactly once regardless of how many
  // components call fetchSettings() / fetchHomepageData().
  const { data: settingsData, fetched: settingsFetched, fetchSettings } = useSettingsStore();
  const {
    promoSlides,
    sideBanners,
    featuredProducts,
    productsLoading,
    featuredCategories,
    categoriesLoading,
    featuredServices,
    servicesLoading,
    mainBranch,
    fetchHomepageData,
  } = useHomepageStore();

  const [activePromo, setActivePromo] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const [wishlist, setWishlist] = useState<number[]>([]);
  const [compareList, setCompareList] = useState<number[]>([]);
  const [addingToCartId, setAddingToCartId] = useState<number | null>(null);

  // Soft spotlight glow that eases toward the cursor in the hero — a gentle,
  // lagged follow (via the CSS transition on the element below, animating
  // `transform` rather than the gradient itself so it stays smooth) instead
  // of an instant snap.
  const [heroGlowPos, setHeroGlowPos] = useState({ x: 400, y: 150 });
  const handleHeroMouseMove = (e: React.MouseEvent<HTMLElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setHeroGlowPos({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
  };

  // Mobile Safari crashes when the hero composites many blurred/animated layers.
  // `hidden md:block` still allocates the layer; a mount-time matchMedia check
  // means phones never instantiate these DOM nodes at all.
  const [isDesktop, setIsDesktop] = useState(false);
  useEffect(() => {
    const mql = window.matchMedia('(min-width: 768px)');
    const update = () => setIsDesktop(mql.matches);
    update();
    mql.addEventListener('change', update);
    return () => mql.removeEventListener('change', update);
  }, []);

  // Derive settings-based values reactively from the shared settings store
  const newsItems: string[] = useMemo(() => {
    const t = settingsData.news_ticker_items;
    try {
      if (Array.isArray(t)) return t as string[];
      if (typeof t === 'string') return JSON.parse(t) as string[];
    } catch { /* ignore parse errors */ }
    return [];
  }, [settingsData]);

  const serviceCards: ServiceCard[] = useMemo(() => {
    const c = settingsData.homepage_service_cards;
    try {
      if (Array.isArray(c)) return c as ServiceCard[];
      if (typeof c === 'string') return JSON.parse(c) as ServiceCard[];
    } catch { /* ignore parse errors */ }
    return [];
  }, [settingsData]);

  // Text defaults only apply after the settings API resolves — otherwise the
  // CTA would render "Ready to Fix Your Device?" on first paint, then swap to
  // whatever the admin configured, producing a visible flicker.
  const ctaBadgeText = settingsFetched ? ((settingsData.cta_badge_text as string | undefined) ?? 'Professional Repair Services') : '';
  const ctaTitle = settingsFetched ? ((settingsData.cta_title as string | undefined) ?? 'Ready to Fix Your Device?') : '';
  const ctaDescription = settingsFetched ? ((settingsData.cta_description as string | undefined) ?? 'Get a free diagnosis and quote. Our expert technicians are standing by to help you with all your repair needs.') : '';
  const ctaPrimaryButtonText = settingsFetched ? ((settingsData.cta_primary_button_text as string | undefined) ?? 'Book Service') : '';
  const ctaPrimaryButtonLink = settingsFetched ? ((settingsData.cta_primary_button_link as string | undefined) ?? '/services') : '/services';
  const ctaPhone = settingsFetched ? ((settingsData.topbar_phone as string | undefined) ?? '') : '';

  const ctaTrustIndicators: string[] = useMemo(() => {
    if (!settingsFetched) return [];
    const rawTrust = settingsData.cta_trust_indicators;
    try {
      const parsed = Array.isArray(rawTrust)
        ? rawTrust as string[]
        : typeof rawTrust === 'string'
          ? JSON.parse(rawTrust) as string[]
          : [];
      return parsed.length ? parsed : ['Free Diagnosis', '90-Day Warranty', 'Genuine Parts', 'Same Day Service'];
    } catch {
      return ['Free Diagnosis', '90-Day Warranty', 'Genuine Parts', 'Same Day Service'];
    }
  }, [settingsData, settingsFetched]);

  useEffect(() => {
    setIsVisible(true);
  }, []);

  // Fetch store data exactly once on mount.
  useEffect(() => {
    fetchSettings();
    fetchHomepageData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-advance promo carousel (separate effect so it reacts when slides load)
  useEffect(() => {
    if (promoSlides.length <= 1) return;
    const promoInterval = setInterval(() => {
      setActivePromo(prev => (prev + 1) % promoSlides.length);
    }, 4000);
    return () => clearInterval(promoInterval);
  }, [promoSlides.length]);



  const handleAddToCart = async (product: Product) => {
    // Guests get a session-scoped cart (see cart-store.ts / guest.ts) that carries all the way
    // through to guest checkout — there's no reason to force a login here, and doing so silently
    // dead-ends every anonymous visitor's "Add to Cart" click at the login screen instead.
    setAddingToCartId(product.id);
    try {
      await addToCartStore('product', product.id, 1);
    } catch {
      // error is logged in the store
    } finally {
      setAddingToCartId(null);
    }
  };

  const toggleWishlist = (productId: number) => {
    setWishlist(prev =>
      prev.includes(productId)
        ? prev.filter(item => item !== productId)
        : [...prev, productId]
    );
  };

  const toggleCompare = (productId: number) => {
    setCompareList(prev =>
      prev.includes(productId)
        ? prev.filter(item => item !== productId)
        : prev.length < 4 ? [...prev, productId] : prev
    );
  };

  return (
    <div className="bg-white min-h-screen">
      {/* Hero Section — off-white, kept in the same light palette as the sections
          below so the page reads as one system. Just a barely-there diagonal
          gradient wash + a soft glow that eases toward the cursor, no texture. */}
      <section
        className="relative overflow-hidden bg-gradient-to-br from-white via-gray-50 to-gray-100"
        onMouseMove={isDesktop ? handleHeroMouseMove : undefined}
      >

        {isDesktop && (
          <>
            <div
              className="absolute top-0 left-0 w-[500px] h-[500px] rounded-full pointer-events-none blur-3xl transition-transform duration-500 ease-out will-change-transform"
              style={{
                background: 'radial-gradient(circle, rgba(21,24,29,0.07), transparent 70%)',
                transform: `translate3d(${heroGlowPos.x - 250}px, ${heroGlowPos.y - 250}px, 0)`,
              }}
            />
            <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-gradient-to-bl from-gray-300/30 via-gray-200/15 to-transparent rounded-full blur-3xl animate-pulse" style={{ animationDuration: '6s' }} />
            <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-gradient-to-tr from-gray-300/20 via-gray-200/10 to-transparent rounded-full blur-3xl animate-pulse" style={{ animationDuration: '7s', animationDelay: '1s' }} />
          </>
        )}

        <div className="relative max-w-[1600px] mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6 lg:py-6">
          {/* StarTech-Style Promotional Carousel */}
          <div className={`mb-4 sm:mb-5 transform transition-all duration-1000 ${isVisible ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'}`}>
            {/* 10-column split so main/side ratio can move in finer steps than a 4-column grid
                allows — currently 60/40, main slide narrower and side banners wider. */}
            <div className="grid grid-cols-1 lg:grid-cols-10 gap-2 sm:gap-3">
              {/* Main Large Carousel - Left Side (6 of 10 columns = 60%) */}
              <div className="lg:col-span-6 relative rounded-xl sm:rounded-xl overflow-hidden aspect-[16/9] sm:aspect-auto sm:h-[300px] md:h-[420px] shadow-md border border-white/10">
                {/* Slides */}
                {promoSlides.length === 0 && (
                  <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-gray-700 to-ink">
                    <p className="text-white/30 text-sm">Add slides via Admin → CMS → Banners</p>
                  </div>
                )}
                {promoSlides.map((slide, index) => (
                  <Link
                    key={slide.id ?? index}
                    href={slide.link_url || '/'}
                    className={`absolute inset-0 transition-all duration-700 ease-in-out ${index === activePromo
                      ? 'opacity-100 translate-x-0'
                      : index < activePromo
                        ? 'opacity-0 -translate-x-full'
                        : 'opacity-0 translate-x-full'
                      }`}
                  >
                    {slide.image ? (
                      <div className="relative w-full h-full bg-ink">
                        <OptimizedImage
                          src={slide.image}
                          alt={slide.title}
                          fill
                          className="object-cover"
                          priority={index === 0}
                          sizes="(max-width: 1024px) 100vw, 75vw"
                        />
                        {/* Title / subtitle overlay */}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
                        <div className="absolute bottom-0 left-0 right-0 px-3 pb-5 pt-3 sm:px-4 sm:pb-6 sm:pt-4 md:px-6 md:pb-8 md:pt-6">
                          <h2 className="text-sm sm:text-lg md:text-2xl font-bold text-white drop-shadow-lg leading-tight">
                            {slide.title}
                          </h2>
                          {slide.subtitle && (
                            <p className="hidden sm:block text-white/85 text-xs md:text-sm mt-1 line-clamp-2">{slide.subtitle}</p>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div
                        className="w-full h-full flex flex-col items-center justify-center text-center px-8"
                        style={gradientStyle(slide.meta?.gradient_from, slide.meta?.gradient_to)}
                      >
                        <h2 className="text-lg sm:text-2xl md:text-2xl font-bold text-white mb-1 sm:mb-2 drop-shadow-lg">{slide.title}</h2>
                        {slide.subtitle && <p className="text-white/85 text-xs sm:text-sm md:text-base">{slide.subtitle}</p>}
                      </div>
                    )}
                  </Link>
                ))}

                {/* Navigation Dots */}
                <div className="absolute bottom-1.5 sm:bottom-3 left-1/2 -translate-x-1/2 flex space-x-1.5 sm:space-x-2 z-10">
                  {promoSlides.map((_, index) => (
                    <button
                      key={index}
                      onClick={() => setActivePromo(index)}
                      className={`dot-indicator h-1.5 sm:h-2 rounded-full transition-all duration-300 ${index === activePromo
                        ? 'bg-white w-4 sm:w-6 shadow-lg'
                        : 'bg-white/40 hover:bg-white/60 w-1.5 sm:w-2'
                        }`}
                    />
                  ))}
                </div>

                {/* Arrow Navigation */}
                <button
                  onClick={() => setActivePromo((prev) => (prev - 1 + promoSlides.length) % promoSlides.length)}
                  className="absolute left-1 sm:left-2 top-1/2 -translate-y-1/2 w-7 h-7 sm:w-8 sm:h-8 bg-black/30 hover:bg-black/50 rounded-full flex items-center justify-center text-white transition-all duration-300 hover:scale-110"
                >
                  <ChevronRightIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4 rotate-180" />
                </button>
                <button
                  onClick={() => setActivePromo((prev) => (prev + 1) % promoSlides.length)}
                  className="absolute right-1 sm:right-2 top-1/2 -translate-y-1/2 w-7 h-7 sm:w-8 sm:h-8 bg-black/30 hover:bg-black/50 rounded-full flex items-center justify-center text-white transition-all duration-300 hover:scale-110"
                >
                  <ChevronRightIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                </button>
              </div>

              {/* Side Banners - Right Side (4 of 10 columns = 40%) */}
              <div className="lg:col-span-4 grid grid-cols-2 lg:grid-cols-1 lg:grid-rows-2 gap-2 sm:gap-3">
                {sideBanners.map((banner, index) => (
                  <Link
                    key={banner.id ?? index}
                    href={banner.link_url || '/'}
                    className={`relative rounded-xl sm:rounded-xl overflow-hidden h-[100px] sm:h-[120px] lg:h-auto shadow-md group border border-white/10 ${banner.image ? 'bg-ink' : ''}`}
                    style={banner.image ? undefined : gradientStyle(banner.meta?.gradient_from, banner.meta?.gradient_to)}
                  >
                    {banner.image ? (
                      <>
                        <OptimizedImage
                          src={banner.image}
                          alt={banner.title}
                          fill
                          className="object-cover"
                          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 50vw, 25vw"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
                        <div className="absolute bottom-0 left-0 right-0 p-2 sm:p-3">
                          <h3 className="text-xs sm:text-sm md:text-lg font-bold text-white drop-shadow-lg leading-tight line-clamp-1">
                            {banner.title}
                          </h3>
                          {banner.subtitle && <p className="text-white/90 text-[10px] sm:text-xs line-clamp-1">{banner.subtitle}</p>}
                        </div>
                      </>
                    ) : (
                      /* Gradient fallback with icon/text */
                      <div className="absolute inset-0 flex flex-col justify-center items-center text-center p-2 sm:p-3">
                        {banner.meta?.icon && (
                          <span className="text-2xl sm:text-2xl mb-1">{banner.meta.icon}</span>
                        )}
                        <h3 className="text-xs sm:text-sm md:text-lg font-bold text-white drop-shadow-lg line-clamp-1">
                          {banner.title}
                        </h3>
                        <p className="text-white/90 text-[10px] sm:text-xs line-clamp-1">{banner.subtitle}</p>
                      </div>
                    )}

                    {/* Hover overlay */}
                    <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                  </Link>
                ))}
              </div>
            </div>

            {/* News Ticker */}
            <div className="mt-2 sm:mt-3 overflow-hidden">
              <div className="flex items-center">
                {/* Scrolling Text */}
                <div className="flex-1 overflow-hidden">
                  <div className="flex animate-marquee whitespace-nowrap py-2">
                    {[...newsItems, ...newsItems].map((item, index) => (
                      <span key={index} className="text-gray-600 text-xs mx-6">
                        {item}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Three Core Service Cards — CMS-controlled */}
          {(() => {
            const CARD_ICONS = [DocumentMagnifyingGlassIcon, WrenchScrewdriverIcon, CubeIcon];
            return (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-5 lg:gap-4">
                {serviceCards.map((card, index) => {
                  const Icon = CARD_ICONS[index % CARD_ICONS.length];
                  return (
                    <div
                      key={index}
                      className={`transform transition-all duration-1000 ${isVisible ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'}`}
                      style={{ transitionDelay: `${index * 200}ms` }}
                    >
                      <div className="relative group h-full">
                        <div className="absolute -inset-0.5 bg-gradient-to-r from-white/10 via-white/5 to-white/10 rounded-xl blur opacity-0 group-hover:opacity-100 transition duration-500" />
                        <div className="relative bg-ink rounded-xl sm:rounded-xl p-4 sm:p-5 lg:p-6 border border-white/10 h-full flex flex-col hover:border-white/20 transition-all duration-300">
                          {/* Badge */}
                          <div className="absolute -top-2 -right-2 bg-white text-gray-900 px-2.5 sm:px-3 py-0.5 sm:py-1 rounded-full font-bold text-[11px] sm:text-xs shadow-lg">
                            {card.badge}
                          </div>

                          {/* Icon */}
                          <div className="mb-3 sm:mb-4">
                            <div className="inline-block p-2.5 sm:p-3 bg-white/10 rounded-xl border border-white/10">
                              <Icon className="w-6 h-6 sm:w-8 sm:h-8 text-white" />
                            </div>
                          </div>

                          {/* Title */}
                          <h3 className="text-lg sm:text-xl font-bold text-white mb-1.5 sm:mb-2">{card.title}</h3>
                          <p className="text-gray-400 mb-3 sm:mb-5 text-xs sm:text-sm flex-grow">{card.description}</p>

                          {/* Key Features */}
                          <div className="space-y-1 sm:space-y-1.5 mb-3 sm:mb-5">
                            {(card.features || []).map((feature, idx) => (
                              <div key={idx} className="flex items-center text-gray-300 text-xs">
                                <CheckCircleIcon className="w-4 h-4 mr-2 text-white flex-shrink-0" />
                                {feature}
                              </div>
                            ))}
                          </div>

                          {/* Stats */}
                          <div className="grid grid-cols-2 gap-2 mb-3 sm:mb-5">
                            <div className="bg-white/5 rounded-lg p-1.5 sm:p-2 text-center border border-white/5">
                              <div className="text-white font-bold text-base sm:text-lg">{card.stat1_value}</div>
                              <div className="text-gray-500 text-[10px] sm:text-xs">{card.stat1_label}</div>
                            </div>
                            <div className="bg-white/5 rounded-lg p-1.5 sm:p-2 text-center border border-white/5">
                              <div className="text-white font-bold text-base sm:text-lg">{card.stat2_value}</div>
                              <div className="text-gray-500 text-[10px] sm:text-xs">{card.stat2_label}</div>
                            </div>
                          </div>

                          {/* CTA Button */}
                          <Link
                            href={card.cta_link || '/services'}
                            className="block w-full text-center px-4 sm:px-5 py-2.5 sm:py-3 bg-white text-gray-900 rounded-xl font-semibold hover:bg-gray-100 transition-all duration-300 transform hover:-translate-y-0.5 group"
                          >
                            <span className="flex items-center justify-center text-xs sm:text-sm">
                              {card.cta_text}
                              <ArrowRightIcon className="ml-2 w-4 h-4 group-hover:translate-x-1 transition-transform" />
                            </span>
                          </Link>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()}

        </div>
      </section>

      {/* Featured Category Section - Dynamic */}
      <section className="py-6 bg-gray-50">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8">
          {/* Section Header */}
          <div className="text-center mb-5">
            <h2 className="text-xl lg:text-2xl font-bold text-gray-900 mb-2">
              Featured Category
            </h2>
            <p className="text-gray-600 text-sm">
              Explore Top Categories &amp; Shop Premium Quality Products and Services
            </p>
          </div>

          {/* Categories Grid */}
          {categoriesLoading ? (
            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-4 lg:grid-cols-8 gap-4">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="h-28 rounded-xl bg-gray-200 animate-pulse" />
              ))}
            </div>
          ) : featuredCategories.length === 0 ? (
            <div className="text-center py-6 text-gray-400 text-sm">No featured categories yet.</div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-4 lg:grid-cols-8 gap-4">
              {featuredCategories.map((category) => {
                const RenderIcon = resolveIcon(category.icon);
                // Use the slug-based category path (e.g. /products/desktop-1),
                // mirroring the catch-all resolver, instead of ?category_id=.
                const categoryHref = category.breadcrumb && category.breadcrumb.length > 0
                  ? '/products/' + category.breadcrumb.map((b) => b.slug).join('/')
                  : category.slug
                    ? `/products/${category.slug}`
                    : '/products';
                return (
                  <Link
                    key={category.id}
                    href={categoryHref}
                    className="group flex flex-col items-center justify-center py-6 px-3 bg-white rounded-xl border border-gray-200 hover:border-ink hover:shadow-lg transition-all duration-300"
                  >
                    <div className="w-16 h-16 flex items-center justify-center mb-3">
                      <RenderIcon className="w-12 h-12 text-gray-700 stroke-[1.5] group-hover:text-ink transition-colors duration-300" />
                    </div>
                    <span className="text-xs text-gray-700 font-medium text-center leading-tight group-hover:text-ink transition-colors duration-300">
                      {category.name}
                    </span>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* Featured Services Section */}
      <section className="py-6 bg-white">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8">
          {/* Section Header */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-5">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-1">
                Featured Services
              </h2>
              <p className="text-gray-500 text-sm">
                Professional repair services by certified technicians
              </p>
            </div>
            <Link
              href="/services"
              className="mt-4 md:mt-0 inline-flex items-center text-sm font-semibold text-gray-700 hover:text-gray-900 transition-colors"
            >
              View All Services
              <ChevronRightIcon className="ml-1 w-4 h-4" />
            </Link>
          </div>

          {/* Services Slider — small, uniform-size cards with just the basics plus a short
              truncated description; auto-slides through every featured service. */}
          {servicesLoading ? (
            <div className="flex gap-4 overflow-x-hidden">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="flex-shrink-0 w-56 h-44 bg-gray-50 rounded-xl border border-gray-200 p-4 animate-pulse space-y-2">
                  <div className="h-2.5 bg-gray-100 rounded w-1/3" />
                  <div className="h-4 bg-gray-100 rounded w-3/4" />
                  <div className="h-3 bg-gray-100 rounded w-full" />
                  <div className="h-3 bg-gray-100 rounded w-2/3" />
                </div>
              ))}
            </div>
          ) : featuredServices.length === 0 ? (
            <div className="text-center py-6 text-gray-500">
              No featured services available.
            </div>
          ) : (
            <div className="overflow-hidden py-2 -my-2">
              <div className="flex gap-4 w-max animate-marquee marquee-pausable">
                {[...featuredServices, ...featuredServices].map((service, idx) => {
                const currentPrice = service.current_price ?? service.discount_price ?? service.base_price;
                const originalPrice = service.discount_price ? service.base_price : null;
                const discountPct = originalPrice
                  ? Math.round((1 - currentPrice / originalPrice) * 100)
                  : null;
                // Some service names have "Starting Price" redundantly baked into the title
                // text itself (a content issue, not display data) — strip it here so the
                // card reads as "Basic Recovery" / "৳2,000" instead of repeating itself.
                const displayName = service.name.replace(/\s*starting\s*price\s*$/i, '').trim();
                // Some services have no description filled in yet in the admin panel —
                // fall back to a plain "..." placeholder rather than leaving a blank gap.
                const description = stripHtml(service.short_description || service.description) || '...';

                return (
                  <Link
                    key={`${service.id}-${idx}`}
                    href={`/services/${service.slug}`}
                    className="group flex-shrink-0 w-56 h-44 bg-white rounded-xl border-2 border-gray-200 shadow-sm hover:shadow-lg hover:border-indigo-400 hover:-translate-y-1 transition-all duration-300 p-4 flex flex-col"
                  >
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <span className="inline-block bg-indigo-50 text-indigo-700 text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full truncate">
                        {service.category?.name || 'Service'}
                      </span>
                      {discountPct !== null && (
                        <span className="flex-shrink-0 bg-red-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded">
                          -{discountPct}%
                        </span>
                      )}
                    </div>

                    <h3 className="text-sm font-bold text-gray-900 line-clamp-1 leading-snug group-hover:text-indigo-700 transition-colors">
                      {displayName}
                    </h3>

                    <p className="text-xs text-gray-500 line-clamp-2 mt-1 leading-snug">
                      {description}
                    </p>

                    <div className="flex items-center justify-between mt-auto pt-2 border-t border-gray-100">
                      {service.duration_estimate ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded">
                          <ClockIcon className="w-3 h-3" />
                          {service.duration_estimate}
                        </span>
                      ) : <span />}
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-base font-extrabold text-green-600">
                          ৳{Number(currentPrice).toLocaleString()}
                        </span>
                        {originalPrice !== null && (
                          <span className="text-[11px] text-gray-400 line-through">
                            ৳{Number(originalPrice).toLocaleString()}
                          </span>
                        )}
                      </div>
                    </div>
                  </Link>
                );
                })}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Featured Products Section - Modern Compact */}
      <section className="py-6 bg-gray-100">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8">
          {/* Section Header - Compact */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-5">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-1">
                Featured Products
              </h2>
              <p className="text-gray-500 text-sm">
                Genuine parts and accessories with warranty
              </p>
            </div>
            <Link
              href="/products"
              className="mt-4 md:mt-0 inline-flex items-center text-sm font-semibold text-gray-700 hover:text-gray-900 transition-colors"
            >
              View All
              <ChevronRightIcon className="ml-1 w-4 h-4" />
            </Link>
          </div>

          {/* Products Grid - Compact Cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-5">
            {productsLoading ? (
              [...Array(30)].map((_, i) => (
                <div key={i} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden animate-pulse">
                  <div className="w-full h-50 bg-gray-100 m-2" />
                  <div className="p-4 space-y-2">
                    <div className="h-3 bg-gray-100 rounded w-3/4" />
                    <div className="h-5 bg-gray-100 rounded w-1/2" />
                  </div>
                </div>
              ))
            ) : featuredProducts.length === 0 ? (
              <div className="col-span-2 md:col-span-3 lg:col-span-6 text-center py-6 text-gray-500">
                No featured products available.
              </div>
            ) : (
              // Cap to a whole number of full rows (6 per row, up to 5 rows) so the grid never
              // ends in a lopsided partial row.
              featuredProducts
                .slice(0, featuredProducts.length < 6 ? featuredProducts.length : Math.min(30, Math.floor(featuredProducts.length / 6) * 6))
                .map((product) => {
                const currentPrice = product.current_price ?? product.discount_price ?? product.price;
                const originalPrice = product.discount_price ? product.price : null;
                const discountPct = originalPrice
                  ? Math.round((1 - currentPrice / originalPrice) * 100)
                  : null;

                return (
                  <Link
                    key={product.id}
                    href={`/products/${product.slug}`}
                    className="group flex flex-col h-full bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden hover:shadow-md hover:border-gray-300 transition-all duration-300 hover:-translate-y-1"
                  >
                    {/* Image */}
                    <div className="relative overflow-hidden bg-gray-100 h-50 flex-shrink-0">
                      <OptimizedImage
                        src={product.image || '/images/placeholder.jpg'}
                        alt={product.name}
                        width={400}
                        height={192}
                        className="w-full h-50 object-cover group-hover:scale-105 transition-transform duration-300"
                        sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                      />
                      {/* Discount Badge */}
                      {discountPct !== null && (
                        <span className="absolute top-3 left-3 bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-lg">
                          -{discountPct}%
                        </span>
                      )}
                      {/* Quick Add */}
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          handleAddToCart(product);
                        }}
                        disabled={addingToCartId === product.id}
                        className="absolute bottom-3 right-3 w-10 h-10 bg-white rounded-full shadow-lg flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 hover:bg-ink hover:text-white border border-gray-200"
                      >
                        <ShoppingCartIcon className="w-5 h-5" />
                      </button>
                    </div>

                    {/* Info */}
                    <div className="p-4 border-t border-gray-100 flex flex-col flex-1">
                      <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">
                        {product.category?.name}
                      </p>
                      <h3 className="text-base font-semibold text-gray-900 line-clamp-2 mb-3 leading-snug min-h-[2.75rem] group-hover:text-gray-700">
                        {product.name}
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
              })
            )}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-7 bg-gray-200 relative overflow-hidden">
        {isDesktop && (
          <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-gradient-to-br from-gray-400/25 via-gray-300/15 to-transparent rounded-full -translate-y-1/2 translate-x-1/4 blur-3xl" />
        )}

        <div className="relative max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 text-center">
          {settingsFetched ? (
            <>
              <div className="inline-flex items-center gap-2 bg-ink px-4 py-2 rounded-full mb-6">
                <WrenchScrewdriverIcon className="h-5 w-5 text-white" />
                <span className="text-white text-sm font-medium">{ctaBadgeText}</span>
              </div>

              <h2 className="text-2xl md:text-2xl font-semibold text-gray-900 mb-4">
                {ctaTitle}
              </h2>
              <p className="text-gray-600 mb-5 max-w-2xl mx-auto">
                {ctaDescription}
              </p>

              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link
                  href={ctaPrimaryButtonLink}
                  className="group px-8 py-3.5 bg-ink text-white font-semibold rounded-lg hover:bg-ink/90 transition-all flex items-center justify-center gap-2"
                >
                  <WrenchScrewdriverIcon className="h-5 w-5" />
                  {ctaPrimaryButtonText}
                  <ArrowRightIcon className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </Link>

                {ctaPhone && (
                  <a
                    href={`tel:${ctaPhone.replace(/[\s\-()]/g, '')}`}
                    className="px-8 py-3.5 bg-white border border-gray-300 text-gray-800 font-semibold rounded-lg hover:bg-gray-50 transition-all flex items-center justify-center gap-2 shadow-sm"
                  >
                    <PhoneIcon className="h-5 w-5" />
                    Call: {ctaPhone}
                  </a>
                )}
              </div>
            </>
          ) : (
            <>
              <div className="inline-block h-9 w-56 rounded-full bg-ink/80 animate-pulse mb-6" />
              <div className="h-8 w-2/3 max-w-lg bg-gray-300 rounded animate-pulse mx-auto mb-4" />
              <div className="h-4 w-full max-w-2xl bg-gray-300 rounded animate-pulse mx-auto mb-2" />
              <div className="h-4 w-4/5 max-w-xl bg-gray-300 rounded animate-pulse mx-auto mb-5" />
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <div className="h-[52px] w-44 rounded-lg bg-gray-300 animate-pulse mx-auto sm:mx-0" />
                <div className="h-[52px] w-48 rounded-lg bg-gray-200 animate-pulse mx-auto sm:mx-0" />
              </div>
            </>
          )}

          {/* Trust indicators */}
          {ctaTrustIndicators.length > 0 && (
            <div className="flex flex-wrap items-center justify-center gap-4 mt-5 pt-8 border-t border-gray-300">
              {ctaTrustIndicators.map((indicator, idx) => (
                <div key={idx} className="flex items-center gap-2 text-gray-700 text-sm">
                  <CheckCircleIcon className="h-5 w-5 text-gray-600" />
                  <span>{indicator}</span>
                </div>
              ))}
            </div>
          )}

          {/* Service Center Card */}
          <div className="mt-5 bg-white rounded-xl p-8 shadow-sm w-full max-w-3xl mx-auto text-center">
            <div className="w-14 h-14 bg-ink rounded-full flex items-center justify-center mx-auto mb-4">
              <MapPinIcon className="h-7 w-7 text-white" />
            </div>
            {mainBranch ? (
              <>
                <h3 className="text-xl font-semibold text-gray-900 mb-1">{mainBranch.name}</h3>
                <p className="text-gray-500 mb-4">{mainBranch.address}</p>
                <div className="flex items-center justify-center gap-5 text-sm text-gray-600 mb-6">
                  <a href={`tel:${mainBranch.phone.replace(/[\s\-()]/g, '')}`} className="flex items-center gap-2 hover:text-gray-900">
                    <PhoneIcon className="h-4 w-4" />
                    {mainBranch.phone}
                  </a>
                  {mainBranch.hours && (
                    <span className="flex items-center gap-2">
                      <ClockIcon className="h-4 w-4" />
                      {mainBranch.hours}
                    </span>
                  )}
                </div>
              </>
            ) : (
              <>
                <div className="h-6 bg-gray-100 rounded w-48 mx-auto mb-2 animate-pulse" />
                <div className="h-4 bg-gray-100 rounded w-64 mx-auto mb-4 animate-pulse" />
                <div className="flex justify-center gap-5 mb-6">
                  <div className="h-4 bg-gray-100 rounded w-32 animate-pulse" />
                  <div className="h-4 bg-gray-100 rounded w-32 animate-pulse" />
                </div>
              </>
            )}
            <Link
              href="/locations"
              className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-ink text-white font-semibold rounded-lg hover:bg-ink/90 transition-all"
            >
              <MapPinIcon className="h-4 w-4" />
              View All Locations
              <ArrowRightIcon className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}