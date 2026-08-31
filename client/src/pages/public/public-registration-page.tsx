import React, { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
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
  BookOpen,
  Calendar,
  ShieldCheck,
  Send,
  Languages
} from 'lucide-react';
import { Card, CardTitle, CardContent } from '../../components/ui/card.js';
import { Button } from '../../components/ui/button.js';
import { Input } from '../../components/ui/input.js';
import { Select } from '../../components/ui/select.js';
import { Badge } from '../../components/ui/badge.js';
import { Logo } from '../../components/ui/logo.js';
import { setAppLanguage } from '../../i18n/index.js';
import { useToast } from '../../components/ui/toast.js';
import { PublicRegistrationStatus, StudentRegistration } from '../../types/api.js';

export function PublicRegistrationPage() {
  const { t, i18n } = useTranslation();
  const isArabic = i18n.language === 'ar';
  const toast = useToast();

  const [formLoadedAt] = useState<number>(() => Date.now());
  const [submittedRegistration, setSubmittedRegistration] = useState<StudentRegistration | null>(null);

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
        firstName,
        lastName,
        phone,
        whatsappPhone: whatsappPhone || phone,
        email: email || null,
        dateOfBirth: dateOfBirth || null,
        schoolName: schoolName || null,
        grade: grade || null,
        preferredGroupId: selectedGroupId || null,
        preferredDays: preferredDays.length > 0 ? preferredDays.join(', ') : null,
        preferredTimes: preferredTimes || null,
        parentName: parentName || null,
        parentPhone: parentPhone || null,
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

  const toggleLanguage = () => {
    const nextLang = isArabic ? 'en' : 'ar';
    setAppLanguage(nextLang);
  };

  return (
    <div className="h-full overflow-y-auto bg-slate-950 text-slate-100 flex flex-col justify-between py-6 px-4 sm:px-6">
      <div className="max-w-2xl w-full mx-auto space-y-6 pb-12">
        {/* Header Navigation */}
        <header className="flex items-center justify-between py-3 border-b border-slate-800/80">
          <div className="flex items-center gap-3">
            <Logo size="lg" forceShowTextOnMobile />
            <div className="hidden sm:block border-s border-slate-800 ps-3">
              <p className="text-xs font-semibold text-slate-400">
                {isArabic ? 'منصة تسجيل الطلاب الجدد' : 'New Student Admission Portal'}
              </p>
            </div>
          </div>

          <button
            onClick={toggleLanguage}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-slate-200 hover:bg-slate-800 border border-slate-700/80 transition shadow-sm"
          >
            <Languages className="w-4 h-4 text-brand-400" />
            <span>{isArabic ? 'English' : 'العربية'}</span>
          </button>
        </header>

        {/* Loading Skeleton */}
        {statusLoading && (
          <Card className="p-8 text-center bg-slate-800/80 border-slate-700 space-y-4">
            <Clock className="w-8 h-8 text-brand-500 animate-spin mx-auto" />
            <p className="text-sm text-slate-400">{t('common.loading')}</p>
          </Card>
        )}

        {/* Registration Closed Card */}
        {!statusLoading && status && !status.isOpen && !submittedRegistration && (
          <Card className="p-8 text-center bg-slate-800/80 border-amber-500/30 space-y-4 rounded-3xl">
            <div className="w-16 h-16 rounded-full bg-amber-500/10 text-amber-400 flex items-center justify-center mx-auto">
              <AlertCircle className="w-8 h-8" />
            </div>
            <h2 className="text-xl font-black text-white">
              {isArabic ? 'التسجيل مغلق حالياً' : 'Registration Currently Closed'}
            </h2>
            <p className="text-sm text-slate-400 max-w-md mx-auto">
              {status.closedReason ||
                (isArabic
                  ? 'عفواً، باب التسجيل مغلق حالياً. نرجو المتابعة لاحقاً للالتحاق بالدفعة القادمة.'
                  : 'Registration is currently closed. Please check back later for the next cohort.')}
            </p>
          </Card>
        )}

        {/* Submission Success Card */}
        {submittedRegistration && (
          <Card className="p-8 text-center bg-slate-800/90 border-emerald-500/40 space-y-6 rounded-3xl shadow-2xl">
            <div className="w-20 h-20 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto animate-bounce">
              <CheckCircle2 className="w-10 h-10" />
            </div>
            
            <div className="space-y-2">
              <h2 className="text-2xl font-black text-white">
                {isArabic ? 'تم استلام طلب التسجيل بنجاح! 🎉' : 'Registration Submitted Successfully! 🎉'}
              </h2>
              <p className="text-xs text-slate-300">
                {isArabic
                  ? 'تم تسجيل بياناتك بنجاح في قاعدة بيانات الأكاديمية وطلبك قيد المراجعة.'
                  : 'Your application has been received and is currently under review by our administration team.'}
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-700/80 space-y-2 max-w-md mx-auto">
              <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">
                {isArabic ? 'رقم مرجع التسجيل الخاص بك' : 'Your Application Reference Code'}
              </span>
              <div className="text-3xl font-black text-brand-400 font-mono tracking-widest">
                {submittedRegistration.registrationCode}
              </div>
              <p className="text-[11px] text-slate-400 pt-1">
                {isArabic
                  ? 'احتفظ بهذا الرقم لمتابعة طلبك. سيتم التواصل معك عبر الواتساب فور مراجعة الطلب.'
                  : 'Keep this reference code saved. We will contact you via WhatsApp once your application is reviewed.'}
              </p>
            </div>

            <Button
              variant="outline"
              onClick={() => {
                setSubmittedRegistration(null);
                setFirstName('');
                setLastName('');
                setPhone('');
              }}
            >
              {isArabic ? 'تقديم طلب جديد' : 'Submit Another Registration'}
            </Button>
          </Card>
        )}

        {/* Public Registration Form */}
        {!statusLoading && status && status.isOpen && !submittedRegistration && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              submitMutation.mutate();
            }}
            className="space-y-6"
          >
            {/* Banner Intro */}
            <div className="p-6 rounded-3xl bg-gradient-to-r from-brand-900/40 via-purple-900/20 to-slate-900 border border-brand-500/30 space-y-2">
              <div className="flex items-center gap-2 text-brand-400 font-bold text-xs uppercase tracking-wider">
                <Sparkles className="w-4 h-4" />
                <span>{isArabic ? 'استمارة الالتحاق بالأكاديمية' : 'Academy Admissions Form'}</span>
              </div>
              <h2 className="text-xl sm:text-2xl font-black text-white">
                {isArabic ? 'سجل الآن للانضمام إلى CodeK' : 'Apply Now to Join CodeK Academy'}
              </h2>
              <p className="text-xs text-slate-300">
                {isArabic
                  ? 'قم بتعبئة بياناتك بعناية وسيتم التواصل معك لتحديد موعد الحصة الأولى وتفعيل حسابك.'
                  : 'Fill in your details carefully. Our admin team will review your application and contact you via WhatsApp.'}
              </p>
            </div>

            {/* Hidden Honeypot Field */}
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
            <Card className="p-6 space-y-4 bg-slate-800/80 border-slate-700 rounded-3xl">
              <div className="flex items-center gap-2 text-white font-bold border-b border-slate-700/80 pb-3">
                <User className="w-4 h-4 text-brand-400" />
                <span>{isArabic ? 'بيانات الطالب الشخصية' : 'Student Personal Details'}</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-300 mb-1 block">
                    {isArabic ? 'الاسم الأول *' : 'First Name *'}
                  </label>
                  <Input
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder={isArabic ? 'مثال: أحمد' : 'e.g. Ahmed'}
                    required
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-300 mb-1 block">
                    {isArabic ? 'اسم العائلة *' : 'Last Name *'}
                  </label>
                  <Input
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder={isArabic ? 'مثال: محمد' : 'e.g. Mohamed'}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-300 mb-1 block">
                    {isArabic ? 'رقم الهاتف (واتساب) *' : 'Phone Number (WhatsApp) *'}
                  </label>
                  <Input
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="010xxxxxxxx"
                    required
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-300 mb-1 block">
                    {isArabic ? 'رقم الواتساب الإضافي (اختياري)' : 'Secondary WhatsApp (Optional)'}
                  </label>
                  <Input
                    value={whatsappPhone}
                    onChange={(e) => setWhatsappPhone(e.target.value)}
                    placeholder="011xxxxxxxx"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-300 mb-1 block">
                    {isArabic ? 'البريد الإلكتروني (اختياري)' : 'Email Address (Optional)'}
                  </label>
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="student@example.com"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-300 mb-1 block">
                    {isArabic ? 'تاريخ الميلاد (اختياري)' : 'Date of Birth (Optional)'}
                  </label>
                  <Input
                    type="date"
                    value={dateOfBirth}
                    onChange={(e) => setDateOfBirth(e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-300 mb-1 block">
                    {isArabic ? 'اسم المدرسة (اختياري)' : 'School Name (Optional)'}
                  </label>
                  <Input
                    value={schoolName}
                    onChange={(e) => setSchoolName(e.target.value)}
                    placeholder={isArabic ? 'اسم المدرسة' : 'School name'}
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-300 mb-1 block">
                    {isArabic ? 'الصف الدراسي / السنة (اختياري)' : 'Grade / Year (Optional)'}
                  </label>
                  <Input
                    value={grade}
                    onChange={(e) => setGrade(e.target.value)}
                    placeholder={isArabic ? 'مثال: الصف الأول الثانوي' : 'e.g. Grade 10'}
                  />
                </div>
              </div>
            </Card>

            {/* Section 2: Group & Schedule Preferences */}
            <Card className="p-6 space-y-4 bg-slate-800/80 border-slate-700 rounded-3xl">
              <div className="flex items-center gap-2 text-white font-bold border-b border-slate-700/80 pb-3">
                <Calendar className="w-4 h-4 text-emerald-400" />
                <span>{isArabic ? 'المجموعات والمواعيد المتاحة' : 'Available Class Groups & Schedules'}</span>
              </div>

              <p className="text-xs text-slate-400">
                {isArabic
                  ? 'اختر المجموعة والمواعيد المناسبة لك للحضور، أو حدد الخيار المرن لتواصل الإدارة معك.'
                  : 'Select the active group schedule that best suits your availability, or choose flexible timing.'}
              </p>

              {/* Active Groups List */}
              <div className="space-y-3">
                {/* Flexible / Any Group Option */}
                <div
                  onClick={() => setSelectedGroupId('')}
                  className={`p-4 rounded-2xl border cursor-pointer transition-all flex items-center justify-between ${
                    selectedGroupId === ''
                      ? 'bg-brand-950/80 border-brand-500 shadow-lg ring-1 ring-brand-500'
                      : 'bg-slate-900/60 border-slate-700 hover:border-slate-600'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-5 h-5 rounded-full border flex items-center justify-center ${
                        selectedGroupId === '' ? 'border-brand-500 bg-brand-600 text-white' : 'border-slate-600'
                      }`}
                    >
                      {selectedGroupId === '' && <CheckCircle2 className="w-3.5 h-3.5" />}
                    </div>
                    <div>
                      <span className="font-bold text-sm text-white block">
                        {isArabic ? 'أي موعد مناسب (مرن)' : 'Any Suitable Schedule (Flexible)'}
                      </span>
                      <span className="text-xs text-slate-400">
                        {isArabic
                          ? 'سيقوم فريق الأكاديمية باقتراح أفضل مجموعة متاحة فور مراجعة طلبك'
                          : 'Our team will recommend the optimal group schedule after review'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Actual Groups from Backend */}
                {statusLoading ? (
                  <div className="p-4 text-center text-slate-400 text-xs animate-pulse">
                    {isArabic ? 'جاري تحميل المجموعات المتاحة...' : 'Loading available class groups...'}
                  </div>
                ) : status?.groups && status.groups.length > 0 ? (
                  status.groups.map((group) => {
                    const isSelected = selectedGroupId === group.id;
                    return (
                      <div
                        key={group.id}
                        onClick={() => !group.isFull && setSelectedGroupId(group.id)}
                        className={`p-4 rounded-2xl border transition-all ${
                          group.isFull
                            ? 'opacity-60 bg-slate-900/40 border-slate-800 cursor-not-allowed'
                            : isSelected
                            ? 'bg-brand-950/80 border-brand-500 shadow-lg ring-1 ring-brand-500 cursor-pointer'
                            : 'bg-slate-900/60 border-slate-700 hover:border-slate-600 cursor-pointer'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-3">
                            <div
                              className={`w-5 h-5 rounded-full border flex items-center justify-center mt-0.5 ${
                                isSelected ? 'border-brand-500 bg-brand-600 text-white' : 'border-slate-600'
                              }`}
                            >
                              {isSelected && <CheckCircle2 className="w-3.5 h-3.5" />}
                            </div>

                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-sm text-white">{group.name}</span>
                                {group.isFull && (
                                  <Badge variant="danger" size="sm">
                                    {isArabic ? 'مكتملة العدد' : 'Full'}
                                  </Badge>
                                )}
                              </div>

                              <p className="text-xs font-bold text-brand-400 dir-ltr rtl:text-right">
                                {isArabic ? group.scheduleSummaryAr : group.scheduleSummaryEn}
                              </p>

                              {group.description && (
                                <p className="text-xs text-slate-400">{group.description}</p>
                              )}
                            </div>
                          </div>

                          <div className="text-right rtl:text-left text-[11px] text-slate-400 shrink-0">
                            <span>
                              {group.enrolledCount} / {group.maxCapacity} {isArabic ? 'طالب' : 'students'}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })
                ) : null}
              </div>
            </Card>

            {/* Section 4: Parent / Guardian Info */}
            <Card className="p-6 space-y-4 bg-slate-800/80 border-slate-700 rounded-3xl">
              <div className="flex items-center gap-2 text-white font-bold border-b border-slate-700/80 pb-3">
                <Phone className="w-4 h-4 text-amber-400" />
                <span>{isArabic ? 'بيانات ولي الأمر (اختياري)' : 'Parent / Guardian Contact (Optional)'}</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-300 mb-1 block">
                    {isArabic ? 'اسم ولي الأمر' : 'Parent Name'}
                  </label>
                  <Input
                    value={parentName}
                    onChange={(e) => setParentName(e.target.value)}
                    placeholder={isArabic ? 'اسم ولي الأمر' : 'Parent name'}
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-300 mb-1 block">
                    {isArabic ? 'رقم هاتف ولي الأمر' : 'Parent Phone'}
                  </label>
                  <Input
                    value={parentPhone}
                    onChange={(e) => setParentPhone(e.target.value)}
                    placeholder="010xxxxxxxx"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-300 mb-1 block">
                    {isArabic ? 'صلة القرابة' : 'Relationship'}
                  </label>
                  <Select
                    value={parentRelationship}
                    onChange={(e) => setParentRelationship(e.target.value as any)}
                    options={[
                      { value: 'FATHER', label: isArabic ? 'الأب' : 'Father' },
                      { value: 'MOTHER', label: isArabic ? 'الأم' : 'Mother' },
                      { value: 'GUARDIAN', label: isArabic ? 'ولي أمر' : 'Guardian' },
                      { value: 'OTHER', label: isArabic ? 'آخر' : 'Other' }
                    ]}
                  />
                </div>
              </div>
            </Card>

            {/* Submit Button */}
            <div className="pt-2">
              <Button
                type="submit"
                size="lg"
                disabled={submitMutation.isPending}
                className="w-full h-12 text-base font-black bg-gradient-to-r from-brand-600 to-purple-600 hover:from-brand-500 hover:to-purple-500 shadow-xl shadow-brand-600/30 rounded-2xl"
              >
                {submitMutation.isPending ? (
                  <span>{t('common.loading')}</span>
                ) : (
                  <span className="flex items-center gap-2">
                    <Send className="w-5 h-5" />
                    <span>{isArabic ? 'إرسال طلب التسجيل' : 'Submit Registration Application'}</span>
                  </span>
                )}
              </Button>
            </div>
          </form>
        )}
      </div>

      {/* Public Footer */}
      <footer className="max-w-2xl w-full mx-auto text-center text-xs text-slate-500 pt-8 border-t border-slate-800/80">
        © {new Date().getFullYear()} CodeK Academy. {isArabic ? 'جميع الحقوق محفوظة.' : 'All rights reserved.'}
      </footer>
    </div>
  );
}
