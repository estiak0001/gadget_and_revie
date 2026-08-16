<?php

namespace App\Traits;

/**
 * Draws "Page X of Y" onto every page of a generated PDF, bottom-right, inside the page's outer
 * @page margin strip (below the fixed HTML footer used by invoices.order / invoices.custom_order /
 * invoices.service-receipt). This can't be done in the Blade view itself: DomPDF has no working
 * `counter(pages)` (grand total, as opposed to the current-page counter, which does work) —
 * content on that side always evaluates to 0. Canvas::page_text() is DomPDF's real, documented
 * mechanism for this; it must run after render() (it re-opens each already-created page to draw
 * on it), which is why this forces the render here rather than leaving it to happen lazily inside
 * stream()/download().
 *
 * A slim page-2+ "running header" (logo + document reference) was tried and dropped: DomPDF pins
 * a multi-page table's repeated column-header row to the literal physical top of every
 * continuation page, ignoring the page margin entirely (confirmed even with a 45mm margin — it
 * didn't move), so anything else drawn at the top of the page paints over and hides the column
 * labels. The only way to reserve clearance for it would be adding space inside the header row
 * itself, which — since plain CSS/HTML can't detect "is this page 2" — would also show up as a
 * gap on page 1. Not worth it: the footer and this page-number stamp already repeat identically
 * on every page and are enough to identify a loose page.
 */
trait StampsPdfPageNumbers
{
    protected function stampPageNumbers(\Barryvdh\DomPDF\PDF $pdf): void
    {
        $pdf->render();

        $domPdf = $pdf->getDomPDF();
        $canvas = $domPdf->getCanvas();
        $fontMetrics = $domPdf->getFontMetrics();
        $font = $fontMetrics->getFont('DejaVu Sans', 'normal');
        $size = 8.5;

        // Right margin matches the @page rule (10mm ≈ 28.35pt). Width is estimated off a
        // generous "Page 99 of 99" stand-in so the anchor doesn't shift a few points left/right
        // between single- and double-digit page counts — real documents won't clear 2 digits.
        $rightMargin = 28.35;
        $estWidth = $fontMetrics->getTextWidth('Page 99 of 99', $font, $size);
        $x = $canvas->get_width() - $rightMargin - $estWidth;
        $y = $canvas->get_height() - 20;

        $canvas->page_text($x, $y, 'Page {PAGE_NUM} of {PAGE_COUNT}', $font, $size, [0.25, 0.25, 0.25]);
    }
}
