<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class BranchLocationResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id'            => $this->id,
            'name'          => $this->name,
            'type'          => $this->type,
            'address'       => $this->address,
            'phone'         => $this->phone,
            'email'         => $this->email,
            'hours'         => $this->hours,
            'services'      => $this->services ?? [],
            'map_url'       => $this->map_url,
            'map_embed_url' => $this->map_embed_url,
            'latitude'      => $this->latitude,
            'longitude'     => $this->longitude,
            'is_featured'   => $this->is_featured,
            'is_active'     => $this->is_active,
            'sort_order'    => $this->sort_order,
            'created_at'    => $this->created_at,
            'updated_at'    => $this->updated_at,
        ];
    }
}
