import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/auth-context.js';
import { useTranslation } from 'react-i18next';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../components/ui/card.js';
import { Input } from '../../components/ui/input.js';
import { PasswordInput } from '../../components/ui/password-input.js';
import { Button } from '../../components/ui/button.js';
import { User, Lock, Shield, KeyRound, ArrowRight, ArrowLeft, RefreshCw, UserPlus } from 'lucide-react';
import { useToast } from '../../components/ui/toast.js';
import { Logo } from '@/components/ui/logo.js';

export function LoginPage() {
  const [step, setStep] = useState<'CREDENTIALS' | 'OTP'>('CREDENTIALS');
  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');
  const [tempToken, setTempToken] = useState('');
  const [maskedEmail, setMaskedEmail] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [countdown, setCountdown] = useState(60);
  const [isLoading, setIsLoading] = useState(false);
  const [isResending, setIsResending] = useState(false);

  const { login, verify2FA, resend2FA } = useAuth();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const toast = useToast();
  const isRtl = i18n.language === 'ar';

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (step === 'OTP' && countdown > 0) {
      timer = setInterval(() => {
        setCountdown((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [step, countdown]);

  const handleCredentialsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginId || !password) return;

    setIsLoading(true);
    try {
      const res = await login(loginId.trim(), password);

      if (res.requires2FA && res.tempToken) {
        setTempToken(res.tempToken);
        setMaskedEmail(res.emailMasked || '');
        setStep('OTP');
        setCountdown(60);
        setOtpCode('');
        toast.info(t('auth.otpSentNotice') || 'Verification code sent to your email');
        return;
      }

      if (res.requiresVerification) {
        toast.info(
          isRtl
            ? 'حسابك يحتاج إلى تأكيد البريد الإلكتروني أولاً.'
            : 'Your account requires email verification.'
        );
        navigate('/verify-email', {
          state: {
            userId: res.userId,
            emailMasked: res.emailMasked,
            devOtp: res.devOtp
          }
        });
        return;
      }

      // Student / Parent direct login
      toast.success(t('auth.loginSuccess'));

      if (res.mustChangePassword) {
        navigate('/change-password');
      } else if (res.user?.role === 'PARENT') {
        navigate('/parent');
      } else {
        navigate('/student');
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error?.message || t('auth.invalidCredentials'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleOtpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otpCode || otpCode.trim().length !== 6 || !tempToken) return;

    setIsLoading(true);
    try {
      const user = await verify2FA(tempToken, otpCode.trim());
      toast.success(t('auth.loginSuccess'));

      if (user.mustChangePassword) {
        navigate('/change-password');
      } else if (user.role === 'ADMIN') {
        navigate('/admin');
      } else {
        navigate('/student');
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error?.message || t('auth.invalidOtp') || 'Invalid verification code');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (countdown > 0 || isResending || !tempToken) return;

    setIsResending(true);
    try {
      const res = await resend2FA(tempToken);
      setTempToken(res.tempToken);
      setMaskedEmail(res.emailMasked);
      setCountdown(60);
      toast.success(t('auth.otpResentSuccess') || 'A new verification code has been sent');
    } catch (err: any) {
      toast.error(err.response?.data?.error?.message || t('auth.otpResendFailed') || 'Failed to resend code');
    } finally {
      setIsResending(false);
    }
  };

  return (
    <Card className="w-full max-w-md p-6 sm:p-8 shadow-xl border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-slate-900 rounded-2xl sm:rounded-3xl">
      <CardHeader className="text-center p-0 pb-6">
        <div className="mx-auto w-12 h-12 rounded-2xl bg-brand-50 dark:bg-brand-950/80 text-brand-600 dark:text-brand-400 flex items-center justify-center mb-3">
          {step === 'CREDENTIALS' ? <Logo size="sm" iconOnly /> : <Shield className="w-6 h-6 text-brand-500" />}
        </div>
        <CardTitle className="text-xl sm:text-2xl font-black">
          {step === 'CREDENTIALS' ? t('auth.loginTitle') : t('auth.twoFactorTitle') || 'Two-Factor Authentication'}
        </CardTitle>
        <CardDescription className="text-xs sm:text-sm mt-1">
          {step === 'CREDENTIALS'
            ? t('auth.loginSubtitle')
            : (t('auth.twoFactorSubtitle') || 'Enter the 6-digit code sent to') + ` ${maskedEmail}`}
        </CardDescription>
      </CardHeader>

      <CardContent className="p-0">
        {step === 'CREDENTIALS' ? (
          <form onSubmit={handleCredentialsSubmit} className="space-y-4">
            <Input
              label={t('auth.loginId')}
              placeholder={t('auth.loginIdPlaceholder')}
              value={loginId}
              onChange={(e) => setLoginId(e.target.value)}
              leftIcon={<User className="w-4 h-4" />}
              required
              disabled={isLoading}
            />

            <PasswordInput
              label={t('auth.password')}
              placeholder={t('auth.passwordPlaceholder')}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              leftIcon={<Lock className="w-4 h-4" />}
              required
              disabled={isLoading}
            />

            <Button type="submit" className="w-full mt-2" size="lg" isLoading={isLoading}>
              {t('auth.signIn')}
            </Button>

            {/* Link to Registration Route */}
            <div className="mt-6 pt-5 border-t border-slate-100 dark:border-slate-800/80 text-center text-xs text-slate-500 dark:text-slate-400 flex flex-wrap items-center justify-center gap-1.5">
              <span>{t('auth.noAccount') || (isRtl ? 'طالب جديد؟' : 'New Student?')}</span>
              <Link
                to="/register"
                className="font-bold text-brand-600 dark:text-brand-400 hover:text-brand-700 dark:hover:text-brand-300 hover:underline inline-flex items-center gap-1 transition"
              >
                <span>{t('auth.registerHere') || (isRtl ? 'سجّل الآن في الأكاديمية' : 'Apply for Admission')}</span>
                {isRtl ? <ArrowLeft className="w-3.5 h-3.5" /> : <ArrowRight className="w-3.5 h-3.5" />}
              </Link>
            </div>
          </form>
        ) : (
          <form onSubmit={handleOtpSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                {t('auth.verificationCode') || '6-Digit Verification Code'}
              </label>
              <div className="relative">
                <input
                  type="text"
                  maxLength={6}
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                  placeholder="••••••"
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-xl text-center text-2xl font-mono tracking-[0.5em] font-bold focus:outline-none focus:ring-2 focus:ring-brand-500 transition"
                  autoFocus
                  required
                  disabled={isLoading}
                />
              </div>
            </div>

            <Button
              type="submit"
              className="w-full mt-2"
              size="lg"
              isLoading={isLoading}
              disabled={otpCode.trim().length !== 6}
            >
              <KeyRound className="w-4 h-4 mx-1.5" />
              {t('auth.verifyCode') || 'Verify & Continue'}
            </Button>

            {/* Resend & Back controls */}
            <div className="flex items-center justify-between pt-3 text-xs text-slate-500 dark:text-slate-400">
              <button
                type="button"
                onClick={() => {
                  setStep('CREDENTIALS');
                  setOtpCode('');
                }}
                className="hover:text-slate-800 dark:hover:text-slate-200 font-medium flex items-center gap-1 transition"
              >
                {isRtl ? <ArrowRight className="w-3.5 h-3.5" /> : <ArrowLeft className="w-3.5 h-3.5" />}
                <span>{t('auth.backToLogin') || 'Back'}</span>
              </button>

              <button
                type="button"
                onClick={handleResendOtp}
                disabled={countdown > 0 || isResending}
                className={`font-bold transition flex items-center gap-1.5 ${
                  countdown > 0
                    ? 'text-slate-400 cursor-not-allowed'
                    : 'text-brand-600 dark:text-brand-400 hover:underline'
                }`}
              >
                <RefreshCw className={`w-3 h-3 ${isResending ? 'animate-spin' : ''}`} />
                {countdown > 0 ? (
                  <span>{t('auth.resendIn') || 'Resend in'} {countdown}s</span>
                ) : (
                  <span>{t('auth.resendCode') || 'Resend Code'}</span>
                )}
              </button>
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
