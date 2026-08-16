<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Invoice {{ $order->order_number }}</title>

    <style>
        /* ── Page ──────────────────────────────────── */
        @page { size: A4; margin: 12mm 10mm; }

        /* ── Reset ─────────────────────────────────── */
        * { margin: 0; padding: 0; box-sizing: border-box; }

        body {
            font-family: 'DejaVu Sans', Arial, sans-serif;
            font-size: 17px;
            line-height: 1.6;
            color: #000000;
            background-color: #ffffff;
        }

        /* Keep these blocks from being awkwardly split across a page break */
        table.items tr,
        .totals-section,
        .signature-section,
        .closing-block,
        .invoice-footer { page-break-inside: avoid; }

        .page-bg {
            background: #ffffff;
            min-height: 100%;
            padding: 0;
        }

        /* ── HEADER (dark band) ──────────────────────── */
        .invoice-header {
            background: #111827;
            padding: 16px 32px;
            display: table;
            width: 100%;
        }
        .header-left {
            display: table-cell;
            vertical-align: middle;
            width: 52%;
        }
        .header-right {
            display: table-cell;
            vertical-align: middle;
            text-align: right;
            width: 48%;
        }

        /* Logo + Brand */
        .brand-row { display: table; }
        .brand-logo-cell {
            display: table-cell;
            vertical-align: middle;
            padding-right: 16px;
        }
        .brand-logo-cell img {
            height: 52px;
            width: auto;
        }
        .brand-monogram {
            background: #ffffff;
            color: #000000;
            font-size: 21px;
            font-weight: 900;
            width: 52px;
            height: 52px;
            border-radius: 8px;
            text-align: center;
            line-height: 52px;
            letter-spacing: -1px;
        }
        .brand-text-cell {
            display: table-cell;
            vertical-align: middle;
        }
        .brand-name {
            font-size: 27px;
            font-weight: 900;
            color: #ffffff;
            letter-spacing: 0.5px;
            line-height: 1.15;
        }
        .brand-motto {
            font-size: 12.5px;
            color: #c7c7c7;
            font-weight: 400;
            letter-spacing: 2px;
            text-transform: uppercase;
            margin-top: 4px;
        }

        /* Company contact (header right) */
        .company-contact {
            font-size: 13.5px;
            color: #e2e2e2;
            line-height: 1.75;
        }
        .company-contact .cc-name {
            font-size: 15.5px;
            font-weight: 700;
            color: #ffffff;
            margin-bottom: 3px;
        }

        /* ── META STRIPE ─────────────────────────────── */
        .meta-stripe {
            background: #f3f4f6;
            padding: 8px 32px;
            display: table;
            width: 100%;
        }
        .stripe-cell {
            display: table-cell;
            vertical-align: middle;
            color: #000000;
            font-size: 14.5px;
            font-weight: 700;
            letter-spacing: 0.5px;
            text-transform: uppercase;
            width: 34%;
        }
        .stripe-cell.center { text-align: center; width: 32%; }
        .stripe-cell.right  { text-align: right; }
        .stripe-cell .lbl { color: #000000; font-weight: 400; }
        .doc-pill {
            display: inline-block;
            background: #111111;
            color: #ffffff;
            padding: 6px 24px;
            border-radius: 14px;
            font-size: 15.5px;
            font-weight: 900;
            letter-spacing: 2px;
        }

        /* ── BODY ────────────────────────────────────── */
        .body-wrap {
            padding: 16px 32px;
            /* Clears space for .page-footer-fixed so flowing content (the items table on a
               multi-page invoice) never runs underneath the fixed footer. */
            padding-bottom: 34mm;
            background: #ffffff;
        }

        /* ── FROM / BILL TO ──────────────────────────── */
        .parties-table {
            display: table;
            width: 100%;
            margin-bottom: 12px;
        }
        .party-cell {
            display: table-cell;
            width: 50%;
            vertical-align: top;
        }
        .party-cell-right {
            display: table-cell;
            width: 50%;
            vertical-align: top;
            padding-left: 5%;
        }
        .party-label {
            font-size: 12.5px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 1.5px;
            color: #000000;
            padding-bottom: 4px;
            margin-bottom: 6px;
        }
        .party-name {
            font-size: 18.5px;
            font-weight: 700;
            color: #000000;
            margin-bottom: 4px;
        }
        .party-detail {
            font-size: 15.5px;
            color: #000000;
            margin-bottom: 2px;
            line-height: 1.4;
        }
        .party-detail strong {
            color: #000000;
        }

        /* ── META INFO GRID ──────────────────────────── */
        .meta-section {
            background: #f6f6f6;
            border-radius: 5px;
            padding: 8px 0;
            margin-bottom: 12px;
        }
        .meta-inner { display: table; width: 100%; }
        .meta-item {
            display: table-cell;
            text-align: center;
            vertical-align: middle;
            padding: 4px 8px;
        }
        .meta-key {
            font-size: 12.5px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.8px;
            color: #000000;
            margin-bottom: 2px;
        }
        .meta-value {
            font-size: 17.5px;
            font-weight: 700;
            color: #000000;
        }

        /* ── SECTION HEADING ─────────────────────────── */
        .section-heading {
            font-size: 14.5px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 1.5px;
            color: #000000;
            margin-bottom: 6px;
        }

        /* ── ITEMS TABLE ─────────────────────────────── */
        .items-section { margin-bottom: 12px; }

        table.items {
            width: 100%;
            border-collapse: collapse;
            /* No outer border here on purpose — every th/td already carries its own full
               1px border below, which (via border-collapse) draws the identical outer edge
               anyway. Keeping it off the table element itself means .thead-spacer's blank row
               (which explicitly has no border) doesn't get boxed in on the left/right by it —
               genuine whitespace instead of an empty bordered cell. */
        }
        table.items thead tr { background: #eceef1; }
        /* Restores the top margin the repeated header row otherwise skips on page 2+ — see the
           HTML comment above the spacer row for why this exists. Zero border/background so it's
           genuinely invisible, not just short — a blank gap, not a visible empty bar. */
        table.items thead tr.thead-spacer { background: transparent; }
        table.items thead tr.thead-spacer td { border: none; padding: 0; height: 20pt; }
        table.items thead th {
            padding: 7px 8px;
            font-size: 14px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.8px;
            color: #000000;
            text-align: left;
            border: 1px solid #000000;
        }
        table.items thead th.r { text-align: right; }
        table.items thead th.c { text-align: center; }

        table.items tbody tr { border-bottom: 1px solid #000000; }
        table.items tbody tr:nth-child(even) { background: #f6f6f6; }
        table.items tbody td {
            padding: 6px 8px;
            font-size: 15.5px;
            color: #000000;
            vertical-align: top;
            line-height: 1.35;
            border: 1px solid #000000;
        }
        table.items tbody td.r { text-align: right; }
        table.items tbody td.c { text-align: center; }
        table.items tbody td.bold {
            font-weight: 700;
            color: #000000;
        }

        .item-sub {
            font-size: 13.5px;
            color: #000000;
            margin-top: 2px;
            line-height: 1.35;
        }
        .item-sub strong { color: #000000; }

        /* ── TOTALS ──────────────────────────────────── */
        .totals-section {
            display: table;
            width: 100%;
            margin-bottom: 12px;
        }
        .totals-spacer { display: table-cell; width: 48%; }
        .totals-block  { display: table-cell; width: 52%; vertical-align: top; }

        .total-row {
            display: table;
            width: 100%;
            padding: 3px 4px;
        }
        .total-lbl {
            display: table-cell;
            font-size: 15.5px;
            color: #000000;
        }
        .total-val {
            display: table-cell;
            text-align: right;
            font-size: 15.5px;
            font-weight: 600;
            color: #000000;
        }
        .total-row.paid .total-lbl,
        .total-row.paid .total-val { color: #15803d; font-weight: 700; }
        .total-row.due .total-lbl,
        .total-row.due .total-val { color: #b91c1c; font-weight: 700; }

        .grand-total-row {
            border-top: 1.5px solid #9ca3af;
            padding: 4px 8px 2px;
            display: table;
            width: 100%;
        }
        .grand-total-lbl {
            display: table-cell;
            font-size: 17.5px;
            font-weight: 700;
            color: #000000;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            vertical-align: middle;
        }
        .grand-total-val {
            display: table-cell;
            text-align: right;
            font-size: 24px;
            font-weight: 900;
            color: #000000;
            vertical-align: middle;
        }
        .grand-total-row.is-due { border-top-color: #b91c1c; }
        .grand-total-row.is-due .grand-total-lbl,
        .grand-total-row.is-due .grand-total-val { color: #b91c1c; }

        /* ── CUSTOMER NOTES ──────────────────────────── */
        .notes-section {
            background: #f6f6f6;
            border-radius: 5px;
            padding: 8px 14px;
            margin-bottom: 12px;
        }
        .notes-title {
            font-size: 12.5px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 1px;
            color: #000000;
            margin-bottom: 5px;
        }
        .notes-text {
            font-size: 15.5px;
            color: #000000;
            line-height: 1.5;
        }

        /* ── SIGNATURE SECTION ───────────────────────── */
        .signature-section {
            display: table;
            width: 100%;
            margin: 28px 0 10px;
        }
        .sig-cell {
            display: table-cell;
            width: 33.33%;
            vertical-align: bottom;
            text-align: center;
            padding: 45px 14px 0;
        }
        .sig-line {
            border-top: 1px dotted #000000;
            margin: 0 auto 10px;
            height: 1px;
        }
        .sig-label {
            font-size: 16.5px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.8px;
            color: #000000;
        }

        /* ── TERMS BANNER ────────────────────────────── */
        .terms-banner {
            background: #f3f4f6;
            color: #000000;
            text-align: center;
            font-size: 18.5px;
            font-weight: 700;
            letter-spacing: 0.3px;
            padding: 8px 16px;
            border-radius: 4px;
            margin-bottom: 8px;
        }
        .terms-text {
            font-size: 15.5px;
            color: #000000;
            line-height: 1.5;
            text-align: justify;
            margin-bottom: 10px;
        }

        /* ── WATERMARK ───────────────────────────────── */
        .watermark {
            position: fixed;
            top: 42%;
            left: 50%;
            transform: translateX(-50%) rotate(-38deg);
            font-size: 72px;
            font-weight: 900;
            opacity: 0.06;
            color: #000000;
            letter-spacing: 8px;
            text-transform: uppercase;
            pointer-events: none;
        }

        /* ── CORNER LOGO WATERMARK ───────────────────── */
        /* A large, faint brand mark anchored to the bottom-right corner of every page — doubles
           as the "background shape" accent: a soft round tint sits behind the logo itself so it
           reads as one designed corner piece rather than a plain stamped image. Low opacity +
           `position: fixed` (repeats identically on every page, painted above static content per
           normal stacking rules) keeps it out of the way of real content, same trick as .watermark
           above. Bleeds slightly past the page edge so it feels like a corner flourish, not a sticker.
           IMPORTANT: these two pieces are siblings, not parent+absolutely-positioned-child — DomPDF
           silently stops repeating *every* fixed element on the page (not just this one) when a
           `position:fixed` box contains a `position:absolute` descendant and other fixed elements
           are also present. Confirmed by isolated testing; keep this flat. */
        .corner-mark-shape {
            position: fixed;
            bottom: -18mm;
            right: -18mm;
            width: 100mm;
            height: 100mm;
            border-radius: 50%;
            background: #111827;
            opacity: 0.035;
            pointer-events: none;
        }
        .corner-mark-logo {
            position: fixed;
            bottom: 6mm;
            right: 6mm;
            width: 62mm;
            pointer-events: none;
        }
        .corner-mark-logo img {
            width: 100%;
            height: auto;
            opacity: 0.09;
        }

        /* ── PAGE NUMBER ─────────────────────────────── */
        /* Not done in CSS: DomPDF has no working `counter(pages)` (grand total) — it only
           resolves the per-page counter, not the total, so it silently rendered "0". "Page X of Y"
           is instead drawn directly onto the canvas after render, via Canvas::page_text() in
           InvoiceController@generatePdf — DomPDF's actual supported mechanism for this. It's
           placed in the page's outer @page margin strip below the fixed footer, an area no HTML
           content ever occupies, so it can't collide with anything here. */

        /* ── FOOTER ──────────────────────────────────── */
        /* Fixed to the bottom of the page box (DomPDF positions `fixed` elements relative to
           the page's margin box) so short invoices — few line items — don't end up with the
           branding/reference footer stranded partway down a mostly-blank page; it always sits
           flush with the bottom margin, on every page, the same way a running footer would.
           The tint is deliberately low-opacity so .corner-mark-logo, which shares this corner
           of the page, still shows through it rather than getting covered up. */
        .page-footer-fixed {
            position: fixed;
            bottom: 0;
            left: 0;
            right: 0;
            background: rgba(17, 24, 39, 0.045);
            padding: 8px 32px 6px;
        }
        .invoice-footer {
            margin-top: 10px;
            padding-top: 10px;
            border-top: 1px solid #e5e7eb;
            display: table;
            width: 100%;
        }
        .footer-left {
            display: table-cell;
            vertical-align: middle;
            width: 60%;
        }
        .footer-right {
            display: table-cell;
            vertical-align: middle;
            text-align: right;
            width: 40%;
        }
        .footer-brand {
            font-size: 16px;
            font-weight: 700;
            color: #000000;
            margin-bottom: 3px;
        }
        .footer-sub {
            font-size: 14.5px;
            color: #000000;
            line-height: 1.7;
        }
        .footer-ref-label {
            font-size: 13px;
            color: #000000;
            text-transform: uppercase;
            letter-spacing: 0.8px;
            margin-bottom: 3px;
        }
        .footer-ref-code {
            font-size: 16px;
            font-weight: 700;
            color: #000000;
            letter-spacing: 1px;
        }
        .footer-timestamp {
            font-size: 13.5px;
            color: #000000;
            margin-top: 4px;
        }
        .legal {
            text-align: center;
            font-size: 13.5px;
            color: #000000;
            margin-top: 8px;
            font-style: italic;
        }
    </style>
</head>
<body>

    @php
        $paidAmount = (float) ($order->paid_amount ?? 0);
        $outstanding = round((float) $order->total - $paidAmount, 2);
        $isPartial = $order->payment_status === 'partially_paid' && $outstanding > 0;
        $cornerLogo = $settings['logo_black'] ?? $settings['logo_white'] ?? null;
    @endphp

    {{-- Every position:fixed element that needs to repeat on every page MUST be a direct child of
         <body> — DomPDF's page reflower (FrameReflower/Page.php) only collects fixed-position
         nodes from the first page's direct-body-children when deciding what to clone onto every
         subsequent page; one placed inside a wrapper div (like .page-bg below) is invisible to
         that scan and just renders once, on whichever single page it happened to lay out on. This
         cost real debugging time to track down — don't move these back inside .page-bg. --}}

    @if($order->payment_status !== 'paid' && $order->payment_status !== 'verified')
    <div class="watermark">{{ $isPartial ? 'PARTIALLY PAID' : strtoupper(str_replace('_', ' ', $order->payment_status)) }}</div>
    @endif

    <div class="corner-mark-shape"></div>
    @if($cornerLogo)
    <div class="corner-mark-logo">
        <img src="{{ $cornerLogo }}" alt="">
    </div>
    @endif

    {{-- FOOTER — fixed to the page bottom, on every page. --}}
    <div class="page-footer-fixed">
        <div class="invoice-footer">
            <div class="footer-left">
                <div class="footer-brand">{{ $settings['footer_brand'] ?? 'Gadget Revive Bangladesh Ltd.' }}</div>
                <div class="footer-sub">
                    {{ $settings['footer_address'] ?? 'House 12, Road 4, Block C, Bashundhara R/A, Dhaka - 1229' }}<br>
                    Phone: {{ $settings['footer_phone'] ?? '+880 1800-000000' }} | Email: {{ $settings['footer_email'] ?? 'support@gadgetrevive.com' }}
                </div>
            </div>
            <div class="footer-right">
                <div class="footer-ref-label">Document Reference</div>
                <div class="footer-ref-code">{{ $order->order_number }}</div>
                <div class="footer-timestamp">Generated: {{ now()->format('d M Y, h:i A') }}</div>
            </div>
        </div>

        <div class="legal">
            This is a computer-generated invoice and does not require a physical signature.
            &copy; {{ date('Y') }} {{ $settings['legal_entity'] ?? 'Gadget Revive Bangladesh Ltd.' }}. All rights reserved.
        </div>
    </div>

<div class="page-bg">

    {{-- ═══════════════════ HEADER ═══════════════════ --}}
    <div class="invoice-header">
        <div class="header-left">
            <div class="brand-row">
                <div class="brand-logo-cell">
                    @if(!empty($settings['logo_white']))
                        <img src="{{ $settings['logo_white'] }}" alt="logo">
                    @else
                        <div class="brand-monogram">GR</div>
                    @endif
                </div>
                <div class="brand-text-cell">
                    <div class="brand-name">{{ $settings['site_name'] ?? 'Gadget Revive' }}</div>
                    @if(!empty($settings['site_tagline']))
                        <div class="brand-motto">{{ $settings['site_tagline'] }}</div>
                    @endif
                </div>
            </div>
        </div>
        <div class="header-right">
            <div class="company-contact">
                <div class="cc-name">{{ $settings['footer_brand'] ?? 'Gadget Revive Bangladesh Ltd.' }}</div>
                {{ $settings['address'] ?? '' }}<br>
                Mobile: {{ $settings['phone'] ?? '' }}<br>
                {{ $settings['email'] ?? '' }}
                @if(!empty($settings['website'])) &nbsp;|&nbsp; {{ $settings['website'] }} @endif
            </div>
        </div>
    </div>

    {{-- ═══════════════════ META STRIPE ═══════════════════ --}}
    <div class="meta-stripe">
        <div class="stripe-cell">
            <span class="lbl">Invoice No:</span> {{ $order->order_number }}
        </div>
        <div class="stripe-cell center">
            <span class="doc-pill">{{ $isPartial ? 'PARTIAL INVOICE' : 'INVOICE' }}</span>
        </div>
        <div class="stripe-cell right">
            <span class="lbl">Date:</span> {{ $order->created_at->format('d/m/Y') }}
        </div>
    </div>

    {{-- ═══════════════════ BODY ═══════════════════ --}}
    <div class="body-wrap">

        {{-- FROM / BILL TO --}}
        <div class="parties-table">
            <div class="party-cell">
                <div class="party-label">From</div>
                <div class="party-name">{{ $settings['footer_brand'] ?? 'Gadget Revive Bangladesh Ltd.' }}</div>
                <div class="party-detail">{{ $settings['address'] ?? '' }}</div>
                <div class="party-detail"><strong>Mobile:</strong> {{ $settings['phone'] ?? '' }}</div>
                <div class="party-detail"><strong>Email:</strong> {{ $settings['email'] ?? '' }}</div>
            </div>
            <div class="party-cell-right">
                <div class="party-label">Bill To</div>
                <div class="party-name">
                    {{ $order->customer_name ?? ($order->customer?->name ?? 'Valued Customer') }}
                </div>
                @if($order->customer?->user_code)
                <div class="party-detail"><strong>Customer ID:</strong> {{ $order->customer->user_code }}</div>
                @endif
                @if($order->customer_phone)
                <div class="party-detail"><strong>Mobile:</strong> {{ $order->customer_phone }}</div>
                @endif
                @php $email = $order->customer_email ?? $order->customer?->email; @endphp
                @if($email)
                <div class="party-detail"><strong>Email:</strong> {{ $email }}</div>
                @endif
                @if($order->customer_address)
                <div class="party-detail"><strong>Address:</strong> {{ $order->customer_address }}</div>
                @endif
                @php
                    $location = collect([
                        $order->area?->name,
                        $order->district?->name,
                        $order->division?->name,
                    ])->filter()->join(', ');
                @endphp
                @if($location)
                <div class="party-detail">{{ $location }}</div>
                @endif
            </div>
        </div>

        {{-- META INFO GRID --}}
        <div class="meta-section">
            <div class="meta-inner">
                <div class="meta-item">
                    <div class="meta-key">Invoice No</div>
                    <div class="meta-value">{{ $order->order_number }}</div>
                </div>
                <div class="meta-item">
                    <div class="meta-key">Issue Date</div>
                    <div class="meta-value">{{ $order->created_at->format('d M Y') }}</div>
                </div>
                <div class="meta-item">
                    <div class="meta-key">Order Status</div>
                    <div class="meta-value">{{ ucfirst(str_replace('_', ' ', $order->order_status)) }}</div>
                </div>
                <div class="meta-item">
                    <div class="meta-key">Payment</div>
                    <div class="meta-value">{{ in_array($order->payment_status, ['paid', 'verified'], true) ? 'Paid' : ucfirst(str_replace('_', ' ', $order->payment_status)) }}</div>
                </div>
                <div class="meta-item">
                    <div class="meta-key">Payment Method</div>
                    <div class="meta-value">{{ ucfirst(str_replace('_', ' ', $order->payment_method)) }}</div>
                </div>
            </div>
        </div>

        {{-- ITEMS TABLE --}}
        <div class="items-section">
            <div class="section-heading">Order Items &mdash; Products &amp; Services</div>
            <table class="items">
                <thead>
                    {{-- Blank spacer row — DomPDF repeats the whole <thead> pinned to the literal
                         physical top of every continuation page, ignoring the page margin
                         entirely (confirmed by testing — even a 45mm margin didn't move it; a
                         table-specific quirk, regular content isn't affected). Without this, the
                         column-header row sits flush against the page edge on page 2+ with no
                         breathing room. This restores that margin. It also adds the same small
                         gap above the header on page 1 — there's no way to make it page-2-only
                         from pure CSS/HTML, since nothing in a static stylesheet can tell which
                         page it's landed on. --}}
                    <tr class="thead-spacer"><td colspan="6"></td></tr>
                    <tr>
                        <th style="width:4%;">#</th>
                        <th style="width:39%;">Item / Description &amp; Serial No.</th>
                        <th class="c" style="width:12%;">Warranty</th>
                        <th class="r" style="width:14%;">Unit Price (BDT)</th>
                        <th class="c" style="width:7%;">Qty</th>
                        <th class="r" style="width:17%;">Total (BDT)</th>
                    </tr>
                </thead>
                <tbody>
                    @forelse($order->items as $index => $item)
                    @php
                        // Real per-unit serials (product_serials, picked when this line item was
                        // sold) take priority. The item_sku fallback is only shown for repair-service
                        // items, which reuse that field to carry the device's real serial captured at
                        // intake — a plain product's own SKU is not a serial number and is no longer
                        // printed on the invoice at all.
                        $realSerials = $item->relationLoaded('serials')
                            ? $item->serials->pluck('serial_number')->filter()->implode(', ')
                            : '';
                    @endphp
                    <tr>
                        <td>{{ $index + 1 }}</td>
                        <td class="bold">
                            {{ $item->item_name }}
                            @if($realSerials)
                            <div class="item-sub"><strong>SN:</strong> {{ $realSerials }}</div>
                            @elseif($item->item_type === 'service' && $item->item_sku)
                            <div class="item-sub"><strong>SN:</strong> {{ $item->item_sku }}</div>
                            @endif
                            @if($item->notes)
                            <div class="item-sub"><strong>{{ $item->item_type === 'service' ? 'Problem Reported' : 'Note' }}:</strong> {{ $item->notes }}</div>
                            @endif
                        </td>
                        <td class="c">
                            @if($item->warranty_value && $item->warranty_unit)
                                {{ $item->warranty_value }} {{ $item->warranty_unit }}{{ $item->warranty_value > 1 ? 's' : '' }}
                            @else
                                &mdash;
                            @endif
                        </td>
                        <td class="r">{{ number_format($item->unit_price, 2) }}</td>
                        <td class="c">{{ $item->quantity }}</td>
                        <td class="r bold">{{ number_format($item->total_price, 2) }}</td>
                    </tr>
                    @empty
                    <tr>
                        <td colspan="6" style="text-align:center; color:#000000; padding:20px;">No items found.</td>
                    </tr>
                    @endforelse
                </tbody>
            </table>
        </div>

        {{-- TOTALS --}}
        <div class="totals-section">
            <div class="totals-spacer"></div>
            <div class="totals-block">
                <div class="totals-box">
                    <div class="total-row">
                        <div class="total-lbl">Subtotal</div>
                        <div class="total-val">BDT {{ number_format($order->subtotal, 2) }}</div>
                    </div>
                    @if($order->tax > 0)
                    <div class="total-row">
                        <div class="total-lbl">Tax / VAT</div>
                        <div class="total-val">BDT {{ number_format($order->tax, 2) }}</div>
                    </div>
                    @endif
                    @if($order->shipping > 0)
                    <div class="total-row">
                        <div class="total-lbl">Shipping</div>
                        <div class="total-val">BDT {{ number_format($order->shipping, 2) }}</div>
                    </div>
                    @endif
                    @if($order->discount > 0)
                    <div class="total-row">
                        <div class="total-lbl">Discount</div>
                        <div class="total-val">- BDT {{ number_format($order->discount, 2) }}</div>
                    </div>
                    @endif
                    @if($isPartial)
                    <div class="total-row paid">
                        <div class="total-lbl">Amount Paid</div>
                        <div class="total-val">BDT {{ number_format($paidAmount, 2) }}</div>
                    </div>
                    <div class="total-row due">
                        <div class="total-lbl">Balance Due</div>
                        <div class="total-val">BDT {{ number_format($outstanding, 2) }}</div>
                    </div>
                    @endif
                    <div class="grand-total-row {{ $isPartial ? 'is-due' : '' }}">
                        <div class="grand-total-lbl">{{ $isPartial ? 'Balance Due' : 'Total' }}</div>
                        <div class="grand-total-val">BDT {{ number_format($isPartial ? $outstanding : $order->total, 2) }}</div>
                    </div>
                </div>
            </div>
        </div>

        {{-- CUSTOMER NOTES --}}
        @if($order->customer_notes)
        <div class="notes-section">
            <div class="notes-title">Customer Notes</div>
            <div class="notes-text">{{ $order->customer_notes }}</div>
        </div>
        @endif

        {{-- SIGNATURE + TERMS — grouped as one unbreakable block (see .closing-block, page-break-inside:
             avoid above) so a multi-page invoice never splits the signature lines from the terms text
             across the page boundary; if it doesn't fit in the remaining space on this page, the whole
             block moves to the next page together, landing right above the footer there instead. --}}
        <div class="closing-block">
            <div class="signature-section">
                <div class="sig-cell">
                    <div class="sig-line"></div>
                    <div class="sig-label">Client Signature</div>
                </div>
                <div class="sig-cell">
                    <div class="sig-line"></div>
                    <div class="sig-label">Authorized Signature</div>
                </div>
                <div class="sig-cell">
                    <div class="sig-line"></div>
                    <div class="sig-label">Delivery Date</div>
                </div>
            </div>

            {{-- TERMS --}}
            <div class="terms-banner">Please read the Terms &amp; Conditions below before you receive your product.</div>
            <div class="terms-text">{{ $settings['terms'] ?? '' }}</div>
        </div>

    </div>{{-- /body-wrap --}}
</div>{{-- /page-bg --}}
</body>
</html>
