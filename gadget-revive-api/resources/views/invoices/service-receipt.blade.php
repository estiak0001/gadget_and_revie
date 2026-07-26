<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Service Receipt {{ $intake->receipt_number }}</title>

    <style>
        @page { size: A4; margin: 12mm 10mm; }

        * { margin: 0; padding: 0; box-sizing: border-box; }

        body {
            font-family: 'DejaVu Sans', Arial, sans-serif;
            font-size: 15.5px;
            line-height: 1.6;
            color: #000000;
            background-color: #ffffff;
        }

        /* Keep these blocks from being awkwardly split across a page break */
        table.items tr,
        .estimate-section,
        .signature-section,
        .invoice-footer { page-break-inside: avoid; }

        .page-bg { background: #ffffff; min-height: 100%; padding: 0; }

        /* ── HEADER (dark band) ──────────────────────── */
        .invoice-header {
            background: #111827;
            padding: 16px 32px;
            display: table;
            width: 100%;
        }
        .header-left  { display: table-cell; vertical-align: middle; width: 52%; }
        .header-right { display: table-cell; vertical-align: middle; text-align: right; width: 48%; }

        .brand-row { display: table; }
        .brand-logo-cell { display: table-cell; vertical-align: middle; padding-right: 16px; }
        .brand-logo-cell img { height: 52px; width: auto; }
        .brand-monogram {
            background: #ffffff; color: #000000; font-size: 21px; font-weight: 900;
            width: 52px; height: 52px; border-radius: 8px; text-align: center; line-height: 52px;
            letter-spacing: -1px;
        }
        .brand-text-cell { display: table-cell; vertical-align: middle; }
        .brand-name { font-size: 27px; font-weight: 900; color: #ffffff; letter-spacing: 0.5px; line-height: 1.15; }
        .brand-motto {
            font-size: 11px; color: #c7c7c7; font-weight: 400; letter-spacing: 2px;
            text-transform: uppercase; margin-top: 4px;
        }

        .company-contact { font-size: 12px; color: #e2e2e2; line-height: 1.75; }
        .company-contact .cc-name { font-size: 14px; font-weight: 700; color: #ffffff; margin-bottom: 3px; }

        /* ── META STRIPE ─────────────────────────────── */
        .meta-stripe { background: #f3f4f6; padding: 8px 32px; display: table; width: 100%; }
        .stripe-cell {
            display: table-cell; vertical-align: middle; color: #000000; font-size: 13px;
            font-weight: 700; letter-spacing: 0.5px; text-transform: uppercase; width: 34%;
        }
        .stripe-cell.center { text-align: center; width: 32%; }
        .stripe-cell.right  { text-align: right; }
        .stripe-cell .lbl { color: #000000; font-weight: 400; }
        .doc-pill {
            display: inline-block; background: #111111; color: #ffffff; padding: 6px 24px;
            border-radius: 14px; font-size: 14px; font-weight: 900; letter-spacing: 2px;
        }

        /* ── BODY ────────────────────────────────────── */
        .body-wrap { padding: 16px 32px; background: #ffffff; }

        .parties-table { display: table; width: 100%; margin-bottom: 12px; }
        .party-cell { display: table-cell; width: 50%; vertical-align: top; }
        .party-cell-right { display: table-cell; width: 50%; vertical-align: top; padding-left: 5%; }
        .party-label {
            font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1.5px;
            color: #000000; padding-bottom: 4px; margin-bottom: 6px;
        }
        .party-name { font-size: 17px; font-weight: 700; color: #000000; margin-bottom: 4px; }
        .party-detail { font-size: 14px; color: #000000; margin-bottom: 2px; line-height: 1.4; }
        .party-detail strong { color: #000000; }

        /* ── META INFO GRID ──────────────────────────── */
        .meta-section {
            background: #f6f6f6; border-radius: 5px;
            padding: 8px 0; margin-bottom: 12px;
        }
        .meta-inner { display: table; width: 100%; }
        .meta-item {
            display: table-cell; text-align: center; vertical-align: middle;
            padding: 4px 8px;
        }
        .meta-key {
            font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.8px;
            color: #000000; margin-bottom: 2px;
        }
        .meta-value { font-size: 16px; font-weight: 700; color: #000000; }

        /* ── SECTION HEADING ─────────────────────────── */
        .section-heading {
            font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 1.5px;
            color: #000000; margin-bottom: 6px;
        }

        /* ── ITEMS TABLE ─────────────────────────────── */
        .items-section { margin-bottom: 12px; }
        table.items { width: 100%; border-collapse: collapse; border: 1px solid #000000; }
        table.items thead tr { background: #eceef1; }
        table.items thead th {
            padding: 7px 8px; font-size: 12.5px; font-weight: 700; text-transform: uppercase;
            letter-spacing: 0.8px; color: #000000; text-align: left; border: 1px solid #000000;
        }
        table.items thead th.r { text-align: right; }
        table.items thead th.c { text-align: center; }
        table.items tbody tr { border-bottom: 1px solid #000000; }
        table.items tbody tr:nth-child(even) { background: #f6f6f6; }
        table.items tbody td { padding: 6px 8px; font-size: 14px; color: #000000; vertical-align: top; line-height: 1.35; border: 1px solid #000000; }
        table.items tbody td.c { text-align: center; }
        table.items tbody td.bold { font-weight: 700; color: #000000; }
        .item-sub { font-size: 12px; color: #000000; margin-top: 2px; line-height: 1.35; }
        .item-sub strong { color: #000000; }
        .serial-cell { font-family: 'DejaVu Sans Mono', monospace; font-size: 13px; color: #000000; }

        /* ── ESTIMATE BOX ────────────────────────────── */
        .estimate-section { display: table; width: 100%; margin-bottom: 12px; }
        .estimate-spacer { display: table-cell; width: 48%; }
        .estimate-block  { display: table-cell; width: 52%; vertical-align: top; }
        .estimate-row {
            display: table; width: 100%; padding: 3px 4px;
        }
        .estimate-lbl { display: table-cell; font-size: 14px; color: #000000; }
        .estimate-val { display: table-cell; text-align: right; font-size: 14px; font-weight: 600; color: #000000; }
        .estimate-total-row { border-top: 1.5px solid #9ca3af; padding: 4px 8px 2px; display: table; width: 100%; }
        .estimate-total-lbl {
            display: table-cell; font-size: 16px; font-weight: 700; color: #000000;
            text-transform: uppercase; letter-spacing: 0.5px; vertical-align: middle;
        }
        .estimate-total-val { display: table-cell; text-align: right; font-size: 24px; font-weight: 900; color: #000000; vertical-align: middle; }
        .estimate-note { font-size: 10.5px; color: #000000; margin-top: 5px; font-style: italic; text-align: right; }

        /* ── NOTES ───────────────────────────────────── */
        .notes-section {
            background: #f6f6f6; border-radius: 5px; padding: 8px 14px; margin-bottom: 12px;
        }
        .notes-title {
            font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px;
            color: #000000; margin-bottom: 5px;
        }
        .notes-text { font-size: 14px; color: #000000; line-height: 1.5; }

        /* ── SIGNATURE SECTION ───────────────────────── */
        .signature-section { display: table; width: 100%; margin: 20px 0 10px; }
        .sig-cell { display: table-cell; width: 33.33%; vertical-align: bottom; text-align: center; padding: 24px 14px 0; }
        .sig-line { border-top: 1px dotted #000000; margin: 0 auto 10px; height: 1px; }
        .sig-label {
            font-size: 15px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.8px; color: #000000;
        }

        /* ── TERMS BANNER ────────────────────────────── */
        .terms-banner {
            background: #f3f4f6; color: #000000; text-align: center;
            font-size: 15px; font-weight: 700;
            letter-spacing: 0.3px; padding: 8px 16px; border-radius: 4px; margin-bottom: 8px;
        }
        .terms-text { font-size: 14px; color: #000000; line-height: 1.5; text-align: justify; margin-bottom: 10px; }

        /* ── FOOTER ──────────────────────────────────── */
        .invoice-footer {
            margin-top: 10px; padding-top: 10px; display: table; width: 100%;
        }
        .footer-left { display: table-cell; vertical-align: middle; width: 60%; }
        .footer-right { display: table-cell; vertical-align: middle; text-align: right; width: 40%; }
        .footer-brand { font-size: 14.5px; font-weight: 700; color: #000000; margin-bottom: 3px; }
        .footer-sub { font-size: 13px; color: #000000; line-height: 1.7; }
        .footer-ref-label {
            font-size: 11.5px; color: #000000; text-transform: uppercase; letter-spacing: 0.8px; margin-bottom: 3px;
        }
        .footer-ref-code { font-size: 14.5px; font-weight: 700; color: #000000; letter-spacing: 1px; }
        .footer-timestamp { font-size: 12px; color: #000000; margin-top: 4px; }
        .legal { text-align: center; font-size: 12px; color: #000000; margin-top: 8px; font-style: italic; }
    </style>
</head>
<body>
<div class="page-bg">

    @php
        $branch = $intake->branchLocation;
        $companyName = $branch->name ?? ($settings['footer_brand'] ?? 'Gadget Revive Bangladesh Ltd.');
        $companyAddress = $branch->address ?? ($settings['address'] ?? '');
        $companyPhone = $branch->phone ?? ($settings['phone'] ?? '');
        $companyEmail = $branch->email ?? ($settings['email'] ?? '');
        $hasEstimate = $intake->items->sum(fn ($i) => (float) ($i->estimated_price ?? 0) * (int) $i->quantity) > 0
            || (float) ($intake->estimated_cost ?? 0) > 0;
        $itemsEstimate = $intake->items->sum(fn ($i) => (float) ($i->estimated_price ?? 0) * (int) $i->quantity);
        $estimateTotal = $itemsEstimate > 0 ? $itemsEstimate : (float) ($intake->estimated_cost ?? 0);
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
            <span class="lbl">Rcv ID:</span> {{ $intake->receipt_number }}
        </div>
        <div class="stripe-cell center">
            <span class="doc-pill">SERVICE RECEIPT</span>
        </div>
        <div class="stripe-cell right">
            <span class="lbl">Date:</span> {{ optional($intake->received_at)->format('d/m/Y') }}
        </div>
    </div>

    {{-- ═══════════════════ BODY ═══════════════════ --}}
    <div class="body-wrap">

        {{-- RECEIVED FROM / RECEIVED BY --}}
        <div class="parties-table">
            <div class="party-cell">
                <div class="party-label">Received From (Customer)</div>
                <div class="party-name">{{ $intake->customer_name ?? 'Walk-in Customer' }}</div>
                @if($intake->customer_phone)
                <div class="party-detail"><strong>Mobile:</strong> {{ $intake->customer_phone }}</div>
                @endif
                @if($intake->customer_email)
                <div class="party-detail"><strong>Email:</strong> {{ $intake->customer_email }}</div>
                @endif
                @if($intake->customer_address)
                <div class="party-detail"><strong>Address:</strong> {{ $intake->customer_address }}</div>
                @endif
                @php
                    $location = collect([
                        $intake->area?->name,
                        $intake->district?->name,
                        $intake->division?->name,
                    ])->filter()->join(', ');
                @endphp
                @if($location)
                <div class="party-detail">{{ $location }}</div>
                @endif
            </div>
            <div class="party-cell-right">
                <div class="party-label">Received At</div>
                <div class="party-name">{{ $companyName }}</div>
                @if($companyAddress)
                <div class="party-detail">{{ $companyAddress }}</div>
                @endif
                @if($companyPhone)
                <div class="party-detail"><strong>Mobile:</strong> {{ $companyPhone }}</div>
                @endif
            </div>
        </div>

        {{-- META INFO GRID --}}
        <div class="meta-section">
            <div class="meta-inner">
                <div class="meta-item">
                    <div class="meta-key">Receipt No</div>
                    <div class="meta-value">{{ $intake->receipt_number }}</div>
                </div>
                <div class="meta-item">
                    <div class="meta-key">Received Date</div>
                    <div class="meta-value">{{ optional($intake->received_at)->format('d M Y') }}</div>
                </div>
                <div class="meta-item">
                    <div class="meta-key">Expected Delivery</div>
                    <div class="meta-value">{{ $intake->expected_delivery_at ? $intake->expected_delivery_at->format('d M Y') : '—' }}</div>
                </div>
                <div class="meta-item">
                    <div class="meta-key">Status</div>
                    <div class="meta-value">{{ ucfirst(str_replace('_', ' ', $intake->status)) }}</div>
                </div>
            </div>
        </div>

        {{-- ITEMS TABLE --}}
        <div class="items-section">
            <div class="section-heading">Received Items</div>
            <table class="items">
                <thead>
                    <tr>
                        <th style="width:4%;">#</th>
                        <th style="width:40%;">Item / Device</th>
                        <th style="width:22%;">Serial No.</th>
                        <th class="c" style="width:6%;">Qty</th>
                        <th style="width:28%;">Problem Reported</th>
                    </tr>
                </thead>
                <tbody>
                    @forelse($intake->items as $index => $item)
                    <tr>
                        <td>{{ $index + 1 }}</td>
                        <td class="bold">
                            {{ $item->item_name }}
                            @if($item->accessories)
                            <div class="item-sub"><strong>Accessories:</strong> {{ $item->accessories }}</div>
                            @endif
                            @if($item->condition_notes)
                            <div class="item-sub"><strong>Condition:</strong> {{ $item->condition_notes }}</div>
                            @endif
                        </td>
                        <td class="serial-cell">{{ $item->serial_number ?: '—' }}</td>
                        <td class="c">{{ $item->quantity }}</td>
                        <td>{{ $item->problem_reported ?: '—' }}</td>
                    </tr>
                    @empty
                    <tr>
                        <td colspan="5" style="text-align:center; color:#000000; padding:20px;">No items recorded.</td>
                    </tr>
                    @endforelse
                </tbody>
            </table>
        </div>

        {{-- ESTIMATE (only if any price provided) --}}
        @if($hasEstimate)
        <div class="estimate-section">
            <div class="estimate-spacer"></div>
            <div class="estimate-block">
                <div class="estimate-box">
                    @if($itemsEstimate > 0)
                    <div class="estimate-row">
                        <div class="estimate-lbl">Items Estimate</div>
                        <div class="estimate-val">BDT {{ number_format($itemsEstimate, 2) }}</div>
                    </div>
                    @endif
                    <div class="estimate-total-row">
                        <div class="estimate-total-lbl">Estimated Cost</div>
                        <div class="estimate-total-val">BDT {{ number_format($estimateTotal, 2) }}</div>
                    </div>
                </div>
                <div class="estimate-note">Estimate only — final charges confirmed after diagnosis.</div>
            </div>
        </div>
        @endif

        {{-- NOTES --}}
        @if($intake->notes)
        <div class="notes-section">
            <div class="notes-title">Notes</div>
            <div class="notes-text">{{ $intake->notes }}</div>
        </div>
        @endif

        {{-- SIGNATURE SECTION --}}
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

        {{-- FOOTER --}}
        <div class="invoice-footer">
            <div class="footer-left">
                <div class="footer-brand">{{ $settings['footer_brand'] ?? 'Gadget Revive Bangladesh Ltd.' }}</div>
                <div class="footer-sub">
                    {{ $settings['footer_address'] ?? '' }}<br>
                    Phone: {{ $settings['footer_phone'] ?? '' }} | Email: {{ $settings['footer_email'] ?? '' }}
                </div>
            </div>
            <div class="footer-right">
                <div class="footer-ref-label">Receipt Reference</div>
                <div class="footer-ref-code">{{ $intake->receipt_number }}</div>
                <div class="footer-timestamp">Generated: {{ now()->format('d M Y, h:i A') }}</div>
            </div>
        </div>

        <div class="legal">
            This service receipt acknowledges receipt of the above item(s) for service.
            &copy; {{ date('Y') }} {{ $settings['legal_entity'] ?? 'Gadget Revive Bangladesh Ltd.' }}. All rights reserved.
        </div>

    </div>{{-- /body-wrap --}}
</div>{{-- /page-bg --}}
</body>
</html>
