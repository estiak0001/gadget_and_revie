import type { Metadata } from 'next';
import { getStorageUrl } from '@/lib/api/config';
import { SITE_URL } from '@/lib/seo';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';

function stripHtml(value: string): string {
  return value.replace(/<[^>]*>/g, ' ').replace(/&[a-z]+;/gi, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * Fetch a product by slug on the server so social/crawler previews get the
 * right title, image and description. Returns null for non-product slugs
 * (e.g. category pages), which then fall back to the site-level metadata.
 */
async function fetchProduct(slug: string): Promise<Record<string, unknown> | null> {
  try {
    const res = await fetch(`${API_BASE}/products/${encodeURIComponent(slug)}`, {
      headers: { Accept: 'application/json' },
      next: { revalidate: 300 },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    const json = await res.json();
    const data = json?.data;
    return data && typeof data === 'object' && data.name ? data : null;
  } catch {
    return null;
  }
}

export async function generateMetadata(
  { params }: { params: Promise<{ slug: string[] }> },
): Promise<Metadata> {
  const { slug } = await params;
  const segments = Array.isArray(slug) ? slug : [slug];
  const lastSlug = segments[segments.length - 1];

  const product = await fetchProduct(lastSlug);
  if (!product) return {};

  const name = String(product.name);
  const rawDesc = (product.short_description as string) || (product.description as string) || '';
  const description = stripHtml(rawDesc).slice(0, 200) || `Buy ${name} at the best price from Gadget And Revive.`;
  const url = `${SITE_URL}/products/${segments.join('/')}`;
  const image = product.image ? getStorageUrl(product.image as string) : undefined;

  return {
    title: name,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: 'website',
      title: name,
      description,
      url,
      ...(image ? { images: [{ url: image, alt: name }] } : {}),
    },
    twitter: {
      card: image ? 'summary_large_image' : 'summary',
      title: name,
      description,
      ...(image ? { images: [image] } : {}),
    },
  };
}

export default function ProductSlugLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
