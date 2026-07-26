<?php

namespace App\Http\Controllers\Api;

use App\Models\ContactInquiry;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ContactInquiryController extends BaseController
{
    /**
     * Store a new contact inquiry (public).
     */
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'first_name' => 'required|string|max:100',
            'last_name'  => 'required|string|max:100',
            'email'      => 'required|email|max:255',
            'phone'      => 'nullable|string|max:30',
            'subject'    => 'required|string|max:255',
            'message'    => 'required|string|max:5000',
        ]);

        $inquiry = ContactInquiry::create([
            ...$validated,
            'ip_address' => $request->ip(),
        ]);

        return $this->success($inquiry, 'Your message has been received. We will get back to you soon.', 201);
    }

    /**
     * List inquiries (admin).
     */
    public function adminIndex(Request $request): JsonResponse
    {
        $query = ContactInquiry::latest();

        if ($request->filled('search')) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('first_name', 'like', "%{$search}%")
                  ->orWhere('last_name', 'like', "%{$search}%")
                  ->orWhere('email', 'like', "%{$search}%")
                  ->orWhere('subject', 'like', "%{$search}%");
            });
        }

        if ($request->filled('status')) {
            $query->where('status', $request->status);
        }

        $inquiries = $query->paginate($request->get('per_page', 20));

        return $this->success($inquiries);
    }

    /**
     * Show a single inquiry (admin).
     */
    public function adminShow(int $id): JsonResponse
    {
        $inquiry = ContactInquiry::findOrFail($id);

        // Auto-mark as read when first viewed
        if ($inquiry->status === 'new') {
            $inquiry->update(['status' => 'read']);
        }

        return $this->success($inquiry);
    }

    /**
     * Update status / notes (admin).
     */
    public function adminUpdate(Request $request, int $id): JsonResponse
    {
        $inquiry = ContactInquiry::findOrFail($id);

        $validated = $request->validate([
            'status'      => 'sometimes|in:new,read,in_progress,resolved,closed',
            'admin_notes' => 'sometimes|nullable|string|max:5000',
        ]);

        $inquiry->update($validated);

        return $this->success($inquiry, 'Inquiry updated.');
    }

    /**
     * Delete an inquiry (admin).
     */
    public function adminDelete(int $id): JsonResponse
    {
        ContactInquiry::findOrFail($id)->delete();

        return $this->success(null, 'Inquiry deleted.');
    }
}
