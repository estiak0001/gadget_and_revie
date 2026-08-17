import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeftIcon } from '@heroicons/react/24/outline';
import { cmsService } from '@/lib/api/cms';
import { getSiteSettings, pickString, SITE_URL } from '@/lib/seo';

interface GuideProps {
  params: Promise<{ slug: string }>;
}

function stripHtml(value: string): string {
  return value.replace(/<[^>]*>/g, ' ').replace(/&[a-z]+;/gi, ' ').replace(/\s+/g, ' ').trim();
}

export async function generateMetadata({ params }: GuideProps): Promise<Metadata> {
  const { slug } = await params;
  const guide = await cmsService.getPage(slug);

  if (!guide || guide.page_type !== 'guide') {
    return { title: 'Guide Not Found' };
  }

  const title = guide.meta_title || guide.title;
  const description = guide.meta_description || stripHtml(guide.content).slice(0, 200);
  const url = `${SITE_URL}/guides/${slug}`;

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: 'article',
      title,
      description,
      url,
      ...(guide.featured_image ? { images: [{ url: guide.featured_image, alt: guide.title }] } : {}),
      ...(guide.published_at ? { publishedTime: guide.published_at } : {}),
    },
    twitter: {
      card: guide.featured_image ? 'summary_large_image' : 'summary',
      title,
      description,
      ...(guide.featured_image ? { images: [guide.featured_image] } : {}),
    },
  };
}

export default async function GuidePage({ params }: GuideProps) {
  const { slug } = await params;
  const [guide, s] = await Promise.all([cmsService.getPage(slug), getSiteSettings()]);

  // Guide-type pages live at /guides/{slug}; anything else that happens to share this slug
  // (there shouldn't be one, slugs are unique across all page_types) stays a 404 here — the
  // generic /pages/{slug} route is where non-guide content is meant to be reached.
  if (!guide || guide.page_type !== 'guide') {
    notFound();
  }

  const siteName = pickString(s.site_name, 'Gadget And Revive');
  const url = `${SITE_URL}/guides/${slug}`;
  const publishedDate = guide.published_at
    ? new Date(guide.published_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
    : null;

  const articleSchema = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: guide.title,
    ...(guide.meta_description ? { description: guide.meta_description } : {}),
    ...(guide.featured_image ? { image: [guide.featured_image] } : {}),
    ...(guide.published_at ? { datePublished: guide.published_at } : {}),
    dateModified: guide.updated_at,
    author: { '@id': `${SITE_URL}/#organization` },
    publisher: { '@id': `${SITE_URL}/#organization` },
    mainEntityOfPage: url,
  };

  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE_URL}/` },
      { '@type': 'ListItem', position: 2, name: 'Guides', item: `${SITE_URL}/guides` },
      { '@type': 'ListItem', position: 3, name: guide.title, item: url },
    ],
  };

  return (
    <div className="min-h-screen bg-white">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />

      {guide.featured_image && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={guide.featured_image} alt={guide.title} className="w-full max-h-[420px] object-cover" />
      )}

      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Link href="/guides" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 mb-6">
          <ArrowLeftIcon className="h-4 w-4" />
          Back to Guides
        </Link>

        <h1 className="text-2xl sm:text-4xl font-bold text-gray-900 mb-3">{guide.title}</h1>
        {publishedDate && (
          <p className="text-sm text-gray-500 mb-8">
            Published {publishedDate} · {siteName}
          </p>
        )}

        <div className="cms-content" dangerouslySetInnerHTML={{ __html: guide.content }} />
      </div>
    </div>
  );
}
