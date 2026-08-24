'use client';

import { useEffect, useRef, useState } from 'react';
import { feedbackService } from '@/lib/api';
import {
  CheckCircleIcon,
  ArrowsPointingOutIcon,
  ArrowsPointingInIcon,
  HandThumbUpIcon,
  HandThumbDownIcon,
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

// Auto-reset back to step 1 this long after the thank-you screen shows — this page is meant to
// run unattended on a tablet at the counter, ready for the next walk-in customer without staff
// having to touch anything between visits.
const RESET_AFTER_MS = 7000;
// Brief pause after a tap so the selection is visibly highlighted before auto-advancing —
// without it, a fast tap feels like the screen jumped rather than responded.
const ADVANCE_DELAY_MS = 350;

const FACES: { value: number; emoji: string; label: string }[] = [
  { value: 1, emoji: '😞', label: 'Very unhappy' },
  { value: 2, emoji: '🙁', label: 'Unhappy' },
  { value: 3, emoji: '😐', label: 'Okay' },
  { value: 4, emoji: '🙂', label: 'Good' },
  { value: 5, emoji: '😄', label: 'Great' },
];

type Step = 1 | 2 | 3 | 'thanks';

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
      className="fixed top-5 right-5 z-10 p-2.5 rounded-full bg-white/10 backdrop-blur border border-white/10 text-white/60 hover:text-white hover:bg-white/20 transition-colors"
    >
      {isFullscreen ? <ArrowsPointingInIcon className="h-5 w-5" /> : <ArrowsPointingOutIcon className="h-5 w-5" />}
    </button>
  );
}

function ProgressDots({ step }: { step: Step }) {
  const stepIndex = step === 'thanks' ? 3 : step;
  return (
    <div className="flex items-center gap-2 mb-10">
      {[1, 2, 3].map((n) => (
        <div
          key={n}
          className={`h-1.5 rounded-full transition-all duration-300 ${
            n <= stepIndex ? 'w-8 bg-amber-400' : 'w-4 bg-white/20'
          }`}
        />
      ))}
    </div>
  );
}

export default function GeneralFeedbackKioskPage() {
  const [step, setStep] = useState<Step>(1);
  const [rating, setRating] = useState<number | null>(null);
  const [wouldRecommend, setWouldRecommend] = useState<boolean | null>(null);
  const [review, setReview] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (step !== 'thanks') return;
    resetTimer.current = setTimeout(() => {
      setStep(1);
      setRating(null);
      setWouldRecommend(null);
      setReview('');
    }, RESET_AFTER_MS);
    return () => {
      if (resetTimer.current) clearTimeout(resetTimer.current);
    };
  }, [step]);

  const pickRating = (value: number) => {
    setRating(value);
    setTimeout(() => setStep(2), ADVANCE_DELAY_MS);
  };

  const pickRecommend = (value: boolean) => {
    setWouldRecommend(value);
    setTimeout(() => setStep(3), ADVANCE_DELAY_MS);
  };

  const submit = async (finalReview: string) => {
    if (rating === null) return;
    setSubmitting(true);
    try {
      await feedbackService.submitGeneral({
        rating,
        would_recommend: wouldRecommend ?? undefined,
        review: finalReview.trim() || undefined,
      });
      setStep('thanks');
    } catch {
      toast.error('Something went wrong — please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-ink flex items-center justify-center px-6 py-10 overflow-hidden">
      <FullScreenToggle />

      {step === 'thanks' ? (
        <div key="thanks" className="fade-in max-w-sm w-full text-center">
          <CheckCircleIcon className="h-24 w-24 text-amber-400 mx-auto mb-6" />
          <h1 className="text-3xl font-bold text-white mb-2">Thank you!</h1>
          <p className="text-white/60">We appreciate you sharing your experience with us.</p>
        </div>
      ) : (
        <div className="max-w-lg w-full flex flex-col items-center">
          <ProgressDots step={step} />

          {step === 1 && (
            <div key={1} className="fade-in w-full text-center">
              <h1 className="text-2xl sm:text-3xl font-bold text-white mb-1">How was your visit today?</h1>
              <p className="text-white/50 text-sm mb-10">Tap a face to rate your experience</p>
              <div className="flex items-center justify-center gap-2 sm:gap-4" role="radiogroup" aria-label="Overall rating">
                {FACES.map((f) => (
                  <button
                    key={f.value}
                    type="button"
                    role="radio"
                    aria-checked={rating === f.value}
                    aria-label={f.label}
                    onClick={() => pickRating(f.value)}
                    className={`h-16 w-16 sm:h-20 sm:w-20 rounded-full flex items-center justify-center text-3xl sm:text-4xl transition-all duration-200 touch-manipulation ${
                      rating === f.value ? 'bg-amber-400 scale-110' : 'bg-white/10 hover:bg-white/15 active:scale-95'
                    }`}
                  >
                    {f.emoji}
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 2 && (
            <div key={2} className="fade-in w-full text-center">
              <h1 className="text-2xl sm:text-3xl font-bold text-white mb-10">Would you recommend us to a friend?</h1>
              <div className="flex items-center justify-center gap-4">
                <button
                  type="button"
                  onClick={() => pickRecommend(true)}
                  className={`flex flex-col items-center gap-2 px-10 py-7 rounded-2xl transition-all duration-200 touch-manipulation ${
                    wouldRecommend === true ? 'bg-amber-400 text-ink' : 'bg-white/10 text-white hover:bg-white/15 active:scale-95'
                  }`}
                >
                  <HandThumbUpIcon className="h-9 w-9" />
                  <span className="font-semibold">Yes</span>
                </button>
                <button
                  type="button"
                  onClick={() => pickRecommend(false)}
                  className={`flex flex-col items-center gap-2 px-10 py-7 rounded-2xl transition-all duration-200 touch-manipulation ${
                    wouldRecommend === false ? 'bg-amber-400 text-ink' : 'bg-white/10 text-white hover:bg-white/15 active:scale-95'
                  }`}
                >
                  <HandThumbDownIcon className="h-9 w-9" />
                  <span className="font-semibold">No</span>
                </button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div key={3} className="fade-in w-full text-center">
              <h1 className="text-2xl sm:text-3xl font-bold text-white mb-1">Anything you&apos;d like to add?</h1>
              <p className="text-white/50 text-sm mb-6">Totally optional</p>
              <textarea
                value={review}
                onChange={(e) => setReview(e.target.value)}
                placeholder="Type here..."
                rows={3}
                maxLength={1000}
                autoFocus
                className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/10 text-white placeholder-white/30 focus:ring-2 focus:ring-amber-400 focus:border-amber-400 outline-none resize-none mb-5"
              />
              <div className="flex items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={() => submit('')}
                  disabled={submitting}
                  className="px-6 py-3 rounded-xl text-white/60 hover:text-white font-medium disabled:opacity-50"
                >
                  Skip
                </button>
                <button
                  type="button"
                  onClick={() => submit(review)}
                  disabled={submitting}
                  className="px-8 py-3 rounded-xl bg-amber-400 text-ink font-semibold hover:bg-amber-300 transition-colors disabled:opacity-60 flex items-center gap-2"
                >
                  {submitting ? <div className="animate-spin h-5 w-5 border-2 border-ink border-t-transparent rounded-full" /> : 'Send Feedback'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
