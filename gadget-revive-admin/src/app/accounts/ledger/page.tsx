'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { RefreshCw } from 'lucide-react';
import { AdminLayout } from '@/components/layout';
import {
  Card, CardContent, CardHeader, CardTitle,
  Button, SearchableSelect, DateRangePicker,
  LoadingSpinner, EmptyState, ErrorState, InfoButton, StepFlow,
} from '@/components/ui';
import { ChartOfAccount, AccountLedgerLine } from '@/types';
import { formatCurrency, formatDate, getErrorMessage } from '@/lib/utils';
import adminService from '@/lib/adminService';
import toast from 'react-hot-toast';

export default function GeneralLedgerPage() {
  const [accounts, setAccounts] = useState<ChartOfAccount[]>([]);
  const [accountId, setAccountId] = useState<string>('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  const [account, setAccount] = useState<ChartOfAccount | null>(null);
  const [lines, setLines] = useState<AccountLedgerLine[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    adminService.getAccounts({ is_active: true }).then((res) => setAccounts(res.data?.data ?? []));
  }, []);

  const fetchLedger = useCallback(async () => {
    if (!accountId) return;
    setIsLoading(true);
    setError(false);
    try {
      const res = await adminService.getAccountLedger(Number(accountId), fromDate || undefined, toDate || undefined);
      setAccount(res.data?.data?.account ?? null);
      setLines(res.data?.data?.lines ?? []);
    } catch (err) {
      toast.error(getErrorMessage(err));
      setError(true);
    } finally {
      setIsLoading(false);
    }
  }, [accountId, fromDate, toDate]);

  useEffect(() => { fetchLedger(); }, [fetchLedger]);

  const accountOptions = accounts.map((a) => ({
    value: a.id,
    label: `${a.code} — ${a.name}`,
    description: a.type,
  }));

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-gray-900">General Ledger</h1>
            <InfoButton title="How the General Ledger Works">
              <p>
                The general ledger is like a bank statement for one specific account — it lists every journal line
                ever posted to that account, in date order, with a <strong>running balance</strong> after each one.
                It&apos;s the most detailed view of an account&apos;s activity.
              </p>
              <p>
                For a Debit-normal account (like Cash), a debit line increases the running balance and a credit line
                decreases it. For a Credit-normal account (like Accounts Payable), it&apos;s the other way around.
              </p>
              <div>
                <p className="font-semibold text-gray-900 mb-2">How to use this page</p>
                <StepFlow steps={[
                  'Search and pick an account from the dropdown (e.g. "1000 — Cash").',
                  'Optionally narrow to a date range using the presets or the two date fields.',
                  'Read down the table: each row is one journal line, with the running balance in the last column.',
                ]} />
              </div>
              <p className="text-xs text-gray-500">
                This is a read-only view — to change an account&apos;s balance you post a new journal entry, either
                automatically (via an order, expense, or purchase) or manually from the Journal Entries page.
              </p>
            </InfoButton>
          </div>
          <p className="text-sm text-gray-500 mt-1">View every posting to a specific account, with a running balance.</p>
        </div>

        <Card>
          <CardContent className="pt-4 space-y-4">
            <SearchableSelect
              label="Account"
              placeholder="Select an account..."
              searchPlaceholder="Search accounts..."
              options={accountOptions}
              value={accountId}
              onChange={(v) => setAccountId(String(v))}
            />
            <DateRangePicker
              startDate={fromDate}
              endDate={toDate}
              onStartDateChange={setFromDate}
              onEndDateChange={setToDate}
            />
          </CardContent>
        </Card>

        {accountId && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>{account ? `${account.code} — ${account.name}` : 'Ledger'}</CardTitle>
              <Button variant="ghost" size="sm" onClick={fetchLedger} leftIcon={<RefreshCw className="w-4 h-4" />}>
                Refresh
              </Button>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex justify-center py-12"><LoadingSpinner /></div>
              ) : error ? (
                <ErrorState message="Failed to load ledger." onRetry={fetchLedger} />
              ) : lines.length === 0 ? (
                <EmptyState title="No activity" description="No journal lines posted to this account in the selected range." />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200 text-left">
                        <th className="pb-3 pr-4 font-semibold text-gray-600">Date</th>
                        <th className="pb-3 pr-4 font-semibold text-gray-600">Entry #</th>
                        <th className="pb-3 pr-4 font-semibold text-gray-600">Description</th>
                        <th className="pb-3 pr-4 font-semibold text-gray-600 text-right">Debit</th>
                        <th className="pb-3 pr-4 font-semibold text-gray-600 text-right">Credit</th>
                        <th className="pb-3 font-semibold text-gray-600 text-right">Running Balance</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {lines.map((line, i) => (
                        <tr key={i} className="hover:bg-gray-50">
                          <td className="py-3 pr-4 text-gray-600">{formatDate(line.date)}</td>
                          <td className="py-3 pr-4 font-mono text-gray-900">{line.entry_number}</td>
                          <td className="py-3 pr-4 text-gray-900">{line.description}</td>
                          <td className="py-3 pr-4 text-right text-gray-900">
                            {line.debit > 0 ? formatCurrency(line.debit) : ''}
                          </td>
                          <td className="py-3 pr-4 text-right text-gray-900">
                            {line.credit > 0 ? formatCurrency(line.credit) : ''}
                          </td>
                          <td className="py-3 text-right font-medium text-gray-900">{formatCurrency(line.running_balance)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </AdminLayout>
  );
}
