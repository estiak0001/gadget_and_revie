<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class VendorProfileResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'user_id' => $this->user_id,
            'business_name' => $this->business_name,
            'slug' => $this->slug,
            'owner_name' => $this->owner_name,
            'description' => $this->description,
            'logo' => $this->logo ? asset('storage/' . $this->logo) : null,
            'banner' => $this->banner ? asset('storage/' . $this->banner) : null,
            'address' => $this->address,
            'google_maps_link' => $this->google_maps_link,
            'division' => $this->whenLoaded('division', fn() => new DivisionResource($this->division)),
            'district' => $this->whenLoaded('district', fn() => new DistrictResource($this->district)),
            'area' => $this->whenLoaded('area', fn() => new AreaResource($this->area)),
            'division_id' => $this->division_id,
            'district_id' => $this->district_id,
            'area_id' => $this->area_id,
            'bkash_number' => $this->when($this->shouldShowPaymentDetails($request), $this->bkash_number),
            'nagad_number' => $this->when($this->shouldShowPaymentDetails($request), $this->nagad_number),
            'bank_account_name' => $this->when($this->shouldShowPaymentDetails($request), $this->bank_account_name),
            'bank_name' => $this->when($this->shouldShowPaymentDetails($request), $this->bank_name),
            'bank_account_number' => $this->when($this->shouldShowPaymentDetails($request), $this->bank_account_number),
            'bank_branch' => $this->when($this->shouldShowPaymentDetails($request), $this->bank_branch),
            'payment_instructions' => $this->when($this->shouldShowPaymentDetails($request), $this->payment_instructions),
            'status' => $this->status,
            'rating' => (float) $this->rating,
            'total_reviews' => $this->total_reviews,
            'total_orders' => $this->total_orders,
            'is_featured' => $this->is_featured,
            'is_verified' => $this->is_verified,
            'approved_at' => $this->approved_at,
            'service_categories' => ServiceCategoryResource::collection($this->whenLoaded('serviceCategories')),
            'services' => ServiceResource::collection($this->whenLoaded('services')),
            'products' => ProductResource::collection($this->whenLoaded('products')),
            'reviews' => ReviewResource::collection($this->whenLoaded('reviews')),
            'created_at' => $this->created_at,
        ];
    }

    protected function shouldShowPaymentDetails(Request $request): bool
    {
        $user = $request->user();
        
        if (!$user) {
            return false;
        }

        // Admin can see all payment details
        if ($user->isAdmin()) {
            return true;
        }

        // Vendor can see their own payment details
        if ($user->isVendor() && $user->id === $this->user_id) {
            return true;
        }

        return false;
    }
}
