<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class TicketResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'ticket_number' => $this->ticket_number,
            'user_id' => $this->user_id,
            'vendor_profile_id' => $this->vendor_profile_id,
            'order_id' => $this->order_id,
            'subject' => $this->subject,
            'priority' => $this->priority,
            'status' => $this->status,
            'assigned_to' => $this->assigned_to,
            'assigned_user_id' => $this->assigned_user_id,
            'user' => new UserResource($this->whenLoaded('user')),
            'vendor' => new VendorProfileResource($this->whenLoaded('vendorProfile')),
            'order' => new OrderResource($this->whenLoaded('order')),
            'assigned_user' => new UserResource($this->whenLoaded('assignedUser')),
            'messages' => TicketMessageResource::collection($this->whenLoaded('messages')),
            'messages_count' => $this->when(isset($this->messages_count), $this->messages_count),
            'resolved_at' => $this->resolved_at,
            'closed_at' => $this->closed_at,
            'created_at' => $this->created_at,
            'updated_at' => $this->updated_at,
        ];
    }
}
