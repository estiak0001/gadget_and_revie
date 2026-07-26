import apiClient from './config';
import {
  AuthResponse,
  RegisterRequest,
  LoginRequest,
  User,
} from '../types';

export const authService = {
  /**
   * Register a new customer.
   * When OTP is disabled the API returns a token immediately (auto-login).
   * When OTP is enabled the API returns no token (pending verification).
   */
  registerCustomer: async (data: RegisterRequest): Promise<{ user: User; token?: string; otpRequired?: boolean }> => {
    const response = await apiClient.post('/auth/register/customer', data);
    const result = response.data.data;
    if (result?.token) {
      localStorage.setItem('auth_token', result.token);
      return { user: result.user, token: result.token, otpRequired: false };
    }
    // OTP flow – no token yet
    return { user: result.user, otpRequired: true };
  },

  registerVendor: async (data: RegisterRequest): Promise<AuthResponse> => {
    const response = await apiClient.post('/auth/register/vendor', data);
    const result = response.data.data;
    if (result?.token) {
      localStorage.setItem('auth_token', result.token);
    }
    return { user: result.user, token: result.token || '' };
  },

  /**
   * Login with phone number (primary) or email address (fallback).
   */
  login: async (data: { phone_or_email: string; password: string }): Promise<AuthResponse> => {
    const response = await apiClient.post('/auth/login', data);
    const result = response.data.data;
    if (result?.token) {
      localStorage.setItem('auth_token', result.token);
    }
    return { user: result.user, token: result.token || '' };
  },

  /**
   * Verify OTP code sent to phone (only used when OTP is enabled).
   */
  verifyPhone: async (phone: string, otp: string): Promise<AuthResponse> => {
    const response = await apiClient.post('/auth/verify-phone', { phone, otp });
    const result = response.data.data;
    if (result?.token) {
      localStorage.setItem('auth_token', result.token);
    }
    return { user: result.user, token: result.token || '' };
  },

  /**
   * Logout user
   */
  logout: async (): Promise<void> => {
    try {
      await apiClient.post('/auth/logout');
    } finally {
      localStorage.removeItem('auth_token');
      localStorage.removeItem('auth-storage');
    }
  },

  /**
   * Get current user profile
   */
  getProfile: async (): Promise<User> => {
    const response = await apiClient.get('/auth/me');
    return response.data.data?.user || response.data.data;
  },

  /**
   * Update user profile
   */
  updateProfile: async (data: Partial<User> & {
    current_password?: string;
    password?: string;
    password_confirmation?: string
  }): Promise<User> => {
    const response = await apiClient.put('/auth/profile', data);
    return response.data.data;
  },

  /**
   * Verify email via token link
   */
  verifyEmail: async (email: string, token: string): Promise<void> => {
    await apiClient.post('/auth/verify-email', { email, token });
  },
};
