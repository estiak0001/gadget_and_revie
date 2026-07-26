'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { Plus, Pencil, Trash2, RefreshCw, ArrowDownCircle, TrendingUp } from 'lucide-react';
import { AdminLayout } from '@/components/layout';
import {
  Card, CardContent, CardHeader, CardTitle,
  Button, Input, Select, Modal, ConfirmModal, Badge,
  LoadingSpinner, EmptyState, ErrorState,
} from '@/components/ui';
import { Investor } from '@/types';
import { formatCurrency, formatDate, getErrorMessage } from '@/lib/utils';
import adminService from '@/lib/adminService';
import toast from 'react-hot-toast';

const EMPTY_EDIT_FORM = { name: '', phone: '', email: '', address: '', notes: '', is_active: true };
const today = new Date().toISOString().split('T')[0];

export default function InvestorsPage() {
  const [investors, setInvestors] = useState<Investor[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);

  // Edit / delete investor
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [selectedInvestor, setSelectedInvestor] = useState<Investor | null>(null);
  const [editForm, setEditForm] = useState(EMPTY_EDIT_FORM);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Add Investment modal
  const [isInvestOpen, setIsInvestOpen] = useState(false);
  const [investorMode, setInvestorMode] = useState<'existing' | 'new'>('existing');
  const [investForm, setInvestForm] = useState({
    investor_id: '',
    investor_name: '',
    investor_phone: '',
    investor_email: '',
    amount: '',
    investment_date: today,
    description: '',
  });
  const [isSavingInvestment, setIsSavingInvestment] = useState(false);

  // Return to Investor modal
  const [isReturnOpen, setIsReturnOpen] = useState(false);
  const [returnForm, setReturnForm] = useState({ amount: '', investment_date: today, description: '' });
  const [isProcessingReturn, setIsProcessingReturn] = useState(false);

  const fetchInvestors = useCallback(async () => {
    setIsLoading(true);
    setError(false);
    try {
      const res = await adminService.getInvestors();
      setInvestors(Array.isArray(res.data?.data) ? res.data.data : []);
    } catch (err) {
      toast.error(getErrorMessage(err));
      setError(true);
      setInvestors([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { fetchInvestors(); }, [fetchInvestors]);

  const totalCapital = investors.reduce((sum, i) => sum + (i.balance ?? 0), 0);

  // ── Add Investment ──────────────────────────────────────────────────────

  const openInvest = () => {
    setInvestorMode(investors.length > 0 ? 'existing' : 'new');
    setInvestForm({
      investor_id: investors[0] ? String(investors[0].id) : '',
      investor_name: '', investor_phone: '', investor_email: '',
      amount: '', investment_date: today, description: '',
    });
    setIsInvestOpen(true);
  };

  const handleSaveInvestment = async () => {
    const amount = parseFloat(investForm.amount);
    if (!amount || amount <= 0) {
      toast.error('Enter a valid amount');
      return;
    }
    if (investorMode === 'existing' && !investForm.investor_id) {
      toast.error('Select an investor');
      return;
    }
    if (investorMode === 'new' && !investForm.investor_name.trim()) {
      toast.error('Enter the investor\'s name');
      return;
    }

    setIsSavingInvestment(true);
    try {
      const payload: Record<string, unknown> = {
        amount,
        investment_date: investForm.investment_date,
        description: investForm.description.trim() || undefined,
      };
      if (investorMode === 'existing') {
        payload.investor_id = Number(investForm.investor_id);
      } else {
        payload.investor_name = investForm.investor_name.trim();
        payload.investor_phone = investForm.investor_phone.trim() || undefined;
        payload.investor_email = investForm.investor_email.trim() || undefined;
      }

      await adminService.createInvestment(payload);
      toast.success('Investment recorded and posted to the ledger.');
      setIsInvestOpen(false);
      fetchInvestors();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setIsSavingInvestment(false);
    }
  };

  // ── Return to Investor ──────────────────────────────────────────────────

  const openReturn = (investor: Investor) => {
    setSelectedInvestor(investor);
    setReturnForm({ amount: investor.balance ? String(investor.balance) : '', investment_date: today, description: '' });
    setIsReturnOpen(true);
  };

  const handleProcessReturn = async () => {
    if (!selectedInvestor) return;
    const amount = parseFloat(returnForm.amount);
    if (!amount || amount <= 0) {
      toast.error('Enter a valid amount');
      return;
    }
    if (amount > (selectedInvestor.balance ?? 0)) {
      toast.error(`Cannot return more than their current balance of ${formatCurrency(selectedInvestor.balance ?? 0)}`);
      return;
    }

    setIsProcessingReturn(true);
    try {
      await adminService.returnInvestment(selectedInvestor.id, {
        amount,
        investment_date: returnForm.investment_date,
        description: returnForm.description.trim() || undefined,
      });
      toast.success('Return processed and posted to the ledger.');
      setIsReturnOpen(false);
      fetchInvestors();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setIsProcessingReturn(false);
    }
  };

  // ── Edit / Delete Investor ──────────────────────────────────────────────

  const openEdit = (investor: Investor) => {
    setSelectedInvestor(investor);
    setEditForm({
      name: investor.name,
      phone: investor.phone || '',
      email: investor.email || '',
      address: investor.address || '',
      notes: investor.notes || '',
      is_active: investor.is_active,
    });
    setIsEditOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!selectedInvestor) return;
    if (!editForm.name.trim()) {
      toast.error('Name is required');
      return;
    }
    setIsSaving(true);
    try {
      await adminService.updateInvestor(selectedInvestor.id, {
        name: editForm.name.trim(),
        phone: editForm.phone.trim() || null,
        email: editForm.email.trim() || null,
        address: editForm.address.trim() || null,
        notes: editForm.notes.trim() || null,
        is_active: editForm.is_active,
      });
      toast.success('Investor updated.');
      setIsEditOpen(false);
      fetchInvestors();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setIsSaving(false);
    }
  };

  const openDelete = (investor: Investor) => {
    setSelectedInvestor(investor);
    setIsDeleteOpen(true);
  };

  const handleDelete = async () => {
    if (!selectedInvestor) return;
    setIsDeleting(true);
    try {
      await adminService.deleteInvestor(selectedInvestor.id);
      toast.success('Investor deleted.');
      setIsDeleteOpen(false);
      fetchInvestors();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Investors</h1>
            <p className="text-sm text-gray-500 mt-1">
              Capital contributions from investors — posts to the ledger as Cash vs Investor Capital
            </p>
          </div>
          <Button onClick={openInvest} leftIcon={<Plus className="w-4 h-4" />}>
            Add Investment
          </Button>
        </div>

        {/* Summary */}
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100">
                <TrendingUp className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide">Total Investor Capital Outstanding</p>
                <p className="text-xl font-bold text-gray-900">{formatCurrency(totalCapital)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Table */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Investors</CardTitle>
            <Button variant="ghost" size="sm" onClick={fetchInvestors} leftIcon={<RefreshCw className="w-4 h-4" />}>
              Refresh
            </Button>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center py-12"><LoadingSpinner /></div>
            ) : error ? (
              <ErrorState message="Failed to load investors." onRetry={fetchInvestors} />
            ) : investors.length === 0 ? (
              <EmptyState
                title="No investors yet"
                description="Add your first investment to start tracking investor capital."
                action={<Button onClick={openInvest} leftIcon={<Plus className="w-4 h-4" />}>Add Investment</Button>}
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 text-left">
                      <th className="pb-3 pr-4 font-semibold text-gray-600">Investor</th>
                      <th className="pb-3 pr-4 font-semibold text-gray-600">Phone</th>
                      <th className="pb-3 pr-4 font-semibold text-gray-600">Email</th>
                      <th className="pb-3 pr-4 font-semibold text-gray-600 text-right">Balance</th>
                      <th className="pb-3 pr-4 font-semibold text-gray-600">Status</th>
                      <th className="pb-3 font-semibold text-gray-600 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {investors.map((investor) => (
                      <tr key={investor.id} className="hover:bg-gray-50">
                        <td className="py-3 pr-4">
                          <p className="font-medium text-gray-900">{investor.name}</p>
                          {investor.notes && (
                            <p className="text-xs text-gray-500 truncate max-w-[220px]">{investor.notes}</p>
                          )}
                        </td>
                        <td className="py-3 pr-4 text-gray-600">{investor.phone || '—'}</td>
                        <td className="py-3 pr-4 text-gray-600">{investor.email || '—'}</td>
                        <td className="py-3 pr-4 text-right font-semibold text-gray-900">
                          {formatCurrency(investor.balance ?? 0)}
                        </td>
                        <td className="py-3 pr-4">
                          <Badge variant={investor.is_active ? 'success' : 'default'}>
                            {investor.is_active ? 'Active' : 'Inactive'}
                          </Badge>
                        </td>
                        <td className="py-3 text-right">
                          <div className="flex justify-end gap-1">
                            {(investor.balance ?? 0) > 0 && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => openReturn(investor)}
                                className="text-amber-600 hover:text-amber-700 hover:bg-amber-50"
                                leftIcon={<ArrowDownCircle className="w-3.5 h-3.5" />}
                              >
                                Return
                              </Button>
                            )}
                            <Button variant="ghost" size="sm" onClick={() => openEdit(investor)} leftIcon={<Pencil className="w-3.5 h-3.5" />}>
                              Edit
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openDelete(investor)}
                              className="text-red-500 hover:text-red-700 hover:bg-red-50"
                              leftIcon={<Trash2 className="w-3.5 h-3.5" />}
                            >
                              Delete
                            </Button>
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

      {/* Add Investment Modal */}
      <Modal isOpen={isInvestOpen} onClose={() => setIsInvestOpen(false)} title="Add Investment" size="md">
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Records a capital contribution and automatically posts Dr Cash / Cr Investor Capital to the ledger.
          </p>

          {investors.length > 0 && (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setInvestorMode('existing')}
                className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium ${investorMode === 'existing' ? 'border-primary-500 bg-primary-50 text-primary-700' : 'border-gray-300 text-gray-600'}`}
              >
                Existing Investor
              </button>
              <button
                type="button"
                onClick={() => setInvestorMode('new')}
                className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium ${investorMode === 'new' ? 'border-primary-500 bg-primary-50 text-primary-700' : 'border-gray-300 text-gray-600'}`}
              >
                New Investor
              </button>
            </div>
          )}

          {investorMode === 'existing' && investors.length > 0 ? (
            <Select
              label="Investor *"
              value={investForm.investor_id}
              onChange={(e) => setInvestForm({ ...investForm, investor_id: e.target.value })}
              options={investors.map((i) => ({ value: String(i.id), label: i.name }))}
            />
          ) : (
            <>
              <Input
                label="Investor Name *"
                value={investForm.investor_name}
                onChange={(e) => setInvestForm({ ...investForm, investor_name: e.target.value })}
                placeholder="Full name"
              />
              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="Phone"
                  value={investForm.investor_phone}
                  onChange={(e) => setInvestForm({ ...investForm, investor_phone: e.target.value })}
                  placeholder="Optional"
                />
                <Input
                  label="Email"
                  type="email"
                  value={investForm.investor_email}
                  onChange={(e) => setInvestForm({ ...investForm, investor_email: e.target.value })}
                  placeholder="Optional"
                />
              </div>
            </>
          )}

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Amount (৳) *"
              type="number"
              min={0.01}
              step="0.01"
              value={investForm.amount}
              onChange={(e) => setInvestForm({ ...investForm, amount: e.target.value })}
              placeholder="0.00"
            />
            <Input
              label="Date *"
              type="date"
              value={investForm.investment_date}
              onChange={(e) => setInvestForm({ ...investForm, investment_date: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              rows={2}
              value={investForm.description}
              onChange={(e) => setInvestForm({ ...investForm, description: e.target.value })}
              placeholder="Optional — e.g. initial capital, additional top-up"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => setIsInvestOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveInvestment} isLoading={isSavingInvestment}>Record Investment</Button>
          </div>
        </div>
      </Modal>

      {/* Return to Investor Modal */}
      <Modal isOpen={isReturnOpen} onClose={() => setIsReturnOpen(false)} title="Return to Investor" size="sm">
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            This reduces {selectedInvestor?.name}&apos;s balance and posts Dr Investor Capital / Cr Cash to the ledger.
          </p>
          <p className="text-sm text-gray-600">
            Current balance: <span className="font-semibold text-gray-900">{formatCurrency(selectedInvestor?.balance ?? 0)}</span>
          </p>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Amount to return (৳)</label>
            <input
              type="number"
              min={0.01}
              max={selectedInvestor?.balance ?? 0}
              step="0.01"
              value={returnForm.amount}
              onChange={(e) => setReturnForm({ ...returnForm, amount: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <Input
            label="Date"
            type="date"
            value={returnForm.investment_date}
            onChange={(e) => setReturnForm({ ...returnForm, investment_date: e.target.value })}
          />
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              rows={2}
              value={returnForm.description}
              onChange={(e) => setReturnForm({ ...returnForm, description: e.target.value })}
              placeholder="Optional"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => setIsReturnOpen(false)}>Cancel</Button>
            <Button variant="danger" onClick={handleProcessReturn} isLoading={isProcessingReturn}>Process Return</Button>
          </div>
        </div>
      </Modal>

      {/* Edit Investor Modal */}
      <Modal isOpen={isEditOpen} onClose={() => setIsEditOpen(false)} title="Edit Investor" size="md">
        <div className="space-y-4">
          <Input
            label="Name *"
            value={editForm.name}
            onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
          />
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Phone"
              value={editForm.phone}
              onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
            />
            <Input
              label="Email"
              type="email"
              value={editForm.email}
              onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
            <textarea
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              rows={2}
              value={editForm.address}
              onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <textarea
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              rows={2}
              value={editForm.notes}
              onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={editForm.is_active}
              onChange={(e) => setEditForm({ ...editForm, is_active: e.target.checked })}
              className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
            />
            Active
          </label>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => setIsEditOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveEdit} isLoading={isSaving}>Update</Button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirm Modal */}
      <ConfirmModal
        isOpen={isDeleteOpen}
        onClose={() => setIsDeleteOpen(false)}
        onConfirm={handleDelete}
        title="Delete Investor"
        message={`Delete "${selectedInvestor?.name}"? This only works if they have no recorded investments.`}
        confirmLabel="Delete"
        variant="danger"
        isLoading={isDeleting}
      />
    </AdminLayout>
  );
}
