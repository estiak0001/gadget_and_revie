'use client';

import React from 'react';
import { AdminLayout } from '@/components/layout';
import QuotationForm from '@/components/quotations/QuotationForm';

export default function CreateQuotationPage() {
  return (
    <AdminLayout>
      <div className="page-header">
        <h1 className="page-title">New Quotation</h1>
        <p className="page-description">Add products from your catalog, or type custom line items, then generate a PDF</p>
      </div>
      <QuotationForm />
    </AdminLayout>
  );
}
