'use client';

import React, { useEffect, useState } from 'react';
import {
  CreditCard, Plus, Pencil, Trash2, Lock, Landmark, Wallet, Smartphone, HelpCircle, ExternalLink,
} from 'lucide-react';
import {
  Card, CardContent, CardHeader, CardTitle, Button, Input, Select, Modal, ConfirmModal,
  Badge, LoadingSpinner,
} from '@/components/ui';
import { PaymentMethod, PaymentMethodType } from '@/types';
import { formatCurrency, getErrorMessage } from '@/lib/utils';
import adminService from '@/lib/adminService';
import toast from 'react-hot-toast';

const TYPE_OPTIONS: { value: PaymentMethodType; label: string }[] = [
  { value: 'cash', label: 'Cash' },
  { value: 'bank', label: 'Bank' },
  { value: 'mobile_banking', label: 'Mobile banking' },
  { value: 'card', label: 'Card' },
  { value: 'other', label: 'Other' },
];

const TYPE_ICON: Record<PaymentMethodType, typeof Landmark> = {
  cash: Wallet,
  bank: Landmark,
  mobile_banking: Smartphone,
  card: CreditCard,
  other: HelpCircle,
};

const EMPTY_FORM = {
  name: '', type: 'bank' as PaymentMethodType, account_holder_name: '', account_number: '',
  bank_name: '', branch_name: '', notes: '', is_active: true,
};

/** Keep most of an account number hidden — only the method's own edit form shows it in full. */
function maskAccountNumber(value: string): string {
  if (value.length <= 4) return value;
  return '•'.repeat(Math.max(0, value.length - 4)) + value.slice(-4);
}

/**
 * Settings-side of payment methods: name it, record its bank/account details, activate or
 * deactivate it. Moving money between methods and that history live in Accounts > Transfers
 * instead (/accounts/transfers) — this page is about what the method *is*, not day-to-day
 * cash movement, same split Settings already draws elsewhere (SMS connections live here;
 * sending/viewing actual messages happens on the SMS Center page).
 */
export default function PaymentMethodsManager() {
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editing, setEditing] = useState<PaymentMethod | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [isSaving, setIsSaving] = useState(false);

  const [deleting, setDeleting] = useState<PaymentMethod | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchMethods = async () => {
    setIsLoading(true);
    try {
      const res = await adminService.getPaymentMethods();
      setMethods(res.data.data);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchMethods(); }, []);

  const openCreate = () => { setEditing(null); setForm(EMPTY_FORM); setIsModalOpen(true); };
  const openEdit = (m: PaymentMethod) => {
    setEditing(m);
    setForm({
      name: m.name, type: m.type,
      account_holder_name: m.account_holder_name || '', account_number: m.account_number || '',
      bank_name: m.bank_name || '', branch_name: m.branch_name || '',
      notes: m.notes || '', is_active: m.is_active,
    });
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error('Name is required'); return; }
    setIsSaving(true);
    try {
      if (editing) {
        await adminService.updatePaymentMethod(editing.id, form);
        toast.success('Payment method updated');
      } else {
        await adminService.createPaymentMethod(form);
        toast.success('Payment method created — a matching ledger account was set up automatically');
      }
      setIsModalOpen(false);
      fetchMethods();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleting) return;
    setIsDeleting(true);
    try {
      await adminService.deletePaymentMethod(deleting.id);
      toast.success('Payment method deleted');
      setDeleting(null);
      fetchMethods();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setIsDeleting(false);
    }
  };

  const totalBalance = methods.reduce((sum, m) => sum + (m.balance ?? 0), 0);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2"><CreditCard className="w-5 h-5" />Payment Methods</CardTitle>
            <p className="text-sm text-gray-500 mt-1">
              Cash, bank accounts, mobile banking — each gets its own ledger account automatically,
              so orders paid through it track separately in Accounts. Total across all methods:{' '}
              <span className="font-semibold text-gray-700">{formatCurrency(totalBalance)}</span>.
              Moving money between them happens on{' '}
              <a href="/accounts/transfers" className="inline-flex items-center gap-0.5 text-primary-600 hover:underline">
                Accounts &gt; Transfers <ExternalLink className="h-3 w-3" />
              </a>.
            </p>
          </div>
          <Button onClick={openCreate} leftIcon={<Plus className="w-4 h-4" />}>Add payment method</Button>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex justify-center py-10"><LoadingSpinner /></div>
          ) : methods.length === 0 ? (
            <div className="text-center py-12">
              <CreditCard className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">No payment methods yet.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-2 text-left font-semibold">Method</th>
                    <th className="px-4 py-2 text-left font-semibold">Account details</th>
                    <th className="px-4 py-2 text-left font-semibold">Ledger account</th>
                    <th className="px-4 py-2 text-right font-semibold">Balance</th>
                    <th className="px-4 py-2 text-left font-semibold">Status</th>
                    <th className="px-4 py-2 text-right font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {methods.map((m, i) => {
                    const Icon = TYPE_ICON[m.type];
                    return (
                      <tr key={m.id} className={`${i % 2 ? 'bg-slate-50/40' : 'bg-white'} hover:bg-indigo-50/40`}>
                        <td className="px-4 py-2">
                          <div className="flex items-center gap-2">
                            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600"><Icon className="h-3.5 w-3.5" /></span>
                            <div>
                              <div className="flex items-center gap-1.5">
                                <span className="font-semibold text-gray-900">{m.name}</span>
                                {m.is_system && (
                                  <span title="Built in — can't be deleted"><Lock className="h-3 w-3 text-gray-400" /></span>
                                )}
                              </div>
                              <p className="text-[11px] capitalize text-gray-500">{m.type.replace('_', ' ')}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-2 text-xs text-gray-600">
                          {m.bank_name && <p className="font-medium text-gray-700">{m.bank_name}{m.branch_name ? ` · ${m.branch_name}` : ''}</p>}
                          {m.account_number && <p className="font-mono">{maskAccountNumber(m.account_number)}</p>}
                          {m.account_holder_name && <p className="text-gray-500">{m.account_holder_name}</p>}
                          {!m.bank_name && !m.account_number && !m.account_holder_name && <span className="text-gray-400">—</span>}
                        </td>
                        <td className="px-4 py-2 text-xs">
                          {m.chart_of_account ? (
                            <a href={`/accounts/ledger?account=${m.chart_of_account.id}`} className="inline-flex items-center gap-1 font-mono text-indigo-700 hover:underline">
                              {m.chart_of_account.code} <ExternalLink className="h-3 w-3" />
                            </a>
                          ) : '—'}
                        </td>
                        <td className="px-4 py-2 text-right font-semibold tabular-nums text-gray-900">{formatCurrency(m.balance ?? 0)}</td>
                        <td className="px-4 py-2">
                          <Badge variant={m.is_active ? 'success' : 'default'} className="text-[11px]">{m.is_active ? 'Active' : 'Inactive'}</Badge>
                        </td>
                        <td className="px-4 py-2 text-right">
                          <div className="flex justify-end gap-0.5">
                            <Button variant="ghost" size="sm" title="Edit" onClick={() => openEdit(m)}><Pencil className="h-3.5 w-3.5" /></Button>
                            <Button
                              variant="ghost" size="sm"
                              title={m.is_system ? 'Built-in — deactivate instead of deleting' : 'Delete'}
                              onClick={() => setDeleting(m)}
                              disabled={m.is_system}
                              className="text-red-500 hover:bg-red-50 hover:text-red-700"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add/Edit Modal */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editing ? `Edit — ${editing.name}` : 'Add payment method'} size="md">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Input label="Name *" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. City Bank - Current A/C" />
            <Select label="Type" options={TYPE_OPTIONS} value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as PaymentMethodType })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Account holder name" value={form.account_holder_name} onChange={(e) => setForm({ ...form, account_holder_name: e.target.value })} />
            <Input label="Account number" value={form.account_number} onChange={(e) => setForm({ ...form, account_number: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Bank name" value={form.bank_name} onChange={(e) => setForm({ ...form, bank_name: e.target.value })} />
            <Input label="Branch" value={form.branch_name} onChange={(e) => setForm({ ...form, branch_name: e.target.value })} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700">Notes</label>
            <textarea
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} className="rounded border-gray-300 text-primary-600 focus:ring-primary-500" />
            Active — available to pick when recording a payment
          </label>
          {!editing && (
            <p className="text-[11px] text-gray-500">A matching ledger account is created automatically — nothing else to set up in Accounts.</p>
          )}
          <div className="flex justify-end gap-2 pt-2 border-t">
            <Button variant="ghost" onClick={() => setIsModalOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} isLoading={isSaving}>{editing ? 'Save' : 'Create'}</Button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirm */}
      <ConfirmModal
        isOpen={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={handleDelete}
        title="Delete payment method"
        message={`Delete "${deleting?.name}"? This only works if its ledger account has no activity yet.`}
        confirmLabel="Delete"
        variant="danger"
        isLoading={isDeleting}
      />
    </div>
  );
}
