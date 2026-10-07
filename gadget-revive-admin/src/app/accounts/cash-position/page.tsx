'use client';

import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { RefreshCw, Wallet, ArrowDownCircle, ArrowUpCircle, Landmark, CheckCircle2, AlertTriangle } from 'lucide-react';
import { AdminLayout } from '@/components/layout';
import { Button, LoadingSpinner, ErrorState, InfoButton, StepFlow } from '@/components/ui';
import { DateRange, DateRangeBar, KpiTile, Panel, presetRange } from '@/components/reports/shared';
import { CashPosition } from '@/types';
import { formatCurrency, formatDate, getErrorMessage } from '@/lib/utils';
import adminService from '@/lib/adminService';

const PRESETS: DateRange['preset'][] = ['today', '7d', '30d', 'month', 'last_month', 'custom'];

export default function CashPositionPage() {
  const [range, setRange] = useState<DateRange>(() => presetRange('month'));
  const [data, setData] = useState<CashPosition | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);

  const fetchData = useCallback(async () => {
    if (!range.start || !range.end) return;
    if (range.start > range.end) {
      toast.error('The start date must be on or before the end date.');
      return;
    }
    setIsLoading(true);
    setError(false);
    try {
      const res = await adminService.getCashPosition(range.start, range.end);
      setData(res.data?.data ?? null);
    } catch (err) {
      toast.error(getErrorMessage(err));
      setError(true);
    } finally {
      setIsLoading(false);
    }
  }, [range]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const reconciles = data
    ? Math.abs(data.opening_balance + data.cash_in - data.cash_out - data.closing_balance) < 0.005
    : true;
  const net = data ? data.cash_in - data.cash_out : 0;
  const scale = data ? Math.max(1, data.opening_balance, data.cash_in, data.cash_out, data.closing_balance) : 1;

  return (
    <AdminLayout>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2.5">
          <h1 className="text-lg font-bold text-gray-900">Cash position</h1>
          <span className="text-xs text-gray-500">Cash account 1000 across the selected period</span>
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
              <p className="mb-2 font-semibold text-gray-900">How to use this page</p>
              <StepFlow steps={[
                'Pick a date range — e.g. a day, week, or month.',
                'Opening Balance is what you started that period with.',
                'Cash In / Cash Out show total receipts and payments through the Cash account in that window.',
                'Closing Balance is what you actually have on hand at the end of the period.',
              ]} />
            </div>
          </InfoButton>
        </div>
        <Button size="sm" variant="ghost" onClick={fetchData} leftIcon={<RefreshCw className="h-3.5 w-3.5" />}>Refresh</Button>
      </div>

      <div className="mb-3">
        <DateRangeBar range={range} onChange={setRange} presets={PRESETS} />
      </div>

      {isLoading && !data ? (
        <div className="flex justify-center py-16"><LoadingSpinner /></div>
      ) : error || !data ? (
        <ErrorState message="Failed to load cash position." onRetry={fetchData} />
      ) : (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
            <KpiTile label="Opening balance" value={formatCurrency(data.opening_balance)} tone="sky" icon={<Landmark className="h-4 w-4 opacity-60" />} sub={`As of ${formatDate(range.start)}`} />
            <KpiTile label="Cash in" value={formatCurrency(data.cash_in)} tone="emerald" icon={<ArrowUpCircle className="h-4 w-4 opacity-60" />} sub="Receipts in the period" />
            <KpiTile label="Cash out" value={formatCurrency(data.cash_out)} tone="rose" icon={<ArrowDownCircle className="h-4 w-4 opacity-60" />} sub="Payments in the period" />
            <KpiTile label="Closing balance" value={formatCurrency(data.closing_balance)} tone="indigo" icon={<Wallet className="h-4 w-4 opacity-60" />} sub={`As of ${formatDate(range.end)} · net ${net >= 0 ? '+' : ''}${formatCurrency(net)}`} />
          </div>

          <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
            <Panel title="Cash bridge" hint="Opening → movements → closing" className="lg:col-span-2">
              <div className="space-y-4 p-4">
                {[
                  { label: 'Opening balance', value: data.opening_balance, bar: 'bg-sky-400', sign: '' },
                  { label: 'Cash in', value: data.cash_in, bar: 'bg-emerald-400', sign: '+' },
                  { label: 'Cash out', value: data.cash_out, bar: 'bg-rose-400', sign: '−' },
                  { label: 'Closing balance', value: data.closing_balance, bar: 'bg-indigo-500', sign: '' },
                ].map((row) => (
                  <div key={row.label}>
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-semibold text-gray-800">{row.label}</span>
                      <span className="tabular-nums text-gray-900">{row.sign}{formatCurrency(Math.abs(row.value))}</span>
                    </div>
                    <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-gray-100">
                      <div className={`h-full rounded-full ${row.bar}`} style={{ width: `${(Math.abs(row.value) / scale) * 100}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </Panel>

            <Panel title="Reconciliation" hint="Does the bridge add up?">
              <div className="space-y-2 p-4 text-sm">
                <div className="flex items-center justify-between text-gray-600"><span>Opening</span><span className="tabular-nums">{formatCurrency(data.opening_balance)}</span></div>
                <div className="flex items-center justify-between text-emerald-700"><span>+ Cash in</span><span className="tabular-nums">{formatCurrency(data.cash_in)}</span></div>
                <div className="flex items-center justify-between text-rose-700"><span>− Cash out</span><span className="tabular-nums">{formatCurrency(data.cash_out)}</span></div>
                <div className="flex items-center justify-between border-t border-gray-200 pt-2 font-semibold text-gray-900">
                  <span>= Closing</span>
                  <span className="tabular-nums">{formatCurrency(data.closing_balance)}</span>
                </div>
                <div className={`mt-3 flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold ${
                  reconciles ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                }`}>
                  {reconciles ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
                  {reconciles ? 'Reconciles to the ledger' : 'Does not reconcile — check the cash account'}
                </div>
              </div>
            </Panel>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
