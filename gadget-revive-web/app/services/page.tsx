import type { Metadata } from 'next';
import ServicesPageClient from './ServicesPageClient';
import { getSiteSettings, pickString, SITE_URL } from '@/lib/seo';

export async function generateMetadata(): Promise<Metadata> {
  const s = await getSiteSettings();
  const siteName = pickString(s.site_name, 'Gadget And Revive');
  // Plain string, no manual "| siteName" suffix — the root layout's title.template already
  // appends that for every nested segment, so adding it here would double it up.
  const title = 'Repair Services';
  const description = `Book certified repair services for phones, laptops, computers and other gadgets from verified vendors on ${siteName}.`;
  const url = `${SITE_URL}/services`;

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { title, description, url },
    twitter: { title, description },
  };
}

export default function ServicesPage() {
  return <ServicesPageClient />;
}
