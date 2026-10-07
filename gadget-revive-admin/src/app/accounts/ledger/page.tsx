'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { RefreshCw, Search, BookOpen, CheckCircle2, AlertTriangle, Wallet, Download } from 'lucide-react';
import { AdminLayout } from '@/components/layout';
import { Button, SearchableSelect, LoadingSpinner, EmptyState, ErrorState, InfoButton, StepFlow } from '@/components/ui';
import { DateRange, DateRangeBar, KpiTile, presetRange, chipClass } from '@/components/reports/shared';
import { ChartOfAccount, AccountLedger, AccountLedgerLine } from '@/types';
import { downloadBlob, formatCurrency, formatDate, getErrorMessage } from '@/lib/utils';
import adminService from '@/lib/adminService';

type Direction = 'all' | 'debit' | 'credit';

interface LedgerResponse extends AccountLedger {
  opening_balance: number;
  total_debit: number;
  total_credit: number;
  closing_balance: number;
  lines: (AccountLedgerLine & { journal_entry_id?: number })[];
}

const PRESETS: DateRange['preset'][] = ['today', 'month', 'last_month', 'year', 'custom'];

const TYPE_TONE: Record<string, string> = {
  asset: 'bg-sky-50 text-sky-700 border-sky-200',
  liability: 'bg-amber-50 text-amber-700 border-amber-200',
  equity: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  revenue: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  expense: 'bg-rose-50 text-rose-700 border-rose-200',
};

export default function GeneralLedgerPage() {
  const [accounts, setAccounts] = useState<ChartOfAccount[]>([]);
  const [accountId, setAccountId] = useState<number | ''>('');
  const [range, setRange] = useState<DateRange>(() => presetRange('year'));
  const [direction, setDirection] = useState<Direction>('all');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [ledger, setLedger] = useState<LedgerResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    adminService.getAccounts({ is_active: true })
      .then((res) => {
        const list = (res.data?.data ?? []) as ChartOfAccount[];
        setAccounts(list);
        const requested = Number(new URLSearchParams(window.location.search).get('account'));
        if (requested && list.some((a) => a.id === requested)) setAccountId(requested);
      })
      .catch(() => setAccounts([]));
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchInput.trim().toLowerCase()), 250);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const fetchLedger = useCallback(async () => {
    if (!accountId) return;
    if (range.start && range.end && range.start > range.end) {
      toast.error('The start date must be on or before the end date.');
      return;
    }
    setIsLoading(true);
    setError(false);
    try {
      const res = await adminService.getAccountLedger(accountId, range.start || undefined, range.end || undefined);
      setLedger(res.data?.data as unknown as LedgerResponse);
    } catch (err) {
      toast.error(getErrorMessage(err));
      setError(true);
    } finally {
      setIsLoading(false);
    }
  }, [accountId, range]);

  useEffect(() => { fetchLedger(); }, [fetchLedger]);

  const account = ledger?.account ?? null;
  const isDebitNormal = account?.normal_balance === 'debit';

  const visibleLines = useMemo(() => {
    if (!ledger) return [];
    return ledger.lines.filter(
      (l) =>
        (direction === 'all' || (direction === 'debit' ? l.debit > 0 : l.credit > 0)) &&
        (!search || l.entry_number.toLowerCase().includes(search) || (l.description ?? '').toLowerCase().includes(search))
    );
  }, [ledger, direction, search]);

  const netMovement = ledger ? (isDebitNormal ? ledger.total_debit - ledger.total_credit : ledger.total_credit - ledger.total_debit) : 0;
  const reconciles = ledger ? Math.abs(ledger.opening_balance + netMovement - ledger.closing_balance) < 0.005 : true;

  const accountOptions = accounts.map((a) => ({
    value: a.id,
    label: `${a.code} — ${a.name}`,
    description: `${a.type} · normal ${a.normal_balance}`,
  }));

  const handleExport = () => {
    if (!ledger || !account) return;
    const header = ['Date', 'Entry', 'Description', 'Debit', 'Credit', 'Running balance'];
    const rows = [
      ['', '', 'Opening balance', '', '', ledger.opening_balance.toFixed(2)],
      ...visibleLines.map((l) => [l.date, l.entry_number, l.description ?? '', l.debit.toFixed(2), l.credit.toFixed(2), l.running_balance.toFixed(2)]),
      ['', '', 'Closing balance', ledger.total_debit.toFixed(2), ledger.total_credit.toFixed(2), ledger.closing_balance.toFixed(2)],
    ];
    const csv = [header, ...rows]
      .map((row) => row.map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(','))
      .join('\r\n');
    downloadBlob(new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8' }), `ledger-${account.code}-${range.end || 'all'}.csv`);
  };

  return (
    <AdminLayout>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2.5">
          <h1 className="text-lg font-bold text-gray-900">General ledger</h1>
          <span className="text-xs text-gray-500">Every posting to one account, with a running balance</span>
          <InfoButton title="How the General Ledger Works">
            <p>
              The general ledger is like a bank statement for one specific account — it lists every journal line
              posted to that account, in date order, with a <strong>running balance</strong> after each one.
            </p>
            <p>
              The running balance starts from the account&apos;s balance on the day before the range, so the figures stay correct
              when you narrow the dates. For a debit-normal account (like Cash), debits increase the balance and credits reduce it;
              for a credit-normal account (like Accounts Payable), it&apos;s the other way around.
            </p>
            <div>
              <p className="mb-2 font-semibold text-gray-900">How to use this page</p>
              <StepFlow steps={[
                'Pick an account from the dropdown (e.g. "1000 — Cash").',
                'Choose a date range. Opening balance is what the account held before it.',
                'Use the direction and search filters to find a posting. Entry numbers open the full journal entry.',
              ]} />
            </div>
            <p className="text-xs text-gray-500">
              This is a read-only view — to change an account&apos;s balance you post a new journal entry, either automatically
              (via an order, expense, or purchase) or manually from the Journal Entries page.
            </p>
          </InfoButton>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={handleExport} disabled={!ledger} leftIcon={<Download className="h-3.5 w-3.5" />}>Export CSV</Button>
          <Button size="sm" variant="ghost" onClick={fetchLedger} disabled={!accountId} leftIcon={<RefreshCw className="h-3.5 w-3.5" />}>Refresh</Button>
        </div>
      </div>

      <div className="mb-3 space-y-2.5 rounded-xl border border-gray-200 bg-white p-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="w-64 max-w-full">
            <SearchableSelect
              placeholder="Choose an account…"
              searchPlaceholder="Search by code or name…"
              options={accountOptions}
              value={accountId}
              onChange={(v) => setAccountId(Number(v))}
            />
          </div>
          <DateRangeBar range={range} onChange={setRange} presets={PRESETS} />
        </div>
        {accountId && (
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex gap-1.5">
              {([
                { value: 'all', label: 'All lines' },
                { value: 'debit', label: 'Debits only' },
                { value: 'credit', label: 'Credits only' },
              ] as const).map((d) => (
                <button key={d.value} type="button" onClick={() => setDirection(d.value)} className={chipClass(direction === d.value)}>
                  {d.label}
                </button>
              ))}
            </div>
            <div className="relative min-w-[220px] flex-1">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
              <input
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search entry number or description…"
                className="h-8 w-full rounded-lg border border-gray-300 pl-8 pr-3 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>
        )}
      </div>

      {!accountId ? (
        <div className="overflow-hidden rounded-xl border border-dashed border-gray-300 bg-white">
          <EmptyState icon={<BookOpen className="h-8 w-8 text-gray-400" />} title="Pick an account to see its ledger" description="Every posting and the running balance appear here." />
        </div>
      ) : isLoading && !ledger ? (
        <div className="flex justify-center py-16"><LoadingSpinner /></div>
      ) : error || !ledger ? (
        <ErrorState message="Failed to load the ledger." onRetry={fetchLedger} />
      ) : (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
            <KpiTile label="Opening balance" value={formatCurrency(ledger.opening_balance)} tone="sky" icon={<Wallet className="h-4 w-4 opacity-60" />} sub={range.start ? `Before ${formatDate(range.start)}` : 'Start of the books'} />
            <KpiTile label="Debits in range" value={formatCurrency(ledger.total_debit)} tone="emerald" sub={`${ledger.lines.length} posting${ledger.lines.length === 1 ? '' : 's'}`} />
            <KpiTile label="Credits in range" value={formatCurrency(ledger.total_credit)} tone="amber" sub="Credit side of the postings" />
            <KpiTile
              label="Closing balance"
              value={formatCurrency(ledger.closing_balance)}
              tone={ledger.closing_balance < 0 ? 'rose' : 'indigo'}
              icon={reconciles ? <CheckCircle2 className="h-4 w-4 opacity-60" /> : <AlertTriangle className="h-4 w-4 opacity-60" />}
              sub={reconciles ? 'Opening + movement = closing' : 'Does not reconcile — check the postings'}
            />
          </div>

          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 px-4 py-2.5">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-sm font-semibold text-gray-900">{account ? `${account.code} — ${account.name}` : 'Ledger'}</h2>
                  {account && (
                    <>
                      <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold capitalize ${TYPE_TONE[account.type] ?? 'bg-slate-100 text-slate-700 border-slate-200'}`}>{account.type}</span>
                      <span className="rounded-full border border-gray-200 bg-gray-50 px-2 py-0.5 text-[11px] font-semibold capitalize text-gray-600">normal {account.normal_balance}</span>
                    </>
                  )}
                </div>
                <p className="text-[11px] text-gray-500">
                  {range.start ? `${formatDate(range.start)} to ${range.end ? formatDate(range.end) : 'today'}` : 'All postings to date'} · running balance in the normal direction
                </p>
              </div>
              {direction !== 'all' || search ? (
                <span className="text-[11px] font-semibold text-amber-700">Showing {visibleLines.length} of {ledger.lines.length} postings</span>
              ) : null}
            </div>
            <div className="max-h-[calc(100vh-30rem)] overflow-auto">
              <table className="min-w-full text-sm">
                <thead className="sticky top-0 z-10 bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500 shadow-[0_1px_0_0_rgb(226,232,240)]">
                  <tr>
                    <th className="whitespace-nowrap px-3 py-2 text-left font-semibold">Date</th>
                    <th className="px-3 py-2 text-left font-semibold">Entry</th>
                    <th className="px-3 py-2 text-left font-semibold">Description</th>
                    <th className="px-3 py-2 text-right font-semibold">Debit</th>
                    <th className="px-3 py-2 text-right font-semibold">Credit</th>
                    <th className="px-3 py-2 text-right font-semibold">Running balance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  <tr className="bg-sky-50/60">
                    <td className="px-3 py-2 text-xs tabular-nums text-gray-600">{range.start ? formatDate(range.start) : '—'}</td>
                    <td className="px-3 py-2 text-xs text-gray-400">—</td>
                    <td className="px-3 py-2 font-semibold text-gray-800">Opening balance</td>
                    <td className="px-3 py-2 text-right text-gray-300">—</td>
                    <td className="px-3 py-2 text-right text-gray-300">—</td>
                    <td className="px-3 py-2 text-right font-semibold tabular-nums text-gray-800">{formatCurrency(ledger.opening_balance)}</td>
                  </tr>
                  {visibleLines.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-3 py-6 text-center text-xs text-gray-400">
                        {ledger.lines.length === 0 ? 'No postings to this account in the selected range.' : 'No postings match these filters.'}
                      </td>
                    </tr>
                  )}
                  {visibleLines.map((line, i) => (
                    <tr key={`${line.entry_number}-${i}`} className={`${i % 2 ? 'bg-slate-50/40' : 'bg-white'} hover:bg-indigo-50/40`}>
                      <td className="whitespace-nowrap px-3 py-1.5 text-xs tabular-nums text-gray-600">{formatDate(line.date)}</td>
                      <td className="whitespace-nowrap px-3 py-1.5 font-mono text-xs">
                        {line.journal_entry_id ? (
                          <Link href={`/accounts/journal/${line.journal_entry_id}`} className="font-semibold text-indigo-700 hover:underline">{line.entry_number}</Link>
                        ) : (
                          <span className="text-gray-700">{line.entry_number}</span>
                        )}
                      </td>
                      <td className="px-3 py-1.5 text-gray-800">{line.description}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums text-gray-900">{line.debit > 0 ? formatCurrency(line.debit) : '—'}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums text-gray-900">{line.credit > 0 ? formatCurrency(line.credit) : '—'}</td>
                      <td className={`px-3 py-1.5 text-right font-semibold tabular-nums ${line.running_balance < 0 ? 'text-rose-600' : 'text-gray-900'}`}>
                        {formatCurrency(line.running_balance)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="sticky bottom-0 bg-slate-50">
                  <tr className="border-t-2 border-gray-300 text-sm font-semibold text-gray-800">
                    <td className="px-3 py-2" colSpan={3}>Period totals</td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(ledger.total_debit)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(ledger.total_credit)}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-right text-xs tabular-nums text-gray-500">net {netMovement >= 0 ? '+' : '−'}{formatCurrency(Math.abs(netMovement))}</td>
                  </tr>
                  <tr className="bg-indigo-50/60 text-sm font-bold text-indigo-800">
                    <td className="px-3 py-2.5" colSpan={5}>Closing balance{range.end ? ` as of ${formatDate(range.end)}` : ''}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{formatCurrency(ledger.closing_balance)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
