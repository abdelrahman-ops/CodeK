import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { useAuth } from '../../context/auth-context.js';
import { useTranslation } from 'react-i18next';
import { Button } from '../../components/ui/button.js';
import { Input } from '../../components/ui/input.js';
import { PasswordInput } from '../../components/ui/password-input.js';
import { Select } from '../../components/ui/select.js';
import {
  User,
  Mail,
  Lock,
  Phone,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  CheckCircle2,
  GraduationCap,
  Terminal,
  BookOpen,
  Code2,
} from 'lucide-react';
import { useToast } from '../../components/ui/toast.js';
import { AuthHeader } from '../../components/layout/auth-header.js';
import { DoodleBracket, DoodleStar } from '@/components/shared/doodle-accents.js';

export function RegisterPage() {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [programmingLevel, setProgrammingLevel] = useState<'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED'>('BEGINNER');
  const [grade, setGrade] = useState('GRADE_1');
  const [website, setWebsite] = useState(''); // Anti-spam honeypot (must be empty)

  const [isLoading, setIsLoading] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const toast = useToast();
  const isRtl = i18n.language === 'ar';
  const shouldReduceMotion = useReducedMotion();
  const ArrowIcon = isRtl ? ArrowLeft : ArrowRight;

  const grades = [
    {
      id: 'GRADE_1',
      titleAr: 'الصف الأول الثانوي',
      titleEn: '1st Secondary Grade',
    },
    {
      id: 'GRADE_2',
      titleAr: 'الصف الثاني الثانوي',
      titleEn: '2nd Secondary Grade',
    },
    {
      id: 'GRADE_3',
      titleAr: 'الصف الثالث الثانوي',
      titleEn: '3rd Secondary Grade',
    },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!firstName.trim() || !lastName.trim()) {
      toast.error(isRtl ? 'يرجى إدخال الاسم الأول واسم العائلة' : 'Please enter your first and last name');
      return;
    }

    if (!email.trim()) {
      toast.error(isRtl ? 'يرجى إدخال البريد الإلكتروني' : 'Please enter a valid email address');
      return;
    }

    if (password.length < 6) {
      toast.error(isRtl ? 'كلمة المرور يجب أن تتكون من 6 أحرف على الأقل' : 'Password must be at least 6 characters');
      return;
    }

    if (password !== confirmPassword) {
      toast.error(isRtl ? 'كلمتا المرور غير متطابقتين' : 'Passwords do not match');
      return;
    }

    setIsLoading(true);
    try {
      const res = await register({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim().toLowerCase(),
        phone: phone.trim() ? phone.trim() : undefined,
        grade,
        password,
        programmingLevel,
        website: website.trim() ? website.trim() : undefined,
      });

      if (res.requiresVerification) {
        toast.info(
          isRtl
            ? 'تم إرسال رمز التحقق إلى بريدك الإلكتروني لتأكيد الحساب.'
            : 'A verification code has been sent to your email.'
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

      toast.success(
        isRtl
          ? `أهلاً بك يا ${res.user?.firstName || ''}! تم إنشاء حسابك بنجاح.`
          : `Welcome ${res.user?.firstName || ''}! Your account has been created.`
      );

      navigate('/student');
    } catch (err: any) {
      const msg =
        err.response?.data?.error?.message ||
        (isRtl ? 'فشل إنشاء الحساب، يرجى المحاولة مرة أخرى' : 'Failed to create account. Please try again.');
      toast.error(msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen min-h-[100dvh] w-full flex flex-col bg-white dark:bg-slate-950 overflow-x-hidden">
      {/* 
        Two-panel composition on desktop (Full Screen):
        Registration: FORM (visual left) | ILLUSTRATION (visual right)
        Enforced with dir="ltr" on outer grid wrapper, then dir={isRtl ? 'rtl' : 'ltr'} inside each column.
      */}
      <div dir="ltr" className="grid grid-cols-1 lg:grid-cols-12 min-h-screen min-h-[100dvh] w-full flex-1">
        {/* PANEL 1 (Visual Left): Registration FORM */}
        <motion.div
          dir={isRtl ? 'rtl' : 'ltr'}
          initial={shouldReduceMotion ? false : { opacity: 0, x: -16 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          className="lg:col-span-7 xl:col-span-6 min-h-screen flex flex-col justify-between p-6 sm:p-10 lg:p-12 xl:p-16 bg-white dark:bg-slate-900 border-r border-slate-200/70 dark:border-slate-800/70 shadow-sm"
        >
          {/* Top Bar with Logo & Theme/Language toggles */}
          <AuthHeader />

          {/* Form Content Center */}
          <div className="w-full max-w-xl mx-auto my-auto py-6 sm:py-8">
            {/* Header / Intro */}
            <div className="mb-6 space-y-2">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-brand-50 dark:bg-brand-950/60 text-brand-600 dark:text-brand-400 text-xs font-semibold">
                <GraduationCap className="w-4 h-4" />
                <span>{isRtl ? 'تسجيل طالب جديد' : 'Student Enrollment'}</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-950 dark:text-white">
                {isRtl ? 'أنشئ حسابك وابدأ رحلتك البرمجية' : 'Create Your Account'}
              </h1>
              <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                {isRtl
                  ? 'انضم إلى منصة كودك، وابدأ تطبيق كتابة الكود وبناء مشروعات حقيقية خطوة بخطوة مع إشراف مهندسين.'
                  : 'Start your structured programming and AI journey with hands-on practice.'}
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Honeypot field for anti-spam (hidden) */}
              <input
                type="text"
                name="website"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                style={{ display: 'none' }}
                tabIndex={-1}
                autoComplete="off"
              />

              {/* Name fields */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Input
                  label={isRtl ? 'الاسم الأول' : 'First Name'}
                  placeholder={isRtl ? 'مثال: أحمد' : 'e.g. Ahmed'}
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  leftIcon={<User className="w-4 h-4" />}
                  required
                  disabled={isLoading}
                />
                <Input
                  label={isRtl ? 'اسم العائلة' : 'Last Name'}
                  placeholder={isRtl ? 'مثال: محمد' : 'e.g. Mohamed'}
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  leftIcon={<User className="w-4 h-4" />}
                  required
                  disabled={isLoading}
                />
              </div>

              {/* Email field */}
              <Input
                label={isRtl ? 'البريد الإلكتروني' : 'Email Address'}
                type="email"
                placeholder={isRtl ? 'name@example.com' : 'name@example.com'}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                leftIcon={<Mail className="w-4 h-4" />}
                required
                disabled={isLoading}
              />

              {/* Phone & Programming Level */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Input
                  label={isRtl ? 'رقم الهاتف (اختياري)' : 'Phone Number (Optional)'}
                  type="tel"
                  placeholder={isRtl ? '01xxxxxxxxx' : '01xxxxxxxxx'}
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  leftIcon={<Phone className="w-4 h-4" />}
                  disabled={isLoading}
                />
                <Select
                  label={isRtl ? 'المستوى في البرمجة' : 'Programming Level'}
                  value={programmingLevel}
                  onChange={(e) => setProgrammingLevel(e.target.value as any)}
                  disabled={isLoading}
                  options={[
                    { value: 'BEGINNER', label: isRtl ? 'مبتدئ تماماً (من الصفر)' : 'Complete Beginner' },
                    { value: 'INTERMEDIATE', label: isRtl ? 'لدي معرفة بسيطة' : 'Some Experience' },
                    { value: 'ADVANCED', label: isRtl ? 'متوسط / متقدم' : 'Intermediate / Advanced' },
                  ]}
                />
              </div>

              {/* 
                CLEAN GRADE SELECTION - ZERO SUBSCRIPTION PRICING OR PLAN NAMES.
                Establishes academic stage only.
              */}
              <div className="space-y-2 pt-1">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  {isRtl ? 'الصف الدراسي' : 'Your Academic Grade'}
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  {grades.map((g) => {
                    const isSelected = grade === g.id;
                    return (
                      <button
                        key={g.id}
                        type="button"
                        onClick={() => setGrade(g.id)}
                        disabled={isLoading}
                        className={`relative flex items-center justify-between sm:justify-center p-3 rounded-xl border text-xs sm:text-sm font-semibold transition-all cursor-pointer text-center ${
                          isSelected
                            ? 'border-brand-600 bg-brand-50/70 dark:bg-brand-950/50 text-brand-700 dark:text-brand-300 ring-2 ring-brand-500/20 shadow-sm'
                            : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 text-slate-700 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-850'
                        }`}
                      >
                        <span>{isRtl ? g.titleAr : g.titleEn}</span>
                        {isSelected && (
                          <CheckCircle2 className="w-4 h-4 text-brand-600 dark:text-brand-400 shrink-0 sm:hidden" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Passwords */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <PasswordInput
                  label={isRtl ? 'كلمة المرور' : 'Password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={isLoading}
                />
                <PasswordInput
                  label={isRtl ? 'تأكيد كلمة المرور' : 'Confirm Password'}
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  disabled={isLoading}
                />
              </div>

              {/* Submit CTA */}
              <div className="pt-3">
                <Button
                  type="submit"
                  size="lg"
                  className="w-full justify-center text-sm font-bold bg-brand-600 hover:bg-brand-500 text-white shadow-lg shadow-brand-500/25 transition-all cursor-pointer py-3 rounded-xl"
                  isLoading={isLoading}
                >
                  <span>{isRtl ? 'إنشاء الحساب وبدء التعلّم' : 'Create Account'}</span>
                  <ArrowIcon className="w-4 h-4 ms-2" />
                </Button>
              </div>
            </form>

            {/* Navigation to Login */}
            <div className="mt-6 pt-5 border-t border-slate-150 dark:border-slate-800 text-center">
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400">
                {isRtl ? 'لديك حساب بالفعل على كودك؟' : 'Already have an account?'}
                <Link
                  to="/login"
                  className="ms-1.5 font-bold text-brand-600 hover:text-brand-500 dark:text-brand-400 dark:hover:text-brand-300 underline underline-offset-4 decoration-brand-300 transition"
                >
                  {isRtl ? 'تسجيل الدخول' : 'Sign in'}
                </Link>
              </p>
            </div>

            {/* Mobile Visual Accent (Hidden on Desktop) */}
            <div className="lg:hidden mt-8 p-5 rounded-2xl bg-gradient-to-br from-brand-50 via-indigo-50/40 to-slate-50 dark:from-slate-850 dark:via-brand-950/30 dark:to-slate-900 border border-brand-200/40 dark:border-brand-900/30 flex flex-col items-center text-center">
              <img
                src="/illustrations/code-typing-rafiki.svg"
                alt="CodeK Learning Journey"
                className="w-44 h-36 object-contain drop-shadow-sm mb-2"
                loading="lazy"
              />
              <p className="text-xs font-semibold text-brand-900 dark:text-brand-200">
                {isRtl ? 'تعلّم البرمجة الحقيقية خطوة بخطوة' : 'Master real software engineering step by step'}
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

        {/* PANEL 2 (Visual Right): Registration ILLUSTRATION */}
        <motion.div
          dir={isRtl ? 'rtl' : 'ltr'}
          initial={shouldReduceMotion ? false : { opacity: 0, x: 16 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1], delay: 0.1 }}
          className="hidden lg:flex lg:col-span-5 xl:col-span-6 relative bg-gradient-to-br from-brand-600 via-brand-700 to-indigo-900 dark:from-slate-950 dark:via-brand-950 dark:to-indigo-950 flex-col items-center justify-between p-10 xl:p-16 overflow-hidden min-h-screen text-white select-none"
        >
          {/* Background Ambient Glow & Patterns */}
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.15),transparent_50%)] pointer-events-none" />
          <div className="absolute -top-24 -right-24 w-96 h-96 bg-brand-400/20 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none" />

          {/* Top header badge */}
          <div className="w-full flex items-center justify-between relative z-10">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-xs font-semibold text-white/90">
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              <span>{isRtl ? '! Hello World' : 'Hello World!'}</span>
            </div>

            <div className="flex items-center gap-2 text-white/60">
              <DoodleBracket className="w-4 h-4" />
              <Code2 className="w-4 h-4 text-brand-200" />
            </div>
          </div>

          {/* Central Illustration with gentle floating animation */}
          <div className="relative z-10 w-full max-w-lg flex flex-col items-center my-auto text-center">
            <motion.div
              animate={shouldReduceMotion ? {} : { y: [0, -6, 0] }}
              transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
              className="relative w-full max-w-sm xl:max-w-md aspect-square flex items-center justify-center mb-6"
            >
              <img
                src="/illustrations/code-typing-rafiki.svg"
                alt="Student writing code at CodeK"
                className="w-full h-full object-contain filter drop-shadow-2xl"
              />
            </motion.div>

            <h2 className="text-xl sm:text-2xl xl:text-3xl font-bold tracking-tight text-white mb-3">
              {isRtl ? 'ابدأ رحلتك البرمجية الحقيقية' : 'Start Your Real Coding Journey'}
            </h2>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
