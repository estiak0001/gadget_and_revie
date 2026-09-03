'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronRight, UploadCloud, Download, CheckCircle2, XCircle, Copy } from 'lucide-react';
import { Button, Badge } from '@/components/ui';
import { getErrorMessage, downloadBlob } from '@/lib/utils';
import adminService from '@/lib/adminService';
import toast from 'react-hot-toast';

type BulkUploadResult = {
  batch: string;
  created: number;
  duplicates: number;
  failed: number;
  results: { row: number; name: string | null; status: 'created' | 'duplicate' | 'failed'; message: string | null }[];
};

/**
 * The download-template / upload-file / progress / results flow shared by the "Bulk Upload"
 * modal on the product create page and the dedicated /products/bulk-import page — same backend
 * endpoints either way, so this lives in one place rather than two copies drifting apart.
 */
export default function BulkUploadPanel() {
  const router = useRouter();

  const [isDownloadingTemplate, setIsDownloadingTemplate] = useState(false);
  const [bulkUploadFile, setBulkUploadFile] = useState<File | null>(null);
  const [isBulkUploading, setIsBulkUploading] = useState(false);
  const [bulkUploadProgress, setBulkUploadProgress] = useState(0);
  // Progress is a network-transfer percentage (axios onUploadProgress) — once it hits 100 the
  // bytes are fully sent, but the server may still be parsing rows/extracting images for a bit
  // longer with no signal of its own, so that stretch shows as an indeterminate "Processing..."
  // state rather than a percentage that can't actually move.
  const [bulkUploadPhase, setBulkUploadPhase] = useState<'idle' | 'uploading' | 'processing'>('idle');
  const [bulkUploadResult, setBulkUploadResult] = useState<BulkUploadResult | null>(null);

  const handleDownloadBulkTemplate = async () => {
    setIsDownloadingTemplate(true);
    try {
      const response = await adminService.downloadProductBulkUploadTemplate();
      downloadBlob(new Blob([response.data]), 'product-bulk-upload-template.xlsx');
      toast.success('Sample Excel downloaded');
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setIsDownloadingTemplate(false);
    }
  };

  const handleBulkUpload = async () => {
    if (!bulkUploadFile) {
      toast.error('Choose a filled-in Excel file first');
      return;
    }
    setIsBulkUploading(true);
    setBulkUploadResult(null);
    setBulkUploadProgress(0);
    setBulkUploadPhase('uploading');
    try {
      const response = await adminService.bulkUploadProducts(bulkUploadFile, (percent) => {
        setBulkUploadProgress(percent);
        if (percent >= 100) setBulkUploadPhase('processing');
      });
      const result = response.data?.data;
      if (result) {
        setBulkUploadResult(result);
        if (result.created > 0) {
          toast.success(`${result.created} product(s) created as Inactive`);
        }
        if (result.failed > 0) {
          toast.error(`${result.failed} row(s) failed — see details below`);
        }
      }
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setIsBulkUploading(false);
      setBulkUploadPhase('idle');
    }
  };

  return (
    <div className="space-y-5">
      <div className="bg-sky-50 border border-sky-100 rounded-lg p-4 text-sm text-gray-700 space-y-2">
        <p>
          Fill in the <strong>Products</strong> sheet of the sample file — one row per product.
          The <strong>Categories</strong> and <strong>Brands</strong> sheets list the exact values
          to use, and the <strong>Instructions</strong> sheet explains every column.
        </p>
        <p>
          To add photos, insert the actual picture directly into the <strong>Image 1</strong>–
          <strong>Image 7</strong> cells (not a URL) — Image 1 becomes the main image, the rest
          become the gallery, kept at their original size and quality. Leave them empty to add
          photos later instead.
        </p>
        <p>
          <strong>Description</strong> supports plain-text paragraphs and •/- bullet lines —
          they're turned into proper formatting automatically. <strong>Specifications</strong>{' '}
          accepts one "Key: Value" per line, optionally grouped under a heading line (see the
          Instructions sheet for an example) — grouped specs show under their own section on the
          storefront product page.
        </p>
        <p>
          Every product created this way is saved as <strong>Inactive</strong> and tagged{' '}
          <Badge variant="info">Bulk Upload</Badge> — none of them appear on the storefront
          until you open it from the Products list and switch it Active.
        </p>
      </div>

      <div className="flex items-center justify-between gap-3 border border-gray-200 rounded-lg p-4">
        <div>
          <p className="font-medium text-gray-900">1. Download the sample Excel</p>
          <p className="text-sm text-gray-500">Includes example data plus the category/brand reference sheets.</p>
        </div>
        <Button type="button" variant="outline" onClick={handleDownloadBulkTemplate} isLoading={isDownloadingTemplate}>
          <Download className="w-4 h-4 mr-2" />
          Sample Excel
        </Button>
      </div>

      <div className="border border-gray-200 rounded-lg p-4 space-y-3">
        <p className="font-medium text-gray-900">2. Upload your filled-in file</p>
        <input
          type="file"
          accept=".xlsx,.xls,.csv"
          disabled={isBulkUploading}
          onChange={(e) => {
            setBulkUploadFile(e.target.files?.[0] || null);
            setBulkUploadResult(null);
          }}
          className="block w-full text-sm text-gray-600 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-sky-50 file:text-sky-700 file:font-medium hover:file:bg-sky-100 disabled:opacity-50"
        />
        <div className="flex justify-end">
          <Button type="button" onClick={handleBulkUpload} isLoading={isBulkUploading} disabled={!bulkUploadFile}>
            <UploadCloud className="w-4 h-4 mr-2" />
            Upload
          </Button>
        </div>

        {bulkUploadPhase !== 'idle' && (
          <div>
            <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
              <span>{bulkUploadPhase === 'uploading' ? 'Uploading…' : 'Processing rows…'}</span>
              {bulkUploadPhase === 'uploading' && <span>{bulkUploadProgress}%</span>}
            </div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              {bulkUploadPhase === 'uploading' ? (
                <div
                  className="h-full bg-sky-500 rounded-full transition-all duration-150"
                  style={{ width: `${bulkUploadProgress}%` }}
                />
              ) : (
                <div className="h-full w-full bg-sky-500 rounded-full animate-pulse" />
              )}
            </div>
          </div>
        )}
      </div>

      {bulkUploadResult && (
        <div className="border border-gray-200 rounded-lg p-4 space-y-3">
          <div className="flex items-center gap-4 text-sm flex-wrap">
            <span className="inline-flex items-center gap-1.5 text-emerald-700 font-medium">
              <CheckCircle2 className="w-4 h-4" /> {bulkUploadResult.created} created
            </span>
            {bulkUploadResult.duplicates > 0 && (
              <span className="inline-flex items-center gap-1.5 text-amber-700 font-medium">
                <Copy className="w-4 h-4" /> {bulkUploadResult.duplicates} duplicate{bulkUploadResult.duplicates === 1 ? '' : 's'} skipped
              </span>
            )}
            {bulkUploadResult.failed > 0 && (
              <span className="inline-flex items-center gap-1.5 text-red-700 font-medium">
                <XCircle className="w-4 h-4" /> {bulkUploadResult.failed} failed
              </span>
            )}
          </div>

          {bulkUploadResult.results.some((r) => r.status === 'duplicate') && (
            <div>
              <p className="text-xs font-medium text-amber-700 uppercase tracking-wide mb-1.5">
                Skipped — already in your catalog
              </p>
              <div className="max-h-56 overflow-y-auto border border-amber-100 bg-amber-50/40 rounded-md divide-y divide-amber-100">
                {bulkUploadResult.results
                  .filter((r) => r.status === 'duplicate')
                  .map((r) => (
                    <div key={r.row} className="px-3 py-2 text-sm">
                      <span className="font-medium text-gray-700">Row {r.row}</span>
                      {r.name && <span className="text-gray-500"> ({r.name})</span>}
                      <span className="text-amber-700"> — {r.message}</span>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {bulkUploadResult.results.some((r) => r.status === 'failed') && (
            <div>
              {bulkUploadResult.duplicates > 0 && (
                <p className="text-xs font-medium text-red-700 uppercase tracking-wide mb-1.5">Failed</p>
              )}
              <div className="max-h-56 overflow-y-auto border border-gray-100 rounded-md divide-y divide-gray-100">
                {bulkUploadResult.results
                  .filter((r) => r.status === 'failed')
                  .map((r) => (
                    <div key={r.row} className="px-3 py-2 text-sm">
                      <span className="font-medium text-gray-700">Row {r.row}</span>
                      {r.name && <span className="text-gray-500"> ({r.name})</span>}
                      <span className="text-red-600"> — {r.message}</span>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {bulkUploadResult.created > 0 && (
            <div className="flex justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.push(`/products?source=bulk_import&bulk_upload_batch=${bulkUploadResult.batch}`)}
              >
                Review this batch in Products
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
