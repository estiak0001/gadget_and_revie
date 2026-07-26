'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { RefreshCw, Wallet, ArrowDownCircle, ArrowUpCircle } from 'lucide-react';
import { AdminLayout } from '@/components/layout';
import { Card, CardContent, CardHeader, CardTitle, Button, LoadingSpinner, ErrorState, InfoButton, StepFlow } from '@/components/ui';
import { CashPosition } from '@/types';
import { formatCurrency, getErrorMessage } from '@/lib/utils';
import adminService from '@/lib/adminService';
import toast from 'react-hot-toast';

const today = new Date().toISOString().split('T')[0];
const firstOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];

export default function CashPositionPage() {
  const [from, setFrom] = useState(firstOfMonth);
  const [to, setTo] = useState(today);
  const [data, setData] = useState<CashPosition | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(false);
    try {
      const res = await adminService.getCashPosition(from, to);
      setData(res.data?.data ?? null);
    } catch (err) {
      toast.error(getErrorMessage(err));
      setError(true);
    } finally {
      setIsLoading(false);
    }
  }, [from, to]);

  useEffect(() => { fetchData(); }, [fetchData]);

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-gray-900">Cash Position</h1>
            <InfoButton title="How Cash Position Works">
              <p>
                This shows how much cash the business had at the <strong>start</strong> of a period (Opening
                Balance), how much moved in and out, and how much it has at the <strong>end</strong> (Closing
                Balance) — a simple cash book / reconciliation view.
              </p>
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-center">
                <p className="font-mono text-sm font-semibold text-gray-900">Opening + Cash In − Cash Out = Closing</p>
              </div>
              <p>
                Opening Balance is the Cash account&apos;s balance as of the day before your selected start date —
                i.e. everything that happened before this period. Closing Balance is the Cash account&apos;s balance
                as of your end date.
              </p>
              <div>
                <p className="font-semibold text-gray-900 mb-2">How to use this page</p>
                <StepFlow steps={[
                  'Pick a From/To date range — e.g. a day, week, or month.',
                  'Opening Balance is what you started that period with.',
                  'Cash In / Cash Out show total receipts and payments through the Cash account in that window.',
                  'Closing Balance is what you actually have on hand at the end of the period.',
                ]} />
              </div>
            </InfoButton>
          </div>
          <p className="text-sm text-gray-500 mt-1">
            Opening and closing cash balance for a period, with total cash in/out in between.
          </p>
        </div>

        <Card>
          <CardContent className="pt-4 flex flex-wrap items-end gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">From</label>
              <input
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                className="rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">To</label>
              <input
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
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
          <ErrorState message="Failed to load cash position." onRetry={fetchData} />
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card>
                <CardContent className="pt-4">
                  <p className="text-xs text-gray-500 uppercase tracking-wide">Opening Balance</p>
                  <p className="text-xl font-bold text-gray-900 mt-1">{formatCurrency(data.opening_balance)}</p>
                  <p className="text-xs text-gray-400 mt-1">as of {from}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2">
                    <ArrowUpCircle className="w-4 h-4 text-green-600" />
                    <p className="text-xs text-gray-500 uppercase tracking-wide">Cash In</p>
                  </div>
                  <p className="text-xl font-bold text-green-700 mt-1">{formatCurrency(data.cash_in)}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2">
                    <ArrowDownCircle className="w-4 h-4 text-red-600" />
                    <p className="text-xs text-gray-500 uppercase tracking-wide">Cash Out</p>
                  </div>
                  <p className="text-xl font-bold text-red-700 mt-1">{formatCurrency(data.cash_out)}</p>
                </CardContent>
              </Card>
              <Card className="border-primary-200 bg-primary-50/40">
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2">
                    <Wallet className="w-4 h-4 text-primary-600" />
                    <p className="text-xs text-gray-500 uppercase tracking-wide">Closing Balance</p>
                  </div>
                  <p className="text-xl font-bold text-primary-700 mt-1">{formatCurrency(data.closing_balance)}</p>
                  <p className="text-xs text-gray-400 mt-1">as of {to}</p>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader><CardTitle>Reconciliation</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                <div className="flex items-center justify-between text-sm text-gray-600">
                  <span>Opening Balance</span>
                  <span>{formatCurrency(data.opening_balance)}</span>
                </div>
                <div className="flex items-center justify-between text-sm text-green-700">
                  <span>+ Cash In</span>
                  <span>{formatCurrency(data.cash_in)}</span>
                </div>
                <div className="flex items-center justify-between text-sm text-red-700">
                  <span>− Cash Out</span>
                  <span>{formatCurrency(data.cash_out)}</span>
                </div>
                <div className="border-t pt-2 flex items-center justify-between text-sm font-semibold text-gray-900">
                  <span>= Closing Balance</span>
                  <span>{formatCurrency(data.closing_balance)}</span>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </AdminLayout>
  );
}
