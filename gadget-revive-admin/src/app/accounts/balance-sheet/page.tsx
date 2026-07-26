'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { RefreshCw } from 'lucide-react';
import { AdminLayout } from '@/components/layout';
import { Card, CardContent, CardHeader, CardTitle, Button, LoadingSpinner, ErrorState, InfoButton, StepFlow } from '@/components/ui';
import { BalanceSheet } from '@/types';
import { formatCurrency, getErrorMessage } from '@/lib/utils';
import adminService from '@/lib/adminService';
import toast from 'react-hot-toast';

export default function BalanceSheetPage() {
  const [asOf, setAsOf] = useState(new Date().toISOString().split('T')[0]);
  const [data, setData] = useState<BalanceSheet | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(false);
    try {
      const res = await adminService.getBalanceSheet(asOf);
      setData(res.data?.data ?? null);
    } catch (err) {
      toast.error(getErrorMessage(err));
      setError(true);
    } finally {
      setIsLoading(false);
    }
  }, [asOf]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const isBalanced = data ? Math.round((data.total_assets - (data.total_liabilities + data.total_equity)) * 100) === 0 : true;

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-gray-900">Balance Sheet</h1>
            <InfoButton title="How the Balance Sheet Works">
              <p>
                The balance sheet is a snapshot of what the business <strong>owns</strong> (Assets), what it{' '}
                <strong>owes</strong> (Liabilities), and what&apos;s left for the owner (Equity) — all as of one single date.
              </p>
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-center">
                <p className="font-mono text-base font-semibold text-gray-900">Assets = Liabilities + Equity</p>
                <p className="text-xs text-gray-500 mt-1">This must always hold true — it&apos;s checked visually at the bottom of the page.</p>
              </div>
              <p>
                <strong>Retained Earnings</strong> here is a simplified, computed figure — lifetime revenue minus
                lifetime expenses to date. It is not a formally &quot;closed&quot; period-end balance the way a full
                accounting close would produce, but it keeps the equation balanced for day-to-day use.
              </p>
              <div>
                <p className="font-semibold text-gray-900 mb-2">How to use this page</p>
                <StepFlow steps={[
                  'Pick an "As of" date to see the business\'s financial position on that day.',
                  'Review Assets, Liabilities, and Equity sections.',
                  'Confirm the green "Assets = Liabilities + Equity" check at the bottom.',
                ]} />
              </div>
            </InfoButton>
          </div>
          <p className="text-sm text-gray-500 mt-1">
            Assets, liabilities, and equity as of a date. Retained earnings shown here is a computed, unaudited figure (lifetime revenue minus lifetime expenses) — not a formally closed period-end balance.
          </p>
        </div>

        <Card>
          <CardContent className="pt-4 flex flex-wrap items-end gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">As of</label>
              <input
                type="date"
                value={asOf}
                onChange={(e) => setAsOf(e.target.value)}
                className="rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              />
            </div>
            <Button variant="ghost" size="sm" onClick={fetchData} leftIcon={<RefreshCw className="w-4 h-4" />}>
              Refresh
            </Button>
          </CardContent>
        </Card>

        {isLoading ? (
          <div className="flex justify-center py-12"><LoadingSpinner /></div>
        ) : error || !data ? (
          <ErrorState message="Failed to load balance sheet." onRetry={fetchData} />
        ) : (
          <>
            <Card>
              <CardHeader><CardTitle>Assets</CardTitle></CardHeader>
              <CardContent>
                <table className="w-full text-sm">
                  <tbody className="divide-y divide-gray-100">
                    {data.assets.map((row) => (
                      <tr key={row.code}>
                        <td className="py-2 pr-4 text-gray-500 font-mono w-20">{row.code}</td>
                        <td className="py-2 pr-4 text-gray-900">{row.name}</td>
                        <td className="py-2 text-right text-gray-900">{formatCurrency(row.balance)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-gray-300 font-semibold">
                      <td className="pt-2 pr-4" colSpan={2}>Total Assets</td>
                      <td className="pt-2 text-right">{formatCurrency(data.total_assets)}</td>
                    </tr>
                  </tfoot>
                </table>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Liabilities</CardTitle></CardHeader>
              <CardContent>
                <table className="w-full text-sm">
                  <tbody className="divide-y divide-gray-100">
                    {data.liabilities.map((row) => (
                      <tr key={row.code}>
                        <td className="py-2 pr-4 text-gray-500 font-mono w-20">{row.code}</td>
                        <td className="py-2 pr-4 text-gray-900">{row.name}</td>
                        <td className="py-2 text-right text-gray-900">{formatCurrency(row.balance)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-gray-300 font-semibold">
                      <td className="pt-2 pr-4" colSpan={2}>Total Liabilities</td>
                      <td className="pt-2 text-right">{formatCurrency(data.total_liabilities)}</td>
                    </tr>
                  </tfoot>
                </table>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Equity</CardTitle></CardHeader>
              <CardContent>
                <table className="w-full text-sm">
                  <tbody className="divide-y divide-gray-100">
                    {data.equity.map((row) => (
                      <tr key={row.code}>
                        <td className="py-2 pr-4 text-gray-500 font-mono w-20">{row.code}</td>
                        <td className="py-2 pr-4 text-gray-900">{row.name}</td>
                        <td className="py-2 text-right text-gray-900">{formatCurrency(row.balance)}</td>
                      </tr>
                    ))}
                    <tr>
                      <td className="py-2 pr-4"></td>
                      <td className="py-2 pr-4 text-gray-900">Retained Earnings (computed, undistributed)</td>
                      <td className="py-2 text-right text-gray-900">{formatCurrency(data.computed_retained_earnings)}</td>
                    </tr>
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-gray-300 font-semibold">
                      <td className="pt-2 pr-4" colSpan={2}>Total Equity</td>
                      <td className="pt-2 text-right">{formatCurrency(data.total_equity)}</td>
                    </tr>
                  </tfoot>
                </table>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="py-6 space-y-2">
                <div className="flex items-center justify-between text-sm text-gray-600">
                  <span>Total Assets</span>
                  <span>{formatCurrency(data.total_assets)}</span>
                </div>
                <div className="flex items-center justify-between text-sm text-gray-600">
                  <span>Total Liabilities + Equity</span>
                  <span>{formatCurrency(data.total_liabilities + data.total_equity)}</span>
                </div>
                <div className={`mt-2 rounded-md p-3 text-sm font-medium ${isBalanced ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                  {isBalanced ? '✓ Assets = Liabilities + Equity' : '⚠ Balance sheet does not balance — investigate.'}
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </AdminLayout>
  );
}
