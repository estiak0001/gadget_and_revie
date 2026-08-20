<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ServiceCategoryResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'name_bn' => $this->name_bn,
            'slug' => $this->slug,
            'description' => $this->description,
            'icon' => $this->icon,
            'image' => $this->image ? asset('storage/' . $this->image) : null,
            'parent_id' => $this->parent_id,
            'sort_order' => $this->sort_order,
            'is_active' => $this->is_active,
            'is_featured' => $this->is_featured,
            'parent' => new ServiceCategoryResource($this->whenLoaded('parent')),
            'children' => ServiceCategoryResource::collection($this->whenLoaded('children')),
            'services_count' => $this->when(isset($this->services_count), $this->services_count),
            // Lowest active price across this category's whole subtree (see
            // CategoryController::serviceCategory()) — powers the "Starting from ৳X" hero badge.
            'starting_price' => $this->when(isset($this->starting_price), $this->starting_price),
            // Up to 3 real services (cheapest/middle/priciest) relabeled Basic/Minor/Major —
            // see CategoryController::serviceCategory().
            'tier_services' => $this->when(isset($this->tier_services), $this->tier_services),
            'breadcrumb' => $this->getBreadcrumb(),
            'path' => $this->path,
        ];
    }
}
