import { create } from 'zustand';
import { api } from '@/lib/api';

const ASSET_BASE_URL = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api').replace(/\/api$/, '');

const DEFAULTS = {
  name: 'Gadget And Revive',
  tagline: 'Admin Dashboard',
  logoLight: '/site-main-logo-black_1.png',
  logoDark: '/site-main-logo-white.png',
  favicon: '/favicon.ico',
};

export interface Branding {
  name: string;
  tagline: string;
  logoLight: string;
  logoDark: string;
  favicon: string;
}

function resolveAsset(value: unknown, fallback: string): string {
  if (typeof value !== 'string' || !value.trim()) return fallback;
  if (value.startsWith('/') && !value.startsWith('//')) return value;
  if (value.startsWith('http://') || value.startsWith('https://')) return value;
  return `${ASSET_BASE_URL}/storage/${value.replace(/^storage\//, '')}`;
}

export function buildBranding(data: Record<string, unknown>): Branding {
  const name = (data.site_name as string | undefined)?.trim() || DEFAULTS.name;
  const tagline = (data.site_tagline as string | undefined)?.trim() || DEFAULTS.tagline;
  const logoLight = resolveAsset(data.site_logo, DEFAULTS.logoLight);
  const logoDark = resolveAsset(data.site_logo_dark ?? data.site_logo, DEFAULTS.logoDark);
  const favicon = resolveAsset(data.site_favicon, DEFAULTS.favicon);
  return { name, tagline, logoLight, logoDark, favicon };
}

interface SettingsState {
  data: Record<string, unknown>;
  loading: boolean;
  fetched: boolean;
  fetchSettings: () => Promise<void>;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  data: {},
  loading: false,
  fetched: false,

  fetchSettings: async () => {
    if (get().fetched || get().loading) return;
    set({ loading: true });
    try {
      const response = await api.get('/public/settings');
      const raw = response.data?.data ?? response.data ?? {};
      // The API may return either a flat key→value map or grouped object; handle both.
      let flat: Record<string, unknown> = {};
      if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
        const looksGrouped = Object.values(raw).every((v) => v && typeof v === 'object' && !Array.isArray(v));
        if (looksGrouped) {
          Object.values(raw).forEach((group) => {
            Object.assign(flat, group as Record<string, unknown>);
          });
        } else {
          flat = raw as Record<string, unknown>;
        }
      }
      set({ data: flat, fetched: true });
    } catch {
      // keep defaults
    } finally {
      set({ loading: false });
    }
  },
}));

export function useBranding(): Branding {
  const data = useSettingsStore((s) => s.data);
  return buildBranding(data);
}
