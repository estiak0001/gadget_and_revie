'use client';

import { useEffect, useMemo, useState, useCallback } from 'react';
import toast from 'react-hot-toast';
import { RefreshCw, Printer, ArrowUpCircle, ArrowDownCircle, Wallet, PiggyBank, Users, Truck, Scale, Search } from 'lucide-react';
import { AdminLayout } from '@/components/layout';
import { Button, LoadingSpinner, ErrorState, EmptyState, InfoButton, StepFlow, Input, Badge, Pagination } from '@/components/ui';
import { DateRange, DateRangeBar, KpiTile, presetRange } from '@/components/reports/shared';
import { CashBook, IncomeStatement, DuesResponse } from '@/types';
import { formatCurrency, formatDate, getErrorMessage } from '@/lib/utils';
import adminService from '@/lib/adminService';

const PRESETS: DateRange['preset'][] = ['today', '7d', '30d', 'month', 'last_month', 'custom'];

type Receipt = CashBook['receipts'][number];
type Payment = CashBook['payments'][number];

function matches(text: string | undefined, q: string): boolean {
  return !q || (text ?? '').toLowerCase().includes(q);
}

export default function CashBookPage() {
  const [range, setRange] = useState<DateRange>(() => presetRange('today'));
  const [data, setData] = useState<CashBook | null>(null);
  const [incomeStatement, setIncomeStatement] = useState<IncomeStatement | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);
  const [receiptSearch, setReceiptSearch] = useState('');
  const [paymentSearch, setPaymentSearch] = useState('');
  const [salaryOnly, setSalaryOnly] = useState(false);

  const fetchData = useCallback(async () => {
    if (!range.start || !range.end) return;
    if (range.start > range.end) {
      toast.error('The start date must be on or before the end date.');
      return;
    }
    setIsLoading(true);
    setError(false);
    try {
      const [cashBookRes, incomeRes] = await Promise.all([
        adminService.getCashBook(range.start, range.end),
        adminService.getIncomeStatement(range.start, range.end),
      ]);
      setData(cashBookRes.data?.data ?? null);
      setIncomeStatement(incomeRes.data?.data ?? null);
    } catch (err) {
      toast.error(getErrorMessage(err));
      setError(true);
    } finally {
      setIsLoading(false);
    }
  }, [range]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const receipts = useMemo(
    () => (data?.receipts ?? []).filter((r: Receipt) => matches(r.particulars, receiptSearch.trim().toLowerCase()) || matches(r.voucher, receiptSearch.trim().toLowerCase())),
    [data, receiptSearch]
  );
  const payments = useMemo(
    () =>
      (data?.payments ?? []).filter(
        (p: Payment) =>
          (!salaryOnly || p.salary > 0) &&
          (matches(p.particulars, paymentSearch.trim().toLowerCase()) || matches(p.voucher, paymentSearch.trim().toLowerCase()))
      ),
    [data, paymentSearch, salaryOnly]
  );

  const asOfLabel = range.start === range.end ? formatDate(range.start) : `${formatDate(range.start)} to ${formatDate(range.end)}`;
  const net = data ? data.total_received - data.total_paid : 0;
  const receiptsTotalVisible = receipts.reduce((n, r) => n + r.cash_received, 0);
  const paymentsTotalVisible = payments.reduce((n, p) => n + (p.salary || p.cash_payment), 0);
  const filtered = !!receiptSearch || !!paymentSearch || salaryOnly;

  return (
    <AdminLayout>
      <div className="print:space-y-3">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 print:hidden">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-lg font-bold text-gray-900">Cash book</h1>
            <span className="text-xs text-gray-500">Receipts and payments through the Cash account</span>
            <InfoButton title="How the Cash Book Works">
              <p>
                A day-book style record of every cash receipt and payment through the <strong>Cash</strong> account
                for the selected period, plus the opening and closing balance either side of it — the classic
                &quot;receipts on one side, payments on the other&quot; ledger format.
              </p>
              <div>
                <p className="mb-2 font-semibold text-gray-900">How to use this page</p>
                <StepFlow steps={[
                  'Pick a date range — a single day for a daily cash book, or a wider range for a summary.',
                  'Cash receipts lists every amount that came into the Cash account (payments received, investments, opening adjustments).',
                  'Cash payments lists every amount that went out, with salary payments tagged.',
                  'Use Print to produce a printable copy, or search within either side.',
                ]} />
              </div>
            </InfoButton>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="ghost" onClick={fetchData} leftIcon={<RefreshCw className="h-3.5 w-3.5" />}>Refresh</Button>
            <Button size="sm" variant="outline" onClick={() => window.print()} leftIcon={<Printer className="h-3.5 w-3.5" />}>Print</Button>
          </div>
        </div>

        <div className="mb-3 print:hidden">
          <DateRangeBar range={range} onChange={setRange} presets={PRESETS} />
        </div>

        {isLoading && !data ? (
          <div className="flex justify-center py-16"><LoadingSpinner /></div>
        ) : error || !data ? (
          <ErrorState message="Failed to load the cash book." onRetry={fetchData} />
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2 print:hidden lg:grid-cols-4">
              <KpiTile label="Opening balance" value={formatCurrency(data.opening_balance)} tone="sky" icon={<PiggyBank className="h-4 w-4 opacity-60" />} sub={`Before ${formatDate(range.start)}`} />
              <KpiTile label="Total receipts" value={formatCurrency(data.total_received)} tone="emerald" icon={<ArrowUpCircle className="h-4 w-4 opacity-60" />} sub={`${data.receipts.length} entries`} />
              <KpiTile label="Total payments" value={formatCurrency(data.total_paid)} tone="amber" icon={<ArrowDownCircle className="h-4 w-4 opacity-60" />} sub={`${data.payments.length} entries · ${formatCurrency(data.total_salary)} salary`} />
              <KpiTile label="Closing balance" value={formatCurrency(data.closing_balance)} tone="indigo" icon={<Wallet className="h-4 w-4 opacity-60" />} sub={`Net ${net >= 0 ? '+' : ''}${formatCurrency(net)} in period`} />
            </div>

            <div className="rounded-2xl border border-gray-200 bg-white p-4 print:border-0 print:p-0">
              <div className="mb-3 text-center">
                <h2 className="text-base font-bold text-gray-900">Cash book</h2>
                <p className="text-xs text-gray-500">As of end of day: {asOfLabel}</p>
              </div>

              <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2 print:grid-cols-2 print:gap-3">
                <div className="flex flex-col overflow-hidden rounded-xl border border-emerald-200">
                  <div className="flex items-center justify-between gap-2 border-b border-emerald-200 bg-emerald-50 px-3 py-2">
                    <h3 className="text-xs font-bold tracking-wide text-emerald-800">RECEIPTS</h3>
                    <div className="relative print:hidden">
                      <Search className="pointer-events-none absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-emerald-600" />
                      <input
                        value={receiptSearch}
                        onChange={(e) => setReceiptSearch(e.target.value)}
                        placeholder="Search receipts…"
                        className="h-7 w-44 rounded-md border border-emerald-200 bg-white pl-7 pr-2 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>
                  </div>
                  <div className="max-h-[420px] overflow-auto print:max-h-none print:overflow-visible">
                    <table className="min-w-full text-sm">
                      <colgroup><col className="w-[92px]" /><col className="w-[108px]" /><col /><col className="w-[128px]" /></colgroup>
                      <thead className="sticky top-0 z-10 bg-slate-50 shadow-[0_1px_0_0_rgb(226,232,240)]">
                        <tr className="text-[11px] uppercase tracking-wide text-slate-500">
                          <th className="px-3 py-2 text-left font-semibold whitespace-nowrap">Date</th>
                          <th className="px-3 py-2 text-left font-semibold whitespace-nowrap">Voucher</th>
                          <th className="px-3 py-2 text-left font-semibold">Particulars</th>
                          <th className="px-3 py-2 text-right font-semibold">Amount</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        <tr className="bg-sky-50/60">
                          <td className="px-3 py-2 whitespace-nowrap text-xs tabular-nums text-gray-600">{formatDate(range.start)}</td>
                          <td className="px-3 py-2 text-gray-400">—</td>
                          <td className="px-3 py-2 font-semibold text-gray-800">Opening balance</td>
                          <td className="px-3 py-2 text-right font-semibold tabular-nums text-gray-800">{formatCurrency(data.opening_balance)}</td>
                        </tr>
                        {receipts.length === 0 ? (
                          <tr><td colSpan={4} className="px-3 py-4 text-center text-xs text-gray-400">{receiptSearch ? 'No receipts match.' : 'No cash receipts in this period.'}</td></tr>
                        ) : receipts.map((r, i) => (
                          <tr key={`${r.voucher}-${i}`} className={`${i % 2 ? 'bg-slate-50/40' : 'bg-white'} hover:bg-emerald-50/40`}>
                            <td className="whitespace-nowrap px-3 py-1.5 text-xs tabular-nums text-gray-500">{formatDate(r.date)}</td>
                            <td className="whitespace-nowrap px-3 py-1.5 font-mono text-[11px] text-gray-400">{r.voucher}</td>
                            <td className="px-3 py-1.5 text-gray-800">{r.particulars}</td>
                            <td className="px-3 py-1.5 text-right tabular-nums text-gray-900">{formatCurrency(r.cash_received)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="border-t-2 border-emerald-200 bg-emerald-50/60 px-3 py-2 text-sm">
                    <div className="flex items-center justify-between font-semibold">
                      <span>{filtered && receiptSearch ? 'Matching receipts' : 'Total receipts'}</span>
                      <span className="tabular-nums">{formatCurrency(receiptSearch ? receiptsTotalVisible : data.total_received)}</span>
                    </div>
                    <div className="mt-1 flex items-center justify-between font-bold text-emerald-800">
                      <span>Opening + receipts</span>
                      <span className="tabular-nums">{formatCurrency(data.opening_balance + data.total_received)}</span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col overflow-hidden rounded-xl border border-amber-200">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-amber-200 bg-amber-50 px-3 py-2">
                    <h3 className="text-xs font-bold tracking-wide text-amber-800">PAYMENTS</h3>
                    <div className="flex items-center gap-1.5 print:hidden">
                      <button
                        type="button"
                        onClick={() => setSalaryOnly((v) => !v)}
                        className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${
                          salaryOnly ? 'border-amber-600 bg-amber-600 text-white' : 'border-amber-200 bg-white text-amber-700'
                        }`}
                      >
                        Salary only
                      </button>
                      <div className="relative">
                        <Search className="pointer-events-none absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-amber-600" />
                        <input
                          value={paymentSearch}
                          onChange={(e) => setPaymentSearch(e.target.value)}
                          placeholder="Search payments…"
                          className="h-7 w-40 rounded-md border border-amber-200 bg-white pl-7 pr-2 text-xs focus:outline-none focus:ring-2 focus:ring-amber-500"
                        />
                      </div>
                    </div>
                  </div>
                  <div className="max-h-[420px] overflow-auto print:max-h-none print:overflow-visible">
                    <table className="min-w-full text-sm">
                      <colgroup><col className="w-[92px]" /><col className="w-[108px]" /><col /><col className="w-[128px]" /></colgroup>
                      <thead className="sticky top-0 z-10 bg-slate-50 shadow-[0_1px_0_0_rgb(226,232,240)]">
                        <tr className="text-[11px] uppercase tracking-wide text-slate-500">
                          <th className="px-3 py-2 text-left font-semibold whitespace-nowrap">Date</th>
                          <th className="px-3 py-2 text-left font-semibold whitespace-nowrap">Voucher</th>
                          <th className="px-3 py-2 text-left font-semibold">Particulars</th>
                          <th className="px-3 py-2 text-right font-semibold">Amount</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {payments.length === 0 ? (
                          <tr><td colSpan={4} className="px-3 py-4 text-center text-xs text-gray-400">{paymentSearch || salaryOnly ? 'No payments match.' : 'No cash payments in this period.'}</td></tr>
                        ) : payments.map((p, i) => (
                          <tr key={`${p.voucher}-${i}`} className={`${i % 2 ? 'bg-slate-50/40' : 'bg-white'} hover:bg-amber-50/40`}>
                            <td className="whitespace-nowrap px-3 py-1.5 text-xs tabular-nums text-gray-500">{formatDate(p.date)}</td>
                            <td className="whitespace-nowrap px-3 py-1.5 font-mono text-[11px] text-gray-400">{p.voucher}</td>
                            <td className="px-3 py-1.5 text-gray-800">
                              {p.particulars}
                              {p.salary > 0 && (
                                <span className="ml-1.5 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">Salary</span>
                              )}
                            </td>
                            <td className="px-3 py-1.5 text-right tabular-nums text-gray-900">{formatCurrency(p.salary || p.cash_payment)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="border-t-2 border-amber-200 bg-amber-50/60 px-3 py-2 text-sm">
                    <div className="flex items-center justify-between font-semibold">
                      <span>{paymentSearch || salaryOnly ? 'Matching payments' : 'Total payments'}</span>
                      <span className="tabular-nums">{formatCurrency(paymentSearch || salaryOnly ? paymentsTotalVisible : data.total_paid)}</span>
                    </div>
                    <div className="mt-1 flex items-center justify-between text-gray-800">
                      <span>Closing balance</span>
                      <span className="tabular-nums">{formatCurrency(data.closing_balance)}</span>
                    </div>
                    <div className="mt-1 flex items-center justify-between font-bold text-amber-800">
                      <span>Payments + closing</span>
                      <span className="tabular-nums">{formatCurrency(data.total_paid + data.closing_balance)}</span>
                    </div>
                  </div>
                </div>
              </div>

              {incomeStatement && (
                <div className="mt-5 overflow-hidden rounded-xl border border-gray-200">
                  <div className="border-b border-gray-200 bg-slate-50 px-4 py-2 text-center">
                    <h3 className="text-xs font-bold tracking-wide text-gray-700">INCOME STATEMENT SUMMARY · SAME PERIOD</h3>
                  </div>
                  <table className="min-w-full text-sm">
                    <tbody className="divide-y divide-gray-100">
                      <tr>
                        <td className="px-4 py-2 text-gray-600">Total income</td>
                        <td className="px-4 py-2 text-right tabular-nums text-gray-800">{formatCurrency(incomeStatement.total_revenue)}</td>
                      </tr>
                      <tr>
                        <td className="px-4 py-2 text-gray-600">Total expense</td>
                        <td className="px-4 py-2 text-right tabular-nums text-gray-800">{formatCurrency(incomeStatement.total_expenses)}</td>
                      </tr>
                      <tr className={incomeStatement.net_income >= 0 ? 'bg-emerald-50 font-bold' : 'bg-rose-50 font-bold'}>
                        <td className={`px-4 py-2 ${incomeStatement.net_income >= 0 ? 'text-emerald-800' : 'text-rose-800'}`}>Surplus / deficit</td>
                        <td className={`px-4 py-2 text-right tabular-nums ${incomeStatement.net_income >= 0 ? 'text-emerald-800' : 'text-rose-800'}`}>
                          {incomeStatement.net_income >= 0 ? '(+) ' : '(−) '}{formatCurrency(Math.abs(incomeStatement.net_income))}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="print:hidden">
          <DuesSection />
        </div>
      </div>
    </AdminLayout>
  );
}

type DuesType = 'receivable' | 'payable';

// Receivable = what customers still owe on orders; payable = what we still owe suppliers on
// purchase orders. Point-in-time balances with their own filters, deliberately independent of
// the cash-book date range above.
function DuesSection() {
  const [duesType, setDuesType] = useState<DuesType>('receivable');
  const [search, setSearch] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [minAmount, setMinAmount] = useState('');
  const [page, setPage] = useState(1);
  const [dues, setDues] = useState<DuesResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);

  const fetchDues = useCallback(async () => {
    setIsLoading(true);
    setError(false);
    try {
      const res = await adminService.getDues({
        type: duesType,
        search: appliedSearch || undefined,
        from_date: fromDate || undefined,
        to_date: toDate || undefined,
        min_amount: minAmount || undefined,
        page,
        per_page: 20,
      });
      setDues(res.data);
    } catch (err) {
      toast.error(getErrorMessage(err));
      setError(true);
    } finally {
      setIsLoading(false);
    }
  }, [duesType, appliedSearch, fromDate, toDate, minAmount, page]);

  useEffect(() => { fetchDues(); }, [fetchDues]);

  const applySearch = () => {
    setAppliedSearch(search.trim());
    setPage(1);
  };

  const clearFilters = () => {
    setSearch('');
    setAppliedSearch('');
    setFromDate('');
    setToDate('');
    setMinAmount('');
    setPage(1);
  };

  const summary = dues?.summary;
  const net = (summary?.receivable.total ?? 0) - (summary?.payable.total ?? 0);
  const hasFilters = !!(appliedSearch || fromDate || toDate || minAmount);
  const isReceivable = duesType === 'receivable';

  return (
    <section className="mt-5 rounded-2xl border border-gray-200 bg-white p-3 md:p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Scale className="h-4 w-4 text-gray-700" />
          <h2 className="text-sm font-bold text-gray-900">Dues</h2>
          <span className="text-[11px] text-gray-500">Outstanding now · not limited to the dates above</span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <div className="flex items-center justify-between gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2">
          <div className="min-w-0">
            <p className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-emerald-700">
              <Users className="h-3 w-3" /> Due from customers
            </p>
            <p className="text-base font-bold leading-tight tabular-nums text-emerald-800">{formatCurrency(summary?.receivable.total ?? 0)}</p>
          </div>
          <span className="shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-800">{summary?.receivable.count ?? 0} orders</span>
        </div>
        <div className="flex items-center justify-between gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
          <div className="min-w-0">
            <p className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-amber-700">
              <Truck className="h-3 w-3" /> Due to suppliers
            </p>
            <p className="text-base font-bold leading-tight tabular-nums text-amber-800">{formatCurrency(summary?.payable.total ?? 0)}</p>
            {(summary?.payable.supplier_refund_due ?? 0) > 0 && (
              <p className="text-[10px] text-amber-700/90">+ {formatCurrency(summary?.payable.supplier_refund_due ?? 0)} refund due back to us</p>
            )}
          </div>
          <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800">{summary?.payable.count ?? 0} POs</span>
        </div>
        <div className={`flex items-center justify-between gap-2 rounded-lg border px-3 py-2 ${net >= 0 ? 'border-indigo-200 bg-indigo-50' : 'border-rose-200 bg-rose-50'}`}>
          <div className="min-w-0">
            <p className={`flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide ${net >= 0 ? 'text-indigo-700' : 'text-rose-700'}`}>
              <Scale className="h-3 w-3" /> Net position
            </p>
            <p className={`text-base font-bold leading-tight tabular-nums ${net >= 0 ? 'text-indigo-800' : 'text-rose-800'}`}>
              {net >= 0 ? '' : '−'}{formatCurrency(Math.abs(net))}
            </p>
          </div>
          <span className="shrink-0 text-right text-[10px] leading-tight text-gray-500">customers<br />minus suppliers</span>
        </div>
      </div>

      <div className="mt-3 flex flex-col gap-2 rounded-lg border border-gray-200 bg-gray-50/70 p-2 xl:flex-row xl:items-end">
        <div className="inline-flex shrink-0 rounded-lg border border-gray-200 bg-white p-0.5">
          {([
            { value: 'receivable', label: 'Customers', count: summary?.receivable.count, active: 'bg-emerald-600 text-white', idle: 'text-emerald-700 hover:bg-emerald-50' },
            { value: 'payable', label: 'Suppliers', count: summary?.payable.count, active: 'bg-amber-500 text-white', idle: 'text-amber-700 hover:bg-amber-50' },
          ] as const).map((tab) => (
            <button
              key={tab.value}
              type="button"
              onClick={() => { setDuesType(tab.value); setPage(1); }}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${duesType === tab.value ? tab.active : tab.idle}`}
            >
              {tab.label} {tab.count !== undefined && <span className="opacity-80">({tab.count})</span>}
            </button>
          ))}
        </div>
        <div className="grid flex-1 grid-cols-2 items-end gap-2 md:grid-cols-[2fr_1fr_1fr_1fr_auto]">
          <div className="relative col-span-2 md:col-span-1">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
            <Input
              placeholder={isReceivable ? 'Order no., customer, phone…' : 'PO no., supplier…'}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && applySearch()}
              className="h-8 pl-8 text-xs"
            />
          </div>
          <Input type="date" value={fromDate} onChange={(e) => { setFromDate(e.target.value); setPage(1); }} className="h-8 text-xs" title="Placed from" />
          <Input type="date" value={toDate} onChange={(e) => { setToDate(e.target.value); setPage(1); }} className="h-8 text-xs" title="Placed to" />
          <Input type="number" min={0} placeholder="Min amount" value={minAmount} onChange={(e) => { setMinAmount(e.target.value); setPage(1); }} className="h-8 text-xs" />
          <div className="flex gap-1.5">
            <Button size="sm" onClick={applySearch}>Search</Button>
            {hasFilters && <Button size="sm" variant="ghost" onClick={clearFilters}>Clear</Button>}
          </div>
        </div>
      </div>

      <div className="mt-3 overflow-hidden rounded-lg border border-gray-200">
        {isLoading && !dues ? (
          <div className="flex justify-center py-8"><LoadingSpinner size="sm" text="Loading dues…" /></div>
        ) : error && !dues ? (
          <ErrorState title="Failed to load dues" message="Could not fetch outstanding balances." onRetry={fetchDues} />
        ) : (dues?.data ?? []).length === 0 ? (
          <EmptyState
            title={hasFilters ? 'No dues match these filters' : isReceivable ? 'No outstanding customer dues' : 'No outstanding supplier dues'}
            description={hasFilters ? 'Clear a filter to see more.' : undefined}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-xs">
              <thead className={isReceivable ? 'bg-emerald-600 text-white' : 'bg-amber-500 text-white'}>
                <tr>
                  <th className="px-3 py-2 text-left font-semibold whitespace-nowrap">Date</th>
                  <th className="px-3 py-2 text-left font-semibold whitespace-nowrap">{isReceivable ? 'Order' : 'PO'}</th>
                  <th className="px-3 py-2 text-left font-semibold">{isReceivable ? 'Customer' : 'Supplier'}</th>
                  <th className="px-3 py-2 text-right font-semibold whitespace-nowrap">Total</th>
                  <th className="px-3 py-2 text-right font-semibold whitespace-nowrap">Paid</th>
                  <th className="px-3 py-2 text-right font-semibold whitespace-nowrap">Outstanding</th>
                  <th className="px-3 py-2 text-left font-semibold whitespace-nowrap">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {(dues?.data ?? []).map((row, i) => (
                  <tr key={`${row.type}-${row.id}`} className={`${i % 2 ? 'bg-gray-50/60' : 'bg-white'} hover:bg-indigo-50/40`}>
                    <td className="whitespace-nowrap px-3 py-1.5 tabular-nums text-gray-600">{row.date}</td>
                    <td className="whitespace-nowrap px-3 py-1.5 font-mono text-[11px] text-gray-900">{row.reference}</td>
                    <td className="px-3 py-1.5 text-gray-700">
                      <span className="font-medium">{row.party_name || '—'}</span>
                      {row.party_phone && <span className="ml-1.5 text-[10px] text-gray-400">{row.party_phone}</span>}
                    </td>
                    <td className="px-3 py-1.5 text-right tabular-nums text-gray-700">{formatCurrency(row.total)}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums text-gray-700">{formatCurrency(row.paid_amount)}</td>
                    <td className={`px-3 py-1.5 text-right font-bold tabular-nums ${isReceivable ? 'text-emerald-700' : 'text-amber-700'}`}>{formatCurrency(row.outstanding)}</td>
                    <td className="px-3 py-1.5">
                      <Badge variant="default" className="!px-1.5 !py-0 !text-[10px]">{row.status.replace(/_/g, ' ')}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {dues && dues.meta.last_page > 1 && (
        <div className="mt-2 flex items-center justify-between text-xs text-gray-500">
          <span>Page {dues.meta.current_page} of {dues.meta.last_page} · {dues.meta.total} rows</span>
          <Pagination currentPage={page} totalPages={dues.meta.last_page} onPageChange={setPage} />
        </div>
      )}
    </section>
  );
}
