<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Delivery Chalan {{ $chalanNumber }}</title>

    <style>
        @page { size: A4; margin: 12mm 10mm; }
        * { margin: 0; padding: 0; box-sizing: border-box; }

        body {
            font-family: 'DejaVu Sans', Arial, sans-serif;
            font-size: 17px;
            line-height: 1.6;
            color: #000000;
            background-color: #ffffff;
            /* Blueprint/graph-paper grid — a technical, drafting-table feel, kept neutral grey so
               it reads as texture, not as one of the "few" deliberate color accents. */
            background-image:
                linear-gradient(#e5e7eb 1px, transparent 1px),
                linear-gradient(90deg, #e5e7eb 1px, transparent 1px);
            background-size: 26px 26px;
        }

        table.items tr, .signature-section, .chalan-footer { page-break-inside: avoid; }

        /* Deliberately no position:relative here — dompdf anchors position:fixed descendants to
           the page box only when nothing in the ancestor chain establishes its own positioning
           context; adding one here silently breaks the fixed footer below. */
        .page-bg { min-height: 100%; }

        /* Soft accent-colored glow, tucked entirely into the blank area below the signature
           section so it never sits behind any text — the previous two flat grey circles
           overlapped the header/party info and read as a rendering glitch rather than a
           deliberate design. One shape, the document's own accent color, mostly off-page. */
        .bg-accent {
            position: fixed; border-radius: 50%; background: #92400e; opacity: 0.05; z-index: 0;
            width: 460px; height: 460px; bottom: -180px; left: -160px;
        }
        /* Watermark logo, tucked in the same blank lower area on the opposite side. */
        .watermark-logo {
            position: fixed; bottom: 20px; right: -40px; width: 420px; height: auto;
            opacity: 0.06; z-index: 0;
        }

        /* ── HEADER — black & white, the accent color lives only in the border/pill ── */
        .invoice-header {
            background: #ffffff; border-bottom: 4px solid #92400e; padding: 20px 32px;
            display: table; width: 100%; position: relative; z-index: 1;
        }
        .header-left { display: table-cell; vertical-align: middle; width: 52%; }
        .header-right { display: table-cell; vertical-align: middle; text-align: right; width: 48%; }
        .brand-row { display: table; }
        .brand-logo-cell { display: table-cell; vertical-align: middle; padding-right: 16px; }
        .brand-logo-cell img { height: 62px; width: auto; }
        .brand-monogram {
            background: #000000; color: #ffffff; font-size: 21px; font-weight: 900;
            width: 62px; height: 62px; border-radius: 8px; text-align: center;
            line-height: 62px; letter-spacing: -1px;
        }
        .brand-text-cell { display: table-cell; vertical-align: middle; }
        .brand-name { font-size: 27px; font-weight: 900; color: #000000; letter-spacing: 0.5px; line-height: 1.15; }
        .brand-motto {
            font-size: 12.5px; color: #6b7280; font-weight: 400; letter-spacing: 2px;
            text-transform: uppercase; margin-top: 4px;
        }
        .company-contact { font-size: 13.5px; color: #374151; line-height: 1.75; }
        .company-contact .cc-name { font-size: 15.5px; font-weight: 700; color: #000000; margin-bottom: 3px; }

        /* ── META STRIPE ─────────────────────────────── */
        .meta-stripe { background: #f3f4f6; padding: 8px 32px; display: table; width: 100%; position: relative; z-index: 1; }
        .stripe-cell {
            display: table-cell; vertical-align: middle; color: #000000; font-size: 14.5px;
            font-weight: 700; letter-spacing: 0.5px; text-transform: uppercase; width: 34%;
        }
        .stripe-cell.center { text-align: center; width: 32%; }
        .stripe-cell.right { text-align: right; }
        .stripe-cell .lbl { font-weight: 400; }
        .doc-pill {
            display: inline-block; background: #92400e; color: #ffffff; padding: 6px 24px;
            border-radius: 14px; font-size: 15.5px; font-weight: 900; letter-spacing: 2px;
        }

        /* ── BODY ────────────────────────────────────── */
        /* Bottom padding clears space for the fixed footer, so content never runs under it. */
        .body-wrap { padding: 16px 32px 42mm; position: relative; z-index: 1; }

        .parties-table { display: table; width: 100%; margin-bottom: 14px; }
        .party-cell { display: table-cell; width: 50%; vertical-align: top; }
        .party-cell-right { display: table-cell; width: 50%; vertical-align: top; padding-left: 5%; }
        .party-label {
            font-size: 12.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 1.5px;
            color: #000000; padding-bottom: 4px; margin-bottom: 6px;
        }
        .party-name { font-size: 18.5px; font-weight: 700; color: #000000; margin-bottom: 4px; }
        .party-detail { font-size: 15.5px; color: #000000; margin-bottom: 2px; line-height: 1.4; }
        .party-detail strong { color: #000000; }

        .against-line {
            background: #f6f6f6; border: 1px solid #92400e; border-radius: 5px; padding: 10px 14px; margin-bottom: 14px;
            font-size: 16px; color: #000000;
        }
        .against-line strong { color: #000000; }

        /* ── ITEMS TABLE ─────────────────────────────── */
        .items-section { margin-bottom: 14px; }
        table.items { width: 100%; border-collapse: collapse; border: 1px solid #000000; }
        table.items thead tr { background: #eceef1; }
        table.items thead th {
            padding: 7px 8px; font-size: 14px; font-weight: 700; text-transform: uppercase;
            letter-spacing: 0.8px; color: #000000; text-align: left; border: 1px solid #000000;
        }
        table.items thead th.c { text-align: center; }
        table.items tbody tr { border-bottom: 1px solid #000000; }
        table.items tbody tr:nth-child(even) { background: #f6f6f6; }
        table.items tbody td {
            padding: 7px 8px; font-size: 15.5px; color: #000000; vertical-align: top;
            line-height: 1.35; border: 1px solid #000000;
        }
        table.items tbody td.c { text-align: center; }
        table.items tbody td.bold { font-weight: 700; color: #000000; }
        .item-sub { font-size: 13.5px; color: #000000; margin-top: 2px; line-height: 1.35; }
        .item-sub strong { color: #000000; }

        .qty-total-row { display: table; width: 100%; margin-bottom: 16px; }
        .qty-total-spacer { display: table-cell; width: 65%; }
        .qty-total-block { display: table-cell; width: 35%; }
        .qty-total-inner {
            display: table; width: 100%; border-top: 2px solid #92400e; padding-top: 5px;
        }
        .qty-total-lbl { display: table-cell; font-size: 16px; font-weight: 700; text-transform: uppercase; }
        .qty-total-val { display: table-cell; text-align: right; font-size: 20px; font-weight: 900; color: #92400e; }

        .declaration {
            font-size: 14.5px; color: #000000; line-height: 1.5; margin-bottom: 8px;
            font-style: italic;
        }

        /* ── SIGNATURE SECTION ───────────────────────── */
        .signature-section { display: table; width: 100%; margin: 30px 0 10px; }
        .sig-cell { display: table-cell; width: 50%; vertical-align: bottom; text-align: center; padding: 45px 14px 0; }
        .sig-line { border-top: 1px dotted #000000; margin: 0 auto 10px; height: 1px; }
        .sig-label { font-size: 16.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.8px; color: #000000; }

        /* ── FOOTER ──────────────────────────────────── */
        /* Fixed to the page's bottom margin box so it always sits flush with the bottom of every
           page. dompdf doesn't reliably combine position:fixed and display:table on the same
           element, so the fixed positioning lives on this plain outer wrapper, with the table
           layout on the child. */
        .page-footer-fixed { position: fixed; bottom: 0; left: 0; right: 0; z-index: 2; background: #ffffff; }
        .chalan-footer {
            padding: 10px 32px 0; border-top: 2px solid #92400e;
            display: table; width: 100%;
        }
        .legal { padding: 0 32px 10px; }
        .footer-left { display: table-cell; vertical-align: middle; width: 60%; }
        .footer-right { display: table-cell; vertical-align: middle; text-align: right; width: 40%; }
        .footer-brand { font-size: 16.5px; font-weight: 700; color: #000000; margin-bottom: 3px; }
        .footer-sub { font-size: 15px; color: #000000; line-height: 1.7; }
        .footer-ref-label { font-size: 13.5px; color: #000000; text-transform: uppercase; letter-spacing: 0.8px; margin-bottom: 3px; }
        .footer-ref-code { font-size: 16.5px; font-weight: 700; color: #92400e; letter-spacing: 1px; }
        .footer-timestamp { font-size: 14px; color: #000000; margin-top: 4px; }
        .legal { text-align: center; font-size: 14px; color: #000000; margin-top: 8px; font-style: italic; }
    </style>
</head>
<body>
<div class="page-bg">

    <div class="bg-accent"></div>
    @if(!empty($settings['logo_black']))
        <img class="watermark-logo" src="{{ $settings['logo_black'] }}" alt="">
    @endif

    {{-- ═══════════════════ HEADER ═══════════════════ --}}
    <div class="invoice-header">
        <div class="header-left">
            <div class="brand-row">
                <div class="brand-logo-cell">
                    @if(!empty($settings['logo_black']))
                        <img src="{{ $settings['logo_black'] }}" alt="logo">
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
            </div>
        </div>
    </div>

    {{-- ═══════════════════ META STRIPE ═══════════════════ --}}
    <div class="meta-stripe">
        <div class="stripe-cell">
            <span class="lbl">Chalan No:</span> {{ $chalanNumber }}
        </div>
        <div class="stripe-cell center">
            <span class="doc-pill">DELIVERY CHALAN</span>
        </div>
        <div class="stripe-cell right">
            <span class="lbl">Date:</span> {{ now()->format('d/m/Y') }}
        </div>
    </div>

    {{-- ═══════════════════ BODY ═══════════════════ --}}
    <div class="body-wrap">

        <div class="parties-table">
            <div class="party-cell">
                <div class="party-label">Delivered From</div>
                <div class="party-name">{{ $settings['footer_brand'] ?? 'Gadget Revive Bangladesh Ltd.' }}</div>
                <div class="party-detail">{{ $settings['address'] ?? '' }}</div>
                <div class="party-detail"><strong>Mobile:</strong> {{ $settings['phone'] ?? '' }}</div>
            </div>
            <div class="party-cell-right">
                <div class="party-label">Delivered To</div>
                <div class="party-name">{{ $order->customer_name ?? ($order->customer?->name ?? 'Valued Customer') }}</div>
                @if($order->customer_phone)
                <div class="party-detail"><strong>Mobile:</strong> {{ $order->customer_phone }}</div>
                @endif
                @if($order->customer_address)
                <div class="party-detail"><strong>Address:</strong> {{ $order->customer_address }}</div>
                @endif
                @php
                    $location = collect([$order->area?->name, $order->district?->name, $order->division?->name])->filter()->join(', ');
                @endphp
                @if($location)
                <div class="party-detail">{{ $location }}</div>
                @endif
            </div>
        </div>

        <div class="against-line">
            <strong>Particulars:</strong> Goods delivered against Order #{{ $order->order_number }} — for verification of items and quantity only; no prices shown. See Invoice for billing details.
        </div>

        {{-- ITEMS TABLE — no prices, delivery/quantity verification only --}}
        <div class="items-section">
            <table class="items">
                <thead>
                    <tr>
                        <th style="width:6%;">#</th>
                        <th style="width:54%;">Item Description</th>
                        <th style="width:25%;">Serial / Reference No.</th>
                        <th class="c" style="width:15%;">Qty</th>
                    </tr>
                </thead>
                <tbody>
                    @php $totalQty = 0; @endphp
                    @forelse($order->items as $index => $item)
                    @php
                        $totalQty += $item->quantity;
                        $realSerials = $item->relationLoaded('serials')
                            ? $item->serials->pluck('serial_number')->filter()->implode(', ')
                            : '';
                        // Legacy orders (created before serial tracking existed) sometimes have the
                        // serial typed straight into the free-text notes field instead, e.g.
                        // "S/N: GS089062 warranty:3 month" — pull it into the real column instead
                        // of leaving it to show up as noise under the item name too.
                        $noteSerial = null;
                        if (!$realSerials && $item->notes && preg_match('/S\/N:\s*(.+?)(?=\s*\(|\s+warranty|$)/i', $item->notes, $m)) {
                            $noteSerial = trim($m[1]);
                        }
                        $serialDisplay = $realSerials ?: ($noteSerial ?: ($item->item_type === 'service' ? $item->item_sku : ''));
                    @endphp
                    <tr>
                        <td>{{ $index + 1 }}</td>
                        <td class="bold">
                            {{ $item->item_name }}
                            @if($item->notes && !$noteSerial)
                            <div class="item-sub"><strong>Note:</strong> {{ $item->notes }}</div>
                            @endif
                        </td>
                        <td>{{ $serialDisplay ?: '—' }}</td>
                        <td class="c bold">{{ $item->quantity }}</td>
                    </tr>
                    @empty
                    <tr>
                        <td colspan="4" style="text-align:center; color:#000000; padding:20px;">No items found.</td>
                    </tr>
                    @endforelse
                </tbody>
            </table>
        </div>

        <div class="qty-total-row">
            <div class="qty-total-spacer"></div>
            <div class="qty-total-block">
                <div class="qty-total-inner">
                    <div class="qty-total-lbl">Total Qty</div>
                    <div class="qty-total-val">{{ $totalQty }}</div>
                </div>
            </div>
        </div>

        <div class="declaration">
            I/We hereby acknowledge having received the above-listed goods/items in good condition and in the correct quantity.
        </div>

        {{-- SIGNATURE SECTION --}}
        <div class="signature-section">
            <div class="sig-cell">
                <div class="sig-line"></div>
                <div class="sig-label">Delivered By</div>
            </div>
            <div class="sig-cell">
                <div class="sig-line"></div>
                <div class="sig-label">Received By (Customer Signature)</div>
            </div>
        </div>

    </div>{{-- /body-wrap --}}

    {{-- FOOTER --}}
    <div class="page-footer-fixed">
        <div class="chalan-footer">
            <div class="footer-left">
                <div class="footer-brand">{{ $settings['footer_brand'] ?? 'Gadget Revive Bangladesh Ltd.' }}</div>
                <div class="footer-sub">
                    {{ $settings['footer_address'] ?? '' }}<br>
                    Phone: {{ $settings['footer_phone'] ?? '' }} | Email: {{ $settings['footer_email'] ?? '' }}
                </div>
            </div>
            <div class="footer-right">
                <div class="footer-ref-label">Against Order</div>
                <div class="footer-ref-code">{{ $order->order_number }}</div>
                <div class="footer-timestamp">Generated: {{ now()->format('d M Y, h:i A') }}</div>
            </div>
        </div>

        <div class="legal">
            This is a computer-generated delivery chalan and does not require a physical signature to be valid.
            &copy; {{ date('Y') }} {{ $settings['legal_entity'] ?? 'Gadget Revive Bangladesh Ltd.' }}. All rights reserved.
        </div>
    </div>
</div>{{-- /page-bg --}}
</body>
</html>
