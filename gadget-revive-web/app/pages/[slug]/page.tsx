import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { cmsService } from '@/lib/api/cms';
import { formatDistanceToNow } from 'date-fns';

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const page = await cmsService.getPage(slug);

  if (!page) {
    return { title: 'Page Not Found' };
  }

  return {
    title: page.meta_title || page.title,
    description: page.meta_description,
    keywords: page.meta_keywords,
    openGraph: {
      title: page.meta_title || page.title,
      description: page.meta_description,
      images: page.featured_image ? [page.featured_image] : undefined,
    },
  };
}

export default async function CmsPage({ params }: PageProps) {
  const { slug } = await params;
  const page = await cmsService.getPage(slug);

  if (!page) {
    notFound();
  }

  const updatedAgo = page.updated_at
    ? formatDistanceToNow(new Date(page.updated_at), { addSuffix: true })
    : null;

  return (
    <div className="min-h-screen bg-white">
      {/* Page header */}
      <div className="bg-gray-50 border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <h1 className="text-2xl sm:text-4xl font-bold text-gray-900 mb-3">{page.title}</h1>
          {updatedAgo && (
            <p className="text-sm text-gray-500">Last updated {updatedAgo}</p>
          )}
        </div>
      </div>

      {/* Page content */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div
          className="cms-content"
          dangerouslySetInnerHTML={{ __html: page.content }}
        />
      </div>
    </div>
  );
}
