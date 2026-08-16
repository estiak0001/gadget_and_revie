<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Money Receipt {{ $receiptNumber }}</title>

    <style>
        /* A5 — exactly half an A4 sheet — a real money-receipt-book slip, not a full-page document. */
        @page { size: A5 portrait; margin: 0; }
        * { margin: 0; padding: 0; box-sizing: border-box; }

        body {
            font-family: 'DejaVu Sans', Arial, sans-serif;
            font-size: 13px;
            line-height: 1.45;
            color: #000000;
            background-color: #ffffff;
        }

        /* Full-bleed, flush with the top of the page — sized to roughly the top portion of an A4
           sheet (a real money-receipt-book slip, not a full-page document), the rest left blank
           to trim away. Every border on the page uses this same mild, muted color — previously a
           jarring mix of solid black (field underlines, signature lines) and solid green
           (card border) side by side, which read as inconsistent. Green stays only as an accent
           on emphasis TEXT (amount, paid status), the same split used on the Payment Voucher. */
        .receipt-card {
            border-bottom: 2px solid #94a3b8; position: relative; overflow: hidden;
        }

        /* Big soft logo watermark, anchored near the top of the card (not vertically centered —
           centering it let the image extend past the card's short height into the blank trimmed
           area of the page below). overflow:hidden on .receipt-card also clips it for safety. */
        .wm-layer {
            position: absolute; top: 8px; right: 8px; width: 220px; height: auto;
            opacity: 0.09; z-index: 0;
        }
        /* Soft accent-colored glow in the opposite corner, mostly clipped off-page by
           overflow:hidden — the same family treatment as the Delivery Chalan/Payment Voucher,
           using this document's own green accent instead of a flat neutral shape. */
        .bg-accent {
            position: absolute; border-radius: 50%; background: #047857; opacity: 0.06; z-index: 0;
            width: 260px; height: 260px; top: 120px; left: -100px;
        }

        .card-body { position: relative; z-index: 1; padding: 10px 16px 4px; }

        /* ── TOP: logo + business info ─────────────────────── */
        .top-row { display: table; width: 100%; margin-bottom: 6px; padding-bottom: 6px; border-bottom: 1.5px solid #94a3b8; }
        .top-left { display: table-cell; vertical-align: middle; }
        .top-right { display: table-cell; vertical-align: top; text-align: right; }
        .logo-img { height: 30px; width: auto; }
        .biz-name { font-size: 12px; font-weight: 900; color: #000000; letter-spacing: 0.3px; }
        .biz-detail { font-size: 8.5px; color: #374151; line-height: 1.4; }

        /* ── TITLE ──────────────────────────────────────────── */
        .title-row { text-align: center; margin: 2px 0 6px; }
        .title-row .t {
            font-size: 19px; font-weight: 900; letter-spacing: 1px; text-transform: uppercase;
            color: #000000;
        }

        /* ── FORM FIELDS — label caption stacked above its value, not side-by-side ─────
           No horizontal column negotiation between a label and value at all, which is what kept
           going wrong (dompdf's table-layout:fixed doesn't reliably honor two DIFFERENT declared
           column widths in one row). Stacking removes the problem instead of working around it:
           every field is just two block-level lines, so there's nothing left to misalign. Split
           rows (Receipt No./Date, Taka/Payment Method) still use a table, but now both columns
           are the SAME width (50/50), which dompdf has never had trouble with. */
        .field { margin-bottom: 5px; }
        .field .flabel {
            font-size: 9.5px; text-transform: uppercase; letter-spacing: 0.4px; color: #6b7280;
            margin-bottom: 1px;
        }
        .field .fvalue {
            font-size: 12px; font-weight: 700; color: #000000; border-bottom: 1px solid #94a3b8;
            padding-bottom: 2px; min-height: 15px;
        }

        table.frow-split { width: 100%; table-layout: fixed; border-collapse: collapse; margin-bottom: 5px; }
        table.frow-split td { width: 50%; vertical-align: top; }
        table.frow-split td.pad { padding-left: 14px; }

        .amt { font-size: 17px; font-weight: 900; color: #047857; }
        .method-pill {
            display: inline-block; background: #ecfdf5; color: #047857; border: 1px solid #047857;
            border-radius: 10px; padding: 2px 10px; font-size: 9.5px; font-weight: 700;
        }

        .summary-line {
            font-size: 10px; color: #000000; background: #f9fafb; border: 1px solid #94a3b8;
            border-radius: 5px; padding: 5px 10px; margin-bottom: 7px;
        }
        .summary-line b.due { color: #b91c1c; }
        .summary-line b.paid { color: #047857; }

        /* ── SIGNATURES ─────────────────────────────────────── */
        .sig-row { display: table; width: 100%; margin-top: 3px; margin-bottom: 6px; }
        .sig-cell { display: table-cell; width: 50%; vertical-align: bottom; }
        .sig-cell + .sig-cell { padding-left: 14px; }
        .sig-fill { border-bottom: 1px solid #94a3b8; height: 28px; }
        .sig-cap { font-size: 8.5px; color: #374151; margin-top: 2px; }

        /* ── CARD FOOTER ────────────────────────────────────── */
        .color-bar { display: table; width: 100%; }
        .bar-dark {
            display: table-cell; background: #1f2937; color: #ffffff; padding: 7px 12px;
            vertical-align: middle; width: 60%;
        }
        .bar-tagline { font-size: 9px; font-style: italic; color: #ffffff; margin-bottom: 1px; }
        .bar-contact { font-size: 7.5px; color: #d1d5db; line-height: 1.4; }
        .bar-1 { display: table-cell; background: #6ee7b7; width: 13.3%; }
        .bar-2 { display: table-cell; background: #10b981; width: 13.3%; }
        .bar-3 { display: table-cell; background: #047857; width: 13.4%; }
    </style>
</head>
<body>

<div class="receipt-card">

    <div class="bg-accent"></div>
    @if(!empty($settings['logo_black']))
        <img class="wm-layer" src="{{ $settings['logo_black'] }}" alt="">
    @endif

    <div class="card-body">
        {{-- TOP: logo + business info --}}
        <div class="top-row">
            <div class="top-left">
                @if(!empty($settings['logo_black']))
                    <img class="logo-img" src="{{ $settings['logo_black'] }}" alt="logo">
                @endif
            </div>
            <div class="top-right">
                <div class="biz-name">{{ strtoupper($settings['footer_brand'] ?? ($settings['site_name'] ?? 'Gadget Revive')) }}</div>
                <div class="biz-detail">
                    {{ $settings['address'] ?? '' }}<br>
                    P: {{ $settings['phone'] ?? '' }} &nbsp; E: {{ $settings['email'] ?? '' }}
                </div>
            </div>
        </div>

        {{-- TITLE --}}
        <div class="title-row">
            <div class="t">Money Receipt</div>
        </div>

        {{-- No. / Date --}}
        <table class="frow-split">
            <tr>
                <td>
                    <div class="field">
                        <div class="flabel">Receipt No.</div>
                        <div class="fvalue">{{ $receiptNumber }}</div>
                    </div>
                </td>
                <td class="pad">
                    <div class="field">
                        <div class="flabel">Date</div>
                        <div class="fvalue">{{ now()->format('d/m/Y') }}</div>
                    </div>
                </td>
            </tr>
        </table>

        {{-- Received from --}}
        <div class="field">
            <div class="flabel">Received with thanks from</div>
            <div class="fvalue">{{ $order->customer_name ?? ($order->customer?->name ?? 'Valued Customer') }}{{ $order->customer_phone ? ' — ' . $order->customer_phone : '' }}</div>
        </div>

        {{-- In words --}}
        <div class="field">
            <div class="flabel">In Words</div>
            <div class="fvalue">{{ \App\Support\NumberToWords::taka($receiptAmount) }}</div>
        </div>

        {{-- For --}}
        <div class="field">
            <div class="flabel">For</div>
            <div class="fvalue">Payment against Order #{{ $order->order_number }} ({{ $order->items->count() }} item{{ $order->items->count() === 1 ? '' : 's' }})</div>
        </div>

        {{-- Taka amount + payment method, side by side --}}
        <table class="frow-split">
            <tr>
                <td>
                    <div class="field" style="margin-bottom: 0;">
                        <div class="flabel">Taka</div>
                        <div class="fvalue"><span class="amt">{{ number_format($receiptAmount, 2) }}</span></div>
                    </div>
                </td>
                <td class="pad">
                    <div class="field" style="margin-bottom: 0;">
                        <div class="flabel">Payment Method</div>
                        <div class="fvalue" style="border-bottom: none;">
                            <span class="method-pill">{{ ucfirst(str_replace('_', ' ', $order->payment_method ?? 'cash')) }}</span>
                        </div>
                    </div>
                </td>
            </tr>
        </table>

        <div class="summary-line">
            Total Bill <b>Tk {{ number_format($order->total, 2) }}</b>
            &nbsp;&middot;&nbsp; Paid To Date <b class="paid">Tk {{ number_format($paidToDate, 2) }}</b>
            &nbsp;&middot;&nbsp; Balance Due
            <b class="{{ $balanceDue > 0 ? 'due' : 'paid' }}">{{ $balanceDue > 0 ? 'Tk ' . number_format($balanceDue, 2) : 'Fully Paid' }}</b>
        </div>

        <div class="sig-row">
            <div class="sig-cell">
                <div class="sig-fill"></div>
                <div class="sig-cap">Received By</div>
            </div>
            <div class="sig-cell">
                <div class="sig-fill"></div>
                <div class="sig-cap">Authorized Signature</div>
            </div>
        </div>
    </div>

    {{-- CARD FOOTER --}}
    <div class="color-bar">
        <div class="bar-dark">
            <div class="bar-tagline">{{ $settings['site_tagline'] ?? 'Reviving Tech, Restoring Trust' }}</div>
            <div class="bar-contact">
                {{ $settings['footer_address'] ?? ($settings['address'] ?? '') }}
                &nbsp;|&nbsp; {{ $settings['footer_phone'] ?? ($settings['phone'] ?? '') }}
                &nbsp;|&nbsp; {{ $settings['footer_email'] ?? ($settings['email'] ?? '') }}
            </div>
        </div>
        <div class="bar-1"></div>
        <div class="bar-2"></div>
        <div class="bar-3"></div>
    </div>
</div>

</body>
</html>
