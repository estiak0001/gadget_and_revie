<?php

namespace App\Http\Controllers\Api;

use App\Http\Resources\TicketResource;
use App\Http\Resources\TicketMessageResource;
use App\Models\AuditLog;
use App\Models\Notification;
use App\Models\Ticket;
use App\Models\TicketMessage;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class TicketController extends BaseController
{
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        $query = Ticket::with(['vendorProfile', 'order', 'user'])
            ->withCount('messages');

        // For customers, show their tickets
        if ($user->isCustomer()) {
            $query->where('user_id', $user->id);
        }

        // Filter by status
        if ($request->has('status')) {
            $query->where('status', $request->status);
        }

        // Filter by priority
        if ($request->has('priority')) {
            $query->where('priority', $request->priority);
        }

        $tickets = $query->latest()->paginate($request->get('per_page', 15));

        return $this->paginated($tickets);
    }

    public function show(Request $request, int $id): JsonResponse
    {
        $user = $request->user();
        $query = Ticket::with([
            'vendorProfile',
            'order',
            'user',
            'messages' => function ($q) use ($user) {
                // Hide internal notes from non-admin/vendor users
                if ($user->isCustomer()) {
                    $q->public();
                }
                $q->with('user')->orderBy('created_at', 'asc');
            },
        ]);

        // For customers, only show their own tickets
        if ($user->isCustomer()) {
            $query->where('user_id', $user->id);
        }

        $ticket = $query->findOrFail($id);

        return $this->success(new TicketResource($ticket));
    }

    public function store(Request $request): JsonResponse
    {
        $request->validate([
            'subject' => 'required|string|max:255',
            'message' => 'required|string',
            'order_id' => 'nullable|exists:orders,id',
            'priority' => 'nullable|in:low,medium,high,urgent',
            'attachments' => 'nullable|array',
            'attachments.*' => 'file|max:5120',
        ]);

        $user = $request->user();
        $vendorProfileId = null;

        // If order is provided, get vendor from order
        if ($request->order_id) {
            $order = \App\Models\Order::where('customer_id', $user->id)
                ->findOrFail($request->order_id);
            $vendorProfileId = $order->vendor_profile_id;
        }

        // Create ticket
        $ticket = Ticket::create([
            'user_id' => $user->id,
            'vendor_profile_id' => $vendorProfileId,
            'order_id' => $request->order_id,
            'subject' => $request->subject,
            'priority' => $request->priority ?? 'medium',
            'status' => 'open',
            'assigned_to' => $vendorProfileId ? 'vendor' : 'admin',
        ]);

        // Handle attachments
        $attachments = [];
        if ($request->hasFile('attachments')) {
            foreach ($request->file('attachments') as $file) {
                $attachments[] = $file->store('ticket-attachments', 'public');
            }
        }

        // Create initial message
        TicketMessage::create([
            'ticket_id' => $ticket->id,
            'user_id' => $user->id,
            'message' => $request->message,
            'attachments' => !empty($attachments) ? $attachments : null,
        ]);

        // Log audit
        AuditLog::log($user, 'create_ticket', 'Ticket', $ticket->id, null, [
            'subject' => $ticket->subject,
        ], 'Support ticket created');

        // Notify vendor or admin
        if ($vendorProfileId && $ticket->vendorProfile?->user) {
            Notification::notify(
                $ticket->vendorProfile->user,
                'new_ticket',
                'New Support Ticket',
                "New support ticket: {$ticket->subject}",
                ['ticket_id' => $ticket->id],
                "/vendor/tickets/{$ticket->id}"
            );
        }

        $ticket->load(['vendorProfile', 'messages.user']);

        return $this->created(new TicketResource($ticket), 'Ticket created successfully');
    }

    public function addMessage(Request $request, int $id): JsonResponse
    {
        $request->validate([
            'message' => 'required|string',
            'attachments' => 'nullable|array',
            'attachments.*' => 'file|max:5120',
        ]);

        $user = $request->user();
        $query = Ticket::query();

        // For customers, only allow replying to their own tickets
        if ($user->isCustomer()) {
            $query->where('user_id', $user->id);
        }

        $ticket = $query->findOrFail($id);

        // Check if ticket is closed
        if ($ticket->isClosed()) {
            return $this->error('Cannot add message to a closed ticket', 400);
        }

        // Handle attachments
        $attachments = [];
        if ($request->hasFile('attachments')) {
            foreach ($request->file('attachments') as $file) {
                $attachments[] = $file->store('ticket-attachments', 'public');
            }
        }

        // Create message
        $message = TicketMessage::create([
            'ticket_id' => $ticket->id,
            'user_id' => $user->id,
            'message' => $request->message,
            'attachments' => !empty($attachments) ? $attachments : null,
        ]);

        // Update ticket status
        if ($user->isCustomer()) {
            $ticket->update(['status' => 'waiting_vendor']);
        } else {
            $ticket->update(['status' => 'waiting_customer']);
        }

        // Notify appropriate party
        if ($user->isCustomer()) {
            // Notify vendor
            if ($ticket->vendorProfile?->user) {
                Notification::notify(
                    $ticket->vendorProfile->user,
                    'ticket_reply',
                    'New Ticket Reply',
                    "Customer replied to ticket #{$ticket->ticket_number}",
                    ['ticket_id' => $ticket->id],
                    "/vendor/tickets/{$ticket->id}"
                );
            }
        } else {
            // Notify customer
            Notification::notify(
                $ticket->user,
                'ticket_reply',
                'New Ticket Reply',
                "New reply on your ticket #{$ticket->ticket_number}",
                ['ticket_id' => $ticket->id],
                "/tickets/{$ticket->id}"
            );
        }

        $ticket->load(['vendorProfile', 'order', 'user', 'messages.user']);

        return $this->success(new TicketResource($ticket), 'Message added');
    }

    public function close(Request $request, int $id): JsonResponse
    {
        $user = $request->user();
        $query = Ticket::query();

        if ($user->isCustomer()) {
            $query->where('user_id', $user->id);
        }

        $ticket = $query->findOrFail($id);

        if ($ticket->isClosed()) {
            return $this->error('Ticket is already closed', 400);
        }

        $ticket->close();

        AuditLog::log($user, 'close_ticket', 'Ticket', $ticket->id, null, null, 'Ticket closed');

        return $this->success(new TicketResource($ticket->fresh()), 'Ticket closed');
    }
}
