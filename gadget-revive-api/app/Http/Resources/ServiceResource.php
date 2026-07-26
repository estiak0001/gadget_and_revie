<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ServiceResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'vendor_profile_id' => $this->vendor_profile_id,
            'category_id' => $this->category_id,
            'name' => $this->name,
            'name_bn' => $this->name_bn,
            'code' => $this->code,
            'slug' => $this->slug,
            'description' => $this->description,
            'short_description' => $this->short_description,
            'base_price' => (float) $this->base_price,
            'discount_price' => $this->discount_price ? (float) $this->discount_price : null,
            'current_price' => $this->getCurrentPrice(),
            'has_discount' => $this->hasDiscount(),
            'duration_estimate' => $this->duration_estimate,
            'image' => $this->image ? asset('storage/' . $this->image) : null,
            'gallery' => $this->gallery ? collect($this->gallery)->map(fn($img) => asset('storage/' . $img)) : [],
            'features' => $this->features ?? [],
            'is_active' => $this->is_active,
            'is_featured' => $this->is_featured,
            'sort_order' => $this->sort_order,
            'category' => new ServiceCategoryResource($this->whenLoaded('category')),
            'vendor' => new VendorProfileResource($this->whenLoaded('vendorProfile')),
            'created_by' => $this->created_by,
            'creator' => $this->whenLoaded('creator', fn () => $this->creator ? ['id' => $this->creator->id, 'name' => $this->creator->name] : null),
            'created_at' => $this->created_at,
            'updated_at' => $this->updated_at,
        ];
    }
}
