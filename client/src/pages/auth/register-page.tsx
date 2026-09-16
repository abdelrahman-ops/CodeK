import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/auth-context.js';
import { useTranslation } from 'react-i18next';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../components/ui/card.js';
import { Button } from '../../components/ui/button.js';
import { Input } from '../../components/ui/input.js';
import { PasswordInput } from '../../components/ui/password-input.js';
import { Select } from '../../components/ui/select.js';
import { User, Mail, Lock, Phone, ArrowRight, ArrowLeft, Sparkles, CheckCircle2 } from 'lucide-react';
import { useToast } from '../../components/ui/toast.js';
import { Logo } from '@/components/ui/logo.js';

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
        website: website.trim() ? website.trim() : undefined
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
            devOtp: res.devOtp
          }
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
      const msg = err.response?.data?.error?.message || (isRtl ? 'فشل إنشاء الحساب، يرجى المحاولة مرة أخرى' : 'Failed to create account. Please try again.');
      toast.error(msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-lg p-6 sm:p-8 shadow-xl border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-slate-900 rounded-2xl sm:rounded-3xl">
      <CardHeader className="text-center p-0 pb-6">
        <div className="mx-auto w-12 h-12 rounded-2xl bg-brand-50 dark:bg-brand-950/80 text-brand-600 dark:text-brand-400 flex items-center justify-center mb-3">
          <Logo size="sm" iconOnly />
        </div>
        <CardTitle className="text-xl sm:text-2xl font-black">
          {isRtl ? 'إنشاء حساب طالب جديد' : 'Create a Student Account'}
        </CardTitle>
        <CardDescription className="text-xs sm:text-sm mt-1">
          {isRtl
            ? 'انضم إلى أكاديمية CodeK وابدأ رحلتك في تعلم البرمجة فوراً'
            : 'Join CodeK Academy and start your coding journey right now'}
        </CardDescription>
      </CardHeader>

      <CardContent className="p-0">
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

          {/* Phone field */}
          <Input
            label={isRtl ? 'رقم الهاتف (اختياري)' : 'Phone Number (Optional)'}
            type="tel"
            placeholder={isRtl ? '01XXXXXXXXX' : '+20 1X XXXXXXXX'}
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            leftIcon={<Phone className="w-4 h-4" />}
            disabled={isLoading}
          />

          {/* Programming Level */}
          <Select
            label={isRtl ? 'مستوى البرمجة الحالي' : 'Programming Level'}
            value={programmingLevel}
            onChange={(e) => setProgrammingLevel(e.target.value as any)}
            options={[
              { value: 'BEGINNER', label: isRtl ? 'مبتدئ (لا توجد خبرة سابقة)' : 'Beginner (No prior experience)' },
              { value: 'INTERMEDIATE', label: isRtl ? 'متوسط (لدي أساسيات البرمجة)' : 'Intermediate (Know basics)' },
              { value: 'ADVANCED', label: isRtl ? 'متقدم (خبرة عملية ومشاريع)' : 'Advanced (Built projects)' }
            ]}
            disabled={isLoading}
          />

          {/* Grade / Academic Stage (determines plan & price server-side) */}
          <div className="space-y-1">
            <Select
              label={isRtl ? 'الصف الدراسي / خطة الاشتراك' : 'Grade / Subscription Plan'}
              value={grade}
              onChange={(e) => setGrade(e.target.value)}
              options={[
                {
                  value: 'GRADE_1',
                  label: isRtl ? 'الصف الأول — 150 ج.م / شهرياً' : '1st Grade — 150 EGP / month'
                },
                {
                  value: 'GRADE_2',
                  label: isRtl ? 'الصف الثاني — 250 ج.م / شهرياً' : '2nd Grade — 250 EGP / month'
                },
                {
                  value: 'GRADE_3',
                  label: isRtl ? 'الصف الثالث — 350 ج.م / شهرياً' : '3rd Grade — 350 EGP / month'
                }
              ]}
              disabled={isLoading}
            />
            <p className="text-[11px] text-slate-500 ps-1">
              {isRtl
                ? 'يتم تحديد خطة وسعر الاشتراك تلقائياً من قبل الخادم بناءً على الصف الدراسي.'
                : 'Subscription plan and pricing are determined server-side from your selected grade.'}
            </p>
          </div>

          {/* Password fields */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <PasswordInput
              label={isRtl ? 'كلمة المرور' : 'Password'}
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              leftIcon={<Lock className="w-4 h-4" />}
              required
              disabled={isLoading}
            />
            <PasswordInput
              label={isRtl ? 'تأكيد كلمة المرور' : 'Confirm Password'}
              placeholder="••••••••"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              leftIcon={<Lock className="w-4 h-4" />}
              required
              disabled={isLoading}
            />
          </div>

          <Button type="submit" className="w-full mt-3" size="lg" isLoading={isLoading}>
            <Sparkles className="w-4 h-4 me-2" />
            {isRtl ? 'إنشاء الحساب وبدء التعلم' : 'Create Account & Start Learning'}
          </Button>

          {/* Already have an account */}
          <div className="mt-5 pt-4 border-t border-slate-100 dark:border-slate-800/80 text-center text-xs text-slate-500 dark:text-slate-400 flex flex-wrap items-center justify-center gap-1.5">
            <span>{isRtl ? 'لديك حساب بالفعل؟' : 'Already have an account?'}</span>
            <Link
              to="/login"
              className="font-bold text-brand-600 dark:text-brand-400 hover:text-brand-700 dark:hover:text-brand-300 hover:underline inline-flex items-center gap-1 transition"
            >
              <span>{isRtl ? 'تسجيل الدخول' : 'Sign In'}</span>
              {isRtl ? <ArrowLeft className="w-3.5 h-3.5" /> : <ArrowRight className="w-3.5 h-3.5" />}
            </Link>
          </div>

          {/* Legacy Scholarship / In-person registration link */}
          <div className="text-center text-[11px] text-slate-400 dark:text-slate-500">
            <span>{isRtl ? 'ترغب في التقديم على منحة أو المجموعات الحضورية؟' : 'Applying for a scholarship or in-person group?'} </span>
            <Link
              to="/student-registration"
              className="text-slate-600 dark:text-slate-400 font-semibold hover:underline"
            >
              {isRtl ? 'استمارة القبول والمجموعات' : 'Admission Application'}
            </Link>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
