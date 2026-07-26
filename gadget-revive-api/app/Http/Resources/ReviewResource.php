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
            'customer_id' => $this->customer_id,
            'vendor_profile_id' => $this->vendor_profile_id,
            'rating' => $this->rating,
            'review' => $this->review,
            'vendor_response' => $this->vendor_response,
            'vendor_responded_at' => $this->vendor_responded_at,
            'is_approved' => $this->is_approved,
            'is_visible' => $this->is_visible,
            'customer' => new UserResource($this->whenLoaded('customer')),
            'vendor' => new VendorProfileResource($this->whenLoaded('vendorProfile')),
            'order' => new OrderResource($this->whenLoaded('order')),
            'created_at' => $this->created_at,
            'updated_at' => $this->updated_at,
        ];
    }
}
