'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { Plus, RefreshCw, Filter, Eye } from 'lucide-react';
import { AdminLayout } from '@/components/layout';
import {
  Card, CardContent, CardHeader, CardTitle,
  Button, Select, Modal, SearchableSelect,
  LoadingSpinner, Pagination, EmptyState, ErrorState,
  InfoButton, TAccountExample, StepFlow,
} from '@/components/ui';
import { JournalEntry, ChartOfAccount, PaginatedResponse } from '@/types';
import { formatCurrency, formatDate, getErrorMessage } from '@/lib/utils';
import adminService from '@/lib/adminService';
import toast from 'react-hot-toast';

interface ManualLine {
  account_code: string;
  debit: string;
  credit: string;
}

const EMPTY_LINE: ManualLine = { account_code: '', debit: '', credit: '' };

export default function JournalEntriesPage() {
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [accounts, setAccounts] = useState<ChartOfAccount[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  const [referenceType, setReferenceType] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [entryDate, setEntryDate] = useState(new Date().toISOString().split('T')[0]);
  const [description, setDescription] = useState('');
  const [lines, setLines] = useState<ManualLine[]>([{ ...EMPTY_LINE }, { ...EMPTY_LINE }]);
  const [isSaving, setIsSaving] = useState(false);

  const fetchEntries = useCallback(async () => {
    setIsLoading(true);
    setError(false);
    try {
      const params: Record<string, string | number> = { page: currentPage, per_page: 20 };
      if (referenceType) params.reference_type = referenceType;
      if (fromDate) params.from_date = fromDate;
      if (toDate) params.to_date = toDate;

      const res = await adminService.getJournalEntries(params);
      const payload = res.data as unknown as PaginatedResponse<JournalEntry>;
      setEntries(Array.isArray(payload.data) ? payload.data : []);
      setTotalPages(payload.meta?.last_page || 1);
      setTotalCount(payload.meta?.total || 0);
    } catch (err) {
      toast.error(getErrorMessage(err));
      setError(true);
      setEntries([]);
    } finally {
      setIsLoading(false);
    }
  }, [currentPage, referenceType, fromDate, toDate]);

  useEffect(() => { fetchEntries(); }, [fetchEntries]);

  useEffect(() => {
    adminService.getAccounts({ is_active: true }).then((res) => setAccounts(res.data?.data ?? []));
  }, []);

  const handleFilter = () => {
    setCurrentPage(1);
    fetchEntries();
  };

  const clearFilters = () => {
    setReferenceType('');
    setFromDate('');
    setToDate('');
    setCurrentPage(1);
  };

  const openCreate = () => {
    setEntryDate(new Date().toISOString().split('T')[0]);
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

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-gray-900">Journal Entries</h1>
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
                  <p className="font-semibold text-gray-900 mb-2">Example: a customer pays a ৳500 order</p>
                  <TAccountExample
                    caption="Automatically posted when payment is confirmed"
                    debits={[{ label: 'Cash', amount: 500 }]}
                    credits={[{ label: 'Sales Revenue', amount: 500 }]}
                  />
                </div>
                <div>
                  <p className="font-semibold text-gray-900 mb-2">When to add a manual entry</p>
                  <p className="mb-2">Use &quot;New Manual Entry&quot; only for things with no automatic trigger — e.g. correcting a mistake, or recording something outside the normal order/expense/purchase flow.</p>
                  <StepFlow steps={[
                    'Click "New Manual Entry" and pick the date.',
                    'Write a clear description — this is what you’ll see in reports later.',
                    'Add lines: for each line, pick an account and type an amount into either the Debit or the Credit box (not both).',
                    'Keep adding lines until the green "Balanced" banner appears — debit total must exactly equal credit total.',
                    'Click "Post Entry". Once posted, an entry cannot be edited or deleted — only reversed by a new entry.',
                  ]} />
                </div>
              </InfoButton>
            </div>
            <p className="text-sm text-gray-500 mt-1">{totalCount} entr{totalCount !== 1 ? 'ies' : 'y'}</p>
          </div>
          <Button onClick={openCreate} leftIcon={<Plus className="w-4 h-4" />}>
            New Manual Entry
          </Button>
        </div>

        <Card>
          <CardContent className="pt-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Select
                label="Reference Type"
                value={referenceType}
                onChange={(e) => setReferenceType(e.target.value)}
                options={[
                  { value: '', label: 'All' },
                  { value: 'Order', label: 'Order' },
                  { value: 'Expense', label: 'Expense' },
                  { value: 'PurchaseOrder', label: 'Purchase Order' },
                  { value: 'Manual', label: 'Manual' },
                ]}
              />
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">From</label>
                <input
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">To</label>
                <input
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                />
              </div>
              <div className="flex items-end gap-2">
                <Button onClick={handleFilter} leftIcon={<Filter className="w-4 h-4" />} className="flex-1">
                  Filter
                </Button>
                <Button variant="ghost" onClick={clearFilters} size="sm">Clear</Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Entries</CardTitle>
            <Button variant="ghost" size="sm" onClick={fetchEntries} leftIcon={<RefreshCw className="w-4 h-4" />}>
              Refresh
            </Button>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center py-12"><LoadingSpinner /></div>
            ) : error ? (
              <ErrorState message="Failed to load journal entries." onRetry={fetchEntries} />
            ) : entries.length === 0 ? (
              <EmptyState title="No journal entries found" description="Entries are posted automatically, or add a manual one." />
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200 text-left">
                        <th className="pb-3 pr-4 font-semibold text-gray-600">Entry #</th>
                        <th className="pb-3 pr-4 font-semibold text-gray-600">Date</th>
                        <th className="pb-3 pr-4 font-semibold text-gray-600">Description</th>
                        <th className="pb-3 pr-4 font-semibold text-gray-600">Reference</th>
                        <th className="pb-3 pr-4 font-semibold text-gray-600 text-right">Debit</th>
                        <th className="pb-3 pr-4 font-semibold text-gray-600 text-right">Credit</th>
                        <th className="pb-3 font-semibold text-gray-600 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {entries.map((entry) => {
                        const debitTotal = (entry.lines ?? []).reduce((s, l) => s + Number(l.debit), 0);
                        const creditTotal = (entry.lines ?? []).reduce((s, l) => s + Number(l.credit), 0);
                        return (
                          <tr key={entry.id} className="hover:bg-gray-50">
                            <td className="py-3 pr-4 font-mono text-gray-900">{entry.entry_number}</td>
                            <td className="py-3 pr-4 text-gray-600">{formatDate(entry.entry_date)}</td>
                            <td className="py-3 pr-4 text-gray-900">
                              {entry.description}
                              {entry.is_reversal && (
                                <span className="ml-2 text-xs text-red-500 font-medium">(reversal)</span>
                              )}
                            </td>
                            <td className="py-3 pr-4 text-gray-600">
                              {entry.reference_type ? `${entry.reference_type}${entry.reference_id ? ` #${entry.reference_id}` : ''}` : '—'}
                            </td>
                            <td className="py-3 pr-4 text-right text-gray-900">{formatCurrency(debitTotal)}</td>
                            <td className="py-3 pr-4 text-right text-gray-900">{formatCurrency(creditTotal)}</td>
                            <td className="py-3 text-right">
                              <Link href={`/accounts/journal/${entry.id}`}>
                                <Button variant="ghost" size="sm" leftIcon={<Eye className="w-3.5 h-3.5" />}>
                                  View
                                </Button>
                              </Link>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                {totalPages > 1 && (
                  <div className="mt-4">
                    <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <Modal isOpen={isFormOpen} onClose={() => setIsFormOpen(false)} title="New Manual Journal Entry" size="lg">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Entry Date</label>
              <input
                type="date"
                value={entryDate}
                onChange={(e) => setEntryDate(e.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description *</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              placeholder="e.g. Correcting entry for..."
            />
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">Lines</label>
            {lines.map((line, index) => (
              <div key={index} className="grid grid-cols-12 gap-2 items-start">
                <div className="col-span-6">
                  <SearchableSelect
                    placeholder="Select account..."
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
                  className="col-span-2 text-xs text-red-500 hover:text-red-700 disabled:opacity-30 disabled:cursor-not-allowed py-2"
                >
                  Remove
                </button>
              </div>
            ))}
            <Button variant="ghost" size="sm" onClick={addLine} leftIcon={<Plus className="w-3.5 h-3.5" />}>
              Add Line
            </Button>
          </div>

          <div className={`rounded-md p-3 text-sm font-medium ${isBalanced ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'}`}>
            Debit total: {formatCurrency(totalDebit)} — Credit total: {formatCurrency(totalCredit)} — Difference: {formatCurrency(Math.abs(difference))}
            {isBalanced ? ' ✓ Balanced' : ''}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => setIsFormOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} isLoading={isSaving} disabled={!isBalanced}>
              Post Entry
            </Button>
          </div>
        </div>
      </Modal>
    </AdminLayout>
  );
}
