import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { Product } from '../types';

interface WishlistState {
    items: Product[];
    addItem: (product: Product) => void;
    removeItem: (productId: number) => void;
    toggleItem: (product: Product) => void;
    isInWishlist: (productId: number) => boolean;
    clearWishlist: () => void;
    getCount: () => number;
}

export const useWishlistStore = create<WishlistState>()(
    persist(
        (set, get) => ({
            items: [],

            addItem: (product) => {
                const { items } = get();
                if (!items.find((p) => p.id === product.id)) {
                    set({ items: [...items, product] });
                }
            },

            removeItem: (productId) => {
                set({ items: get().items.filter((p) => p.id !== productId) });
            },

            toggleItem: (product) => {
                const { items, addItem, removeItem } = get();
                if (items.find((p) => p.id === product.id)) {
                    removeItem(product.id);
                } else {
                    addItem(product);
                }
            },

            isInWishlist: (productId) => {
                return !!get().items.find((p) => p.id === productId);
            },

            clearWishlist: () => set({ items: [] }),

            getCount: () => get().items.length,
        }),
        {
            name: 'wishlist-storage',
            storage: createJSONStorage(() => localStorage),
        }
    )
);
