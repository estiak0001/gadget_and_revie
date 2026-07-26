<?php

namespace App\Http\Controllers\Api;

use App\Mail\InvoiceMail;
use App\Models\Order;
use App\Traits\ResolvesBrandingSettings;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Mail;

class InvoiceController extends BaseController
{
    use ResolvesBrandingSettings;

    /**
     * Download invoice PDF for a specific order.
     * Accessible by: admin (any order), customer (own orders only).
     */
    public function download(Request $request, int $id): Response|JsonResponse
    {
        $user = $request->user();

        $order = $this->resolveOrder($user, $id);

        if (!$order) {
            return $this->error('Order not found or access denied.', 404);
        }

        if (!$order->invoiceAvailable()) {
            return $this->error('Invoice is not available yet. The price for this service order has not been confirmed.', 422);
        }

        $pdf = $this->generatePdf($order);

        $filename = "Invoice-{$order->order_number}.pdf";

        return $pdf->download($filename);
    }

    /**
     * Stream (view in browser) the invoice PDF.
     * Accessible by: admin (any order), customer (own orders only).
     */
    public function stream(Request $request, int $id): Response|JsonResponse
    {
        $user = $request->user();

        $order = $this->resolveOrder($user, $id);

        if (!$order) {
            return $this->error('Order not found or access denied.', 404);
        }

        if (!$order->invoiceAvailable()) {
            return $this->error('Invoice is not available yet. The price for this service order has not been confirmed.', 422);
        }

        $pdf = $this->generatePdf($order);

        return $pdf->stream("Invoice-{$order->order_number}.pdf");
    }

    /**
     * Send the invoice to the customer's email.
     * Accessible by: admin (any order), customer (own orders only).
     */
    public function sendEmail(Request $request, int $id): JsonResponse
    {
        $user = $request->user();

        $order = $this->resolveOrder($user, $id);

        if (!$order) {
            return $this->error('Order not found or access denied.', 404);
        }

        if (!$order->invoiceAvailable()) {
            return $this->error('Invoice is not available yet. The price for this service order has not been confirmed.', 422);
        }

        // Determine recipient email (admin can override, otherwise use order/customer email)
        $recipientEmail = $order->customer_email
            ?? $order->customer?->email;

        // Admin may specify a custom recipient email
        if ($user->isAdmin() && $request->filled('email')) {
            $recipientEmail = $request->email;
        }

        if (!$recipientEmail) {
            return $this->error('No email address found for this order.', 422);
        }

        $pdf = $this->generatePdf($order);
        $pdfContent = $pdf->output();

        Mail::to($recipientEmail)->send(new InvoiceMail($order, $pdfContent));

        return $this->success([
            'sent_to' => $recipientEmail,
            'order_number' => $order->order_number,
        ], 'Invoice sent to ' . $recipientEmail . ' successfully.');
    }

    /**
     * Guest invoice access by order number (for tracking page).
     */
    public function guestDownload(Request $request): Response|JsonResponse
    {
        $request->validate([
            'order_number' => 'required|string',
        ]);

        $order = Order::where('order_number', $request->order_number)
            ->with(['items.product', 'items.service', 'division', 'district', 'area', 'customer'])
            ->first();

        if (!$order) {
            return $this->error('Order not found.', 404);
        }

        // For guest (or guest-style, auto-linked) orders, allow access. For real registered
        // customer orders, require login instead.
        if (!$order->allowsGuestStyleAccess()) {
            return $this->error('Access denied. Please log in to download your invoice.', 403);
        }

        if (!$order->invoiceAvailable()) {
            return $this->error('Invoice is not available yet. The price for this service order has not been confirmed.', 422);
        }

        $pdf = $this->generatePdf($order);

        return $pdf->download("Invoice-{$order->order_number}.pdf");
    }

    // ─── Helpers ──────────────────────────────────────

    private function resolveOrder($user, int $id): ?Order
    {
        $query = Order::with([
            'items.product',
            'items.service',
            'customer',
            'division',
            'district',
            'area',
            'vendorProfile',
        ]);

        if ($user->isAdmin()) {
            return $query->find($id);
        }

        // Any authenticated user can download invoices for their own orders
        return $query->where('customer_id', $user->id)->find($id);
    }

    private function generatePdf(Order $order): \Barryvdh\DomPDF\PDF
    {
        // DomPDF can be memory-hungry — bump the limit for this request
        ini_set('memory_limit', '256M');

        // Ensure relations are loaded
        $order->loadMissing([
            'items.product',
            'items.service',
            'customer',
            'division',
            'district',
            'area',
        ]);

        $pdf = Pdf::loadView('invoices.order', [
            'order'    => $order,
            'settings' => $this->brandingSettings(),
        ]);

        $pdf->setPaper('A4', 'portrait');
        $pdf->setOptions([
            'dpi'                  => 150,
            'defaultFont'          => 'DejaVu Sans',
            'isRemoteEnabled'      => false,
            'isHtml5ParserEnabled' => true,
            'enable_php'           => false,
        ]);

        return $pdf;
    }
}
