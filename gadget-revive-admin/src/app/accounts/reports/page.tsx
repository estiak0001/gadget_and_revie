'use client';

import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Download, Users, Truck, Landmark, Search, CheckCircle2, AlertTriangle, Wallet, Receipt, RefreshCw } from 'lucide-react';
import { AdminLayout } from '@/components/layout';
import { Button, LoadingSpinner, ErrorState, EmptyState, InfoButton, StepFlow } from '@/components/ui';
import { DateRange, DateRangeBar, KpiTile, Panel, presetRange, chipClass } from '@/components/reports/shared';
import { AccountType } from '@/types';
import { downloadBlob, formatCurrency, formatDate, getErrorMessage } from '@/lib/utils';
import adminService from '@/lib/adminService';

type Tab = 'customers' | 'suppliers' | 'accounts';
type Bucket = '' | 'current' | 'd31_60' | 'd61_90' | 'd90p';

interface PartyRow {
  key: string;
  name: string;
  phone: string | null;
  billed: number;
  collected?: number;
  paid?: number;
  outstanding: number;
  refund_due?: number;
  current: number;
  d31_60: number;
  d61_90: number;
  d90p: number;
  open_orders: number;
  oldest_open: string | null;
}

interface PartySummary {
  parties: number;
  billed: number;
  collected_or_paid: number;
  outstanding: number;
  refund_due: number;
  current: number;
  d31_60: number;
  d61_90: number;
  d90p: number;
  open_orders: number;
}

interface AccountRow {
  key: string;
  code: string;
  name: string;
  type: AccountType;
  normal_balance: string;
  opening: number;
  debit: number;
  credit: number;
  closing: number;
  movement: number;
}

const BUCKETS: { value: Bucket; label: string; cell: string; text: string }[] = [
  { value: '', label: 'All ages', cell: '', text: '' },
  { value: 'current', label: '0–30 days', cell: 'bg-emerald-50', text: 'text-emerald-700' },
  { value: 'd31_60', label: '31–60 days', cell: 'bg-amber-50', text: 'text-amber-700' },
  { value: 'd61_90', label: '61–90 days', cell: 'bg-orange-50', text: 'text-orange-700' },
  { value: 'd90p', label: '90+ days', cell: 'bg-rose-50', text: 'text-rose-700' },
];

const TYPES: { value: AccountType; label: string }[] = [
  { value: 'asset', label: 'Assets' },
  { value: 'liability', label: 'Liabilities' },
  { value: 'equity', label: 'Equity' },
  { value: 'revenue', label: 'Revenue' },
  { value: 'expense', label: 'Expenses' },
];

const TAB_META: Record<Tab, { label: string; icon: typeof Users; tone: string }> = {
  customers: { label: 'Customers', icon: Users, tone: 'bg-emerald-600 text-white border-emerald-600' },
  suppliers: { label: 'Suppliers', icon: Truck, tone: 'bg-amber-500 text-white border-amber-500' },
  accounts: { label: 'All accounts', icon: Landmark, tone: 'bg-indigo-600 text-white border-indigo-600' },
};

const EMPTY_SUMMARY: PartySummary = {
  parties: 0, billed: 0, collected_or_paid: 0, outstanding: 0, refund_due: 0,
  current: 0, d31_60: 0, d61_90: 0, d90p: 0, open_orders: 0,
};

function bucketCell(value: number, key: Exclude<Bucket, ''>) {
  const meta = BUCKETS.find((b) => b.value === key)!;
  return value > 0 ? `${meta.cell} font-semibold ${meta.text} tabular-nums` : 'text-gray-300 tabular-nums';
}

export default function AccountReportsPage() {
  const [tab, setTab] = useState<Tab>('customers');
  const [range, setRange] = useState<DateRange>(() => presetRange('year'));
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [bucket, setBucket] = useState<Bucket>('');
  const [minOutstanding, setMinOutstanding] = useState('');
  const [typeFilter, setTypeFilter] = useState<AccountType | ''>('');
  const [hideZero, setHideZero] = useState(true);

  const [partySummary, setPartySummary] = useState<PartySummary>(EMPTY_SUMMARY);
  const [partyRows, setPartyRows] = useState<PartyRow[]>([]);
  const [accountSummary, setAccountSummary] = useState<{ accounts: number; debit: number; credit: number; closing: number } | null>(null);
  const [accountRows, setAccountRows] = useState<AccountRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchInput.trim()), 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const buildParams = useCallback(() => {
    const p: Record<string, string | number | boolean | undefined> = {};
    if (range.start) p.from = range.start;
    if (range.end) p.to = range.end;
    if (search) p.search = search;
    if (tab === 'accounts') {
      if (typeFilter) p.type = typeFilter;
      if (hideZero) p.hide_zero = 1;
    } else {
      if (bucket) p.bucket = bucket;
      if (minOutstanding) p.min_outstanding = minOutstanding;
    }
    return p;
  }, [range, search, tab, typeFilter, hideZero, bucket, minOutstanding]);

  const fetchReport = useCallback(async () => {
    if (range.start && range.end && range.start > range.end) {
      toast.error('The start date must be on or before the end date.');
      return;
    }
    setIsLoading(true);
    setError(false);
    try {
      const params = buildParams();
      if (tab === 'customers') {
        const res = await adminService.getCustomerReceivables(params);
        const body = res.data.data as unknown as { summary: PartySummary; rows: PartyRow[] };
        setPartySummary(body.summary);
        setPartyRows(body.rows);
      } else if (tab === 'suppliers') {
        const res = await adminService.getSupplierPayables(params);
        const body = res.data.data as unknown as { summary: PartySummary; rows: PartyRow[] };
        setPartySummary(body.summary);
        setPartyRows(body.rows);
      } else {
        const res = await adminService.getAccountActivity(params);
        const body = res.data.data as unknown as { summary: typeof accountSummary; rows: AccountRow[] };
        setAccountSummary(body.summary);
        setAccountRows(body.rows);
      }
    } catch (err) {
      toast.error(getErrorMessage(err));
      setError(true);
    } finally {
      setIsLoading(false);
    }
  }, [buildParams, range, tab]);

  useEffect(() => { fetchReport(); }, [fetchReport]);

  const handleExport = async () => {
    setExporting(true);
    try {
      const res = await adminService.downloadAccountReport(tab === 'customers' ? 'customers' : tab === 'suppliers' ? 'suppliers' : 'accounts', buildParams());
      downloadBlob(new Blob([res.data]), `${tab}-report-${range.end || 'today'}.csv`);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setExporting(false);
    }
  };

  const isParty = tab !== 'accounts';
  const isCustomers = tab === 'customers';
  const visibleAccounts = accountRows;
  const accountDebitTotal = visibleAccounts.reduce((n, r) => n + r.debit, 0);
  const accountCreditTotal = visibleAccounts.reduce((n, r) => n + r.credit, 0);
  const balancedInRange = Math.abs(accountDebitTotal - accountCreditTotal) < 0.005;

  return (
    <AdminLayout>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2.5">
          <h1 className="text-lg font-bold text-gray-900">Account reports</h1>
          <span className="text-xs text-gray-500">Customers, suppliers and every account, from the ledger</span>
          <InfoButton title="How the Account Reports Work">
            <p>
              <strong>Customers</strong> shows what each customer owes on open orders (aged from the order date), what was billed
              and collected in the period, and their balance. <strong>Suppliers</strong> does the same for purchase orders:
              what we owe, what was billed and paid, and any refund due back from the supplier.
            </p>
            <p>
              <strong>All accounts</strong> lists every account with its opening balance, debits and credits in the period,
              and closing balance. Debits must equal credits across the period; the check is shown on that tab.
            </p>
            <div>
              <p className="mb-2 font-semibold text-gray-900">How to use these reports</p>
              <StepFlow steps={[
                'Pick the tab and a date range. Outstanding and aging always reflect today; billed, collected and paid follow the range.',
                'Use the age buckets to find overdue balances (61+ days is the red zone).',
                'Export CSV to take the same rows into a spreadsheet.',
              ]} />
            </div>
          </InfoButton>
        </div>
        <Button size="sm" variant="outline" onClick={handleExport} disabled={exporting || isLoading} isLoading={exporting} leftIcon={<Download className="h-3.5 w-3.5" />}>
          Export CSV
        </Button>
      </div>

      <div className="mb-3 flex flex-wrap gap-1.5">
        {(Object.keys(TAB_META) as Tab[]).map((t) => {
          const meta = TAB_META[t];
          const Icon = meta.icon;
          return (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                tab === t ? meta.tone : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {meta.label}
            </button>
          );
        })}
      </div>

      <div className="mb-3">
        <DateRangeBar range={range} onChange={setRange} presets={['today', '30d', 'month', 'last_month', 'year', 'custom']} right={
          <Button size="sm" variant="ghost" onClick={fetchReport} leftIcon={<RefreshCw className="h-3.5 w-3.5" />}>Refresh</Button>
        } />
      </div>

      <div className="mb-3 space-y-2 rounded-xl border border-gray-200 bg-white p-2.5">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[220px] flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
            <input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder={tab === 'accounts' ? 'Search code or account name…' : isCustomers ? 'Search customer name or phone…' : 'Search supplier name or phone…'}
              className="h-8 w-full rounded-lg border border-gray-300 pl-8 pr-3 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          {isParty ? (
            <>
              <div className="flex flex-wrap gap-1.5">
                {BUCKETS.map((b) => (
                  <button
                    key={b.value || 'all'}
                    type="button"
                    onClick={() => setBucket(b.value)}
                    className={chipClass(bucket === b.value)}
                  >
                    {b.label}
                  </button>
                ))}
              </div>
              <input
                type="number"
                min={0}
                value={minOutstanding}
                onChange={(e) => setMinOutstanding(e.target.value)}
                placeholder="Min outstanding ৳"
                className="h-8 w-40 rounded-lg border border-gray-300 px-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </>
          ) : (
            <button
              type="button"
              onClick={() => setHideZero((v) => !v)}
              className={chipClass(hideZero)}
            >
              Hide zero balances
            </button>
          )}
        </div>
        {tab === 'accounts' && (
          <div className="flex flex-wrap gap-1.5">
            <button type="button" onClick={() => setTypeFilter('')} className={chipClass(typeFilter === '')}>All types</button>
            {TYPES.map((t) => (
              <button key={t.value} type="button" onClick={() => setTypeFilter(typeFilter === t.value ? '' : t.value)} className={chipClass(typeFilter === t.value)}>
                {t.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {isLoading && partyRows.length === 0 && accountRows.length === 0 ? (
        <div className="flex justify-center py-16"><LoadingSpinner /></div>
      ) : error ? (
        <ErrorState message="Failed to load the report." onRetry={fetchReport} />
      ) : isParty ? (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
            {isCustomers ? (
              <>
                <KpiTile label="Owed by customers" value={formatCurrency(partySummary.outstanding)} tone="emerald" icon={<Users className="h-4 w-4 opacity-60" />} sub={`${partySummary.open_orders} open orders · ${partySummary.parties} customers`} />
                <KpiTile label="Billed in period" value={formatCurrency(partySummary.billed)} tone="indigo" icon={<Receipt className="h-4 w-4 opacity-60" />} sub="Orders placed in the range" />
                <KpiTile label="Collected in period" value={formatCurrency(partySummary.collected_or_paid)} tone="sky" icon={<Wallet className="h-4 w-4 opacity-60" />} sub="Payments received in the range" />
                <KpiTile label="Over 60 days" value={formatCurrency(partySummary.d61_90 + partySummary.d90p)} tone="rose" icon={<AlertTriangle className="h-4 w-4 opacity-60" />} sub={`${formatCurrency(partySummary.d90p)} over 90 days`} />
              </>
            ) : (
              <>
                <KpiTile label="We owe suppliers" value={formatCurrency(partySummary.outstanding)} tone="amber" icon={<Truck className="h-4 w-4 opacity-60" />} sub={`${partySummary.open_orders} open POs · ${partySummary.parties} suppliers`} />
                <KpiTile label="Billed in period" value={formatCurrency(partySummary.billed)} tone="indigo" icon={<Receipt className="h-4 w-4 opacity-60" />} sub="Purchase orders raised in the range" />
                <KpiTile label="Paid in period" value={formatCurrency(partySummary.collected_or_paid)} tone="sky" icon={<Wallet className="h-4 w-4 opacity-60" />} sub="Payments made in the range" />
                <KpiTile label="Refund due back" value={formatCurrency(partySummary.refund_due)} tone="emerald" icon={<CheckCircle2 className="h-4 w-4 opacity-60" />} sub="From supplier returns" />
              </>
            )}
          </div>

          <Panel
            title={isCustomers ? 'Customer receivables' : 'Supplier payables'}
            hint={isCustomers ? 'Outstanding is aged from the order date; billed and collected follow the range' : 'Outstanding is aged from the PO date; billed and paid follow the range'}
          >
            {partyRows.length === 0 ? (
              <EmptyState
                title={search || bucket || minOutstanding ? 'No matches for these filters' : isCustomers ? 'Nothing owed by customers' : 'Nothing owed to suppliers'}
                description={search || bucket || minOutstanding ? 'Clear a filter to see more.' : 'Balances appear here once orders or purchase orders are open.'}
              />
            ) : (
              <div className="max-h-[calc(100vh-30rem)] overflow-auto">
                <table className="min-w-full text-sm">
                  <thead className="sticky top-0 z-10 bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500 shadow-[0_1px_0_0_rgb(226,232,240)]">
                    <tr>
                      <th className="px-3 py-2 text-left font-semibold">{isCustomers ? 'Customer' : 'Supplier'}</th>
                      <th className="px-3 py-2 text-right font-semibold">Billed</th>
                      <th className="px-3 py-2 text-right font-semibold">{isCustomers ? 'Collected' : 'Paid'}</th>
                      <th className="px-3 py-2 text-right font-semibold">Outstanding</th>
                      <th className="px-3 py-2 text-right font-semibold">0–30</th>
                      <th className="px-3 py-2 text-right font-semibold">31–60</th>
                      <th className="px-3 py-2 text-right font-semibold">61–90</th>
                      <th className="px-3 py-2 text-right font-semibold">90+</th>
                      <th className="px-3 py-2 text-right font-semibold">Open</th>
                      <th className="whitespace-nowrap px-3 py-2 text-left font-semibold">Oldest open</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {partyRows.map((r, i) => (
                      <tr key={r.key} className={`${i % 2 ? 'bg-slate-50/40' : 'bg-white'} hover:bg-indigo-50/40`}>
                        <td className="px-3 py-2">
                          <p className="font-semibold text-gray-900">{r.name}</p>
                          {r.phone && <p className="text-[11px] tabular-nums text-gray-500">{r.phone}</p>}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums text-gray-700">{formatCurrency(r.billed)}</td>
                        <td className="px-3 py-2 text-right tabular-nums text-gray-700">{formatCurrency(r.collected ?? r.paid ?? 0)}</td>
                        <td className={`px-3 py-2 text-right font-bold tabular-nums ${r.outstanding > 0 ? (isCustomers ? 'text-emerald-700' : 'text-amber-700') : 'text-gray-400'}`}>
                          {formatCurrency(r.outstanding)}
                        </td>
                        <td className={`px-3 py-2 text-right text-xs ${bucketCell(r.current, 'current')}`}>{formatCurrency(r.current)}</td>
                        <td className={`px-3 py-2 text-right text-xs ${bucketCell(r.d31_60, 'd31_60')}`}>{formatCurrency(r.d31_60)}</td>
                        <td className={`px-3 py-2 text-right text-xs ${bucketCell(r.d61_90, 'd61_90')}`}>{formatCurrency(r.d61_90)}</td>
                        <td className={`px-3 py-2 text-right text-xs ${bucketCell(r.d90p, 'd90p')}`}>{formatCurrency(r.d90p)}</td>
                        <td className="px-3 py-2 text-right tabular-nums text-gray-600">{r.open_orders}</td>
                        <td className="whitespace-nowrap px-3 py-2 text-xs tabular-nums text-gray-500">{r.oldest_open ? formatDate(r.oldest_open) : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="sticky bottom-0 bg-slate-50">
                    <tr className="border-t-2 border-gray-300 font-bold">
                      <td className="px-3 py-2.5">Total · {partySummary.parties} {isCustomers ? 'customers' : 'suppliers'}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{formatCurrency(partySummary.billed)}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{formatCurrency(partySummary.collected_or_paid)}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{formatCurrency(partySummary.outstanding)}</td>
                      <td className="px-3 py-2.5 text-right text-xs tabular-nums">{formatCurrency(partySummary.current)}</td>
                      <td className="px-3 py-2.5 text-right text-xs tabular-nums">{formatCurrency(partySummary.d31_60)}</td>
                      <td className="px-3 py-2.5 text-right text-xs tabular-nums">{formatCurrency(partySummary.d61_90)}</td>
                      <td className="px-3 py-2.5 text-right text-xs tabular-nums">{formatCurrency(partySummary.d90p)}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{partySummary.open_orders}</td>
                      <td />
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </Panel>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
            <KpiTile label="Accounts" value={String(accountSummary?.accounts ?? 0)} tone="indigo" icon={<Landmark className="h-4 w-4 opacity-60" />} sub="Shown with the filters" />
            <KpiTile label="Debits in period" value={formatCurrency(accountDebitTotal)} tone="sky" sub="All posted debit lines" />
            <KpiTile label="Credits in period" value={formatCurrency(accountCreditTotal)} tone="amber" sub="All posted credit lines" />
            <KpiTile
              label="Debits = credits"
              value={balancedInRange ? 'Yes' : formatCurrency(accountDebitTotal - accountCreditTotal)}
              tone={balancedInRange ? 'emerald' : 'rose'}
              icon={balancedInRange ? <CheckCircle2 className="h-4 w-4 opacity-60" /> : <AlertTriangle className="h-4 w-4 opacity-60" />}
              sub={balancedInRange ? 'Books balance for this range' : 'Difference in the range'}
            />
          </div>

          <Panel title="Account activity" hint="Opening, movement and closing for each account in the range">
            {accountRows.length === 0 ? (
              <EmptyState title="No accounts match" description="Clear the type filter or show zero balances." />
            ) : (
              <div className="max-h-[calc(100vh-30rem)] overflow-auto">
                <table className="min-w-full text-sm">
                  <thead className="sticky top-0 z-10 bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500 shadow-[0_1px_0_0_rgb(226,232,240)]">
                    <tr>
                      <th className="px-3 py-2 text-left font-semibold">Code</th>
                      <th className="px-3 py-2 text-left font-semibold">Account</th>
                      <th className="px-3 py-2 text-left font-semibold">Type</th>
                      <th className="px-3 py-2 text-right font-semibold">Opening</th>
                      <th className="px-3 py-2 text-right font-semibold">Debit</th>
                      <th className="px-3 py-2 text-right font-semibold">Credit</th>
                      <th className="px-3 py-2 text-right font-semibold">Closing</th>
                      <th className="px-3 py-2 text-right font-semibold">Movement</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {accountRows.map((r, i) => (
                      <tr key={r.key} className={`${i % 2 ? 'bg-slate-50/40' : 'bg-white'} hover:bg-indigo-50/40`}>
                        <td className="px-3 py-1.5 font-mono text-xs font-semibold text-gray-900">{r.code}</td>
                        <td className="px-3 py-1.5 font-semibold text-gray-900">{r.name}</td>
                        <td className="px-3 py-1.5 text-xs capitalize text-gray-600">{r.type}</td>
                        <td className="px-3 py-1.5 text-right tabular-nums text-gray-600">{formatCurrency(r.opening)}</td>
                        <td className="px-3 py-1.5 text-right tabular-nums text-gray-900">{r.debit ? formatCurrency(r.debit) : '—'}</td>
                        <td className="px-3 py-1.5 text-right tabular-nums text-gray-900">{r.credit ? formatCurrency(r.credit) : '—'}</td>
                        <td className={`px-3 py-1.5 text-right font-semibold tabular-nums ${r.closing < 0 ? 'text-rose-600' : 'text-gray-900'}`}>{formatCurrency(r.closing)}</td>
                        <td className={`px-3 py-1.5 text-right tabular-nums ${r.movement < 0 ? 'text-rose-600' : 'text-emerald-700'}`}>{formatCurrency(r.movement)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>
        </div>
      )}
    </AdminLayout>
  );
}
