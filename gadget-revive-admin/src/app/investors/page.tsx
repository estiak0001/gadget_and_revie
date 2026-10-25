'use client';

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { Plus, Pencil, Trash2, RefreshCw, ArrowDownCircle, TrendingUp, Users, UserCheck, Search, X } from 'lucide-react';
import { AdminLayout } from '@/components/layout';
import { Button, Input, Select, Modal, ConfirmModal, Badge, LoadingSpinner, EmptyState, ErrorState } from '@/components/ui';
import { KpiTile, Panel, chipClass, ymd } from '@/components/reports/shared';
import { Investor } from '@/types';
import { formatCurrency, getErrorMessage } from '@/lib/utils';
import adminService from '@/lib/adminService';
import toast from 'react-hot-toast';

const EMPTY_EDIT_FORM = { name: '', phone: '', email: '', address: '', notes: '', is_active: true, share_percentage: '' };
const TEXTAREA = 'w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500';

type StatusFilter = 'all' | 'active' | 'inactive';

export default function InvestorsPage() {
  const [investors, setInvestors] = useState<Investor[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

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
    investment_date: ymd(new Date()),
    description: '',
  });
  const [isSavingInvestment, setIsSavingInvestment] = useState(false);

  // Return to Investor modal
  const [isReturnOpen, setIsReturnOpen] = useState(false);
  const [returnForm, setReturnForm] = useState({ amount: '', investment_date: ymd(new Date()), description: '' });
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
  const activeCount = investors.filter((i) => i.is_active).length;
  const topHolder = useMemo(
    () => investors.reduce<Investor | null>((best, i) => (!best || (i.balance ?? 0) > (best.balance ?? 0) ? i : best), null),
    [investors]
  );

  const q = searchInput.trim().toLowerCase();
  const visible = investors.filter((i) => {
    const matchesText = !q || [i.name, i.phone, i.email].some((v) => (v ?? '').toLowerCase().includes(q));
    const matchesStatus = statusFilter === 'all' || (statusFilter === 'active' ? i.is_active : !i.is_active);
    return matchesText && matchesStatus;
  });
  const filtered = !!q || statusFilter !== 'all';

  // ── Add Investment ──────────────────────────────────────────────────────

  const openInvest = () => {
    setInvestorMode(investors.length > 0 ? 'existing' : 'new');
    setInvestForm({
      investor_id: investors[0] ? String(investors[0].id) : '',
      investor_name: '', investor_phone: '', investor_email: '',
      amount: '', investment_date: ymd(new Date()), description: '',
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
    setReturnForm({ amount: investor.balance ? String(investor.balance) : '', investment_date: ymd(new Date()), description: '' });
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
      share_percentage: investor.share_percentage != null ? String(investor.share_percentage) : '',
    });
    setIsEditOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!selectedInvestor) return;
    if (!editForm.name.trim()) {
      toast.error('Name is required');
      return;
    }
    const sharePct = editForm.share_percentage.trim();
    if (sharePct !== '' && (Number.isNaN(Number(sharePct)) || Number(sharePct) < 0 || Number(sharePct) > 100)) {
      toast.error('Share % must be a number between 0 and 100');
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
        share_percentage: sharePct === '' ? null : Number(sharePct),
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

  const shareOf = (balance: number | undefined) =>
    totalCapital > 0 ? ((balance ?? 0) / totalCapital) * 100 : 0;

  return (
    <AdminLayout>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2.5">
          <h1 className="text-lg font-bold text-gray-900">Investors</h1>
          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-semibold text-gray-600">
            {investors.length} investor{investors.length === 1 ? '' : 's'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={fetchInvestors} leftIcon={<RefreshCw className="h-3.5 w-3.5" />}>Refresh</Button>
          <Button size="sm" onClick={openInvest} leftIcon={<Plus className="h-3.5 w-3.5" />}>Add investment</Button>
        </div>
      </div>

      <div className="mb-3 grid grid-cols-2 gap-2 lg:grid-cols-4">
        <KpiTile label="Capital outstanding" value={formatCurrency(totalCapital)} tone="emerald" icon={<TrendingUp className="h-4 w-4 opacity-60" />} sub="Sum of investor balances" />
        <KpiTile label="Active investors" value={`${activeCount} of ${investors.length}`} tone="sky" icon={<UserCheck className="h-4 w-4 opacity-60" />} sub="Marked active" />
        <KpiTile label="Largest holder" value={topHolder && (topHolder.balance ?? 0) > 0 ? topHolder.name : '—'} tone="indigo" icon={<Users className="h-4 w-4 opacity-60" />}
          sub={topHolder && (topHolder.balance ?? 0) > 0 ? (topHolder.share_percentage != null ? `${topHolder.share_percentage.toFixed(1)}% share` : 'Largest by capital — no share % set') : 'No capital yet'} />
        <KpiTile label="Average per investor" value={formatCurrency(investors.length ? totalCapital / investors.length : 0)} tone="amber" sub="Across all investors" />
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-gray-200 bg-white p-3">
        <div className="relative min-w-[240px] flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
          <input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search name, phone or email…"
            className="h-8 w-full rounded-lg border border-gray-300 pl-8 pr-3 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <div className="flex gap-1.5">
          {([
            { value: 'all', label: 'All' },
            { value: 'active', label: 'Active' },
            { value: 'inactive', label: 'Inactive' },
          ] as const).map((s) => (
            <button key={s.value} type="button" onClick={() => setStatusFilter(s.value)} className={chipClass(statusFilter === s.value)}>
              {s.label}
            </button>
          ))}
        </div>
        {filtered && (
          <button
            type="button"
            onClick={() => { setSearchInput(''); setStatusFilter('all'); }}
            className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-gray-600 hover:bg-gray-100"
          >
            <X className="h-3.5 w-3.5" /> Clear
          </button>
        )}
      </div>

      <Panel title="Investor register" hint="Balance is the capital each investor still has in the business">
        {isLoading ? (
          <div className="flex justify-center py-12"><LoadingSpinner /></div>
        ) : error ? (
          <div className="p-4"><ErrorState message="Failed to load investors." onRetry={fetchInvestors} /></div>
        ) : investors.length === 0 ? (
          <div className="p-4">
            <EmptyState
              title="No investors yet"
              description="Add your first investment to start tracking investor capital."
              action={<Button onClick={openInvest} leftIcon={<Plus className="w-4 h-4" />}>Add investment</Button>}
            />
          </div>
        ) : visible.length === 0 ? (
          <p className="py-10 text-center text-xs text-gray-500">No investors match these filters.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-2 text-left font-semibold">Investor</th>
                  <th className="px-4 py-2 text-left font-semibold">Contact</th>
                  <th className="px-4 py-2 text-right font-semibold">Balance</th>
                  <th className="px-4 py-2 text-left font-semibold">Share</th>
                  <th className="px-4 py-2 text-left font-semibold">Status</th>
                  <th className="px-4 py-2 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {visible.map((investor, i) => {
                  const share = investor.share_percentage;
                  return (
                    <tr key={investor.id} className={`${i % 2 ? 'bg-slate-50/40' : 'bg-white'} hover:bg-indigo-50/40`}>
                      <td className="px-4 py-2">
                        <p className="font-semibold text-gray-900">{investor.name}</p>
                        {investor.notes && <p className="max-w-[260px] truncate text-[11px] text-gray-500" title={investor.notes}>{investor.notes}</p>}
                      </td>
                      <td className="px-4 py-2 text-xs text-gray-600">
                        <p>{investor.phone || '—'}</p>
                        <p className="text-gray-500">{investor.email || ''}</p>
                      </td>
                      <td className="whitespace-nowrap px-4 py-2 text-right font-semibold tabular-nums text-gray-900">
                        {formatCurrency(investor.balance ?? 0)}
                      </td>
                      <td className="px-4 py-2">
                        {share != null ? (
                          <div className="flex items-center gap-2">
                            <div className="h-1.5 w-24 overflow-hidden rounded-full bg-gray-100">
                              <div className="h-full rounded-full bg-emerald-500" style={{ width: `${Math.min(100, share)}%` }} />
                            </div>
                            <span className="text-[11px] tabular-nums text-gray-600">{share.toFixed(1)}%</span>
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400" title="Not set — edit this investor to enter it">Not set</span>
                        )}
                      </td>
                      <td className="px-4 py-2">
                        <Badge variant={investor.is_active ? 'success' : 'default'} className="text-[11px]">
                          {investor.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </td>
                      <td className="px-4 py-2 text-right">
                        <div className="flex justify-end gap-0.5">
                          {(investor.balance ?? 0) > 0 && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openReturn(investor)}
                              className="text-amber-600 hover:bg-amber-50 hover:text-amber-700"
                              leftIcon={<ArrowDownCircle className="h-3.5 w-3.5" />}
                            >
                              Return
                            </Button>
                          )}
                          <Button variant="ghost" size="sm" title="Edit" onClick={() => openEdit(investor)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="sm" title="Delete" onClick={() => openDelete(investor)} className="text-red-500 hover:bg-red-50 hover:text-red-700">
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="border-t-2 border-gray-300 bg-slate-50 font-bold">
                <tr>
                  <td className="px-4 py-2" colSpan={2}>{filtered ? `Showing ${visible.length} of ${investors.length}` : 'Total'}</td>
                  <td className="whitespace-nowrap px-4 py-2 text-right tabular-nums">{formatCurrency(visible.reduce((s, i) => s + (i.balance ?? 0), 0))}</td>
                  <td colSpan={3} />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </Panel>

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
            <label className="mb-1 block text-sm font-medium text-gray-700">Description</label>
            <textarea
              className={TEXTAREA}
              rows={2}
              value={investForm.description}
              onChange={(e) => setInvestForm({ ...investForm, description: e.target.value })}
              placeholder="Optional — e.g. initial capital, additional top-up"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => setIsInvestOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveInvestment} isLoading={isSavingInvestment}>Record investment</Button>
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
            <label className="mb-1 block text-sm font-medium text-gray-700">Amount to return (৳)</label>
            <input
              type="number"
              min={0.01}
              max={selectedInvestor?.balance ?? 0}
              step="0.01"
              value={returnForm.amount}
              onChange={(e) => setReturnForm({ ...returnForm, amount: e.target.value })}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <Input
            label="Date"
            type="date"
            value={returnForm.investment_date}
            onChange={(e) => setReturnForm({ ...returnForm, investment_date: e.target.value })}
          />
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Description</label>
            <textarea
              className={TEXTAREA}
              rows={2}
              value={returnForm.description}
              onChange={(e) => setReturnForm({ ...returnForm, description: e.target.value })}
              placeholder="Optional"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => setIsReturnOpen(false)}>Cancel</Button>
            <Button variant="danger" onClick={handleProcessReturn} isLoading={isProcessingReturn}>Process return</Button>
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
            <Input
              label="Share % (manual)"
              type="number"
              min={0}
              max={100}
              step="0.01"
              value={editForm.share_percentage}
              onChange={(e) => setEditForm({ ...editForm, share_percentage: e.target.value })}
              placeholder="e.g. 25"
            />
            <p className="mt-1 text-[11px] text-gray-500">
              Ownership share — set this directly; it no longer follows the capital amount.
              {selectedInvestor && totalCapital > 0 && (selectedInvestor.balance ?? 0) > 0 && (
                <> For reference, capital contributed is ≈{shareOf(selectedInvestor.balance).toFixed(1)}% of the total pool.</>
              )}
            </p>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Address</label>
            <textarea
              className={TEXTAREA}
              rows={2}
              value={editForm.address}
              onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Notes</label>
            <textarea
              className={TEXTAREA}
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
