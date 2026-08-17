import type { Metadata } from 'next';
import ProductsPageClient from './ProductsPageClient';
import { getSiteSettings, pickString, SITE_URL } from '@/lib/seo';

export async function generateMetadata(): Promise<Metadata> {
  const s = await getSiteSettings();
  const siteName = pickString(s.site_name, 'Gadget And Revive');
  // Plain string, no manual "| siteName" suffix — the root layout's title.template already
  // appends that for every nested segment, so adding it here would double it up.
  const title = 'Shop All Products';
  const description = `Browse the full ${siteName} catalog — genuine computer, laptop and gadget parts, upgrades and accessories, with certified refurbished options.`;
  const url = `${SITE_URL}/products`;

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { title, description, url },
    twitter: { title, description },
  };
}

export default function ProductsPage() {
  return <ProductsPageClient />;
}
