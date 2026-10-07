'use client';

import { useEffect, useMemo, useState, useCallback } from 'react';
import toast from 'react-hot-toast';
import { RefreshCw, Download, Search, CheckCircle2, AlertTriangle, Scale, ListChecks } from 'lucide-react';
import { AdminLayout } from '@/components/layout';
import { Button, LoadingSpinner, ErrorState, EmptyState, InfoButton, StepFlow } from '@/components/ui';
import { KpiTile, ymd } from '@/components/reports/shared';
import { TrialBalance, AccountType } from '@/types';
import { downloadBlob, formatCurrency, getErrorMessage } from '@/lib/utils';
import adminService from '@/lib/adminService';

type Row = TrialBalance['accounts'][number];

const TYPE_ORDER: AccountType[] = ['asset', 'liability', 'equity', 'revenue', 'expense'];
const TYPE_LABEL: Record<AccountType, string> = {
  asset: 'Assets', liability: 'Liabilities', equity: 'Equity', revenue: 'Revenue', expense: 'Expenses',
};
const TYPE_CHIP: Record<AccountType, string> = {
  asset: 'border-sky-200 bg-sky-50 text-sky-700',
  liability: 'border-amber-200 bg-amber-50 text-amber-700',
  equity: 'border-indigo-200 bg-indigo-50 text-indigo-700',
  revenue: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  expense: 'border-rose-200 bg-rose-50 text-rose-700',
};

function lastMonthEnd(): string {
  const now = new Date();
  return ymd(new Date(now.getFullYear(), now.getMonth(), 0));
}

function lastYearEnd(): string {
  return `${new Date().getFullYear() - 1}-12-31`;
}

export default function TrialBalancePage() {
  const [asOf, setAsOf] = useState(() => ymd(new Date()));
  const [data, setData] = useState<TrialBalance | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);
  const [typeFilter, setTypeFilter] = useState<AccountType | ''>('');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [hideZero, setHideZero] = useState(true);

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

  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchInput.trim().toLowerCase()), 250);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const isBalanced = data ? Math.abs(data.total_debit - data.total_credit) < 0.005 : true;
  const difference = data ? Math.round((data.total_debit - data.total_credit) * 100) / 100 : 0;
  const accountsWithBalance = data ? data.accounts.filter((r) => r.debit > 0 || r.credit > 0).length : 0;

  const visible = useMemo(() => {
    if (!data) return [];
    return data.accounts.filter(
      (r) =>
        (!typeFilter || r.type === typeFilter) &&
        (!hideZero || r.debit > 0 || r.credit > 0) &&
        (!search || r.code.toLowerCase().includes(search) || r.name.toLowerCase().includes(search))
    );
  }, [data, typeFilter, hideZero, search]);

  const groups = useMemo(
    () =>
      TYPE_ORDER.map((type) => {
        const rows = visible.filter((r) => r.type === type);
        return {
          type,
          rows,
          debit: rows.reduce((n, r) => n + r.debit, 0),
          credit: rows.reduce((n, r) => n + r.credit, 0),
        };
      }).filter((g) => g.rows.length > 0),
    [visible]
  );

  const filtered = !!typeFilter || !!search || !hideZero;
  const visibleDebit = visible.reduce((n, r) => n + r.debit, 0);
  const visibleCredit = visible.reduce((n, r) => n + r.credit, 0);

  const handleExport = () => {
    if (!data) return;
    const header = ['Code', 'Account', 'Type', 'Debit', 'Credit'];
    const lines = visible.map((r) => [r.code, r.name, r.type, r.debit.toFixed(2), r.credit.toFixed(2)]);
    lines.push(['', 'Total', '', visibleDebit.toFixed(2), visibleCredit.toFixed(2)]);
    const csv = [header, ...lines]
      .map((row) => row.map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(','))
      .join('\r\n');
    downloadBlob(new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8' }), `trial-balance-${data.as_of}.csv`);
  };

  return (
    <AdminLayout>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2.5">
          <h1 className="text-lg font-bold text-gray-900">Trial balance</h1>
          {data && <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-semibold text-gray-600">as of {data.as_of}</span>}
          <InfoButton title="How the Trial Balance Works">
            <p>
              The trial balance lists <strong>every account</strong> and its balance as of one date, split into a
              Debit column and a Credit column. It&apos;s the fundamental sanity check of double-entry bookkeeping:
              because every transaction posts equal debits and credits, the two column totals must always match.
            </p>
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-center">
              <p className="font-mono text-base font-semibold text-gray-900">Total Debits = Total Credits</p>
              <p className="mt-1 text-xs text-gray-500">If they ever don&apos;t match, something in the ledger is broken.</p>
            </div>
            <div>
              <p className="mb-2 font-semibold text-gray-900">How to use this page</p>
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
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={handleExport} disabled={!data} leftIcon={<Download className="h-3.5 w-3.5" />}>Export CSV</Button>
          <Button size="sm" variant="ghost" onClick={fetchData} leftIcon={<RefreshCw className="h-3.5 w-3.5" />}>Refresh</Button>
        </div>
      </div>

      <div className="mb-3 space-y-2 rounded-xl border border-gray-200 bg-white p-2.5">
        <div className="flex flex-wrap items-center gap-2">
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
          <div className="relative ml-auto min-w-[200px] flex-1 lg:max-w-xs">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
            <input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search code or name…"
              className="h-8 w-full rounded-lg border border-gray-300 pl-8 pr-3 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <button
            type="button"
            onClick={() => setHideZero((v) => !v)}
            className={`rounded-full border px-2.5 py-1 text-xs font-semibold transition-colors ${
              hideZero ? 'border-slate-700 bg-slate-700 text-white' : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
            }`}
          >
            Hide zero balances
          </button>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => setTypeFilter('')}
            className={`rounded-full border px-2.5 py-1 text-xs font-semibold transition-colors ${
              typeFilter === '' ? 'border-indigo-600 bg-indigo-600 text-white' : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
            }`}
          >
            All types
          </button>
          {TYPE_ORDER.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTypeFilter(typeFilter === t ? '' : t)}
              className={`rounded-full border px-2.5 py-1 text-xs font-semibold transition-colors ${
                typeFilter === t ? 'border-indigo-600 bg-indigo-600 text-white' : TYPE_CHIP[t]
              }`}
            >
              {TYPE_LABEL[t]}
            </button>
          ))}
        </div>
      </div>

      {isLoading && !data ? (
        <div className="flex justify-center py-16"><LoadingSpinner /></div>
      ) : error || !data ? (
        <ErrorState message="Failed to load the trial balance." onRetry={fetchData} />
      ) : (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
            <KpiTile label="Total debits" value={formatCurrency(data.total_debit)} tone="sky" icon={<Scale className="h-4 w-4 opacity-60" />} sub="All accounts" />
            <KpiTile label="Total credits" value={formatCurrency(data.total_credit)} tone="indigo" icon={<Scale className="h-4 w-4 opacity-60" />} sub="All accounts" />
            <KpiTile
              label="Difference"
              value={formatCurrency(difference)}
              tone={isBalanced ? 'emerald' : 'rose'}
              icon={isBalanced ? <CheckCircle2 className="h-4 w-4 opacity-60" /> : <AlertTriangle className="h-4 w-4 opacity-60" />}
              sub={isBalanced ? 'Books are balanced' : 'Debits and credits do not match'}
            />
            <KpiTile label="Accounts with balances" value={String(accountsWithBalance)} tone="amber" icon={<ListChecks className="h-4 w-4 opacity-60" />} sub={`of ${data.accounts.length} active accounts`} />
          </div>

          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
            {visible.length === 0 ? (
              <EmptyState title="No accounts to show" description="Clear a filter or turn off “Hide zero balances”." />
            ) : (
              <div className="max-h-[calc(100vh-28rem)] overflow-auto">
                <table className="min-w-full text-sm">
                  <thead className="sticky top-0 z-10 bg-slate-50 text-xs uppercase tracking-wide text-slate-500 shadow-[0_1px_0_0_rgb(226,232,240)]">
                    <tr>
                      <th className="px-3 py-2 text-left font-semibold">Code</th>
                      <th className="px-3 py-2 text-left font-semibold">Account</th>
                      <th className="px-3 py-2 text-right font-semibold">Debit</th>
                      <th className="px-3 py-2 text-right font-semibold">Credit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {groups.map((g) => (
                      <GroupRows key={g.type} type={g.type} rows={g.rows} debit={g.debit} credit={g.credit} />
                    ))}
                  </tbody>
                  <tfoot className="sticky bottom-0 bg-slate-50">
                    <tr className="border-t-2 border-gray-300 text-sm font-bold">
                      <td className="px-3 py-2.5" colSpan={2}>{filtered ? 'Total (filtered view)' : 'Total'}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-gray-900">{formatCurrency(filtered ? visibleDebit : data.total_debit)}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-gray-900">{formatCurrency(filtered ? visibleCredit : data.total_credit)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>

          <div className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold ${
            isBalanced ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-rose-200 bg-rose-50 text-rose-700'
          }`}>
            {isBalanced ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
            {isBalanced
              ? 'Debits equal credits — the books are balanced.'
              : 'Debits and credits do not match — this points to data corruption in the ledger.'}
          </div>
        </div>
      )}
    </AdminLayout>
  );
}

function GroupRows({ type, rows, debit, credit }: { type: AccountType; rows: Row[]; debit: number; credit: number }) {
  return (
    <>
      <tr className="bg-slate-100/70">
        <td colSpan={2} className="px-3 py-1.5">
          <span className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold ${TYPE_CHIP[type]}`}>{TYPE_LABEL[type]}</span>
        </td>
        <td className="px-3 py-1.5 text-right text-xs font-semibold tabular-nums text-gray-700">{formatCurrency(debit)}</td>
        <td className="px-3 py-1.5 text-right text-xs font-semibold tabular-nums text-gray-700">{formatCurrency(credit)}</td>
      </tr>
      {rows.map((r, i) => (
        <tr key={r.code} className={`${i % 2 ? 'bg-white' : 'bg-slate-50/40'} hover:bg-indigo-50/40`}>
          <td className="px-3 py-1.5 font-mono text-xs text-gray-600">{r.code}</td>
          <td className="px-3 py-1.5 text-gray-900">{r.name}</td>
          <td className="px-3 py-1.5 text-right tabular-nums text-gray-900">{r.debit > 0 ? formatCurrency(r.debit) : '—'}</td>
          <td className="px-3 py-1.5 text-right tabular-nums text-gray-900">{r.credit > 0 ? formatCurrency(r.credit) : '—'}</td>
        </tr>
      ))}
    </>
  );
}
