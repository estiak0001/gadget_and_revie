import { apiClient } from './config';

// ── Types ────────────────────────────────────────────────────────────────────

export interface CmsBanner {
  id: number;
  title: string;
  subtitle?: string;
  image: string | null;
  link_url?: string;
  link_text?: string;
  position: string;
  sort_order: number;
  is_active: boolean;
  meta?: {
    gradient_from?: string;
    gradient_to?: string;
    icon?: string;
  } | null;
}

export interface ServiceCard {
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

export interface TopbarSettings {
  topbar_phone?: string;
  topbar_email?: string;
  topbar_address?: string;
  topbar_hours?: string;
  topbar_promo_text?: string;
}

export interface CtaSettings {
  cta_badge_text?: string;
  cta_title?: string;
  cta_description?: string;
  cta_primary_button_text?: string;
  cta_primary_button_link?: string;
  cta_trust_indicators?: string[];
}

export interface HomepageCmsData {
  promo_sliders: CmsBanner[];
  side_banners: CmsBanner[];
  cms_settings: TopbarSettings & CtaSettings & {
    news_ticker_items?: string[];
    homepage_service_cards?: ServiceCard[];
  };
  statistics: {
    total_vendors: number;
    total_services: number;
    total_products: number;
    happy_customers: number;
  };
}

// ── API functions ────────────────────────────────────────────────────────────

export interface CmsPage {
  id: number;
  title: string;
  slug: string;
  content: string;
  meta_title?: string;
  meta_description?: string;
  meta_keywords?: string;
  featured_image?: string;
  status: 'published' | 'draft';
  page_type?: string;
  published_at?: string;
  updated_at: string;
}

/** Lighter shape returned by the /public/pages list endpoint — no `content` body. */
export interface CmsPageSummary {
  slug: string;
  title: string;
  meta_description: string | null;
  featured_image: string | null;
  page_type: string;
  published_at: string | null;
  updated_at: string;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';

// ── About page CMS types ─────────────────────────────────────────────────────

export interface AboutHero {
  badge_icon: string;
  badge_text: string;
  title: string;
  subtitle: string;
}
export interface AboutServiceItem { icon: string; title: string; description: string }
export interface AboutServices { items: AboutServiceItem[] }
export interface AboutStoryHighlight { icon: string; text: string; dark: boolean }
export interface AboutStory {
  badge_icon: string;
  badge_text: string;
  heading: string;
  paragraphs: string[];
  highlights: AboutStoryHighlight[];
}
export interface AboutStatItem { icon: string; value: string; label: string; dark: boolean }
export interface AboutStats { items: AboutStatItem[] }
export interface AboutValueItem { icon: string; title: string; description: string }
export interface AboutValues { title: string; subtitle: string; items: AboutValueItem[] }
export interface AboutMission { icon: string; title: string; text: string }
export interface AboutVision { icon: string; title: string; text: string }
export interface AboutTeamMember { name: string; role: string; initials: string }
export interface AboutTeam { title: string; subtitle: string; members: AboutTeamMember[] }
export interface AboutCtaButton { icon: string; label: string; href: string; variant: 'light' | 'dark' | 'outline' }
export interface AboutCta { title: string; text: string; buttons: AboutCtaButton[] }

export interface AboutPageCmsData {
  about_hero?: AboutHero;
  about_services?: AboutServices;
  about_story?: AboutStory;
  about_stats?: AboutStats;
  about_values?: AboutValues;
  about_mission?: AboutMission;
  about_vision?: AboutVision;
  about_team?: AboutTeam;
  about_cta?: AboutCta;
}

export const cmsService = {
  /**
   * Fetch a single published CMS page by slug.
   * Uses native fetch (not apiClient) so it works in server components.
   */
  getPage: async (slug: string): Promise<CmsPage | null> => {
    try {
      const res = await fetch(`${API_BASE}/public/pages/${slug}`, {
        headers: { Accept: 'application/json' },
        next: { revalidate: 60 },
      });
      if (!res.ok) return null;
      const json = await res.json();
      return json?.data || null;
    } catch {
      return null;
    }
  },

  /**
   * Published buying-guide / repair-advice articles — reuses the same CMS pages system as
   * every other static page, distinguished only by page_type='guide'. Uses native fetch (not
   * apiClient) so it works in server components.
   */
  getGuides: async (): Promise<CmsPageSummary[]> => {
    try {
      const res = await fetch(`${API_BASE}/public/pages?page_type=guide`, {
        headers: { Accept: 'application/json' },
        next: { revalidate: 300 },
      });
      if (!res.ok) return [];
      const json = await res.json();
      return Array.isArray(json?.data) ? json.data : [];
    } catch {
      return [];
    }
  },

  /**
   * Fetch all public settings (topbar, homepage, general, contact, social)
   */
  getSettings: async (): Promise<Record<string, unknown>> => {
    const res = await apiClient.get('/public/settings');
    return res.data?.data || {};
  },

  /**
   * Fetch active banners, optionally by position
   */
  getBanners: async (position?: string): Promise<CmsBanner[]> => {
    const params = position ? { position } : {};
    const res = await apiClient.get('/public/banners', { params });
    return res.data?.data || [];
  },

  /**
   * Fetch full homepage data in one request
   */
  getHomepageData: async (): Promise<HomepageCmsData | null> => {
    try {
      const res = await apiClient.get('/public/home');
      return res.data?.data || null;
    } catch {
      return null;
    }
  },

  /**
   * Fetch about page CMS settings
   */
  getAboutPageData: async (): Promise<AboutPageCmsData> => {
    try {
      const res = await apiClient.get('/public/about');
      const raw = res.data?.data || {};
      const parsed: AboutPageCmsData = {};
      const keys: (keyof AboutPageCmsData)[] = [
        'about_hero', 'about_services', 'about_story', 'about_stats',
        'about_values', 'about_mission', 'about_vision', 'about_team', 'about_cta',
      ];
      for (const key of keys) {
        const val = raw[key];
        if (typeof val === 'string') {
          try { (parsed as Record<string, unknown>)[key] = JSON.parse(val); } catch { /* skip */ }
        } else if (val && typeof val === 'object') {
          (parsed as Record<string, unknown>)[key] = val;
        }
      }
      return parsed;
    } catch {
      return {};
    }
  },
};
