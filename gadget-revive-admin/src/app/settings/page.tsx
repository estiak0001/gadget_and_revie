'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Settings as SettingsIcon, Save, RefreshCw, Globe, Mail, CreditCard, Bell, Shield, Server, AlertCircle, DollarSign, Share2, Search as SearchIcon, Building2, ToggleLeft, Upload, X, MessageSquare, Send, Eye, EyeOff, Plus } from 'lucide-react';
import { AdminLayout } from '@/components/layout';
import {
  Card, CardContent, CardHeader, CardTitle, Button, Input, Textarea, Select,
  Badge, LoadingSpinner, ErrorState,
} from '@/components/ui';
import { getErrorMessage } from '@/lib/utils';
import adminService from '@/lib/adminService';
import toast from 'react-hot-toast';
import { SmsConnection } from '@/types';
import SmsLogTable from '@/components/sms/SmsLogTable';

const ASSET_BASE_URL = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api').replace(/\/api$/, '');

function resolveAssetUrl(value: string): string {
  if (!value) return '';
  if (value.startsWith('http://') || value.startsWith('https://')) return value;
  if (value.startsWith('/')) return value;
  return `${ASSET_BASE_URL}/storage/${value.replace(/^storage\//, '')}`;
}

function isImageKey(key: string): boolean {
  return /_(logo|favicon|icon|image)$/.test(key);
}

interface SettingsData {
  general?: Record<string, string>;
  contact?: Record<string, string>;
  email?: Record<string, string>;
  payment?: Record<string, string>;
  business?: Record<string, string>;
  features?: Record<string, string>;
  seo?: Record<string, string>;
  social?: Record<string, string>;
  sms?: Record<string, string>;
}

const SETTING_GROUPS = [
  { key: 'general', label: 'General', icon: Globe, color: 'text-blue-600 bg-blue-100' },
  { key: 'contact', label: 'Contact', icon: Building2, color: 'text-indigo-600 bg-indigo-100' },
  { key: 'email', label: 'Email', icon: Mail, color: 'text-green-600 bg-green-100' },
  { key: 'sms', label: 'SMS', icon: MessageSquare, color: 'text-teal-600 bg-teal-100' },
  { key: 'payment', label: 'Payment', icon: CreditCard, color: 'text-purple-600 bg-purple-100' },
  { key: 'business', label: 'Business', icon: DollarSign, color: 'text-emerald-600 bg-emerald-100' },
  { key: 'features', label: 'Features', icon: ToggleLeft, color: 'text-amber-600 bg-amber-100' },
  { key: 'seo', label: 'SEO', icon: SearchIcon, color: 'text-pink-600 bg-pink-100' },
  { key: 'social', label: 'Social Media', icon: Share2, color: 'text-blue-600 bg-blue-100' },
];

// Keys whose value should render as a masked/password-style field with a show/hide toggle,
// written generically by suffix in case a future non-SMS setting (a webhook secret, another
// provider key) needs the same treatment.
function isSecretKey(key: string): boolean {
  return /_(api_key|secret|token)$/.test(key);
}

// Format setting key to readable label
const formatLabel = (key: string): string => {
  return key
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

// Determine input type based on key name and value
const getInputType = (key: string, value: string): 'text' | 'email' | 'number' | 'textarea' | 'boolean' | 'url' | 'json' => {
  if (key.includes('enabled') || key.includes('mode') || value === 'true' || value === 'false') {
    return 'boolean';
  }
  if (key.includes('email')) return 'email';
  if (key.includes('url')) return 'url';
  if (key.includes('description') || key.includes('keywords') || key.includes('details')) return 'textarea';
  if (key.includes('rate') || key.includes('amount') || key.includes('hours') || key.includes('days')) return 'number';
  if (value.startsWith('{') || value.startsWith('[')) return 'json';
  return 'text';
};

export default function SettingsPage() {
  const [settings, setSettings] = useState<SettingsData>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);
  const [activeGroup, setActiveGroup] = useState('general');
  const [editedValues, setEditedValues] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [visibleSecrets, setVisibleSecrets] = useState<Record<string, boolean>>({});

  const fetchSettings = async () => {
    setIsLoading(true);
    setError(false);
    try {
      const response = await adminService.getSettings();
      const data = response.data?.data || response.data;
      setSettings(data as SettingsData);
    } catch (err) {
      toast.error(getErrorMessage(err));
      setError(true);
      setSettings({});
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchSettings(); }, []);

  const handleValueChange = (key: string, value: string) => {
    setEditedValues(prev => ({ ...prev, [key]: value }));
  };

  const hasUnsavedChanges = Object.keys(editedValues).length > 0;

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await adminService.updateSettings(editedValues);
      toast.success('Settings saved successfully');
      setEditedValues({});
      fetchSettings();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => { setEditedValues({}); };

  const currentGroupSettings = settings[activeGroup as keyof SettingsData] || {};
  const getValue = (key: string, originalValue: string) => 
    editedValues[key] !== undefined ? editedValues[key] : originalValue;

  const renderSettingInput = (key: string, value: string) => {
    const currentValue = getValue(key, value);
    const isEdited = editedValues[key] !== undefined;
    const inputType = getInputType(key, value);

    const inputClasses = `w-full border rounded-lg p-2.5 ${isEdited ? 'border-yellow-400 bg-yellow-50' : 'border-gray-300'}`;

    if (isImageKey(key)) {
      return (
        <ImageUploadField
          currentValue={currentValue}
          isEdited={isEdited}
          isFavicon={key.endsWith('_favicon')}
          onChange={(val) => handleValueChange(key, val)}
        />
      );
    }

    if (isSecretKey(key)) {
      const shown = !!visibleSecrets[key];
      return (
        <div>
          <div className="relative">
            <Input
              type={shown ? 'text' : 'password'}
              className={`pr-10 ${isEdited ? 'border-yellow-400 bg-yellow-50' : ''}`}
              value={currentValue}
              onChange={(e) => handleValueChange(key, e.target.value)}
              autoComplete="off"
            />
            <button
              type="button"
              onClick={() => setVisibleSecrets((prev) => ({ ...prev, [key]: !prev[key] }))}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              tabIndex={-1}
            >
              {shown ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          {isEdited && <span className="text-xs text-yellow-600 mt-1 block">Modified</span>}
        </div>
      );
    }

    switch (inputType) {
      case 'boolean':
        const boolValue = currentValue === 'true' || currentValue === '1';
        return (
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => handleValueChange(key, boolValue ? 'false' : 'true')}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                boolValue ? 'bg-primary-600' : 'bg-gray-200'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  boolValue ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
            <span className="text-sm text-gray-600">{boolValue ? 'Enabled' : 'Disabled'}</span>
            {isEdited && <Badge variant="warning" className="text-xs">Modified</Badge>}
          </div>
        );
      
      case 'textarea':
        return (
          <div>
            <textarea
              className={inputClasses + ' h-24 resize-none'}
              value={currentValue}
              onChange={(e) => handleValueChange(key, e.target.value)}
            />
            {isEdited && <span className="text-xs text-yellow-600 mt-1 block">Modified</span>}
          </div>
        );
      
      case 'json':
        return (
          <div>
            <textarea
              className={inputClasses + ' h-32 resize-none font-mono text-xs'}
              value={currentValue}
              onChange={(e) => handleValueChange(key, e.target.value)}
              placeholder="Valid JSON format"
            />
            {isEdited && <span className="text-xs text-yellow-600 mt-1 block">Modified</span>}
          </div>
        );
      
      case 'number':
        return (
          <div>
            <Input
              type="number"
              className={isEdited ? 'border-yellow-400 bg-yellow-50' : ''}
              value={currentValue}
              onChange={(e) => handleValueChange(key, e.target.value)}
            />
            {isEdited && <span className="text-xs text-yellow-600 mt-1 block">Modified</span>}
          </div>
        );
      
      case 'email':
        return (
          <div>
            <Input
              type="email"
              className={isEdited ? 'border-yellow-400 bg-yellow-50' : ''}
              value={currentValue}
              onChange={(e) => handleValueChange(key, e.target.value)}
            />
            {isEdited && <span className="text-xs text-yellow-600 mt-1 block">Modified</span>}
          </div>
        );
      
      case 'url':
        return (
          <div>
            <Input
              type="url"
              className={isEdited ? 'border-yellow-400 bg-yellow-50' : ''}
              value={currentValue}
              onChange={(e) => handleValueChange(key, e.target.value)}
              placeholder="https://..."
            />
            {isEdited && <span className="text-xs text-yellow-600 mt-1 block">Modified</span>}
          </div>
        );
      
      default:
        return (
          <div>
            <Input
              type="text"
              className={isEdited ? 'border-yellow-400 bg-yellow-50' : ''}
              value={currentValue}
              onChange={(e) => handleValueChange(key, e.target.value)}
            />
            {isEdited && <span className="text-xs text-yellow-600 mt-1 block">Modified</span>}
          </div>
        );
    }
  };

  if (error && Object.keys(settings).length === 0) {
    return (<AdminLayout><ErrorState title="Failed to load settings" onRetry={fetchSettings} /></AdminLayout>);
  }

  return (
    <AdminLayout>
      <div className="page-header flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div><h1 className="page-title">Settings</h1><p className="page-description">Manage application configuration</p></div>
        {hasUnsavedChanges && (
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-yellow-600"><AlertCircle className="w-4 h-4" /><span className="text-sm">{Object.keys(editedValues).length} unsaved change(s)</span></div>
            <Button variant="outline" onClick={handleReset}><RefreshCw className="w-4 h-4 mr-2" />Reset</Button>
            <Button onClick={handleSave} isLoading={isSaving}><Save className="w-4 h-4 mr-2" />Save Changes</Button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {/* Sidebar */}
        <div className="md:col-span-1">
          <Card>
            <CardContent className="p-2">
              <nav className="space-y-1">
                {SETTING_GROUPS.map(group => {
                  const Icon = group.icon;
                  const groupData = settings[group.key as keyof SettingsData] || {};
                  const count = Object.keys(groupData).length;
                  return (
                    <button key={group.key} onClick={() => setActiveGroup(group.key)} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors ${activeGroup === group.key ? 'bg-primary-100 text-primary-600' : 'text-gray-600 hover:bg-gray-100'}`}>
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${group.color}`}><Icon className="w-4 h-4" /></div>
                      <div className="flex-1"><p className="text-sm font-medium">{group.label}</p></div>
                      {/* SMS is a connections resource now, not flat key-value settings — no
                          meaningful "field count" to show for that tab. */}
                      {group.key !== 'sms' && <Badge variant="default" className="text-xs">{count}</Badge>}
                    </button>
                  );
                })}
              </nav>
            </CardContent>
          </Card>
        </div>

        {/* Settings Content */}
        <div className="md:col-span-3">
          {activeGroup === 'sms' ? (
            <SmsConnectionsManager />
          ) : (
            <Card>
              <CardHeader>
                <div className="flex items-center gap-3">
                  {(() => { const G = SETTING_GROUPS.find(g => g.key === activeGroup); const GI = G!.icon; return (<div className={`w-10 h-10 rounded-lg flex items-center justify-center ${G!.color}`}><GI className="w-5 h-5" /></div>); })()}
                  <CardTitle>{SETTING_GROUPS.find(g => g.key === activeGroup)?.label} Settings</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="flex items-center justify-center h-48"><LoadingSpinner size="lg" text="Loading settings..." /></div>
                ) : Object.keys(currentGroupSettings).length === 0 ? (
                  <div className="text-center py-12"><SettingsIcon className="w-12 h-12 text-gray-300 mx-auto mb-3" /><p className="text-gray-500">No settings available in this group</p></div>
                ) : (
                  <div className="space-y-6">
                    {Object.entries(currentGroupSettings).map(([key, value]) => (
                      <div key={key} className="border-b pb-5 last:border-0">
                        <div className="flex flex-col md:flex-row md:items-start gap-4">
                          <div className="md:w-1/3">
                            <label className="block text-sm font-medium text-gray-700 mb-1">{formatLabel(key)}</label>
                            <p className="text-xs text-gray-400 font-mono">{key}</p>
                          </div>
                          <div className="md:w-2/3">{renderSettingInput(key, value)}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}

type ConnectionDraft = {
  id?: number;
  name: string;
  provider_name: string;
  api_url: string;
  balance_url: string;
  report_url: string;
  method: 'GET' | 'POST';
  api_key: string;
  sender_id: string;
  phone_format: 'as_is' | 'bd_880';
  is_active: boolean;
};

const BLANK_CONNECTION: ConnectionDraft = {
  name: '', provider_name: '', api_url: '', balance_url: '', report_url: '', method: 'GET', api_key: '', sender_id: '', phone_format: 'as_is', is_active: true,
};

/** Settings > SMS — build & test connections only. Which connection each purpose (OTP, order
 *  updates, campaigns) actually uses lives on the dedicated SMS Center page (/sms) instead. */
function SmsConnectionsManager() {
  const [connections, setConnections] = useState<SmsConnection[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editing, setEditing] = useState<ConnectionDraft | null>(null);
  const [isSaving, setIsSaving] = useState(false);

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

  const openNew = () => setEditing({ ...BLANK_CONNECTION });
  const openEdit = (c: SmsConnection) => setEditing({
    id: c.id, name: c.name, provider_name: c.provider_name || '', api_url: c.api_url,
    balance_url: c.balance_url || '', report_url: c.report_url || '', method: c.method,
    api_key: c.api_key || '', sender_id: c.sender_id || '', phone_format: c.phone_format, is_active: c.is_active,
  });

  const handleSave = async () => {
    if (!editing) return;
    if (!editing.name.trim() || !editing.api_url.trim()) { toast.error('Name and API URL are required'); return; }
    setIsSaving(true);
    try {
      if (editing.id) {
        await adminService.updateSmsConnection(editing.id, editing);
        toast.success('Connection updated');
      } else {
        await adminService.createSmsConnection(editing);
        toast.success('Connection created');
      }
      setEditing(null);
      fetchConnections();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (c: SmsConnection) => {
    if (!confirm(`Delete connection "${c.name}"? This can't be undone.`)) return;
    try {
      await adminService.deleteSmsConnection(c.id);
      toast.success('Connection deleted');
      fetchConnections();
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2"><MessageSquare className="w-5 h-5" />SMS Connections</CardTitle>
            <p className="text-sm text-gray-500 mt-1">
              Build and test gateway connections here. Assigning one to OTP, order updates, or
              campaigns happens on the <a href="/sms" className="text-primary-600 hover:underline">SMS Center</a> page.
            </p>
          </div>
          <Button onClick={openNew} leftIcon={<Plus className="w-4 h-4" />}>Add Connection</Button>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex justify-center py-10"><LoadingSpinner /></div>
          ) : connections.length === 0 ? (
            <div className="text-center py-12">
              <MessageSquare className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">No SMS connections configured yet.</p>
              <Button onClick={openNew} className="mt-3" leftIcon={<Plus className="w-4 h-4" />}>Add your first connection</Button>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {connections.map((c) => (
                <div key={c.id} className="flex items-center justify-between gap-4 px-6 py-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-gray-900 truncate">{c.name}</p>
                      <Badge variant={c.is_active ? 'success' : 'default'} className="text-xs">{c.is_active ? 'Active' : 'Disabled'}</Badge>
                      <Badge variant="default" className="text-xs">{c.method}</Badge>
                    </div>
                    <p className="text-xs text-gray-400 font-mono truncate mt-0.5">{c.api_url}</p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button variant="ghost" size="sm" onClick={() => openEdit(c)}>Edit</Button>
                    <Button variant="ghost" size="sm" onClick={() => handleDelete(c)} className="text-red-500 hover:text-red-700 hover:bg-red-50">
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {editing && (
        <ConnectionEditor
          draft={editing}
          onChange={setEditing}
          onCancel={() => setEditing(null)}
          onSave={handleSave}
          isSaving={isSaving}
        />
      )}

      <SmsLogTable />
    </div>
  );
}

function ConnectionEditor({ draft, onChange, onCancel, onSave, isSaving }: {
  draft: ConnectionDraft;
  onChange: (d: ConnectionDraft) => void;
  onCancel: () => void;
  onSave: () => void;
  isSaving: boolean;
}) {
  const [showKey, setShowKey] = useState(false);
  const [testPhone, setTestPhone] = useState('');
  const [isTesting, setIsTesting] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const set = <K extends keyof ConnectionDraft>(key: K, value: ConnectionDraft[K]) => onChange({ ...draft, [key]: value });

  const handleTest = async () => {
    if (!testPhone.trim()) { toast.error('Enter a phone number to test with'); return; }
    if (!draft.api_url.trim()) { toast.error('Enter an API URL first'); return; }
    setIsTesting(true);
    try {
      // Tests whatever's in the form right now — saved or not, per "build and test" before
      // committing to it.
      await adminService.testSmsConnection(draft.id
        ? { connection_id: draft.id, phone: testPhone.trim() }
        : { name: draft.name || 'Draft connection', api_url: draft.api_url, method: draft.method, api_key: draft.api_key, sender_id: draft.sender_id, phone_format: draft.phone_format, phone: testPhone.trim() });
      toast.success('Test SMS sent — check the phone and the log below.');
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">{draft.id ? 'Edit Connection' : 'New Connection'}</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
            <Input value={draft.name} onChange={(e) => set('name', e.target.value)} placeholder="e.g. Alpha SMS - Primary" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Provider</label>
            <Input value={draft.provider_name} onChange={(e) => set('provider_name', e.target.value)} placeholder="e.g. Alpha SMS" />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">API URL</label>
          <textarea
            className="w-full border border-gray-300 rounded-lg p-2.5 h-20 resize-none font-mono text-xs"
            value={draft.api_url}
            onChange={(e) => set('api_url', e.target.value)}
            placeholder="https://provider.com/sendsms?api_key={api_key}&msg={message}&to={phone}&sender_id={sender_id}"
          />
          <p className="text-xs text-gray-500 mt-1.5 leading-relaxed">
            Use <code>{'{api_key}'}</code>, <code>{'{sender_id}'}</code>, <code>{'{phone}'}</code>, and{' '}
            <code>{'{message}'}</code> as placeholders anywhere in the URL, matching your provider&apos;s
            own param names — each is substituted (URL-encoded) at send time. Any of the four you
            don&apos;t reference in the URL is still sent along as a normal query/form parameter under
            that same name, so most providers work with no placeholders in the template at all.
          </p>
        </div>

        <div>
          <button
            type="button"
            onClick={() => setShowAdvanced((v) => !v)}
            className="text-xs font-medium text-primary-600 hover:text-primary-700"
          >
            {showAdvanced ? '▾ Hide' : '▸ Show'} advanced (balance &amp; cost tracking)
          </button>
          {showAdvanced && (
            <div className="mt-3 space-y-3 border-l-2 border-gray-100 pl-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Balance-check URL (optional)</label>
                <Input
                  className="font-mono text-xs"
                  value={draft.balance_url}
                  onChange={(e) => set('balance_url', e.target.value)}
                  placeholder="https://provider.com/user/balance/?api_key={api_key}"
                />
                <p className="text-xs text-gray-500 mt-1">
                  If your provider has an account-balance endpoint, add it here to see live balance
                  on the SMS Center page. Leave blank if not supported.
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Report / cost-lookup URL (optional)</label>
                <Input
                  className="font-mono text-xs"
                  value={draft.report_url}
                  onChange={(e) => set('report_url', e.target.value)}
                  placeholder="https://provider.com/report/request/{request_id}/?api_key={api_key}"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Only needed if your provider reports the per-message charge separately from the
                  send response (via a <code>{'{request_id}'}</code> lookup) — used to fill in the
                  spend breakdown on the SMS Center page.
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Method</label>
            <Select
              value={draft.method}
              onChange={(e) => set('method', e.target.value as 'GET' | 'POST')}
              options={[{ value: 'GET', label: 'GET' }, { value: 'POST', label: 'POST' }]}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Phone Format</label>
            <Select
              value={draft.phone_format}
              onChange={(e) => set('phone_format', e.target.value as 'as_is' | 'bd_880')}
              options={[
                { value: 'as_is', label: 'As stored (no conversion)' },
                { value: 'bd_880', label: 'Convert to 880XXXXXXXXXX' },
              ]}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">API Key</label>
            <div className="relative">
              <Input type={showKey ? 'text' : 'password'} className="pr-10" value={draft.api_key} onChange={(e) => set('api_key', e.target.value)} autoComplete="off" />
              <button type="button" onClick={() => setShowKey((v) => !v)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600" tabIndex={-1}>
                {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Sender ID (optional)</label>
            <Input value={draft.sender_id} onChange={(e) => set('sender_id', e.target.value)} />
          </div>
        </div>

        {draft.id && (
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => set('is_active', !draft.is_active)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${draft.is_active ? 'bg-primary-600' : 'bg-gray-200'}`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${draft.is_active ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
            <span className="text-sm text-gray-600">{draft.is_active ? 'Active' : 'Disabled'}</span>
          </div>
        )}

        <div className="border-t pt-4">
          <p className="text-sm font-medium text-gray-700 mb-2">Send Test SMS</p>
          <p className="text-xs text-gray-500 mb-2">Sends a real message using exactly what&apos;s in this form right now, whether or not you&apos;ve saved it yet.</p>
          <div className="flex flex-col sm:flex-row gap-2">
            <Input placeholder="e.g. 01712345678" value={testPhone} onChange={(e) => setTestPhone(e.target.value)} className="sm:max-w-xs" />
            <Button variant="outline" onClick={handleTest} isLoading={isTesting} leftIcon={<Send className="w-4 h-4" />}>Send Test SMS</Button>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t">
          <Button variant="ghost" onClick={onCancel}>Cancel</Button>
          <Button onClick={onSave} isLoading={isSaving}>{draft.id ? 'Save Changes' : 'Create Connection'}</Button>
        </div>
      </CardContent>
    </Card>
  );
}


interface ImageUploadFieldProps {
  currentValue: string;
  isEdited: boolean;
  isFavicon?: boolean;
  onChange: (value: string) => void;
}

function ImageUploadField({ currentValue, isEdited, isFavicon, onChange }: ImageUploadFieldProps) {
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const previewUrl = currentValue ? resolveAssetUrl(currentValue) : '';
  const accept = isFavicon ? 'image/x-icon,image/png,image/svg+xml' : 'image/png,image/jpeg,image/svg+xml,image/webp';

  const handleFile = async (file: File) => {
    setUploading(true);
    try {
      const response = await adminService.uploadFile(file);
      const path = response.data?.data?.path as string | undefined;
      if (!path) throw new Error('Upload did not return a path');
      onChange(path);
      toast.success('Uploaded. Save changes to apply.');
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className={`flex items-center gap-4 p-3 border rounded-lg ${isEdited ? 'border-yellow-400 bg-yellow-50' : 'border-gray-300 bg-gray-50'}`}>
        {previewUrl ? (
          <div className={`flex items-center justify-center bg-white border border-gray-200 rounded-md overflow-hidden ${isFavicon ? 'h-12 w-12' : 'h-16 w-28'}`}>
            <img src={previewUrl} alt="preview" className="max-h-full max-w-full object-contain" />
          </div>
        ) : (
          <div className={`flex items-center justify-center bg-white border border-dashed border-gray-300 rounded-md text-gray-400 text-xs ${isFavicon ? 'h-12 w-12' : 'h-16 w-28'}`}>
            No image
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-xs text-gray-500 truncate" title={currentValue}>{currentValue || 'No value set'}</p>
          <div className="flex items-center gap-2 mt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
            >
              <Upload className="w-4 h-4 mr-2" />
              {uploading ? 'Uploading...' : 'Upload'}
            </Button>
            {currentValue && (
              <Button type="button" variant="outline" onClick={() => onChange('')} disabled={uploading}>
                <X className="w-4 h-4 mr-2" />
                Clear
              </Button>
            )}
            {isEdited && <Badge variant="warning" className="text-xs">Modified</Badge>}
          </div>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept={accept}
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
            e.target.value = '';
          }}
        />
      </div>
      <Input
        type="text"
        className={isEdited ? 'border-yellow-400 bg-yellow-50' : ''}
        value={currentValue}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Or paste a path / URL (e.g. /images/logo.png)"
      />
    </div>
  );
}
