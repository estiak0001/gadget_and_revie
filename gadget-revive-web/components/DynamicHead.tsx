'use client';

import { useEffect } from 'react';
import { useSettingsStore } from '@/lib/stores/settings-store';
import { getStorageUrl } from '@/lib/api/config';

function resolveAsset(value: string): string {
  if (!value) return '';
  if (value.startsWith('/') && !value.startsWith('//')) return value;
  if (value.startsWith('http://') || value.startsWith('https://')) return value;
  return getStorageUrl(value);
}

function setLinkHref(rel: string, href: string) {
  if (typeof document === 'undefined' || !href) return;
  let link = document.querySelector(`link[rel="${rel}"][data-dynamic="true"]`) as HTMLLinkElement | null;
  if (!link) {
    link = document.createElement('link');
    link.rel = rel;
    link.dataset.dynamic = 'true';
    document.head.appendChild(link);
  }
  link.href = href;
}

export default function DynamicHead() {
  const { data, fetchSettings } = useSettingsStore();

  useEffect(() => { fetchSettings(); }, [fetchSettings]);

  useEffect(() => {
    const favicon = (data.site_favicon as string | undefined)?.trim();
    // Ignore the seeded default which points at a non-existent file; the
    // server-rendered app/icon.png favicon already covers that case.
    if (favicon && favicon !== '/images/favicon.ico') {
      setLinkHref('icon', resolveAsset(favicon));
    }
  }, [data.site_favicon]);

  return null;
}
