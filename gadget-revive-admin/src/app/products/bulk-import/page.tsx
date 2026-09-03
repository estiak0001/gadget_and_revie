'use client';

import React from 'react';
import Link from 'next/link';
import { ChevronRight, Info } from 'lucide-react';
import { AdminLayout } from '@/components/layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui';
import BulkUploadPanel from '@/components/products/BulkUploadPanel';

export default function ProductBulkImportPage() {
  return (
    <AdminLayout>
      <div className="page-header">
        <h1 className="page-title">Bulk Import</h1>
        <p className="page-description">Bring in a catalog from a spreadsheet — including one produced by a scraping script</p>
      </div>

      <Card className="mb-6 border-amber-200 bg-amber-50/50">
        <CardContent className="p-4 flex gap-3">
          <Info className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-amber-900 space-y-1.5">
            <p>
              <strong>This runs the upload only — not the scraping itself.</strong> A scraping
              script (e.g. the Star Tech notebook) has to run on your own computer, not this
              server: Star Tech, Ryans, and Tech Land all challenge-block requests from this
              server&apos;s hosting IP via Cloudflare, confirmed even with a real headless
              browser. There&apos;s no way around that from here.
            </p>
            <p>
              Run the script yourself, point it at the sample Excel below, and it fills in one
              workbook (or one per brand) ready to upload — then bring each file here. If your
              script instead posts straight to this admin&apos;s{' '}
              <Link href="/scraped-products" className="font-medium underline">
                Scraped Products
              </Link>{' '}
              staging table (no Excel step at all), review and promote rows from there.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Upload a Catalog File</CardTitle>
        </CardHeader>
        <CardContent>
          <BulkUploadPanel />
        </CardContent>
      </Card>

      <div className="mt-6 flex justify-end">
        <Link
          href="/products?source=bulk_import"
          className="inline-flex items-center gap-1 text-sm font-medium text-primary-600 hover:text-primary-700"
        >
          Review past bulk-import batches in Products
          <ChevronRight className="w-4 h-4" />
        </Link>
      </div>
    </AdminLayout>
  );
}
