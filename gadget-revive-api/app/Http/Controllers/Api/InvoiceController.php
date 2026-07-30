<?php

namespace App\Http\Controllers\Api;

use App\Mail\InvoiceMail;
use App\Models\CustomInvoice;
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

    // ─── Custom Invoices ──────────────────────────────
    // A document-only feature, deliberately decoupled from the real Order: lets a super_admin
    // hand a customer an invoice with different amounts/details than what actually happened (e.g.
    // for the customer's own reimbursement paperwork), while the real order/stock/ledger stay
    // completely untouched. Every one issued is persisted (never just generated and forgotten) so
    // there's a record of what was given out, when, and by whom.

    /** GET /admin/invoices/{orderId}/custom — history of custom invoices issued for this order. */
    public function customIndex(int $orderId): JsonResponse
    {
        $order = Order::findOrFail($orderId);

        $invoices = CustomInvoice::where('order_id', $order->id)
            ->with('creator:id,name')
            ->latest()
            ->get();

        return $this->success($invoices);
    }

    /** POST /admin/invoices/{orderId}/custom — create a new custom invoice. Super_admin only. */
    public function customStore(Request $request, int $orderId): JsonResponse
    {
        $admin = $request->user();
        if (!$admin->hasRole('super_admin')) {
            return $this->error('Only a super admin can create a custom invoice.', 403);
        }

        $order = Order::with(['items', 'customer', 'division', 'district', 'area'])->findOrFail($orderId);

        $data = $request->validate([
            'invoice_number'   => 'nullable|string|max:100',
            'invoice_date'     => 'nullable|date',
            'customer_name'    => 'nullable|string|max:255',
            'customer_phone'   => 'nullable|string|max:20',
            'customer_email'   => 'nullable|email|max:255',
            'customer_address' => 'nullable|string|max:500',
            'items'                 => 'required|array|min:1',
            'items.*.item_name'     => 'required|string|max:255',
            'items.*.item_sku'      => 'nullable|string|max:100',
            'items.*.notes'         => 'nullable|string|max:500',
            'items.*.quantity'      => 'required|integer|min:1',
            'items.*.unit_price'    => 'required|numeric|min:0',
            'discount' => 'nullable|numeric|min:0',
            'shipping' => 'nullable|numeric|min:0',
            'tax'      => 'nullable|numeric|min:0',
            'notes'    => 'nullable|string|max:1000',
        ]);

        $items = collect($data['items'])->map(fn ($item) => [
            'item_name'   => $item['item_name'],
            'item_sku'    => $item['item_sku'] ?? null,
            'notes'       => $item['notes'] ?? null,
            'quantity'    => (int) $item['quantity'],
            'unit_price'  => (float) $item['unit_price'],
            'total_price' => round($item['quantity'] * $item['unit_price'], 2),
        ])->all();

        $subtotal = round(collect($items)->sum('total_price'), 2);
        $discount = (float) ($data['discount'] ?? 0);
        $shipping = (float) ($data['shipping'] ?? 0);
        $tax      = (float) ($data['tax'] ?? 0);

        $sequence = CustomInvoice::where('order_id', $order->id)->count() + 1;

        $invoice = CustomInvoice::create([
            'order_id'         => $order->id,
            'invoice_number'   => $data['invoice_number'] ?? "{$order->order_number}-A{$sequence}",
            'invoice_date'     => $data['invoice_date'] ?? now()->toDateString(),
            'customer_name'    => $data['customer_name'] ?? ($order->customer_name ?? $order->customer?->name),
            'customer_phone'   => $data['customer_phone'] ?? $order->customer_phone,
            'customer_email'   => $data['customer_email'] ?? ($order->customer_email ?? $order->customer?->email),
            'customer_address' => $data['customer_address'] ?? $order->customer_address,
            'items'            => $items,
            'subtotal'         => $subtotal,
            'discount'         => $discount,
            'shipping'         => $shipping,
            'tax'              => $tax,
            'total'            => round($subtotal - $discount + $shipping + $tax, 2),
            'notes'            => $data['notes'] ?? null,
            'created_by'       => $admin->id,
        ]);

        return $this->created($invoice);
    }

    /** GET /admin/invoices/custom/{id}/download — renders the PDF from the stored snapshot. */
    public function customDownload(int $id): Response|JsonResponse
    {
        $invoice = CustomInvoice::with('order')->find($id);
        if (!$invoice) {
            return $this->notFound('Custom invoice not found');
        }

        ini_set('memory_limit', '256M');

        $pdf = Pdf::loadView('invoices.custom_order', [
            'invoice'  => $invoice,
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

        return $pdf->download("Custom-Invoice-{$invoice->invoice_number}.pdf");
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
