<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class AreaResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'district_id' => $this->district_id,
            'name' => $this->name,
            'name_bn' => $this->name_bn,
            'is_active' => $this->is_active,
            'district' => new DistrictResource($this->whenLoaded('district')),
        ];
    }
}
