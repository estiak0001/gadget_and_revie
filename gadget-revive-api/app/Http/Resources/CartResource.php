<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class CartResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'user_id' => $this->user_id,
            'vendor_profile_id' => $this->vendor_profile_id,
            'vendor' => new VendorProfileResource($this->whenLoaded('vendorProfile')),
            'items' => CartItemResource::collection($this->whenLoaded('activeItems')),
            'saved_items' => CartItemResource::collection($this->whenLoaded('savedItems')),
            'subtotal' => $this->getSubtotal(),
            'total_items' => $this->getTotalItems(),
            'created_at' => $this->created_at,
            'updated_at' => $this->updated_at,
        ];
    }
}
