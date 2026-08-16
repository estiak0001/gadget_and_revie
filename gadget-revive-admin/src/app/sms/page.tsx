'use client';

import React, { useEffect, useState } from 'react';
import { MessageSquare, KeyRound, Package, Megaphone, Save, Send, Info, Wallet, RefreshCw, CheckCircle2, XCircle, HelpCircle } from 'lucide-react';
import { AdminLayout } from '@/components/layout';
import {
  Card, CardContent, CardHeader, CardTitle, Button, Input, Select, Badge, LoadingSpinner,
} from '@/components/ui';
import SmsLogTable from '@/components/sms/SmsLogTable';
import { getErrorMessage, formatCurrency } from '@/lib/utils';
import adminService from '@/lib/adminService';
import toast from 'react-hot-toast';
import { SmsConnection, SmsCampaign, SmsBalance, SmsUsageStats } from '@/types';

type Tab = 'overview' | 'otp' | 'order' | 'campaigns';

const TABS: { key: Tab; label: string; icon: typeof KeyRound }[] = [
  { key: 'overview', label: 'Overview', icon: Wallet },
  { key: 'otp', label: 'OTP', icon: KeyRound },
  { key: 'order', label: 'Order & Billing', icon: Package },
  { key: 'campaigns', label: 'Campaigns', icon: Megaphone },
];

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
      <div className="page-header">
        <div className="flex items-center gap-2">
          <h1 className="page-title">SMS Center</h1>
        </div>
        <p className="page-description">
          Configure OTP verification, order &amp; billing notifications, and send SMS campaigns.
          Connections themselves are built and tested under{' '}
          <a href="/settings" className="text-primary-600 hover:underline">Settings &gt; SMS</a>.
        </p>
      </div>

      {!isLoading && connections.length === 0 && (
        <Card className="mb-6 border-amber-200 bg-amber-50">
          <CardContent className="py-4 flex items-start gap-3">
            <Info className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <p className="text-sm text-amber-800">
              No SMS connections are set up yet. Add one under{' '}
              <a href="/settings" className="underline font-medium">Settings &gt; SMS</a> before
              configuring OTP, order, or campaign sending here.
            </p>
          </CardContent>
        </Card>
      )}

      <div className="inline-flex rounded-lg border border-gray-200 bg-white p-1 shadow-sm mb-6">
        {TABS.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${tab === t.key ? 'bg-primary-600 text-white' : 'text-gray-600 hover:bg-gray-50'}`}
            >
              <Icon className="w-4 h-4" />
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

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-sm font-semibold text-gray-700 mb-3">Account Balance</h2>
        {connections.length === 0 ? (
          <p className="text-sm text-gray-500">No connections configured yet.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {connections.map((c) => {
              const b = balances[c.id];
              return (
                <Card key={c.id}>
                  <CardContent className="py-4">
                    <div className="flex items-center justify-between mb-2">
                      <p className="font-medium text-gray-900 truncate">{c.name}</p>
                      <Badge variant={c.is_active ? 'success' : 'default'} className="text-xs">{c.is_active ? 'Active' : 'Disabled'}</Badge>
                    </div>

                    {b === 'loading' && <div className="flex items-center gap-2 text-sm text-gray-400"><LoadingSpinner size="sm" />Checking...</div>}

                    {b === 'error' && (
                      <p className="text-sm text-red-600 flex items-center gap-1.5"><XCircle className="w-4 h-4" />Check failed</p>
                    )}

                    {b && b !== 'loading' && b !== 'error' && !b.configured && (
                      <p className="text-sm text-gray-400 flex items-center gap-1.5"><HelpCircle className="w-4 h-4" />No balance URL set for this connection</p>
                    )}

                    {b && b !== 'loading' && b !== 'error' && b.configured && b.ok && (
                      <div>
                        <p className="text-2xl font-bold text-gray-900">{b.balance ?? '—'}</p>
                        {b.validity && <p className="text-xs text-gray-500 mt-0.5">Valid until {b.validity}</p>}
                        <p className="text-xs text-green-600 flex items-center gap-1 mt-1"><CheckCircle2 className="w-3.5 h-3.5" />Live</p>
                      </div>
                    )}

                    {b && b !== 'loading' && b !== 'error' && b.configured && !b.ok && (
                      <div>
                        <p className="text-sm text-red-600 flex items-center gap-1.5"><XCircle className="w-4 h-4" />Balance check failed</p>
                        {b.raw && <p className="text-xs text-gray-400 font-mono mt-1 truncate" title={b.raw}>{b.raw}</p>}
                      </div>
                    )}

                    <Button variant="outline" size="sm" className="mt-3 w-full" onClick={() => checkBalance(c.id)} leftIcon={<RefreshCw className="w-3.5 h-3.5" />}>
                      Refresh
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Usage &amp; Spend by Section</CardTitle>
          <Button variant="ghost" size="sm" onClick={fetchStats} leftIcon={<RefreshCw className="w-3.5 h-3.5" />}>Refresh</Button>
        </CardHeader>
        <CardContent className="p-0">
          {isLoadingStats ? (
            <div className="flex justify-center py-8"><LoadingSpinner /></div>
          ) : !stats || stats.overall.total === 0 ? (
            <p className="text-sm text-gray-500 text-center py-8">No SMS sent yet.</p>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-y">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Section</th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Sent</th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Failed</th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Total</th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Spent</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {stats.by_purpose.map((row) => (
                      <tr key={row.purpose}>
                        <td className="px-4 py-2.5 font-medium text-gray-900">{purposeLabel(row.purpose)}</td>
                        <td className="px-4 py-2.5 text-right"><Badge variant="success" className="text-xs">{row.sent}</Badge></td>
                        <td className="px-4 py-2.5 text-right">{row.failed > 0 ? <Badge variant="danger" className="text-xs">{row.failed}</Badge> : <span className="text-gray-400">0</span>}</td>
                        <td className="px-4 py-2.5 text-right text-gray-600">{row.total}</td>
                        <td className="px-4 py-2.5 text-right text-gray-700">{row.total_cost != null ? formatCurrency(Number(row.total_cost)) : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-gray-50 border-t">
                    <tr>
                      <td className="px-4 py-2.5 font-semibold text-gray-900">Overall</td>
                      <td className="px-4 py-2.5 text-right font-semibold">{stats.overall.sent}</td>
                      <td className="px-4 py-2.5 text-right font-semibold">{stats.overall.failed}</td>
                      <td className="px-4 py-2.5 text-right font-semibold">{stats.overall.total}</td>
                      <td className="px-4 py-2.5 text-right font-semibold">{stats.overall.total_cost != null ? formatCurrency(Number(stats.overall.total_cost)) : '—'}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
              {!anyCostTracked && (
                <p className="text-xs text-gray-400 px-4 py-3 border-t">
                  Spend shows as — until a connection has a report/cost-lookup URL configured
                  (Settings &gt; SMS &gt; Edit Connection &gt; Advanced) — without it, only
                  send/fail counts are tracked, not per-message cost.
                </p>
              )}
            </>
          )}
        </CardContent>
      </Card>
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
    <div className="space-y-6">
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><KeyRound className="w-5 h-5" />OTP Verification &amp; Password Reset SMS</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-gray-500">
            This is the single on/off switch for OTP on the storefront — it gates both the phone
            verification code sent during signup and the code used to reset a forgotten password.
            When off, signup completes immediately without a code, and password reset is
            unavailable.
          </p>

          <ToggleRow label="Send OTP by SMS (registration &amp; password reset)" enabled={enabled} onChange={setEnabled} />

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Connection</label>
            <Select
              value={connectionId}
              onChange={(e) => setConnectionId(e.target.value)}
              options={[{ value: '', label: connections.length ? 'Select a connection...' : 'No active connections available' }, ...connections.map((c) => ({ value: String(c.id), label: c.name }))]}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Registration Verification Template</label>
            <textarea
              className="w-full border border-gray-300 rounded-lg p-2.5 h-20 resize-none text-sm"
              value={template}
              onChange={(e) => setTemplate(e.target.value)}
            />
            <p className="text-xs text-gray-500 mt-1">Placeholders: <code>{'{app}'}</code>, <code>{'{otp}'}</code></p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password Reset Template</label>
            <textarea
              className="w-full border border-gray-300 rounded-lg p-2.5 h-20 resize-none text-sm"
              value={resetTemplate}
              onChange={(e) => setResetTemplate(e.target.value)}
            />
            <p className="text-xs text-gray-500 mt-1">Placeholders: <code>{'{app}'}</code>, <code>{'{otp}'}</code></p>
          </div>

          <div className="flex justify-end">
            <Button onClick={handleSave} isLoading={isSaving} leftIcon={<Save className="w-4 h-4" />}>Save</Button>
          </div>
        </CardContent>
      </Card>

      <SmsLogTable purpose="otp" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Order & Billing config — one connection, one enabled toggle, two templates
// (order placed / order status changed).
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
      setDeliveredTemplate(cfg.sms_order_delivered_template || 'Your order #{order} has been delivered. Thank you for shopping with {app}!');
      setCustomInvoiceTemplate(cfg.sms_custom_invoice_template || 'Your {app} invoice {invoice} — Total: {total}. Thank you!');
      setDueTemplate(cfg.sms_payment_due_template || 'Your {app} order #{order} has an outstanding balance of {amount}. Please complete payment to proceed.');
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
    <div className="space-y-6">
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Package className="w-5 h-5" />Order &amp; Billing SMS</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-gray-500">
            Only the very first SMS — order placed — is automatic. Status, delivery, custom-invoice,
            and payment-due SMS are always sent manually, each from its own button on the order
            (or invoice), so nothing texts a customer without an admin deciding to. All four share
            this one connection and on/off switch, with their own templates below.
          </p>

          <ToggleRow label="Send order SMS" enabled={enabled} onChange={setEnabled} />

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Connection</label>
            <Select
              value={connectionId}
              onChange={(e) => setConnectionId(e.target.value)}
              options={[{ value: '', label: connections.length ? 'Select a connection...' : 'No active connections available' }, ...connections.map((c) => ({ value: String(c.id), label: c.name }))]}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Order Placed Template <span className="text-gray-400 font-normal">(automatic)</span></label>
            <textarea className="w-full border border-gray-300 rounded-lg p-2.5 h-20 resize-none text-sm" value={placedTemplate} onChange={(e) => setPlacedTemplate(e.target.value)} />
            <p className="text-xs text-gray-500 mt-1">Placeholders: <code>{'{order}'}</code></p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Order Status Changed Template <span className="text-gray-400 font-normal">(sent manually)</span></label>
            <textarea className="w-full border border-gray-300 rounded-lg p-2.5 h-20 resize-none text-sm" value={statusTemplate} onChange={(e) => setStatusTemplate(e.target.value)} />
            <p className="text-xs text-gray-500 mt-1">Placeholders: <code>{'{order}'}</code>, <code>{'{status}'}</code></p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Order Delivered Template <span className="text-gray-400 font-normal">(sent manually)</span></label>
            <textarea className="w-full border border-gray-300 rounded-lg p-2.5 h-20 resize-none text-sm" value={deliveredTemplate} onChange={(e) => setDeliveredTemplate(e.target.value)} />
            <p className="text-xs text-gray-500 mt-1">Placeholders: <code>{'{order}'}</code>, <code>{'{app}'}</code></p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Custom Invoice Template <span className="text-gray-400 font-normal">(sent manually)</span></label>
            <textarea className="w-full border border-gray-300 rounded-lg p-2.5 h-20 resize-none text-sm" value={customInvoiceTemplate} onChange={(e) => setCustomInvoiceTemplate(e.target.value)} />
            <p className="text-xs text-gray-500 mt-1">Placeholders: <code>{'{app}'}</code>, <code>{'{invoice}'}</code>, <code>{'{total}'}</code></p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Payment Due Template <span className="text-gray-400 font-normal">(sent manually)</span></label>
            <textarea className="w-full border border-gray-300 rounded-lg p-2.5 h-20 resize-none text-sm" value={dueTemplate} onChange={(e) => setDueTemplate(e.target.value)} />
            <p className="text-xs text-gray-500 mt-1">Placeholders: <code>{'{app}'}</code>, <code>{'{order}'}</code>, <code>{'{amount}'}</code></p>
          </div>

          <div className="flex justify-end">
            <Button onClick={handleSave} isLoading={isSaving} leftIcon={<Save className="w-4 h-4" />}>Save</Button>
          </div>
        </CardContent>
      </Card>

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
    <div className="space-y-6">
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Megaphone className="w-5 h-5" />New Campaign</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <p className="text-xs text-gray-500 bg-gray-50 border border-gray-200 rounded-lg p-3">
            Sends immediately and synchronously (capped at 500 recipients per send — there&apos;s no
            background queue running, so a very large send would just time out the request instead
            of queuing). For bigger audiences, send in smaller batches.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Campaign Name</label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Eid Sale Announcement" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Connection</label>
              <Select
                value={connectionId}
                onChange={(e) => setConnectionId(e.target.value)}
                options={[{ value: '', label: connections.length ? 'Select a connection...' : 'No active connections available' }, ...connections.map((c) => ({ value: String(c.id), label: c.name }))]}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Message</label>
            <textarea
              className="w-full border border-gray-300 rounded-lg p-2.5 h-24 resize-none text-sm"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              maxLength={500}
            />
            <p className="text-xs text-gray-400 mt-1">{message.length}/500</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Recipients</label>
            <div className="flex gap-2 mb-3">
              <button
                type="button"
                onClick={() => setSource('all_customers')}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${source === 'all_customers' ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
              >
                All Customers
              </button>
              <button
                type="button"
                onClick={() => setSource('manual')}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${source === 'manual' ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
              >
                Manual List
              </button>
            </div>

            {source === 'manual' ? (
              <textarea
                className="w-full border border-gray-300 rounded-lg p-2.5 h-24 resize-none text-sm font-mono"
                value={manualPhones}
                onChange={(e) => setManualPhones(e.target.value)}
                placeholder={'One number per line, or comma-separated\ne.g. 01712345678\n01812345678'}
              />
            ) : null}

            <p className="text-sm text-gray-500 mt-2">
              {recipientCount === null ? 'Loading recipient count...' : `${recipientCount} recipient(s)`}
            </p>
          </div>

          <div className="flex justify-end">
            <Button onClick={handleSend} isLoading={isSending} leftIcon={<Send className="w-4 h-4" />}>Send Campaign Now</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Campaign History</CardTitle></CardHeader>
        <CardContent className="p-0">
          {isLoadingHistory ? (
            <div className="flex justify-center py-8"><LoadingSpinner /></div>
          ) : campaigns.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-8">No campaigns sent yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-y">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Connection</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Recipients</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Sent</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Failed</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">When</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {campaigns.map((c) => (
                    <tr key={c.id}>
                      <td className="px-4 py-2.5 font-medium text-gray-900">{c.name}</td>
                      <td className="px-4 py-2.5 text-gray-600">{c.connection?.name || '—'}</td>
                      <td className="px-4 py-2.5 text-right text-gray-600">{c.recipient_count}</td>
                      <td className="px-4 py-2.5 text-right"><Badge variant="success" className="text-xs">{c.sent_count}</Badge></td>
                      <td className="px-4 py-2.5 text-right">{c.failed_count > 0 ? <Badge variant="danger" className="text-xs">{c.failed_count}</Badge> : <span className="text-gray-400">0</span>}</td>
                      <td className="px-4 py-2.5 text-gray-500 whitespace-nowrap">{new Date(c.created_at).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <SmsLogTable purpose="campaign" />
    </div>
  );
}

function ToggleRow({ label, enabled, onChange }: { label: string; enabled: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={() => onChange(!enabled)}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${enabled ? 'bg-primary-600' : 'bg-gray-200'}`}
      >
        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${enabled ? 'translate-x-6' : 'translate-x-1'}`} />
      </button>
      <span className="text-sm text-gray-700">{label}</span>
      <span className="text-sm text-gray-400">{enabled ? 'Enabled' : 'Disabled'}</span>
    </div>
  );
}
