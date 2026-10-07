'use client';

import { useEffect, useMemo, useState, useCallback } from 'react';
import toast from 'react-hot-toast';
import { Plus, Pencil, Trash2, RefreshCw, Lock, Search, Landmark, Wallet, Scale, TrendingUp, Receipt } from 'lucide-react';
import { AdminLayout } from '@/components/layout';
import {
  Button, Input, Select, Modal, ConfirmModal, Badge,
  LoadingSpinner, EmptyState, ErrorState, InfoButton, StepFlow,
} from '@/components/ui';
import { KpiTile } from '@/components/reports/shared';
import { ChartOfAccount, AccountType, NormalBalance } from '@/types';
import { formatCurrency, getErrorMessage } from '@/lib/utils';
import adminService from '@/lib/adminService';

type TypeFilter = '' | AccountType;
type StatusFilter = '' | 'active' | 'inactive';

const EMPTY_FORM = {
  code: '',
  name: '',
  type: 'asset' as AccountType,
  normal_balance: 'debit' as NormalBalance,
  description: '',
};

const TYPES: { value: AccountType; label: string; plural: string; tone: string; tile: 'sky' | 'amber' | 'indigo' | 'emerald' | 'rose'; icon: typeof Landmark }[] = [
  { value: 'asset', label: 'Asset', plural: 'Assets', tone: 'border-sky-200 bg-sky-50 text-sky-700', tile: 'sky', icon: Landmark },
  { value: 'liability', label: 'Liability', plural: 'Liabilities', tone: 'border-amber-200 bg-amber-50 text-amber-700', tile: 'amber', icon: Scale },
  { value: 'equity', label: 'Equity', plural: 'Equity', tone: 'border-indigo-200 bg-indigo-50 text-indigo-700', tile: 'indigo', icon: Wallet },
  { value: 'revenue', label: 'Revenue', plural: 'Revenue', tone: 'border-emerald-200 bg-emerald-50 text-emerald-700', tile: 'emerald', icon: TrendingUp },
  { value: 'expense', label: 'Expense', plural: 'Expenses', tone: 'border-rose-200 bg-rose-50 text-rose-700', tile: 'rose', icon: Receipt },
];

const TYPE_META = Object.fromEntries(TYPES.map((t) => [t.value, t])) as Record<AccountType, (typeof TYPES)[number]>;

export default function ChartOfAccountsPage() {
  const [accounts, setAccounts] = useState<ChartOfAccount[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('');
  const [systemOnly, setSystemOnly] = useState(false);

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<ChartOfAccount | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchAccounts = useCallback(async () => {
    setIsLoading(true);
    setError(false);
    try {
      const res = await adminService.getAccounts({});
      setAccounts((res.data?.data ?? []) as ChartOfAccount[]);
    } catch (err) {
      toast.error(getErrorMessage(err));
      setError(true);
      setAccounts([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { fetchAccounts(); }, [fetchAccounts]);

  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchInput.trim().toLowerCase()), 250);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const visible = useMemo(
    () =>
      accounts.filter(
        (a) =>
          (!typeFilter || a.type === typeFilter) &&
          (!statusFilter || (statusFilter === 'active' ? a.is_active : !a.is_active)) &&
          (!systemOnly || a.is_system) &&
          (!search ||
            a.code.toLowerCase().includes(search) ||
            a.name.toLowerCase().includes(search) ||
            (a.description ?? '').toLowerCase().includes(search))
      ),
    [accounts, typeFilter, statusFilter, systemOnly, search]
  );

  const typeTotals = useMemo(() => {
    const totals = {} as Record<AccountType, { count: number; balance: number }>;
    TYPES.forEach((t) => { totals[t.value] = { count: 0, balance: 0 }; });
    accounts.forEach((a) => {
      totals[a.type].count += 1;
      totals[a.type].balance += Number(a.balance ?? 0);
    });
    return totals;
  }, [accounts]);

  const filtered = !!search || !!typeFilter || !!statusFilter || systemOnly;

  const openCreate = () => {
    setSelectedAccount(null);
    setForm(EMPTY_FORM);
    setFormErrors({});
    setIsFormOpen(true);
  };

  const openEdit = (account: ChartOfAccount) => {
    setSelectedAccount(account);
    setForm({
      code: account.code,
      name: account.name,
      type: account.type,
      normal_balance: account.normal_balance,
      description: account.description || '',
    });
    setFormErrors({});
    setIsFormOpen(true);
  };

  const openDelete = (account: ChartOfAccount) => {
    setSelectedAccount(account);
    setIsDeleteOpen(true);
  };

  const validateForm = () => {
    const errors: Record<string, string> = {};
    if (!selectedAccount && !form.code.trim()) errors.code = 'Code is required';
    if (!form.name.trim()) errors.name = 'Name is required';
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSave = async () => {
    if (!validateForm()) return;
    setIsSaving(true);
    try {
      if (selectedAccount) {
        await adminService.updateAccount(selectedAccount.id, {
          name: form.name.trim(),
          description: form.description.trim() || null,
        });
        toast.success('Account updated.');
      } else {
        await adminService.createAccount({
          code: form.code.trim(),
          name: form.name.trim(),
          type: form.type,
          normal_balance: form.normal_balance,
          description: form.description.trim() || null,
        });
        toast.success('Account created.');
      }
      setIsFormOpen(false);
      fetchAccounts();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedAccount) return;
    setIsDeleting(true);
    try {
      await adminService.deleteAccount(selectedAccount.id);
      toast.success('Account deleted.');
      setIsDeleteOpen(false);
      fetchAccounts();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <AdminLayout>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2.5">
          <h1 className="text-lg font-bold text-gray-900">Chart of accounts</h1>
          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-semibold text-gray-600">
            {accounts.length} account{accounts.length === 1 ? '' : 's'}
          </span>
          <InfoButton title="How the Chart of Accounts Works">
            <p>
              The chart of accounts is the master list of every financial &quot;bucket&quot; your business tracks —
              things like Cash, Sales Revenue, or Operating Expenses. Every transaction recorded anywhere in the
              system (an order payment, an expense, a purchase order) ultimately moves money in or out of these accounts.
            </p>
            <div>
              <p className="mb-2 font-semibold text-gray-900">The 5 account types</p>
              <div className="overflow-hidden rounded-lg border border-gray-200">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr className="text-left">
                      <th className="px-3 py-2 font-semibold text-gray-600">Type</th>
                      <th className="px-3 py-2 font-semibold text-gray-600">Example</th>
                      <th className="px-3 py-2 font-semibold text-gray-600">Increases with</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    <tr><td className="px-3 py-2">Asset</td><td className="px-3 py-2 text-gray-500">Cash, Inventory</td><td className="px-3 py-2"><Badge variant="info">Debit</Badge></td></tr>
                    <tr><td className="px-3 py-2">Liability</td><td className="px-3 py-2 text-gray-500">Accounts Payable</td><td className="px-3 py-2"><Badge variant="warning">Credit</Badge></td></tr>
                    <tr><td className="px-3 py-2">Equity</td><td className="px-3 py-2 text-gray-500">Retained Earnings</td><td className="px-3 py-2"><Badge variant="warning">Credit</Badge></td></tr>
                    <tr><td className="px-3 py-2">Revenue</td><td className="px-3 py-2 text-gray-500">Sales Revenue</td><td className="px-3 py-2"><Badge variant="warning">Credit</Badge></td></tr>
                    <tr><td className="px-3 py-2">Expense</td><td className="px-3 py-2 text-gray-500">Operating Expenses</td><td className="px-3 py-2"><Badge variant="info">Debit</Badge></td></tr>
                  </tbody>
                </table>
              </div>
              <p className="mt-2 text-xs text-gray-500">
                This &quot;Normal Balance&quot; is set once when the account is created and controls how every report reads that account&apos;s balance.
              </p>
            </div>
            <div>
              <p className="mb-2 font-semibold text-gray-900">How to add an account</p>
              <StepFlow steps={[
                'Click "Add account" in the top right.',
                'Enter a unique code (e.g. 1030) — codes starting 1/2/3/4/5 match Asset/Liability/Equity/Revenue/Expense by convention.',
                'Enter a name (e.g. "Petty Cash"), choose its Type and Normal Balance.',
                'Save. Accounts with a lock icon are built-in system accounts and cannot be deleted — only renamed or deactivated.',
              ]} />
            </div>
          </InfoButton>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="ghost" onClick={fetchAccounts} leftIcon={<RefreshCw className="h-3.5 w-3.5" />}>Refresh</Button>
          <Button size="sm" onClick={openCreate} leftIcon={<Plus className="h-3.5 w-3.5" />}>Add account</Button>
        </div>
      </div>

      <div className="mb-3 grid grid-cols-2 gap-2 lg:grid-cols-5">
        {TYPES.map((t) => (
          <KpiTile
            key={t.value}
            label={t.plural}
            value={formatCurrency(typeTotals[t.value].balance)}
            tone={t.tile}
            icon={<t.icon className="h-4 w-4 opacity-60" />}
            sub={`${typeTotals[t.value].count} account${typeTotals[t.value].count === 1 ? '' : 's'} · balance today`}
          />
        ))}
      </div>

      <div className="mb-3 space-y-2 rounded-xl border border-gray-200 bg-white p-2.5">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[220px] flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
            <input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search code, name or description…"
              className="h-8 w-full rounded-lg border border-gray-300 pl-8 pr-3 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div className="flex gap-1.5">
            <button
              type="button"
              onClick={() => setStatusFilter(statusFilter === 'active' ? '' : 'active')}
              className={`rounded-full border px-2.5 py-1 text-xs font-semibold transition-colors ${
                statusFilter === 'active' ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
              }`}
            >
              Active only
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter(statusFilter === 'inactive' ? '' : 'inactive')}
              className={`rounded-full border px-2.5 py-1 text-xs font-semibold transition-colors ${
                statusFilter === 'inactive' ? 'border-slate-700 bg-slate-700 text-white' : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
              }`}
            >
              Inactive only
            </button>
            <button
              type="button"
              onClick={() => setSystemOnly((v) => !v)}
              className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold transition-colors ${
                systemOnly ? 'border-slate-700 bg-slate-700 text-white' : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
              }`}
            >
              <Lock className="h-3 w-3" />
              System only
            </button>
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => setTypeFilter('')}
            className={`rounded-full border px-2.5 py-1 text-xs font-semibold transition-colors ${
              typeFilter === '' ? 'border-indigo-600 bg-indigo-600 text-white' : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
            }`}
          >
            All types
          </button>
          {TYPES.map((t) => (
            <button
              key={t.value}
              type="button"
              onClick={() => setTypeFilter(typeFilter === t.value ? '' : t.value)}
              className={`rounded-full border px-2.5 py-1 text-xs font-semibold transition-colors ${
                typeFilter === t.value ? 'border-indigo-600 bg-indigo-600 text-white' : t.tone
              }`}
            >
              {t.label}
            </button>
          ))}
          {filtered && (
            <button
              type="button"
              onClick={() => { setSearchInput(''); setTypeFilter(''); setStatusFilter(''); setSystemOnly(false); }}
              className="rounded-full px-2.5 py-1 text-xs font-semibold text-gray-500 hover:text-gray-800"
            >
              Clear filters
            </button>
          )}
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        {isLoading ? (
          <div className="flex justify-center py-10"><LoadingSpinner /></div>
        ) : error ? (
          <ErrorState message="Failed to load accounts." onRetry={fetchAccounts} />
        ) : accounts.length === 0 ? (
          <EmptyState title="No accounts found" description="Add an account to get started." />
        ) : visible.length === 0 ? (
          <EmptyState title="No accounts match these filters" description="Clear a filter to see more accounts." />
        ) : (
          <div className="max-h-[calc(100vh-24rem)] overflow-auto">
            <table className="min-w-full text-sm">
              <thead className="sticky top-0 z-10 bg-slate-50 text-xs uppercase tracking-wide text-slate-500 shadow-[0_1px_0_0_rgb(226,232,240)]">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold">Code</th>
                  <th className="px-3 py-2 text-left font-semibold">Account</th>
                  <th className="px-3 py-2 text-left font-semibold">Type</th>
                  <th className="px-3 py-2 text-left font-semibold">Normal balance</th>
                  <th className="px-3 py-2 text-right font-semibold">Balance today</th>
                  <th className="px-3 py-2 text-left font-semibold">Status</th>
                  <th className="px-3 py-2 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {visible.map((account, i) => {
                  const meta = TYPE_META[account.type];
                  const balance = Number(account.balance ?? 0);
                  return (
                    <tr key={account.id} className={`${i % 2 ? 'bg-slate-50/50' : 'bg-white'} hover:bg-indigo-50/40`}>
                      <td className="px-3 py-2 font-mono text-xs font-semibold text-gray-900">{account.code}</td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-1.5">
                          {account.is_system && <Lock className="h-3 w-3 shrink-0 text-gray-400" aria-label="System account" />}
                          <span className="font-semibold text-gray-900">{account.name}</span>
                        </div>
                        {account.description && <p className="max-w-md truncate text-[11px] text-gray-500">{account.description}</p>}
                      </td>
                      <td className="px-3 py-2">
                        <span className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold capitalize ${meta.tone}`}>{account.type}</span>
                      </td>
                      <td className="px-3 py-2 text-xs capitalize text-gray-600">{account.normal_balance}</td>
                      <td className={`whitespace-nowrap px-3 py-2 text-right font-semibold tabular-nums ${balance < 0 ? 'text-rose-600' : 'text-gray-900'}`}>
                        {formatCurrency(balance)}
                      </td>
                      <td className="px-3 py-2">
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                          account.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-600'
                        }`}>
                          {account.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex items-center justify-end gap-0.5">
                          <button type="button" title="Edit" onClick={() => openEdit(account)} className="rounded-md p-1 text-sky-600 hover:bg-sky-50">
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          {!account.is_system && (
                            <button type="button" title="Delete" onClick={() => openDelete(account)} className="rounded-md p-1 text-rose-500 hover:bg-rose-50">
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {accounts.length > 0 && (
        <p className="mt-2 text-xs text-gray-500">
          Showing <span className="font-semibold text-gray-700">{visible.length}</span> of{' '}
          <span className="font-semibold text-gray-700">{accounts.length}</span>{' '}accounts. Balances are as of today, in each account&apos;s normal direction.
        </p>
      )}

      <Modal
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        title={selectedAccount ? 'Edit account' : 'Add account'}
        size="md"
      >
        <div className="space-y-4">
          {!selectedAccount && (
            <Input
              label="Code *"
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value })}
              error={formErrors.code}
              placeholder="e.g. 1030"
            />
          )}
          <Input
            label="Name *"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            error={formErrors.name}
            placeholder="e.g. Petty Cash"
          />
          {!selectedAccount && (
            <div className="grid grid-cols-2 gap-3">
              <Select
                label="Type"
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value as AccountType })}
                options={TYPES.map((t) => ({ value: t.value, label: t.label }))}
              />
              <Select
                label="Normal balance"
                value={form.normal_balance}
                onChange={(e) => setForm({ ...form, normal_balance: e.target.value as NormalBalance })}
                options={[
                  { value: 'debit', label: 'Debit' },
                  { value: 'credit', label: 'Credit' },
                ]}
              />
            </div>
          )}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Description</label>
            <textarea
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              rows={2}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Optional"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => setIsFormOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} isLoading={isSaving}>{selectedAccount ? 'Update' : 'Save'}</Button>
          </div>
        </div>
      </Modal>

      <ConfirmModal
        isOpen={isDeleteOpen}
        onClose={() => setIsDeleteOpen(false)}
        onConfirm={handleDelete}
        title="Delete account"
        message={`Delete "${selectedAccount?.name}"? This cannot be undone.`}
        confirmLabel="Delete"
        variant="danger"
        isLoading={isDeleting}
      />
    </AdminLayout>
  );
}
