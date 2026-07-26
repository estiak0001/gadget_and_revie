import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import Cookies from 'js-cookie';
import api from '@/lib/api';
import { User } from '@/types';

interface AuthState {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isLoading: true,
      isAuthenticated: false,

      login: async (email: string, password: string) => {
        try {
          const response = await api.post('/auth/login', { phone_or_email: email, password });
          const { token, user } = response.data.data;

          if (!['admin', 'staff', 'super_admin'].includes(user.role)) {
            throw new Error('Access denied. Admin privileges required.');
          }
          
          Cookies.set('token', token, { expires: 7 });
          Cookies.set('user', JSON.stringify(user), { expires: 7 });
          
          set({ user, token, isAuthenticated: true, isLoading: false });
        } catch (error) {
          set({ user: null, token: null, isAuthenticated: false, isLoading: false });
          throw error;
        }
      },

      logout: async () => {
        try {
          await api.post('/auth/logout');
        } catch (error) {
          console.error('Logout error:', error);
        } finally {
          Cookies.remove('token');
          Cookies.remove('user');
          set({ user: null, token: null, isAuthenticated: false, isLoading: false });
        }
      },

      checkAuth: async () => {
        const token = Cookies.get('token');
        if (!token) {
          set({ user: null, token: null, isAuthenticated: false, isLoading: false });
          return;
        }

        try {
          const response = await api.get('/auth/me');
          const user = response.data.data;

          if (!['admin', 'staff', 'super_admin'].includes(user.role)) {
            throw new Error('Access denied');
          }
          
          set({ user, token, isAuthenticated: true, isLoading: false });
        } catch (error) {
          Cookies.remove('token');
          Cookies.remove('user');
          set({ user: null, token: null, isAuthenticated: false, isLoading: false });
        }
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({ user: state.user, token: state.token }),
    }
  )
);
