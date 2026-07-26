'use client';

import React, { useEffect, useState } from 'react';
import {
  Save, Plus, Trash2, RefreshCw, AlertCircle,
  Shield, Cpu, Server, Cloud, Phone, ArrowRight,
} from 'lucide-react';
import { AdminLayout } from '@/components/layout';
import {
  Card, CardContent, CardHeader, CardTitle, Button, Input, Textarea,
  LoadingSpinner, ErrorState,
} from '@/components/ui';
import { getErrorMessage } from '@/lib/utils';
import adminService from '@/lib/adminService';
import api from '@/lib/api';
import toast from 'react-hot-toast';

// ── Constants ─────────────────────────────────────────────────────────────────

const HEROICON_OPTIONS = [
  'ServerIcon',
  'CircleStackIcon',
  'DevicePhoneMobileIcon',
  'CpuChipIcon',
  'DocumentTextIcon',
  'CloudArrowUpIcon',
  'ComputerDesktopIcon',
  'ShieldCheckIcon',
  'CheckCircleIcon',
  'LockClosedIcon',
  'WrenchScrewdriverIcon',
  'PhoneIcon',
  'ChartBarIcon',
];

const GRADIENT_COLOR_OPTIONS = [
  { label: 'Blue → Cyan',      value: 'from-blue-500 to-cyan-500' },
  { label: 'Purple → Pink',    value: 'from-purple-500 to-pink-500' },
  { label: 'Orange → Red',     value: 'from-orange-500 to-red-500' },
  { label: 'Green → Emerald',  value: 'from-green-500 to-emerald-500' },
  { label: 'Indigo → Purple',  value: 'from-indigo-500 to-purple-500' },
  { label: 'Yellow → Orange',  value: 'from-yellow-500 to-orange-500' },
  { label: 'Pink → Rose',      value: 'from-pink-500 to-rose-500' },
  { label: 'Teal → Cyan',      value: 'from-teal-500 to-cyan-500' },
];

// ── Types ─────────────────────────────────────────────────────────────────────

interface Stat    { value: string; label: string }
interface Scenario { scenario: string; icon: string; recoverable: boolean }
interface Feature  { name: string; icon: string; description: string; successRate: string }
interface Step     { step: string; title: string; description: string; icon: string; color: string; time: string }
interface Guarantee { icon: string; title: string; description: string }
interface Benefit  { emoji: string; title: string; description: string }
interface NavLink  { name: string; href: string }
interface TrustItem { label: string }

interface DrHero {
  badge_text: string; title_line1: string; title_line2: string; description: string;
  stats: Stat[]; cta1_text: string; cta1_link: string; phone_number: string; phone_display: string;
}
interface DrLossScenarios { title: string; description: string; items: Scenario[] }
interface DrFeatures       { label: string; title: string; description: string; items: Feature[] }
interface DrEmergencyAlert { title: string; description: string }
interface DrServicesSection {
  title: string; description: string; guarantee_badge: string; cta_text: string; cta_link: string;
}
interface DrProcess {
  badge_text: string; title: string; description: string; steps: Step[];
  cta_heading: string; cta_description: string; cta_btn_text: string;
  cta_btn_link: string; cta_phone_text: string; cta_phone: string;
}
interface DrGuarantees {
  title: string; description: string; items: Guarantee[];
  why_title: string; why_description: string; benefits: Benefit[];
}
interface DrFaqSection { title: string; description: string }
interface DrCta {
  badge_text: string; title: string; description: string;
  phone: string; phone_display: string; phone_label: string;
  link_text: string; link_href: string; trust_indicators: string[];
}

interface DrSettings {
  dr_hero:             DrHero;
  dr_loss_scenarios:   DrLossScenarios;
  dr_features:         DrFeatures;
  dr_emergency_alert:  DrEmergencyAlert;
  dr_services_section: DrServicesSection;
  dr_process:          DrProcess;
  dr_guarantees:       DrGuarantees;
  dr_faq_section:      DrFaqSection;
  dr_cta:              DrCta;
}

type Tab = 'hero' | 'scenarios' | 'features' | 'emergency' | 'services' | 'process' | 'guarantees' | 'faq' | 'cta';

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: 'hero',       label: 'Hero',            icon: <ArrowRight className="w-4 h-4" /> },
  { id: 'scenarios',  label: 'Loss Scenarios',  icon: <AlertCircle className="w-4 h-4" /> },
  { id: 'features',   label: 'Features',        icon: <Cpu className="w-4 h-4" /> },
  { id: 'emergency',  label: 'Emergency Alert', icon: <AlertCircle className="w-4 h-4" /> },
  { id: 'services',   label: 'Services Header', icon: <Server className="w-4 h-4" /> },
  { id: 'process',    label: 'Process Steps',   icon: <RefreshCw className="w-4 h-4" /> },
  { id: 'guarantees', label: 'Guarantees',      icon: <Shield className="w-4 h-4" /> },
  { id: 'faq',        label: 'FAQ Header',      icon: <Cloud className="w-4 h-4" /> },
  { id: 'cta',        label: 'CTA Section',     icon: <Phone className="w-4 h-4" /> },
];

// ── Defaults ──────────────────────────────────────────────────────────────────

const DEFAULT_SETTINGS: DrSettings = {
  dr_hero: {
    badge_text: '98% Success Rate • No Data, No Fee', title_line1: 'Lost Your Data?',
    title_line2: 'We Can Recover It!',
    description: 'Professional data recovery services in Dhaka, Bangladesh.',
    stats: [
      { value: '98%', label: 'Success Rate' }, { value: '24h', label: 'Free Diagnosis' },
      { value: '10K+', label: 'Recovered Devices' }, { value: '100%', label: 'Confidential' },
    ],
    cta1_text: 'Get Free Diagnosis', cta1_link: '#services',
    phone_number: '+880 1711-123456', phone_display: 'Emergency: +880 1711-123456',
  },
  dr_loss_scenarios: {
    title: '💾 What Data Loss Situations Do We Handle?',
    description: 'No matter how you lost your data, we have the expertise to recover it',
    items: [],
  },
  dr_features: {
    label: '🔧 Specialized Recovery Services',
    title: 'We Recover Data From All Types of Devices',
    description: 'Advanced tools, expert technicians, and clean room facilities',
    items: [],
  },
  dr_emergency_alert: {
    title: '⚠️ CRITICAL: Stop Using Your Device Immediately!',
    description: 'Continued use can permanently damage your data.',
  },
  dr_services_section: {
    title: '💰 Transparent Pricing', description: 'No hidden fees. Pay only if we successfully recover your data.',
    guarantee_badge: 'No Data, No Charge Guarantee', cta_text: 'Contact us for a personalized quote',
    cta_link: '/contact',
  },
  dr_process: {
    badge_text: 'Simple 4-Step Process', title: 'How We Recover Your Data',
    description: "Clear, transparent process from diagnosis to delivery.",
    steps: [], cta_heading: 'Ready to Start the Recovery Process?',
    cta_description: 'Bring your device to any of our 5 locations in Dhaka or request a free pickup',
    cta_btn_text: 'View Services & Pricing', cta_btn_link: '#services',
    cta_phone_text: 'Call for Free Consultation', cta_phone: '+880 1711-123456',
  },
  dr_guarantees: {
    title: '🛡️ Our Commitment to You',
    description: "Your trust is our priority. Here's what makes us Bangladesh's #1 data recovery service.",
    items: [], why_title: 'Why Choose RecuvaPro?',
    why_description: '10+ years of experience serving businesses and individuals across Bangladesh',
    benefits: [],
  },
  dr_faq_section: {
    title: '❓ Frequently Asked Questions',
    description: 'Everything you need to know about our data recovery service',
  },
  dr_cta: {
    badge_text: '24/7 Emergency Service Available', title: "🚨 Lost Critical Data?\nWe're Here to Help!",
    description: "Don't panic! Our expert team is ready to recover your important files.",
    phone: '+880 1711-123456', phone_display: '+880 1711-123456', phone_label: 'Call Now',
    link_text: 'Visit Our Centers', link_href: '/contact',
    trust_indicators: ['Free Diagnosis', 'No Data, No Fee', 'Same Day Pickup'],
  },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function parseJson<T>(raw: unknown, fallback: T): T {
  if (!raw) return fallback;
  if (typeof raw === 'object') return raw as T;
  try { return JSON.parse(raw as string) as T; } catch { return fallback; }
}

// ── Sub-components ────────────────────────────────────────────────────────────

function SectionHeader({ title, description }: { title: string; description?: string }) {
  return (
    <div className="mb-6">
      <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
      {description && <p className="text-sm text-gray-500 mt-1">{description}</p>}
    </div>
  );
}

function IconSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
    >
      {HEROICON_OPTIONS.map(icon => (
        <option key={icon} value={icon}>{icon}</option>
      ))}
    </select>
  );
}

function GradientSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
    >
      {GRADIENT_COLOR_OPTIONS.map(opt => (
        <option key={opt.value} value={opt.value}>{opt.label}</option>
      ))}
    </select>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function DataRecoveryCmsPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving]   = useState(false);
  const [hasError, setHasError]   = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>('hero');
  const [form, setForm]           = useState<DrSettings>(DEFAULT_SETTINGS);
  const [originalForm, setOriginalForm] = useState<DrSettings>(DEFAULT_SETTINGS);

  const hasChanges = JSON.stringify(form) !== JSON.stringify(originalForm);

  // ── Load ──────────────────────────────────────────────────────────────────

  const loadSettings = async () => {
    setIsLoading(true);
    setHasError(false);
    try {
      const res  = await adminService.getSettings();
      const all  = (res.data?.data || res.data || {}) as unknown as Record<string, Record<string, unknown>>;
      const dr   = all.data_recovery || {};

      const loaded: DrSettings = {
        dr_hero:             parseJson(dr.dr_hero,             DEFAULT_SETTINGS.dr_hero),
        dr_loss_scenarios:   parseJson(dr.dr_loss_scenarios,   DEFAULT_SETTINGS.dr_loss_scenarios),
        dr_features:         parseJson(dr.dr_features,         DEFAULT_SETTINGS.dr_features),
        dr_emergency_alert:  parseJson(dr.dr_emergency_alert,  DEFAULT_SETTINGS.dr_emergency_alert),
        dr_services_section: parseJson(dr.dr_services_section, DEFAULT_SETTINGS.dr_services_section),
        dr_process:          parseJson(dr.dr_process,          DEFAULT_SETTINGS.dr_process),
        dr_guarantees:       parseJson(dr.dr_guarantees,       DEFAULT_SETTINGS.dr_guarantees),
        dr_faq_section:      parseJson(dr.dr_faq_section,      DEFAULT_SETTINGS.dr_faq_section),
        dr_cta:              parseJson(dr.dr_cta,              DEFAULT_SETTINGS.dr_cta),
      };

      setForm(loaded);
      setOriginalForm(loaded);
    } catch (err) {
      toast.error(getErrorMessage(err));
      setHasError(true);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { loadSettings(); }, []);

  // ── Save ──────────────────────────────────────────────────────────────────

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const keys: (keyof DrSettings)[] = [
        'dr_hero','dr_loss_scenarios','dr_features','dr_emergency_alert',
        'dr_services_section','dr_process','dr_guarantees','dr_faq_section','dr_cta',
      ];
      const settingsPayload = Object.fromEntries(
        keys.map(key => [key, { key, value: JSON.stringify(form[key]), group: 'data_recovery' }])
      );
      await api.put('/admin/settings', { settings: settingsPayload });
      toast.success('Data Recovery page settings saved');
      setOriginalForm({ ...form });
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setIsSaving(false);
    }
  };

  // ── Helpers ───────────────────────────────────────────────────────────────

  function setSection<K extends keyof DrSettings>(key: K, value: DrSettings[K]) {
    setForm(prev => ({ ...prev, [key]: value }));
  }

  function setField<K extends keyof DrSettings>(section: K, field: keyof DrSettings[K], value: unknown) {
    setForm(prev => ({ ...prev, [section]: { ...prev[section], [field]: value } }));
  }

  // ── Render ────────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center py-24">
          <LoadingSpinner size="lg" />
        </div>
      </AdminLayout>
    );
  }

  if (hasError) {
    return (
      <AdminLayout>
        <ErrorState message="Failed to load settings" onRetry={loadSettings} />
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      {/* Page Header */}
      <div className="page-header flex items-center justify-between mb-6">
        <div>
          <h1 className="page-title">Data Recovery Page CMS</h1>
          <p className="page-description">Manage all content sections of the /data-recovery page</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={loadSettings} disabled={isSaving}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Reset
          </Button>
          <Button onClick={handleSave} isLoading={isSaving} disabled={!hasChanges}>
            <Save className="w-4 h-4 mr-2" />
            Save Changes
          </Button>
        </div>
      </div>

      {hasChanges && (
        <div className="mb-4 flex items-center gap-2 rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-700">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          You have unsaved changes.
        </div>
      )}

      {/* Tabs */}
      <div className="flex flex-wrap gap-1 mb-6 bg-gray-100 rounded-xl p-1">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Tab: Hero ──────────────────────────────────────────────────────── */}
      {activeTab === 'hero' && (
        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle>Hero Section</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <Input label="Badge Text" value={form.dr_hero.badge_text}
                onChange={e => setField('dr_hero', 'badge_text', e.target.value)} />
              <Input label="Title Line 1 (white text)" value={form.dr_hero.title_line1}
                onChange={e => setField('dr_hero', 'title_line1', e.target.value)} />
              <Input label="Title Line 2 (gray-300 text)" value={form.dr_hero.title_line2}
                onChange={e => setField('dr_hero', 'title_line2', e.target.value)} />
              <Textarea label="Description" rows={3} value={form.dr_hero.description}
                onChange={e => setField('dr_hero', 'description', e.target.value)} />
              <Input label="CTA Button Text" value={form.dr_hero.cta1_text}
                onChange={e => setField('dr_hero', 'cta1_text', e.target.value)} />
              <Input label="CTA Button Link" value={form.dr_hero.cta1_link}
                onChange={e => setField('dr_hero', 'cta1_link', e.target.value)} />
              <Input label="Phone Number (tel:)" value={form.dr_hero.phone_number}
                onChange={e => setField('dr_hero', 'phone_number', e.target.value)} />
              <Input label="Phone Display Text" value={form.dr_hero.phone_display}
                onChange={e => setField('dr_hero', 'phone_display', e.target.value)} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Stats (4 items)</CardTitle>
                <Button size="sm" variant="secondary"
                  onClick={() => setField('dr_hero', 'stats', [...form.dr_hero.stats, { value: '', label: '' }])}>
                  <Plus className="w-4 h-4 mr-1" />Add Stat
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {form.dr_hero.stats.map((stat, i) => (
                <div key={i} className="flex gap-3 items-start p-3 bg-gray-50 rounded-lg border border-gray-200">
                  <div className="flex-1 grid grid-cols-2 gap-3">
                    <Input label="Value" value={stat.value}
                      onChange={e => {
                        const stats = [...form.dr_hero.stats];
                        stats[i] = { ...stat, value: e.target.value };
                        setField('dr_hero', 'stats', stats);
                      }} />
                    <Input label="Label" value={stat.label}
                      onChange={e => {
                        const stats = [...form.dr_hero.stats];
                        stats[i] = { ...stat, label: e.target.value };
                        setField('dr_hero', 'stats', stats);
                      }} />
                  </div>
                  <button onClick={() => setField('dr_hero', 'stats', form.dr_hero.stats.filter((_, idx) => idx !== i))}
                    className="mt-6 p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── Tab: Loss Scenarios ────────────────────────────────────────────── */}
      {activeTab === 'scenarios' && (
        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle>Section Header</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <Input label="Title" value={form.dr_loss_scenarios.title}
                onChange={e => setField('dr_loss_scenarios', 'title', e.target.value)} />
              <Textarea label="Description" rows={2} value={form.dr_loss_scenarios.description}
                onChange={e => setField('dr_loss_scenarios', 'description', e.target.value)} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Scenarios ({form.dr_loss_scenarios.items.length} items)</CardTitle>
                <Button size="sm" variant="secondary"
                  onClick={() => setField('dr_loss_scenarios', 'items',
                    [...form.dr_loss_scenarios.items, { scenario: '', icon: '📁', recoverable: true }])}>
                  <Plus className="w-4 h-4 mr-1" />Add Scenario
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {form.dr_loss_scenarios.items.map((item, i) => (
                  <div key={i} className="flex gap-2 items-start p-3 bg-gray-50 rounded-lg border border-gray-200">
                    <div className="flex-1 grid grid-cols-2 gap-2">
                      <Input label="Emoji Icon" value={item.icon}
                        onChange={e => {
                          const items = [...form.dr_loss_scenarios.items];
                          items[i] = { ...item, icon: e.target.value };
                          setField('dr_loss_scenarios', 'items', items);
                        }} />
                      <Input label="Scenario Name" value={item.scenario}
                        onChange={e => {
                          const items = [...form.dr_loss_scenarios.items];
                          items[i] = { ...item, scenario: e.target.value };
                          setField('dr_loss_scenarios', 'items', items);
                        }} />
                    </div>
                    <button onClick={() => setField('dr_loss_scenarios', 'items',
                      form.dr_loss_scenarios.items.filter((_, idx) => idx !== i))}
                      className="mt-6 p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── Tab: Features ─────────────────────────────────────────────────── */}
      {activeTab === 'features' && (
        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle>Section Header</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <Input label="Small Label (above title)" value={form.dr_features.label}
                onChange={e => setField('dr_features', 'label', e.target.value)} />
              <Input label="Title" value={form.dr_features.title}
                onChange={e => setField('dr_features', 'title', e.target.value)} />
              <Textarea label="Description" rows={2} value={form.dr_features.description}
                onChange={e => setField('dr_features', 'description', e.target.value)} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Recovery Types ({form.dr_features.items.length} items)</CardTitle>
                <Button size="sm" variant="secondary"
                  onClick={() => setField('dr_features', 'items',
                    [...form.dr_features.items, { name: '', icon: 'ServerIcon', description: '', successRate: '90%' }])}>
                  <Plus className="w-4 h-4 mr-1" />Add Item
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {form.dr_features.items.map((item, i) => (
                <div key={i} className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <div className="flex items-start gap-3">
                    <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-3">
                      <Input label="Name" value={item.name}
                        onChange={e => {
                          const items = [...form.dr_features.items];
                          items[i] = { ...item, name: e.target.value };
                          setField('dr_features', 'items', items);
                        }} />
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Icon (Heroicon)</label>
                        <IconSelect value={item.icon} onChange={v => {
                          const items = [...form.dr_features.items];
                          items[i] = { ...item, icon: v };
                          setField('dr_features', 'items', items);
                        }} />
                      </div>
                      <Input label="Description" value={item.description}
                        onChange={e => {
                          const items = [...form.dr_features.items];
                          items[i] = { ...item, description: e.target.value };
                          setField('dr_features', 'items', items);
                        }} />
                      <Input label="Success Rate (e.g. 95%)" value={item.successRate}
                        onChange={e => {
                          const items = [...form.dr_features.items];
                          items[i] = { ...item, successRate: e.target.value };
                          setField('dr_features', 'items', items);
                        }} />
                    </div>
                    <button onClick={() => setField('dr_features', 'items',
                      form.dr_features.items.filter((_, idx) => idx !== i))}
                      className="mt-6 p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── Tab: Emergency Alert ──────────────────────────────────────────── */}
      {activeTab === 'emergency' && (
        <Card>
          <CardHeader><CardTitle>Emergency Alert Banner</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-gray-500">This dark warning banner appears between the Features and Services sections.</p>
            <Input label="Alert Title" value={form.dr_emergency_alert.title}
              onChange={e => setField('dr_emergency_alert', 'title', e.target.value)} />
            <Textarea label="Alert Description" rows={3} value={form.dr_emergency_alert.description}
              onChange={e => setField('dr_emergency_alert', 'description', e.target.value)} />
          </CardContent>
        </Card>
      )}

      {/* ── Tab: Services Section ─────────────────────────────────────────── */}
      {activeTab === 'services' && (
        <Card>
          <CardHeader><CardTitle>Services / Pricing Section Header</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-gray-500">The services grid below this header is driven by the Services module (category: data-recovery).</p>
            <Input label="Section Title" value={form.dr_services_section.title}
              onChange={e => setField('dr_services_section', 'title', e.target.value)} />
            <Textarea label="Section Description" rows={2} value={form.dr_services_section.description}
              onChange={e => setField('dr_services_section', 'description', e.target.value)} />
            <Input label="Guarantee Badge Text" value={form.dr_services_section.guarantee_badge}
              onChange={e => setField('dr_services_section', 'guarantee_badge', e.target.value)} />
            <Input label="Bottom CTA Text" value={form.dr_services_section.cta_text}
              onChange={e => setField('dr_services_section', 'cta_text', e.target.value)} />
            <Input label="Bottom CTA Link" value={form.dr_services_section.cta_link}
              onChange={e => setField('dr_services_section', 'cta_link', e.target.value)} />
          </CardContent>
        </Card>
      )}

      {/* ── Tab: Process Steps ────────────────────────────────────────────── */}
      {activeTab === 'process' && (
        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle>Section Header</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <Input label="Badge Text" value={form.dr_process.badge_text}
                onChange={e => setField('dr_process', 'badge_text', e.target.value)} />
              <Input label="Title" value={form.dr_process.title}
                onChange={e => setField('dr_process', 'title', e.target.value)} />
              <Textarea label="Description" rows={2} value={form.dr_process.description}
                onChange={e => setField('dr_process', 'description', e.target.value)} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Process Steps ({form.dr_process.steps.length})</CardTitle>
                <Button size="sm" variant="secondary"
                  onClick={() => setField('dr_process', 'steps', [...form.dr_process.steps, {
                    step: String(form.dr_process.steps.length + 1), title: '', description: '',
                    icon: 'DocumentTextIcon', color: 'from-blue-500 to-cyan-500', time: '',
                  }])}>
                  <Plus className="w-4 h-4 mr-1" />Add Step
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {form.dr_process.steps.map((step, i) => (
                <div key={i} className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <div className="flex items-start gap-3">
                    <div className="flex-1 grid grid-cols-2 md:grid-cols-3 gap-3">
                      <Input label="Step Number" value={step.step}
                        onChange={e => {
                          const steps = [...form.dr_process.steps];
                          steps[i] = { ...step, step: e.target.value };
                          setField('dr_process', 'steps', steps);
                        }} />
                      <Input label="Title" value={step.title}
                        onChange={e => {
                          const steps = [...form.dr_process.steps];
                          steps[i] = { ...step, title: e.target.value };
                          setField('dr_process', 'steps', steps);
                        }} />
                      <Input label="Time Badge (e.g. 24 hours)" value={step.time}
                        onChange={e => {
                          const steps = [...form.dr_process.steps];
                          steps[i] = { ...step, time: e.target.value };
                          setField('dr_process', 'steps', steps);
                        }} />
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Icon (Heroicon)</label>
                        <IconSelect value={step.icon} onChange={v => {
                          const steps = [...form.dr_process.steps];
                          steps[i] = { ...step, icon: v };
                          setField('dr_process', 'steps', steps);
                        }} />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Gradient Color</label>
                        <GradientSelect value={step.color} onChange={v => {
                          const steps = [...form.dr_process.steps];
                          steps[i] = { ...step, color: v };
                          setField('dr_process', 'steps', steps);
                        }} />
                      </div>
                      <Textarea label="Description" rows={3} value={step.description}
                        onChange={e => {
                          const steps = [...form.dr_process.steps];
                          steps[i] = { ...step, description: e.target.value };
                          setField('dr_process', 'steps', steps);
                        }} />
                    </div>
                    <button onClick={() => setField('dr_process', 'steps',
                      form.dr_process.steps.filter((_, idx) => idx !== i))}
                      className="mt-6 p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Process CTA Block</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <Input label="CTA Heading" value={form.dr_process.cta_heading}
                onChange={e => setField('dr_process', 'cta_heading', e.target.value)} />
              <Textarea label="CTA Description" rows={2} value={form.dr_process.cta_description}
                onChange={e => setField('dr_process', 'cta_description', e.target.value)} />
              <div className="grid grid-cols-2 gap-4">
                <Input label="Button Text" value={form.dr_process.cta_btn_text}
                  onChange={e => setField('dr_process', 'cta_btn_text', e.target.value)} />
                <Input label="Button Link" value={form.dr_process.cta_btn_link}
                  onChange={e => setField('dr_process', 'cta_btn_link', e.target.value)} />
                <Input label="Phone Button Label" value={form.dr_process.cta_phone_text}
                  onChange={e => setField('dr_process', 'cta_phone_text', e.target.value)} />
                <Input label="Phone Number" value={form.dr_process.cta_phone}
                  onChange={e => setField('dr_process', 'cta_phone', e.target.value)} />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── Tab: Guarantees ───────────────────────────────────────────────── */}
      {activeTab === 'guarantees' && (
        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle>Section Header</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <Input label="Title" value={form.dr_guarantees.title}
                onChange={e => setField('dr_guarantees', 'title', e.target.value)} />
              <Textarea label="Description" rows={2} value={form.dr_guarantees.description}
                onChange={e => setField('dr_guarantees', 'description', e.target.value)} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Guarantee Cards ({form.dr_guarantees.items.length})</CardTitle>
                <Button size="sm" variant="secondary"
                  onClick={() => setField('dr_guarantees', 'items',
                    [...form.dr_guarantees.items, { icon: 'ShieldCheckIcon', title: '', description: '' }])}>
                  <Plus className="w-4 h-4 mr-1" />Add Card
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {form.dr_guarantees.items.map((item, i) => (
                <div key={i} className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <div className="flex items-start gap-3">
                    <div className="flex-1 grid grid-cols-3 gap-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Icon (Heroicon)</label>
                        <IconSelect value={item.icon} onChange={v => {
                          const items = [...form.dr_guarantees.items];
                          items[i] = { ...item, icon: v };
                          setField('dr_guarantees', 'items', items);
                        }} />
                      </div>
                      <Input label="Title" value={item.title}
                        onChange={e => {
                          const items = [...form.dr_guarantees.items];
                          items[i] = { ...item, title: e.target.value };
                          setField('dr_guarantees', 'items', items);
                        }} />
                      <Textarea label="Description" rows={3} value={item.description}
                        onChange={e => {
                          const items = [...form.dr_guarantees.items];
                          items[i] = { ...item, description: e.target.value };
                          setField('dr_guarantees', 'items', items);
                        }} />
                    </div>
                    <button onClick={() => setField('dr_guarantees', 'items',
                      form.dr_guarantees.items.filter((_, idx) => idx !== i))}
                      className="mt-6 p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>"Why Choose" Block</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <Input label="Block Title" value={form.dr_guarantees.why_title}
                onChange={e => setField('dr_guarantees', 'why_title', e.target.value)} />
              <Textarea label="Block Description" rows={2} value={form.dr_guarantees.why_description}
                onChange={e => setField('dr_guarantees', 'why_description', e.target.value)} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Benefits ({form.dr_guarantees.benefits.length} items)</CardTitle>
                <Button size="sm" variant="secondary"
                  onClick={() => setField('dr_guarantees', 'benefits',
                    [...form.dr_guarantees.benefits, { emoji: '⚡', title: '', description: '' }])}>
                  <Plus className="w-4 h-4 mr-1" />Add Benefit
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {form.dr_guarantees.benefits.map((benefit, i) => (
                <div key={i} className="flex gap-2 items-start p-3 bg-gray-50 rounded-lg border border-gray-200">
                  <div className="flex-1 grid grid-cols-3 gap-3">
                    <Input label="Emoji" value={benefit.emoji}
                      onChange={e => {
                        const benefits = [...form.dr_guarantees.benefits];
                        benefits[i] = { ...benefit, emoji: e.target.value };
                        setField('dr_guarantees', 'benefits', benefits);
                      }} />
                    <Input label="Title" value={benefit.title}
                      onChange={e => {
                        const benefits = [...form.dr_guarantees.benefits];
                        benefits[i] = { ...benefit, title: e.target.value };
                        setField('dr_guarantees', 'benefits', benefits);
                      }} />
                    <Input label="Description" value={benefit.description}
                      onChange={e => {
                        const benefits = [...form.dr_guarantees.benefits];
                        benefits[i] = { ...benefit, description: e.target.value };
                        setField('dr_guarantees', 'benefits', benefits);
                      }} />
                  </div>
                  <button onClick={() => setField('dr_guarantees', 'benefits',
                    form.dr_guarantees.benefits.filter((_, idx) => idx !== i))}
                    className="mt-6 p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── Tab: FAQ Header ───────────────────────────────────────────────── */}
      {activeTab === 'faq' && (
        <Card>
          <CardHeader><CardTitle>FAQ Section Header</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-gray-500">The FAQ items themselves are managed under CMS → FAQs.</p>
            <Input label="Section Title" value={form.dr_faq_section.title}
              onChange={e => setField('dr_faq_section', 'title', e.target.value)} />
            <Textarea label="Section Description" rows={2} value={form.dr_faq_section.description}
              onChange={e => setField('dr_faq_section', 'description', e.target.value)} />
          </CardContent>
        </Card>
      )}

      {/* ── Tab: CTA ──────────────────────────────────────────────────────── */}
      {activeTab === 'cta' && (
        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle>Bottom CTA Section</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <Input label="Badge Text" value={form.dr_cta.badge_text}
                onChange={e => setField('dr_cta', 'badge_text', e.target.value)} />
              <Textarea label="Title (use \\n for line break)" rows={2} value={form.dr_cta.title}
                onChange={e => setField('dr_cta', 'title', e.target.value)} />
              <Textarea label="Description" rows={3} value={form.dr_cta.description}
                onChange={e => setField('dr_cta', 'description', e.target.value)} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Phone Button</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <Input label="Label (above number)" value={form.dr_cta.phone_label}
                  onChange={e => setField('dr_cta', 'phone_label', e.target.value)} />
                <Input label="Phone Number (tel:)" value={form.dr_cta.phone}
                  onChange={e => setField('dr_cta', 'phone', e.target.value)} />
                <Input label="Display Text" value={form.dr_cta.phone_display}
                  onChange={e => setField('dr_cta', 'phone_display', e.target.value)} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Link Button</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Input label="Button Text" value={form.dr_cta.link_text}
                  onChange={e => setField('dr_cta', 'link_text', e.target.value)} />
                <Input label="Button Link" value={form.dr_cta.link_href}
                  onChange={e => setField('dr_cta', 'link_href', e.target.value)} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Trust Indicators ({form.dr_cta.trust_indicators.length})</CardTitle>
                <Button size="sm" variant="secondary"
                  onClick={() => setField('dr_cta', 'trust_indicators',
                    [...form.dr_cta.trust_indicators, ''])}>
                  <Plus className="w-4 h-4 mr-1" />Add
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {form.dr_cta.trust_indicators.map((item, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <Input value={item} placeholder="e.g. Free Diagnosis"
                    onChange={e => {
                      const indicators = [...form.dr_cta.trust_indicators];
                      indicators[i] = e.target.value;
                      setField('dr_cta', 'trust_indicators', indicators);
                    }} />
                  <button onClick={() => setField('dr_cta', 'trust_indicators',
                    form.dr_cta.trust_indicators.filter((_, idx) => idx !== i))}
                    className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded flex-shrink-0">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      )}
    </AdminLayout>
  );
}
