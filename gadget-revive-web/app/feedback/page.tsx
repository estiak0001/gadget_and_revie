'use client';

import { useEffect, useState } from 'react';
import { feedbackService } from '@/lib/api';
import {
  StarIcon as StarOutlineIcon,
  CheckCircleIcon,
  ArrowsPointingOutIcon,
  ArrowsPointingInIcon,
} from '@heroicons/react/24/outline';
import { StarIcon as StarSolidIcon } from '@heroicons/react/24/solid';
import toast from 'react-hot-toast';

// Auto-reset back to a blank form this long after a thank-you screen shows — this page is
// meant to run unattended on a tablet at the counter, ready for the next walk-in customer
// without staff having to touch anything between visits.
const RESET_AFTER_MS = 8000;

function FullScreenToggle() {
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const onChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  const toggle = () => {
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    } else {
      document.documentElement.requestFullscreen().catch(() => {
        toast.error('Full screen isn\'t available on this device.');
      });
    }
  };

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={isFullscreen ? 'Exit full screen' : 'Enter full screen'}
      className="fixed top-4 right-4 z-10 p-2.5 rounded-full bg-white/80 backdrop-blur border border-gray-200 text-gray-500 hover:text-gray-800 shadow-sm"
    >
      {isFullscreen ? <ArrowsPointingInIcon className="h-5 w-5" /> : <ArrowsPointingOutIcon className="h-5 w-5" />}
    </button>
  );
}

export default function GeneralFeedbackKioskPage() {
  const [rating, setRating] = useState(0);
  const [review, setReview] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (!submitted) return;
    const t = setTimeout(() => {
      setSubmitted(false);
      setRating(0);
      setReview('');
    }, RESET_AFTER_MS);
    return () => clearTimeout(t);
  }, [submitted]);

  const handleSubmit = async () => {
    if (rating === 0) {
      toast.error('Please tap a star rating first.');
      return;
    }
    setSubmitting(true);
    try {
      await feedbackService.submitGeneral(rating, review.trim() || undefined);
      setSubmitted(true);
    } catch {
      toast.error('Something went wrong — please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-10">
      <FullScreenToggle />

      {submitted ? (
        <div className="max-w-sm w-full text-center">
          <CheckCircleIcon className="h-20 w-20 text-green-500 mx-auto mb-5" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Thank you!</h1>
          <p className="text-gray-600">We appreciate you sharing your experience with us.</p>
        </div>
      ) : (
        <div className="max-w-md w-full bg-white rounded-2xl shadow-sm border border-gray-100 p-8 text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-1">How was your visit today?</h1>
          <p className="text-gray-500 text-sm mb-6">Tap a star to rate your overall experience with us.</p>

          <div className="flex items-center justify-center gap-2 mb-6" role="radiogroup" aria-label="Overall rating">
            {[1, 2, 3, 4, 5].map((n) => {
              const filled = n <= rating;
              const Icon = filled ? StarSolidIcon : StarOutlineIcon;
              return (
                <button
                  key={n}
                  type="button"
                  role="radio"
                  aria-checked={filled}
                  aria-label={`${n} star${n > 1 ? 's' : ''}`}
                  onClick={() => setRating(n)}
                  className="p-2 touch-manipulation"
                >
                  <Icon className={`h-12 w-12 sm:h-14 sm:w-14 transition-colors ${filled ? 'text-amber-400' : 'text-gray-300'}`} />
                </button>
              );
            })}
          </div>

          <textarea
            value={review}
            onChange={(e) => setReview(e.target.value)}
            placeholder="Tell us more (optional)"
            rows={3}
            maxLength={1000}
            className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-ink focus:border-ink outline-none resize-none mb-5"
          />

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
      )}
    </div>
  );
}
