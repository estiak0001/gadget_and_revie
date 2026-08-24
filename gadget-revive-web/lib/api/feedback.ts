import apiClient from './config';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface FeedbackProduct {
  product_id: number;
  name: string;
  image: string | null;
  already_reviewed: boolean;
}

export interface FeedbackOrder {
  order_number: string;
  already_submitted: boolean;
  products: FeedbackProduct[];
}

export interface FeedbackEntry {
  product_id: number | null;
  rating: number;
  review?: string;
}

// ── API functions ─────────────────────────────────────────────────────────────

export const feedbackService = {
  /**
   * Look up the order behind an SMS feedback link (public, no login — the token in the URL
   * is the access control, see Order::getOrCreateFeedbackToken()).
   */
  get: async (token: string): Promise<FeedbackOrder> => {
    const res = await apiClient.get(`/feedback/${token}`);
    return res.data.data;
  },

  /**
   * Submit one rating (+ optional comment) per product on the order. Lands as status=pending —
   * nothing shows on the storefront until an admin approves it.
   */
  submit: async (token: string, reviews: FeedbackEntry[]): Promise<void> => {
    await apiClient.post(`/feedback/${token}`, { reviews });
  },

  /**
   * The "kiosk" flow — a general store-wide rating with no order behind it at all, for a
   * tablet left at the counter for any walk-in customer. See app/feedback/page.tsx.
   */
  submitGeneral: async (rating: number, review?: string): Promise<void> => {
    await apiClient.post('/feedback', { rating, review });
  },
};
