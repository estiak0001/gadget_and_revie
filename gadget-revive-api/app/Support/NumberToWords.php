<?php

namespace App\Support;

/**
 * Converts a Taka amount to words using the South Asian (lakh/crore) numbering system, as used
 * on Bangladeshi money receipts and cheques — not the Western thousand/million/billion grouping.
 */
class NumberToWords
{
    private const ONES = [
        '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
        'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen',
    ];

    private const TENS = [
        '', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety',
    ];

    /** e.g. 12345.50 -> "Twelve Thousand Three Hundred Forty-Five Taka and Fifty Poisha Only" */
    public static function taka(float $amount): string
    {
        $amount = round(abs($amount), 2);
        $taka = (int) floor($amount);
        $poisha = (int) round(($amount - $taka) * 100);

        $words = $taka > 0 ? self::convert($taka) . ' Taka' : 'Zero Taka';

        if ($poisha > 0) {
            $words .= ' and ' . self::convert($poisha) . ' Poisha';
        }

        return $words . ' Only';
    }

    private static function convert(int $n): string
    {
        if ($n === 0) {
            return 'Zero';
        }

        $crore = intdiv($n, 10000000);
        $n %= 10000000;
        $lakh = intdiv($n, 100000);
        $n %= 100000;
        $thousand = intdiv($n, 1000);
        $n %= 1000;
        $hundred = intdiv($n, 100);
        $n %= 100;

        $parts = [];
        if ($crore > 0) {
            $parts[] = self::twoDigits($crore) . ' Crore';
        }
        if ($lakh > 0) {
            $parts[] = self::twoDigits($lakh) . ' Lakh';
        }
        if ($thousand > 0) {
            $parts[] = self::twoDigits($thousand) . ' Thousand';
        }
        if ($hundred > 0) {
            $parts[] = self::ONES[$hundred] . ' Hundred';
        }
        if ($n > 0) {
            $parts[] = self::twoDigits($n);
        }

        return implode(' ', $parts);
    }

    private static function twoDigits(int $n): string
    {
        if ($n < 20) {
            return self::ONES[$n];
        }

        $tens = intdiv($n, 10);
        $ones = $n % 10;

        return rtrim(self::TENS[$tens] . ($ones > 0 ? '-' . self::ONES[$ones] : ''));
    }
}
