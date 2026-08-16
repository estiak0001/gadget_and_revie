<?php

namespace App\Http\Controllers\Api;

use App\Mail\InvoiceMail;
use App\Models\AuditLog;
use App\Models\CustomInvoice;
use App\Models\Order;
use App\Services\SmsService;
use App\Traits\ResolvesBrandingSettings;
use App\Traits\StampsPdfPageNumbers;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Mail;

class InvoiceController extends BaseController
{
    use ResolvesBrandingSettings, StampsPdfPageNumbers;

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

    /**
     * Download a Money Receipt PDF — proof of payment for an order, separate from the Invoice
     * (which lists what was sold). Reflects the order's cumulative paid_amount by default, since
     * there's no per-transaction payment log to generate one receipt per individual installment
     * from; an optional ?amount= overrides what's shown as "Amount Received" (capped at what's
     * actually been paid) for reprinting a receipt right after a specific partial payment.
     */
    public function moneyReceiptDownload(Request $request, int $id): Response|JsonResponse
    {
        $user = $request->user();
        $order = $this->resolveOrder($user, $id);

        if (!$order) {
            return $this->error('Order not found or access denied.', 404);
        }
        if ((float) $order->paid_amount <= 0) {
            return $this->error('Nothing has been paid on this order yet — there is nothing to issue a money receipt for.', 422);
        }

        $pdf = $this->generateMoneyReceiptPdf($order, $request->query('amount'));

        return $pdf->download("Money-Receipt-{$order->order_number}.pdf");
    }

    /** Stream (view in browser) the Money Receipt PDF. */
    public function moneyReceiptStream(Request $request, int $id): Response|JsonResponse
    {
        $user = $request->user();
        $order = $this->resolveOrder($user, $id);

        if (!$order) {
            return $this->error('Order not found or access denied.', 404);
        }
        if ((float) $order->paid_amount <= 0) {
            return $this->error('Nothing has been paid on this order yet — there is nothing to issue a money receipt for.', 422);
        }

        $pdf = $this->generateMoneyReceiptPdf($order, $request->query('amount'));

        return $pdf->stream("Money-Receipt-{$order->order_number}.pdf");
    }

    /**
     * Download a Delivery Chalan PDF — a goods-delivery note listing items/quantities/serials
     * WITHOUT prices, for verifying what was physically handed over. Separate from the Invoice
     * (which carries pricing) and the Money Receipt (which is proof of payment).
     */
    public function deliveryChalanDownload(Request $request, int $id): Response|JsonResponse
    {
        $user = $request->user();
        $order = $this->resolveOrder($user, $id);

        if (!$order) {
            return $this->error('Order not found or access denied.', 404);
        }

        $pdf = $this->generateDeliveryChalanPdf($order);

        return $pdf->download("Delivery-Chalan-{$order->order_number}.pdf");
    }

    /** Stream (view in browser) the Delivery Chalan PDF. */
    public function deliveryChalanStream(Request $request, int $id): Response|JsonResponse
    {
        $user = $request->user();
        $order = $this->resolveOrder($user, $id);

        if (!$order) {
            return $this->error('Order not found or access denied.', 404);
        }

        $pdf = $this->generateDeliveryChalanPdf($order);

        return $pdf->stream("Delivery-Chalan-{$order->order_number}.pdf");
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

    /**
     * POST /admin/invoices/{orderId}/custom — create a new custom invoice. Super_admin (or anyone
     * specifically granted create_custom_invoices).
     */
    public function customStore(Request $request, int $orderId): JsonResponse
    {
        $admin = $request->user();
        if (!$admin->hasRole('super_admin') && !$admin->can('create_custom_invoices')) {
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

    /**
     * POST /admin/invoices/custom/{id}/send-sms — manual, deliberate action: creating a custom
     * invoice never sends SMS on its own (the admin might issue several drafts before settling on
     * one), so notifying the customer is its own explicit button click.
     */
    public function customSendSms(Request $request, int $id, SmsService $sms): JsonResponse
    {
        $invoice = CustomInvoice::find($id);
        if (!$invoice) {
            return $this->notFound('Custom invoice not found');
        }

        if (!$invoice->customer_phone) {
            return $this->error('This invoice has no customer phone number to send to.', 422);
        }

        if (!$sms->shouldSendOrderUpdates()) {
            return $this->error('Order SMS is currently disabled — enable it under SMS Center > Order & Billing.', 422);
        }

        $ok = $sms->sendCustomInvoiceSms(
            $invoice->customer_phone,
            $invoice->invoice_number,
            number_format((float) $invoice->total, 2),
            $invoice->order_id
        );

        if (!$ok) {
            return $this->error('Failed to send the SMS. Check the SMS log for details.', 422);
        }

        AuditLog::log($request->user(), 'send_custom_invoice_sms', 'CustomInvoice', $invoice->id, null, [
            'phone' => $invoice->customer_phone,
        ], "SMS sent for custom invoice {$invoice->invoice_number}");

        return $this->success(null, 'SMS sent.');
    }

    /** Renders the exact text the "Send SMS" button would send, without sending it — see
     *  AdminController::orderPreviewSms() for the same pattern on orders. */
    public function customPreviewSms(int $id, SmsService $sms): JsonResponse
    {
        $invoice = CustomInvoice::find($id);
        if (!$invoice) {
            return $this->notFound('Custom invoice not found');
        }

        if (!$invoice->customer_phone) {
            return $this->error('This invoice has no customer phone number to send to.', 422);
        }

        $message = $sms->buildCustomInvoiceMessage($invoice->invoice_number, number_format((float) $invoice->total, 2));

        return $this->success(['phone' => $invoice->customer_phone, 'message' => $message]);
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

        $this->stampPageNumbers($pdf);

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
            'items.serials',
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

        $this->stampPageNumbers($pdf);

        return $pdf;
    }

    private function generateMoneyReceiptPdf(Order $order, mixed $amountOverride = null): \Barryvdh\DomPDF\PDF
    {
        ini_set('memory_limit', '256M');
        $order->loadMissing(['items', 'customer']);

        $paidToDate = round((float) $order->paid_amount, 2);
        $balanceDue = max(0, round((float) $order->total - $paidToDate, 2));
        $receiptAmount = $amountOverride !== null && is_numeric($amountOverride) && (float) $amountOverride > 0
            ? min((float) $amountOverride, $paidToDate)
            : $paidToDate;

        $pdf = Pdf::loadView('invoices.money-receipt', [
            'order'          => $order,
            'settings'       => $this->brandingSettings(),
            'receiptNumber'  => "MR-{$order->order_number}",
            'receiptAmount'  => $receiptAmount,
            'paidToDate'     => $paidToDate,
            'balanceDue'     => $balanceDue,
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

    private function generateDeliveryChalanPdf(Order $order): \Barryvdh\DomPDF\PDF
    {
        ini_set('memory_limit', '256M');
        $order->loadMissing(['items.serials', 'customer', 'division', 'district', 'area']);

        $pdf = Pdf::loadView('invoices.delivery-chalan', [
            'order'        => $order,
            'settings'     => $this->brandingSettings(),
            'chalanNumber' => "DC-{$order->order_number}",
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
