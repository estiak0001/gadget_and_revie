import type { Metadata } from 'next';
import HomeClient from './HomeClient';
import { getSiteSettings, pickString, SITE_URL } from '@/lib/seo';

export async function generateMetadata(): Promise<Metadata> {
  const s = await getSiteSettings();
  const siteName = pickString(s.site_name, 'Gadget And Revive');
  const title = pickString(s.meta_title) || `${siteName} — Genuine Parts, Repairs & IT Services`;
  const description = pickString(
    s.meta_description,
    s.site_description,
    'Buy genuine computer, laptop and gadget parts, book repairs, and get IT services — from a trusted vendor marketplace.'
  );

  return {
    title,
    description,
    alternates: { canonical: SITE_URL },
    openGraph: { title, description, url: SITE_URL },
    twitter: { title, description },
  };
}

export default function Home() {
  return <HomeClient />;
}
