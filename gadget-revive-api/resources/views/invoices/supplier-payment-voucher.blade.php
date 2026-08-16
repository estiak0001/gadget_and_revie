<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Payment Voucher {{ $voucherNumber }}</title>

    <style>
        @page { size: A4 portrait; margin: 10mm 12mm; }
        * { margin: 0; padding: 0; box-sizing: border-box; }

        body {
            font-family: 'DejaVu Sans', Arial, sans-serif;
            font-size: 11.5px;
            line-height: 1.4;
            color: #000000;
            background-color: #f5f8ff;
        }

        /* Classic ruled office voucher, now with a touch of blue contrast (title, table header,
           key figures) and a soft logo watermark — still plain/formal, not the Money Receipt's
           card style, just no longer stark black & white. Every border uses the SAME mild,
           muted color throughout (previously a jarring mix of solid black + strong blue + light
           blue borders across different elements, which read as inconsistent/"not solid"). */
        .voucher-box {
            border: 1.5px solid #94a3b8; padding: 12px 16px; position: relative; overflow: hidden;
            background: #ffffff;
        }

        /* Tucked into the blank area below the signature line rather than dead-center — centered
           behind the items table read as a misplaced/broken image rather than a watermark.
           dompdf doesn't reliably resolve position:absolute with a negative `bottom` offset (the
           element silently fails to render at all) — anchor from `top` instead, same fix applied
           on the Money Receipt. */
        .wm-layer {
            position: absolute; top: 380px; right: -30px; width: 280px; height: auto;
            opacity: 0.07; z-index: 0;
        }
        /* Soft accent-colored glow in the opposite corner — same family treatment as the Money
           Receipt/Delivery Chalan, using this document's own blue accent. */
        .bg-accent {
            position: absolute; border-radius: 50%; background: #1d4ed8; opacity: 0.05; z-index: 0;
            width: 320px; height: 320px; top: 260px; left: -120px;
        }
        .voucher-box > *:not(.wm-layer):not(.bg-accent) { position: relative; z-index: 1; }

        table.header-table { width: 100%; border-collapse: collapse; margin-bottom: 7px; }
        table.header-table td { vertical-align: top; border: none; padding: 0; }
        .biz-name { font-size: 13px; font-weight: 700; }
        .biz-detail { font-size: 9.5px; line-height: 1.4; margin-top: 1px; }
        .logo-cell { text-align: right; vertical-align: middle; }
        .logo-cell img { height: 32px; width: auto; }

        .title-band {
            text-align: center; font-size: 15px; font-weight: 700; letter-spacing: 2px;
            text-transform: uppercase; color: #1d4ed8;
            border-top: 1.5px solid #94a3b8; border-bottom: 1.5px solid #94a3b8;
            padding: 4px 0; margin-bottom: 7px;
        }

        table.meta-table { width: 100%; border-collapse: collapse; margin-bottom: 7px; }
        table.meta-table td { border: none; padding: 0; font-size: 11px; }
        table.meta-table td.right { text-align: right; }
        table.meta-table b { font-weight: 700; }

        .paid-to-line { font-size: 11.5px; margin-bottom: 8px; }
        .paid-to-line b { font-weight: 700; }

        table.items { width: 100%; border-collapse: collapse; margin-bottom: 7px; }
        table.items th {
            border: 1px solid #94a3b8; padding: 4px 6px; font-size: 10px; font-weight: 700;
            text-transform: uppercase; letter-spacing: 0.3px; text-align: left;
            background: #dbeafe; color: #1e3a8a;
        }
        table.items th.r, table.items td.r { text-align: right; }
        table.items th.c, table.items td.c { text-align: center; }
        table.items td { border: 1px solid #94a3b8; padding: 5px 6px; font-size: 11px; }
        table.items tfoot td {
            border: 1px solid #94a3b8; padding: 5px 6px; font-size: 11.5px; font-weight: 700;
            color: #1d4ed8;
        }

        .words-line { font-size: 11px; margin-bottom: 6px; }
        .words-line b { font-weight: 700; }

        .mode-line { font-size: 11px; margin-bottom: 8px; }
        .mode-line b { font-weight: 700; }

        table.summary-mini { width: 100%; border-collapse: collapse; margin-bottom: 10px; }
        table.summary-mini td { border: 1px solid #94a3b8; padding: 4px 6px; font-size: 10px; text-align: center; background: #eff6ff; }
        table.summary-mini td b { display: block; font-size: 11.5px; margin-top: 1px; color: #1d4ed8; }
        table.summary-mini td.due b { color: #b91c1c; }

        table.sig-table { width: 100%; border-collapse: collapse; margin-top: 18px; }
        table.sig-table td {
            border: none; padding: 0 6px; text-align: center; font-size: 9.5px;
            text-transform: uppercase; letter-spacing: 0.2px; width: 25%;
        }
        .sig-line { border-top: 1px solid #94a3b8; margin: 20px 4px 3px; }

        .legal {
            text-align: center; font-size: 9px; color: #444444; margin-top: 10px; font-style: italic;
        }
    </style>
</head>
<body>

<div class="voucher-box">

    <div class="bg-accent"></div>
    @if(!empty($settings['logo_black']))
        <img class="wm-layer" src="{{ $settings['logo_black'] }}" alt="">
    @endif

    <table class="header-table">
        <tr>
            <td>
                <div class="biz-name">{{ $settings['footer_brand'] ?? ($settings['site_name'] ?? 'Gadget Revive') }}</div>
                <div class="biz-detail">
                    {{ $settings['address'] ?? '' }}<br>
                    Phone: {{ $settings['phone'] ?? '' }} &nbsp; Email: {{ $settings['email'] ?? '' }}
                </div>
            </td>
            <td class="logo-cell">
                @if(!empty($settings['logo_black']))
                    <img src="{{ $settings['logo_black'] }}" alt="logo">
                @endif
            </td>
        </tr>
    </table>

    <div class="title-band">Payment Voucher</div>

    <table class="meta-table">
        <tr>
            <td><b>Voucher No:</b> {{ $voucherNumber }}</td>
            <td class="right"><b>Date:</b> {{ now()->format('d/m/Y') }}</td>
        </tr>
    </table>

    <div class="paid-to-line">
        <b>Paid To:</b> {{ $po->supplier?->name ?? 'Supplier' }}{{ $po->supplier?->phone ? ' — ' . $po->supplier->phone : '' }}
    </div>

    <table class="items">
        <thead>
            <tr>
                <th class="c" style="width:8%;">SL</th>
                <th>Particulars</th>
                <th class="r" style="width:22%;">Amount (Tk)</th>
            </tr>
        </thead>
        <tbody>
            <tr>
                <td class="c">1</td>
                <td>Payment against Purchase Order #{{ $po->po_number }} ({{ $po->items->count() }} item{{ $po->items->count() === 1 ? '' : 's' }})</td>
                <td class="r">{{ number_format($voucherAmount, 2) }}</td>
            </tr>
        </tbody>
        <tfoot>
            <tr>
                <td colspan="2" class="r">Total</td>
                <td class="r">{{ number_format($voucherAmount, 2) }}</td>
            </tr>
        </tfoot>
    </table>

    <div class="words-line">
        <b>Amount in Words:</b> {{ \App\Support\NumberToWords::taka($voucherAmount) }}
    </div>

    <div class="mode-line">
        <b>Payment Mode:</b> Cash
    </div>

    <table class="summary-mini">
        <tr>
            <td>Total Bill<b>Tk {{ number_format($billAmount, 2) }}</b></td>
            <td>Paid To Date<b>Tk {{ number_format($paidToDate, 2) }}</b></td>
            <td class="{{ $outstanding > 0 ? 'due' : '' }}">Balance Due<b>{{ $outstanding > 0 ? 'Tk ' . number_format($outstanding, 2) : 'Fully Paid' }}</b></td>
        </tr>
    </table>

    <table class="sig-table">
        <tr>
            <td>
                <div class="sig-line"></div>
                Prepared By
            </td>
            <td>
                <div class="sig-line"></div>
                Checked By
            </td>
            <td>
                <div class="sig-line"></div>
                Approved By
            </td>
            <td>
                <div class="sig-line"></div>
                Received By
            </td>
        </tr>
    </table>

    <div class="legal">
        This is a computer-generated payment voucher. &copy; {{ date('Y') }} {{ $settings['legal_entity'] ?? 'Gadget Revive Bangladesh Ltd.' }}
    </div>

</div>

</body>
</html>
