import React, { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '../../lib/api/client.js';
import { useTranslation } from 'react-i18next';
import {
  GraduationCap,
  CheckCircle2,
  AlertCircle,
  Clock,
  Sparkles,
  User,
  Phone,
  Calendar,
  Send,
  ArrowRight,
  ArrowLeft,
  Copy,
  Check
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../components/ui/card.js';
import { Button } from '../../components/ui/button.js';
import { Input } from '../../components/ui/input.js';
import { Select } from '../../components/ui/select.js';
import { Badge } from '../../components/ui/badge.js';
import { useToast } from '../../components/ui/toast.js';
import { PublicRegistrationStatus, StudentRegistration } from '../../types/api.js';
import { formatScheduleDisplay } from '../../lib/i18n-helpers.js';

export function PublicRegistrationPage() {
  const { t, i18n } = useTranslation();
  const isArabic = i18n.language === 'ar';
  const toast = useToast();

  const [formLoadedAt] = useState<number>(() => Date.now());
  const [submittedRegistration, setSubmittedRegistration] = useState<StudentRegistration | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);

  // Form Fields
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [whatsappPhone, setWhatsappPhone] = useState('');
  const [email, setEmail] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [schoolName, setSchoolName] = useState('');
  const [grade, setGrade] = useState('');
  const [preferredDays, setPreferredDays] = useState<string[]>([]);
  const [preferredTimes, setPreferredTimes] = useState('');
  const [parentName, setParentName] = useState('');
  const [parentPhone, setParentPhone] = useState('');
  const [parentRelationship, setParentRelationship] = useState<'FATHER' | 'MOTHER' | 'GUARDIAN' | 'OTHER'>('FATHER');

  // Group Selection State
  const [selectedGroupId, setSelectedGroupId] = useState<string>('');

  // Anti-spam Honeypot (must remain empty)
  const [website, setWebsite] = useState('');

  // Fetch Public Registration Status
  const { data: status, isLoading: statusLoading } = useQuery<PublicRegistrationStatus>({
    queryKey: ['publicRegistrationStatus'],
    queryFn: async () => (await api.registrations.getPublicStatus()).data.data
  });

  const submitMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        phone: phone.trim(),
        whatsappPhone: (whatsappPhone || phone).trim(),
        email: email ? email.trim() : null,
        dateOfBirth: dateOfBirth || null,
        schoolName: schoolName ? schoolName.trim() : null,
        grade: grade ? grade.trim() : null,
        preferredGroupId: selectedGroupId || null,
        preferredDays: preferredDays.length > 0 ? preferredDays.join(', ') : null,
        preferredTimes: preferredTimes || null,
        parentName: parentName ? parentName.trim() : null,
        parentPhone: parentPhone ? parentPhone.trim() : null,
        parentRelationship: parentName ? parentRelationship : null,
        website,
        formLoadedAt
      };
      return (await api.registrations.submitPublic(payload)).data.data;
    },
    onSuccess: (data) => {
      setSubmittedRegistration(data);
      toast.success(t('registrations.submittedSuccess'));
    },
    onError: (err: any) => {
      const msg = err.response?.data?.error?.message || t('common.error');
      toast.error(msg);
    }
  });

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(true);
    toast.success(t('common.copied') || 'Copied to clipboard!');
    setTimeout(() => setCopiedCode(false), 2000);
  };

  // Loading Skeleton Card
  if (statusLoading) {
    return (
      <Card className="w-full max-w-xl p-8 sm:p-12 shadow-xl border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-slate-900 rounded-2xl sm:rounded-3xl text-center space-y-4">
        <Clock className="w-8 h-8 text-brand-500 animate-spin mx-auto" />
        <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{t('common.loading')}</p>
      </Card>
    );
  }

  // Registration Closed Card
  if (status && !status.isOpen && !submittedRegistration) {
    return (
      <Card className="w-full max-w-xl p-6 sm:p-8 shadow-xl border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-slate-900 rounded-2xl sm:rounded-3xl text-center space-y-6">
        <div className="w-14 h-14 rounded-2xl bg-amber-50 dark:bg-amber-950/60 text-amber-500 dark:text-amber-400 flex items-center justify-center mx-auto">
          <AlertCircle className="w-7 h-7" />
        </div>
        <div className="space-y-2">
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
            {isArabic ? 'التسجيل مغلق حالياً' : 'Registration Currently Closed'}
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto">
            {status.closedReason ||
              (isArabic
                ? 'عفواً، باب التسجيل مغلق حالياً. نرجو المتابعة لاحقاً للالتحاق بالدفعة القادمة.'
                : 'Registration is currently closed. Please check back later for the next cohort.')}
          </p>
        </div>

        <div className="pt-2">
          <Link to="/login">
            <Button variant="outline" className="w-full">
              {isArabic ? 'العودة لتسجيل الدخول' : 'Back to Sign In'}
            </Button>
          </Link>
        </div>
      </Card>
    );
  }

  // Registration Success Card
  if (submittedRegistration) {
    return (
      <Card className="w-full max-w-xl p-6 sm:p-8 shadow-xl border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-slate-900 rounded-2xl sm:rounded-3xl text-center space-y-6 animate-in fade-in duration-300">
        <div className="w-16 h-16 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-500 dark:text-emerald-400 flex items-center justify-center mx-auto shadow-inner">
          <CheckCircle2 className="w-8 h-8" />
        </div>

        <div className="space-y-2">
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
            {isArabic ? 'تم استلام طلب التسجيل بنجاح! 🎉' : 'Application Received Successfully! 🎉'}
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto">
            {isArabic
              ? 'تم تسجيل بياناتك بنجاح في قاعدة بيانات الأكاديمية وطلبك قيد المراجعة.'
              : 'Your application has been received and is currently under review by our administration team.'}
          </p>
        </div>

        {/* Reference Code Container */}
        <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 space-y-2 max-w-sm mx-auto">
          <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
            {isArabic ? 'رقم مرجع التسجيل الخاص بك' : 'Application Reference Code'}
          </span>
          <div className="flex items-center justify-center gap-2">
            <span className="text-2xl sm:text-3xl font-black text-brand-600 dark:text-brand-400 font-mono tracking-widest">
              {submittedRegistration.registrationCode}
            </span>
            <button
              type="button"
              onClick={() => handleCopyCode(submittedRegistration.registrationCode)}
              className="p-1.5 rounded-lg text-slate-500 hover:text-brand-600 dark:hover:text-brand-400 hover:bg-slate-200/60 dark:hover:bg-slate-800 transition"
              title={isArabic ? 'نسخ الكود' : 'Copy code'}
            >
              {copiedCode ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>
          <p className="text-[11px] text-slate-400 dark:text-slate-500 pt-1">
            {isArabic
              ? 'احتفظ بهذا الرقم لمتابعة طلبك. سيتم التواصل معك عبر الواتساب فور مراجعة الطلب.'
              : 'Keep this code saved. We will reach out via WhatsApp once reviewed.'}
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 pt-2">
          <Link to="/login" className="flex-1">
            <Button className="w-full" size="lg">
              {isArabic ? 'الانتقال لتسجيل الدخول' : 'Go to Sign In'}
            </Button>
          </Link>
          <Button
            variant="outline"
            size="lg"
            className="flex-1"
            onClick={() => {
              setSubmittedRegistration(null);
              setFirstName('');
              setLastName('');
              setPhone('');
              setWhatsappPhone('');
              setEmail('');
              setDateOfBirth('');
              setSchoolName('');
              setGrade('');
              setSelectedGroupId('');
              setParentName('');
              setParentPhone('');
            }}
          >
            {isArabic ? 'تقديم طلب جديد' : 'Submit Another'}
          </Button>
        </div>
      </Card>
    );
  }

  // Active Registration Form
  return (
    <Card className="w-full max-w-xl sm:max-w-2xl p-6 sm:p-8 shadow-xl border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-slate-900 rounded-2xl sm:rounded-3xl animate-in fade-in zoom-in-95 duration-200">
      <CardHeader className="text-center p-0 pb-6 sm:pb-8">
        <div className="mx-auto w-12 h-12 rounded-2xl bg-brand-50 dark:bg-brand-950/80 text-brand-600 dark:text-brand-400 flex items-center justify-center mb-3">
          <GraduationCap className="w-6 h-6 text-brand-500" />
        </div>
        <CardTitle className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
          {isArabic ? 'استمارة الانضمام إلى CodeK' : 'Apply to Join CodeK Academy'}
        </CardTitle>
        <CardDescription className="text-xs sm:text-sm mt-1 max-w-md mx-auto text-slate-500 dark:text-slate-400">
          {isArabic
            ? 'قم بتعبئة بياناتك وسنتواصل معك لتحديد موعد الحصة الأولى وتفعيل حسابك.'
            : 'Fill in your details carefully. Our admin team will review and contact you via WhatsApp.'}
        </CardDescription>
      </CardHeader>

      <CardContent className="p-0">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submitMutation.mutate();
          }}
          className="space-y-6"
        >
          {/* Anti-spam Hidden Honeypot */}
          <input
            type="text"
            name="website"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
            className="hidden"
            tabIndex={-1}
            autoComplete="off"
          />

          {/* Section 1: Student Information */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-xs font-bold text-brand-600 dark:text-brand-400 uppercase tracking-wider pb-2 border-b border-slate-100 dark:border-slate-800/80">
              <User className="w-4 h-4" />
              <span>{isArabic ? 'بيانات الطالب الشخصية' : 'Student Information'}</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 sm:gap-4">
              <Input
                label={isArabic ? 'الاسم الأول *' : 'First Name *'}
                placeholder={isArabic ? 'مثال: أحمد' : 'e.g. Ahmed'}
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                required
                disabled={submitMutation.isPending}
              />

              <Input
                label={isArabic ? 'اسم العائلة *' : 'Last Name *'}
                placeholder={isArabic ? 'مثال: محمد' : 'e.g. Mohamed'}
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                required
                disabled={submitMutation.isPending}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 sm:gap-4">
              <Input
                label={isArabic ? 'رقم الهاتف (واتساب) *' : 'Phone (WhatsApp) *'}
                placeholder="010xxxxxxxx"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
                disabled={submitMutation.isPending}
              />

              <Input
                label={isArabic ? 'رقم الواتساب الإضافي (اختياري)' : 'Secondary WhatsApp (Optional)'}
                placeholder="011xxxxxxxx"
                type="tel"
                value={whatsappPhone}
                onChange={(e) => setWhatsappPhone(e.target.value)}
                disabled={submitMutation.isPending}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 sm:gap-4">
              <Input
                label={isArabic ? 'البريد الإلكتروني (اختياري)' : 'Email Address (Optional)'}
                placeholder="student@example.com"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={submitMutation.isPending}
              />

              <Input
                label={isArabic ? 'تاريخ الميلاد (اختياري)' : 'Date of Birth (Optional)'}
                type="date"
                value={dateOfBirth}
                onChange={(e) => setDateOfBirth(e.target.value)}
                disabled={submitMutation.isPending}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 sm:gap-4">
              <Input
                label={isArabic ? 'اسم المدرسة (اختياري)' : 'School Name (Optional)'}
                placeholder={isArabic ? 'اسم المدرسة' : 'School name'}
                value={schoolName}
                onChange={(e) => setSchoolName(e.target.value)}
                disabled={submitMutation.isPending}
              />

              <Input
                label={isArabic ? 'الصف الدراسي / السنة (اختياري)' : 'Grade / Year (Optional)'}
                placeholder={isArabic ? 'مثال: الأول الثانوي' : 'e.g. Grade 10'}
                value={grade}
                onChange={(e) => setGrade(e.target.value)}
                disabled={submitMutation.isPending}
              />
            </div>
          </div>

          {/* Section 2: Group & Schedule Selection */}
          <div className="space-y-4 pt-2">
            <div className="flex items-center gap-2 text-xs font-bold text-brand-600 dark:text-brand-400 uppercase tracking-wider pb-2 border-b border-slate-100 dark:border-slate-800/80">
              <Calendar className="w-4 h-4" />
              <span>{isArabic ? 'المجموعات والمواعيد المتاحة' : 'Class Groups & Schedules'}</span>
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400">
              {isArabic
                ? 'اختر المجموعة والمواعيد المناسبة لك، أو اختر الخيار المرن لتنسيق الإدارة معك.'
                : 'Select your preferred group schedule, or choose flexible timing.'}
            </p>

            <div className="space-y-2.5">
              {/* Flexible / Any Group Option */}
              <div
                onClick={() => setSelectedGroupId('')}
                className={`p-3.5 sm:p-4 rounded-xl sm:rounded-2xl border cursor-pointer transition-all flex items-center justify-between ${
                  selectedGroupId === ''
                    ? 'bg-brand-50/80 dark:bg-brand-950/50 border-brand-500 ring-2 ring-brand-500/20 shadow-sm'
                    : 'bg-slate-50 dark:bg-slate-900/60 border-slate-200/80 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 transition ${
                      selectedGroupId === ''
                        ? 'border-brand-500 bg-brand-600 text-white'
                        : 'border-slate-300 dark:border-slate-600'
                    }`}
                  >
                    {selectedGroupId === '' && <CheckCircle2 className="w-3.5 h-3.5" />}
                  </div>
                  <div>
                    <span className="font-bold text-xs sm:text-sm text-slate-900 dark:text-slate-100 block">
                      {isArabic ? 'أي موعد مناسب (مرن)' : 'Any Suitable Schedule (Flexible)'}
                    </span>
                    <span className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400">
                      {isArabic
                        ? 'سيقوم فريق الأكاديمية باقتراح أفضل موعد متاح لك'
                        : 'Our team will recommend the optimal group schedule'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Dynamic Group Options */}
              {status?.groups && status.groups.length > 0
                ? status.groups.map((group) => {
                    const isSelected = selectedGroupId === group.id;
                    return (
                      <div
                        key={group.id}
                        onClick={() => !group.isFull && setSelectedGroupId(group.id)}
                        className={`p-3.5 sm:p-4 rounded-xl sm:rounded-2xl border transition-all ${
                          group.isFull
                            ? 'opacity-60 bg-slate-100/60 dark:bg-slate-900/40 border-slate-200 dark:border-slate-800 cursor-not-allowed'
                            : isSelected
                            ? 'bg-brand-50/80 dark:bg-brand-950/50 border-brand-500 ring-2 ring-brand-500/20 shadow-sm cursor-pointer'
                            : 'bg-slate-50 dark:bg-slate-900/60 border-slate-200/80 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 cursor-pointer'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-3">
                            <div
                              className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 mt-0.5 transition ${
                                isSelected
                                  ? 'border-brand-500 bg-brand-600 text-white'
                                  : 'border-slate-300 dark:border-slate-600'
                              }`}
                            >
                              {isSelected && <CheckCircle2 className="w-3.5 h-3.5" />}
                            </div>

                            <div className="space-y-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="font-bold text-xs sm:text-sm text-slate-900 dark:text-slate-100">
                                  {group.name}
                                </span>
                                {group.isFull && (
                                  <Badge variant="danger" size="sm">
                                    {isArabic ? 'مكتملة' : 'Full'}
                                  </Badge>
                                )}
                              </div>

                              <p className="text-[11px] sm:text-xs font-bold text-brand-600 dark:text-brand-400 dir-ltr rtl:text-right">
                                {formatScheduleDisplay(group.schedules, isArabic ? group.scheduleSummaryAr : group.scheduleSummaryEn, isArabic)}
                              </p>

                              {group.description && (
                                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                                  {group.description}
                                </p>
                              )}
                            </div>
                          </div>

                          <div className="text-right rtl:text-left text-[11px] text-slate-400 dark:text-slate-500 shrink-0">
                            <span>
                              {group.enrolledCount} / {group.maxCapacity} {isArabic ? 'طالب' : 'students'}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })
                : null}
            </div>
          </div>

          {/* Section 3: Parent / Guardian Info */}
          <div className="space-y-4 pt-2">
            <div className="flex items-center gap-2 text-xs font-bold text-brand-600 dark:text-brand-400 uppercase tracking-wider pb-2 border-b border-slate-100 dark:border-slate-800/80">
              <Phone className="w-4 h-4" />
              <span>{isArabic ? 'بيانات ولي الأمر (اختياري)' : 'Parent / Guardian Info (Optional)'}</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 sm:gap-4">
              <Input
                label={isArabic ? 'اسم ولي الأمر' : 'Parent Name'}
                placeholder={isArabic ? 'اسم ولي الأمر' : 'Parent name'}
                value={parentName}
                onChange={(e) => setParentName(e.target.value)}
                disabled={submitMutation.isPending}
              />

              <Input
                label={isArabic ? 'رقم هاتف ولي الأمر' : 'Parent Phone'}
                placeholder="010xxxxxxxx"
                type="tel"
                value={parentPhone}
                onChange={(e) => setParentPhone(e.target.value)}
                disabled={submitMutation.isPending}
              />

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  {isArabic ? 'صلة القرابة' : 'Relationship'}
                </label>
                <Select
                  value={parentRelationship}
                  onChange={(e) => setParentRelationship(e.target.value as any)}
                  disabled={submitMutation.isPending}
                  options={[
                    { value: 'FATHER', label: isArabic ? 'الأب' : 'Father' },
                    { value: 'MOTHER', label: isArabic ? 'الأم' : 'Mother' },
                    { value: 'GUARDIAN', label: isArabic ? 'ولي أمر' : 'Guardian' },
                    { value: 'OTHER', label: isArabic ? 'آخر' : 'Other' }
                  ]}
                />
              </div>
            </div>
          </div>

          {/* Submit Button */}
          <Button
            type="submit"
            size="lg"
            className="w-full mt-2"
            isLoading={submitMutation.isPending}
          >
            <Send className="w-4 h-4 mx-1.5" />
            <span>{isArabic ? 'إرسال طلب التسجيل' : 'Submit Registration Application'}</span>
          </Button>

          {/* Link to Login */}
          <div className="mt-6 pt-5 border-t border-slate-100 dark:border-slate-800/80 text-center text-xs text-slate-500 dark:text-slate-400 flex flex-wrap items-center justify-center gap-1.5">
            <span>{t('auth.alreadyRegistered') || (isArabic ? 'لديك حساب بالفعل؟' : 'Already have an account?')}</span>
            <Link
              to="/login"
              className="font-bold text-brand-600 dark:text-brand-400 hover:text-brand-700 dark:hover:text-brand-300 hover:underline inline-flex items-center gap-1 transition"
            >
              <span>{t('auth.loginHere') || (isArabic ? 'تسجيل الدخول' : 'Sign In')}</span>
              {isArabic ? <ArrowLeft className="w-3.5 h-3.5" /> : <ArrowRight className="w-3.5 h-3.5" />}
            </Link>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
