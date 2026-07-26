<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class TicketMessageResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'ticket_id' => $this->ticket_id,
            'user_id' => $this->user_id,
            'message' => $this->message,
            'attachments' => $this->attachments ? collect($this->attachments)->map(fn($att) => asset('storage/' . $att)) : [],
            'is_internal_note' => $this->is_internal_note,
            'user' => new UserResource($this->whenLoaded('user')),
            'sender' => $this->whenLoaded('user', function () {
                return [
                    'id' => $this->user->id,
                    'name' => $this->user->name,
                    'role' => $this->user->role,
                ];
            }),
            'created_at' => $this->created_at,
        ];
    }
}
