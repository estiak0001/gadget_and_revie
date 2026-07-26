import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { Product } from '../types';

const MAX_COMPARE = 4;

interface CompareState {
    items: Product[];
    isOpen: boolean;
    addItem: (product: Product) => boolean; // returns false if max reached
    removeItem: (productId: number) => void;
    toggleItem: (product: Product) => boolean;
    isInCompare: (productId: number) => boolean;
    clearCompare: () => void;
    setOpen: (open: boolean) => void;
    getCount: () => number;
}

export const useCompareStore = create<CompareState>()(
    persist(
        (set, get) => ({
            items: [],
            isOpen: false,

            addItem: (product) => {
                const { items } = get();
                if (items.length >= MAX_COMPARE) return false;
                if (!items.find((p) => p.id === product.id)) {
                    set({ items: [...items, product] });
                }
                return true;
            },

            removeItem: (productId) => {
                const newItems = get().items.filter((p) => p.id !== productId);
                set({ items: newItems, isOpen: newItems.length > 0 ? get().isOpen : false });
            },

            toggleItem: (product) => {
                const { items, addItem, removeItem } = get();
                if (items.find((p) => p.id === product.id)) {
                    removeItem(product.id);
                    return true;
                }
                return addItem(product);
            },

            isInCompare: (productId) => {
                return !!get().items.find((p) => p.id === productId);
            },

            clearCompare: () => set({ items: [], isOpen: false }),

            setOpen: (open) => set({ isOpen: open }),

            getCount: () => get().items.length,
        }),
        {
            name: 'compare-storage',
            storage: createJSONStorage(() => localStorage),
            partialize: (state) => ({ items: state.items }),
        }
    )
);
