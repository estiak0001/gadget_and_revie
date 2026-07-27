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
            'average_cost' => $this->average_cost !== null ? (float) $this->average_cost : null,
            'is_in_stock' => $this->isInStock(),
            'is_low_stock' => $this->isLowStock(),
            'unit' => $this->unit,
            'image' => $this->image ? asset('storage/' . $this->image) : null,
            'gallery' => $this->gallery ? collect($this->gallery)->map(fn($img) => asset('storage/' . $img)) : [],
            'specifications' => $this->specifications,
            'brand_id' => $this->brand_id,
            'brand' => $this->brand, // Old brand field (deprecated)
            'brand_name' => $this->whenLoaded('brand', fn() => $this->brand->name),
            'brand_details' => new ProductBrandResource($this->whenLoaded('brand')),
            'model' => $this->model,
            'warranty' => $this->warranty,
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
            'created_at' => $this->created_at,
            'updated_at' => $this->updated_at,
        ];
    }
}
