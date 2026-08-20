/**
 * Homepage data store — fetches all home-page APIs exactly once per page load.
 *
 * Before this store the following endpoints were called multiple times:
 *   - /api/public/home           (React Strict Mode double-invoke)
 *   - /api/products/featured     (React Strict Mode double-invoke)
 *   - /api/categories/products?is_featured=true  (page.tsx + ProductCategories.tsx)
 *   - /api/branch-locations/featured (React Strict Mode double-invoke)
 *
 * Now every consumer calls fetchHomepageData() and gets the cached result.
 */

import { create } from 'zustand';
import { cmsService, type CmsBanner, type HomepageCmsData } from '@/lib/api/cms';
import { productService } from '@/lib/api/product';
import { branchLocationService, type BranchLocation } from '@/lib/api/branchLocation';
import type { Product, ProductCategory } from '@/lib/types';

interface HomepageState {
    // /public/home data
    homepageData: HomepageCmsData | null;
    promoSlides: CmsBanner[];
    sideBanners: CmsBanner[];

    // /products/featured
    featuredProducts: Product[];
    productsLoading: boolean;

    // /categories/products?is_featured=true
    featuredCategories: ProductCategory[];
    categoriesLoading: boolean;

    // /branch-locations/featured
    mainBranch: BranchLocation | null;

    // Guard flags
    fetched: boolean;
    loading: boolean;

    /** Trigger all home-page fetches. Subsequent calls are no-ops once fetched. */
    fetchHomepageData: () => Promise<void>;
}

export const useHomepageStore = create<HomepageState>((set, get) => ({
    homepageData: null,
    promoSlides: [],
    sideBanners: [],
    featuredProducts: [],
    productsLoading: true,
    featuredCategories: [],
    categoriesLoading: true,
    mainBranch: null,
    fetched: false,
    loading: false,

    fetchHomepageData: async () => {
        if (get().fetched || get().loading) return;

        set({ loading: true });

        // Run all fetches in parallel
        const [homepageData, featuredProducts, featuredCategories, mainBranch] =
            await Promise.allSettled([
                cmsService.getHomepageData(),
                productService.getFeatured(),
                productService.getFeaturedCategories(),
                branchLocationService.getFeatured(),
            ]);

        // ── /public/home → banners ─────────────────────────────────────────────
        let promoSlides: CmsBanner[] = [];
        let sideBanners: CmsBanner[] = [];

        if (homepageData.status === 'fulfilled' && homepageData.value) {
            const data = homepageData.value;
            promoSlides = data.promo_sliders ?? [];
            sideBanners = data.side_banners ?? [];
        } else {
            // Fallback: fetch banners individually (rare path)
            try {
                const [sliders, banners] = await Promise.all([
                    cmsService.getBanners('homepage_slider'),
                    cmsService.getBanners('homepage_banner'),
                ]);
                promoSlides = sliders;
                sideBanners = banners;
            } catch { /* ignore */ }
        }

        set({
            homepageData: homepageData.status === 'fulfilled' ? homepageData.value : null,
            promoSlides,
            sideBanners,
            featuredProducts: featuredProducts.status === 'fulfilled' ? featuredProducts.value : [],
            productsLoading: false,
            featuredCategories: featuredCategories.status === 'fulfilled' ? featuredCategories.value : [],
            categoriesLoading: false,
            mainBranch: mainBranch.status === 'fulfilled' ? mainBranch.value : null,
            fetched: true,
            loading: false,
        });
    },
}));
