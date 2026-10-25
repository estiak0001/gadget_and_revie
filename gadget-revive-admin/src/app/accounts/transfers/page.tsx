'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { ArrowRightLeft, Plus, Wallet, Landmark, Smartphone, CreditCard, HelpCircle } from 'lucide-react';
import { AdminLayout } from '@/components/layout';
import { Button, Input, Select, Modal, LoadingSpinner, EmptyState, Pagination } from '@/components/ui';
import { KpiTile, Panel, ymd } from '@/components/reports/shared';
import { PaymentMethod, PaymentMethodType, FundTransfer } from '@/types';
import { formatCurrency, formatDate, getErrorMessage } from '@/lib/utils';
import adminService from '@/lib/adminService';
import toast from 'react-hot-toast';

const TYPE_ICON: Record<PaymentMethodType, typeof Landmark> = {
  cash: Wallet, bank: Landmark, mobile_banking: Smartphone, card: CreditCard, other: HelpCircle,
};
const TONES: Array<'emerald' | 'indigo' | 'sky' | 'amber' | 'rose' | 'orange'> = ['emerald', 'indigo', 'sky', 'amber', 'rose', 'orange'];

const EMPTY_FORM = { from_payment_method_id: '', to_payment_method_id: '', amount: '', transfer_date: ymd(new Date()), description: '' };

/**
 * Moving money between payment methods, and the history of it — separate from Settings > Payment
 * (which is just naming methods and recording their bank details). This is the operational side,
 * living alongside the rest of Accounts (Journal, Ledger, Cash Book) since a transfer is exactly
 * the kind of day-to-day accounting action those pages already cover.
 */
export default function TransfersPage() {
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [transfers, setTransfers] = useState<FundTransfer[]>([]);
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [isSaving, setIsSaving] = useState(false);

  const fetchMethods = useCallback(async () => {
    try {
      const res = await adminService.getPaymentMethods({ is_active: 1 });
      setMethods(res.data.data);
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  }, []);

  const fetchTransfers = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await adminService.getFundTransfers({ page, per_page: 20 });
      setTransfers(res.data.data);
      setLastPage(res.data.meta.last_page);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  }, [page]);

  useEffect(() => { fetchMethods(); }, [fetchMethods]);
  useEffect(() => { fetchTransfers(); }, [fetchTransfers]);

  const openTransfer = () => {
    setForm({ ...EMPTY_FORM, from_payment_method_id: String(methods[0]?.id ?? ''), to_payment_method_id: String(methods[1]?.id ?? '') });
    setIsModalOpen(true);
  };

  const handleTransfer = async () => {
    const amount = Number(form.amount);
    if (!form.from_payment_method_id || !form.to_payment_method_id) { toast.error('Pick both accounts'); return; }
    if (form.from_payment_method_id === form.to_payment_method_id) { toast.error('Pick two different accounts'); return; }
    if (!amount || amount <= 0) { toast.error('Enter an amount greater than zero'); return; }
    setIsSaving(true);
    try {
      await adminService.transferFunds({
        from_payment_method_id: Number(form.from_payment_method_id),
        to_payment_method_id: Number(form.to_payment_method_id),
        amount, transfer_date: form.transfer_date, description: form.description || undefined,
      });
      toast.success('Transfer posted');
      setIsModalOpen(false);
      fetchMethods();
      setPage(1);
      fetchTransfers();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <AdminLayout>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2.5">
          <h1 className="text-lg font-bold text-gray-900">Transfers</h1>
          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-semibold text-gray-600">Accounts</span>
        </div>
        <Button size="sm" onClick={openTransfer} disabled={methods.length < 2} leftIcon={<Plus className="h-3.5 w-3.5" />}>
          Transfer funds
        </Button>
      </div>

      {methods.length > 0 && (
        <div className="mb-3 grid grid-cols-2 gap-2 lg:grid-cols-4">
          {methods.map((m, i) => {
            const Icon = TYPE_ICON[m.type];
            return <KpiTile key={m.id} label={m.name} value={formatCurrency(m.balance ?? 0)} tone={TONES[i % TONES.length]} icon={<Icon className="h-4 w-4 opacity-60" />} />;
          })}
        </div>
      )}

      <Panel title="Transfer history" hint="Money moved between payment methods, most recent first">
        {isLoading ? (
          <div className="flex items-center justify-center py-12"><LoadingSpinner size="lg" text="Loading transfers..." /></div>
        ) : transfers.length === 0 ? (
          <EmptyState
            icon={<ArrowRightLeft className="w-8 h-8 text-gray-400" />}
            title="No transfers yet"
            description="Move cash between accounts (e.g. depositing cash into the bank) and it'll show up here."
            action={<Button onClick={openTransfer} disabled={methods.length < 2} leftIcon={<Plus className="w-4 h-4" />}>Transfer funds</Button>}
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-2 text-left font-semibold">Date</th>
                    <th className="px-4 py-2 text-left font-semibold">From</th>
                    <th className="px-4 py-2 text-left font-semibold"></th>
                    <th className="px-4 py-2 text-left font-semibold">To</th>
                    <th className="px-4 py-2 text-left font-semibold">Description</th>
                    <th className="px-4 py-2 text-right font-semibold">Amount</th>
                    <th className="px-4 py-2 text-left font-semibold">By</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {transfers.map((t, i) => (
                    <tr key={t.id} className={i % 2 ? 'bg-slate-50/40' : 'bg-white'}>
                      <td className="whitespace-nowrap px-4 py-2 text-xs tabular-nums text-gray-500">{formatDate(t.transfer_date)}</td>
                      <td className="px-4 py-2 font-medium text-gray-900">{t.from_payment_method?.name ?? '—'}</td>
                      <td className="px-4 py-2 text-gray-400"><ArrowRightLeft className="h-3.5 w-3.5" /></td>
                      <td className="px-4 py-2 font-medium text-gray-900">{t.to_payment_method?.name ?? '—'}</td>
                      <td className="px-4 py-2 text-xs text-gray-500">{t.description || '—'}</td>
                      <td className="px-4 py-2 text-right font-semibold tabular-nums text-gray-900">{formatCurrency(t.amount)}</td>
                      <td className="px-4 py-2 text-xs text-gray-500">{t.creator?.name ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {lastPage > 1 && (
              <div className="border-t border-gray-100 p-3">
                <Pagination currentPage={page} totalPages={lastPage} onPageChange={setPage} />
              </div>
            )}
          </>
        )}
      </Panel>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Transfer funds" size="md">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Select
              label="From"
              options={methods.map((m) => ({ value: m.id, label: `${m.name} (${formatCurrency(m.balance ?? 0)})` }))}
              value={form.from_payment_method_id}
              onChange={(e) => setForm({ ...form, from_payment_method_id: e.target.value })}
            />
            <Select
              label="To"
              options={methods.filter((m) => String(m.id) !== form.from_payment_method_id).map((m) => ({ value: m.id, label: m.name }))}
              value={form.to_payment_method_id}
              onChange={(e) => setForm({ ...form, to_payment_method_id: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Amount *" type="number" min={0.01} step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
            <Input label="Date" type="date" value={form.transfer_date} onChange={(e) => setForm({ ...form, transfer_date: e.target.value })} />
          </div>
          <Input label="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Optional — e.g. weekly cash deposit" />
          <div className="flex justify-end gap-2 border-t pt-4">
            <Button variant="ghost" onClick={() => setIsModalOpen(false)}>Cancel</Button>
            <Button onClick={handleTransfer} isLoading={isSaving}>Transfer</Button>
          </div>
        </div>
      </Modal>
    </AdminLayout>
  );
}
