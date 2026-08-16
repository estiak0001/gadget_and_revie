'use client';

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { AdminLayout } from '@/components/layout';
import { LoadingSpinner, ErrorState } from '@/components/ui';
import QuotationForm from '@/components/quotations/QuotationForm';
import { Quotation } from '@/types';
import adminService from '@/lib/adminService';

export default function EditQuotationPage() {
  const params = useParams();
  const id = Number(params.id);

  const [quotation, setQuotation] = useState<Quotation | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);

  const fetchQuotation = async () => {
    setIsLoading(true);
    setError(false);
    try {
      const res = await adminService.getQuotation(id);
      setQuotation(res.data.data);
    } catch {
      setError(true);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { if (id) fetchQuotation(); }, [id]);

  return (
    <AdminLayout>
      <div className="page-header">
        <h1 className="page-title">Edit Quotation</h1>
        <p className="page-description">{quotation ? quotation.quotation_number : ' '}</p>
      </div>
      {isLoading ? (
        <div className="py-16 flex justify-center"><LoadingSpinner /></div>
      ) : error || !quotation ? (
        <ErrorState onRetry={fetchQuotation} />
      ) : (
        <QuotationForm quotation={quotation} />
      )}
    </AdminLayout>
  );
}
