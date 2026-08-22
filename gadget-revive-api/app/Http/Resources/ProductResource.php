<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ProductResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'vendor_profile_id' => $this->vendor_profile_id,
            'category_id' => $this->category_id,
            'sku' => $this->sku,
            'name' => $this->name,
            'name_bn' => $this->name_bn,
            'slug' => $this->slug,
            'description' => $this->description,
            'short_description' => $this->short_description,
            'price' => (float) $this->price,
            'discount_price' => $this->discount_price ? (float) $this->discount_price : null,
            'current_price' => $this->getCurrentPrice(),
            'has_discount' => $this->hasDiscount(),
            'stock_qty' => $this->stock_qty,
            'low_stock_threshold' => $this->low_stock_threshold,
            'always_in_stock' => $this->always_in_stock,
            'current_cost' => $this->current_cost !== null ? (float) $this->current_cost : null,
            'is_in_stock' => $this->isInStock(),
            'is_low_stock' => $this->isLowStock(),
            'unit' => $this->unit,
            'image' => $this->image ? asset('storage/' . $this->image) : null,
            'gallery' => $this->gallery ? collect($this->gallery)->map(fn($img) => asset('storage/' . $img)) : [],
            'specifications' => $this->specifications,
            'brand_id' => $this->brand_id,
            // `products.brand` is a real (deprecated, legacy free-text) column that happens to
            // share its name with the brand() relationship below. Eloquent's magic property
            // access always resolves a real column over a same-named relation — and
            // whenLoaded() reads through exactly that magic property — so `$this->brand` here
            // is genuinely the old string column, never the related ProductBrand, and
            // whenLoaded('brand', ...) (with or without a closure) silently returns null even
            // when the relation was eager-loaded correctly. Read via getRelation() instead,
            // gated on relationLoaded(), to actually get the loaded brand.
            'brand' => $this->brand,
            'brand_name' => $this->when($this->relationLoaded('brand'), fn () => $this->getRelation('brand')?->name),
            'brand_details' => $this->when($this->relationLoaded('brand'), fn () => $this->getRelation('brand') ? new ProductBrandResource($this->getRelation('brand')) : null),
            'model' => $this->model,
            'warranty_value' => $this->warranty_value,
            'warranty_unit' => $this->warranty_unit,
            'warranty_note' => $this->warranty,
            'is_active' => $this->is_active,
            'is_draft' => $this->is_draft,
            'is_featured' => $this->is_featured,
            'sort_order' => $this->sort_order,
            'category' => new ProductCategoryResource($this->whenLoaded('category')),
            'vendor' => new VendorProfileResource($this->whenLoaded('vendorProfile')),
            'created_by' => $this->created_by,
            'creator' => $this->whenLoaded('creator', fn () => $this->creator ? ['id' => $this->creator->id, 'name' => $this->creator->name] : null),
            'attribute_values' => $this->whenLoaded('attributeValues', function () {
                return $this->attributeValues->map(function ($pav) {
                    return [
                        'id' => $pav->id,
                        'attribute_id' => $pav->attribute_id,
                        'attribute_value_id' => $pav->attribute_value_id,
                        'text_value' => $pav->text_value,
                        'attribute' => $pav->relationLoaded('attribute') && $pav->attribute ? [
                            'id' => $pav->attribute->id,
                            'name' => $pav->attribute->name,
                            'name_bn' => $pav->attribute->name_bn,
                            'slug' => $pav->attribute->slug,
                            'unit' => $pav->attribute->unit,
                            'input_type' => $pav->attribute->input_type,
                        ] : null,
                        'value' => $pav->relationLoaded('attributeValue') && $pav->attributeValue ? [
                            'id' => $pav->attributeValue->id,
                            'value' => $pav->attributeValue->value,
                            'value_bn' => $pav->attributeValue->value_bn,
                            'slug' => $pav->attributeValue->slug,
                        ] : null,
                    ];
                });
            }),
            'serials' => $this->whenLoaded('serials', fn () => $this->serials->map(fn ($s) => [
                'id' => $s->id,
                'serial_number' => $s->serial_number,
                'status' => $s->status,
                'created_at' => $s->created_at,
            ])),
            'created_at' => $this->created_at,
            'updated_at' => $this->updated_at,
        ];
    }
}
