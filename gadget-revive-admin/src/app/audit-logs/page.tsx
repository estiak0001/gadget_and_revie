'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { Download, Eye, RefreshCw, Search, ScrollText, Activity, Plus, Pencil, Trash2, LogIn, Users } from 'lucide-react';
import { AdminLayout } from '@/components/layout';
import { Button, Modal, LoadingSpinner, Pagination, EmptyState, ErrorState, SearchableSelect } from '@/components/ui';
import { KpiTile, presetRange, ymd } from '@/components/reports/shared';
import { AuditLog } from '@/types';
import { downloadBlob, formatDateTime, getErrorMessage } from '@/lib/utils';
import adminService from '@/lib/adminService';

type Group = '' | 'created' | 'updated' | 'removed' | 'auth';
type Preset = 'all' | 'today' | '7d' | '30d' | 'month' | 'custom';

interface Filters {
  preset: Preset;
  start: string;
  end: string;
  search: string;
  userId: string;
  action: string;
  resource: string;
  group: Group;
}

const EMPTY_FILTERS: Filters = {
  preset: 'all', start: '', end: '', search: '', userId: '', action: '', resource: '', group: '',
};

interface AuditResponse {
  data: AuditLog[];
  meta: { current_page: number; last_page: number; per_page: number; total: number; from: number | null; to: number | null };
  summary: { total: number; users: number; created: number; updated: number; removed: number; auth: number };
  options: {
    actions: string[];
    resource_types: string[];
    actors: { id: number; name: string; role?: string }[];
  };
}

const PRESETS: { value: Preset; label: string }[] = [
  { value: 'all', label: 'All time' },
  { value: 'today', label: 'Today' },
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
  { value: 'month', label: 'This month' },
  { value: 'custom', label: 'Custom' },
];

const GROUPS: { value: Group; label: string; tone: string }[] = [
  { value: '', label: 'Everything', tone: 'slate' },
  { value: 'created', label: 'Created', tone: 'emerald' },
  { value: 'updated', label: 'Updated', tone: 'amber' },
  { value: 'removed', label: 'Removed or reversed', tone: 'rose' },
  { value: 'auth', label: 'Sign-ins', tone: 'sky' },
];

const TONE_CHIP: Record<string, string> = {
  emerald: 'border-emerald-600 bg-emerald-600 text-white',
  amber: 'border-amber-500 bg-amber-500 text-white',
  rose: 'border-rose-600 bg-rose-600 text-white',
  sky: 'border-sky-600 bg-sky-600 text-white',
  slate: 'border-slate-700 bg-slate-700 text-white',
};

const TONE_BADGE: Record<string, string> = {
  emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  amber: 'bg-amber-50 text-amber-700 border-amber-200',
  rose: 'bg-rose-50 text-rose-700 border-rose-200',
  sky: 'bg-sky-50 text-sky-700 border-sky-200',
  slate: 'bg-slate-100 text-slate-700 border-slate-200',
};

function actionTone(action: string): string {
  if (action.startsWith('create')) return 'emerald';
  if (action.startsWith('update') || action.startsWith('upload')) return 'amber';
  if (/^(delete|reverse|reject|suspend)/.test(action)) return 'rose';
  if (action === 'login' || action === 'logout') return 'sky';
  return 'slate';
}

function fmtValue(v: unknown): string {
  if (v === null || v === undefined || v === '') return '—';
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}

function changeCount(log: AuditLog): number {
  if (log.old_values && log.new_values) {
    const keys = new Set([...Object.keys(log.old_values), ...Object.keys(log.new_values)]);
    return Array.from(keys).filter((k) => fmtValue(log.old_values?.[k]) !== fmtValue(log.new_values?.[k])).length;
  }
  return Object.keys(log.new_values ?? log.old_values ?? {}).length;
}

export default function AuditLogsPage() {
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [applied, setApplied] = useState<Filters>(EMPTY_FILTERS);
  const [currentPage, setCurrentPage] = useState(1);
  const [response, setResponse] = useState<AuditResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [detail, setDetail] = useState<AuditLog | null>(null);

  // Filters apply after a short pause, so typing in search doesn't fire a request per keystroke.
  useEffect(() => {
    const timer = setTimeout(() => {
      setApplied(filters);
      setCurrentPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [filters]);

  const buildParams = useCallback((f: Filters) => {
    const p: Record<string, string | number> = {};
    if (f.start) p.start_date = f.start;
    if (f.end) p.end_date = f.end;
    if (f.search.trim()) p.search = f.search.trim();
    if (f.userId) p.user_id = f.userId;
    if (f.action) p.action_type = f.action;
    if (f.resource) p.resource_type = f.resource;
    if (f.group) p.group = f.group;
    return p;
  }, []);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await adminService.getAuditLogs({ ...buildParams(applied), page: currentPage, per_page: 20 });
      setResponse(res.data as unknown as AuditResponse);
    } catch (err) {
      toast.error(getErrorMessage(err));
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [applied, currentPage, buildParams]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  const handleExport = async () => {
    setExporting(true);
    try {
      const res = await adminService.exportAuditLogs(buildParams(applied) as Record<string, string>);
      downloadBlob(new Blob([res.data]), `audit-logs-${ymd(new Date())}.csv`);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setExporting(false);
    }
  };

  const choosePreset = (preset: Preset) => {
    if (preset === 'all') return setFilters((f) => ({ ...f, preset, start: '', end: '' }));
    if (preset === 'custom') return setFilters((f) => ({ ...f, preset }));
    const range = presetRange(preset === '30d' ? '30d' : preset === '7d' ? '7d' : preset === 'today' ? 'today' : 'month');
    setFilters((f) => ({ ...f, preset, start: range.start, end: range.end }));
  };

  const setDate = (key: 'start' | 'end', value: string) =>
    setFilters((f) => ({ ...f, [key]: value, preset: 'custom' }));

  const hasFilters = useMemo(
    () => filters.preset !== 'all' || !!filters.search || !!filters.userId || !!filters.action || !!filters.resource || !!filters.group,
    [filters]
  );

  const summary = response?.summary;
  const meta = response?.meta;
  const options = response?.options;

  const actionOptions = useMemo(
    () => (options?.actions ?? []).map((a) => ({ value: a, label: a.replace(/_/g, ' ') })),
    [options]
  );
  const resourceOptions = useMemo(
    () => (options?.resource_types ?? []).map((r) => ({ value: r, label: r })),
    [options]
  );
  const userOptions = useMemo(
    () => (options?.actors ?? []).map((u) => ({ value: u.id, label: u.name, description: u.role })),
    [options]
  );

  const diffKeys = detail
    ? Array.from(new Set([...Object.keys(detail.old_values ?? {}), ...Object.keys(detail.new_values ?? {})]))
    : [];

  return (
    <AdminLayout>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <h1 className="text-lg font-bold text-gray-900">Audit log</h1>
          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-semibold text-gray-600">
            {meta?.total ?? 0} event{meta?.total === 1 ? '' : 's'}
          </span>
          <span className="text-xs text-gray-500">Every change made in the admin panel</span>
        </div>
        <Button size="sm" variant="outline" onClick={handleExport} isLoading={exporting} leftIcon={<Download className="h-3.5 w-3.5" />}>
          Export CSV
        </Button>
      </div>

      <div className="mb-3 grid grid-cols-2 gap-2 lg:grid-cols-5">
        <KpiTile label="Events" value={(summary?.total ?? 0).toLocaleString()} tone="indigo" icon={<Activity className="h-4 w-4 opacity-60" />} sub="Matching the filters" />
        <KpiTile label="Created" value={(summary?.created ?? 0).toLocaleString()} tone="emerald" icon={<Plus className="h-4 w-4 opacity-60" />} sub="New records" />
        <KpiTile label="Updated" value={(summary?.updated ?? 0).toLocaleString()} tone="amber" icon={<Pencil className="h-4 w-4 opacity-60" />} sub="Changed records" />
        <KpiTile label="Removed" value={(summary?.removed ?? 0).toLocaleString()} tone="rose" icon={<Trash2 className="h-4 w-4 opacity-60" />} sub="Deleted or reversed" />
        <KpiTile label="People" value={(summary?.users ?? 0).toLocaleString()} tone="sky" icon={<Users className="h-4 w-4 opacity-60" />} sub={`${summary?.auth ?? 0} sign-in events`} />
      </div>

      <div className="mb-3 space-y-2 rounded-xl border border-gray-200 bg-white p-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            {PRESETS.map((p) => (
              <button
                key={p.value}
                type="button"
                onClick={() => choosePreset(p.value)}
                className={`rounded-full border px-2.5 py-1 text-xs font-semibold transition-colors ${
                  filters.preset === p.value ? 'border-indigo-600 bg-indigo-600 text-white' : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
              From
              <input type="date" value={filters.start} onChange={(e) => setDate('start', e.target.value)} className="h-8 w-36 rounded-lg border border-gray-300 px-2 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </label>
            <label className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
              To
              <input type="date" value={filters.end} onChange={(e) => setDate('end', e.target.value)} className="h-8 w-36 rounded-lg border border-gray-300 px-2 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </label>
            {hasFilters && (
              <Button size="sm" variant="ghost" onClick={() => setFilters(EMPTY_FILTERS)} leftIcon={<RefreshCw className="h-3.5 w-3.5" />}>Reset</Button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-2 lg:grid-cols-12">
          <div className="relative lg:col-span-4">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
            <input
              value={filters.search}
              onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
              placeholder="Search description, person, IP, record ID…"
              className="h-8 w-full rounded-lg border border-gray-300 pl-8 pr-3 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div className="lg:col-span-3">
            <SearchableSelect
              placeholder="Any person"
              allowClear
              value={filters.userId}
              onChange={(v) => setFilters((f) => ({ ...f, userId: String(v) }))}
              options={userOptions}
            />
          </div>
          <div className="lg:col-span-3">
            <SearchableSelect
              placeholder="Any action"
              allowClear
              value={filters.action}
              onChange={(v) => setFilters((f) => ({ ...f, action: String(v) }))}
              options={actionOptions}
            />
          </div>
          <div className="lg:col-span-2">
            <SearchableSelect
              placeholder="Any record type"
              allowClear
              value={filters.resource}
              onChange={(v) => setFilters((f) => ({ ...f, resource: String(v) }))}
              options={resourceOptions}
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {GROUPS.map((g) => (
            <button
              key={g.value || 'all'}
              type="button"
              onClick={() => setFilters((f) => ({ ...f, group: g.value }))}
              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold transition-colors ${
                filters.group === g.value ? TONE_CHIP[g.tone] : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
              }`}
            >
              {g.value === 'created' && <Plus className="h-3 w-3" />}
              {g.value === 'updated' && <Pencil className="h-3 w-3" />}
              {g.value === 'removed' && <Trash2 className="h-3 w-3" />}
              {g.value === 'auth' && <LogIn className="h-3 w-3" />}
              {g.label}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        {loading && !response ? (
          <div className="flex justify-center py-10"><LoadingSpinner /></div>
        ) : error && !response ? (
          <ErrorState message="Failed to load the audit log." onRetry={fetchLogs} />
        ) : !response || response.data.length === 0 ? (
          <EmptyState
            icon={<ScrollText className="h-8 w-8 text-gray-400" />}
            title={hasFilters ? 'No events match these filters' : 'No activity recorded yet'}
            description={hasFilters ? 'Widen the dates or clear a filter.' : 'Changes made in the admin panel will appear here.'}
          />
        ) : (
          <div className="max-h-[calc(100vh-27rem)] overflow-auto">
            <table className="min-w-full text-sm">
              <thead className="sticky top-0 z-10 bg-slate-50 text-xs uppercase tracking-wide text-slate-500 shadow-[0_1px_0_0_rgb(226,232,240)]">
                <tr>
                  <th className="whitespace-nowrap px-3 py-2 text-left font-semibold">When</th>
                  <th className="px-3 py-2 text-left font-semibold">Person</th>
                  <th className="px-3 py-2 text-left font-semibold">Action</th>
                  <th className="px-3 py-2 text-left font-semibold">Record</th>
                  <th className="px-3 py-2 text-left font-semibold">What changed</th>
                  <th className="px-3 py-2 text-left font-semibold">IP</th>
                  <th className="px-3 py-2 text-right font-semibold">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {response.data.map((log, i) => {
                  const tone = actionTone(log.action_type);
                  const changed = changeCount(log);
                  return (
                    <tr key={log.id} className={`${i % 2 ? 'bg-slate-50/50' : 'bg-white'} hover:bg-indigo-50/40`}>
                      <td className="whitespace-nowrap px-3 py-2 text-xs tabular-nums text-gray-600">{formatDateTime(log.created_at)}</td>
                      <td className="px-3 py-2">
                        {log.actor ? (
                          <>
                            <p className="font-semibold text-gray-900">{log.actor.name}</p>
                            <p className="text-[11px] text-gray-500">{log.actor.email}</p>
                          </>
                        ) : (
                          <span className="text-xs italic text-gray-400">System</span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <span className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold ${TONE_BADGE[tone]}`}>
                          {log.action_type.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        <p className="text-xs font-semibold text-gray-800">{log.resource_type || '—'}</p>
                        {log.resource_id && <p className="font-mono text-[11px] text-gray-500">#{log.resource_id}</p>}
                      </td>
                      <td className="max-w-md px-3 py-2">
                        {log.description ? (
                          <p className="truncate text-xs text-gray-700">{log.description}</p>
                        ) : changed > 0 ? (
                          <p className="text-xs text-gray-500">{changed} field{changed === 1 ? '' : 's'} changed</p>
                        ) : (
                          <span className="text-xs text-gray-400">—</span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 font-mono text-[11px] text-gray-500">{log.ip_address || '—'}</td>
                      <td className="px-3 py-2 text-right">
                        <button
                          type="button"
                          title="View details"
                          onClick={() => setDetail(log)}
                          className="rounded-md p-1 text-indigo-600 hover:bg-indigo-50"
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
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

      <Modal isOpen={!!detail} onClose={() => setDetail(null)} title="Event details" size="lg">
        {detail && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
              <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">When</p>
                <p className="text-xs font-semibold text-gray-900">{formatDateTime(detail.created_at)}</p>
              </div>
              <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">Person</p>
                <p className="text-xs font-semibold text-gray-900">{detail.actor?.name ?? 'System'}</p>
                {detail.actor?.email && <p className="text-[11px] text-gray-500">{detail.actor.email}</p>}
              </div>
              <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">Action</p>
                <span className={`mt-0.5 inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold ${TONE_BADGE[actionTone(detail.action_type)]}`}>
                  {detail.action_type.replace(/_/g, ' ')}
                </span>
              </div>
              <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">Record</p>
                <p className="text-xs font-semibold text-gray-900">{detail.resource_type || '—'} {detail.resource_id ? `#${detail.resource_id}` : ''}</p>
                <p className="font-mono text-[11px] text-gray-500">{detail.ip_address || '—'}</p>
              </div>
            </div>

            {detail.description && (
              <p className="rounded-lg bg-indigo-50 px-3 py-2 text-sm text-indigo-900">{detail.description}</p>
            )}

            {diffKeys.length > 0 ? (
              <div className="overflow-hidden rounded-lg border border-gray-200">
                <table className="min-w-full text-xs">
                  <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-3 py-2 text-left font-semibold">Field</th>
                      <th className="px-3 py-2 text-left font-semibold">Before</th>
                      <th className="px-3 py-2 text-left font-semibold">After</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {diffKeys.map((k) => {
                      const before = fmtValue(detail.old_values?.[k]);
                      const after = fmtValue(detail.new_values?.[k]);
                      const changed = before !== after;
                      return (
                        <tr key={k} className={changed ? 'bg-amber-50/40' : ''}>
                          <td className="px-3 py-1.5 font-mono font-semibold text-gray-700">{k}</td>
                          <td className="max-w-xs break-all px-3 py-1.5 text-rose-700">{before}</td>
                          <td className="max-w-xs break-all px-3 py-1.5 text-emerald-700">{after}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-xs text-gray-400">No field-level values were recorded for this event.</p>
            )}

            {detail.user_agent && (
              <p className="break-all text-[11px] text-gray-400">Device: {detail.user_agent}</p>
            )}
          </div>
        )}
      </Modal>
    </AdminLayout>
  );
}
