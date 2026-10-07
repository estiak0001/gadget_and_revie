'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { TrendingUp, TrendingDown, Receipt, Package, RefreshCw } from 'lucide-react';
import { AdminLayout } from '@/components/layout';
import { Button, LoadingSpinner, ErrorState, InfoButton, StepFlow } from '@/components/ui';
import { DateRange, DateRangeBar, KpiTile, Panel, presetRange } from '@/components/reports/shared';
import { IncomeStatement } from '@/types';
import { formatCurrency, getErrorMessage } from '@/lib/utils';
import adminService from '@/lib/adminService';

type Line = { code: string; name: string; amount: number };

const PRESETS: DateRange['preset'][] = ['month', 'last_month', 'year', '90d', 'custom'];

function isCostOfGoods(code: string): boolean {
  return code.startsWith('50');
}

function Section({
  title, lines, total, tone, sign,
}: {
  title: string;
  lines: Line[];
  total: number;
  tone: string;
  sign: '' | '−';
}) {
  const shown = lines.filter((l) => Math.abs(l.amount) > 0.004);
  const max = Math.max(1, ...shown.map((l) => Math.abs(l.amount)));
  return (
    <div>
      <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-500">{title}</p>
      {shown.length === 0 ? (
        <p className="py-2 text-xs italic text-gray-400">No activity in this period.</p>
      ) : (
        <ul className="space-y-1.5">
          {shown.map((l) => (
            <li key={l.code}>
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="flex min-w-0 items-center gap-2">
                  <span className="font-mono text-[11px] text-gray-400">{l.code}</span>
                  <span className="truncate text-gray-800">{l.name}</span>
                </span>
                <span className="whitespace-nowrap tabular-nums text-gray-900">{sign}{formatCurrency(Math.abs(l.amount))}</span>
              </div>
              <div className="mt-1 h-1 overflow-hidden rounded-full bg-gray-100">
                <div className={`h-full rounded-full ${tone}`} style={{ width: `${(Math.abs(l.amount) / max) * 100}%` }} />
              </div>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-2 flex items-center justify-between border-t border-gray-200 pt-1.5 text-sm font-semibold">
        <span className="text-gray-700">Total {title.toLowerCase()}</span>
        <span className="tabular-nums text-gray-900">{sign}{formatCurrency(Math.abs(total))}</span>
      </div>
    </div>
  );
}

export default function IncomeStatementPage() {
  const [range, setRange] = useState<DateRange>(() => presetRange('month'));
  const [data, setData] = useState<IncomeStatement | null>(null);
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
      const res = await adminService.getIncomeStatement(range.start, range.end);
      setData(res.data?.data ?? null);
    } catch (err) {
      toast.error(getErrorMessage(err));
      setError(true);
    } finally {
      setIsLoading(false);
    }
  }, [range]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const pl = useMemo(() => {
    if (!data) return null;
    const cogsLines = data.expenses.filter((e) => isCostOfGoods(e.code));
    const opexLines = data.expenses.filter((e) => !isCostOfGoods(e.code));
    const cogs = cogsLines.reduce((n, l) => n + l.amount, 0);
    const opex = opexLines.reduce((n, l) => n + l.amount, 0);
    const gross = data.total_revenue - cogs;
    const net = data.net_income;
    const margin = data.total_revenue > 0 ? (net / data.total_revenue) * 100 : null;
    const grossMargin = data.total_revenue > 0 ? (gross / data.total_revenue) * 100 : null;
    return { cogsLines, opexLines, cogs, opex, gross, net, margin, grossMargin };
  }, [data]);

  const netPositive = (pl?.net ?? 0) >= 0;

  return (
    <AdminLayout>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2.5">
          <h1 className="text-lg font-bold text-gray-900">Income statement</h1>
          <span className="text-xs text-gray-500">Profit &amp; loss for the selected period</span>
          <InfoButton title="How the Income Statement Works">
            <p>
              Also called a <strong>Profit &amp; Loss (P&amp;L)</strong> statement, this shows how much the business
              earned and spent over a period of time, and whether it made a profit or a loss.
            </p>
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-center">
              <p className="font-mono text-base font-semibold text-gray-900">Revenue − Expenses = Net Income</p>
              <p className="mt-1 text-xs text-gray-500">A negative result is a net loss, shown in red.</p>
            </div>
            <p>
              Unlike the Trial Balance or Balance Sheet (which are snapshots as of one date), this report only
              counts activity <em>between</em> the two dates you choose — it answers &quot;how did we do this month?&quot;
              rather than &quot;what do we own right now?&quot;
            </p>
            <div>
              <p className="mb-2 font-semibold text-gray-900">How to use this page</p>
              <StepFlow steps={[
                'Pick a date range, or use a preset like "This month" or "This year".',
                'Review revenue, cost of goods and operating expenses by account.',
                'Check net income at the bottom — green if profitable, red if a loss.',
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
      ) : error || !data || !pl ? (
        <ErrorState message="Failed to load the income statement." onRetry={fetchData} />
      ) : (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
            <KpiTile label="Revenue" value={formatCurrency(data.total_revenue)} tone="emerald" icon={<TrendingUp className="h-4 w-4 opacity-60" />} sub="Sales recognized in period" />
            <KpiTile label="Cost of goods" value={formatCurrency(pl.cogs)} tone="amber" icon={<Package className="h-4 w-4 opacity-60" />} sub={pl.grossMargin !== null ? `Gross margin ${pl.grossMargin.toFixed(1)}%` : 'No revenue in period'} />
            <KpiTile label="Operating expenses" value={formatCurrency(pl.opex)} tone="rose" icon={<Receipt className="h-4 w-4 opacity-60" />} sub="All other expense accounts" />
            <KpiTile
              label="Net income"
              value={formatCurrency(pl.net)}
              tone={netPositive ? 'sky' : 'orange'}
              icon={netPositive ? <TrendingUp className="h-4 w-4 opacity-60" /> : <TrendingDown className="h-4 w-4 opacity-60" />}
              sub={pl.margin === null ? 'No revenue in period' : pl.margin < 0 ? 'Net loss in period' : `Net margin ${pl.margin.toFixed(1)}%`}
            />
          </div>

          <Panel title="Profit and loss" hint={`${data.from} to ${data.to}`} className="max-w-3xl">
            <div className="space-y-5 p-4">
              <Section title="Revenue" lines={data.revenue} total={data.total_revenue} tone="bg-emerald-400" sign="" />
              <Section title="Cost of goods sold" lines={pl.cogsLines} total={pl.cogs} tone="bg-amber-400" sign="−" />

              <div className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm font-bold">
                <span className="text-gray-800">Gross profit</span>
                <span className={`tabular-nums ${pl.gross >= 0 ? 'text-gray-900' : 'text-rose-600'}`}>{formatCurrency(pl.gross)}</span>
              </div>

              <Section title="Operating expenses" lines={pl.opexLines} total={pl.opex} tone="bg-rose-400" sign="−" />

              <div className={`flex items-center justify-between rounded-lg px-3 py-3 text-base font-bold ${
                netPositive ? 'bg-emerald-50 text-emerald-800' : 'bg-rose-50 text-rose-700'
              }`}>
                <span className="flex items-center gap-2">
                  {netPositive ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                  Net income
                </span>
                <span className="tabular-nums">{formatCurrency(pl.net)}</span>
              </div>
            </div>
          </Panel>

          <p className="max-w-3xl text-[11px] text-gray-400">
            Cost of goods sold is every expense account in the 5000 range; operating expenses are the rest. Expenses are
            counted as posted to the ledger, so asset and inventory purchases recorded as expenses reduce net income here.
          </p>
        </div>
      )}
    </AdminLayout>
  );
}
