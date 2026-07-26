'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { Plus, Pencil, Trash2, RefreshCw, Lock } from 'lucide-react';
import { AdminLayout } from '@/components/layout';
import {
  Card, CardContent, CardHeader, CardTitle,
  Button, Input, Select, Modal, ConfirmModal, Badge,
  LoadingSpinner, EmptyState, ErrorState, InfoButton, StepFlow,
} from '@/components/ui';
import { ChartOfAccount, AccountType, NormalBalance } from '@/types';
import { getErrorMessage } from '@/lib/utils';
import adminService from '@/lib/adminService';
import toast from 'react-hot-toast';

const EMPTY_FORM = {
  code: '',
  name: '',
  type: 'asset' as AccountType,
  normal_balance: 'debit' as NormalBalance,
  description: '',
};

const TYPE_BADGE: Record<AccountType, 'default' | 'success' | 'warning' | 'danger' | 'info'> = {
  asset: 'info',
  liability: 'warning',
  equity: 'default',
  revenue: 'success',
  expense: 'danger',
};

export default function ChartOfAccountsPage() {
  const [accounts, setAccounts] = useState<ChartOfAccount[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);

  const [filterType, setFilterType] = useState('');

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
      const params: Record<string, string> = {};
      if (filterType) params.type = filterType;

      const res = await adminService.getAccounts(params);
      setAccounts(res.data?.data ?? []);
    } catch (err) {
      toast.error(getErrorMessage(err));
      setError(true);
      setAccounts([]);
    } finally {
      setIsLoading(false);
    }
  }, [filterType]);

  useEffect(() => { fetchAccounts(); }, [fetchAccounts]);

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
      <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-gray-900">Chart of Accounts</h1>
              <InfoButton title="How the Chart of Accounts Works">
                <p>
                  The chart of accounts is the master list of every financial &quot;bucket&quot; your business tracks —
                  things like Cash, Sales Revenue, or Operating Expenses. Every transaction recorded anywhere in the
                  system (an order payment, an expense, a purchase order) ultimately moves money in or out of these accounts.
                </p>
                <div>
                  <p className="font-semibold text-gray-900 mb-2">The 5 account types</p>
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
                  <p className="text-xs text-gray-500 mt-2">
                    This &quot;Normal Balance&quot; is set once when the account is created and controls how every report reads that account&apos;s balance.
                  </p>
                </div>
                <div>
                  <p className="font-semibold text-gray-900 mb-2">How to add an account</p>
                  <StepFlow steps={[
                    'Click "Add Account" in the top right.',
                    'Enter a unique code (e.g. 1030) — codes starting 1/2/3/4/5 match Asset/Liability/Equity/Revenue/Expense by convention.',
                    'Enter a name (e.g. "Petty Cash"), choose its Type and Normal Balance.',
                    'Save. Accounts with a lock icon are built-in system accounts and cannot be deleted — only renamed or deactivated.',
                  ]} />
                </div>
              </InfoButton>
            </div>
            <p className="text-sm text-gray-500 mt-1">{accounts.length} account{accounts.length !== 1 ? 's' : ''}</p>
          </div>
          <Button onClick={openCreate} leftIcon={<Plus className="w-4 h-4" />}>
            Add Account
          </Button>
        </div>

        <Card>
          <CardContent className="pt-4">
            <div className="max-w-xs">
              <Select
                label="Filter by type"
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                options={[
                  { value: '', label: 'All types' },
                  { value: 'asset', label: 'Asset' },
                  { value: 'liability', label: 'Liability' },
                  { value: 'equity', label: 'Equity' },
                  { value: 'revenue', label: 'Revenue' },
                  { value: 'expense', label: 'Expense' },
                ]}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Accounts</CardTitle>
            <Button variant="ghost" size="sm" onClick={fetchAccounts} leftIcon={<RefreshCw className="w-4 h-4" />}>
              Refresh
            </Button>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center py-12"><LoadingSpinner /></div>
            ) : error ? (
              <ErrorState message="Failed to load accounts." onRetry={fetchAccounts} />
            ) : accounts.length === 0 ? (
              <EmptyState title="No accounts found" description="Add an account to get started." />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 text-left">
                      <th className="pb-3 pr-4 font-semibold text-gray-600">Code</th>
                      <th className="pb-3 pr-4 font-semibold text-gray-600">Name</th>
                      <th className="pb-3 pr-4 font-semibold text-gray-600">Type</th>
                      <th className="pb-3 pr-4 font-semibold text-gray-600">Normal Balance</th>
                      <th className="pb-3 pr-4 font-semibold text-gray-600">Active</th>
                      <th className="pb-3 font-semibold text-gray-600 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {accounts.map((account) => (
                      <tr key={account.id} className="hover:bg-gray-50">
                        <td className="py-3 pr-4 font-mono text-gray-900">{account.code}</td>
                        <td className="py-3 pr-4">
                          <div className="flex items-center gap-1.5">
                            {account.is_system && <Lock className="w-3.5 h-3.5 text-gray-400" />}
                            <span className="font-medium text-gray-900">{account.name}</span>
                          </div>
                          {account.description && (
                            <p className="text-xs text-gray-500 truncate max-w-[260px]">{account.description}</p>
                          )}
                        </td>
                        <td className="py-3 pr-4">
                          <Badge variant={TYPE_BADGE[account.type]}>{account.type}</Badge>
                        </td>
                        <td className="py-3 pr-4 text-gray-600 capitalize">{account.normal_balance}</td>
                        <td className="py-3 pr-4">
                          <Badge variant={account.is_active ? 'success' : 'default'}>
                            {account.is_active ? 'Active' : 'Inactive'}
                          </Badge>
                        </td>
                        <td className="py-3 text-right">
                          <div className="flex justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openEdit(account)}
                              leftIcon={<Pencil className="w-3.5 h-3.5" />}
                            >
                              Edit
                            </Button>
                            {!account.is_system && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => openDelete(account)}
                                className="text-red-500 hover:text-red-700 hover:bg-red-50"
                                leftIcon={<Trash2 className="w-3.5 h-3.5" />}
                              >
                                Delete
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Modal
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        title={selectedAccount ? 'Edit Account' : 'Add Account'}
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
                options={[
                  { value: 'asset', label: 'Asset' },
                  { value: 'liability', label: 'Liability' },
                  { value: 'equity', label: 'Equity' },
                  { value: 'revenue', label: 'Revenue' },
                  { value: 'expense', label: 'Expense' },
                ]}
              />
              <Select
                label="Normal Balance"
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
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
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
            <Button onClick={handleSave} isLoading={isSaving}>
              {selectedAccount ? 'Update' : 'Save'}
            </Button>
          </div>
        </div>
      </Modal>

      <ConfirmModal
        isOpen={isDeleteOpen}
        onClose={() => setIsDeleteOpen(false)}
        onConfirm={handleDelete}
        title="Delete Account"
        message={`Delete "${selectedAccount?.name}"? This cannot be undone.`}
        confirmLabel="Delete"
        variant="danger"
        isLoading={isDeleting}
      />
    </AdminLayout>
  );
}
