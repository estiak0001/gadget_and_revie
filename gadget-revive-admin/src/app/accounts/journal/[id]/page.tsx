'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { ArrowLeft, CheckCircle2, AlertTriangle, Undo2, ExternalLink, CalendarDays, Hash } from 'lucide-react';
import { AdminLayout } from '@/components/layout';
import { Button, LoadingSpinner, ErrorState, InfoButton } from '@/components/ui';
import { KpiTile } from '@/components/reports/shared';
import { JournalEntry } from '@/types';
import { formatCurrency, formatDate, getErrorMessage } from '@/lib/utils';
import adminService from '@/lib/adminService';

const SOURCE_LINK: Record<string, (id: number) => string> = {
  Order: (id) => `/orders/${id}`,
  Expense: () => '/expenses',
  PurchaseOrder: (id) => `/purchases/${id}`,
};

const SOURCE_LABEL: Record<string, string> = {
  Order: 'Order',
  Expense: 'Expense',
  PurchaseOrder: 'Purchase order',
  Investment: 'Investment',
  Manual: 'Manual',
};

export default function JournalEntryDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = Number(params.id);

  const [entry, setEntry] = useState<JournalEntry | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);

  const fetchEntry = useCallback(async () => {
    setIsLoading(true);
    setError(false);
    try {
      const res = await adminService.getJournalEntry(id);
      setEntry(res.data?.data ?? null);
    } catch (err) {
      toast.error(getErrorMessage(err));
      setError(true);
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => { fetchEntry(); }, [fetchEntry]);

  const debitTotal = (entry?.lines ?? []).reduce((s, l) => s + Number(l.debit), 0);
  const creditTotal = (entry?.lines ?? []).reduce((s, l) => s + Number(l.credit), 0);
  const balanced = Math.abs(debitTotal - creditTotal) < 0.005;
  const sourceHref = entry?.reference_type && entry.reference_id && SOURCE_LINK[entry.reference_type]
    ? SOURCE_LINK[entry.reference_type](entry.reference_id)
    : null;

  return (
    <AdminLayout>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2.5">
          <Button variant="ghost" size="sm" onClick={() => router.back()} leftIcon={<ArrowLeft className="h-3.5 w-3.5" />}>Back</Button>
          {entry && <h1 className="font-mono text-lg font-bold text-gray-900">{entry.entry_number}</h1>}
          <InfoButton title="Reading a Journal Entry">
            <p>
              This is the full detail of one posted transaction. Each row is a <strong>line</strong> — it hits
              exactly one account, as either a debit or a credit (never both). The Debit column total always
              equals the Credit column total; that&apos;s what the &quot;Balanced&quot; check confirms.
            </p>
            <p>
              A <strong>Reversal</strong> entry exists specifically to undo an earlier one — for example, refunding an
              order posts a reversal of that order&apos;s original payment entry, with every debit and credit swapped.
            </p>
            <p className="text-xs text-gray-500">
              Posted journal entries are permanent and cannot be edited or deleted — accounting history is
              never rewritten, only corrected with a new, linked entry.
            </p>
          </InfoButton>
        </div>
      </div>

      {isLoading && !entry ? (
        <div className="flex justify-center py-16"><LoadingSpinner /></div>
      ) : error || !entry ? (
        <ErrorState message="Failed to load journal entry." onRetry={fetchEntry} />
      ) : (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
            <KpiTile label="Entry date" value={formatDate(entry.entry_date)} tone="indigo" icon={<CalendarDays className="h-4 w-4 opacity-60" />} sub={entry.description} />
            <KpiTile label="Total debits" value={formatCurrency(debitTotal)} tone="sky" sub={`${(entry.lines ?? []).length} line${(entry.lines ?? []).length === 1 ? '' : 's'}`} />
            <KpiTile label="Total credits" value={formatCurrency(creditTotal)} tone="amber" sub="Must equal debits" />
            <KpiTile
              label="Balance check"
              value={balanced ? 'Balanced' : 'Unbalanced'}
              tone={balanced ? 'emerald' : 'rose'}
              icon={balanced ? <CheckCircle2 className="h-4 w-4 opacity-60" /> : <AlertTriangle className="h-4 w-4 opacity-60" />}
              sub={balanced ? 'Debits equal credits' : 'This should never happen'}
            />
          </div>

          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-xs">
            <span className="inline-flex items-center gap-1 font-semibold text-gray-600"><Hash className="h-3 w-3" /> Source</span>
            {entry.reference_type ? (
              sourceHref ? (
                <Link href={sourceHref} className="inline-flex items-center gap-1 rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-0.5 font-semibold text-indigo-700 hover:underline">
                  {SOURCE_LABEL[entry.reference_type] ?? entry.reference_type} {entry.reference_id ? `#${entry.reference_id}` : ''}
                  <ExternalLink className="h-3 w-3" />
                </Link>
              ) : (
                <span className="rounded-full border border-gray-200 bg-gray-50 px-2.5 py-0.5 font-semibold text-gray-700">
                  {SOURCE_LABEL[entry.reference_type] ?? entry.reference_type}{entry.reference_id ? ` #${entry.reference_id}` : ''}
                </span>
              )
            ) : (
              <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 font-semibold text-emerald-700">Manual entry</span>
            )}
            {entry.is_reversal && (
              <span className="inline-flex items-center gap-1 rounded-full border border-rose-200 bg-rose-50 px-2.5 py-0.5 font-semibold text-rose-700">
                <Undo2 className="h-3 w-3" /> Reversal
              </span>
            )}
            {entry.reversed_entry_id && (
              <span className="rounded-full border border-rose-200 bg-rose-50 px-2.5 py-0.5 font-mono font-semibold text-rose-700">
                Reverses entry #{entry.reversed_entry_id}
              </span>
            )}
          </div>

          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
            <div className="border-b border-gray-100 px-4 py-2.5">
              <h2 className="text-sm font-semibold text-gray-900">Lines</h2>
            </div>
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-2 text-left font-semibold">Account</th>
                  <th className="px-4 py-2 text-left font-semibold">Line description</th>
                  <th className="px-4 py-2 text-right font-semibold">Debit</th>
                  <th className="px-4 py-2 text-right font-semibold">Credit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {(entry.lines ?? []).map((line, i) => (
                  <tr key={line.id} className={i % 2 ? 'bg-slate-50/40' : 'bg-white'}>
                    <td className="px-4 py-2">
                      <Link href={`/accounts/ledger?account=${line.account_id ?? ''}`} className="inline-flex items-center gap-2 hover:underline">
                        <span className="font-mono text-xs font-semibold text-gray-500">{line.account?.code}</span>
                        <span className="font-semibold text-gray-900">{line.account?.name}</span>
                      </Link>
                    </td>
                    <td className="px-4 py-2 text-gray-500">{line.description || '—'}</td>
                    <td className="whitespace-nowrap px-4 py-2 text-right tabular-nums text-gray-900">
                      {Number(line.debit) > 0 ? formatCurrency(Number(line.debit)) : '—'}
                    </td>
                    <td className="whitespace-nowrap px-4 py-2 text-right tabular-nums text-gray-900">
                      {Number(line.credit) > 0 ? formatCurrency(Number(line.credit)) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-slate-50">
                <tr className="border-t-2 border-gray-300 font-bold">
                  <td className="px-4 py-2.5" colSpan={2}>Total</td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-right tabular-nums">{formatCurrency(debitTotal)}</td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-right tabular-nums">{formatCurrency(creditTotal)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
