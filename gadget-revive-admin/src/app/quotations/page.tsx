'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { Plus, Search, Edit2, Trash2, Download, FileText, RefreshCw, Receipt, CheckCircle2, XCircle, Clock3 } from 'lucide-react';
import { AdminLayout } from '@/components/layout';
import { Button, LoadingSpinner, Pagination, EmptyState, ErrorState, ConfirmModal, Badge } from '@/components/ui';
import { KpiTile } from '@/components/reports/shared';
import { Quotation, QuotationStatus } from '@/types';
import { formatCurrency, formatDate, getErrorMessage } from '@/lib/utils';
import adminService from '@/lib/adminService';

const STATUS_OPTIONS: { value: QuotationStatus; label: string }[] = [
  { value: 'draft', label: 'Draft' },
  { value: 'sent', label: 'Sent' },
  { value: 'accepted', label: 'Accepted' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'expired', label: 'Expired' },
];

type StatusTotals = Record<string, { count: number; total: number }>;

export default function QuotationsPage() {
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [meta, setMeta] = useState<{ last_page: number; total: number; per_page: number; from: number | null; to: number | null } | null>(null);
  const [summary, setSummary] = useState<{ count: number; value: number; by_status: StatusTotals } | null>(null);
  const [selected, setSelected] = useState<Quotation | null>(null);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [downloadingId, setDownloadingId] = useState<number | null>(null);

  const fetchQuotations = async () => {
    setIsLoading(true);
    setError(false);
    try {
      const params: Record<string, string | number> = { page: currentPage };
      if (search) params.search = search;
      if (filterStatus) params.status = filterStatus;
      const res = await adminService.getQuotations(params);
      const body = res.data as unknown as {
        data: Quotation[];
        meta?: { last_page: number; total: number; per_page: number; from: number | null; to: number | null };
        summary?: { count: number; value: number; by_status: StatusTotals | unknown[] };
      };
      setQuotations(Array.isArray(body.data) ? body.data : []);
      setMeta(body.meta ?? null);
      setSummary(
        body.summary
          ? { count: body.summary.count, value: body.summary.value, by_status: Array.isArray(body.summary.by_status) ? {} : body.summary.by_status }
          : null
      );
    } catch (err) {
      toast.error(getErrorMessage(err));
      setError(true);
      setQuotations([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchQuotations(); }, [currentPage, filterStatus, search]);

  // Search waits for a pause in typing, then resets to page one.
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput.trim());
      setCurrentPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const statusCount = (...keys: string[]) =>
    keys.reduce((n, k) => n + (summary?.by_status[k]?.count ?? 0), 0);
  const statusValue = (...keys: string[]) =>
    keys.reduce((n, k) => n + (summary?.by_status[k]?.total ?? 0), 0);

  const handleDownload = async (q: Quotation) => {
    setDownloadingId(q.id);
    try {
      const res = await adminService.downloadQuotation(q.id);
      const blob = new Blob([res.data as BlobPart], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Quotation-${q.quotation_number}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setDownloadingId(null);
    }
  };

  const handleStatusChange = async (q: Quotation, status: string) => {
    try {
      await adminService.updateQuotationStatus(q.id, status);
      toast.success('Status updated.');
      fetchQuotations();
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const handleDelete = async () => {
    if (!selected) return;
    setIsDeleting(true);
    try {
      await adminService.deleteQuotation(selected.id);
      toast.success('Quotation deleted.');
      setIsDeleteOpen(false);
      setSelected(null);
      fetchQuotations();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setIsDeleting(false);
    }
  };

  const filtered = search !== '' || filterStatus !== '';

  return (
    <AdminLayout>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2.5">
          <h1 className="text-lg font-bold text-gray-900">Quotations</h1>
          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-semibold text-gray-600">
            {summary?.count ?? 0} total
          </span>
          <span className="text-xs text-gray-500">Priced offers from catalog products or custom items</span>
        </div>
        <Link href="/quotations/create">
          <Button size="sm" leftIcon={<Plus className="h-3.5 w-3.5" />}>New quotation</Button>
        </Link>
      </div>

      <div className="mb-3 grid grid-cols-2 gap-2 lg:grid-cols-4">
        <KpiTile
          label="All quotations"
          value={formatCurrency(summary?.value ?? 0)}
          tone="indigo"
          icon={<Receipt className="h-4 w-4 opacity-60" />}
          sub={`${summary?.count ?? 0} quotation${summary?.count === 1 ? '' : 's'} in total`}
        />
        <KpiTile
          label="Open"
          value={formatCurrency(statusValue('draft', 'sent'))}
          tone="amber"
          icon={<Clock3 className="h-4 w-4 opacity-60" />}
          sub={`${statusCount('draft', 'sent')} draft or sent, awaiting a decision`}
        />
        <KpiTile
          label="Accepted"
          value={formatCurrency(statusValue('accepted'))}
          tone="emerald"
          icon={<CheckCircle2 className="h-4 w-4 opacity-60" />}
          sub={`${statusCount('accepted')} accepted`}
        />
        <KpiTile
          label="Rejected or expired"
          value={String(statusCount('rejected', 'expired'))}
          tone="rose"
          icon={<XCircle className="h-4 w-4 opacity-60" />}
          sub={`${statusCount('rejected')} rejected · ${statusCount('expired')} expired`}
        />
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-gray-200 bg-white p-2.5">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
          <input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search quotation no, customer name or phone…"
            className="h-8 w-full rounded-lg border border-gray-300 pl-8 pr-3 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {[{ value: '', label: 'All' }, ...STATUS_OPTIONS].map((c) => (
            <button
              key={c.value || 'all'}
              type="button"
              onClick={() => { setFilterStatus(c.value); setCurrentPage(1); }}
              className={`rounded-full border px-2.5 py-1 text-xs font-semibold transition-colors ${
                filterStatus === c.value ? 'border-indigo-600 bg-indigo-600 text-white' : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
              }`}
            >
              {c.label}
              {c.value && summary && <span className="ml-1 opacity-70">{summary.by_status[c.value]?.count ?? 0}</span>}
            </button>
          ))}
        </div>
        <Button size="sm" variant="ghost" onClick={fetchQuotations} leftIcon={<RefreshCw className="h-3.5 w-3.5" />}>Refresh</Button>
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        {isLoading ? (
          <div className="flex justify-center py-10"><LoadingSpinner /></div>
        ) : error ? (
          <ErrorState onRetry={fetchQuotations} />
        ) : quotations.length === 0 ? (
          <EmptyState
            icon={<FileText className="h-8 w-8" />}
            title={filtered ? 'No matching quotations' : 'No quotations yet'}
            description={filtered ? 'Clear the search or status filter.' : 'Create a quotation to send a priced offer to a customer.'}
          />
        ) : (
          <div className="max-h-[calc(100vh-24rem)] overflow-auto">
            <table className="min-w-full text-sm">
              <thead className="sticky top-0 z-10 bg-slate-50 text-xs uppercase tracking-wide text-slate-500 shadow-[0_1px_0_0_rgb(226,232,240)]">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold">Quotation</th>
                  <th className="px-3 py-2 text-left font-semibold">Customer</th>
                  <th className="px-3 py-2 text-left font-semibold">Valid until</th>
                  <th className="px-3 py-2 text-right font-semibold">Total</th>
                  <th className="px-3 py-2 text-left font-semibold">Status</th>
                  <th className="px-3 py-2 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {quotations.map((q, i) => (
                  <tr key={q.id} className={`${i % 2 ? 'bg-slate-50/50' : 'bg-white'} hover:bg-indigo-50/40`}>
                    <td className="px-3 py-2">
                      <p className="font-mono font-semibold text-gray-900">{q.quotation_number}</p>
                      <p className="text-[11px] text-gray-500">{formatDate(q.quotation_date)}</p>
                    </td>
                    <td className="px-3 py-2">
                      <p className="font-semibold text-gray-900">{q.customer_name || '—'}</p>
                      {q.customer_phone && <p className="text-[11px] tabular-nums text-gray-500">{q.customer_phone}</p>}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-xs tabular-nums text-gray-600">
                      {q.valid_until ? formatDate(q.valid_until) : '—'}
                      {q.is_expired && <span className="ml-1.5"><Badge variant="warning">Expired</Badge></span>}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-right font-semibold tabular-nums text-gray-900">{formatCurrency(q.total)}</td>
                    <td className="px-3 py-2">
                      <select
                        value={q.status}
                        onChange={(e) => handleStatusChange(q, e.target.value)}
                        className="h-7 rounded-md border border-gray-200 bg-white px-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        aria-label={`Status for ${q.quotation_number}`}
                      >
                        {STATUS_OPTIONS.map((s) => (
                          <option key={s.value} value={s.value}>{s.label}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center justify-end gap-0.5">
                        <button
                          type="button"
                          title="Download PDF"
                          onClick={() => handleDownload(q)}
                          disabled={downloadingId === q.id}
                          className="rounded-md p-1 text-gray-600 hover:bg-gray-100 disabled:opacity-40"
                        >
                          <Download className="h-3.5 w-3.5" />
                        </button>
                        <Link href={`/quotations/${q.id}/edit`} title="Edit" className="rounded-md p-1 text-sky-600 hover:bg-sky-50">
                          <Edit2 className="h-3.5 w-3.5" />
                        </Link>
                        <button
                          type="button"
                          title="Delete"
                          onClick={() => { setSelected(q); setIsDeleteOpen(true); }}
                          className="rounded-md p-1 text-rose-500 hover:bg-rose-50"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {meta && meta.total > 0 && (
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-gray-500">
          <span>
            Showing <span className="font-semibold text-gray-700">{meta.from ?? 0}–{meta.to ?? 0}</span> of{' '}
            <span className="font-semibold text-gray-700">{meta.total}</span>
          </span>
          {meta.last_page > 1 && (
            <Pagination currentPage={currentPage} totalPages={meta.last_page} onPageChange={setCurrentPage} />
          )}
        </div>
      )}

      <ConfirmModal
        isOpen={isDeleteOpen}
        onClose={() => setIsDeleteOpen(false)}
        onConfirm={handleDelete}
        title="Delete quotation"
        message={`Delete quotation ${selected?.quotation_number}? This cannot be undone.`}
        confirmLabel="Delete"
        variant="danger"
        isLoading={isDeleting}
      />
    </AdminLayout>
  );
}
