'use client';

import React, { useEffect, useState } from 'react';
import {
  Save, Plus, Trash2, RefreshCw, AlertCircle,
  Info, Users, Star, Rocket, Target, Image, MousePointer,
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

const ICON_OPTIONS = [
  'WrenchScrewdriverIcon',
  'ShieldCheckIcon',
  'ClockIcon',
  'UserGroupIcon',
  'SparklesIcon',
  'TrophyIcon',
  'CheckBadgeIcon',
  'RocketLaunchIcon',
  'ComputerDesktopIcon',
  'CircleStackIcon',
  'CpuChipIcon',
  'CubeIcon',
  'ServerIcon',
  'DevicePhoneMobileIcon',
  'DocumentTextIcon',
  'CloudArrowUpIcon',
  'LockClosedIcon',
  'PhoneIcon',
  'ChartBarIcon',
  'CheckCircleIcon',
];

// ── Types ─────────────────────────────────────────────────────────────────────

interface AboutHero   { badge_icon: string; badge_text: string; title: string; subtitle: string }
interface ServiceItem { icon: string; title: string; description: string }
interface AboutServices { items: ServiceItem[] }
interface Highlight   { icon: string; text: string; dark: boolean }
interface AboutStory  { badge_icon: string; badge_text: string; heading: string; paragraphs: string[]; highlights: Highlight[] }
interface StatItem    { icon: string; value: string; label: string; dark: boolean }
interface AboutStats  { items: StatItem[] }
interface ValueItem   { icon: string; title: string; description: string }
interface AboutValues { title: string; subtitle: string; items: ValueItem[] }
interface AboutMission { icon: string; title: string; text: string }
interface AboutVision  { icon: string; title: string; text: string }
interface TeamMember  { name: string; role: string; initials: string }
interface AboutTeam   { title: string; subtitle: string; members: TeamMember[] }
interface CtaButton   { icon: string; label: string; href: string; variant: 'light' | 'dark' | 'outline' }
interface AboutCta    { title: string; text: string; buttons: CtaButton[] }

interface AboutSettings {
  about_hero:     AboutHero;
  about_services: AboutServices;
  about_story:    AboutStory;
  about_stats:    AboutStats;
  about_values:   AboutValues;
  about_mission:  AboutMission;
  about_vision:   AboutVision;
  about_team:     AboutTeam;
  about_cta:      AboutCta;
}

type Tab = 'hero' | 'services' | 'story' | 'values' | 'mission' | 'team' | 'cta';

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: 'hero',     label: 'Hero',          icon: <Image className="w-4 h-4" /> },
  { id: 'services', label: 'What We Do',    icon: <Star className="w-4 h-4" /> },
  { id: 'story',    label: 'Story & Stats', icon: <Info className="w-4 h-4" /> },
  { id: 'values',   label: 'Values',        icon: <Rocket className="w-4 h-4" /> },
  { id: 'mission',  label: 'Mission & Vision', icon: <Target className="w-4 h-4" /> },
  { id: 'team',     label: 'Team',          icon: <Users className="w-4 h-4" /> },
  { id: 'cta',      label: 'CTA',           icon: <MousePointer className="w-4 h-4" /> },
];

// ── Defaults ──────────────────────────────────────────────────────────────────

const DEFAULT_SETTINGS: AboutSettings = {
  about_hero: {
    badge_icon: 'CpuChipIcon',
    badge_text: 'Your Trusted Tech Partner',
    title: 'About Gadget Revive',
    subtitle: 'Professional data recovery, PC repair services, and quality computer parts — all under one roof',
  },
  about_services: {
    items: [
      { icon: 'CircleStackIcon',    title: 'Data Recovery',          description: 'Advanced recovery from crashed drives, corrupted storage, and deleted files.' },
      { icon: 'ComputerDesktopIcon',title: 'PC Repair & Service',    description: 'Hardware diagnostics, component replacement, and system optimization.' },
      { icon: 'CpuChipIcon',        title: 'Computer Parts',         description: 'Genuine components - CPUs, GPUs, RAM, SSDs, motherboards, and more.' },
      { icon: 'CubeIcon',           title: 'Accessories & Products', description: 'Peripherals, cables, cooling systems, and PC building essentials.' },
    ],
  },
  about_story: {
    badge_icon: 'RocketLaunchIcon',
    badge_text: 'Who We Are',
    heading: 'A New Standard in Computer Services',
    paragraphs: [
      'Gadget Revive is your one-stop destination for all computer-related needs. We specialize in <strong>professional data recovery</strong>, bringing back your valuable files from crashed hard drives, corrupted SSDs, and damaged storage devices.',
      'Our <strong>PC repair services</strong> cover everything from hardware diagnostics and component upgrades to complete system builds. Whether you need a simple RAM upgrade or a complex motherboard replacement, our skilled technicians have you covered.',
      'We also stock a wide range of <strong>genuine computer parts and accessories</strong> — processors, graphics cards, storage drives, peripherals, and more. Quality products, competitive prices, and expert advice.',
    ],
    highlights: [
      { icon: 'CheckBadgeIcon', text: 'Certified Technicians', dark: false },
      { icon: 'ShieldCheckIcon', text: 'Genuine Parts',        dark: true },
    ],
  },
  about_stats: {
    items: [
      { icon: 'CircleStackIcon',    value: '95%+',   label: 'Data Recovery Success', dark: false },
      { icon: 'ComputerDesktopIcon',value: '24-72h', label: 'Avg. Repair Time',      dark: true },
      { icon: 'CpuChipIcon',        value: '500+',   label: 'Products in Stock',     dark: true },
      { icon: 'UserGroupIcon',      value: 'Expert', label: 'Tech Support',          dark: false },
    ],
  },
  about_values: {
    title: 'Why Choose Gadget Revive',
    subtitle: 'Your data and devices are in expert hands',
    items: [
      { icon: 'ShieldCheckIcon', title: 'Genuine Parts Only', description: 'We source authentic components directly from trusted manufacturers.' },
      { icon: 'ClockIcon',       title: 'Quick Service',       description: 'Most repairs and data recovery completed within 24-72 hours.' },
      { icon: 'SparklesIcon',    title: 'Honest Pricing',      description: 'Transparent quotes with no hidden charges. Pay only for what you need.' },
      { icon: 'CheckBadgeIcon',  title: 'Service Warranty',    description: 'All services backed by warranty. Your satisfaction is guaranteed.' },
    ],
  },
  about_mission: {
    icon: 'TrophyIcon',
    title: 'Our Mission',
    text: 'To provide professional data recovery and computer repair services that protect your valuable data and keep your systems running at peak performance.',
  },
  about_vision: {
    icon: 'RocketLaunchIcon',
    title: 'Our Vision',
    text: "To be the most trusted name in computer services — where customers know their data is safe, their devices are in expert hands, and they're getting the best parts available.",
  },
  about_team: {
    title: 'Our Expert Team',
    subtitle: 'Skilled professionals ready to solve your tech challenges',
    members: [
      { name: 'Tech Expert',   role: 'Data Recovery Specialist', initials: 'DR' },
      { name: 'Hardware Pro',  role: 'PC Service Engineer',       initials: 'PC' },
      { name: 'Parts Advisor', role: 'Product Specialist',        initials: 'PS' },
    ],
  },
  about_cta: {
    title: 'Need Data Recovery or PC Service?',
    text: "Get in touch for a free consultation. We'll diagnose your issue and provide a transparent quote — no obligation.",
    buttons: [
      { icon: 'CircleStackIcon',       label: 'Data Recovery', href: '/data-recovery', variant: 'light' },
      { icon: 'WrenchScrewdriverIcon', label: 'PC Services',   href: '/services',       variant: 'dark' },
      { icon: 'CpuChipIcon',           label: 'Shop Parts',    href: '/products',       variant: 'outline' },
    ],
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

function IconSelect({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
      >
        {ICON_OPTIONS.map(icon => (
          <option key={icon} value={icon}>{icon}</option>
        ))}
      </select>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────

export default function AboutCmsPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving,  setIsSaving]  = useState(false);
  const [hasError,  setHasError]  = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>('hero');
  const [form, setForm]           = useState<AboutSettings>(DEFAULT_SETTINGS);
  const [originalForm, setOriginalForm] = useState<AboutSettings>(DEFAULT_SETTINGS);

  const hasChanges = JSON.stringify(form) !== JSON.stringify(originalForm);

  // ── Load ───────────────────────────────────────────────────────────────────

  const loadSettings = async () => {
    setIsLoading(true);
    setHasError(false);
    try {
      const res = await adminService.getSettings();
      const all = (res.data?.data || res.data || {}) as unknown as Record<string, Record<string, unknown>>;
      const ab  = all.about || {};

      const loaded: AboutSettings = {
        about_hero:     parseJson(ab.about_hero,     DEFAULT_SETTINGS.about_hero),
        about_services: parseJson(ab.about_services, DEFAULT_SETTINGS.about_services),
        about_story:    parseJson(ab.about_story,    DEFAULT_SETTINGS.about_story),
        about_stats:    parseJson(ab.about_stats,    DEFAULT_SETTINGS.about_stats),
        about_values:   parseJson(ab.about_values,   DEFAULT_SETTINGS.about_values),
        about_mission:  parseJson(ab.about_mission,  DEFAULT_SETTINGS.about_mission),
        about_vision:   parseJson(ab.about_vision,   DEFAULT_SETTINGS.about_vision),
        about_team:     parseJson(ab.about_team,     DEFAULT_SETTINGS.about_team),
        about_cta:      parseJson(ab.about_cta,      DEFAULT_SETTINGS.about_cta),
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

  // ── Save ───────────────────────────────────────────────────────────────────

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const keys: (keyof AboutSettings)[] = [
        'about_hero', 'about_services', 'about_story', 'about_stats',
        'about_values', 'about_mission', 'about_vision', 'about_team', 'about_cta',
      ];
      const settingsPayload = Object.fromEntries(
        keys.map(key => [key, { key, value: JSON.stringify(form[key]), group: 'about' }])
      );
      await api.put('/admin/settings', { settings: settingsPayload });
      toast.success('About page settings saved');
      setOriginalForm({ ...form });
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setIsSaving(false);
    }
  };

  // ── Field helpers ──────────────────────────────────────────────────────────

  function setSection<K extends keyof AboutSettings>(key: K, value: AboutSettings[K]) {
    setForm(prev => ({ ...prev, [key]: value }));
  }

  function setField<K extends keyof AboutSettings>(section: K, field: keyof AboutSettings[K], value: unknown) {
    setForm(prev => ({ ...prev, [section]: { ...prev[section], [field]: value } }));
  }

  // ── Render ─────────────────────────────────────────────────────────────────

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
        <ErrorState message="Failed to load About page settings" onRetry={loadSettings} />
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      {/* Page Header */}
      <div className="page-header flex items-center justify-between mb-6">
        <div>
          <h1 className="page-title">About Page CMS</h1>
          <p className="page-description">Manage all content sections of the /about page</p>
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
        <Card>
          <CardHeader><CardTitle>Hero Section</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <SectionHeader
              title="Hero Banner"
              description="Displayed at the top of the About page with a dark gradient background."
            />
            <IconSelect
              label="Badge Icon"
              value={form.about_hero.badge_icon}
              onChange={v => setField('about_hero', 'badge_icon', v)}
            />
            <Input
              label="Badge Text"
              value={form.about_hero.badge_text}
              onChange={e => setField('about_hero', 'badge_text', e.target.value)}
            />
            <Input
              label="Page Title (h1)"
              value={form.about_hero.title}
              onChange={e => setField('about_hero', 'title', e.target.value)}
            />
            <Textarea
              label="Subtitle"
              rows={2}
              value={form.about_hero.subtitle}
              onChange={e => setField('about_hero', 'subtitle', e.target.value)}
            />
          </CardContent>
        </Card>
      )}

      {/* ── Tab: Services ──────────────────────────────────────────────────── */}
      {activeTab === 'services' && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>What We Do — Service Cards</CardTitle>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() =>
                    setSection('about_services', {
                      items: [...form.about_services.items, { icon: 'CpuChipIcon', title: 'New Service', description: '' }],
                    })
                  }
                >
                  <Plus className="w-4 h-4 mr-1" /> Add Card
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <SectionHeader
                title="Service Cards"
                description="Floating card grid shown below the hero. Each card has an icon, title and description."
              />
              {form.about_services.items.map((item, i) => (
                <div key={i} className="p-4 bg-gray-50 rounded-lg border border-gray-200 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-700">Card {i + 1}</span>
                    <button
                      onClick={() =>
                        setSection('about_services', {
                          items: form.about_services.items.filter((_, idx) => idx !== i),
                        })
                      }
                      className="text-red-400 hover:text-red-600"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <IconSelect
                    label="Icon"
                    value={item.icon}
                    onChange={v => {
                      const items = [...form.about_services.items];
                      items[i] = { ...items[i], icon: v };
                      setSection('about_services', { items });
                    }}
                  />
                  <Input
                    label="Title"
                    value={item.title}
                    onChange={e => {
                      const items = [...form.about_services.items];
                      items[i] = { ...items[i], title: e.target.value };
                      setSection('about_services', { items });
                    }}
                  />
                  <Textarea
                    label="Description"
                    rows={2}
                    value={item.description}
                    onChange={e => {
                      const items = [...form.about_services.items];
                      items[i] = { ...items[i], description: e.target.value };
                      setSection('about_services', { items });
                    }}
                  />
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── Tab: Story & Stats ─────────────────────────────────────────────── */}
      {activeTab === 'story' && (
        <div className="space-y-6">
          {/* Story */}
          <Card>
            <CardHeader><CardTitle>Story Section (Left Column)</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <SectionHeader
                title="Who We Are"
                description="Text content that appears left of the stats grid. HTML tags like <strong> are allowed in paragraphs."
              />
              <div className="grid grid-cols-2 gap-4">
                <IconSelect
                  label="Badge Icon"
                  value={form.about_story.badge_icon}
                  onChange={v => setField('about_story', 'badge_icon', v)}
                />
                <Input
                  label="Badge Text"
                  value={form.about_story.badge_text}
                  onChange={e => setField('about_story', 'badge_text', e.target.value)}
                />
              </div>
              <Input
                label="Section Heading"
                value={form.about_story.heading}
                onChange={e => setField('about_story', 'heading', e.target.value)}
              />
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-gray-700">Paragraphs (HTML allowed)</label>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() =>
                      setField('about_story', 'paragraphs', [...form.about_story.paragraphs, ''])
                    }
                  >
                    <Plus className="w-3 h-3 mr-1" /> Add
                  </Button>
                </div>
                {form.about_story.paragraphs.map((p, i) => (
                  <div key={i} className="flex gap-2 mb-2">
                    <Textarea
                      rows={3}
                      value={p}
                      onChange={e => {
                        const paragraphs = [...form.about_story.paragraphs];
                        paragraphs[i] = e.target.value;
                        setField('about_story', 'paragraphs', paragraphs);
                      }}
                    />
                    <button
                      onClick={() =>
                        setField(
                          'about_story',
                          'paragraphs',
                          form.about_story.paragraphs.filter((_, idx) => idx !== i),
                        )
                      }
                      className="text-red-400 hover:text-red-600 flex-shrink-0"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>

              {/* Highlights */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-gray-700">Highlight Badges</label>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() =>
                      setField('about_story', 'highlights', [
                        ...form.about_story.highlights,
                        { icon: 'CheckBadgeIcon', text: '', dark: false },
                      ])
                    }
                  >
                    <Plus className="w-3 h-3 mr-1" /> Add
                  </Button>
                </div>
                {form.about_story.highlights.map((h, i) => (
                  <div key={i} className="flex gap-3 items-end p-3 bg-gray-50 rounded-lg border border-gray-200 mb-2">
                    <div className="flex-1">
                      <IconSelect
                        label="Icon"
                        value={h.icon}
                        onChange={v => {
                          const highlights = [...form.about_story.highlights];
                          highlights[i] = { ...highlights[i], icon: v };
                          setField('about_story', 'highlights', highlights);
                        }}
                      />
                    </div>
                    <div className="flex-1">
                      <Input
                        label="Text"
                        value={h.text}
                        onChange={e => {
                          const highlights = [...form.about_story.highlights];
                          highlights[i] = { ...highlights[i], text: e.target.value };
                          setField('about_story', 'highlights', highlights);
                        }}
                      />
                    </div>
                    <div className="flex items-center gap-2 pb-1">
                      <input
                        type="checkbox"
                        id={`hl-dark-${i}`}
                        checked={h.dark}
                        onChange={e => {
                          const highlights = [...form.about_story.highlights];
                          highlights[i] = { ...highlights[i], dark: e.target.checked };
                          setField('about_story', 'highlights', highlights);
                        }}
                        className="rounded border-gray-300"
                      />
                      <label htmlFor={`hl-dark-${i}`} className="text-xs text-gray-600">Dark bg</label>
                    </div>
                    <button
                      onClick={() =>
                        setField(
                          'about_story',
                          'highlights',
                          form.about_story.highlights.filter((_, idx) => idx !== i),
                        )
                      }
                      className="text-red-400 hover:text-red-600 pb-1"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Stats Grid */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Stats Grid (Right Column)</CardTitle>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() =>
                    setSection('about_stats', {
                      items: [...form.about_stats.items, { icon: 'CpuChipIcon', value: '', label: '', dark: false }],
                    })
                  }
                >
                  <Plus className="w-4 h-4 mr-1" /> Add Stat
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <SectionHeader
                title="2×2 Stats Grid"
                description="Four stat boxes shown to the right of the story text. Toggle 'Dark bg' for black background cards."
              />
              {form.about_stats.items.map((stat, i) => (
                <div key={i} className="flex gap-3 items-end p-3 bg-gray-50 rounded-lg border border-gray-200">
                  <div className="w-48">
                    <IconSelect
                      label="Icon"
                      value={stat.icon}
                      onChange={v => {
                        const items = [...form.about_stats.items];
                        items[i] = { ...items[i], icon: v };
                        setSection('about_stats', { items });
                      }}
                    />
                  </div>
                  <div className="flex-1">
                    <Input
                      label="Value"
                      value={stat.value}
                      onChange={e => {
                        const items = [...form.about_stats.items];
                        items[i] = { ...items[i], value: e.target.value };
                        setSection('about_stats', { items });
                      }}
                    />
                  </div>
                  <div className="flex-1">
                    <Input
                      label="Label"
                      value={stat.label}
                      onChange={e => {
                        const items = [...form.about_stats.items];
                        items[i] = { ...items[i], label: e.target.value };
                        setSection('about_stats', { items });
                      }}
                    />
                  </div>
                  <div className="flex items-center gap-2 pb-1">
                    <input
                      type="checkbox"
                      id={`stat-dark-${i}`}
                      checked={stat.dark}
                      onChange={e => {
                        const items = [...form.about_stats.items];
                        items[i] = { ...items[i], dark: e.target.checked };
                        setSection('about_stats', { items });
                      }}
                      className="rounded border-gray-300"
                    />
                    <label htmlFor={`stat-dark-${i}`} className="text-xs text-gray-600">Dark bg</label>
                  </div>
                  <button
                    onClick={() =>
                      setSection('about_stats', {
                        items: form.about_stats.items.filter((_, idx) => idx !== i),
                      })
                    }
                    className="text-red-400 hover:text-red-600 pb-1"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── Tab: Values ────────────────────────────────────────────────────── */}
      {activeTab === 'values' && (
        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle>Values Section Header</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <Input
                label="Section Title"
                value={form.about_values.title}
                onChange={e => setField('about_values', 'title', e.target.value)}
              />
              <Input
                label="Subtitle"
                value={form.about_values.subtitle}
                onChange={e => setField('about_values', 'subtitle', e.target.value)}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Value Cards</CardTitle>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() =>
                    setSection('about_values', {
                      ...form.about_values,
                      items: [...form.about_values.items, { icon: 'ShieldCheckIcon', title: '', description: '' }],
                    })
                  }
                >
                  <Plus className="w-4 h-4 mr-1" /> Add Card
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {form.about_values.items.map((item, i) => (
                <div key={i} className="p-4 bg-gray-50 rounded-lg border border-gray-200 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-700">Card {i + 1}</span>
                    <button
                      onClick={() =>
                        setSection('about_values', {
                          ...form.about_values,
                          items: form.about_values.items.filter((_, idx) => idx !== i),
                        })
                      }
                      className="text-red-400 hover:text-red-600"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <IconSelect
                    label="Icon"
                    value={item.icon}
                    onChange={v => {
                      const items = [...form.about_values.items];
                      items[i] = { ...items[i], icon: v };
                      setSection('about_values', { ...form.about_values, items });
                    }}
                  />
                  <Input
                    label="Title"
                    value={item.title}
                    onChange={e => {
                      const items = [...form.about_values.items];
                      items[i] = { ...items[i], title: e.target.value };
                      setSection('about_values', { ...form.about_values, items });
                    }}
                  />
                  <Textarea
                    label="Description"
                    rows={2}
                    value={item.description}
                    onChange={e => {
                      const items = [...form.about_values.items];
                      items[i] = { ...items[i], description: e.target.value };
                      setSection('about_values', { ...form.about_values, items });
                    }}
                  />
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── Tab: Mission & Vision ──────────────────────────────────────────── */}
      {activeTab === 'mission' && (
        <div className="grid md:grid-cols-2 gap-6">
          {/* Mission */}
          <Card>
            <CardHeader><CardTitle>Mission Card (Dark)</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <IconSelect
                label="Icon"
                value={form.about_mission.icon}
                onChange={v => setField('about_mission', 'icon', v)}
              />
              <Input
                label="Title"
                value={form.about_mission.title}
                onChange={e => setField('about_mission', 'title', e.target.value)}
              />
              <Textarea
                label="Body Text"
                rows={4}
                value={form.about_mission.text}
                onChange={e => setField('about_mission', 'text', e.target.value)}
              />
            </CardContent>
          </Card>

          {/* Vision */}
          <Card>
            <CardHeader><CardTitle>Vision Card (Light)</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <IconSelect
                label="Icon"
                value={form.about_vision.icon}
                onChange={v => setField('about_vision', 'icon', v)}
              />
              <Input
                label="Title"
                value={form.about_vision.title}
                onChange={e => setField('about_vision', 'title', e.target.value)}
              />
              <Textarea
                label="Body Text"
                rows={4}
                value={form.about_vision.text}
                onChange={e => setField('about_vision', 'text', e.target.value)}
              />
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── Tab: Team ──────────────────────────────────────────────────────── */}
      {activeTab === 'team' && (
        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle>Team Section Header</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <Input
                label="Section Title"
                value={form.about_team.title}
                onChange={e => setField('about_team', 'title', e.target.value)}
              />
              <Input
                label="Subtitle"
                value={form.about_team.subtitle}
                onChange={e => setField('about_team', 'subtitle', e.target.value)}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Team Members</CardTitle>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() =>
                    setSection('about_team', {
                      ...form.about_team,
                      members: [...form.about_team.members, { name: '', role: '', initials: '' }],
                    })
                  }
                >
                  <Plus className="w-4 h-4 mr-1" /> Add Member
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {form.about_team.members.map((member, i) => (
                <div key={i} className="flex gap-3 items-end p-3 bg-gray-50 rounded-lg border border-gray-200">
                  <div className="flex-1">
                    <Input
                      label="Name"
                      value={member.name}
                      onChange={e => {
                        const members = [...form.about_team.members];
                        members[i] = { ...members[i], name: e.target.value };
                        setSection('about_team', { ...form.about_team, members });
                      }}
                    />
                  </div>
                  <div className="flex-1">
                    <Input
                      label="Role"
                      value={member.role}
                      onChange={e => {
                        const members = [...form.about_team.members];
                        members[i] = { ...members[i], role: e.target.value };
                        setSection('about_team', { ...form.about_team, members });
                      }}
                    />
                  </div>
                  <div className="w-24">
                    <Input
                      label="Initials"
                      value={member.initials}
                      maxLength={3}
                      onChange={e => {
                        const members = [...form.about_team.members];
                        members[i] = { ...members[i], initials: e.target.value };
                        setSection('about_team', { ...form.about_team, members });
                      }}
                    />
                  </div>
                  <button
                    onClick={() =>
                      setSection('about_team', {
                        ...form.about_team,
                        members: form.about_team.members.filter((_, idx) => idx !== i),
                      })
                    }
                    className="text-red-400 hover:text-red-600 pb-1"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── Tab: CTA ───────────────────────────────────────────────────────── */}
      {activeTab === 'cta' && (
        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle>CTA Section Header</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <Input
                label="Title"
                value={form.about_cta.title}
                onChange={e => setField('about_cta', 'title', e.target.value)}
              />
              <Textarea
                label="Body Text"
                rows={3}
                value={form.about_cta.text}
                onChange={e => setField('about_cta', 'text', e.target.value)}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>CTA Buttons</CardTitle>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() =>
                    setSection('about_cta', {
                      ...form.about_cta,
                      buttons: [...form.about_cta.buttons, { icon: 'CpuChipIcon', label: '', href: '/', variant: 'light' }],
                    })
                  }
                >
                  <Plus className="w-4 h-4 mr-1" /> Add Button
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {form.about_cta.buttons.map((btn, i) => (
                <div key={i} className="flex gap-3 items-end p-3 bg-gray-50 rounded-lg border border-gray-200">
                  <div className="w-52">
                    <IconSelect
                      label="Icon"
                      value={btn.icon}
                      onChange={v => {
                        const buttons = [...form.about_cta.buttons];
                        buttons[i] = { ...buttons[i], icon: v };
                        setSection('about_cta', { ...form.about_cta, buttons });
                      }}
                    />
                  </div>
                  <div className="flex-1">
                    <Input
                      label="Label"
                      value={btn.label}
                      onChange={e => {
                        const buttons = [...form.about_cta.buttons];
                        buttons[i] = { ...buttons[i], label: e.target.value };
                        setSection('about_cta', { ...form.about_cta, buttons });
                      }}
                    />
                  </div>
                  <div className="flex-1">
                    <Input
                      label="Link (href)"
                      value={btn.href}
                      onChange={e => {
                        const buttons = [...form.about_cta.buttons];
                        buttons[i] = { ...buttons[i], href: e.target.value };
                        setSection('about_cta', { ...form.about_cta, buttons });
                      }}
                    />
                  </div>
                  <div className="w-32">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Variant</label>
                    <select
                      value={btn.variant}
                      onChange={e => {
                        const buttons = [...form.about_cta.buttons];
                        buttons[i] = { ...buttons[i], variant: e.target.value as 'light' | 'dark' | 'outline' };
                        setSection('about_cta', { ...form.about_cta, buttons });
                      }}
                      className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none"
                    >
                      <option value="light">Light (white)</option>
                      <option value="dark">Dark (gray-700)</option>
                      <option value="outline">Outline</option>
                    </select>
                  </div>
                  <button
                    onClick={() =>
                      setSection('about_cta', {
                        ...form.about_cta,
                        buttons: form.about_cta.buttons.filter((_, idx) => idx !== i),
                      })
                    }
                    className="text-red-400 hover:text-red-600 pb-1"
                  >
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
