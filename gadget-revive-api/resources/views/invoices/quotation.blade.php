<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Quotation {{ $quotation->quotation_number }}</title>

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

        .page-bg { background: #ffffff; min-height: 100%; padding: 0; }

        /* ── HEADER — brand lockup on the left, a large document title with its own
               quotation-no/date/valid-until block on the right. Single band, no second
               "meta stripe" underneath repeating the same numbers. ──────────────── */
        .doc-header {
            padding: 24px 32px 18px;
            display: table;
            width: 100%;
            border-bottom: 3px solid #1d4ed8;
        }
        .doc-header-left  { display: table-cell; vertical-align: top; width: 55%; }
        .doc-header-right { display: table-cell; vertical-align: top; width: 45%; text-align: right; }

        .brand-row { display: table; }
        .brand-logo-cell { display: table-cell; vertical-align: middle; padding-right: 14px; }
        .brand-logo-cell img { height: 50px; width: auto; }
        .brand-monogram {
            background: #1d4ed8; color: #ffffff; font-size: 20px; font-weight: 900;
            width: 50px; height: 50px; border-radius: 8px; text-align: center; line-height: 50px;
            letter-spacing: -1px;
        }
        .brand-text-cell { display: table-cell; vertical-align: middle; }
        .brand-name { font-size: 25px; font-weight: 900; color: #000000; letter-spacing: 0.3px; line-height: 1.15; }
        .brand-motto {
            font-size: 11.5px; color: #6b7280; font-weight: 600; letter-spacing: 1.8px;
            text-transform: uppercase; margin-top: 3px;
        }

        .doc-title {
            font-size: 36px; font-weight: 900; color: #1d4ed8; letter-spacing: 1.5px;
            text-transform: uppercase; line-height: 1;
        }

        .doc-meta-table { display: table; margin-left: auto; margin-top: 12px; border-collapse: collapse; }
        .doc-meta-row { display: table-row; }
        .doc-meta-label {
            display: table-cell; text-align: left; font-size: 12px; color: #6b7280;
            text-transform: uppercase; letter-spacing: 0.6px; white-space: nowrap;
            padding: 2px 16px 2px 0; vertical-align: middle;
        }
        .doc-meta-value {
            display: table-cell; text-align: right; font-size: 14.5px; font-weight: 700;
            color: #000000; white-space: nowrap; padding: 2px 0; vertical-align: middle;
        }
        .doc-meta-value.accent { color: #1d4ed8; }

        /* ── BODY ────────────────────────────────────── */
        .body-wrap { padding: 16px 32px; padding-bottom: 34mm; background: #ffffff; }

        /* ── FROM / PREPARED FOR ─────────────────────── */
        .parties-table { display: table; width: 100%; margin-bottom: 12px; }
        .party-cell { display: table-cell; width: 50%; vertical-align: top; }
        .party-cell-right { display: table-cell; width: 50%; vertical-align: top; padding-left: 5%; }
        .party-label {
            font-size: 12.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 1.5px;
            color: #1d4ed8; padding-bottom: 4px; margin-bottom: 6px;
        }
        .party-name { font-size: 18.5px; font-weight: 700; color: #000000; margin-bottom: 4px; }
        .party-detail { font-size: 15.5px; color: #000000; margin-bottom: 2px; line-height: 1.4; }
        .party-detail strong { color: #000000; }

        /* ── SECTION HEADING ─────────────────────────── */
        .section-heading {
            font-size: 14.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 1.5px;
            color: #000000; margin-bottom: 6px;
        }

        /* ── ITEMS TABLE ─────────────────────────────── */
        .items-section { margin-bottom: 12px; }

        table.items { width: 100%; border-collapse: collapse; }
        table.items thead tr { background: #eff6ff; }
        table.items thead tr.thead-spacer { background: transparent; }
        table.items thead tr.thead-spacer td { border: none; padding: 0; height: 20pt; }
        table.items thead th {
            padding: 7px 8px; font-size: 14px; font-weight: 700; text-transform: uppercase;
            letter-spacing: 0.8px; color: #000000; text-align: left; border: 1px solid #000000;
        }
        table.items thead th.r { text-align: right; }
        table.items thead th.c { text-align: center; }

        table.items tbody tr { border-bottom: 1px solid #000000; }
        table.items tbody tr:nth-child(even) { background: #f6f6f6; }
        table.items tbody td {
            padding: 6px 8px; font-size: 15.5px; color: #000000; vertical-align: top;
            line-height: 1.35; border: 1px solid #000000;
        }
        table.items tbody td.r { text-align: right; }
        table.items tbody td.c { text-align: center; }
        table.items tbody td.bold { font-weight: 700; color: #000000; }

        .item-sub { font-size: 13.5px; color: #4b5563; margin-top: 2px; line-height: 1.35; }
        .item-sub strong { color: #000000; }
        .catalog-tag {
            display: inline-block; background: #eff6ff; color: #1d4ed8; font-size: 11.5px;
            font-weight: 700; padding: 1px 7px; border-radius: 8px; margin-top: 3px;
            text-transform: uppercase; letter-spacing: 0.4px;
        }

        /* ── TOTALS ──────────────────────────────────── */
        .totals-section { display: table; width: 100%; margin-bottom: 12px; }
        .totals-spacer { display: table-cell; width: 48%; }
        .totals-block  { display: table-cell; width: 52%; vertical-align: top; }

        .total-row { display: table; width: 100%; padding: 3px 4px; }
        .total-lbl { display: table-cell; font-size: 15.5px; color: #000000; }
        .total-val { display: table-cell; text-align: right; font-size: 15.5px; font-weight: 600; color: #000000; }

        .grand-total-row {
            border-top: 1.5px solid #1d4ed8; padding: 4px 8px 2px; display: table; width: 100%;
        }
        .grand-total-lbl {
            display: table-cell; font-size: 17.5px; font-weight: 700; color: #000000;
            text-transform: uppercase; letter-spacing: 0.5px; vertical-align: middle;
        }
        .grand-total-val {
            display: table-cell; text-align: right; font-size: 24px; font-weight: 900;
            color: #1d4ed8; vertical-align: middle;
        }

        /* ── NOTES ───────────────────────────────────── */
        .notes-section { background: #f6f6f6; border-radius: 5px; padding: 8px 14px; margin-bottom: 12px; }
        .notes-title {
            font-size: 12.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px;
            color: #000000; margin-bottom: 5px;
        }
        .notes-text { font-size: 15.5px; color: #000000; line-height: 1.5; }

        /* ── SIGNATURE SECTION ───────────────────────── */
        .signature-section { display: table; width: 100%; margin: 28px 0 10px; }
        .sig-cell { display: table-cell; width: 50%; vertical-align: bottom; text-align: center; padding: 45px 14px 0; }
        .sig-line { border-top: 1px dotted #000000; margin: 0 auto 10px; height: 1px; }
        .sig-label { font-size: 16.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.8px; color: #000000; }

        /* ── TERMS BANNER ────────────────────────────── */
        .terms-banner {
            background: #eff6ff; color: #1d4ed8; text-align: center; font-size: 18.5px;
            font-weight: 700; letter-spacing: 0.3px; padding: 8px 16px; border-radius: 4px;
            margin-bottom: 8px;
        }
        .terms-text { font-size: 15.5px; color: #000000; line-height: 1.5; text-align: justify; margin-bottom: 10px; }

        /* ── CORNER LOGO WATERMARK ───────────────────── */
        .corner-mark-shape {
            position: fixed; bottom: -18mm; right: -18mm; width: 100mm; height: 100mm;
            border-radius: 50%; background: #1d4ed8; opacity: 0.035; pointer-events: none;
        }
        .corner-mark-logo { position: fixed; bottom: 6mm; right: 6mm; width: 62mm; pointer-events: none; }
        .corner-mark-logo img { width: 100%; height: auto; opacity: 0.09; }

        /* ── FOOTER — bookends the header's blue rule with its own top border, and swaps the
               old label+bold-text stack for a compact reference "chip" ──────────────── */
        .page-footer-fixed {
            position: fixed; bottom: 0; left: 0; right: 0;
            background: #ffffff; border-top: 2px solid #1d4ed8; padding: 10px 32px 8px;
        }
        .invoice-footer { display: table; width: 100%; }
        .footer-left  { display: table-cell; vertical-align: middle; width: 62%; }
        .footer-right { display: table-cell; vertical-align: middle; text-align: right; width: 38%; }
        .footer-brand { font-size: 15.5px; font-weight: 700; color: #000000; margin-bottom: 2px; }
        .footer-sub { font-size: 13px; color: #6b7280; line-height: 1.6; }
        .footer-ref-chip {
            display: inline-block; background: #eff6ff; color: #1d4ed8; font-weight: 700;
            font-size: 14px; letter-spacing: 0.5px; padding: 4px 12px; border-radius: 6px;
        }
        .footer-timestamp { font-size: 12px; color: #9ca3af; margin-top: 4px; }
        .legal {
            text-align: center; font-size: 12px; color: #9ca3af; margin-top: 8px;
            padding-top: 8px; border-top: 1px solid #e5e7eb; font-style: italic;
        }
    </style>
</head>
<body>

    @php
        $cornerLogo = $settings['logo_black'] ?? $settings['logo_white'] ?? null;
    @endphp

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
                    {{ $settings['footer_phone'] ?? '+880 1800-000000' }} &nbsp;|&nbsp; {{ $settings['footer_email'] ?? 'support@gadgetrevive.com' }}
                </div>
            </div>
            <div class="footer-right">
                <span class="footer-ref-chip">{{ $quotation->quotation_number }}</span>
                <div class="footer-timestamp">Generated {{ now()->format('d M Y, h:i A') }}</div>
            </div>
        </div>

        <div class="legal">
            This is a computer-generated quotation and does not require a physical signature.
            &copy; {{ date('Y') }} {{ $settings['legal_entity'] ?? 'Gadget Revive Bangladesh Ltd.' }}. All rights reserved.
        </div>
    </div>

<div class="page-bg">

    {{-- ═══════════════════ HEADER — brand lockup + document title/meta, one band ═══════════════════ --}}
    <div class="doc-header">
        <div class="doc-header-left">
            <div class="brand-row">
                <div class="brand-logo-cell">
                    @if(!empty($settings['logo_black']))
                        <img src="{{ $settings['logo_black'] }}" alt="logo">
                    @elseif(!empty($settings['logo_white']))
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
        <div class="doc-header-right">
            <div class="doc-title">Quotation</div>
            <div class="doc-meta-table">
                <div class="doc-meta-row">
                    <div class="doc-meta-label">Quotation No</div>
                    <div class="doc-meta-value">{{ $quotation->quotation_number }}</div>
                </div>
                <div class="doc-meta-row">
                    <div class="doc-meta-label">Date</div>
                    <div class="doc-meta-value">{{ $quotation->quotation_date->format('d M Y') }}</div>
                </div>
                <div class="doc-meta-row">
                    <div class="doc-meta-label">Valid Until</div>
                    <div class="doc-meta-value accent">{{ $quotation->valid_until ? $quotation->valid_until->format('d M Y') : '—' }}</div>
                </div>
            </div>
        </div>
    </div>

    {{-- ═══════════════════ BODY ═══════════════════ --}}
    <div class="body-wrap">

        {{-- FROM / PREPARED FOR --}}
        <div class="parties-table">
            <div class="party-cell">
                <div class="party-label">From</div>
                <div class="party-name">{{ $settings['footer_brand'] ?? 'Gadget Revive Bangladesh Ltd.' }}</div>
                <div class="party-detail">{{ $settings['address'] ?? '' }}</div>
                <div class="party-detail"><strong>Mobile:</strong> {{ $settings['phone'] ?? '' }}</div>
                <div class="party-detail"><strong>Email:</strong> {{ $settings['email'] ?? '' }}</div>
            </div>
            <div class="party-cell-right">
                <div class="party-label">Prepared For</div>
                <div class="party-name">{{ $quotation->customer_name ?? 'Valued Customer' }}</div>
                @if($quotation->customer_phone)
                <div class="party-detail"><strong>Mobile:</strong> {{ $quotation->customer_phone }}</div>
                @endif
                @if($quotation->customer_email)
                <div class="party-detail"><strong>Email:</strong> {{ $quotation->customer_email }}</div>
                @endif
                @if($quotation->customer_address)
                <div class="party-detail"><strong>Address:</strong> {{ $quotation->customer_address }}</div>
                @endif
            </div>
        </div>

        {{-- ITEMS TABLE --}}
        <div class="items-section">
            <div class="section-heading">Quoted Items</div>
            <table class="items">
                <thead>
                    <tr class="thead-spacer"><td colspan="5"></td></tr>
                    <tr>
                        <th style="width:4%;">#</th>
                        <th style="width:46%;">Item / Description</th>
                        <th class="r" style="width:16%;">Unit Price (BDT)</th>
                        <th class="c" style="width:8%;">Qty</th>
                        <th class="r" style="width:18%;">Total (BDT)</th>
                    </tr>
                </thead>
                <tbody>
                    @forelse($quotation->items as $index => $item)
                    <tr>
                        <td>{{ $index + 1 }}</td>
                        <td class="bold">
                            {{ $item['item_name'] }}
                            @if(!empty($item['description']))
                            <div class="item-sub">{{ $item['description'] }}</div>
                            @endif
                            {{-- SKU / Serial No. / catalog badge only print when explicitly opted
                                 into per item — keeps the default listing to just the item name,
                                 with room to show identifying codes when the item actually needs
                                 them (e.g. a specific serialized unit). --}}
                            @if(!empty($item['show_details']))
                                @if(!empty($item['item_sku']))
                                <div class="item-sub"><strong>SKU:</strong> {{ $item['item_sku'] }}</div>
                                @endif
                                @if(!empty($item['item_sn']))
                                <div class="item-sub"><strong>S/N:</strong> {{ $item['item_sn'] }}</div>
                                @endif
                                @if(!empty($item['product_id']))
                                <span class="catalog-tag">Catalog Item</span>
                                @endif
                            @endif
                        </td>
                        <td class="r">{{ number_format($item['unit_price'], 2) }}</td>
                        <td class="c">{{ $item['quantity'] }}</td>
                        <td class="r bold">{{ number_format($item['total_price'], 2) }}</td>
                    </tr>
                    @empty
                    <tr>
                        <td colspan="5" style="text-align:center; color:#000000; padding:20px;">No items found.</td>
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
                        <div class="total-val">BDT {{ number_format($quotation->subtotal, 2) }}</div>
                    </div>
                    @if($quotation->tax > 0)
                    <div class="total-row">
                        <div class="total-lbl">Tax / VAT</div>
                        <div class="total-val">BDT {{ number_format($quotation->tax, 2) }}</div>
                    </div>
                    @endif
                    @if($quotation->shipping > 0)
                    <div class="total-row">
                        <div class="total-lbl">Shipping</div>
                        <div class="total-val">BDT {{ number_format($quotation->shipping, 2) }}</div>
                    </div>
                    @endif
                    @if($quotation->discount > 0)
                    <div class="total-row">
                        <div class="total-lbl">Discount</div>
                        <div class="total-val">- BDT {{ number_format($quotation->discount, 2) }}</div>
                    </div>
                    @endif
                    <div class="grand-total-row">
                        <div class="grand-total-lbl">Total</div>
                        <div class="grand-total-val">BDT {{ number_format($quotation->total, 2) }}</div>
                    </div>
                </div>
            </div>
        </div>

        {{-- NOTES --}}
        @if($quotation->notes)
        <div class="notes-section">
            <div class="notes-title">Notes</div>
            <div class="notes-text">{{ $quotation->notes }}</div>
        </div>
        @endif

        {{-- TERMS + SIGNATURE — terms first, signature/approval block last so it sits at the very
             end of the page content, immediately above the fixed footer. --}}
        <div class="closing-block">
            @if($quotation->terms)
            <div class="terms-banner">Terms &amp; Conditions</div>
            <div class="terms-text">{{ $quotation->terms }}</div>
            @endif

            <div class="signature-section">
                <div class="sig-cell">
                    <div class="sig-line"></div>
                    <div class="sig-label">Prepared By</div>
                </div>
                <div class="sig-cell">
                    <div class="sig-line"></div>
                    <div class="sig-label">Customer Approval</div>
                </div>
            </div>
        </div>

    </div>{{-- /body-wrap --}}
</div>{{-- /page-bg --}}
</body>
</html>
