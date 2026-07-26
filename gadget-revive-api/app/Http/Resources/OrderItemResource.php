<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class OrderItemResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'order_id' => $this->order_id,
            'item_type' => $this->item_type,
            'product_id' => $this->product_id,
            'service_id' => $this->service_id,
            'item_name' => $this->item_name,
            'item_sku' => $this->item_sku,
            'quantity' => $this->quantity,
            'unit_price' => (float) $this->unit_price,
            'total_price' => (float) $this->total_price,
            'notes' => $this->notes,
            'total_cost' => $this->total_cost,
            'margin' => $this->margin,
            'costs' => $this->whenLoaded('costs', fn () => $this->costs->map(fn ($cost) => [
                'id' => $cost->id,
                'title' => $cost->title,
                'amount' => (float) $cost->amount,
                'expense_date' => $cost->expense_date->toDateString(),
                'description' => $cost->description,
                'is_reversed' => $cost->is_reversed,
            ])),
            'product' => $this->when($this->item_type === 'product', new ProductResource($this->product)),
            'service' => $this->when($this->item_type === 'service', new ServiceResource($this->service)),
        ];
    }
}
