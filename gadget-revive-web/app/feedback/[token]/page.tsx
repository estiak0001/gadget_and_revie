'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { feedbackService, FeedbackOrder, FeedbackEntry } from '@/lib/api';
import {
  StarIcon as StarOutlineIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  ShoppingBagIcon,
} from '@heroicons/react/24/outline';
import { StarIcon as StarSolidIcon } from '@heroicons/react/24/solid';
import toast from 'react-hot-toast';

type Draft = { rating: number; review: string };

function StarPicker({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  return (
    <div className="flex items-center gap-1" role="radiogroup" aria-label="Rating">
      {[1, 2, 3, 4, 5].map((n) => {
        const filled = n <= value;
        const Icon = filled ? StarSolidIcon : StarOutlineIcon;
        return (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={filled}
            aria-label={`${n} star${n > 1 ? 's' : ''}`}
            onClick={() => onChange(n)}
            className="p-1.5 -m-1.5 touch-manipulation"
          >
            <Icon className={`h-8 w-8 sm:h-9 sm:w-9 transition-colors ${filled ? 'text-amber-400' : 'text-gray-300'}`} />
          </button>
        );
      })}
    </div>
  );
}

export default function FeedbackPage() {
  const params = useParams();
  const token = String(params.token || '');

  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [order, setOrder] = useState<FeedbackOrder | null>(null);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (!token) return;
    const load = async () => {
      try {
        const data = await feedbackService.get(token);
        setOrder(data);
        const initial: Record<string, Draft> = {};
        // 'general' covers a service-only order with no product line items.
        const keys = data.products.length > 0 ? data.products.map((p) => String(p.product_id)) : ['general'];
        keys.forEach((k) => { initial[k] = { rating: 0, review: '' }; });
        setDrafts(initial);
      } catch {
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [token]);

  const setDraft = (key: string, patch: Partial<Draft>) => {
    setDrafts((prev) => ({ ...prev, [key]: { ...prev[key], ...patch } }));
  };

  const handleSubmit = async () => {
    if (!order) return;

    const entries = Object.entries(drafts);
    const unrated = entries.filter(([, d]) => d.rating === 0);
    if (unrated.length > 0) {
      toast.error('Please give a star rating for every item before submitting.');
      return;
    }

    const reviews: FeedbackEntry[] = entries.map(([key, d]) => ({
      product_id: key === 'general' ? null : Number(key),
      rating: d.rating,
      review: d.review.trim() || undefined,
    }));

    setSubmitting(true);
    try {
      await feedbackService.submit(token, reviews);
      setSubmitted(true);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Something went wrong — please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin h-10 w-10 border-4 border-ink border-t-transparent rounded-full" />
      </div>
    );
  }

  if (notFound || !order) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 max-w-sm w-full text-center">
          <ExclamationTriangleIcon className="h-14 w-14 text-amber-400 mx-auto mb-4" />
          <h1 className="text-lg font-bold text-gray-900 mb-2">Link not found</h1>
          <p className="text-gray-600 text-sm mb-6">This feedback link is invalid or has expired. Please contact us if you'd still like to share your experience.</p>
          <Link href="/" className="inline-block px-5 py-2.5 rounded-xl bg-ink text-white text-sm font-semibold">
            Go to homepage
          </Link>
        </div>
      </div>
    );
  }

  if (order.already_submitted || submitted) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 max-w-sm w-full text-center">
          <CheckCircleIcon className="h-14 w-14 text-green-500 mx-auto mb-4" />
          <h1 className="text-lg font-bold text-gray-900 mb-2">Thank you!</h1>
          <p className="text-gray-600 text-sm mb-6">
            {submitted
              ? "Your feedback has been received and will appear once it's reviewed."
              : `You've already shared your feedback for order #${order.order_number}. We appreciate it!`}
          </p>
          <Link href="/" className="inline-block px-5 py-2.5 rounded-xl bg-ink text-white text-sm font-semibold">
            Continue shopping
          </Link>
        </div>
      </div>
    );
  }

  const items = order.products.length > 0
    ? order.products.map((p) => ({ key: String(p.product_id), name: p.name, image: p.image }))
    : [{ key: 'general', name: `Order #${order.order_number}`, image: null }];

  return (
    <div className="min-h-screen bg-gray-50 pb-28">
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-lg mx-auto px-4 py-6">
          <div className="flex items-center gap-2 mb-1">
            <ShoppingBagIcon className="h-6 w-6 text-gray-800" />
            <h1 className="text-xl font-bold text-gray-900">Rate your order</h1>
          </div>
          <p className="text-sm text-gray-500">Order #{order.order_number} — your feedback helps other customers.</p>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-6 space-y-4">
        {items.map((item) => {
          const draft = drafts[item.key] || { rating: 0, review: '' };
          return (
            <div key={item.key} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
              <div className="flex items-center gap-3 mb-4">
                {item.image ? (
                  <div className="relative h-14 w-14 rounded-xl overflow-hidden bg-gray-100 flex-shrink-0">
                    <Image src={item.image} alt={item.name} fill sizes="56px" className="object-cover" />
                  </div>
                ) : (
                  <div className="h-14 w-14 rounded-xl bg-gray-100 flex items-center justify-center flex-shrink-0">
                    <ShoppingBagIcon className="h-6 w-6 text-gray-400" />
                  </div>
                )}
                <p className="font-semibold text-gray-900 leading-snug">{item.name}</p>
              </div>

              <StarPicker value={draft.rating} onChange={(n) => setDraft(item.key, { rating: n })} />

              <textarea
                value={draft.review}
                onChange={(e) => setDraft(item.key, { review: e.target.value })}
                placeholder="Share a few words about your experience (optional)"
                rows={3}
                maxLength={1000}
                className="mt-4 w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-ink focus:border-ink outline-none resize-none"
              />
            </div>
          );
        })}
      </div>

      <div className="fixed bottom-0 inset-x-0 bg-white border-t border-gray-200 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <div className="max-w-lg mx-auto">
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
            className="w-full py-3.5 bg-gradient-to-r from-ink to-ink text-white font-semibold rounded-xl hover:shadow-lg transition-all disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {submitting ? (
              <div className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full" />
            ) : (
              'Submit Feedback'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
