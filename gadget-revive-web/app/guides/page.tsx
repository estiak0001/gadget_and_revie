import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { cmsService } from '@/lib/api/cms';
import { getSiteSettings, pickString, SITE_URL } from '@/lib/seo';

export async function generateMetadata(): Promise<Metadata> {
  const s = await getSiteSettings();
  const siteName = pickString(s.site_name, 'Gadget And Revive');
  const title = 'Guides & Buying Advice';
  const description = `Buying guides, repair advice and how-tos from ${siteName} — refurbished gadgets, common repairs, and what to look for before you buy.`;
  const url = `${SITE_URL}/guides`;

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { title, description, url },
    twitter: { title, description },
  };
}

function formatDate(value: string | null): string | null {
  if (!value) return null;
  return new Date(value).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

export default async function GuidesPage() {
  const guides = await cmsService.getGuides();

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-ink text-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <h1 className="text-2xl sm:text-3xl font-bold">Guides &amp; Buying Advice</h1>
          <p className="text-gray-300 mt-2 max-w-2xl">
            Buying guides, repair advice and how-tos — refurbished gadgets, common repairs, and what to look for before you buy.
          </p>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {guides.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-xl py-16 text-center">
            <p className="text-gray-500">No guides published yet — check back soon.</p>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {guides.map((guide) => (
              <Link
                key={guide.slug}
                href={`/guides/${guide.slug}`}
                className="group bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-md transition-all flex flex-col"
              >
                <div className="relative aspect-[16/9] bg-gray-100">
                  {guide.featured_image ? (
                    <Image
                      src={guide.featured_image}
                      alt={guide.title}
                      fill
                      className="object-cover group-hover:scale-105 transition-transform duration-300"
                      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center text-gray-300 text-sm">
                      Gadget &amp; Revive
                    </div>
                  )}
                </div>
                <div className="p-4 flex-1 flex flex-col">
                  <h2 className="font-semibold text-gray-900 leading-snug line-clamp-2 group-hover:text-ink/70">
                    {guide.title}
                  </h2>
                  {guide.meta_description && (
                    <p className="text-sm text-gray-500 mt-1.5 line-clamp-2 flex-1">{guide.meta_description}</p>
                  )}
                  {formatDate(guide.published_at) && (
                    <p className="text-xs text-gray-400 mt-3">{formatDate(guide.published_at)}</p>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
