<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Invoice {{ $order->order_number }} - Gadget &amp; Revive</title>
    <style>
        body {
            margin: 0;
            padding: 0;
            font-family: Arial, sans-serif;
            font-size: 14px;
            color: #e2e8f0;
            background-color: #0f172a;
        }
        .wrapper {
            max-width: 600px;
            margin: 30px auto;
        }

        /* Header */
        .email-header {
            background: #111827;
            border-bottom: 3px solid #f97316;
            border-radius: 10px 10px 0 0;
            padding: 28px 36px;
            text-align: center;
        }
        .brand-name {
            font-size: 22px;
            font-weight: bold;
            color: #f97316;
            letter-spacing: 0.5px;
        }
        .brand-motto {
            font-size: 11px;
            color: #64748b;
            letter-spacing: 2px;
            text-transform: uppercase;
            margin-top: 4px;
        }

        /* Body */
        .email-body {
            background: #1e293b;
            padding: 32px 36px;
        }
        .greeting {
            font-size: 17px;
            font-weight: bold;
            color: #f1f5f9;
            margin-bottom: 12px;
        }
        .message {
            font-size: 13px;
            color: #94a3b8;
            line-height: 1.7;
            margin-bottom: 24px;
        }

        /* Order Summary Box */
        .order-box {
            background: #0f172a;
            border: 1px solid #334155;
            border-left: 4px solid #f97316;
            border-radius: 6px;
            padding: 18px 20px;
            margin-bottom: 22px;
        }
        .order-box-title {
            font-size: 10px;
            font-weight: bold;
            text-transform: uppercase;
            letter-spacing: 1px;
            color: #64748b;
            margin-bottom: 14px;
        }
        .order-detail-row {
            display: table;
            width: 100%;
            padding: 6px 0;
            border-bottom: 1px solid #1e293b;
        }
        .order-detail-row:last-child { border-bottom: none; }
        .od-label {
            display: table-cell;
            font-size: 12px;
            color: #64748b;
        }
        .od-value {
            display: table-cell;
            font-size: 12px;
            font-weight: bold;
            color: #cbd5e1;
            text-align: right;
        }
        .od-value.total { color: #f97316; font-size: 14px; }
        .od-value.paid  { color: #22c55e; }

        /* Note */
        .note-box {
            background: #1c2537;
            border: 1px solid #334155;
            border-left: 3px solid #f97316;
            border-radius: 5px;
            padding: 12px 16px;
            margin-bottom: 22px;
            font-size: 12px;
            color: #94a3b8;
            line-height: 1.6;
        }
        .note-box strong { color: #f97316; }

        /* CTA Button */
        .cta-section { text-align: center; margin: 24px 0; }
        .cta-button {
            display: inline-block;
            background: #f97316;
            color: #ffffff;
            padding: 12px 32px;
            border-radius: 8px;
            font-weight: bold;
            font-size: 13px;
            text-decoration: none;
            letter-spacing: 0.5px;
        }

        /* Footer */
        .email-footer {
            background: #111827;
            border-top: 1px solid #1e293b;
            border-radius: 0 0 10px 10px;
            padding: 22px 36px;
            text-align: center;
        }
        .footer-brand {
            font-size: 12px;
            font-weight: bold;
            color: #f97316;
            margin-bottom: 6px;
        }
        .footer-text {
            font-size: 11px;
            color: #475569;
            line-height: 1.7;
        }
        .footer-links { margin-top: 10px; }
        .footer-links a {
            color: #f97316;
            text-decoration: none;
            font-size: 11px;
            margin: 0 6px;
        }
        .footer-legal {
            font-size: 10px;
            color: #334155;
            margin-top: 12px;
        }
    </style>
</head>
<body>
<div class="wrapper">

    <!-- Header -->
    <div class="email-header">
        <div class="brand-name">Gadget &amp; Revive</div>
        <div class="brand-motto">Repair. Shop. Revive.</div>
    </div>

    <!-- Body -->
    <div class="email-body">
        <div class="greeting">
            Hello, {{ $order->customer_name ?? ($order->customer?->name ?? 'Valued Customer') }}!
        </div>
        <div class="message">
            Thank you for choosing <strong style="color:#f97316;">Gadget &amp; Revive</strong>.
            Your invoice is attached to this email as a PDF. Find a quick summary of your order below.
        </div>

        <!-- Order Summary -->
        <div class="order-box">
            <div class="order-box-title">Order Summary</div>
            <div class="order-detail-row">
                <span class="od-label">Order Number</span>
                <span class="od-value"># {{ $order->order_number }}</span>
            </div>
            <div class="order-detail-row">
                <span class="od-label">Order Date</span>
                <span class="od-value">{{ $order->created_at->format('d M Y, h:i A') }}</span>
            </div>
            <div class="order-detail-row">
                <span class="od-label">Order Status</span>
                <span class="od-value">{{ ucfirst(str_replace('_', ' ', $order->order_status)) }}</span>
            </div>
            <div class="order-detail-row">
                <span class="od-label">Payment Method</span>
                <span class="od-value">{{ ucwords(str_replace('_', ' ', $order->payment_method)) }}</span>
            </div>
            <div class="order-detail-row">
                <span class="od-label">Payment Status</span>
                <span class="od-value {{ $order->payment_status === 'paid' ? 'paid' : '' }}">
                    {{ ucfirst(str_replace('_', ' ', $order->payment_status)) }}
                </span>
            </div>
            <div class="order-detail-row">
                <span class="od-label">Total Amount</span>
                <span class="od-value total">BDT {{ number_format($order->total, 2) }}</span>
            </div>
        </div>

        <!-- Attachment Note -->
        <div class="note-box">
            <strong>Invoice Attached:</strong> Your PDF invoice is attached to this email. Save or print it
            for your records. For any questions about this invoice, contact us at
            <strong>support@gadgetrevive.com</strong>.
        </div>

        <div class="cta-section">
            <a href="{{ config('app.url') }}/orders/{{ $order->id }}" class="cta-button">
                View Order Details &rarr;
            </a>
        </div>
    </div>

    <!-- Footer -->
    <div class="email-footer">
        <div class="footer-brand">Gadget &amp; Revive Bangladesh Ltd.</div>
        <div class="footer-text">
            House 12, Road 4, Block C, Bashundhara R/A, Dhaka - 1229, Bangladesh<br>
            Phone: +880 1800-000000 | Email: support@gadgetrevive.com
        </div>
        <div class="footer-links">
            <a href="{{ config('app.url') }}">Website</a>
            <a href="{{ config('app.url') }}/support">Support</a>
            <a href="{{ config('app.url') }}/privacy">Privacy</a>
        </div>
        <div class="footer-legal">
            &copy; {{ date('Y') }} Gadget &amp; Revive Bangladesh Ltd. All rights reserved.<br>
            You received this because you placed an order with us.
        </div>
    </div>

</div>
</body>
</html>
