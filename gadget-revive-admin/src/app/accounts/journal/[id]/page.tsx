'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { AdminLayout } from '@/components/layout';
import { Card, CardContent, CardHeader, CardTitle, Button, Badge, LoadingSpinner, ErrorState, InfoButton } from '@/components/ui';
import { JournalEntry } from '@/types';
import { formatCurrency, formatDate, getErrorMessage } from '@/lib/utils';
import adminService from '@/lib/adminService';
import toast from 'react-hot-toast';

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

  return (
    <AdminLayout>
      <div className="space-y-6">
        <Button variant="ghost" size="sm" onClick={() => router.back()} leftIcon={<ArrowLeft className="w-4 h-4" />}>
          Back
        </Button>

        {isLoading ? (
          <div className="flex justify-center py-12"><LoadingSpinner /></div>
        ) : error || !entry ? (
          <ErrorState message="Failed to load journal entry." onRetry={fetchEntry} />
        ) : (
          <>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-2xl font-bold text-gray-900 font-mono">{entry.entry_number}</h1>
                  <InfoButton title="Reading a Journal Entry">
                    <p>
                      This is the full detail of one posted transaction. Each row is a <strong>line</strong> — it hits
                      exactly one account, as either a debit or a credit (never both). The Debit column total always
                      equals the Credit column total; that&apos;s what the green &quot;Balanced&quot; banner at the bottom confirms.
                    </p>
                    <p>
                      A <Badge variant="danger">Reversal</Badge> badge means this entry exists specifically to undo an
                      earlier one — for example, refunding an order posts a reversal of that order&apos;s original
                      payment entry, with every debit and credit swapped.
                    </p>
                    <p className="text-xs text-gray-500">
                      Posted journal entries are permanent and cannot be edited or deleted — accounting history is
                      never rewritten, only corrected with a new, linked entry.
                    </p>
                  </InfoButton>
                </div>
                <p className="text-sm text-gray-500 mt-1">{formatDate(entry.entry_date)} — {entry.description}</p>
              </div>
              <div className="flex gap-2">
                {entry.is_reversal && <Badge variant="danger">Reversal</Badge>}
                {entry.reference_type && (
                  <Badge variant="info">
                    {entry.reference_type}{entry.reference_id ? ` #${entry.reference_id}` : ''}
                  </Badge>
                )}
              </div>
            </div>

            {entry.reversed_entry_id && (
              <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">
                This entry reverses <span className="font-mono font-medium">entry #{entry.reversed_entry_id}</span>.
              </div>
            )}

            <Card>
              <CardHeader>
                <CardTitle>Lines</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200 text-left">
                        <th className="pb-3 pr-4 font-semibold text-gray-600">Account</th>
                        <th className="pb-3 pr-4 font-semibold text-gray-600">Description</th>
                        <th className="pb-3 pr-4 font-semibold text-gray-600 text-right">Debit</th>
                        <th className="pb-3 font-semibold text-gray-600 text-right">Credit</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {(entry.lines ?? []).map((line) => (
                        <tr key={line.id}>
                          <td className="py-3 pr-4">
                            <span className="font-mono text-gray-500 mr-2">{line.account?.code}</span>
                            <span className="text-gray-900">{line.account?.name}</span>
                          </td>
                          <td className="py-3 pr-4 text-gray-500">{line.description || '—'}</td>
                          <td className="py-3 pr-4 text-right text-gray-900">
                            {Number(line.debit) > 0 ? formatCurrency(Number(line.debit)) : ''}
                          </td>
                          <td className="py-3 text-right text-gray-900">
                            {Number(line.credit) > 0 ? formatCurrency(Number(line.credit)) : ''}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 border-gray-300 font-semibold">
                        <td className="pt-3 pr-4" colSpan={2}>Total</td>
                        <td className="pt-3 pr-4 text-right">{formatCurrency(debitTotal)}</td>
                        <td className="pt-3 text-right">{formatCurrency(creditTotal)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
                <div className={`mt-4 rounded-md p-3 text-sm font-medium ${debitTotal === creditTotal ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                  {debitTotal === creditTotal ? '✓ Balanced' : '⚠ Unbalanced — this should never happen'}
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </AdminLayout>
  );
}
