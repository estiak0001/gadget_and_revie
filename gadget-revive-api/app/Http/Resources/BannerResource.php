<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class BannerResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'title' => $this->title,
            'title_bn' => $this->title_bn,
            'subtitle' => $this->subtitle,
            'subtitle_bn' => $this->subtitle_bn,
            'image' => $this->image ? asset('storage/' . $this->image) : null,
            'mobile_image' => $this->mobile_image ? asset('storage/' . $this->mobile_image) : null,
            'link_url' => $this->link_url,
            'link_text' => $this->link_text,
            'position' => $this->position,
            'sort_order' => $this->sort_order,
            'is_active' => $this->is_active,
            'start_date' => $this->start_date,
            'end_date' => $this->end_date,
            'meta' => $this->meta,
            'is_currently_active' => $this->isCurrentlyActive(),
            'created_at' => $this->created_at,
            'updated_at' => $this->updated_at,
        ];
    }
}
