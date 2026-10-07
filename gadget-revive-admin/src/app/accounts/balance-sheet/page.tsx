'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { RefreshCw, Landmark, Scale, Wallet, CheckCircle2, AlertTriangle } from 'lucide-react';
import { AdminLayout } from '@/components/layout';
import { Button, LoadingSpinner, ErrorState, EmptyState, InfoButton, StepFlow } from '@/components/ui';
import { KpiTile, Panel, ymd } from '@/components/reports/shared';
import { BalanceSheet } from '@/types';
import { formatCurrency, getErrorMessage } from '@/lib/utils';
import adminService from '@/lib/adminService';

type Line = { code: string; name: string; balance: number };

function lastMonthEnd(): string {
  const now = new Date();
  return ymd(new Date(now.getFullYear(), now.getMonth(), 0));
}

function lastYearEnd(): string {
  return `${new Date().getFullYear() - 1}-12-31`;
}

function Column({
  title, lines, total, extra, tone,
}: {
  title: string;
  lines: Line[];
  total: number;
  extra?: { label: string; value: number };
  tone: string;
}) {
  const shown = lines.filter((l) => Math.abs(l.balance) > 0.004);
  return (
    <Panel
      title={title}
      right={<span className={`text-sm font-bold tabular-nums ${tone}`}>{formatCurrency(total)}</span>}
    >
      <div className="p-3">
        {shown.length === 0 && !extra ? (
          <p className="py-6 text-center text-xs text-gray-400">No balances as of this date.</p>
        ) : (
          <table className="min-w-full text-sm">
            <tbody className="divide-y divide-gray-100">
              {shown.map((l) => (
                <tr key={l.code}>
                  <td className="w-14 py-1.5 font-mono text-[11px] text-gray-400">{l.code}</td>
                  <td className="py-1.5 text-gray-800">{l.name}</td>
                  <td className={`py-1.5 text-right tabular-nums ${l.balance < 0 ? 'text-rose-600' : 'text-gray-900'}`}>{formatCurrency(l.balance)}</td>
                </tr>
              ))}
              {extra && (
                <tr className="bg-amber-50/50">
                  <td className="w-14 py-1.5 text-[11px] text-amber-600">calc</td>
                  <td className="py-1.5 text-gray-800">
                    {extra.label}
                    <span className="ml-1.5 rounded bg-amber-100 px-1 text-[10px] font-semibold text-amber-700">computed</span>
                  </td>
                  <td className={`py-1.5 text-right tabular-nums ${extra.value < 0 ? 'text-rose-600' : 'text-gray-900'}`}>{formatCurrency(extra.value)}</td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </Panel>
  );
}

export default function BalanceSheetPage() {
  const [asOf, setAsOf] = useState(() => ymd(new Date()));
  const [data, setData] = useState<BalanceSheet | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);
  const [hideZero, setHideZero] = useState(true);

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

  const difference = data ? Math.round((data.total_assets - (data.total_liabilities + data.total_equity)) * 100) / 100 : 0;
  const isBalanced = Math.abs(difference) < 0.005;

  const counts = useMemo(() => {
    if (!data) return { lines: 0, total: 0 };
    const all = [...data.assets, ...data.liabilities, ...data.equity];
    return { lines: all.filter((l) => Math.abs(l.balance) > 0.004).length, total: all.length };
  }, [data]);

  const filterLines = (lines: Line[]) => (hideZero ? lines.filter((l) => Math.abs(l.balance) > 0.004) : lines);

  return (
    <AdminLayout>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2.5">
          <h1 className="text-lg font-bold text-gray-900">Balance sheet</h1>
          {data && <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-semibold text-gray-600">as of {data.as_of}</span>}
          <InfoButton title="How the Balance Sheet Works">
            <p>
              The balance sheet is a snapshot of what the business <strong>owns</strong> (Assets), what it{' '}
              <strong>owes</strong> (Liabilities), and what&apos;s left for the owner (Equity) — all as of one single date.
            </p>
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-center">
              <p className="font-mono text-base font-semibold text-gray-900">Assets = Liabilities + Equity</p>
              <p className="mt-1 text-xs text-gray-500">This must always hold true — it&apos;s checked at the bottom of the page.</p>
            </div>
            <p>
              <strong>Retained Earnings</strong> here is a simplified, computed figure — lifetime revenue minus
              lifetime expenses to date. It is not a formally &quot;closed&quot; period-end balance the way a full
              accounting close would produce, but it keeps the equation balanced for day-to-day use.
            </p>
            <div>
              <p className="mb-2 font-semibold text-gray-900">How to use this page</p>
              <StepFlow steps={[
                'Pick an "As of" date to see the business\'s financial position on that day.',
                'Review Assets, Liabilities, and Equity side by side.',
                'Confirm the green "Assets = Liabilities + Equity" check at the bottom.',
              ]} />
            </div>
          </InfoButton>
        </div>
        <Button size="sm" variant="ghost" onClick={fetchData} leftIcon={<RefreshCw className="h-3.5 w-3.5" />}>Refresh</Button>
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-gray-200 bg-white p-2.5">
        <label className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
          As of
          <input
            type="date"
            value={asOf}
            onChange={(e) => setAsOf(e.target.value)}
            className="h-8 w-40 rounded-lg border border-gray-300 px-2 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </label>
        <div className="flex flex-wrap gap-1.5">
          {[
            { label: 'Today', value: ymd(new Date()) },
            { label: 'Last month end', value: lastMonthEnd() },
            { label: 'Last year end', value: lastYearEnd() },
          ].map((p) => (
            <button
              key={p.label}
              type="button"
              onClick={() => setAsOf(p.value)}
              className={`rounded-full border px-2.5 py-1 text-xs font-semibold transition-colors ${
                asOf === p.value ? 'border-indigo-600 bg-indigo-600 text-white' : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setHideZero((v) => !v)}
          className={`ml-auto rounded-full border px-2.5 py-1 text-xs font-semibold transition-colors ${
            hideZero ? 'border-slate-700 bg-slate-700 text-white' : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
          }`}
        >
          Hide zero balances
        </button>
      </div>

      {isLoading && !data ? (
        <div className="flex justify-center py-16"><LoadingSpinner /></div>
      ) : error || !data ? (
        <ErrorState message="Failed to load the balance sheet." onRetry={fetchData} />
      ) : (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
            <KpiTile label="Total assets" value={formatCurrency(data.total_assets)} tone="sky" icon={<Landmark className="h-4 w-4 opacity-60" />} sub="What the business owns" />
            <KpiTile label="Total liabilities" value={formatCurrency(data.total_liabilities)} tone="amber" icon={<Wallet className="h-4 w-4 opacity-60" />} sub="What it owes" />
            <KpiTile label="Total equity" value={formatCurrency(data.total_equity)} tone={data.total_equity < 0 ? 'rose' : 'indigo'} icon={<Scale className="h-4 w-4 opacity-60" />} sub="Owner's share, incl. computed earnings" />
            <KpiTile
              label="Equation check"
              value={isBalanced ? 'Balanced' : formatCurrency(difference)}
              tone={isBalanced ? 'emerald' : 'rose'}
              icon={isBalanced ? <CheckCircle2 className="h-4 w-4 opacity-60" /> : <AlertTriangle className="h-4 w-4 opacity-60" />}
              sub={`${counts.lines} of ${counts.total} accounts with balances`}
            />
          </div>

          {counts.total === 0 ? (
            <EmptyState title="No accounts to show" description="Add accounts in the chart of accounts." />
          ) : (
            <div className="grid grid-cols-1 items-start gap-3 lg:grid-cols-3">
              <Column title="Assets" lines={filterLines(data.assets)} total={data.total_assets} tone="text-sky-700" />
              <Column title="Liabilities" lines={filterLines(data.liabilities)} total={data.total_liabilities} tone="text-amber-700" />
              <Column
                title="Equity"
                lines={filterLines(data.equity)}
                total={data.total_equity}
                extra={{ label: 'Retained earnings (undistributed)', value: data.computed_retained_earnings }}
                tone="text-indigo-700"
              />
            </div>
          )}

          <div className={`flex items-center justify-between gap-3 rounded-lg border px-4 py-3 text-sm ${
            isBalanced ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-rose-200 bg-rose-50 text-rose-700'
          }`}>
            <span className="flex items-center gap-2 font-semibold">
              {isBalanced ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
              {isBalanced ? 'Assets = Liabilities + Equity' : 'The balance sheet does not balance — investigate the ledger.'}
            </span>
            <span className="tabular-nums text-xs">
              {formatCurrency(data.total_assets)} = {formatCurrency(data.total_liabilities + data.total_equity)}
            </span>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
