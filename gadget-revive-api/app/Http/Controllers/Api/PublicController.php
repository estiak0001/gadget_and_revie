<?php

namespace App\Http\Controllers\Api;

use App\Http\Resources\BannerResource;
use App\Http\Resources\BranchLocationResource;
use App\Http\Resources\CmsPageResource;
use App\Http\Resources\FaqResource;
use App\Models\Banner;
use App\Models\BranchLocation;
use App\Models\CmsPage;
use App\Models\Faq;
use App\Models\SiteSetting;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PublicController extends BaseController
{
    /**
     * Get published CMS page by slug
     */
    public function cmsPage(string $slug): JsonResponse
    {
        $page = CmsPage::where('slug', $slug)
            ->where('status', 'published')
            ->first();

        if (!$page) {
            return $this->error('Page not found', 404);
        }

        return $this->success(new CmsPageResource($page));
    }

    /**
     * Get active banners by position
     */
    public function banners(Request $request): JsonResponse
    {
        $query = Banner::active();

        if ($request->has('position')) {
            $query->where('position', $request->position);
        }

        $banners = $query->orderBy('sort_order')->get();

        return $this->success(BannerResource::collection($banners));
    }

    /**
     * Get active FAQs grouped by category
     */
    public function faqs(Request $request): JsonResponse
    {
        $query = Faq::where('is_active', true);

        if ($request->has('category')) {
            $query->where('category', $request->category);
        }

        $faqs = $query->orderBy('category')->orderBy('sort_order')->get();

        // Group by category if no specific category requested
        if (!$request->has('category')) {
            $grouped = $faqs->groupBy('category');
            return $this->success($grouped);
        }

        return $this->success(FaqResource::collection($faqs));
    }

    /**
     * Get FAQ categories
     */
    public function faqCategories(): JsonResponse
    {
        $categories = Faq::where('is_active', true)
            ->distinct()
            ->pluck('category');

        return $this->success($categories);
    }

    /**
     * Get site settings (public ones - includes topbar and homepage groups)
     */
    public function settings(): JsonResponse
    {
        $settings = SiteSetting::where('is_public', true)
            ->orWhereIn('group', ['general', 'contact', 'social', 'topbar', 'homepage', 'footer'])
            ->get()
            ->mapWithKeys(function ($setting) {
                return [$setting->key => $setting->getTypedValue()];
            });

        return $this->success($settings);
    }

    /**
     * Get specific setting value
     */
    public function setting(string $key): JsonResponse
    {
        $setting = SiteSetting::where('key', $key)
            ->where(function ($q) {
                $q->where('is_public', true)
                    ->orWhereIn('group', ['general', 'contact', 'social', 'topbar', 'homepage', 'footer']);
            })
            ->first();

        if (!$setting) {
            return $this->error('Setting not found', 404);
        }

        return $this->success(['key' => $setting->key, 'value' => $setting->getTypedValue()]);
    }

    /**
     * Get data recovery page CMS settings
     */
    public function dataRecoveryPage(): JsonResponse
    {
        $settings = SiteSetting::where('group', 'data_recovery')
            ->get()
            ->mapWithKeys(fn ($s) => [$s->key => $s->getTypedValue()]);

        return $this->success($settings);
    }

    /**
     * Get about page CMS settings
     */
    public function aboutPage(): JsonResponse
    {
        $settings = SiteSetting::where('group', 'about')
            ->get()
            ->mapWithKeys(fn ($s) => [$s->key => $s->getTypedValue()]);

        return $this->success($settings);
    }

    /**
     * Get contact page CMS settings
     */
    public function contactPage(): JsonResponse
    {
        $settings = SiteSetting::where('group', 'contact')
            ->get()
            ->mapWithKeys(fn ($s) => [$s->key => $s->getTypedValue()]);

        return $this->success($settings);
    }

    /**
     * Get home page CMS data (banners, settings, featured content)
     */
    public function homePage(): JsonResponse
    {
        // Promo slider banners (main carousel)
        $promoSliders = Banner::active()
            ->where('position', 'homepage_slider')
            ->orderBy('sort_order')
            ->take(6)
            ->get();

        // Side banners
        $sideBanners = Banner::active()
            ->where('position', 'homepage_banner')
            ->orderBy('sort_order')
            ->take(4)
            ->get();

        // Featured service categories
        $serviceCategories = \App\Models\ServiceCategory::where('is_active', true)
            ->orderBy('sort_order')
            ->take(8)
            ->get(['id', 'name', 'slug', 'icon', 'image']);

        // Featured vendors
        $featuredVendors = \App\Models\VendorProfile::where('status', 'approved')
            ->where('is_featured', true)
            ->with(['division', 'district'])
            ->orderByDesc('rating')
            ->take(8)
            ->get();

        // Featured services
        $featuredServices = \App\Models\Service::where('is_active', true)
            ->where('is_featured', true)
            ->with(['category', 'vendorProfile'])
            ->orderByDesc('created_at')
            ->take(8)
            ->get();

        // CMS settings for homepage
        $cmsSettings = SiteSetting::whereIn('group', ['topbar', 'homepage'])
            ->get()
            ->mapWithKeys(function ($setting) {
                return [$setting->key => $setting->getTypedValue()];
            });

        // Statistics
        $stats = [
            'total_vendors' => \App\Models\VendorProfile::where('status', 'approved')->count(),
            'total_services' => \App\Models\Service::where('is_active', true)->count(),
            'total_products' => \App\Models\Product::where('is_active', true)->count(),
            'happy_customers' => \App\Models\User::where('role', 'customer')->count(),
        ];

        // Branch locations: main branch + all active
        $mainBranch = BranchLocation::active()
            ->featured()
            ->orderBy('sort_order')
            ->first();

        $allBranchLocations = BranchLocation::active()
            ->orderBy('is_featured', 'desc')
            ->orderBy('sort_order')
            ->orderBy('name')
            ->get();

        return $this->success([
            'promo_sliders' => BannerResource::collection($promoSliders),
            'side_banners' => BannerResource::collection($sideBanners),
            'service_categories' => $serviceCategories,
            'featured_vendors' => \App\Http\Resources\VendorProfileResource::collection($featuredVendors),
            'featured_services' => \App\Http\Resources\ServiceResource::collection($featuredServices),
            'cms_settings' => $cmsSettings,
            'statistics' => $stats,
            'main_branch' => $mainBranch ? new BranchLocationResource($mainBranch) : null,
            'branch_locations' => BranchLocationResource::collection($allBranchLocations),
        ]);
    }
}
