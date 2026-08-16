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
   * Re-sends the registration OTP. Never throws — a resend attempted too soon is a normal,
   * expected outcome (the previous code is still valid for up to 5 minutes), not an error the
   * caller needs a try/catch for. `retryAfter` (seconds) is present only when `ok` is false, and
   * is the server's own authoritative countdown — use it to resync the UI timer rather than
   * trusting the client's own clock across a page reload.
   */
  resendOtp: async (phone: string): Promise<{ ok: boolean; retryAfter?: number; message: string }> => {
    try {
      const response = await apiClient.post('/auth/resend-otp', { phone });
      return { ok: true, message: response.data.message || 'A new code has been sent.' };
    } catch (error: any) {
      return {
        ok: false,
        retryAfter: error.response?.data?.errors?.retry_after,
        message: error.response?.data?.message || 'Could not resend the code.',
      };
    }
  },

  /**
   * Password reset step 1 — sends an OTP to the account's phone. Throws normally (unlike
   * resendOtp) since a first request failing — unknown phone, feature disabled — is a real error
   * the caller should surface, not an expected steady-state like a resend cooldown.
   */
  forgotPassword: async (phone: string): Promise<{ message: string }> => {
    const response = await apiClient.post('/auth/forgot-password', { phone });
    return { message: response.data.message };
  },

  /** Same never-throws shape as resendOtp — see its comment. */
  resendResetOtp: async (phone: string): Promise<{ ok: boolean; retryAfter?: number; message: string }> => {
    try {
      const response = await apiClient.post('/auth/resend-reset-otp', { phone });
      return { ok: true, message: response.data.message || 'A new code has been sent.' };
    } catch (error: any) {
      return {
        ok: false,
        retryAfter: error.response?.data?.errors?.retry_after,
        message: error.response?.data?.message || 'Could not resend the code.',
      };
    }
  },

  /** Password reset step 2 — verify the OTP and set the new password in one call. */
  resetPassword: async (phone: string, otp: string, password: string, passwordConfirmation: string): Promise<{ message: string }> => {
    const response = await apiClient.post('/auth/reset-password', {
      phone, otp, password, password_confirmation: passwordConfirmation,
    });
    return { message: response.data.message };
  },

  /**
   * Fire-and-forget capture of a registration attempt in progress — phone number is the only
   * field that matters. Deliberately swallows all errors: this is a side channel for lead
   * recovery and must never surface a failure (or even a loading state) to someone who's just
   * typing into a form field.
   */
  captureLead: async (phone: string, name?: string, email?: string): Promise<void> => {
    try {
      await apiClient.post('/auth/capture-lead', { phone, name, email });
    } catch {
      // intentionally silent
    }
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
