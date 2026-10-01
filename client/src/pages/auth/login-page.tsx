import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { useAuth } from '../../context/auth-context.js';
import { useTranslation } from 'react-i18next';
import { Button } from '../../components/ui/button.js';
import { Input } from '../../components/ui/input.js';
import { PasswordInput } from '../../components/ui/password-input.js';
import {
  User,
  Lock,
  Shield,
  KeyRound,
  ArrowRight,
  ArrowLeft,
  RefreshCw,
  Sparkles,
  CheckCircle2,
  Terminal,
  Compass,
  Code2,
  Award,
} from 'lucide-react';
import { useToast } from '../../components/ui/toast.js';
import { AuthHeader } from '../../components/layout/auth-header.js';
import { DoodleBracket, DoodleStar } from '@/components/shared/doodle-accents.js';

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
  const shouldReduceMotion = useReducedMotion();
  const ArrowIcon = isRtl ? ArrowLeft : ArrowRight;

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
    if (!loginId.trim() || !password) return;

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
            devOtp: res.devOtp,
          },
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
      const status = err.response?.status;
      const serverCode = err.response?.data?.error?.code;
      const serverMsg = err.response?.data?.error?.message;

      if (status === 401 || serverCode === 'UNAUTHORIZED' || serverMsg === 'Invalid credentials') {
        toast.error(
          isRtl
            ? 'بيانات الدخول غير صحيحة. يرجى التأكد من اسم المستخدم أو البريد الإلكتروني وكلمة المرور.'
            : 'Invalid login ID or password. Please check your credentials and try again.'
        );
      } else if (status === 503 || serverCode === 'SERVICE_UNAVAILABLE' || serverMsg?.toLowerCase().includes('database')) {
        toast.error(
          isRtl
            ? 'تعذر الاتصال بالخادم وقاعدة البيانات. يرجى التأكد من تشغيل الخدمة والمحاولة لاحقاً.'
            : 'Service is currently unavailable. Please check database server connectivity and try again.'
        );
      } else if (serverMsg && !serverMsg.includes('prisma') && !serverMsg.includes('\\') && !serverMsg.includes('findFirst')) {
        toast.error(serverMsg);
      } else {
        toast.error(
          isRtl
            ? 'حدث خطأ أثناء تسجيل الدخول. يرجى المحاولة مرة أخرى.'
            : 'An error occurred during login. Please try again.'
        );
      }
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
      const status = err.response?.status;
      const serverCode = err.response?.data?.error?.code;
      const serverMsg = err.response?.data?.error?.message;

      if (status === 401 || serverCode === 'UNAUTHORIZED') {
        toast.error(
          isRtl
            ? 'رمز التحقق غير صحيح أو انتهت صلاحيته. يرجى طلب رمز جديد.'
            : 'Invalid or expired verification code. Please request a new code.'
        );
      } else {
        toast.error(serverMsg || (isRtl ? 'فشل التحقق من الرمز' : 'Verification failed. Please try again.'));
      }
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
    <div className="min-h-screen min-h-[100dvh] w-full flex flex-col bg-white dark:bg-slate-950 overflow-x-hidden">
      {/* 
        Two-panel composition on desktop (Full Screen):
        Login: ILLUSTRATION (visual left) | FORM (visual right)
        Enforced with dir="ltr" on outer grid wrapper, then dir={isRtl ? 'rtl' : 'ltr'} inside each column.
      */}
      <div dir="ltr" className="grid grid-cols-1 lg:grid-cols-12 min-h-screen min-h-[100dvh] w-full flex-1">
        {/* PANEL 1 (Visual Left on Desktop): Login ILLUSTRATION */}
        <motion.div
          dir={isRtl ? 'rtl' : 'ltr'}
          initial={shouldReduceMotion ? false : { opacity: 0, x: -16 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
          className="hidden lg:flex lg:col-span-5 xl:col-span-6 relative bg-gradient-to-br from-brand-600 via-brand-700 to-indigo-900 dark:from-slate-950 dark:via-brand-950 dark:to-indigo-950 flex-col items-center justify-between p-10 xl:p-16 overflow-hidden min-h-screen text-white select-none"
        >
          {/* Ambient Glows & Patterns */}
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_20%,rgba(255,255,255,0.15),transparent_50%)] pointer-events-none" />
          <div className="absolute -top-24 -left-24 w-96 h-96 bg-brand-400/20 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none" />

          {/* Top header badge */}
          <div className="w-full flex items-center justify-between relative z-10">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-xs font-semibold text-white/90">
              <Compass className="w-3.5 h-3.5 text-cyan-300" />
              <span>{isRtl ? 'بوابة الطلاب وأولياء الأمور' : 'Student & Parent Portal'}</span>
            </div>

            <div className="flex items-center gap-2 text-white/60">
              <Code2 className="w-4 h-4 text-brand-200" />
              <DoodleStar animate={true} className="w-4 h-4 text-amber-300" />
            </div>
          </div>

          {/* Central Illustration with subtle floating animation */}
          <div className="relative z-10 w-full max-w-lg flex flex-col items-center my-auto text-center">
            <motion.div
              animate={shouldReduceMotion ? {} : { y: [0, -6, 0] }}
              transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
              className="relative w-full max-w-sm xl:max-w-md aspect-square flex items-center justify-center mb-6"
            >
              <img
                src="/illustrations/programming-amico.svg"
                alt="Student learning with CodeK"
                className="w-full h-full object-contain filter drop-shadow-2xl"
              />
            </motion.div>

            <h2 className="text-xl sm:text-2xl xl:text-3xl font-bold tracking-tight text-white mb-3">
              {isRtl ? 'مرحباً بعودتك إلى مساحتك التعليمية' : 'Welcome Back to CodeK'}
            </h2>
          </div>
        </motion.div>

        {/* PANEL 2 (Visual Right on Desktop): Login FORM */}
        <motion.div
          dir={isRtl ? 'rtl' : 'ltr'}
          initial={shouldReduceMotion ? false : { opacity: 0, x: 16 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1], delay: 0.05 }}
          className="lg:col-span-7 xl:col-span-6 min-h-screen flex flex-col justify-between p-6 sm:p-10 lg:p-12 xl:p-16 bg-white dark:bg-slate-900 border-l border-slate-200/70 dark:border-slate-800/70 shadow-sm"
        >
          {/* Top Bar with Logo & Theme/Language toggles */}
          <AuthHeader />

          {/* Form Content Center */}
          <div className="w-full max-w-lg mx-auto my-auto py-6 sm:py-8">
            {/* Header / Intro */}
            <div className="mb-6 space-y-2">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-brand-50 dark:bg-brand-950/60 text-brand-600 dark:text-brand-400 text-xs font-semibold">
                {step === 'CREDENTIALS' ? (
                  <>
                    <User className="w-4 h-4" />
                    <span>{isRtl ? 'بوابة الدخول الموحدة' : 'Unified Login Portal'}</span>
                  </>
                ) : (
                  <>
                    <Shield className="w-4 h-4 text-brand-500" />
                    <span>{isRtl ? 'تأكيد أمان الحساب (2FA)' : 'Security Verification'}</span>
                  </>
                )}
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-950 dark:text-white">
                {step === 'CREDENTIALS'
                  ? isRtl
                    ? 'تسجيل الدخول'
                    : t('auth.loginTitle')
                  : t('auth.twoFactorTitle') || 'Two-Factor Authentication'}
              </h1>
              <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                {step === 'CREDENTIALS'
                  ? isRtl
                    ? 'أدخل بيانات حسابك للوصول إلى لوحة الطالب أو ولي الأمر ومتابعة الدروس.'
                    : t('auth.loginSubtitle')
                  : (t('auth.twoFactorSubtitle') || 'Enter the 6-digit code sent to') + ` ${maskedEmail}`}
              </p>
            </div>

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

                <div className="pt-2">
                  <Button
                    type="submit"
                    className="w-full text-sm font-bold bg-brand-600 hover:bg-brand-500 text-white shadow-lg shadow-brand-500/25 transition-all cursor-pointer py-3 rounded-xl"
                    size="lg"
                    isLoading={isLoading}
                  >
                    <span>{t('auth.signIn')}</span>
                    <ArrowIcon className="w-4 h-4 ms-2" />
                  </Button>
                </div>

                {/* Link to Registration Route */}
                <div className="mt-6 pt-5 border-t border-slate-150 dark:border-slate-800 text-center">
                  <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400">
                    {t('auth.noAccount') || (isRtl ? 'طالب جديد وليس لديك حساب؟' : 'New student without account?')}
                    <Link
                      to="/register"
                      className="ms-1.5 font-bold text-brand-600 hover:text-brand-500 dark:text-brand-400 dark:hover:text-brand-300 underline underline-offset-4 decoration-brand-300 transition"
                    >
                      {t('auth.registerHere') || (isRtl ? 'أنشئ حسابك الآن' : 'Create an Account')}
                    </Link>
                  </p>
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
                  className="w-full mt-2 text-sm font-bold bg-brand-600 hover:bg-brand-500 text-white shadow-lg shadow-brand-500/25 transition-all cursor-pointer py-3 rounded-xl"
                  size="lg"
                  isLoading={isLoading}
                  disabled={otpCode.trim().length !== 6}
                >
                  <KeyRound className="w-4 h-4 mx-1.5" />
                  <span>{t('auth.verifyCode') || 'Verify & Continue'}</span>
                </Button>

                {/* Resend & Back controls */}
                <div className="flex items-center justify-between pt-3 text-xs text-slate-500 dark:text-slate-400">
                  <button
                    type="button"
                    onClick={() => {
                      setStep('CREDENTIALS');
                      setOtpCode('');
                    }}
                    className="hover:text-slate-800 dark:hover:text-slate-200 font-medium flex items-center gap-1 transition cursor-pointer"
                  >
                    {isRtl ? <ArrowRight className="w-3.5 h-3.5" /> : <ArrowLeft className="w-3.5 h-3.5" />}
                    <span>{t('auth.backToLogin') || 'Back'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleResendOtp}
                    disabled={countdown > 0 || isResending}
                    className={`font-bold transition flex items-center gap-1.5 cursor-pointer ${
                      countdown > 0
                        ? 'text-slate-400 cursor-not-allowed'
                        : 'text-brand-600 dark:text-brand-400 hover:underline'
                    }`}
                  >
                    <RefreshCw className={`w-3 h-3 ${isResending ? 'animate-spin' : ''}`} />
                    {countdown > 0 ? (
                      <span>
                        {t('auth.resendIn') || 'Resend in'} {countdown}s
                      </span>
                    ) : (
                      <span>{t('auth.resendCode') || 'Resend Code'}</span>
                    )}
                  </button>
                </div>
              </form>
            )}

            {/* Mobile Visual Accent (Hidden on Desktop) */}
            <div className="lg:hidden mt-8 p-5 rounded-2xl bg-gradient-to-br from-brand-50 via-indigo-50/40 to-slate-50 dark:from-slate-850 dark:via-brand-950/30 dark:to-slate-900 border border-brand-200/40 dark:border-brand-900/30 flex flex-col items-center text-center">
              <img
                src="/illustrations/programming-amico.svg"
                alt="CodeK Learning Space"
                className="w-44 h-36 object-contain drop-shadow-sm mb-2"
                loading="lazy"
              />
              <p className="text-xs font-semibold text-brand-900 dark:text-brand-200">
                {isRtl ? 'واصل مسارك التعليمي وتطوير مشاريعك' : 'Continue your coding path and projects'}
              </p>
            </div>
          </div>

          {/* Footer inside form column */}
          <div className="pt-4 border-t border-slate-100 dark:border-slate-800/80 flex flex-wrap items-center justify-between text-xs text-slate-400 dark:text-slate-600 font-medium">
            <span>&copy; {new Date().getFullYear()} {t('common.appName')}. {t('common.allRightsReserved') || 'All rights reserved.'}</span>
            <div className="flex items-center gap-3">
              <Link to="/#about" className="hover:text-slate-600 dark:hover:text-slate-400 transition">
                {isRtl ? 'عن المنصة' : 'About'}
              </Link>
              <span>•</span>
              <Link to="/#faq" className="hover:text-slate-600 dark:hover:text-slate-400 transition">
                {isRtl ? 'الأسئلة الشائعة' : 'FAQ'}
              </Link>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
