<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class PaymentNoticeResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'order_id' => $this->order_id,
            'vendor_profile_id' => $this->vendor_profile_id,
            'method' => $this->method,
            'instructions_shown' => $this->instructions_shown,
            'transaction_reference' => $this->transaction_reference,
            'payment_proof_image' => $this->payment_proof_image ? asset('storage/' . $this->payment_proof_image) : null,
            'amount' => (float) $this->amount,
            'status' => $this->status,
            'marked_by' => new UserResource($this->whenLoaded('markedByUser')),
            'marked_at' => $this->marked_at,
            'notes' => $this->notes,
            'created_at' => $this->created_at,
            'updated_at' => $this->updated_at,
        ];
    }
}
