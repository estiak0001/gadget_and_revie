import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { User, AuthResponse } from '../types';
import { authService } from '../api';

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  // True once zustand/persist has finished reading localStorage. Guards against
  // a refresh-time race where route guards run before rehydration and see the
  // initial `isAuthenticated: false`, kicking logged-in users to /auth/login.
  hasHydrated: boolean;
  setAuth: (authResponse: AuthResponse) => void;
  setUser: (user: User) => void;
  logout: () => Promise<void>;
  updateUser: (updates: Partial<User>) => void;
  checkAuth: () => Promise<void>;
  setHasHydrated: (value: boolean) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,
      hasHydrated: false,

      setHasHydrated: (value: boolean) => set({ hasHydrated: value }),
      
      setAuth: (authResponse: AuthResponse) => {
        set({ 
          user: authResponse.user, 
          token: authResponse.token,
          isAuthenticated: true 
        });
        if (typeof window !== 'undefined') {
          localStorage.setItem('auth_token', authResponse.token);
        }
      },
      
      setUser: (user: User) => {
        set({ user, isAuthenticated: true });
      },
      
      logout: async () => {
        try {
          await authService.logout();
        } catch (error) {
          console.error('Logout error:', error);
        } finally {
          set({ user: null, token: null, isAuthenticated: false });
          if (typeof window !== 'undefined') {
            localStorage.removeItem('auth_token');
          }
        }
      },
      
      updateUser: (updates) =>
        set((state) => ({
          user: state.user ? { ...state.user, ...updates } : null,
        })),
      
      checkAuth: async () => {
        const { token } = get();
        if (!token) {
          set({ isAuthenticated: false, user: null });
          return;
        }
        
        try {
          set({ isLoading: true });
          const user = await authService.getProfile();
          set({ user, isAuthenticated: true });
        } catch (error) {
          console.error('Auth check failed:', error);
          set({ user: null, token: null, isAuthenticated: false });
          if (typeof window !== 'undefined') {
            localStorage.removeItem('auth_token');
          }
        } finally {
          set({ isLoading: false });
        }
      },
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => localStorage),
      // persist can't rehydrate a method, so only these fields are replayed.
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        isAuthenticated: state.isAuthenticated,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    }
  )
);