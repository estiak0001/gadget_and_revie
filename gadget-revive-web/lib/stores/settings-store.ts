/**
 * Global settings store — fetches /api/public/settings exactly once per page load.
 *
 * TopBar, Footer, and the Home page all previously called cmsService.getSettings()
 * independently, causing 3–6 duplicate network requests on every page visit.
 * This store deduplicates that to a single request, shared across all consumers.
 */

import { create } from 'zustand';
import { cmsService } from '@/lib/api/cms';

interface SettingsState {
    data: Record<string, unknown>;
    loading: boolean;
    fetched: boolean;
    /** Call once from any component. Subsequent calls are no-ops if already fetched. */
    fetchSettings: () => Promise<void>;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
    data: {},
    loading: false,
    fetched: false,

    fetchSettings: async () => {
        // Already fetched or currently in-flight — do nothing
        if (get().fetched || get().loading) return;

        set({ loading: true });
        try {
            const data = await cmsService.getSettings();
            set({ data, fetched: true });
        } catch {
            // Keep existing data; allow retry on next navigation if needed
        } finally {
            set({ loading: false });
        }
    },
}));
