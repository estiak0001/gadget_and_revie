'use client';

import React, { useEffect, useState } from 'react';
import {
  Save, Plus, Trash2, RefreshCw, AlertCircle, Phone, Mail, MapPin,
  Clock, Tag, Newspaper, LayoutGrid, ChevronDown, ChevronUp, Megaphone, PanelBottom,
} from 'lucide-react';
import { AdminLayout } from '@/components/layout';
import {
  Card, CardContent, CardHeader, CardTitle, Button, Input, Textarea,
  Badge, LoadingSpinner, ErrorState,
} from '@/components/ui';
import { getErrorMessage } from '@/lib/utils';
import adminService from '@/lib/adminService';
import api from '@/lib/api';
import toast from 'react-hot-toast';

// ── Types ────────────────────────────────────────────────────────────────────

interface ServiceCard {
  badge: string;
  title: string;
  description: string;
  features: string[];
  stat1_value: string;
  stat1_label: string;
  stat2_value: string;
  stat2_label: string;
  cta_text: string;
  cta_link: string;
}

interface HomepageSettings {
  // Topbar
  topbar_phone: string;
  topbar_email: string;
  topbar_address: string;
  topbar_hours: string;
  topbar_promo_text: string;
  // Homepage
  news_ticker_items: string[];
  homepage_service_cards: ServiceCard[];
  // CTA Section
  cta_badge_text: string;
  cta_title: string;
  cta_description: string;
  cta_primary_button_text: string;
  cta_primary_button_link: string;
  cta_trust_indicators: string[];
  // Footer
  footer_brand_description: string;
  footer_cta_tagline: string;
  footer_cta_button_text: string;
  footer_cta_button_link: string;
  footer_email: string;
  footer_copyright: string;
  footer_nav_links: { name: string; href: string }[];
}

const DEFAULT_CARD: ServiceCard = {
  badge: '⭐ New',
  title: 'Service Title',
  description: 'Service description here.',
  features: ['Feature 1', 'Feature 2', 'Feature 3'],
  stat1_value: '100+',
  stat1_label: 'Label',
  stat2_value: '$99+',
  stat2_label: 'From',
  cta_text: 'Learn More',
  cta_link: '/services',
};

// ── Component ────────────────────────────────────────────────────────────────

export default function HomepageCmsPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [expandedCard, setExpandedCard] = useState<number | null>(0);
  const [activeTab, setActiveTab] = useState<'topbar' | 'ticker' | 'cards' | 'cta' | 'footer'>('topbar');

  const [form, setForm] = useState<HomepageSettings>({
    topbar_phone: '',
    topbar_email: '',
    topbar_address: '',
    topbar_hours: '',
    topbar_promo_text: '',
    news_ticker_items: [],
    homepage_service_cards: [],
    cta_badge_text: '',
    cta_title: '',
    cta_description: '',
    cta_primary_button_text: '',
    cta_primary_button_link: '',
    cta_trust_indicators: [],
    footer_brand_description: '',
    footer_cta_tagline: '',
    footer_cta_button_text: '',
    footer_cta_button_link: '',
    footer_email: '',
    footer_copyright: '',
    footer_nav_links: [],
  });
  const [originalForm, setOriginalForm] = useState<HomepageSettings>(form);

  const hasChanges = JSON.stringify(form) !== JSON.stringify(originalForm);

  // ── Data loading ─────────────────────────────────────────────────────────

  const loadSettings = async () => {
    setIsLoading(true);
    setHasError(false);
    try {
      const res = await adminService.getSettings();
      const data = (res.data?.data || res.data || {}) as unknown as Record<string, Record<string, string>>;

      const topbar = data.topbar || {};
      const homepage = data.homepage || {};

      let newsItems: string[] = [];
      try {
        const rawTicker = homepage.news_ticker_items;
        newsItems = Array.isArray(rawTicker)
          ? rawTicker
          : rawTicker
            ? JSON.parse(rawTicker)
            : [];
      } catch { newsItems = []; }

      let serviceCards: ServiceCard[] = [];
      try {
        const rawCards = homepage.homepage_service_cards;
        serviceCards = Array.isArray(rawCards)
          ? rawCards
          : rawCards
            ? JSON.parse(rawCards)
            : [];
      } catch { serviceCards = []; }

      let trustIndicators: string[] = [];
      try {
        const rawTrust = homepage.cta_trust_indicators;
        trustIndicators = Array.isArray(rawTrust)
          ? rawTrust
          : rawTrust
            ? JSON.parse(rawTrust)
            : [];
      } catch { trustIndicators = []; }

      const loaded: HomepageSettings = {
        topbar_phone: topbar.topbar_phone || '',
        topbar_email: topbar.topbar_email || '',
        topbar_address: topbar.topbar_address || '',
        topbar_hours: topbar.topbar_hours || '',
        topbar_promo_text: topbar.topbar_promo_text || '',
        news_ticker_items: newsItems,
        homepage_service_cards: serviceCards,
        cta_badge_text: homepage.cta_badge_text || '',
        cta_title: homepage.cta_title || '',
        cta_description: homepage.cta_description || '',
        cta_primary_button_text: homepage.cta_primary_button_text || '',
        cta_primary_button_link: homepage.cta_primary_button_link || '',
        cta_trust_indicators: trustIndicators,
        footer_brand_description: (data.footer || {}).footer_brand_description || '',
        footer_cta_tagline: (data.footer || {}).footer_cta_tagline || '',
        footer_cta_button_text: (data.footer || {}).footer_cta_button_text || '',
        footer_cta_button_link: (data.footer || {}).footer_cta_button_link || '',
        footer_email: (data.footer || {}).footer_email || '',
        footer_copyright: (data.footer || {}).footer_copyright || '',
        footer_nav_links: (() => {
          try {
            const raw = (data.footer || {}).footer_nav_links;
            return Array.isArray(raw) ? raw : raw ? JSON.parse(raw) : [];
          } catch { return []; }
        })(),
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

  // ── Save ─────────────────────────────────────────────────────────────────

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const settingsList = [
        { key: 'topbar_phone', value: form.topbar_phone, group: 'topbar' },
        { key: 'topbar_email', value: form.topbar_email, group: 'topbar' },
        { key: 'topbar_address', value: form.topbar_address, group: 'topbar' },
        { key: 'topbar_hours', value: form.topbar_hours, group: 'topbar' },
        { key: 'topbar_promo_text', value: form.topbar_promo_text, group: 'topbar' },
        { key: 'news_ticker_items', value: JSON.stringify(form.news_ticker_items), group: 'homepage', type: 'json' },
        { key: 'homepage_service_cards', value: JSON.stringify(form.homepage_service_cards), group: 'homepage', type: 'json' },
        { key: 'cta_badge_text', value: form.cta_badge_text, group: 'homepage' },
        { key: 'cta_title', value: form.cta_title, group: 'homepage' },
        { key: 'cta_description', value: form.cta_description, group: 'homepage' },
        { key: 'cta_primary_button_text', value: form.cta_primary_button_text, group: 'homepage' },
        { key: 'cta_primary_button_link', value: form.cta_primary_button_link, group: 'homepage' },
        { key: 'cta_trust_indicators', value: JSON.stringify(form.cta_trust_indicators), group: 'homepage', type: 'json' },
        { key: 'footer_brand_description', value: form.footer_brand_description, group: 'footer' },
        { key: 'footer_cta_tagline', value: form.footer_cta_tagline, group: 'footer' },
        { key: 'footer_cta_button_text', value: form.footer_cta_button_text, group: 'footer' },
        { key: 'footer_cta_button_link', value: form.footer_cta_button_link, group: 'footer' },
        { key: 'footer_email', value: form.footer_email, group: 'footer' },
        { key: 'footer_copyright', value: form.footer_copyright, group: 'footer' },
        { key: 'footer_nav_links', value: JSON.stringify(form.footer_nav_links), group: 'footer', type: 'json' },
      ];

      // Send group and type with each setting so the backend preserves them correctly
      const settingsPayload = Object.fromEntries(
        settingsList.map(s => [s.key, { key: s.key, value: s.value, group: s.group, ...('type' in s ? { type: s.type } : {}) }])
      );
      await api.put('/admin/settings', { settings: settingsPayload });

      toast.success('Homepage settings saved successfully');
      setOriginalForm({ ...form });
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setIsSaving(false);
    }
  };

  // ── Form helpers ─────────────────────────────────────────────────────────

  const setTopbar = (key: keyof HomepageSettings, value: string) =>
    setForm(prev => ({ ...prev, [key]: value }));

  const setTickerItem = (index: number, value: string) =>
    setForm(prev => {
      const items = [...prev.news_ticker_items];
      items[index] = value;
      return { ...prev, news_ticker_items: items };
    });

  const addTickerItem = () =>
    setForm(prev => ({ ...prev, news_ticker_items: [...prev.news_ticker_items, ''] }));

  const removeTickerItem = (index: number) =>
    setForm(prev => ({
      ...prev,
      news_ticker_items: prev.news_ticker_items.filter((_, i) => i !== index),
    }));

  const setCardField = (cardIndex: number, field: keyof ServiceCard, value: string | string[]) =>
    setForm(prev => {
      const cards = prev.homepage_service_cards.map((card, i) =>
        i === cardIndex ? { ...card, [field]: value } : card
      );
      return { ...prev, homepage_service_cards: cards };
    });

  const setCardFeature = (cardIndex: number, featIndex: number, value: string) =>
    setForm(prev => {
      const cards = prev.homepage_service_cards.map((card, i) => {
        if (i !== cardIndex) return card;
        const features = [...card.features];
        features[featIndex] = value;
        return { ...card, features };
      });
      return { ...prev, homepage_service_cards: cards };
    });

  const addCardFeature = (cardIndex: number) =>
    setForm(prev => {
      const cards = prev.homepage_service_cards.map((card, i) =>
        i === cardIndex ? { ...card, features: [...card.features, ''] } : card
      );
      return { ...prev, homepage_service_cards: cards };
    });

  const removeCardFeature = (cardIndex: number, featIndex: number) =>
    setForm(prev => {
      const cards = prev.homepage_service_cards.map((card, i) =>
        i === cardIndex
          ? { ...card, features: card.features.filter((_, fi) => fi !== featIndex) }
          : card
      );
      return { ...prev, homepage_service_cards: cards };
    });

  const addCard = () =>
    setForm(prev => ({
      ...prev,
      homepage_service_cards: [...prev.homepage_service_cards, { ...DEFAULT_CARD }],
    }));

  const removeCard = (index: number) =>
    setForm(prev => ({
      ...prev,
      homepage_service_cards: prev.homepage_service_cards.filter((_, i) => i !== index),
    }));

  const setTrustIndicator = (index: number, value: string) =>
    setForm(prev => {
      const items = [...prev.cta_trust_indicators];
      items[index] = value;
      return { ...prev, cta_trust_indicators: items };
    });

  const addTrustIndicator = () =>
    setForm(prev => ({ ...prev, cta_trust_indicators: [...prev.cta_trust_indicators, ''] }));

  const removeTrustIndicator = (index: number) =>
    setForm(prev => ({
      ...prev,
      cta_trust_indicators: prev.cta_trust_indicators.filter((_, i) => i !== index),
    }));

  const setNavLink = (index: number, field: 'name' | 'href', value: string) =>
    setForm(prev => {
      const links = prev.footer_nav_links.map((l, i) => i === index ? { ...l, [field]: value } : l);
      return { ...prev, footer_nav_links: links };
    });

  const addNavLink = () =>
    setForm(prev => ({ ...prev, footer_nav_links: [...prev.footer_nav_links, { name: '', href: '' }] }));

  const removeNavLink = (index: number) =>
    setForm(prev => ({
      ...prev,
      footer_nav_links: prev.footer_nav_links.filter((_, i) => i !== index),
    }));

  // ── Render ───────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-64">
          <LoadingSpinner size="lg" text="Loading homepage settings..." />
        </div>
      </AdminLayout>
    );
  }

  if (hasError) {
    return (
      <AdminLayout>
        <ErrorState title="Failed to load homepage settings" onRetry={loadSettings} />
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      {/* Header */}
      <div className="page-header flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
        <div>
          <h1 className="page-title">Homepage CMS</h1>
          <p className="page-description">Control topbar info, news ticker, and service cards displayed on the homepage</p>
        </div>
        {hasChanges && (
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-yellow-600 text-sm">
              <AlertCircle className="w-4 h-4" />
              Unsaved changes
            </div>
            <Button variant="outline" onClick={() => setForm({ ...originalForm })}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Reset
            </Button>
            <Button onClick={handleSave} isLoading={isSaving}>
              <Save className="w-4 h-4 mr-2" />
              Save All Changes
            </Button>
          </div>
        )}
        {!hasChanges && (
          <Button onClick={handleSave} isLoading={isSaving} variant="secondary">
            <Save className="w-4 h-4 mr-2" />
            Save
          </Button>
        )}
      </div>

      {/* ── Tab Navigation ───────────────────────────────────────────────── */}
      <div className="flex gap-1 border-b border-gray-200 mb-6 overflow-x-auto">
        {([
          { id: 'topbar', label: 'Topbar', icon: <Phone className="w-4 h-4" /> },
          { id: 'ticker', label: 'News Ticker', icon: <Newspaper className="w-4 h-4" /> },
          { id: 'cards', label: 'Service Cards', icon: <LayoutGrid className="w-4 h-4" /> },
          { id: 'cta', label: 'CTA Section', icon: <Megaphone className="w-4 h-4" /> },
          { id: 'footer', label: 'Footer', icon: <PanelBottom className="w-4 h-4" /> },
        ] as const).map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
              activeTab === tab.id
                ? 'border-primary-600 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      <div className="space-y-6">
        {/* ── Section 1: Topbar ───────────────────────────────────────────── */}
        {activeTab === 'topbar' && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Phone className="w-5 h-5 text-blue-600" />
                Topbar Contact Info
              </CardTitle>
              <p className="text-sm text-gray-500">Information displayed in the top navigation bar</p>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-start gap-3">
                  <Phone className="w-4 h-4 text-gray-400 mt-2.5 flex-shrink-0" />
                  <Input
                    label="Phone Number"
                    value={form.topbar_phone}
                    onChange={e => setTopbar('topbar_phone', e.target.value)}
                    placeholder="+880 1711-123456"
                  />
                </div>
                <div className="flex items-start gap-3">
                  <Mail className="w-4 h-4 text-gray-400 mt-2.5 flex-shrink-0" />
                  <Input
                    label="Email Address"
                    value={form.topbar_email}
                    onChange={e => setTopbar('topbar_email', e.target.value)}
                    placeholder="support@example.com"
                  />
                </div>
                <div className="flex items-start gap-3">
                  <MapPin className="w-4 h-4 text-gray-400 mt-2.5 flex-shrink-0" />
                  <Input
                    label="Address"
                    value={form.topbar_address}
                    onChange={e => setTopbar('topbar_address', e.target.value)}
                    placeholder="Dhanmondi, Dhaka"
                  />
                </div>
                <div className="flex items-start gap-3">
                  <Clock className="w-4 h-4 text-gray-400 mt-2.5 flex-shrink-0" />
                  <Input
                    label="Business Hours"
                    value={form.topbar_hours}
                    onChange={e => setTopbar('topbar_hours', e.target.value)}
                    placeholder="Sat-Thu: 10AM-8PM"
                  />
                </div>
                <div className="flex items-start gap-3 md:col-span-2">
                  <Tag className="w-4 h-4 text-gray-400 mt-2.5 flex-shrink-0" />
                  <Input
                    label="Promo Badge Text"
                    value={form.topbar_promo_text}
                    onChange={e => setTopbar('topbar_promo_text', e.target.value)}
                    placeholder="Free Diagnosis"
                    className="max-w-sm"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ── Section 2: News Ticker ───────────────────────────────────────── */}
        {activeTab === 'ticker' && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Newspaper className="w-5 h-5 text-green-600" />
                    News Ticker
                  </CardTitle>
                  <p className="text-sm text-gray-500 mt-1">Scrolling announcement text below the promo carousel</p>
                </div>
                <Button size="sm" onClick={addTickerItem}>
                  <Plus className="w-4 h-4 mr-1" />
                  Add Item
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {form.news_ticker_items.length === 0 ? (
                <div className="text-center py-8 text-gray-400">
                  <Newspaper className="w-8 h-8 mx-auto mb-2 opacity-40" />
                  <p className="text-sm">No ticker items. Click "Add Item" to add one.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {form.news_ticker_items.map((item, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <span className="text-sm text-gray-400 w-6 text-right flex-shrink-0">{idx + 1}.</span>
                      <input
                        value={item}
                        onChange={e => setTickerItem(idx, e.target.value)}
                        placeholder="News ticker announcement text..."
                        className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      />
                      <button
                        type="button"
                        onClick={() => removeTickerItem(idx)}
                        className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* ── Section 3: Service Cards ─────────────────────────────────────── */}
        {activeTab === 'cards' && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <LayoutGrid className="w-5 h-5 text-purple-600" />
                    Hero Service Cards
                  </CardTitle>
                  <p className="text-sm text-gray-500 mt-1">Service cards shown in the hero section — add or remove as needed</p>
                </div>
                <Button size="sm" onClick={addCard}>
                  <Plus className="w-4 h-4 mr-1" />
                  Add Card
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {form.homepage_service_cards.length === 0 ? (
                <div className="text-center py-8 text-gray-400">
                  <LayoutGrid className="w-8 h-8 mx-auto mb-2 opacity-40" />
                  <p className="text-sm">No service cards configured.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {form.homepage_service_cards.map((card, cardIdx) => (
                    <div key={cardIdx} className="border border-gray-200 rounded-xl overflow-hidden">
                      <div
                        className="flex items-center justify-between px-4 py-3 bg-gray-50 cursor-pointer hover:bg-gray-100 transition-colors"
                        onClick={() => setExpandedCard(expandedCard === cardIdx ? null : cardIdx)}
                      >
                        <div className="flex items-center gap-3">
                          <span className="w-7 h-7 bg-primary-100 text-primary-700 rounded-full flex items-center justify-center text-sm font-bold">
                            {cardIdx + 1}
                          </span>
                          <div>
                            <p className="font-medium text-gray-900">{card.title || 'Untitled Card'}</p>
                            <p className="text-xs text-gray-400">{card.badge} · CTA: {card.cta_text}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={e => { e.stopPropagation(); removeCard(cardIdx); }}
                            className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                          {expandedCard === cardIdx ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                        </div>
                      </div>

                      {expandedCard === cardIdx && (
                        <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                          <Input
                            label="Badge Text"
                            value={card.badge}
                            onChange={e => setCardField(cardIdx, 'badge', e.target.value)}
                            placeholder="🔥 Priority"
                          />
                          <Input
                            label="Card Title"
                            value={card.title}
                            onChange={e => setCardField(cardIdx, 'title', e.target.value)}
                            placeholder="Data Recovery"
                          />
                          <div className="md:col-span-2">
                            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                            <textarea
                              value={card.description}
                              onChange={e => setCardField(cardIdx, 'description', e.target.value)}
                              rows={2}
                              placeholder="Short service description..."
                              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
                            />
                          </div>
                          <div className="md:col-span-2">
                            <div className="flex items-center justify-between mb-2">
                              <label className="block text-sm font-medium text-gray-700">Key Features</label>
                              <button
                                type="button"
                                onClick={() => addCardFeature(cardIdx)}
                                className="flex items-center gap-1 text-xs text-primary-600 hover:text-primary-700 font-medium px-2 py-1 rounded hover:bg-primary-50 transition-colors"
                              >
                                <Plus className="w-3.5 h-3.5" />
                                Add Feature
                              </button>
                            </div>
                            {(card.features || []).length === 0 ? (
                              <p className="text-xs text-gray-400 italic py-2">No features added. Click "Add Feature" to add one.</p>
                            ) : (
                              <div className="space-y-2">
                                {(card.features || []).map((feat, featIdx) => (
                                  <div key={featIdx} className="flex items-center gap-2">
                                    <input
                                      value={feat}
                                      onChange={e => setCardFeature(cardIdx, featIdx, e.target.value)}
                                      placeholder={`Feature ${featIdx + 1}`}
                                      className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                                    />
                                    <button
                                      type="button"
                                      onClick={() => removeCardFeature(cardIdx, featIdx)}
                                      className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors flex-shrink-0"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <Input label="Stat 1 Value" value={card.stat1_value} onChange={e => setCardField(cardIdx, 'stat1_value', e.target.value)} placeholder="98%" />
                            <Input label="Stat 1 Label" value={card.stat1_label} onChange={e => setCardField(cardIdx, 'stat1_label', e.target.value)} placeholder="Success" />
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <Input label="Stat 2 Value" value={card.stat2_value} onChange={e => setCardField(cardIdx, 'stat2_value', e.target.value)} placeholder="$199+" />
                            <Input label="Stat 2 Label" value={card.stat2_label} onChange={e => setCardField(cardIdx, 'stat2_label', e.target.value)} placeholder="From" />
                          </div>
                          <Input label="CTA Button Text" value={card.cta_text} onChange={e => setCardField(cardIdx, 'cta_text', e.target.value)} placeholder="Get Started" />
                          <Input label="CTA Link" value={card.cta_link} onChange={e => setCardField(cardIdx, 'cta_link', e.target.value)} placeholder="/services" />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* ── Section 4: CTA Section ──────────────────────────────────────── */}
        {activeTab === 'cta' && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Megaphone className="w-5 h-5 text-orange-600" />
                CTA Section
              </CardTitle>
              <p className="text-sm text-gray-500 mt-1">Call-to-action block shown near the bottom of the homepage</p>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  label="Badge Text"
                  value={form.cta_badge_text}
                  onChange={e => setForm(prev => ({ ...prev, cta_badge_text: e.target.value }))}
                  placeholder="Professional Repair Services"
                />
                <Input
                  label="Section Title"
                  value={form.cta_title}
                  onChange={e => setForm(prev => ({ ...prev, cta_title: e.target.value }))}
                  placeholder="Ready to Fix Your Device?"
                />
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                  <textarea
                    value={form.cta_description}
                    onChange={e => setForm(prev => ({ ...prev, cta_description: e.target.value }))}
                    rows={2}
                    placeholder="Short description below the title..."
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
                  />
                </div>
                <Input
                  label="Primary Button Text"
                  value={form.cta_primary_button_text}
                  onChange={e => setForm(prev => ({ ...prev, cta_primary_button_text: e.target.value }))}
                  placeholder="Book Service"
                />
                <Input
                  label="Primary Button Link"
                  value={form.cta_primary_button_link}
                  onChange={e => setForm(prev => ({ ...prev, cta_primary_button_link: e.target.value }))}
                  placeholder="/services"
                />
                <div className="md:col-span-2">
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-medium text-gray-700">Trust Indicators</label>
                    <button
                      type="button"
                      onClick={addTrustIndicator}
                      className="flex items-center gap-1 text-xs text-primary-600 hover:text-primary-700 font-medium px-2 py-1 rounded hover:bg-primary-50 transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Add Indicator
                    </button>
                  </div>
                  {form.cta_trust_indicators.length === 0 ? (
                    <p className="text-xs text-gray-400 italic py-2">No trust indicators. Click "Add Indicator" to add one.</p>
                  ) : (
                    <div className="space-y-2">
                      {form.cta_trust_indicators.map((item, idx) => (
                        <div key={idx} className="flex items-center gap-2">
                          <span className="text-sm text-gray-400 w-6 text-right flex-shrink-0">{idx + 1}.</span>
                          <input
                            value={item}
                            onChange={e => setTrustIndicator(idx, e.target.value)}
                            placeholder="e.g. Free Diagnosis"
                            className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                          />
                          <button
                            type="button"
                            onClick={() => removeTrustIndicator(idx)}
                            className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  <p className="text-xs text-gray-400 mt-2">Phone number shown next to the button is pulled from Topbar &gt; Phone Number above.</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ── Section 5: Footer ───────────────────────────────────────────── */}
        {activeTab === 'footer' && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <PanelBottom className="w-5 h-5 text-gray-600" />
                Footer
              </CardTitle>
              <p className="text-sm text-gray-500">Content shown in the site-wide footer. Phone, address &amp; hours are shared with Topbar above.</p>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Brand Description</label>
                  <textarea
                    value={form.footer_brand_description}
                    onChange={e => setForm(prev => ({ ...prev, footer_brand_description: e.target.value }))}
                    rows={2}
                    placeholder="Your trusted partner for..."
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
                  />
                </div>
                <Input
                  label="CTA Tagline"
                  value={form.footer_cta_tagline}
                  onChange={e => setForm(prev => ({ ...prev, footer_cta_tagline: e.target.value }))}
                  placeholder="Need help with your device?"
                />
                <Input
                  label="CTA Button Text"
                  value={form.footer_cta_button_text}
                  onChange={e => setForm(prev => ({ ...prev, footer_cta_button_text: e.target.value }))}
                  placeholder="Get in Touch"
                />
                <Input
                  label="CTA Button Link"
                  value={form.footer_cta_button_link}
                  onChange={e => setForm(prev => ({ ...prev, footer_cta_button_link: e.target.value }))}
                  placeholder="/contact"
                />
                <div className="flex items-start gap-3">
                  <Mail className="w-4 h-4 text-gray-400 mt-2.5 flex-shrink-0" />
                  <Input
                    label="Footer Email"
                    value={form.footer_email}
                    onChange={e => setForm(prev => ({ ...prev, footer_email: e.target.value }))}
                    placeholder="info@gadgetrevive.com"
                  />
                </div>
                <div className="md:col-span-2">
                  <Input
                    label="Copyright Text"
                    value={form.footer_copyright}
                    onChange={e => setForm(prev => ({ ...prev, footer_copyright: e.target.value }))}
                    placeholder="© 2026 Gadget Revive · Dhaka, Bangladesh"
                  />
                </div>
                <div className="md:col-span-2">
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-medium text-gray-700">Navigation Links</label>
                    <button
                      type="button"
                      onClick={addNavLink}
                      className="flex items-center gap-1 text-xs text-primary-600 hover:text-primary-700 font-medium px-2 py-1 rounded hover:bg-primary-50 transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Add Link
                    </button>
                  </div>
                  {form.footer_nav_links.length === 0 ? (
                    <p className="text-xs text-gray-400 italic py-2">No links. Click "Add Link" to add one.</p>
                  ) : (
                    <div className="space-y-2">
                      {form.footer_nav_links.map((link, idx) => (
                        <div key={idx} className="flex items-center gap-2">
                          <span className="text-sm text-gray-400 w-6 text-right flex-shrink-0">{idx + 1}.</span>
                          <input
                            value={link.name}
                            onChange={e => setNavLink(idx, 'name', e.target.value)}
                            placeholder="Label (e.g. About)"
                            className="w-32 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                          />
                          <input
                            value={link.href}
                            onChange={e => setNavLink(idx, 'href', e.target.value)}
                            placeholder="URL (e.g. /about)"
                            className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                          />
                          <button
                            type="button"
                            onClick={() => removeNavLink(idx)}
                            className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors flex-shrink-0"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Save Footer */}
        {hasChanges && (
          <div className="sticky bottom-4 flex justify-end">
            <div className="bg-white border border-gray-200 shadow-lg rounded-xl px-4 py-3 flex items-center gap-3">
              <div className="flex items-center gap-2 text-yellow-600 text-sm">
                <AlertCircle className="w-4 h-4" />
                You have unsaved changes
              </div>
              <Button variant="outline" size="sm" onClick={() => setForm({ ...originalForm })}>
                Discard
              </Button>
              <Button size="sm" onClick={handleSave} isLoading={isSaving}>
                <Save className="w-4 h-4 mr-2" />
                Save Changes
              </Button>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
