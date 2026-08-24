<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ReviewResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'order_id' => $this->order_id,
            'product_id' => $this->product_id,
            'user_id' => $this->user_id,
            'vendor_profile_id' => $this->vendor_profile_id,
            'rating' => $this->rating,
            'review' => $this->review,
            'images' => $this->images ? collect($this->images)->map(fn ($p) => asset('storage/' . $p)) : [],
            'vendor_response' => $this->vendor_response,
            'vendor_responded_at' => $this->vendor_responded_at,
            'status' => $this->status,
            'helpful_count' => $this->helpful_count,
            'user' => new UserResource($this->whenLoaded('user')),
            'product' => new ProductResource($this->whenLoaded('product')),
            'vendor' => new VendorProfileResource($this->whenLoaded('vendorProfile')),
            'order' => new OrderResource($this->whenLoaded('order')),
            'created_at' => $this->created_at,
            'updated_at' => $this->updated_at,
        ];
    }
}
