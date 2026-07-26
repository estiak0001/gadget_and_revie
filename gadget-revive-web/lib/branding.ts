import { getStorageUrl } from '@/lib/api/config';
import { useSettingsStore } from '@/lib/stores/settings-store';

const DEFAULTS = {
  name: 'Gadget And Revive',
  tagline: 'Repair. Shop. Revive.',
  logoLight: '/site-main-logo-black_1.png',
  logoDark: '/site-main-logo-white.png',
};

export interface Branding {
  name: string;
  tagline: string;
  logoLight: string;
  logoDark: string;
}

function resolveLogo(raw: unknown, fallback: string): string {
  if (typeof raw !== 'string' || !raw.trim()) return fallback;
  if (raw.startsWith('/') && !raw.startsWith('//')) return raw;
  if (raw.startsWith('http://') || raw.startsWith('https://')) return raw;
  return getStorageUrl(raw);
}

export function getBranding(data: Record<string, unknown>): Branding {
  const name = (data.site_name as string | undefined)?.trim() || DEFAULTS.name;
  const tagline = (data.site_tagline as string | undefined)?.trim() || DEFAULTS.tagline;
  const logoLight = resolveLogo(data.site_logo, DEFAULTS.logoLight);
  const logoDark = resolveLogo(data.site_logo_dark ?? data.site_logo, DEFAULTS.logoDark);
  return { name, tagline, logoLight, logoDark };
}

export function useBranding(): Branding {
  const data = useSettingsStore((s) => s.data);
  return getBranding(data);
}
