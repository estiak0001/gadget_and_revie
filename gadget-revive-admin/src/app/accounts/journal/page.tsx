'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { Plus, RefreshCw, Eye, Search, ScrollText, Receipt, AlertTriangle, Undo2 } from 'lucide-react';
import { AdminLayout } from '@/components/layout';
import {
  Button, Modal, SearchableSelect, LoadingSpinner, Pagination, EmptyState, ErrorState,
  InfoButton, TAccountExample, StepFlow,
} from '@/components/ui';
import { DateRange, DateRangeBar, KpiTile, presetRange, chipClass, ymd } from '@/components/reports/shared';
import { JournalEntry, ChartOfAccount } from '@/types';
import { formatCurrency, formatDate, getErrorMessage } from '@/lib/utils';
import adminService from '@/lib/adminService';

interface ManualLine {
  account_code: string;
  debit: string;
  credit: string;
}

interface JournalResponse {
  data: JournalEntry[];
  meta: { current_page: number; last_page: number; per_page: number; total: number; from: number | null; to: number | null };
  summary: { entries: number; reversals: number; debits: number; credits: number; by_source: Record<string, number> };
}

const EMPTY_LINE: ManualLine = { account_code: '', debit: '', credit: '' };

const SOURCES: { value: string; label: string; tone: string }[] = [
  { value: '', label: 'All sources', tone: 'border-slate-700 bg-slate-700 text-white' },
  { value: 'Order', label: 'Orders', tone: 'border-sky-600 bg-sky-600 text-white' },
  { value: 'Expense', label: 'Expenses', tone: 'border-rose-600 bg-rose-600 text-white' },
  { value: 'PurchaseOrder', label: 'Purchases', tone: 'border-amber-500 bg-amber-500 text-white' },
  { value: 'Investment', label: 'Investments', tone: 'border-indigo-600 bg-indigo-600 text-white' },
  { value: 'Manual', label: 'Manual', tone: 'border-emerald-600 bg-emerald-600 text-white' },
];

const SOURCE_LABEL: Record<string, string> = {
  Order: 'Order',
  Expense: 'Expense',
  PurchaseOrder: 'Purchase',
  Investment: 'Investment',
  Manual: 'Manual',
};

const SOURCE_BADGE: Record<string, string> = {
  Order: 'bg-sky-50 text-sky-700 border-sky-200',
  Expense: 'bg-rose-50 text-rose-700 border-rose-200',
  PurchaseOrder: 'bg-amber-50 text-amber-700 border-amber-200',
  Investment: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  Manual: 'bg-emerald-50 text-emerald-700 border-emerald-200',
};

export default function JournalEntriesPage() {
  const [accounts, setAccounts] = useState<ChartOfAccount[]>([]);
  const [response, setResponse] = useState<JournalResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  const [range, setRange] = useState<DateRange>(() => presetRange('year'));
  const [source, setSource] = useState('');
  const [reversal, setReversal] = useState<'' | 'only' | 'original'>('');
  const [accountFilter, setAccountFilter] = useState<number | ''>('');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [entryDate, setEntryDate] = useState(() => ymd(new Date()));
  const [description, setDescription] = useState('');
  const [lines, setLines] = useState<ManualLine[]>([{ ...EMPTY_LINE }, { ...EMPTY_LINE }]);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    adminService.getAccounts({ is_active: true })
      .then((res) => setAccounts((res.data?.data ?? []) as ChartOfAccount[]))
      .catch(() => setAccounts([]));
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput.trim());
      setCurrentPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const fetchEntries = useCallback(async () => {
    if (range.start && range.end && range.start > range.end) {
      toast.error('The start date must be on or before the end date.');
      return;
    }
    setIsLoading(true);
    setError(false);
    try {
      const params: Record<string, string | number> = { page: currentPage, per_page: 20 };
      if (source) params.reference_type = source;
      if (reversal) params.reversal = reversal;
      if (accountFilter) params.account_id = accountFilter;
      if (search) params.search = search;
      if (range.start) params.from_date = range.start;
      if (range.end) params.to_date = range.end;
      const res = await adminService.getJournalEntries(params);
      setResponse(res.data as unknown as JournalResponse);
    } catch (err) {
      toast.error(getErrorMessage(err));
      setError(true);
    } finally {
      setIsLoading(false);
    }
  }, [currentPage, source, reversal, accountFilter, search, range]);

  useEffect(() => { fetchEntries(); }, [fetchEntries]);

  const openCreate = () => {
    setEntryDate(ymd(new Date()));
    setDescription('');
    setLines([{ ...EMPTY_LINE }, { ...EMPTY_LINE }]);
    setIsFormOpen(true);
  };

  const addLine = () => setLines([...lines, { ...EMPTY_LINE }]);
  const removeLine = (index: number) => setLines(lines.filter((_, i) => i !== index));
  const updateLine = (index: number, patch: Partial<ManualLine>) => {
    setLines(lines.map((line, i) => (i === index ? { ...line, ...patch } : line)));
  };

  const totalDebit = lines.reduce((sum, l) => sum + (parseFloat(l.debit) || 0), 0);
  const totalCredit = lines.reduce((sum, l) => sum + (parseFloat(l.credit) || 0), 0);
  const difference = Math.round((totalDebit - totalCredit) * 100) / 100;
  const isBalanced = difference === 0 && totalDebit > 0;

  const handleSave = async () => {
    if (!description.trim()) {
      toast.error('Description is required');
      return;
    }
    if (!isBalanced) {
      toast.error('Debits and credits must balance before saving.');
      return;
    }
    setIsSaving(true);
    try {
      await adminService.createJournalEntry({
        entry_date: entryDate,
        description: description.trim(),
        lines: lines
          .filter((l) => l.account_code && (parseFloat(l.debit) || parseFloat(l.credit)))
          .map((l) => ({
            account_code: l.account_code,
            debit: parseFloat(l.debit) || 0,
            credit: parseFloat(l.credit) || 0,
          })),
      });
      toast.success('Journal entry posted.');
      setIsFormOpen(false);
      fetchEntries();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setIsSaving(false);
    }
  };

  const accountOptions = accounts.map((a) => ({
    value: a.code,
    label: `${a.code} — ${a.name}`,
    description: a.type,
  }));
  const accountFilterOptions = accounts.map((a) => ({ value: a.id, label: `${a.code} — ${a.name}`, description: a.type }));

  const entries = response?.data ?? [];
  const meta = response?.meta;
  const summary = response?.summary;
  const filtered = !!source || !!reversal || !!accountFilter || !!search || range.preset !== 'year';
  const sourceCount = (key: string) => (key ? summary?.by_source[key] ?? 0 : summary?.entries ?? 0);
  const rowDebitTotal = useMemo(() => entries.map((e) => (e.lines ?? []).reduce((s, l) => s + Number(l.debit), 0)), [entries]);

  return (
    <AdminLayout>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2.5">
          <h1 className="text-lg font-bold text-gray-900">Journal entries</h1>
          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-semibold text-gray-600">
            {summary?.entries ?? 0} entr{summary?.entries === 1 ? 'y' : 'ies'}
          </span>
          <InfoButton title="How Journal Entries Work">
            <p>
              Every financial transaction in the system is recorded as a <strong>journal entry</strong> — a set of
              debit and credit lines that must always add up to the same total. This is called double-entry
              bookkeeping: money never just appears or disappears, it always moves <em>from</em> one account
              <em> to</em> another.
            </p>
            <p>
              Most entries here are posted <strong>automatically</strong> — when an order is marked paid, when an
              expense is recorded, or when a purchase order&apos;s goods are received. You never create those by hand.
            </p>
            <div>
              <p className="mb-2 font-semibold text-gray-900">Example: a customer pays a ৳500 order</p>
              <TAccountExample
                caption="Automatically posted when payment is confirmed"
                debits={[{ label: 'Cash', amount: 500 }]}
                credits={[{ label: 'Sales Revenue', amount: 500 }]}
              />
            </div>
            <div>
              <p className="mb-2 font-semibold text-gray-900">When to add a manual entry</p>
              <p className="mb-2">Use &quot;New manual entry&quot; only for things with no automatic trigger — e.g. correcting a mistake, or recording something outside the normal order/expense/purchase flow.</p>
              <StepFlow steps={[
                'Click "New manual entry" and pick the date.',
                'Write a clear description — this is what you will see in reports later.',
                'Add lines: for each line, pick an account and type an amount into either the Debit or the Credit box (not both).',
                'Keep adding lines until the green "Balanced" banner appears — debit total must exactly equal credit total.',
                'Click "Post entry". Once posted, an entry cannot be edited or deleted — only reversed by a new entry.',
              ]} />
            </div>
          </InfoButton>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="ghost" onClick={fetchEntries} leftIcon={<RefreshCw className="h-3.5 w-3.5" />}>Refresh</Button>
          <Button size="sm" onClick={openCreate} leftIcon={<Plus className="h-3.5 w-3.5" />}>New manual entry</Button>
        </div>
      </div>

      <div className="mb-3 grid grid-cols-2 gap-2 lg:grid-cols-4">
        <KpiTile label="Entries" value={(summary?.entries ?? 0).toLocaleString()} tone="indigo" icon={<ScrollText className="h-4 w-4 opacity-60" />} sub="Matching the filters" />
        <KpiTile label="Debits posted" value={formatCurrency(summary?.debits ?? 0)} tone="sky" icon={<Receipt className="h-4 w-4 opacity-60" />} sub="All debit lines in the set" />
        <KpiTile label="Credits posted" value={formatCurrency(summary?.credits ?? 0)} tone="amber" sub="All credit lines in the set" />
        <KpiTile
          label="Reversals"
          value={String(summary?.reversals ?? 0)}
          tone="rose"
          icon={<Undo2 className="h-4 w-4 opacity-60" />}
          sub={(summary?.debits ?? 0) === (summary?.credits ?? 0) ? 'Debits = credits' : 'Debits and credits differ'}
        />
      </div>

      <div className="mb-3 space-y-2.5 rounded-xl border border-gray-200 bg-white p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap gap-1.5">
            {SOURCES.map((s) => (
              <button
                key={s.value || 'all'}
                type="button"
                onClick={() => { setSource(s.value); setCurrentPage(1); }}
                className={`rounded-full border px-2.5 py-1 text-xs font-semibold transition-colors ${
                  source === s.value ? s.tone : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                }`}
              >
                {s.label}
                <span className="ml-1 opacity-70">{sourceCount(s.value)}</span>
              </button>
            ))}
          </div>
          <div className="flex gap-1.5">
            {([
              { value: '', label: 'All' },
              { value: 'original', label: 'Originals' },
              { value: 'only', label: 'Reversals only' },
            ] as const).map((r) => (
              <button key={r.value || 'all'} type="button" onClick={() => { setReversal(r.value); setCurrentPage(1); }} className={chipClass(reversal === r.value)}>
                {r.label}
              </button>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[240px] flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
            <input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search entry number, description or reference ID…"
              className="h-8 w-full rounded-lg border border-gray-300 pl-8 pr-3 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div className="w-72 max-w-full">
            <SearchableSelect
              placeholder="Any account"
              allowClear
              value={accountFilter}
              onChange={(v) => { setAccountFilter(v === '' ? '' : Number(v)); setCurrentPage(1); }}
              options={accountFilterOptions}
            />
          </div>
          <DateRangeBar range={range} onChange={(r) => { setRange(r); setCurrentPage(1); }} presets={['today', '30d', 'month', 'last_month', 'year', 'custom']} />
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        {isLoading && !response ? (
          <div className="flex justify-center py-12"><LoadingSpinner /></div>
        ) : error && !response ? (
          <ErrorState message="Failed to load journal entries." onRetry={fetchEntries} />
        ) : entries.length === 0 ? (
          <EmptyState
            icon={<ScrollText className="h-8 w-8 text-gray-400" />}
            title={filtered ? 'No entries match these filters' : 'No journal entries yet'}
            description={filtered ? 'Clear a filter to see more.' : 'Entries are posted automatically, or add a manual one.'}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold">Entry</th>
                  <th className="whitespace-nowrap px-3 py-2 text-left font-semibold">Date</th>
                  <th className="px-3 py-2 text-left font-semibold">Description</th>
                  <th className="px-3 py-2 text-left font-semibold">Source</th>
                  <th className="px-3 py-2 text-right font-semibold">Debit</th>
                  <th className="px-3 py-2 text-right font-semibold">Credit</th>
                  <th className="px-3 py-2 text-right font-semibold">View</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {entries.map((entry, i) => {
                  const debit = rowDebitTotal[i];
                  const credit = (entry.lines ?? []).reduce((s, l) => s + Number(l.credit), 0);
                  const badge = SOURCE_BADGE[entry.reference_type ?? 'Manual'] ?? 'bg-slate-100 text-slate-700 border-slate-200';
                  return (
                    <tr key={entry.id} className={`${i % 2 ? 'bg-slate-50/40' : 'bg-white'} hover:bg-indigo-50/40`}>
                      <td className="whitespace-nowrap px-3 py-2">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-semibold text-gray-900">{entry.entry_number}</span>
                          {entry.is_reversal && (
                            <span className="inline-flex items-center gap-1 rounded bg-rose-50 px-1.5 py-0.5 text-[10px] font-semibold text-rose-700">
                              <Undo2 className="h-2.5 w-2.5" /> Reversal
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-xs tabular-nums text-gray-600">{formatDate(entry.entry_date)}</td>
                      <td className="px-3 py-2">
                        <p className="max-w-[320px] truncate text-gray-900" title={entry.description}>{entry.description}</p>
                      </td>
                      <td className="whitespace-nowrap px-3 py-2">
                        <span className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold ${badge}`}>
                          {SOURCE_LABEL[entry.reference_type ?? 'Manual'] ?? entry.reference_type}
                          {entry.reference_id ? ` #${entry.reference_id}` : ''}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums text-gray-900">{formatCurrency(debit)}</td>
                      <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums text-gray-900">
                        {Math.abs(debit - credit) >= 0.005 && (
                          <AlertTriangle className="mr-1 inline h-3 w-3 text-rose-500" aria-label="Unbalanced entry" />
                        )}
                        {formatCurrency(credit)}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <Link href={`/accounts/journal/${entry.id}`} title="View entry" className="inline-flex rounded-md p-1 text-indigo-600 hover:bg-indigo-50">
                          <Eye className="h-3.5 w-3.5" />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {meta && meta.total > 0 && (
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-gray-500">
          <span>
            Showing <span className="font-semibold text-gray-700">{meta.from ?? 0}–{meta.to ?? 0}</span> of{' '}
            <span className="font-semibold text-gray-700">{meta.total}</span>
          </span>
          {meta.last_page > 1 && (
            <Pagination currentPage={currentPage} totalPages={meta.last_page} onPageChange={setCurrentPage} />
          )}
        </div>
      )}

      <Modal isOpen={isFormOpen} onClose={() => setIsFormOpen(false)} title="New manual journal entry" size="lg">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Entry date</label>
              <input
                type="date"
                value={entryDate}
                onChange={(e) => setEntryDate(e.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Description *</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              placeholder="e.g. Correcting entry for…"
            />
          </div>

          <div className="space-y-2">
            <div className="grid grid-cols-12 gap-2 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
              <span className="col-span-6">Account</span>
              <span className="col-span-2">Debit</span>
              <span className="col-span-2">Credit</span>
              <span className="col-span-2" />
            </div>
            {lines.map((line, index) => (
              <div key={index} className="grid grid-cols-12 items-start gap-2">
                <div className="col-span-6">
                  <SearchableSelect
                    placeholder="Select account…"
                    options={accountOptions}
                    value={line.account_code}
                    onChange={(v) => updateLine(index, { account_code: String(v) })}
                  />
                </div>
                <input
                  type="number"
                  placeholder="Debit"
                  value={line.debit}
                  onChange={(e) => updateLine(index, { debit: e.target.value, credit: e.target.value ? '' : line.credit })}
                  className="col-span-2 rounded-md border border-gray-300 px-2 py-2 text-sm shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                />
                <input
                  type="number"
                  placeholder="Credit"
                  value={line.credit}
                  onChange={(e) => updateLine(index, { credit: e.target.value, debit: e.target.value ? '' : line.debit })}
                  className="col-span-2 rounded-md border border-gray-300 px-2 py-2 text-sm shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                />
                <button
                  type="button"
                  onClick={() => removeLine(index)}
                  disabled={lines.length <= 2}
                  className="col-span-2 py-2 text-xs text-rose-500 hover:text-rose-700 disabled:cursor-not-allowed disabled:opacity-30"
                >
                  Remove
                </button>
              </div>
            ))}
            <Button variant="ghost" size="sm" onClick={addLine} leftIcon={<Plus className="h-3.5 w-3.5" />}>Add line</Button>
          </div>

          <div className={`flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm ${isBalanced ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-amber-200 bg-amber-50 text-amber-800'}`}>
            <span className="tabular-nums">Debits {formatCurrency(totalDebit)} · Credits {formatCurrency(totalCredit)}</span>
            <span className="font-semibold">{isBalanced ? 'Balanced' : `Out by ${formatCurrency(Math.abs(difference))}`}</span>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => setIsFormOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} isLoading={isSaving} disabled={!isBalanced}>Post entry</Button>
          </div>
        </div>
      </Modal>
    </AdminLayout>
  );
}
