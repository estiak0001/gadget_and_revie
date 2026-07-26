<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class DistrictResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'division_id' => $this->division_id,
            'name' => $this->name,
            'name_bn' => $this->name_bn,
            'is_active' => $this->is_active,
            'division' => new DivisionResource($this->whenLoaded('division')),
            'areas' => AreaResource::collection($this->whenLoaded('areas')),
        ];
    }
}
