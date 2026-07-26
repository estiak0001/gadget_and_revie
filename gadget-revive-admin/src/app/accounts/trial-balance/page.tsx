'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { RefreshCw } from 'lucide-react';
import { AdminLayout } from '@/components/layout';
import { Card, CardContent, CardHeader, CardTitle, Button, LoadingSpinner, ErrorState, InfoButton, StepFlow } from '@/components/ui';
import { TrialBalance } from '@/types';
import { formatCurrency, getErrorMessage } from '@/lib/utils';
import adminService from '@/lib/adminService';
import toast from 'react-hot-toast';

export default function TrialBalancePage() {
  const [asOf, setAsOf] = useState(new Date().toISOString().split('T')[0]);
  const [data, setData] = useState<TrialBalance | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(false);
    try {
      const res = await adminService.getTrialBalance(asOf);
      setData(res.data?.data ?? null);
    } catch (err) {
      toast.error(getErrorMessage(err));
      setError(true);
    } finally {
      setIsLoading(false);
    }
  }, [asOf]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const isBalanced = data ? data.total_debit === data.total_credit : true;

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-gray-900">Trial Balance</h1>
            <InfoButton title="How the Trial Balance Works">
              <p>
                The trial balance lists <strong>every account</strong> and its balance as of one date, split into a
                Debit column and a Credit column. It&apos;s the fundamental sanity check of double-entry bookkeeping:
                because every transaction posts equal debits and credits, the two column totals must always match.
              </p>
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-center">
                <p className="font-mono text-base font-semibold text-gray-900">Total Debits = Total Credits</p>
                <p className="text-xs text-gray-500 mt-1">If they ever don&apos;t match, something in the ledger is broken.</p>
              </div>
              <div>
                <p className="font-semibold text-gray-900 mb-2">How to use this page</p>
                <StepFlow steps={[
                  'Pick an "As of" date — the report includes every journal entry dated on or before it.',
                  'Scan the totals row at the bottom: Debit total should equal Credit total (shown in green).',
                  'Click "Refresh" after posting new transactions elsewhere to update the figures.',
                ]} />
              </div>
              <p className="text-xs text-gray-500">
                This report is calculated automatically from posted journal entries — there is nothing to type in here.
              </p>
            </InfoButton>
          </div>
          <p className="text-sm text-gray-500 mt-1">Every account&apos;s debit/credit balance as of a given date.</p>
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

        <Card>
          <CardHeader>
            <CardTitle>Balances as of {data?.as_of}</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center py-12"><LoadingSpinner /></div>
            ) : error || !data ? (
              <ErrorState message="Failed to load trial balance." onRetry={fetchData} />
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200 text-left">
                        <th className="pb-3 pr-4 font-semibold text-gray-600">Code</th>
                        <th className="pb-3 pr-4 font-semibold text-gray-600">Account</th>
                        <th className="pb-3 pr-4 font-semibold text-gray-600">Type</th>
                        <th className="pb-3 pr-4 font-semibold text-gray-600 text-right">Debit</th>
                        <th className="pb-3 font-semibold text-gray-600 text-right">Credit</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {data.accounts.map((row) => (
                        <tr key={row.code}>
                          <td className="py-3 pr-4 font-mono text-gray-500">{row.code}</td>
                          <td className="py-3 pr-4 text-gray-900">{row.name}</td>
                          <td className="py-3 pr-4 text-gray-500 capitalize">{row.type}</td>
                          <td className="py-3 pr-4 text-right text-gray-900">
                            {row.debit > 0 ? formatCurrency(row.debit) : ''}
                          </td>
                          <td className="py-3 text-right text-gray-900">
                            {row.credit > 0 ? formatCurrency(row.credit) : ''}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 border-gray-300 font-semibold">
                        <td className="pt-3 pr-4" colSpan={3}>Total</td>
                        <td className="pt-3 pr-4 text-right">{formatCurrency(data.total_debit)}</td>
                        <td className="pt-3 text-right">{formatCurrency(data.total_credit)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
                <div className={`mt-4 rounded-md p-3 text-sm font-medium ${isBalanced ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                  {isBalanced ? '✓ Debits equal credits — books are balanced.' : '⚠ Debits and credits do not match — this indicates data corruption.'}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
