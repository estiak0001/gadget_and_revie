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
 * (e.g. category pages), which the category lookup below then tries instead.
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

/**
 * Fetch a product category by slug — same "last URL segment" lookup the client-side
 * resolver in page.tsx uses (see productService.getCategoryBySlug), mirrored here so a
 * category URL gets its own title/description instead of silently falling back to the
 * sitewide default the way every category page did before.
 */
async function fetchCategory(slug: string): Promise<Record<string, unknown> | null> {
  try {
    const res = await fetch(`${API_BASE}/categories/products/${encodeURIComponent(slug)}`, {
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
  if (product) {
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

  const category = await fetchCategory(lastSlug);
  if (category) {
    const name = String(category.name);
    const rawDesc = (category.description as string) || '';
    const description = stripHtml(rawDesc).slice(0, 200)
      || `Shop ${name} at Gadget And Revive — genuine parts and accessories, competitively priced.`;
    const url = `${SITE_URL}/products/${segments.join('/')}`;
    const image = category.image ? getStorageUrl(category.image as string) : undefined;
    const title = `${name} — Shop ${name} Online`;

    return {
      title,
      description,
      alternates: { canonical: url },
      openGraph: {
        type: 'website',
        title,
        description,
        url,
        ...(image ? { images: [{ url: image, alt: name }] } : {}),
      },
      twitter: {
        card: image ? 'summary_large_image' : 'summary',
        title,
        description,
        ...(image ? { images: [image] } : {}),
      },
    };
  }

  return {};
}

export default function ProductSlugLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
