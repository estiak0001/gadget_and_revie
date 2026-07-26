<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Purchase Order {{ $po->po_number }}</title>

    <style>
        @page { size: A4; margin: 12mm 10mm; }

        * { margin: 0; padding: 0; box-sizing: border-box; }

        body {
            font-family: 'DejaVu Sans', Arial, sans-serif;
            font-size: 12.5px;
            line-height: 1.55;
            color: #000000;
            background-color: #ffffff;
        }

        /* Keep these blocks from being awkwardly split across a page break */
        table.items tr,
        .estimate-section,
        .invoice-footer { page-break-inside: avoid; }

        .page-bg { background: #ffffff; min-height: 100%; padding: 0; }

        /* ── HEADER (dark band) ──────────────────────── */
        .invoice-header {
            background: #111827;
            padding: 24px 36px 22px;
            display: table;
            width: 100%;
        }
        .header-left  { display: table-cell; vertical-align: middle; width: 52%; }
        .header-right { display: table-cell; vertical-align: middle; text-align: right; width: 48%; }

        .brand-row { display: table; }
        .brand-logo-cell { display: table-cell; vertical-align: middle; padding-right: 14px; }
        .brand-logo-cell img { height: 46px; width: auto; }
        .brand-monogram {
            background: #ffffff; color: #000000; font-size: 18px; font-weight: 900;
            width: 46px; height: 46px; border-radius: 8px; text-align: center; line-height: 46px;
        }
        .brand-text-cell { display: table-cell; vertical-align: middle; }
        .brand-name { font-size: 21px; font-weight: 900; color: #ffffff; letter-spacing: 0.5px; line-height: 1.1; }
        .brand-motto {
            font-size: 8.5px; color: #b3b3b3; font-weight: 400; letter-spacing: 2px;
            text-transform: uppercase; margin-top: 3px;
        }

        .company-contact { font-size: 9.5px; color: #d4d4d4; line-height: 1.65; }
        .company-contact .cc-name { font-size: 11px; font-weight: 700; color: #ffffff; margin-bottom: 2px; }

        /* ── META STRIPE ─────────────────────────────── */
        .meta-stripe { background: #f3f4f6; padding: 9px 36px; display: table; width: 100%; }
        .stripe-cell {
            display: table-cell; vertical-align: middle; color: #000000; font-size: 11px;
            font-weight: 700; letter-spacing: 0.5px; text-transform: uppercase; width: 34%;
        }
        .stripe-cell.center { text-align: center; width: 32%; }
        .stripe-cell.right  { text-align: right; }
        .stripe-cell .lbl { color: #000000; font-weight: 400; }
        .doc-pill {
            display: inline-block; background: #111111; color: #ffffff; padding: 5px 18px;
            border-radius: 14px; font-size: 11.5px; font-weight: 900; letter-spacing: 2px;
        }

        /* ── BODY ────────────────────────────────────── */
        /* Clears space for .page-footer-fixed so flowing content never runs underneath it. */
        .body-wrap { padding: 24px 36px; padding-bottom: 30mm; background: #ffffff; }

        .parties-table { display: table; width: 100%; margin-bottom: 20px; }
        .party-cell { display: table-cell; width: 50%; vertical-align: top; }
        .party-cell-right { display: table-cell; width: 50%; vertical-align: top; padding-left: 5%; }
        .party-label {
            font-size: 8.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 1.5px;
            color: #000000; padding-bottom: 4px; margin-bottom: 9px;
        }
        .party-name { font-size: 14px; font-weight: 700; color: #000000; margin-bottom: 5px; }
        .party-detail { font-size: 12px; color: #000000; margin-bottom: 2px; }
        .party-detail strong { color: #000000; }

        /* ── META INFO GRID ──────────────────────────── */
        .meta-section {
            background: #f6f6f6; border-radius: 5px;
            padding: 12px 0; margin-bottom: 20px;
        }
        .meta-inner { display: table; width: 100%; }
        .meta-item {
            display: table-cell; text-align: center; vertical-align: middle;
            padding: 4px 10px;
        }
        .meta-key {
            font-size: 8.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.8px;
            color: #000000; margin-bottom: 3px;
        }
        .meta-value { font-size: 13px; font-weight: 700; color: #000000; }

        /* ── SECTION HEADING ─────────────────────────── */
        .section-heading {
            font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 1.5px;
            color: #000000; margin-bottom: 8px;
        }

        /* ── ITEMS TABLE ─────────────────────────────── */
        .items-section { margin-bottom: 18px; }
        table.items { width: 100%; border-collapse: collapse; border: 1px solid #000000; }
        table.items thead tr { background: #eceef1; }
        table.items thead th {
            padding: 10px; font-size: 10px; font-weight: 700; text-transform: uppercase;
            letter-spacing: 0.8px; color: #000000; text-align: left; border: 1px solid #000000;
        }
        table.items thead th.r { text-align: right; }
        table.items thead th.c { text-align: center; }
        table.items tbody tr { border-bottom: 1px solid #000000; }
        table.items tbody tr:nth-child(even) { background: #f6f6f6; }
        table.items tbody td { padding: 9px 10px; font-size: 12px; color: #000000; vertical-align: top; border: 1px solid #000000; }
        table.items tbody td.c { text-align: center; }
        table.items tbody td.r { text-align: right; }
        table.items tbody td.bold { font-weight: 700; color: #000000; }
        .item-sub { font-size: 9.5px; color: #000000; margin-top: 2px; }

        /* ── TOTALS BOX ──────────────────────────────── */
        .estimate-section { display: table; width: 100%; margin-bottom: 20px; }
        .estimate-spacer { display: table-cell; width: 56%; }
        .estimate-block  { display: table-cell; width: 44%; vertical-align: top; }
        .estimate-row {
            display: table; width: 100%; padding: 3px 4px;
        }
        .estimate-lbl { display: table-cell; font-size: 12px; color: #000000; }
        .estimate-val { display: table-cell; text-align: right; font-size: 12px; font-weight: 600; color: #000000; }
        .estimate-total-row { border-top: 1.5px solid #9ca3af; padding: 4px 4px 2px; display: table; width: 100%; }
        .estimate-total-lbl {
            display: table-cell; font-size: 16px; font-weight: 700; color: #000000;
            text-transform: uppercase; letter-spacing: 0.5px; vertical-align: middle;
        }
        .estimate-total-val { display: table-cell; text-align: right; font-size: 24px; font-weight: 900; color: #000000; vertical-align: middle; }

        /* ── NOTES ───────────────────────────────────── */
        .notes-section {
            background: #f6f6f6; border-radius: 5px; padding: 10px 14px; margin-bottom: 18px;
        }
        .notes-title {
            font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px;
            color: #000000; margin-bottom: 4px;
        }
        .notes-text { font-size: 12px; color: #000000; }

        /* ── FOOTER ──────────────────────────────────── */
        /* Fixed to the page bottom (DomPDF positions `fixed` elements relative to the page's
           margin box) so a PO with few line items doesn't leave the footer stranded partway
           down a mostly-blank page. */
        .page-footer-fixed { position: fixed; bottom: 0; left: 0; right: 0; }
        .invoice-footer {
            margin-top: 14px; padding-top: 14px; border-top: 1px solid #e5e7eb; display: table; width: 100%;
        }
        .footer-left { display: table-cell; vertical-align: middle; width: 60%; }
        .footer-right { display: table-cell; vertical-align: middle; text-align: right; width: 40%; }
        .footer-brand { font-size: 12px; font-weight: 700; color: #000000; margin-bottom: 2px; }
        .footer-sub { font-size: 10.5px; color: #000000; line-height: 1.6; }
        .footer-ref-label {
            font-size: 9.5px; color: #000000; text-transform: uppercase; letter-spacing: 0.8px; margin-bottom: 2px;
        }
        .footer-ref-code { font-size: 12px; font-weight: 700; color: #000000; letter-spacing: 1px; }
        .footer-timestamp { font-size: 10px; color: #000000; margin-top: 3px; }
        .legal { text-align: center; font-size: 10px; color: #000000; margin-top: 12px; font-style: italic; }
    </style>
</head>
<body>
<div class="page-bg">

    @php
        $companyName = $settings['footer_brand'] ?? 'Gadget Revive Bangladesh Ltd.';
        $companyAddress = $settings['address'] ?? '';
        $companyPhone = $settings['phone'] ?? '';
        $companyEmail = $settings['email'] ?? '';
    @endphp

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
                <div class="cc-name">{{ $companyName }}</div>
                {{ $companyAddress }}<br>
                @if($companyPhone) Mobile: {{ $companyPhone }}<br> @endif
                {{ $companyEmail }}
            </div>
        </div>
    </div>

    {{-- ═══════════════════ META STRIPE ═══════════════════ --}}
    <div class="meta-stripe">
        <div class="stripe-cell">
            <span class="lbl">PO No:</span> {{ $po->po_number }}
        </div>
        <div class="stripe-cell center">
            <span class="doc-pill">PURCHASE ORDER</span>
        </div>
        <div class="stripe-cell right">
            <span class="lbl">Date:</span> {{ $po->created_at->format('d/m/Y') }}
        </div>
    </div>

    {{-- ═══════════════════ BODY ═══════════════════ --}}
    <div class="body-wrap">

        {{-- SUPPLIER / BUYER --}}
        <div class="parties-table">
            <div class="party-cell">
                <div class="party-label">Supplier</div>
                <div class="party-name">{{ $po->supplier->name ?? 'N/A' }}</div>
                @if($po->supplier?->contact_person)
                <div class="party-detail"><strong>Contact:</strong> {{ $po->supplier->contact_person }}</div>
                @endif
                @if($po->supplier?->phone)
                <div class="party-detail"><strong>Phone:</strong> {{ $po->supplier->phone }}</div>
                @endif
                @if($po->supplier?->email)
                <div class="party-detail"><strong>Email:</strong> {{ $po->supplier->email }}</div>
                @endif
                @if($po->supplier?->address)
                <div class="party-detail">{{ $po->supplier->address }}</div>
                @endif
            </div>
            <div class="party-cell-right">
                <div class="party-label">Buyer</div>
                <div class="party-name">{{ $companyName }}</div>
                @if($companyAddress)
                <div class="party-detail">{{ $companyAddress }}</div>
                @endif
                @if($companyPhone)
                <div class="party-detail"><strong>Phone:</strong> {{ $companyPhone }}</div>
                @endif
            </div>
        </div>

        {{-- META INFO GRID --}}
        <div class="meta-section">
            <div class="meta-inner">
                <div class="meta-item">
                    <div class="meta-key">PO Number</div>
                    <div class="meta-value">{{ $po->po_number }}</div>
                </div>
                <div class="meta-item">
                    <div class="meta-key">Order Date</div>
                    <div class="meta-value">{{ optional($po->ordered_at)->format('d M Y') ?: '—' }}</div>
                </div>
                <div class="meta-item">
                    <div class="meta-key">Expected Date</div>
                    <div class="meta-value">{{ optional($po->expected_date)->format('d M Y') ?: '—' }}</div>
                </div>
                <div class="meta-item">
                    <div class="meta-key">Status</div>
                    <div class="meta-value">{{ ucfirst(str_replace('_', ' ', $po->status)) }}</div>
                </div>
            </div>
        </div>

        {{-- ITEMS TABLE --}}
        <div class="items-section">
            <div class="section-heading">Order Items</div>
            <table class="items">
                <thead>
                    <tr>
                        <th style="width:4%;">#</th>
                        <th style="width:34%;">Product</th>
                        <th class="c" style="width:12%;">Qty</th>
                        <th class="c" style="width:14%;">Received</th>
                        <th class="r" style="width:16%;">Unit Cost</th>
                        <th class="r" style="width:20%;">Total</th>
                    </tr>
                </thead>
                <tbody>
                    @forelse($po->items as $index => $item)
                    <tr>
                        <td>{{ $index + 1 }}</td>
                        <td class="bold">
                            {{ $item->product->name ?? 'N/A' }}
                            @if($item->product?->sku)
                            <div class="item-sub"><strong>SKU:</strong> {{ $item->product->sku }}</div>
                            @endif
                        </td>
                        <td class="c">{{ $item->quantity }}</td>
                        <td class="c">{{ $item->received_qty }}</td>
                        <td class="r">BDT {{ number_format($item->unit_cost, 2) }}</td>
                        <td class="r bold">BDT {{ number_format($item->total_cost, 2) }}</td>
                    </tr>
                    @empty
                    <tr>
                        <td colspan="6" style="text-align:center; color:#000000; padding:20px;">No items recorded.</td>
                    </tr>
                    @endforelse
                </tbody>
            </table>
        </div>

        {{-- TOTALS --}}
        <div class="estimate-section">
            <div class="estimate-spacer"></div>
            <div class="estimate-block">
                <div class="estimate-box">
                    <div class="estimate-row">
                        <div class="estimate-lbl">Subtotal</div>
                        <div class="estimate-val">BDT {{ number_format($po->subtotal, 2) }}</div>
                    </div>
                    <div class="estimate-row">
                        <div class="estimate-lbl">Tax</div>
                        <div class="estimate-val">BDT {{ number_format($po->tax, 2) }}</div>
                    </div>
                    <div class="estimate-row">
                        <div class="estimate-lbl">Shipping</div>
                        <div class="estimate-val">BDT {{ number_format($po->shipping_cost, 2) }}</div>
                    </div>
                    <div class="estimate-total-row">
                        <div class="estimate-total-lbl">Total</div>
                        <div class="estimate-total-val">BDT {{ number_format($po->total, 2) }}</div>
                    </div>
                </div>
            </div>
        </div>

        {{-- NOTES --}}
        @if($po->notes)
        <div class="notes-section">
            <div class="notes-title">Notes</div>
            <div class="notes-text">{{ $po->notes }}</div>
        </div>
        @endif

        {{-- FOOTER — fixed to the page bottom, see .page-footer-fixed --}}
        <div class="page-footer-fixed">
            <div class="invoice-footer">
                <div class="footer-left">
                    <div class="footer-brand">{{ $settings['footer_brand'] ?? 'Gadget Revive Bangladesh Ltd.' }}</div>
                    <div class="footer-sub">
                        {{ $settings['footer_address'] ?? '' }}<br>
                        Phone: {{ $settings['footer_phone'] ?? '' }} | Email: {{ $settings['footer_email'] ?? '' }}
                    </div>
                </div>
                <div class="footer-right">
                    <div class="footer-ref-label">PO Reference</div>
                    <div class="footer-ref-code">{{ $po->po_number }}</div>
                    <div class="footer-timestamp">Generated: {{ now()->format('d M Y, h:i A') }}</div>
                </div>
            </div>

            <div class="legal">
                This document is a purchase order issued to the above supplier and does not constitute a payment receipt.
                &copy; {{ date('Y') }} {{ $settings['legal_entity'] ?? 'Gadget Revive Bangladesh Ltd.' }}. All rights reserved.
            </div>
        </div>

    </div>{{-- /body-wrap --}}
</div>{{-- /page-bg --}}
</body>
</html>
