'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useEffect } from 'react';
import { useAuthStore } from '@/lib/stores/auth-store';
import { useCartStore } from '@/lib/stores/cart-store';
import { useSettingsStore } from '@/lib/stores/settings-store';
import { getBranding } from '@/lib/branding';
import { authService } from '@/lib/api';
import toast from 'react-hot-toast';
import Image from 'next/image';

import {
  EyeIcon,
  EyeSlashIcon,
  UserIcon,
  EnvelopeIcon,
  LockClosedIcon,
  PhoneIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
  ShieldCheckIcon,
} from '@heroicons/react/24/outline';

// ─── Types ───────────────────────────────────────────────────────────────────

type Screen = 'form' | 'otp' | 'success';

// ─── Component ───────────────────────────────────────────────────────────────

export default function LoginPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [screen, setScreen] = useState<Screen>('form');

  // Form data
  const [formData, setFormData] = useState({
    name: '',
    phoneOrEmail: '',        // ← primary login identifier (phone first)
    phone: '',               // ← signup phone (always required)
    email: '',               // ← signup email (optional)
    password: '',
    confirmPassword: '',
  });

  // OTP screen
  const [otp, setOtp] = useState('');
  const [pendingPhone, setPendingPhone] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0); // seconds remaining until Resend is enabled
  const [isResending, setIsResending] = useState(false);

  const [loading, setLoading] = useState(false);
  const [authError, setAuthError] = useState('');

  // OTP codes are valid for 5 minutes server-side — mirror that here so "Resend" only becomes
  // clickable once the current code would actually be expired anyway.
  const OTP_TTL_SECONDS = 5 * 60;

  useEffect(() => {
    if (screen !== 'otp' || resendCooldown <= 0) return;
    const timer = setInterval(() => setResendCooldown((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(timer);
  }, [screen, resendCooldown]);

  const handleResendOtp = async () => {
    setIsResending(true);
    const result = await authService.resendOtp(pendingPhone);
    if (result.ok) {
      setResendCooldown(OTP_TTL_SECONDS);
      toast.success(result.message);
    } else {
      // Server is the source of truth for how much longer to wait — resync in case our own
      // timer drifted (e.g. this tab was backgrounded, or the OTP screen was reopened).
      if (result.retryAfter != null) setResendCooldown(result.retryAfter);
      toast.error(result.message);
    }
    setIsResending(false);
  };

  // Captures the phone number (the only field that matters) as soon as it looks like a real
  // attempt — independent of whether registration is ever actually completed. Debounced so this
  // doesn't fire on every keystroke, and only while actively signing up.
  useEffect(() => {
    if (isLogin) return;
    const digits = formData.phone.replace(/\D/g, '');
    if (digits.length < 10) return;
    const timer = setTimeout(() => {
      authService.captureLead(formData.phone, formData.name || undefined, formData.email || undefined);
    }, 800);
    return () => clearTimeout(timer);
  }, [isLogin, formData.phone, formData.name, formData.email]);

  const { setAuth } = useAuthStore();
  const { mergeGuestCart } = useCartStore();
  const router = useRouter();

  const { data: siteSettings, fetchSettings } = useSettingsStore();
  useEffect(() => { fetchSettings(); }, [fetchSettings]);
  const branding = getBranding(siteSettings);

  // ── Helpers ────────────────────────────────────────────────────────────────

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (authError) setAuthError('');
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleTabSwitch = (login: boolean) => {
    setIsLogin(login);
    setAuthError('');
    setScreen('form');
  };

  // ── Login ──────────────────────────────────────────────────────────────────

  const handleLogin = async () => {
    const response = await authService.login({
      phone_or_email: formData.phoneOrEmail,
      password: formData.password,
    });

    setAuth(response);
    try { await mergeGuestCart(); } catch { /* non-fatal */ }
    toast.success('Welcome back!');

    // Vendor feature is disabled — everyone lands on the customer dashboard.
    router.push('/dashboard');
  };

  // ── Register ───────────────────────────────────────────────────────────────

  const handleRegister = async () => {
    if (formData.password !== formData.confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    if (!formData.phone) {
      toast.error('Phone number is required');
      return;
    }

    const result = await authService.registerCustomer({
      name: formData.name,
      phone: formData.phone,
      email: formData.email || undefined,
      password: formData.password,
      password_confirmation: formData.confirmPassword,
      role: 'customer',
    } as any);

    if (result.otpRequired) {
      // OTP is enabled — show OTP screen
      setPendingPhone(formData.phone);
      setResendCooldown(OTP_TTL_SECONDS);
      setScreen('otp');
      toast.success('OTP sent to your phone number');
    } else if (result.token && result.user) {
      // OTP disabled — auto-login
      setAuth({ user: result.user, token: result.token! });
      try { await mergeGuestCart(); } catch { /* non-fatal */ }
      setScreen('success');
    }
  };

  // ── OTP Verify ─────────────────────────────────────────────────────────────

  const handleOtpVerify = async () => {
    if (otp.length !== 6) {
      toast.error('Please enter the 6-digit OTP code');
      return;
    }

    const response = await authService.verifyPhone(pendingPhone, otp);
    setAuth(response);
    try { await mergeGuestCart(); } catch { /* non-fatal */ }
    setScreen('success');
    toast.success('Phone verified! Welcome aboard 🎉');
  };

  // ── Submit ─────────────────────────────────────────────────────────────────

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setAuthError('');

    try {
      if (isLogin) {
        await handleLogin();
      } else {
        await handleRegister();
      }
    } catch (error: any) {
      console.error('Auth error:', error);
      const msg =
        error.response?.data?.message ||
        error.message ||
        'An error occurred. Please try again.';

      // Logging in with a not-yet-verified account used to be a dead end — the login form has
      // no OTP field of its own, so there was no way back to the verification screen short of
      // registering again. If they logged in with a phone number (not an email, which the OTP
      // screen can't do anything with), send a fresh code and drop them straight into it.
      const isUnverifiedPhone = isLogin && error.response?.status === 403
        && /verify your phone/i.test(msg) && !formData.phoneOrEmail.includes('@');

      if (isUnverifiedPhone) {
        setPendingPhone(formData.phoneOrEmail);
        setScreen('otp');
        // Their original registration code may still be valid — only claim a fresh one went out
        // when resendOtp actually succeeds; otherwise the existing code (and its real remaining
        // time) still works fine.
        const resendResult = await authService.resendOtp(formData.phoneOrEmail);
        if (resendResult.ok) {
          setResendCooldown(OTP_TTL_SECONDS);
          toast('Your phone isn\'t verified yet — we\'ve sent a new code.', { icon: '📱' });
        } else {
          if (resendResult.retryAfter != null) setResendCooldown(resendResult.retryAfter);
          toast('Your phone isn\'t verified yet — enter the code sent earlier, or wait to resend.', { icon: '📱' });
        }
      } else if (error.response?.data?.errors) {
        const errors = error.response.data.errors;
        Object.keys(errors).forEach((key) => {
          errors[key].forEach((m: string) => toast.error(m));
        });
      } else {
        setAuthError(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  // ── OTP submit ─────────────────────────────────────────────────────────────

  const handleOtpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await handleOtpVerify();
    } catch (error: any) {
      const msg = error.response?.data?.message || error.message || 'Invalid OTP';
      setAuthError(msg);
    } finally {
      setLoading(false);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="flex min-h-0 h-full bg-gray-50">
      {/* ── Left side – Form ── */}
      <div className="flex-1 flex items-center justify-center py-6 px-4 sm:px-6 lg:px-20 xl:px-24 bg-white">
        <div className="w-full max-w-md">

          {/* ── Success screen (OTP-disabled signup) ── */}
          {screen === 'success' && (
            <div className="text-center">
              <Link href="/" className="flex items-center justify-center space-x-3 mb-6">
                <div className="flex h-12 w-12 items-center justify-center bg-gradient-to-r from-ink to-ink rounded-xl">
                  <Image src={branding.logoDark} alt={`${branding.name} Logo`} width={32} height={32} className="object-contain brightness-0 invert" style={{ width: 32, height: 32 }} unoptimized />
                </div>
                <span className="text-2xl font-bold bg-gradient-to-r from-ink to-ink bg-clip-text text-transparent">
                  {branding.name}
                </span>
              </Link>

              <div className="flex justify-center mb-6">
                <div className="bg-green-100 p-5 rounded-full">
                  <CheckCircleIcon className="h-16 w-16 text-green-500" />
                </div>
              </div>

              <h2 className="text-2xl font-bold text-gray-900 mb-3">You're all set!</h2>
              <p className="text-gray-600 mb-5">
                Your account has been created successfully. You are now logged in and ready to go.
              </p>

              <button
                onClick={() => router.push('/dashboard')}
                className="w-full py-3.5 px-4 border border-transparent text-base font-bold rounded-xl text-white bg-gradient-to-r from-ink to-ink hover:from-ink hover:to-black focus:outline-none shadow-lg hover:shadow-md transition-all"
              >
                Go to Dashboard →
              </button>
            </div>
          )}

          {/* ── OTP verification screen ── */}
          {screen === 'otp' && (
            <div>
              <Link href="/" className="flex items-center space-x-3 mb-5">
                <div className="flex h-12 w-12 items-center justify-center bg-gradient-to-r from-ink to-ink rounded-xl">
                  <Image src={branding.logoDark} alt={`${branding.name} Logo`} width={32} height={32} className="object-contain brightness-0 invert" style={{ width: 32, height: 32 }} unoptimized />
                </div>
                <div>
                  <span className="text-2xl font-bold bg-gradient-to-r from-ink to-ink bg-clip-text text-transparent">
                    {branding.name}
                  </span>
                  <p className="text-xs text-gray-500 -mt-1">{branding.tagline}</p>
                </div>
              </Link>

              <div className="flex justify-center mb-6">
                <div className="bg-blue-100 p-4 rounded-full">
                  <ShieldCheckIcon className="h-12 w-12 text-blue-500" />
                </div>
              </div>

              <div className="mb-5 text-center">
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Verify your number</h2>
                <p className="text-gray-500 text-sm">
                  Enter the 6-digit code sent to <span className="font-semibold text-gray-800">{pendingPhone}</span>
                </p>
              </div>

              {authError && (
                <div className="flex items-start gap-3 p-4 mb-5 bg-red-50 border border-red-200 rounded-xl">
                  <ExclamationCircleIcon className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
                  <p className="text-sm font-medium text-red-700">{authError}</p>
                </div>
              )}

              <form className="space-y-5" onSubmit={handleOtpSubmit}>
                <div>
                  <label htmlFor="otp" className="block text-sm font-semibold text-gray-700 mb-2">
                    OTP Code
                  </label>
                  <input
                    id="otp"
                    name="otp"
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    required
                    value={otp}
                    onChange={(e) => { setOtp(e.target.value.replace(/\D/g, '')); setAuthError(''); }}
                    placeholder="••••••"
                    className="block w-full text-center text-2xl tracking-[0.5em] font-bold py-4 border-2 border-gray-200 rounded-xl placeholder-gray-300 focus:border-ink focus:outline-none focus:ring-2 focus:ring-ink/20 transition-all"
                  />
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={loading || otp.length !== 6}
                    className="group relative w-full flex justify-center items-center gap-2 py-3.5 px-4 border border-transparent text-base font-bold rounded-xl text-white bg-gradient-to-r from-ink to-ink hover:from-ink hover:to-black focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-md transition-all"
                  >
                    {loading ? (
                      <>
                        <div className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full" />
                        Verifying...
                      </>
                    ) : (
                      <>
                        Verify & Sign In
                        <svg className="w-5 h-5 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                        </svg>
                      </>
                    )}
                  </button>
                </div>

                <div className="text-center text-sm">
                  {resendCooldown > 0 ? (
                    <span className="text-gray-400">
                      Didn&apos;t get it? Resend in {Math.floor(resendCooldown / 60)}:{String(resendCooldown % 60).padStart(2, '0')}
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={handleResendOtp}
                      disabled={isResending}
                      className="font-semibold text-gray-900 hover:text-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isResending ? 'Sending...' : 'Resend Code'}
                    </button>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => setScreen('form')}
                  className="w-full text-sm text-gray-500 hover:text-gray-700 transition-colors"
                >
                  ← Back
                </button>
              </form>
            </div>
          )}

          {/* ── Main auth form ── */}
          {screen === 'form' && (
            <>
              <div>
                {/* Logo */}
                <Link href="/" className="flex items-center space-x-3 mb-5">
                  <div className="flex h-12 w-12 items-center justify-center bg-gradient-to-r from-ink to-ink rounded-xl">
                    <Image
                      src={branding.logoDark}
                      alt={`${branding.name} Logo`}
                      width={32}
                      height={32}
                      className="object-contain brightness-0 invert"
                      style={{ width: 32, height: 32 }}
                      unoptimized
                    />
                  </div>
                  <div>
                    <span className="text-2xl font-bold bg-gradient-to-r from-ink to-ink bg-clip-text text-transparent">
                      {branding.name}
                    </span>
                    <p className="text-xs text-gray-500 -mt-1">{branding.tagline}</p>
                  </div>
                </Link>

                {/* Welcome Text */}
                <div className="mb-5">
                  <h2 className="text-2xl lg:text-2xl font-bold text-gray-900 mb-3 leading-tight">
                    {isLogin ? 'Welcome Back!' : 'Get Started'}
                  </h2>
                  <p className="text-lg text-gray-600">
                    {isLogin ? 'Sign in to access your account' : 'Create your account today'}
                  </p>
                </div>

                {/* Toggle Tabs */}
                <div className="flex gap-2 mb-5 bg-gray-100 p-1 rounded-xl">
                  <button
                    onClick={() => handleTabSwitch(true)}
                    className={`flex-1 py-3 px-4 rounded-lg font-semibold transition-all ${isLogin
                      ? 'bg-gradient-to-r from-ink to-ink text-white shadow-lg'
                      : 'text-gray-600 hover:text-gray-900'
                      }`}
                  >
                    Sign In
                  </button>
                  <button
                    onClick={() => handleTabSwitch(false)}
                    className={`flex-1 py-3 px-4 rounded-lg font-semibold transition-all ${!isLogin
                      ? 'bg-gradient-to-r from-ink to-ink text-white shadow-lg'
                      : 'text-gray-600 hover:text-gray-900'
                      }`}
                  >
                    Sign Up
                  </button>
                </div>
              </div>

              <div>
                <form className="space-y-5" onSubmit={handleSubmit}>

                  {/* ── SIGN UP FIELDS ── */}
                  {!isLogin && (
                    <>
                      {/* Full Name */}
                      <div>
                        <label htmlFor="name" className="block text-sm font-semibold text-gray-700 mb-2">
                          Full Name
                        </label>
                        <div className="relative">
                          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <UserIcon className="h-5 w-5 text-gray-400" />
                          </div>
                          <input
                            id="name"
                            name="name"
                            type="text"
                            required
                            value={formData.name}
                            onChange={handleInputChange}
                            placeholder="Enter your full name"
                            className="block w-full pl-10 pr-3 py-3 border-2 border-gray-200 rounded-xl placeholder-gray-400 focus:border-ink focus:outline-none focus:ring-2 focus:ring-ink/20 transition-all"
                          />
                        </div>
                      </div>

                      {/* Phone Number (required for signup) */}
                      <div>
                        <label htmlFor="phone" className="block text-sm font-semibold text-gray-700 mb-2">
                          Phone Number <span className="text-red-500">*</span>
                        </label>
                        <div className="relative">
                          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <PhoneIcon className="h-5 w-5 text-gray-400" />
                          </div>
                          <input
                            id="phone"
                            name="phone"
                            type="tel"
                            required
                            value={formData.phone}
                            onChange={handleInputChange}
                            placeholder="01711123456"
                            className="block w-full pl-10 pr-3 py-3 border-2 border-gray-200 rounded-xl placeholder-gray-400 focus:border-ink focus:outline-none focus:ring-2 focus:ring-ink/20 transition-all"
                          />
                        </div>
                        <p className="text-xs text-gray-400 mt-1">Used to sign in. Must be unique.</p>
                      </div>

                      {/* Email (optional for signup) */}
                      <div>
                        <label htmlFor="email" className="block text-sm font-semibold text-gray-700 mb-2">
                          Email Address <span className="text-gray-400 font-normal">(optional)</span>
                        </label>
                        <div className="relative">
                          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <EnvelopeIcon className="h-5 w-5 text-gray-400" />
                          </div>
                          <input
                            id="email"
                            name="email"
                            type="email"
                            autoComplete="email"
                            value={formData.email}
                            onChange={handleInputChange}
                            placeholder="you@example.com"
                            className="block w-full pl-10 pr-3 py-3 border-2 border-gray-200 rounded-xl placeholder-gray-400 focus:border-ink focus:outline-none focus:ring-2 focus:ring-ink/20 transition-all"
                          />
                        </div>
                      </div>
                    </>
                  )}

                  {/* ── LOGIN FIELD ── */}
                  {isLogin && (
                    <div>
                      <label htmlFor="phoneOrEmail" className="block text-sm font-semibold text-gray-700 mb-2">
                        Phone Number or Email
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <PhoneIcon className="h-5 w-5 text-gray-400" />
                        </div>
                        <input
                          id="phoneOrEmail"
                          name="phoneOrEmail"
                          type="text"
                          autoComplete="username"
                          required
                          value={formData.phoneOrEmail}
                          onChange={handleInputChange}
                          placeholder="01711123456 or you@example.com"
                          className="block w-full pl-10 pr-3 py-3 border-2 border-gray-200 rounded-xl placeholder-gray-400 focus:border-ink focus:outline-none focus:ring-2 focus:ring-ink/20 transition-all"
                        />
                      </div>
                      <p className="text-xs text-gray-400 mt-1">Phone number is the primary identifier.</p>
                    </div>
                  )}

                  {/* Password */}
                  <div>
                    <label htmlFor="password" className="block text-sm font-semibold text-gray-700 mb-2">
                      Password
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <LockClosedIcon className="h-5 w-5 text-gray-400" />
                      </div>
                      <input
                        id="password"
                        name="password"
                        type={showPassword ? 'text' : 'password'}
                        autoComplete="current-password"
                        required
                        value={formData.password}
                        onChange={handleInputChange}
                        placeholder="Enter your password"
                        className="block w-full pl-10 pr-12 py-3 border-2 border-gray-200 rounded-xl placeholder-gray-400 focus:border-ink focus:outline-none focus:ring-2 focus:ring-ink/20 transition-all"
                      />
                      <button
                        type="button"
                        className="absolute inset-y-0 right-0 pr-3 flex items-center hover:bg-gray-50 rounded-r-xl transition-colors"
                        onClick={() => setShowPassword(!showPassword)}
                      >
                        {showPassword ? (
                          <EyeSlashIcon className="h-5 w-5 text-gray-400 hover:text-gray-600" />
                        ) : (
                          <EyeIcon className="h-5 w-5 text-gray-400 hover:text-gray-600" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Confirm Password (signup only) */}
                  {!isLogin && (
                    <div>
                      <label htmlFor="confirmPassword" className="block text-sm font-semibold text-gray-700 mb-2">
                        Confirm Password
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <LockClosedIcon className="h-5 w-5 text-gray-400" />
                        </div>
                        <input
                          id="confirmPassword"
                          name="confirmPassword"
                          type="password"
                          required
                          value={formData.confirmPassword}
                          onChange={handleInputChange}
                          placeholder="Confirm your password"
                          className="block w-full pl-10 pr-3 py-3 border-2 border-gray-200 rounded-xl placeholder-gray-400 focus:border-ink focus:outline-none focus:ring-2 focus:ring-ink/20 transition-all"
                        />
                      </div>
                    </div>
                  )}

                  {/* Remember me / Forgot password (login only) */}
                  {isLogin && (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <input
                          id="remember-me"
                          name="remember-me"
                          type="checkbox"
                          className="h-4 w-4 rounded border-gray-300 text-gray-800 focus:ring-ink"
                        />
                        <label htmlFor="remember-me" className="ml-2 block text-sm font-medium text-gray-700">
                          Remember me
                        </label>
                      </div>

                      <div className="text-sm">
                        <Link href="/forgot-password" className="font-semibold text-gray-900 hover:text-gray-600">
                          Forgot password?
                        </Link>
                      </div>
                    </div>
                  )}

                  {/* Error */}
                  {authError && (
                    <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-xl">
                      <ExclamationCircleIcon className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
                      <p className="text-sm font-medium text-red-700">{authError}</p>
                    </div>
                  )}

                  {/* Submit */}
                  <div className="pt-2">
                    <button
                      type="submit"
                      disabled={loading}
                      className="group relative w-full flex justify-center items-center gap-2 py-3.5 px-4 border border-transparent text-base font-bold rounded-xl text-white bg-gradient-to-r from-ink to-ink hover:from-ink hover:to-black focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-ink disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-md transition-all"
                    >
                      {loading ? (
                        <>
                          <div className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full" />
                          Processing...
                        </>
                      ) : (
                        <>
                          {isLogin ? 'Sign In' : 'Create Account'}
                          <svg className="w-5 h-5 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                          </svg>
                        </>
                      )}
                    </button>
                  </div>

                  {/* ToS notice (signup) */}
                  {!isLogin && (
                    <p className="text-xs text-center text-gray-500 mt-4">
                      By creating an account, you agree to our{' '}
                      <Link href="/terms" className="text-gray-900 hover:text-gray-600 font-medium">
                        Terms of Service
                      </Link>{' '}
                      and{' '}
                      <Link href="/privacy" className="text-gray-900 hover:text-gray-600 font-medium">
                        Privacy Policy
                      </Link>
                    </p>
                  )}
                </form>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Right side – Info Panel ── */}
      <div className="hidden lg:block relative flex-1">
        <div className="absolute inset-0 bg-gradient-to-br from-[#1c1f26] to-ink">
          {/* Animated Background Pattern */}
          <div className="absolute inset-0 opacity-10">
            <div className="absolute inset-0" style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`
            }}></div>
          </div>

          <div className="relative flex flex-col justify-center items-center h-full px-12 xl:px-16 text-white text-center">
            <div className="flex h-24 w-24 items-center justify-center bg-white/10 border border-white/10 rounded-xl mb-5">
              <Image
                src={branding.logoDark}
                alt={`${branding.name} Logo`}
                width={64}
                height={64}
                className="object-contain brightness-0 invert"
                style={{ width: 64, height: 64 }}
                unoptimized
              />
            </div>
            <h2 className="text-xl xl:text-2xl font-bold mb-4">
              Welcome to
              <br />
              <span className="text-white">
                {branding.name}
              </span>
            </h2>
            <p className="text-xl text-gray-300 max-w-md">
              Your trusted partner for mobile repair and data recovery services in Bangladesh
            </p>

            {/* Feature list */}
            <ul className="mt-5 space-y-3 text-left w-full max-w-xs">
              {[
                'Sign in with your phone number',
                'Track your repair orders',
                'Book services easily',
                'Secure & fast checkout',
              ].map((item) => (
                <li key={item} className="flex items-center gap-3 text-sm text-gray-300">
                  <CheckCircleIcon className="h-5 w-5 text-white/70 shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}