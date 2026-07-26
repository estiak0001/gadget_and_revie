'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { RefreshCw } from 'lucide-react';
import { AdminLayout } from '@/components/layout';
import { Card, CardContent, CardHeader, CardTitle, Button, DateRangePicker, LoadingSpinner, ErrorState, InfoButton, StepFlow } from '@/components/ui';
import { IncomeStatement } from '@/types';
import { formatCurrency, getErrorMessage } from '@/lib/utils';
import adminService from '@/lib/adminService';
import toast from 'react-hot-toast';

const startOfMonth = () => {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split('T')[0];
};

export default function IncomeStatementPage() {
  const [fromDate, setFromDate] = useState(startOfMonth());
  const [toDate, setToDate] = useState(new Date().toISOString().split('T')[0]);
  const [data, setData] = useState<IncomeStatement | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(false);
    try {
      const res = await adminService.getIncomeStatement(fromDate, toDate);
      setData(res.data?.data ?? null);
    } catch (err) {
      toast.error(getErrorMessage(err));
      setError(true);
    } finally {
      setIsLoading(false);
    }
  }, [fromDate, toDate]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const netIncome = data?.net_income ?? 0;

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-gray-900">Income Statement</h1>
            <InfoButton title="How the Income Statement Works">
              <p>
                Also called a <strong>Profit &amp; Loss (P&amp;L)</strong> statement, this shows how much the business
                earned and spent over a period of time, and whether it made a profit or a loss.
              </p>
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-center">
                <p className="font-mono text-base font-semibold text-gray-900">Revenue − Expenses = Net Income</p>
                <p className="text-xs text-gray-500 mt-1">A negative result is a net loss, shown in red.</p>
              </div>
              <p>
                Unlike the Trial Balance or Balance Sheet (which are snapshots as of one date), this report only
                counts activity <em>between</em> the two dates you choose — it answers &quot;how did we do this month?&quot;
                rather than &quot;what do we own right now?&quot;
              </p>
              <div>
                <p className="font-semibold text-gray-900 mb-2">How to use this page</p>
                <StepFlow steps={[
                  'Pick a date range, or use a preset like "This Month" or "This Year".',
                  'Review the Revenue and Expenses breakdowns by account.',
                  'Check Net Income at the bottom — green if profitable, red if a loss.',
                ]} />
              </div>
            </InfoButton>
          </div>
          <p className="text-sm text-gray-500 mt-1">Revenue and expenses over a period, with net income.</p>
        </div>

        <Card>
          <CardContent className="pt-4 space-y-3">
            <DateRangePicker startDate={fromDate} endDate={toDate} onStartDateChange={setFromDate} onEndDateChange={setToDate} />
            <Button variant="ghost" size="sm" onClick={fetchData} leftIcon={<RefreshCw className="w-4 h-4" />}>
              Refresh
            </Button>
          </CardContent>
        </Card>

        {isLoading ? (
          <div className="flex justify-center py-12"><LoadingSpinner /></div>
        ) : error || !data ? (
          <ErrorState message="Failed to load income statement." onRetry={fetchData} />
        ) : (
          <>
            <Card>
              <CardHeader><CardTitle>Revenue</CardTitle></CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <tbody className="divide-y divide-gray-100">
                    {data.revenue.map((row) => (
                      <tr key={row.code}>
                        <td className="py-2 pr-4 text-gray-500 font-mono w-20">{row.code}</td>
                        <td className="py-2 pr-4 text-gray-900">{row.name}</td>
                        <td className="py-2 text-right text-gray-900">{formatCurrency(row.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-gray-300 font-semibold">
                      <td className="pt-2 pr-4" colSpan={2}>Total Revenue</td>
                      <td className="pt-2 text-right">{formatCurrency(data.total_revenue)}</td>
                    </tr>
                  </tfoot>
                </table>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Expenses</CardTitle></CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <tbody className="divide-y divide-gray-100">
                    {data.expenses.map((row) => (
                      <tr key={row.code}>
                        <td className="py-2 pr-4 text-gray-500 font-mono w-20">{row.code}</td>
                        <td className="py-2 pr-4 text-gray-900">{row.name}</td>
                        <td className="py-2 text-right text-gray-900">{formatCurrency(row.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-gray-300 font-semibold">
                      <td className="pt-2 pr-4" colSpan={2}>Total Expenses</td>
                      <td className="pt-2 text-right">{formatCurrency(data.total_expenses)}</td>
                    </tr>
                  </tfoot>
                </table>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="py-6">
                <div className={`flex items-center justify-between text-lg font-bold ${netIncome >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  <span>Net Income</span>
                  <span>{formatCurrency(netIncome)}</span>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </AdminLayout>
  );
}
