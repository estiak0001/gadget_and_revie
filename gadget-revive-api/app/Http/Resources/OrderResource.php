<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class OrderResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'order_number' => $this->order_number,
            'customer_id' => $this->customer_id,
            'vendor_profile_id' => $this->vendor_profile_id,
            'subtotal' => (float) $this->subtotal,
            'tax' => (float) $this->tax,
            'shipping' => (float) $this->shipping,
            'discount' => (float) $this->discount,
            'total' => (float) $this->total,
            'refund_amount' => $this->refund_amount !== null ? (float) $this->refund_amount : null,
            'paid_amount' => (float) $this->paid_amount,
            'outstanding_receivable' => $this->outstanding_receivable,
            'payment_method' => $this->payment_method,
            'payment_status' => $this->payment_status,
            'order_status' => $this->order_status,
            'is_payment_ledger_synced' => $this->isPaymentLedgerSynced(),
            'customer_notes' => $this->customer_notes,
            'vendor_notes' => $this->when($this->shouldShowVendorNotes($request), $this->vendor_notes),
            'admin_notes' => $this->when($request->user()?->isAdmin(), $this->admin_notes),
            'customer_name' => $this->customer_name,
            'customer_phone' => $this->customer_phone,
            'customer_email' => $this->customer_email,
            'customer_address' => $this->customer_address,
            'division' => new DivisionResource($this->whenLoaded('division')),
            'district' => new DistrictResource($this->whenLoaded('district')),
            'area' => new AreaResource($this->whenLoaded('area')),
            'customer' => new UserResource($this->whenLoaded('customer')),
            'vendor' => new VendorProfileResource($this->whenLoaded('vendorProfile')),
            'created_by' => $this->created_by,
            'creator' => $this->whenLoaded('creator', fn () => $this->creator ? ['id' => $this->creator->id, 'name' => $this->creator->name] : null),
            'items' => OrderItemResource::collection($this->whenLoaded('items')),
            'payment_notices' => PaymentNoticeResource::collection($this->whenLoaded('paymentNotices')),
            'review' => new ReviewResource($this->whenLoaded('review')),
            'service_intake' => $this->whenLoaded('serviceIntake', fn () => $this->serviceIntake ? [
                'id' => $this->serviceIntake->id,
                'receipt_number' => $this->serviceIntake->receipt_number,
                'status' => $this->serviceIntake->status,
                'received_at' => $this->serviceIntake->received_at,
            ] : null),
            'can_be_edited' => $this->canBeEdited(),
            'can_edit_items_and_pricing' => $this->canEditItemsAndPricing(),
            'requires_super_admin_to_amend' => $this->requiresSuperAdminToAmend(),
            'can_be_cancelled' => $this->canBeCancelled(),
            'can_be_reviewed' => $this->canBeReviewed(),
            'receipt_available' => $this->receiptAvailable(),
            'invoice_available' => $this->invoiceAvailable(),
            'is_guest' => is_null($this->customer_id),   // true for guest orders
            'accepted_at' => $this->accepted_at,
            'completed_at' => $this->completed_at,
            'cancelled_at' => $this->cancelled_at,
            'created_at' => $this->created_at,
            'updated_at' => $this->updated_at,
        ];
    }

    protected function shouldShowVendorNotes(Request $request): bool
    {
        $user = $request->user();
        
        if (!$user) {
            return false;
        }

        return $user->isAdmin() || 
               ($user->isVendor() && $user->vendorProfile?->id === $this->vendor_profile_id);
    }
}
