<?php

namespace App\Imports;

use PhpOffice\PhpSpreadsheet\Cell\Coordinate;
use PhpOffice\PhpSpreadsheet\IOFactory;
use PhpOffice\PhpSpreadsheet\Worksheet\Drawing;
use PhpOffice\PhpSpreadsheet\Worksheet\MemoryDrawing;

/**
 * Pulls out the images an admin pasted/inserted directly into the "Image 1".."Image 7" cells
 * of the Products sheet — real embedded pictures, not URLs or text. Excel::import()'s normal
 * row-value reading (ToCollection/WithHeadingRow) only ever sees cell text, never floating
 * drawings, so this reads the uploaded file's raw PhpSpreadsheet worksheet independently,
 * before/alongside the normal import pass.
 */
class ProductBulkImageExtractor
{
    /**
     * @return array<int, array<int, array{binary: string, extension: string}>> keyed by Excel
     *         row number, then by image slot (1 = main image, 2-7 = gallery, in column order —
     *         slot numbers come from the "Image N" header text itself, not a hardcoded column).
     */
    public static function extract(string $filePath): array
    {
        // No extension pre-check here on purpose: $filePath is normally PHP's temp upload path
        // (e.g. /tmp/phpXXXXXX), which never carries the original .xlsx/.csv extension at all —
        // gating on pathinfo()'s extension silently extracted zero images from every real HTTP
        // upload. IOFactory::load() content-sniffs the actual file instead, and a plain .csv
        // (no drawings at all) simply fails to parse as a spreadsheet, caught below.
        //
        // Deliberately NOT using setReadDataOnly(true) here even though cell styling is
        // irrelevant to this class — PhpSpreadsheet's Xlsx reader skips parsing drawings
        // entirely in that mode (see Reader/Xlsx.php: `$xmlSheetNS->drawing && !$this->readDataOnly`),
        // which would silently extract zero images from every upload, the same class of bug as
        // the extension pre-check above.
        try {
            $spreadsheet = IOFactory::load($filePath);
        } catch (\Throwable) {
            return [];
        }

        if (!$spreadsheet->sheetNameExists('Products')) {
            return [];
        }
        $sheet = $spreadsheet->getSheetByName('Products');

        // Map each "Image N" header (row 1) to its slot number by reading the header text
        // itself, rather than assuming a fixed column position — survives the sheet's column
        // order changing later without this needing to change too.
        $slotByColumn = [];
        $highestColumn = Coordinate::columnIndexFromString($sheet->getHighestColumn());
        for ($col = 1; $col <= $highestColumn; $col++) {
            $header = trim((string) $sheet->getCellByColumnAndRow($col, 1)->getValue());
            if (preg_match('/^Image\s*(\d+)$/i', $header, $m)) {
                $slotByColumn[$col] = (int) $m[1];
            }
        }

        if (empty($slotByColumn)) {
            return [];
        }

        $imagesByRow = [];

        foreach ($sheet->getDrawingCollection() as $drawing) {
            [$columnLetter, $row] = Coordinate::coordinateFromString($drawing->getCoordinates());
            $columnIndex = Coordinate::columnIndexFromString($columnLetter);

            // An image pasted somewhere other than an "Image N" column (e.g. someone illustrating
            // the Instructions sheet) is simply ignored.
            if (!isset($slotByColumn[$columnIndex])) {
                continue;
            }

            $extracted = self::readDrawing($drawing);
            if ($extracted === null) {
                continue;
            }

            $imagesByRow[(int) $row][$slotByColumn[$columnIndex]] = $extracted;
        }

        foreach ($imagesByRow as $row => $slots) {
            ksort($imagesByRow[$row]);
        }

        return $imagesByRow;
    }

    /** @return array{binary: string, extension: string}|null */
    private static function readDrawing(mixed $drawing): ?array
    {
        if ($drawing instanceof MemoryDrawing) {
            ob_start();
            call_user_func($drawing->getRenderingFunction(), $drawing->getImageResource());
            $binary = ob_get_clean();
            $ext = match ($drawing->getMimeType()) {
                MemoryDrawing::MIMETYPE_PNG => 'png',
                MemoryDrawing::MIMETYPE_GIF => 'gif',
                default => 'jpg',
            };
        } elseif ($drawing instanceof Drawing) {
            $binary = @file_get_contents($drawing->getPath());
            $ext = strtolower($drawing->getExtension() ?: 'png');
        } else {
            // An unrecognized/exotic drawing subtype — skip rather than risk a fatal error on
            // an otherwise-valid upload.
            return null;
        }

        return $binary ? ['binary' => $binary, 'extension' => $ext] : null;
    }
}
