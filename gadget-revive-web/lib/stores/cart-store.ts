/**
 * cart-store.ts
 *
 * Hybrid cart store that works without login (guest mode) and with auth.
 *
 * Strategy:
 * - Guest users get a UUID session_id persisted in localStorage.
 * - Cart items are stored BOTH locally (instant UI) and synced to API.
 * - On login, the guest cart is merged into the user's server-side cart.
 * - Authenticated users use the API-backed cart exclusively.
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { Cart, CartItem } from '../types';
import { cartService, guestCartService } from '../api';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function generateSessionId(): string {
  // Generate a UUID-like value
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

function getOrCreateSessionId(): string {
  if (typeof window === 'undefined') return '';
  let sid = localStorage.getItem('guest_session_id');
  if (!sid) {
    sid = generateSessionId();
    localStorage.setItem('guest_session_id', sid);
  }
  return sid;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface GuestCartItem {
  /** Temporary local id (negative to distinguish from API ids) */
  localId: number;
  item_type: 'product' | 'service';
  item_id: number;
  quantity: number;
  unit_price: number;
  name: string;
  image?: string;
  notes?: string;
}

interface CartState {
  // Server-backed cart (for logged-in users and after syncing)
  cart: Cart | null;
  isLoading: boolean;

  // Whether cart is synced with the server
  isSynced: boolean;

  // Cart management
  fetchCart: (isAuthenticated?: boolean) => Promise<void>;
  addItem: (
    item_type: 'product' | 'service',
    item_id: number,
    quantity?: number,
    notes?: string
  ) => Promise<void>;
  removeItem: (itemId: number) => Promise<void>;
  updateQuantity: (itemId: number, quantity: number, notes?: string) => Promise<void>;
  clearCart: () => Promise<void>;
  getTotalItems: () => number;
  getTotalPrice: () => number;

  // Cart merge on login
  mergeGuestCart: () => Promise<void>;
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      cart: null,
      isLoading: false,
      isSynced: false,

      // ------------------------------------------------------------------
      // Fetch cart items
      // ------------------------------------------------------------------
      fetchCart: async (isAuthenticated = false) => {
        try {
          set({ isLoading: true });

          if (isAuthenticated) {
            // Authenticated: fetch from API
            const cart = await cartService.getCart();
            set({ cart, isSynced: true });
          } else {
            // Guest: fetch from guest API by session_id
            const sessionId = getOrCreateSessionId();
            if (!sessionId) {
              set({ cart: null, isSynced: false });
              return;
            }
            try {
              const cart = await guestCartService.getCart(sessionId);
              set({ cart, isSynced: true });
            } catch {
              // Guest API error — keep local state
              set({ isSynced: false });
            }
          }
        } catch (error) {
          console.error('Failed to fetch cart:', error);
          set({ cart: null });
        } finally {
          set({ isLoading: false });
        }
      },

      // ------------------------------------------------------------------
      // Add item
      // ------------------------------------------------------------------
      addItem: async (item_type, item_id, quantity = 1, notes) => {
        const sessionId = getOrCreateSessionId();
        try {
          set({ isLoading: true });

          // Always try the guest API first (works for both guest + auth users
          // at the frontend level — the auth check is on the checkout side).
          // For logged-in users, we use the auth API instead.
          const token =
            typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;

          let cart: Cart;
          if (token) {
            // Authenticated user — use the authenticated cart API
            cart = await cartService.addItem({ item_type, item_id, quantity, notes });
          } else {
            // Guest user — use the guest cart API
            cart = await guestCartService.addItem(sessionId, {
              item_type,
              item_id,
              quantity,
              notes,
            });
          }
          set({ cart, isSynced: true });
        } catch (error) {
          console.error('Failed to add item:', error);
          throw error;
        } finally {
          set({ isLoading: false });
        }
      },

      // ------------------------------------------------------------------
      // Remove item
      // ------------------------------------------------------------------
      removeItem: async (itemId) => {
        try {
          set({ isLoading: true });
          const token =
            typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;

          if (token) {
            await cartService.removeItem(itemId);
            await get().fetchCart(true);
          } else {
            const sessionId = getOrCreateSessionId();
            await guestCartService.removeItem(sessionId, itemId);
            await get().fetchCart(false);
          }
        } catch (error) {
          console.error('Failed to remove item:', error);
          throw error;
        } finally {
          set({ isLoading: false });
        }
      },

      // ------------------------------------------------------------------
      // Update quantity
      // ------------------------------------------------------------------
      updateQuantity: async (itemId, quantity, notes) => {
        try {
          set({ isLoading: true });
          const token =
            typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;

          if (token) {
            const cart = await cartService.updateItem(itemId, { quantity, notes });
            set({ cart });
          } else {
            const sessionId = getOrCreateSessionId();
            const cart = await guestCartService.updateItem(sessionId, itemId, {
              quantity,
              notes,
            });
            set({ cart });
          }
        } catch (error) {
          console.error('Failed to update quantity:', error);
          throw error;
        } finally {
          set({ isLoading: false });
        }
      },

      // ------------------------------------------------------------------
      // Clear cart
      // ------------------------------------------------------------------
      clearCart: async () => {
        try {
          set({ isLoading: true });
          const token =
            typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;

          if (token) {
            await cartService.clearCart();
          } else {
            const sessionId = getOrCreateSessionId();
            await guestCartService.clearCart(sessionId);
          }
          set({ cart: null });
        } catch (error) {
          console.error('Failed to clear cart:', error);
          throw error;
        } finally {
          set({ isLoading: false });
        }
      },

      // ------------------------------------------------------------------
      // Selectors
      // ------------------------------------------------------------------
      getTotalItems: () => {
        const { cart } = get();
        if (!cart || !cart.items) return 0;
        return cart.items.reduce((total, item) => total + item.quantity, 0);
      },

      getTotalPrice: () => {
        const { cart } = get();
        if (cart?.total) return cart.total;
        if (cart?.items && cart.items.length > 0) {
          return cart.items.reduce((sum, item) => {
            const price = item.unit_price || item.price || 0;
            return sum + price * item.quantity;
          }, 0);
        }
        return 0;
      },

      // ------------------------------------------------------------------
      // Merge guest cart → user cart after login
      // ------------------------------------------------------------------
      mergeGuestCart: async () => {
        const sessionId =
          typeof window !== 'undefined'
            ? localStorage.getItem('guest_session_id')
            : null;
        if (!sessionId) return;

        try {
          await guestCartService.mergeCartAfterLogin(sessionId);
          // Clear the guest session id after merge
          localStorage.removeItem('guest_session_id');
          // Refresh the user cart
          await get().fetchCart(true);
        } catch (error) {
          console.error('Failed to merge guest cart:', error);
          // Non-fatal — ignore
        }
      },
    }),
    {
      name: 'cart-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ cart: state.cart }),
    }
  )
);

// ---------------------------------------------------------------------------
// Utility: get/create session id (exported for use in checkout page)
// ---------------------------------------------------------------------------
export { getOrCreateSessionId };