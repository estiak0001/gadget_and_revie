<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class InventoryLogResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'product_id' => $this->product_id,
            'vendor_profile_id' => $this->vendor_profile_id,
            'type' => $this->type,
            'quantity_before' => $this->quantity_before,
            'quantity_change' => $this->quantity_change,
            'quantity_after' => $this->quantity_after,
            'order_id' => $this->order_id,
            'reason' => $this->reason,
            'product' => new ProductResource($this->whenLoaded('product')),
            'order' => new OrderResource($this->whenLoaded('order')),
            'created_by' => new UserResource($this->whenLoaded('createdBy')),
            'created_at' => $this->created_at,
        ];
    }
}
