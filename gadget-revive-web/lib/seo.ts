/**
 * Server-side SEO helpers.
 *
 * The title, favicon and brand logo shown by Google/social crawlers must be
 * present in the *server-rendered* HTML — crawlers do not run the client-side
 * `DynamicHead` effect. These helpers fetch the public site settings on the
 * server (with ISR caching) so `generateMetadata` and the JSON-LD blocks in
 * the root layout always reflect the current branding.
 */

import { getStorageUrl } from '@/lib/api/config';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';

/** Public origin of the website (no trailing slash). Used for canonical, OG and JSON-LD URLs. */
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'https://gadgetandrevive.com').replace(/\/+$/, '');

/** Bundled logo that is guaranteed to exist in /public, used when no logo is configured. */
const FALLBACK_LOGO_PATH = '/site-main-logo-black_1.png';

export type SiteSettings = Record<string, unknown>;

/**
 * Fetch the public site settings on the server. Cached for 5 minutes (ISR) so
 * branding edits propagate without a redeploy. Never throws — returns {} on
 * failure so metadata falls back to sane defaults.
 */
export async function getSiteSettings(): Promise<SiteSettings> {
  try {
    const res = await fetch(`${API_BASE}/public/settings`, {
      headers: { Accept: 'application/json' },
      next: { revalidate: 300 },
      // Never let a slow/unreachable API stall the build or a request — fall
      // back to defaults instead.
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return {};
    const json = await res.json();
    return (json?.data as SiteSettings) || {};
  } catch {
    return {};
  }
}

function str(v: unknown): string {
  return typeof v === 'string' ? v.trim() : '';
}

/** Return the first non-empty string among the given values. */
export function pickString(...values: unknown[]): string {
  for (const v of values) {
    const s = str(v);
    if (s) return s;
  }
  return '';
}

/** Resolve a stored asset value to an absolute URL (or '' when not resolvable). */
function toAbsolute(value: unknown): string {
  const v = str(value);
  if (!v) return '';
  if (v.startsWith('http://') || v.startsWith('https://')) return v;
  if (v.startsWith('/') && !v.startsWith('//')) return `${SITE_URL}${v}`;
  // Uploaded file on the API storage disk — getStorageUrl derives the correct
  // absolute base from NEXT_PUBLIC_API_URL (same logic the rest of the app uses).
  return getStorageUrl(v);
}

/**
 * Absolute URL to the brand logo for Open Graph / structured data. Falls back
 * to the bundled logo — the seeded default `/images/logo.png` does not exist.
 */
export function resolveLogo(value: unknown): string {
  const v = str(value);
  if (!v || v === '/images/logo.png') return `${SITE_URL}${FALLBACK_LOGO_PATH}`;
  return toAbsolute(v) || `${SITE_URL}${FALLBACK_LOGO_PATH}`;
}

/**
 * Absolute favicon URL, or `undefined` to let the `app/icon.png` file
 * convention provide the default. The seeded default `/images/favicon.ico`
 * does not exist, so it is treated as "unset".
 */
export function resolveFavicon(value: unknown): string | undefined {
  const v = str(value);
  if (!v || v === '/images/favicon.ico') return undefined;
  return toAbsolute(v) || undefined;
}
