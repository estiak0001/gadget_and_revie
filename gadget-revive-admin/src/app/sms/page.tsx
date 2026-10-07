'use client';

import React, { useEffect, useState } from 'react';
import { KeyRound, Package, Megaphone, Save, Send, Wallet, RefreshCw, CheckCircle2, XCircle, HelpCircle, Info, Coins } from 'lucide-react';
import { AdminLayout } from '@/components/layout';
import { Button, Input, Select, Badge, LoadingSpinner } from '@/components/ui';
import { KpiTile, Panel } from '@/components/reports/shared';
import SmsLogTable from '@/components/sms/SmsLogTable';
import { getErrorMessage, formatCurrency } from '@/lib/utils';
import adminService from '@/lib/adminService';
import toast from 'react-hot-toast';
import { SmsConnection, SmsCampaign, SmsBalance, SmsUsageStats } from '@/types';

type Tab = 'overview' | 'otp' | 'order' | 'campaigns';

const TABS: { key: Tab; label: string; icon: typeof KeyRound }[] = [
  { key: 'overview', label: 'Overview', icon: Wallet },
  { key: 'otp', label: 'OTP', icon: KeyRound },
  { key: 'order', label: 'Order & billing', icon: Package },
  { key: 'campaigns', label: 'Campaigns', icon: Megaphone },
];

const FIELD = 'w-full rounded-lg border border-gray-300 px-2.5 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500';
const LABEL = 'mb-1 block text-[11px] font-semibold uppercase tracking-wide text-gray-500';
const HINT = 'mt-1 text-[11px] text-gray-500';

export default function SmsCenterPage() {
  const [tab, setTab] = useState<Tab>('overview');
  const [connections, setConnections] = useState<SmsConnection[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchConnections = async () => {
    setIsLoading(true);
    try {
      const res = await adminService.getSmsConnections();
      const payload = res.data?.data as unknown;
      setConnections(Array.isArray(payload) ? (payload as SmsConnection[]) : []);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchConnections(); }, []);

  const activeConnections = connections.filter((c) => c.is_active);

  return (
    <AdminLayout>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2.5">
          <h1 className="text-lg font-bold text-gray-900">SMS Center</h1>
          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-semibold text-gray-600">
            {activeConnections.length} active connection{activeConnections.length === 1 ? '' : 's'}
          </span>
        </div>
        <p className="text-[11px] text-gray-500">
          Connections are set up under <a href="/settings" className="font-semibold text-indigo-600 hover:underline">Settings &gt; SMS</a>.
        </p>
      </div>

      {!isLoading && connections.length === 0 && (
        <div className="mb-3 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <p>
            No SMS connections are set up yet. Add one under <a href="/settings" className="font-semibold underline">Settings &gt; SMS</a> before
            configuring OTP, order, or campaign sending here.
          </p>
        </div>
      )}

      <div className="mb-3 inline-flex rounded-lg border border-gray-200 bg-white p-0.5">
        {TABS.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${tab === t.key ? 'bg-indigo-600 text-white' : 'text-gray-600 hover:bg-gray-50'}`}
            >
              <Icon className="h-3.5 w-3.5" />
              {t.label}
            </button>
          );
        })}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16"><LoadingSpinner size="lg" /></div>
      ) : (
        <>
          {tab === 'overview' && <OverviewPanel connections={connections} />}
          {tab === 'otp' && <PurposeConfigPanel purpose="otp" connections={activeConnections} />}
          {tab === 'order' && <OrderConfigPanel connections={activeConnections} />}
          {tab === 'campaigns' && <CampaignsPanel connections={activeConnections} />}
        </>
      )}
    </AdminLayout>
  );
}

// ---------------------------------------------------------------------------
// Overview — live account balance per connection, plus a spend/volume breakdown
// by purpose (OTP / order / campaign / test) pulled from our own send log.
// ---------------------------------------------------------------------------
function OverviewPanel({ connections }: { connections: SmsConnection[] }) {
  const [balances, setBalances] = useState<Record<number, SmsBalance | 'loading' | 'error'>>({});
  const [stats, setStats] = useState<SmsUsageStats | null>(null);
  const [isLoadingStats, setIsLoadingStats] = useState(true);

  const checkBalance = async (id: number) => {
    setBalances((prev) => ({ ...prev, [id]: 'loading' }));
    try {
      const res = await adminService.getSmsConnectionBalance(id);
      setBalances((prev) => ({ ...prev, [id]: res.data.data as SmsBalance }));
    } catch (err) {
      toast.error(getErrorMessage(err));
      setBalances((prev) => ({ ...prev, [id]: 'error' }));
    }
  };

  const fetchStats = async () => {
    setIsLoadingStats(true);
    try {
      const res = await adminService.getSmsUsageStats();
      setStats(res.data.data as SmsUsageStats);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setIsLoadingStats(false);
    }
  };

  useEffect(() => {
    connections.forEach((c) => checkBalance(c.id));
    fetchStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connections.length]);

  const purposeLabel = (p: string) => ({
    otp: 'OTP', order_placed: 'Order Placed', order_status: 'Order Status', order_delivered: 'Order Delivered',
    custom_invoice: 'Custom Invoice', payment_due: 'Payment Due', campaign: 'Campaigns', test: 'Connection Tests', other: 'Other',
  }[p] || p);

  const anyCostTracked = (stats?.by_purpose ?? []).some((r) => r.total_cost != null && Number(r.total_cost) > 0);
  const spend = stats?.overall.total_cost != null ? formatCurrency(Number(stats.overall.total_cost)) : '—';

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        <KpiTile label="Messages sent" value={(stats?.overall.sent ?? 0).toLocaleString()} tone="emerald" icon={<CheckCircle2 className="h-4 w-4 opacity-60" />} sub="Delivered to the gateway" />
        <KpiTile label="Failed" value={(stats?.overall.failed ?? 0).toLocaleString()} tone="rose" icon={<XCircle className="h-4 w-4 opacity-60" />} sub="Not sent" />
        <KpiTile label="Total attempts" value={(stats?.overall.total ?? 0).toLocaleString()} tone="indigo" sub="All sections" />
        <KpiTile label="Spend" value={spend} tone="amber" icon={<Coins className="h-4 w-4 opacity-60" />} sub={anyCostTracked ? 'From cost lookup' : 'Needs a cost URL'} />
      </div>

      <Panel title="Account balance" hint="Live from each connection's balance URL">
        {connections.length === 0 ? (
          <p className="py-4 text-center text-xs text-gray-500">No connections configured yet.</p>
        ) : (
          <div className="grid grid-cols-1 gap-2 p-3 md:grid-cols-2 lg:grid-cols-3">
            {connections.map((c) => {
              const b = balances[c.id];
              return (
                <div key={c.id} className="rounded-lg border border-gray-200 bg-slate-50/50 p-3">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-semibold text-gray-900">{c.name}</p>
                    <Badge variant={c.is_active ? 'success' : 'default'} className="text-[11px]">{c.is_active ? 'Active' : 'Disabled'}</Badge>
                  </div>

                  {b === 'loading' && <p className="flex items-center gap-2 text-xs text-gray-500"><LoadingSpinner size="sm" />Checking…</p>}

                  {b === 'error' && <p className="flex items-center gap-1.5 text-xs text-rose-600"><XCircle className="h-3.5 w-3.5" />Check failed</p>}

                  {b && b !== 'loading' && b !== 'error' && !b.configured && (
                    <p className="flex items-center gap-1.5 text-xs text-gray-500"><HelpCircle className="h-3.5 w-3.5" />No balance URL set</p>
                  )}

                  {b && b !== 'loading' && b !== 'error' && b.configured && b.ok && (
                    <div>
                      <p className="text-xl font-bold tabular-nums text-gray-900">{b.balance ?? '—'}</p>
                      {b.validity && <p className="mt-0.5 text-[11px] text-gray-500">Valid until {b.validity}</p>}
                      <p className="mt-1 flex items-center gap-1 text-[11px] font-semibold text-emerald-600"><CheckCircle2 className="h-3 w-3" />Live</p>
                    </div>
                  )}

                  {b && b !== 'loading' && b !== 'error' && b.configured && !b.ok && (
                    <div>
                      <p className="flex items-center gap-1.5 text-xs text-rose-600"><XCircle className="h-3.5 w-3.5" />Balance check failed</p>
                      {b.raw && <p className="mt-1 truncate font-mono text-[11px] text-gray-400" title={b.raw}>{b.raw}</p>}
                    </div>
                  )}

                  <Button variant="outline" size="sm" className="mt-3 w-full" onClick={() => checkBalance(c.id)} leftIcon={<RefreshCw className="h-3 w-3" />}>
                    Refresh
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </Panel>

      <Panel
        title="Usage & spend by section"
        right={<Button variant="ghost" size="sm" onClick={fetchStats} leftIcon={<RefreshCw className="h-3 w-3" />}>Refresh</Button>}
      >
        {isLoadingStats ? (
          <div className="flex justify-center py-8"><LoadingSpinner /></div>
        ) : !stats || stats.overall.total === 0 ? (
          <p className="py-8 text-center text-xs text-gray-500">No SMS sent yet.</p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-2 text-left font-semibold">Section</th>
                    <th className="px-4 py-2 text-right font-semibold">Sent</th>
                    <th className="px-4 py-2 text-right font-semibold">Failed</th>
                    <th className="px-4 py-2 text-right font-semibold">Total</th>
                    <th className="px-4 py-2 text-right font-semibold">Spent</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {stats.by_purpose.map((row, i) => (
                    <tr key={row.purpose} className={i % 2 ? 'bg-slate-50/40' : 'bg-white'}>
                      <td className="px-4 py-2 font-semibold text-gray-900">{purposeLabel(row.purpose)}</td>
                      <td className="px-4 py-2 text-right"><Badge variant="success" className="text-[11px]">{row.sent}</Badge></td>
                      <td className="px-4 py-2 text-right">{row.failed > 0 ? <Badge variant="danger" className="text-[11px]">{row.failed}</Badge> : <span className="text-gray-400">0</span>}</td>
                      <td className="px-4 py-2 text-right tabular-nums text-gray-600">{row.total}</td>
                      <td className="px-4 py-2 text-right tabular-nums text-gray-700">{row.total_cost != null ? formatCurrency(Number(row.total_cost)) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="border-t-2 border-gray-300 bg-slate-50 font-bold">
                  <tr>
                    <td className="px-4 py-2">Overall</td>
                    <td className="px-4 py-2 text-right tabular-nums">{stats.overall.sent}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{stats.overall.failed}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{stats.overall.total}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{stats.overall.total_cost != null ? formatCurrency(Number(stats.overall.total_cost)) : '—'}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
            {!anyCostTracked && (
              <p className="border-t border-gray-100 px-4 py-2.5 text-[11px] text-gray-500">
                Spend shows as — until a connection has a report/cost-lookup URL configured
                (Settings &gt; SMS &gt; Edit Connection &gt; Advanced). Without it, only send and fail counts are tracked.
              </p>
            )}
          </>
        )}
      </Panel>
    </div>
  );
}

// ---------------------------------------------------------------------------
// OTP config — one connection, one enabled toggle, one message template.
// ---------------------------------------------------------------------------
function PurposeConfigPanel({ purpose, connections }: { purpose: 'otp'; connections: SmsConnection[] }) {
  const [connectionId, setConnectionId] = useState('');
  const [enabled, setEnabled] = useState(false);
  const [template, setTemplate] = useState('');
  const [resetTemplate, setResetTemplate] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const load = async () => {
    setIsLoading(true);
    try {
      const res = await adminService.getSettings({ group: 'sms_config' });
      const data = (res.data?.data as unknown as Record<string, Record<string, string>>) || {};
      const cfg = data.sms_config || {};
      setConnectionId(cfg.sms_otp_connection_id || '');
      setEnabled(cfg.sms_otp_enabled === 'true');
      setTemplate(cfg.sms_otp_template || 'Your {app} verification code is {otp}. It will expire shortly.');
      setResetTemplate(cfg.sms_password_reset_template || 'Your {app} password reset code is {otp}. It will expire in 5 minutes.');
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await adminService.updateSettings({
        sms_otp_connection_id: connectionId,
        sms_otp_enabled: enabled ? 'true' : 'false',
        sms_otp_template: template,
        sms_password_reset_template: resetTemplate,
      });
      toast.success('OTP SMS configuration saved');
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) return <div className="flex justify-center py-12"><LoadingSpinner /></div>;

  return (
    <div className="space-y-3">
      <Panel
        title="OTP verification & password reset"
        hint="Single on/off switch for OTP on the storefront"
        right={<Button size="sm" onClick={handleSave} isLoading={isSaving} leftIcon={<Save className="h-3.5 w-3.5" />}>Save</Button>}
      >
        <div className="space-y-3 p-4">
          <p className="text-xs text-gray-500">
            Gates both the phone code sent during signup and the code used to reset a forgotten password.
            When off, signup completes immediately without a code, and password reset is unavailable.
          </p>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div className="flex items-end gap-3">
              <div className="flex-1">
                <label className={LABEL}>Connection</label>
                <Select
                  value={connectionId}
                  onChange={(e) => setConnectionId(e.target.value)}
                  options={[{ value: '', label: connections.length ? 'Select a connection…' : 'No active connections' }, ...connections.map((c) => ({ value: String(c.id), label: c.name }))]}
                />
              </div>
            </div>
            <div className="flex items-end">
              <ToggleRow label="Send OTP by SMS" enabled={enabled} onChange={setEnabled} />
            </div>
          </div>

          <div>
            <label className={LABEL}>Registration verification template</label>
            <textarea className={`${FIELD} h-16 resize-none`} value={template} onChange={(e) => setTemplate(e.target.value)} />
            <p className={HINT}>Placeholders: <code>{'{app}'}</code>, <code>{'{otp}'}</code></p>
          </div>

          <div>
            <label className={LABEL}>Password reset template</label>
            <textarea className={`${FIELD} h-16 resize-none`} value={resetTemplate} onChange={(e) => setResetTemplate(e.target.value)} />
            <p className={HINT}>Placeholders: <code>{'{app}'}</code>, <code>{'{otp}'}</code></p>
          </div>
        </div>
      </Panel>

      <SmsLogTable purpose="otp" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Order & Billing config — one connection, one enabled toggle, five templates.
// Only the order-placed SMS is automatic; the rest are sent manually from the order.
// ---------------------------------------------------------------------------
function OrderConfigPanel({ connections }: { connections: SmsConnection[] }) {
  const [connectionId, setConnectionId] = useState('');
  const [enabled, setEnabled] = useState(false);
  const [placedTemplate, setPlacedTemplate] = useState('');
  const [statusTemplate, setStatusTemplate] = useState('');
  const [deliveredTemplate, setDeliveredTemplate] = useState('');
  const [customInvoiceTemplate, setCustomInvoiceTemplate] = useState('');
  const [dueTemplate, setDueTemplate] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const load = async () => {
    setIsLoading(true);
    try {
      const res = await adminService.getSettings({ group: 'sms_config' });
      const data = (res.data?.data as unknown as Record<string, Record<string, string>>) || {};
      const cfg = data.sms_config || {};
      setConnectionId(cfg.sms_order_connection_id || '');
      setEnabled(cfg.sms_order_enabled === 'true');
      setPlacedTemplate(cfg.sms_order_placed_template || "Thank you! Your order #{order} has been placed successfully. We'll notify you as it progresses.");
      setStatusTemplate(cfg.sms_order_status_template || 'Update: your order #{order} is now {status}.');
      setDeliveredTemplate(cfg.sms_order_delivered_template || 'Your {app} order #{order} has been delivered! Download your invoice: {invoice_url} Thank you for shopping with us.');
      setCustomInvoiceTemplate(cfg.sms_custom_invoice_template || 'Your {app} invoice {invoice} — Total: {total}. Thank you!');
      setDueTemplate(cfg.sms_payment_due_template || 'Reminder: your {app} order #{order} has an outstanding balance of {amount}. Invoice: {invoice_url} Please complete payment to proceed.');
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await adminService.updateSettings({
        sms_order_connection_id: connectionId,
        sms_order_enabled: enabled ? 'true' : 'false',
        sms_order_placed_template: placedTemplate,
        sms_order_status_template: statusTemplate,
        sms_order_delivered_template: deliveredTemplate,
        sms_custom_invoice_template: customInvoiceTemplate,
        sms_payment_due_template: dueTemplate,
      });
      toast.success('Order & Billing SMS configuration saved');
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) return <div className="flex justify-center py-12"><LoadingSpinner /></div>;

  return (
    <div className="space-y-3">
      <Panel
        title="Order & billing SMS"
        hint="Only order-placed is automatic; the rest are sent manually from each order"
        right={<Button size="sm" onClick={handleSave} isLoading={isSaving} leftIcon={<Save className="h-3.5 w-3.5" />}>Save</Button>}
      >
        <div className="space-y-3 p-4">
          <p className="text-xs text-gray-500">
            Status, delivery, custom-invoice, and payment-due SMS are each sent from its own button on the order
            or invoice, so nothing texts a customer without an admin deciding to. All of them share this connection and switch.
          </p>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div>
              <label className={LABEL}>Connection</label>
              <Select
                value={connectionId}
                onChange={(e) => setConnectionId(e.target.value)}
                options={[{ value: '', label: connections.length ? 'Select a connection…' : 'No active connections' }, ...connections.map((c) => ({ value: String(c.id), label: c.name }))]}
              />
            </div>
            <div className="flex items-end">
              <ToggleRow label="Send order SMS" enabled={enabled} onChange={setEnabled} />
            </div>
          </div>

          <div>
            <label className={LABEL}>Order placed <span className="font-normal normal-case text-gray-400">(automatic)</span></label>
            <textarea className={`${FIELD} h-14 resize-none`} value={placedTemplate} onChange={(e) => setPlacedTemplate(e.target.value)} />
            <p className={HINT}>Placeholders: <code>{'{order}'}</code></p>
          </div>

          <div>
            <label className={LABEL}>Order status changed <span className="font-normal normal-case text-gray-400">(manual)</span></label>
            <textarea className={`${FIELD} h-14 resize-none`} value={statusTemplate} onChange={(e) => setStatusTemplate(e.target.value)} />
            <p className={HINT}>Placeholders: <code>{'{order}'}</code>, <code>{'{status}'}</code></p>
          </div>

          <div>
            <label className={LABEL}>Order delivered <span className="font-normal normal-case text-gray-400">(manual)</span></label>
            <textarea className={`${FIELD} h-14 resize-none`} value={deliveredTemplate} onChange={(e) => setDeliveredTemplate(e.target.value)} />
            <p className={HINT}>Placeholders: <code>{'{order}'}</code>, <code>{'{app}'}</code>, <code>{'{invoice_url}'}</code> — a public link, no login needed</p>
          </div>

          <div>
            <label className={LABEL}>Custom invoice <span className="font-normal normal-case text-gray-400">(manual)</span></label>
            <textarea className={`${FIELD} h-14 resize-none`} value={customInvoiceTemplate} onChange={(e) => setCustomInvoiceTemplate(e.target.value)} />
            <p className={HINT}>Placeholders: <code>{'{app}'}</code>, <code>{'{invoice}'}</code>, <code>{'{total}'}</code></p>
          </div>

          <div>
            <label className={LABEL}>Payment due <span className="font-normal normal-case text-gray-400">(manual)</span></label>
            <textarea className={`${FIELD} h-14 resize-none`} value={dueTemplate} onChange={(e) => setDueTemplate(e.target.value)} />
            <p className={HINT}>Placeholders: <code>{'{app}'}</code>, <code>{'{order}'}</code>, <code>{'{amount}'}</code>, <code>{'{invoice_url}'}</code> — a public link, no login needed</p>
          </div>
        </div>
      </Panel>

      <SmsLogTable purpose="order_placed,order_status,order_delivered,custom_invoice,payment_due" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Campaigns — compose + send now (synchronous, no queue worker in this deployment),
// plus send history.
// ---------------------------------------------------------------------------
function CampaignsPanel({ connections }: { connections: SmsConnection[] }) {
  const [name, setName] = useState('');
  const [message, setMessage] = useState('');
  const [connectionId, setConnectionId] = useState('');
  const [source, setSource] = useState<'all_customers' | 'manual'>('all_customers');
  const [manualPhones, setManualPhones] = useState('');
  const [customerCount, setCustomerCount] = useState<number | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [campaigns, setCampaigns] = useState<SmsCampaign[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);

  const fetchHistory = async () => {
    setIsLoadingHistory(true);
    try {
      const res = await adminService.getSmsCampaigns({ per_page: 10 });
      const payload = res.data?.data as unknown;
      const list = Array.isArray(payload) ? payload : (payload as { data?: SmsCampaign[] })?.data;
      setCampaigns(Array.isArray(list) ? list : []);
    } catch {
      // silent
    } finally {
      setIsLoadingHistory(false);
    }
  };

  useEffect(() => { fetchHistory(); }, []);

  useEffect(() => {
    if (source !== 'all_customers') return;
    adminService.getSmsCampaignRecipientsCount('all_customers')
      .then((res) => setCustomerCount(res.data?.data?.count ?? null))
      .catch(() => setCustomerCount(null));
  }, [source]);

  const manualPhoneList = manualPhones.split(/[\n,]/).map((p) => p.trim()).filter(Boolean);
  const recipientCount = source === 'all_customers' ? customerCount : manualPhoneList.length;

  const handleSend = async () => {
    if (!name.trim() || !message.trim() || !connectionId) {
      toast.error('Name, message, and connection are all required');
      return;
    }
    if (source === 'manual' && manualPhoneList.length === 0) {
      toast.error('Enter at least one phone number');
      return;
    }
    if (!confirm(`Send this SMS to ${recipientCount ?? 'all'} recipient(s) now? This can't be undone.`)) return;

    setIsSending(true);
    try {
      const res = await adminService.createSmsCampaign({
        name: name.trim(),
        message: message.trim(),
        connection_id: Number(connectionId),
        recipient_source: source,
        ...(source === 'manual' ? { phones: manualPhoneList } : {}),
      });
      const campaign = res.data?.data;
      toast.success(`Campaign sent: ${campaign?.sent_count ?? 0} delivered, ${campaign?.failed_count ?? 0} failed.`);
      setName('');
      setMessage('');
      setManualPhones('');
      fetchHistory();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="space-y-3">
      <Panel
        title="New campaign"
        hint="Sends immediately, capped at 500 recipients per send"
        right={<Button size="sm" onClick={handleSend} isLoading={isSending} leftIcon={<Send className="h-3.5 w-3.5" />}>Send now</Button>}
      >
        <div className="space-y-3 p-4">
          <p className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-[11px] text-gray-500">
            No background queue runs in this deployment, so a very large send would time out the request instead of
            queuing. For bigger audiences, send in smaller batches.
          </p>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div>
              <label className={LABEL}>Campaign name</label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Eid sale announcement" />
            </div>
            <div>
              <label className={LABEL}>Connection</label>
              <Select
                value={connectionId}
                onChange={(e) => setConnectionId(e.target.value)}
                options={[{ value: '', label: connections.length ? 'Select a connection…' : 'No active connections' }, ...connections.map((c) => ({ value: String(c.id), label: c.name }))]}
              />
            </div>
          </div>

          <div>
            <label className={LABEL}>Message</label>
            <textarea
              className={`${FIELD} h-20 resize-none`}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              maxLength={500}
            />
            <p className={HINT}>{message.length}/500 characters</p>
          </div>

          <div>
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <label className={LABEL + ' mb-0'}>Recipients</label>
              <div className="inline-flex rounded-lg border border-gray-200 bg-white p-0.5">
                <button
                  type="button"
                  onClick={() => setSource('all_customers')}
                  className={`rounded-md px-2.5 py-1 text-xs font-semibold transition-colors ${source === 'all_customers' ? 'bg-indigo-600 text-white' : 'text-gray-600 hover:bg-gray-50'}`}
                >
                  All customers
                </button>
                <button
                  type="button"
                  onClick={() => setSource('manual')}
                  className={`rounded-md px-2.5 py-1 text-xs font-semibold transition-colors ${source === 'manual' ? 'bg-indigo-600 text-white' : 'text-gray-600 hover:bg-gray-50'}`}
                >
                  Manual list
                </button>
              </div>
            </div>

            {source === 'manual' ? (
              <textarea
                className={`${FIELD} h-20 resize-none font-mono`}
                value={manualPhones}
                onChange={(e) => setManualPhones(e.target.value)}
                placeholder={'One number per line, or comma-separated\ne.g. 01712345678\n01812345678'}
              />
            ) : null}

            <p className="mt-2 text-xs font-semibold text-gray-700">
              {recipientCount === null ? 'Loading recipient count…' : `${recipientCount} recipient(s)`}
            </p>
          </div>
        </div>
      </Panel>

      <Panel title="Campaign history" hint="Last 10 sends">
        {isLoadingHistory ? (
          <div className="flex justify-center py-8"><LoadingSpinner /></div>
        ) : campaigns.length === 0 ? (
          <p className="py-8 text-center text-xs text-gray-500">No campaigns sent yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-2 text-left font-semibold">Name</th>
                  <th className="px-4 py-2 text-left font-semibold">Connection</th>
                  <th className="px-4 py-2 text-right font-semibold">Recipients</th>
                  <th className="px-4 py-2 text-right font-semibold">Sent</th>
                  <th className="px-4 py-2 text-right font-semibold">Failed</th>
                  <th className="px-4 py-2 text-left font-semibold">When</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {campaigns.map((c, i) => (
                  <tr key={c.id} className={i % 2 ? 'bg-slate-50/40' : 'bg-white'}>
                    <td className="px-4 py-2 font-semibold text-gray-900">{c.name}</td>
                    <td className="px-4 py-2 text-gray-600">{c.connection?.name || '—'}</td>
                    <td className="px-4 py-2 text-right tabular-nums text-gray-600">{c.recipient_count}</td>
                    <td className="px-4 py-2 text-right"><Badge variant="success" className="text-[11px]">{c.sent_count}</Badge></td>
                    <td className="px-4 py-2 text-right">{c.failed_count > 0 ? <Badge variant="danger" className="text-[11px]">{c.failed_count}</Badge> : <span className="text-gray-400">0</span>}</td>
                    <td className="whitespace-nowrap px-4 py-2 text-xs tabular-nums text-gray-500">{new Date(c.created_at).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <SmsLogTable purpose="campaign" />
    </div>
  );
}

function ToggleRow({ label, enabled, onChange }: { label: string; enabled: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex h-9 items-center gap-2.5">
      <button
        type="button"
        onClick={() => onChange(!enabled)}
        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${enabled ? 'bg-indigo-600' : 'bg-gray-200'}`}
      >
        <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${enabled ? 'translate-x-[18px]' : 'translate-x-0.5'}`} />
      </button>
      <span className="text-xs font-semibold text-gray-700">{label}</span>
      <span className={`text-[11px] font-semibold ${enabled ? 'text-emerald-600' : 'text-gray-400'}`}>{enabled ? 'On' : 'Off'}</span>
    </div>
  );
}
