<?php

namespace App\Http\Controllers\Api;

use App\Http\Resources\VendorProfileResource;
use App\Models\VendorProfile;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class VendorController extends BaseController
{
    public function index(Request $request): JsonResponse
    {
        $query = VendorProfile::active()
            ->with(['division', 'district', 'area', 'serviceCategories']);

        // Filter by location
        if ($request->has('division_id')) {
            $query->where('division_id', $request->division_id);
        }
        if ($request->has('district_id')) {
            $query->where('district_id', $request->district_id);
        }
        if ($request->has('area_id')) {
            $query->where('area_id', $request->area_id);
        }

        // Filter by service category
        if ($request->has('service_category_id')) {
            $query->whereHas('serviceCategories', function ($q) use ($request) {
                $q->where('service_categories.id', $request->service_category_id);
            });
        }

        // Filter by featured
        if ($request->boolean('featured')) {
            $query->featured();
        }

        // Filter by verified
        if ($request->boolean('verified')) {
            $query->verified();
        }

        // Search by name
        if ($request->has('search')) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('business_name', 'like', "%{$search}%")
                    ->orWhere('description', 'like', "%{$search}%");
            });
        }

        // Minimum rating filter
        if ($request->has('min_rating')) {
            $query->where('rating', '>=', $request->min_rating);
        }

        // Sorting
        $sortBy = $request->get('sort_by', 'created_at');
        $sortOrder = $request->get('sort_order', 'desc');

        switch ($sortBy) {
            case 'rating':
                $query->orderBy('rating', $sortOrder);
                break;
            case 'reviews':
                $query->orderBy('total_reviews', $sortOrder);
                break;
            case 'orders':
                $query->orderBy('total_orders', $sortOrder);
                break;
            case 'name':
                $query->orderBy('business_name', $sortOrder);
                break;
            default:
                $query->orderBy('created_at', $sortOrder);
        }

        $perPage = min($request->get('per_page', 15), 50);
        $vendors = $query->paginate($perPage);

        return $this->paginated($vendors);
    }

    public function show(string $slug): JsonResponse
    {
        $vendor = VendorProfile::where('slug', $slug)
            ->active()
            ->with([
                'division',
                'district',
                'area',
                'serviceCategories',
                'services' => function ($query) {
                    $query->active()->orderBy('sort_order');
                },
                'products' => function ($query) {
                    $query->active()->inStock()->orderBy('sort_order');
                },
                'reviews' => function ($query) {
                    $query->approved()->visible()->with('customer')->latest()->limit(10);
                },
            ])
            ->firstOrFail();

        return $this->success(new VendorProfileResource($vendor));
    }

    public function featured(): JsonResponse
    {
        $vendors = VendorProfile::active()
            ->featured()
            ->with(['division', 'district', 'serviceCategories'])
            ->orderBy('rating', 'desc')
            ->limit(10)
            ->get();

        return $this->success(VendorProfileResource::collection($vendors));
    }

    public function services(string $slug): JsonResponse
    {
        $vendor = VendorProfile::where('slug', $slug)->active()->firstOrFail();

        $services = $vendor->services()
            ->active()
            ->with('category')
            ->orderBy('sort_order')
            ->get();

        return $this->success([
            'vendor' => new VendorProfileResource($vendor),
            'services' => \App\Http\Resources\ServiceResource::collection($services),
        ]);
    }

    public function products(string $slug, Request $request): JsonResponse
    {
        $vendor = VendorProfile::where('slug', $slug)->active()->firstOrFail();

        $query = $vendor->products()->active()->with('category');

        if ($request->boolean('in_stock')) {
            $query->inStock();
        }

        if ($request->has('category_id')) {
            $query->where('category_id', $request->category_id);
        }

        $products = $query->orderBy('sort_order')->paginate($request->get('per_page', 15));

        return $this->paginated($products);
    }

    public function reviews(string $slug, Request $request): JsonResponse
    {
        $vendor = VendorProfile::where('slug', $slug)->active()->firstOrFail();

        $query = $vendor->reviews()
            ->approved()
            ->visible()
            ->with('customer');

        // Filter by rating
        if ($request->has('rating')) {
            $query->where('rating', $request->rating);
        }

        $reviews = $query->latest()->paginate($request->get('per_page', 10));

        // Calculate rating summary
        $ratingSummary = [
            'average' => $vendor->rating,
            'total' => $vendor->total_reviews,
            'breakdown' => [
                5 => $vendor->reviews()->approved()->visible()->where('rating', 5)->count(),
                4 => $vendor->reviews()->approved()->visible()->where('rating', 4)->count(),
                3 => $vendor->reviews()->approved()->visible()->where('rating', 3)->count(),
                2 => $vendor->reviews()->approved()->visible()->where('rating', 2)->count(),
                1 => $vendor->reviews()->approved()->visible()->where('rating', 1)->count(),
            ],
        ];

        return $this->success([
            'reviews' => \App\Http\Resources\ReviewResource::collection($reviews->items()),
            'rating_summary' => $ratingSummary,
            'meta' => [
                'current_page' => $reviews->currentPage(),
                'last_page' => $reviews->lastPage(),
                'per_page' => $reviews->perPage(),
                'total' => $reviews->total(),
            ],
        ]);
    }

    public function paymentInfo(string $slug): JsonResponse
    {
        $vendor = VendorProfile::where('slug', $slug)->active()->firstOrFail();

        $paymentMethods = [];

        if ($vendor->bkash_number) {
            $paymentMethods['bkash'] = [
                'available' => true,
                'number' => $vendor->bkash_number,
                'instructions' => $vendor->getPaymentInstructions('bkash'),
            ];
        }

        if ($vendor->nagad_number) {
            $paymentMethods['nagad'] = [
                'available' => true,
                'number' => $vendor->nagad_number,
                'instructions' => $vendor->getPaymentInstructions('nagad'),
            ];
        }

        if ($vendor->bank_account_number) {
            $paymentMethods['bank_transfer'] = [
                'available' => true,
                'bank_name' => $vendor->bank_name,
                'account_name' => $vendor->bank_account_name,
                'account_number' => $vendor->bank_account_number,
                'branch' => $vendor->bank_branch,
                'instructions' => $vendor->getPaymentInstructions('bank_transfer'),
            ];
        }

        $paymentMethods['cash'] = [
            'available' => true,
            'instructions' => 'Pay cash on delivery or at the service location.',
        ];

        return $this->success([
            'vendor_id' => $vendor->id,
            'vendor_name' => $vendor->business_name,
            'payment_methods' => $paymentMethods,
            'general_instructions' => $vendor->payment_instructions,
        ]);
    }
}
