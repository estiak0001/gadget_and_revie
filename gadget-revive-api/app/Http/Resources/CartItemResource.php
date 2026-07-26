<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class CartItemResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'cart_id' => $this->cart_id,
            'item_type' => $this->item_type,
            'product_id' => $this->product_id,
            'service_id' => $this->service_id,
            'quantity' => $this->quantity,
            'unit_price' => (float) $this->unit_price,
            'total_price' => $this->getTotalPrice(),
            'notes' => $this->notes,
            'is_saved_for_later' => $this->is_saved_for_later,
            'product' => $this->when($this->item_type === 'product', new ProductResource($this->product)),
            'service' => $this->when($this->item_type === 'service', new ServiceResource($this->service)),
            'created_at' => $this->created_at,
            'updated_at' => $this->updated_at,
        ];
    }
}
