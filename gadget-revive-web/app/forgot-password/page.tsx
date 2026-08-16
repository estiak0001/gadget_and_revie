'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useSettingsStore } from '@/lib/stores/settings-store';
import { getBranding } from '@/lib/branding';
import { authService } from '@/lib/api';
import toast from 'react-hot-toast';
import Image from 'next/image';

import {
  EyeIcon,
  EyeSlashIcon,
  LockClosedIcon,
  PhoneIcon,
  ExclamationCircleIcon,
  ShieldCheckIcon,
  CheckCircleIcon,
} from '@heroicons/react/24/outline';

type Step = 'phone' | 'reset' | 'done';

const OTP_TTL_SECONDS = 5 * 60;

export default function ForgotPasswordPage() {
  const router = useRouter();
  const { data: siteSettings, fetchSettings } = useSettingsStore();
  useEffect(() => { fetchSettings(); }, [fetchSettings]);
  const branding = getBranding(siteSettings);

  const [step, setStep] = useState<Step>('phone');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);
  const [isResending, setIsResending] = useState(false);

  useEffect(() => {
    if (step !== 'reset' || resendCooldown <= 0) return;
    const timer = setInterval(() => setResendCooldown((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(timer);
  }, [step, resendCooldown]);

  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone.trim()) {
      toast.error('Enter your phone number');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await authService.forgotPassword(phone.trim());
      setResendCooldown(OTP_TTL_SECONDS);
      setStep('reset');
      toast.success('A reset code has been sent to your phone');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Could not send a reset code. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setIsResending(true);
    const result = await authService.resendResetOtp(phone.trim());
    if (result.ok) {
      setResendCooldown(OTP_TTL_SECONDS);
      toast.success(result.message);
    } else {
      if (result.retryAfter != null) setResendCooldown(result.retryAfter);
      toast.error(result.message);
    }
    setIsResending(false);
  };

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (otp.length !== 6) {
      toast.error('Enter the 6-digit code');
      return;
    }
    if (password.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }
    if (password !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await authService.resetPassword(phone.trim(), otp, password, confirmPassword);
      setStep('done');
      toast.success('Password reset — please sign in');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Invalid or expired code. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 py-10 px-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-lg p-8">
        <Link href="/" className="flex items-center space-x-3 mb-6">
          <div className="flex h-12 w-12 items-center justify-center bg-gradient-to-r from-ink to-ink rounded-xl">
            <Image src={branding.logoDark} alt={`${branding.name} Logo`} width={32} height={32} className="object-contain brightness-0 invert" style={{ width: 32, height: 32 }} unoptimized />
          </div>
          <span className="text-2xl font-bold bg-gradient-to-r from-ink to-ink bg-clip-text text-transparent">
            {branding.name}
          </span>
        </Link>

        {/* ── Step: enter phone ── */}
        {step === 'phone' && (
          <>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Forgot your password?</h1>
            <p className="text-gray-500 text-sm mb-6">
              Enter your account&apos;s phone number and we&apos;ll send you a code to reset it.
            </p>

            {error && (
              <div className="flex items-start gap-3 p-4 mb-5 bg-red-50 border border-red-200 rounded-xl">
                <ExclamationCircleIcon className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
                <p className="text-sm font-medium text-red-700">{error}</p>
              </div>
            )}

            <form className="space-y-5" onSubmit={handleSendCode}>
              <div>
                <label htmlFor="phone" className="block text-sm font-semibold text-gray-700 mb-2">Phone Number</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <PhoneIcon className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    id="phone"
                    type="tel"
                    required
                    value={phone}
                    onChange={(e) => { setPhone(e.target.value); setError(''); }}
                    placeholder="01711123456"
                    className="block w-full pl-10 pr-3 py-3 border-2 border-gray-200 rounded-xl placeholder-gray-400 focus:border-ink focus:outline-none focus:ring-2 focus:ring-ink/20 transition-all"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full flex justify-center items-center gap-2 py-3.5 px-4 text-base font-bold rounded-xl text-white bg-gradient-to-r from-ink to-ink hover:from-ink hover:to-black focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed shadow-lg transition-all"
              >
                {loading ? (
                  <>
                    <div className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full" />
                    Sending...
                  </>
                ) : 'Send Reset Code'}
              </button>

              <Link href="/auth/login" className="block text-center text-sm text-gray-500 hover:text-gray-700 transition-colors">
                ← Back to sign in
              </Link>
            </form>
          </>
        )}

        {/* ── Step: enter code + new password ── */}
        {step === 'reset' && (
          <>
            <div className="flex justify-center mb-5">
              <div className="bg-blue-100 p-4 rounded-full">
                <ShieldCheckIcon className="h-10 w-10 text-blue-500" />
              </div>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2 text-center">Reset your password</h1>
            <p className="text-gray-500 text-sm mb-6 text-center">
              Enter the 6-digit code sent to <span className="font-semibold text-gray-800">{phone}</span> and choose a new password.
            </p>

            {error && (
              <div className="flex items-start gap-3 p-4 mb-5 bg-red-50 border border-red-200 rounded-xl">
                <ExclamationCircleIcon className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
                <p className="text-sm font-medium text-red-700">{error}</p>
              </div>
            )}

            <form className="space-y-5" onSubmit={handleReset}>
              <div>
                <label htmlFor="otp" className="block text-sm font-semibold text-gray-700 mb-2">OTP Code</label>
                <input
                  id="otp"
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  required
                  value={otp}
                  onChange={(e) => { setOtp(e.target.value.replace(/\D/g, '')); setError(''); }}
                  placeholder="••••••"
                  className="block w-full text-center text-2xl tracking-[0.5em] font-bold py-4 border-2 border-gray-200 rounded-xl placeholder-gray-300 focus:border-ink focus:outline-none focus:ring-2 focus:ring-ink/20 transition-all"
                />
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-semibold text-gray-700 mb-2">New Password</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <LockClosedIcon className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="At least 8 characters"
                    className="block w-full pl-10 pr-12 py-3 border-2 border-gray-200 rounded-xl placeholder-gray-400 focus:border-ink focus:outline-none focus:ring-2 focus:ring-ink/20 transition-all"
                  />
                  <button type="button" className="absolute inset-y-0 right-0 pr-3 flex items-center hover:bg-gray-50 rounded-r-xl" onClick={() => setShowPassword((v) => !v)}>
                    {showPassword ? <EyeSlashIcon className="h-5 w-5 text-gray-400" /> : <EyeIcon className="h-5 w-5 text-gray-400" />}
                  </button>
                </div>
              </div>

              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-semibold text-gray-700 mb-2">Confirm New Password</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <LockClosedIcon className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    id="confirmPassword"
                    type="password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter new password"
                    className="block w-full pl-10 pr-3 py-3 border-2 border-gray-200 rounded-xl placeholder-gray-400 focus:border-ink focus:outline-none focus:ring-2 focus:ring-ink/20 transition-all"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || otp.length !== 6}
                className="w-full flex justify-center items-center gap-2 py-3.5 px-4 text-base font-bold rounded-xl text-white bg-gradient-to-r from-ink to-ink hover:from-ink hover:to-black focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed shadow-lg transition-all"
              >
                {loading ? (
                  <>
                    <div className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full" />
                    Resetting...
                  </>
                ) : 'Reset Password'}
              </button>

              <div className="text-center text-sm">
                {resendCooldown > 0 ? (
                  <span className="text-gray-400">
                    Didn&apos;t get it? Resend in {Math.floor(resendCooldown / 60)}:{String(resendCooldown % 60).padStart(2, '0')}
                  </span>
                ) : (
                  <button type="button" onClick={handleResend} disabled={isResending} className="font-semibold text-gray-900 hover:text-gray-600 disabled:opacity-50">
                    {isResending ? 'Sending...' : 'Resend Code'}
                  </button>
                )}
              </div>

              <button type="button" onClick={() => setStep('phone')} className="w-full text-sm text-gray-500 hover:text-gray-700 transition-colors">
                ← Use a different phone number
              </button>
            </form>
          </>
        )}

        {/* ── Step: done ── */}
        {step === 'done' && (
          <div className="text-center">
            <div className="flex justify-center mb-6">
              <div className="bg-green-100 p-5 rounded-full">
                <CheckCircleIcon className="h-16 w-16 text-green-500" />
              </div>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-3">Password reset!</h1>
            <p className="text-gray-600 mb-6">Your password has been changed. Sign in with your new password to continue.</p>
            <button
              onClick={() => router.push('/auth/login')}
              className="w-full py-3.5 px-4 text-base font-bold rounded-xl text-white bg-gradient-to-r from-ink to-ink hover:from-ink hover:to-black shadow-lg transition-all"
            >
              Go to Sign In →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
