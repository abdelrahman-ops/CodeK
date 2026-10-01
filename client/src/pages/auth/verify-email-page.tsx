import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Mail, CheckCircle, RefreshCw, AlertCircle, ArrowLeft } from 'lucide-react';
import { useAuth } from '../../context/auth-context.js';
import { Button } from '../../components/ui/button.js';
import { Input } from '../../components/ui/input.js';
import { useToast } from '../../components/ui/toast.js';

export function VerifyEmailPage() {
  const { t, i18n } = useTranslation();
  const isRtl = i18n.language === 'ar';
  const location = useLocation();
  const navigate = useNavigate();
  const toast = useToast();
  const { verifyEmail, resendVerification } = useAuth();

  const state = (location.state as any) || {};
  const [userId, setUserId] = useState<string>(() => {
    return state.userId || localStorage.getItem('codek_pending_verification_user_id') || '';
  });
  const [emailMasked, setEmailMasked] = useState<string>(() => {
    return state.emailMasked || localStorage.getItem('codek_pending_verification_email') || '';
  });
  const [devOtp, setDevOtp] = useState<string | undefined>(state.devOtp);

  const [otpCode, setOtpCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useState(60);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (state.userId) {
      localStorage.setItem('codek_pending_verification_user_id', state.userId);
    }
    if (state.emailMasked) {
      localStorage.setItem('codek_pending_verification_email', state.emailMasked);
    }
  }, [state]);

  // Cooldown countdown timer
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => {
      setCooldown((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId) {
      setError(isRtl ? 'معرّف الحساب غير موجود. يرجى تسجيل الدخول مجدداً.' : 'User session not found. Please log in again.');
      return;
    }

    const cleanCode = otpCode.trim();
    if (cleanCode.length !== 6 || !/^\d{6}$/.test(cleanCode)) {
      setError(isRtl ? 'رمز التحقق يتكون من 6 أرقام فقط.' : 'Verification code must be exactly 6 digits.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await verifyEmail(userId, cleanCode);
      toast.success(isRtl ? 'تم تأكيد البريد الإلكتروني بنجاح!' : 'Email verified successfully!');

      // Clean up verification state
      localStorage.removeItem('codek_pending_verification_user_id');
      localStorage.removeItem('codek_pending_verification_email');

      if (!res.learningModeSelected) {
        navigate('/onboarding/learning-mode', { replace: true });
      } else if (res.mustChangePassword) {
        navigate('/change-password', { replace: true });
      } else {
        navigate('/student', { replace: true });
      }
    } catch (err: any) {
      const msg = err.response?.data?.error?.message || err.response?.data?.error || (isRtl ? 'رمز التحقق غير صحيح أو انتهت صلاحيته.' : 'Invalid or expired verification code.');
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (cooldown > 0 || !userId || resending) return;

    setResending(true);
    setError(null);

    try {
      const data = await resendVerification(userId);
      setCooldown(data.resendCooldownSeconds || 60);
      if (data.emailMasked) {
        setEmailMasked(data.emailMasked);
      }
      if (data.devOtp) {
        setDevOtp(data.devOtp);
      }
      toast.success(isRtl ? 'تم إرسال رمز تحقق جديد إلى بريدك الإلكتروني.' : 'New verification code sent to your email.');
    } catch (err: any) {
      const msg = err.response?.data?.error?.message || (isRtl ? 'فشل إرسال رمز جديد. حاول لاحقاً.' : 'Failed to resend code. Please try again.');
      setError(msg);
      toast.error(msg);
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto p-6 bg-white dark:bg-slate-900 rounded-3xl shadow-xl border border-slate-100 dark:border-slate-800">
      <div className="text-center mb-8">
        <div className="w-16 h-16 bg-brand-50 dark:bg-brand-900/30 text-brand-600 dark:text-brand-400 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <Mail className="w-8 h-8" />
        </div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
          {t('auth.verifyEmailTitle', 'Verify Your Email')}
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">
          {t('auth.verifyEmailSubtitle', 'We sent a 6-digit verification code to:')}
        </p>
        <p className="text-sm font-semibold text-brand-600 dark:text-brand-400 mt-1 font-mono">
          {emailMasked || t('auth.yourEmail', 'your email address')}
        </p>
      </div>

      {devOtp && (
        <div className="mb-6 p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-xl text-center">
          <span className="text-xs text-amber-700 dark:text-amber-300 font-medium">
            🧪 {t('auth.devOtpBanner', 'Dev / Test OTP')}: <strong className="font-mono text-sm tracking-widest">{devOtp}</strong>
          </span>
        </div>
      )}

      {error && (
        <div className="mb-6 p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-xl flex items-center gap-2 text-sm text-red-600 dark:text-red-400">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleVerify} className="space-y-6">
        <div>
          <label htmlFor="otpCode" className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-2">
            {t('auth.otpCodeLabel', '6-Digit Verification Code')}
          </label>
          <input
            id="otpCode"
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={6}
            autoFocus
            autoComplete="one-time-code"
            value={otpCode}
            onChange={(e) => {
              const val = e.target.value.replace(/\D/g, '').slice(0, 6);
              setOtpCode(val);
              if (error) setError(null);
            }}
            placeholder="000000"
            className="w-full text-center text-3xl font-mono tracking-[0.5em] py-3.5 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-2xl focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 text-slate-900 dark:text-slate-100 transition duration-150"
            required
          />
        </div>

        <Button
          type="submit"
          className="w-full py-3 text-base rounded-xl font-semibold"
          disabled={loading || otpCode.trim().length !== 6}
        >
          {loading ? (
            <div className="flex items-center justify-center gap-2">
              <RefreshCw className="w-4 h-4 animate-spin" />
              <span>{t('common.verifying', 'Verifying...')}</span>
            </div>
          ) : (
            <div className="flex items-center justify-center gap-2">
              <CheckCircle className="w-4 h-4" />
              <span>{t('auth.verifyAndContinue', 'Verify & Continue')}</span>
            </div>
          )}
        </Button>
      </form>

      <div className="mt-8 pt-6 border-t border-slate-100 dark:border-slate-800 text-center space-y-4">
        <p className="text-sm text-slate-500 dark:text-slate-400">
          {t('auth.didntReceiveCode', "Didn't receive the code?")}{' '}
          {cooldown > 0 ? (
            <span className="text-slate-400 dark:text-slate-500 font-mono text-xs">
              {t('auth.resendCooldown', 'Resend in {{seconds}}s', { seconds: cooldown })}
            </span>
          ) : (
            <button
              type="button"
              onClick={handleResend}
              disabled={resending}
              className="text-brand-600 dark:text-brand-400 font-semibold hover:underline focus:outline-none disabled:opacity-50"
            >
              {resending ? t('common.sending', 'Sending...') : t('auth.resendCode', 'Resend Code')}
            </button>
          )}
        </p>

        <div>
          <Link
            to="/login"
            className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>{t('auth.backToLogin', 'Back to login')}</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
