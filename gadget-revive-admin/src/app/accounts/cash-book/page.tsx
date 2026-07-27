'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { RefreshCw, Printer } from 'lucide-react';
import { AdminLayout } from '@/components/layout';
import { Card, CardContent, Button, DateRangePicker, LoadingSpinner, ErrorState, InfoButton, StepFlow } from '@/components/ui';
import { CashBook } from '@/types';
import { formatCurrency, getErrorMessage } from '@/lib/utils';
import adminService from '@/lib/adminService';
import toast from 'react-hot-toast';

const today = () => new Date().toISOString().split('T')[0];

export default function CashBookPage() {
  const [fromDate, setFromDate] = useState(today());
  const [toDate, setToDate] = useState(today());
  const [data, setData] = useState<CashBook | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(false);
    try {
      const res = await adminService.getCashBook(fromDate, toDate);
      setData(res.data?.data ?? null);
    } catch (err) {
      toast.error(getErrorMessage(err));
      setError(true);
    } finally {
      setIsLoading(false);
    }
  }, [fromDate, toDate]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const asOfLabel = fromDate === toDate ? fromDate : `${fromDate} to ${toDate}`;

  return (
    <AdminLayout>
      <div className="space-y-6 print:space-y-3">
        <div className="print:hidden">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-gray-900">Cash Book</h1>
            <InfoButton title="How the Cash Book Works">
              <p>
                A day-book style record of every cash receipt and payment through the <strong>Cash</strong> account
                for the selected period, plus the opening and closing balance either side of it — the classic
                &quot;receipts on one side, payments on the other&quot; ledger format.
              </p>
              <div>
                <p className="font-semibold text-gray-900 mb-2">How to use this page</p>
                <StepFlow steps={[
                  'Pick a From/To date range — a single day for a daily cash book, or a wider range for a summary.',
                  'Cash Receipts lists every amount that came into the Cash account (payments received, investments, opening adjustments).',
                  'Cash Payments lists every amount that went out, split into Salary vs general Cash Payment.',
                  'Use Print to produce a printable copy, or export the numbers into Excel from the totals shown.',
                ]} />
              </div>
            </InfoButton>
          </div>
          <p className="text-sm text-gray-500 mt-1">
            Daily cash receipts, payments, and closing balance — suitable for printing.
          </p>
        </div>

        <Card className="print:hidden">
          <CardContent className="pt-4 flex flex-wrap items-end gap-3">
            <DateRangePicker startDate={fromDate} endDate={toDate} onStartDateChange={setFromDate} onEndDateChange={setToDate} />
            <Button variant="ghost" size="sm" onClick={fetchData} leftIcon={<RefreshCw className="w-4 h-4" />}>
              Refresh
            </Button>
            <Button variant="ghost" size="sm" onClick={() => window.print()} leftIcon={<Printer className="w-4 h-4" />}>
              Print
            </Button>
          </CardContent>
        </Card>

        {isLoading ? (
          <div className="flex justify-center py-12"><LoadingSpinner /></div>
        ) : error || !data ? (
          <ErrorState message="Failed to load cash book." onRetry={fetchData} />
        ) : (
          <div className="bg-white rounded-lg border border-gray-200 p-4 print:border-0 print:p-0">
            <div className="text-center mb-4">
              <h2 className="text-lg font-bold text-gray-900">Cash Book</h2>
              <p className="text-sm text-gray-600">As of End of Day: {asOfLabel}</p>
            </div>

            {/* Cash Receipts */}
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-gray-800 bg-gray-100 px-3 py-1.5 rounded-t">Cash Receipts</h3>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm border border-gray-200 border-t-0">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium text-gray-600 border-b border-gray-200">Date</th>
                      <th className="px-3 py-2 text-left font-medium text-gray-600 border-b border-gray-200">Voucher</th>
                      <th className="px-3 py-2 text-left font-medium text-gray-600 border-b border-gray-200">Particulars</th>
                      <th className="px-3 py-2 text-right font-medium text-gray-600 border-b border-gray-200">Cheque (Tk)</th>
                      <th className="px-3 py-2 text-right font-medium text-gray-600 border-b border-gray-200">Cash Received (Tk)</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-gray-100 bg-primary-50/30">
                      <td className="px-3 py-2 text-gray-700">{fromDate}</td>
                      <td className="px-3 py-2 text-gray-400">-</td>
                      <td className="px-3 py-2 font-medium text-gray-800">Opening Balance</td>
                      <td className="px-3 py-2 text-right text-gray-400">-</td>
                      <td className="px-3 py-2 text-right font-medium text-gray-800">{formatCurrency(data.opening_balance)}</td>
                    </tr>
                    {data.receipts.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-3 py-3 text-center text-gray-400">No cash receipts in this period.</td>
                      </tr>
                    ) : data.receipts.map((r, i) => (
                      <tr key={i} className="border-b border-gray-100">
                        <td className="px-3 py-2 text-gray-700">{r.date}</td>
                        <td className="px-3 py-2 text-gray-500">{r.voucher}</td>
                        <td className="px-3 py-2 text-gray-800">{r.particulars}</td>
                        <td className="px-3 py-2 text-right text-gray-400">{r.cheque ? formatCurrency(r.cheque) : '-'}</td>
                        <td className="px-3 py-2 text-right text-gray-800">{formatCurrency(r.cash_received)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-gray-50 font-semibold">
                      <td className="px-3 py-2" colSpan={4}>Total Cash Received</td>
                      <td className="px-3 py-2 text-right">{formatCurrency(data.opening_balance + data.total_received)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            {/* Cash Payments */}
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-gray-800 bg-gray-100 px-3 py-1.5 rounded-t">Cash Payments</h3>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm border border-gray-200 border-t-0">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium text-gray-600 border-b border-gray-200">Date</th>
                      <th className="px-3 py-2 text-left font-medium text-gray-600 border-b border-gray-200">Voucher</th>
                      <th className="px-3 py-2 text-left font-medium text-gray-600 border-b border-gray-200">Particulars</th>
                      <th className="px-3 py-2 text-right font-medium text-gray-600 border-b border-gray-200">Salary (Tk)</th>
                      <th className="px-3 py-2 text-right font-medium text-gray-600 border-b border-gray-200">Cash Payment (Tk)</th>
                      <th className="px-3 py-2 text-right font-medium text-gray-600 border-b border-gray-200">Cheque (Tk)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.payments.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-3 py-3 text-center text-gray-400">No cash payments in this period.</td>
                      </tr>
                    ) : data.payments.map((p, i) => (
                      <tr key={i} className="border-b border-gray-100">
                        <td className="px-3 py-2 text-gray-700">{p.date}</td>
                        <td className="px-3 py-2 text-gray-500">{p.voucher}</td>
                        <td className="px-3 py-2 text-gray-800">{p.particulars}</td>
                        <td className="px-3 py-2 text-right text-gray-800">{p.salary ? formatCurrency(p.salary) : '-'}</td>
                        <td className="px-3 py-2 text-right text-gray-800">{p.cash_payment ? formatCurrency(p.cash_payment) : '-'}</td>
                        <td className="px-3 py-2 text-right text-gray-400">{p.cheque ? formatCurrency(p.cheque) : '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-gray-50 font-semibold">
                      <td className="px-3 py-2" colSpan={3}>Total Payments</td>
                      <td className="px-3 py-2 text-right">{formatCurrency(data.total_salary)}</td>
                      <td className="px-3 py-2 text-right">{formatCurrency(data.total_cash_payment)}</td>
                      <td className="px-3 py-2 text-right">{formatCurrency(data.total_payment_cheque)}</td>
                    </tr>
                    <tr className="bg-gray-100 font-bold">
                      <td className="px-3 py-2" colSpan={5}>Grand Total Paid</td>
                      <td className="px-3 py-2 text-right">{formatCurrency(data.total_paid)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            {/* Cash Summary */}
            <div className="mb-6 max-w-md">
              <h3 className="text-sm font-semibold text-gray-800 bg-gray-100 px-3 py-1.5 rounded-t">Cash Summary</h3>
              <table className="min-w-full text-sm border border-gray-200 border-t-0">
                <tbody>
                  <tr className="border-b border-gray-100">
                    <td className="px-3 py-2 text-gray-700">Total Cash Received</td>
                    <td className="px-3 py-2 text-right text-gray-800">{formatCurrency(data.opening_balance + data.total_received)}</td>
                  </tr>
                  <tr className="border-b border-gray-100">
                    <td className="px-3 py-2 text-gray-700">Less: Total Payments</td>
                    <td className="px-3 py-2 text-right text-red-700">({formatCurrency(data.total_paid)})</td>
                  </tr>
                  <tr className="bg-gray-50 font-bold">
                    <td className="px-3 py-2 text-gray-900">Closing Cash in Hand</td>
                    <td className="px-3 py-2 text-right text-gray-900">{formatCurrency(data.closing_balance)}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Closing Balance */}
            <div className="max-w-md">
              <h3 className="text-sm font-semibold text-gray-800 bg-gray-100 px-3 py-1.5 rounded-t">Closing Balance</h3>
              <table className="min-w-full text-sm border border-gray-200 border-t-0">
                <tbody>
                  <tr>
                    <td className="px-3 py-2 text-gray-700">{toDate}</td>
                    <td className="px-3 py-2 text-right font-bold text-primary-700">{formatCurrency(data.closing_balance)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
