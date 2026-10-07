<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ScrapedProductResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'batch' => $this->batch,
            'source_site' => $this->source_site,
            'source_url' => $this->source_url,
            'source_product_id' => $this->source_product_id,
            'category_raw' => $this->category_raw,
            'category_id' => $this->category_id,
            'category' => new ProductCategoryResource($this->whenLoaded('category')),
            'brand_raw' => $this->brand_raw,
            'brand_id' => $this->brand_id,
            'brand' => new ProductBrandResource($this->whenLoaded('brand')),
            'sku' => $this->sku,
            'name' => $this->name,
            'name_bn' => $this->name_bn,
            'price' => $this->price !== null ? (float) $this->price : null,
            'discount_price' => $this->discount_price !== null ? (float) $this->discount_price : null,
            'stock_qty' => $this->stock_qty,
            'stock_status_raw' => $this->stock_status_raw,
            'current_cost' => $this->current_cost !== null ? (float) $this->current_cost : null,
            'unit' => $this->unit,
            'short_description' => $this->short_description,
            'description' => $this->description,
            'specifications' => $this->specifications,
            'image' => $this->image ? asset('storage/' . $this->image) : null,
            'gallery' => $this->gallery ? collect($this->gallery)->map(fn ($img) => asset('storage/' . $img)) : [],
            'model' => $this->model,
            'warranty_value' => $this->warranty_value,
            'warranty_unit' => $this->warranty_unit,
            'status' => $this->status,
            // What ingest() actually did the last time a (re-)scrape touched this row --
            // created|updated|reactivated|synced_to_product. Null for a row that predates this
            // column. See ScrapedProductController::syncStrongMatch().
            'last_ingest_action' => $this->last_ingest_action,
            'last_ingested_at' => $this->last_ingested_at,
            'can_promote' => $this->canPromote(),
            'promoted_product_id' => $this->promoted_product_id,
            'reject_reason' => $this->reject_reason,
            'reviewed_by' => $this->reviewed_by,
            'reviewer' => $this->whenLoaded('reviewer', fn () => $this->reviewer ? ['id' => $this->reviewer->id, 'name' => $this->reviewer->name] : null),
            'reviewed_at' => $this->reviewed_at,
            'created_at' => $this->created_at,
            'updated_at' => $this->updated_at,
        ];
    }
}
