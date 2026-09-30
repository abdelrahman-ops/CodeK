import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api/client.js';
import { useTranslation } from 'react-i18next';
import { useParams, useNavigate } from 'react-router-dom';
import {
  UserCheck,
  XCircle,
  Clock,
  Archive,
  ArrowLeft,
  Phone,
  MessageSquare,
  Copy,
  Check,
  ExternalLink,
  BookOpen,
  Calendar,
  User,
  ShieldCheck,
  Sparkles,
  Users,
  Trash2,
  AlertTriangle
} from 'lucide-react';
import { Card, CardTitle, CardContent } from '../../components/ui/card.js';
import { Button } from '../../components/ui/button.js';
import { Input } from '../../components/ui/input.js';
import { Select } from '../../components/ui/select.js';
import { Badge } from '../../components/ui/badge.js';
import { CardSkeleton } from '../../components/ui/skeleton.js';
import { useToast } from '../../components/ui/toast.js';
import {
  StudentRegistration,
  RegistrationStatus,
  ApproveRegistrationResponse,
  Group
} from '../../types/api.js';
import { formatStatus, formatDate, localizeText } from '../../lib/i18n-helpers.js';

export function AdminRegistrationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { t, i18n } = useTranslation();
  const isArabic = i18n.language === 'ar';
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const toast = useToast();

  const [adminNotes, setAdminNotes] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');

  // Modals state
  const [isApproveModalOpen, setIsApproveModalOpen] = useState(false);
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedGroupId, setSelectedGroupId] = useState<string>('');

  // Credentials Generated Success Modal
  const [approvalResult, setApprovalResult] = useState<ApproveRegistrationResponse | null>(null);
  const [copiedLoginId, setCopiedLoginId] = useState(false);
  const [copiedPassword, setCopiedPassword] = useState(false);

  // Fetch Registration
  const { data: registration, isLoading } = useQuery<StudentRegistration>({
    queryKey: ['adminRegistrationDetail', id],
    queryFn: async () => (await api.registrations.getAdminById(id!)).data.data,
    enabled: Boolean(id)
  });

  // Fetch Groups for optional assignment
  const { data: groupsData } = useQuery({
    queryKey: ['adminGroups'],
    queryFn: async () => (await api.groups.list()).data.data
  });
  const groups: Group[] = groupsData || [];

  // Update Status / Notes Mutation
  const updateMutation = useMutation({
    mutationFn: async (data: { status?: RegistrationStatus; adminNotes?: string; rejectionReason?: string }) => {
      return (await api.registrations.updateAdmin(id!, data)).data.data;
    },
    onSuccess: () => {
      toast.success(isArabic ? 'تم تحديث حالة الطلب بنجاح' : 'Registration status updated');
      queryClient.invalidateQueries({ queryKey: ['adminRegistrationDetail', id] });
      queryClient.invalidateQueries({ queryKey: ['adminRegistrations'] });
      setIsRejectModalOpen(false);
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error?.message || t('common.error'));
    }
  });

  // Delete Registration Mutation
  const deleteMutation = useMutation({
    mutationFn: async () => {
      return (await api.registrations.deleteAdmin(id!)).data;
    },
    onSuccess: () => {
      toast.success(isArabic ? 'تم حذف طلب التسجيل بنجاح' : 'Registration deleted successfully');
      queryClient.invalidateQueries({ queryKey: ['adminRegistrations'] });
      navigate('/admin/registrations');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error?.message || t('common.error'));
    }
  });

  // Approve & Create Student Mutation
  const approveMutation = useMutation({
    mutationFn: async () => {
      return (
        await api.registrations.approve(id!, {
          groupId: selectedGroupId || null,
          adminNotes: adminNotes || registration?.adminNotes || null
        })
      ).data.data;
    },
    onSuccess: (data) => {
      setApprovalResult(data);
      setIsApproveModalOpen(false);
      toast.success(isArabic ? 'تم قبول الطالب وإصدار الحساب بنجاح! 🎉' : 'Student account created & approved');
      queryClient.invalidateQueries({ queryKey: ['adminRegistrationDetail', id] });
      queryClient.invalidateQueries({ queryKey: ['adminRegistrations'] });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error?.message || t('common.error'));
    }
  });

  if (isLoading || !registration) return <CardSkeleton />;

  const isApproved = registration.status === 'APPROVED';

  const copyToClipboard = (text: string, type: 'login' | 'pass') => {
    navigator.clipboard.writeText(text);
    if (type === 'login') {
      setCopiedLoginId(true);
      setTimeout(() => setCopiedLoginId(false), 2000);
    } else {
      setCopiedPassword(true);
      setTimeout(() => setCopiedPassword(false), 2000);
    }
    toast.success(t('common.copied'));
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate('/admin/registrations')}>
            <ArrowLeft className="w-4 h-4 rtl:rotate-180" />
            <span>{t('common.back')}</span>
          </Button>

          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                {registration.firstName} {registration.lastName}
              </h1>
              <Badge variant={registration.status === 'APPROVED' ? 'success' : 'warning'}>
                {formatStatus(registration.status)}
              </Badge>
            </div>
            <p className="text-xs text-slate-500 font-mono mt-0.5">
              {isArabic ? 'كود مرجع التسجيل:' : 'Reference:'} {registration.registrationCode}
            </p>
          </div>
        </div>

        {/* Action Controls Header */}
        <div className="flex flex-wrap items-center gap-2">
          {!isApproved && (
            <>
              <Button variant="outline" onClick={() => setIsRejectModalOpen(true)}>
                <XCircle className="w-4 h-4 text-rose-500" />
                <span>{isArabic ? 'رفض الطلب' : 'Reject'}</span>
              </Button>
              <Button
                variant="outline"
                onClick={() => updateMutation.mutate({ status: 'WAITLISTED' })}
              >
                <Clock className="w-4 h-4 text-amber-500" />
                <span>{isArabic ? 'إضافة لقائمة الانتظار' : 'Waitlist'}</span>
              </Button>
              <Button onClick={() => {
                if (registration.preferredGroupId) {
                  setSelectedGroupId(registration.preferredGroupId);
                }
                setIsApproveModalOpen(true);
              }}>
                <UserCheck className="w-4 h-4" />
                <span>{isArabic ? 'قبول وتفعيل حساب الطالب' : 'Approve & Create Account'}</span>
              </Button>
            </>
          )}
          <Button
            variant="outline"
            className="text-rose-600 border-rose-200 hover:bg-rose-50 dark:border-rose-900/50 dark:hover:bg-rose-950/20"
            onClick={() => setIsDeleteModalOpen(true)}
          >
            <Trash2 className="w-4 h-4" />
            <span>{isArabic ? 'حذف الطلب نهائياً' : 'Delete Registration'}</span>
          </Button>
        </div>
      </div>

      {/* Main Grid Details */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Details */}
        <div className="lg:col-span-2 space-y-6">
          {/* Student Info Card */}
          <Card className="p-6 space-y-4">
            <CardTitle className="text-base flex items-center gap-2">
              <User className="w-4 h-4 text-brand-600" />
              <span>{isArabic ? 'بيانات الطالب المتقدم' : 'Student Profile'}</span>
            </CardTitle>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-xs">
              <div>
                <span className="text-slate-400 font-bold block">{isArabic ? 'الاسم بالكامل' : 'Full Name'}</span>
                <span className="font-semibold text-slate-900 dark:text-slate-100 text-sm">
                  {registration.firstName} {registration.lastName}
                </span>
              </div>

              <div>
                <span className="text-slate-400 font-bold block">{isArabic ? 'رقم الهاتف' : 'Phone'}</span>
                <span className="font-mono text-slate-800 dark:text-slate-200 dir-ltr text-right rtl:text-left">
                  {registration.phone}
                </span>
              </div>

              <div>
                <span className="text-slate-400 font-bold block">{isArabic ? 'واتساب' : 'WhatsApp'}</span>
                <span className="font-mono text-slate-800 dark:text-slate-200 dir-ltr text-right rtl:text-left">
                  {registration.whatsappPhone || registration.phone}
                </span>
              </div>

              <div>
                <span className="text-slate-400 font-bold block">{isArabic ? 'البريد الإلكتروني' : 'Email'}</span>
                <span className="text-slate-800 dark:text-slate-200">{registration.email || '—'}</span>
              </div>

              <div>
                <span className="text-slate-400 font-bold block">{isArabic ? 'المدرسة' : 'School'}</span>
                <span className="text-slate-800 dark:text-slate-200">{registration.schoolName || '—'}</span>
              </div>

              <div>
                <span className="text-slate-400 font-bold block">{isArabic ? 'الصف الدراسي' : 'Grade'}</span>
                <span className="text-slate-800 dark:text-slate-200">{registration.grade || '—'}</span>
              </div>
            </div>
          </Card>

          {/* Academic & Preferences Card */}
          <Card className="p-6 space-y-4">
            <CardTitle className="text-base flex items-center gap-2">
              <Calendar className="w-4 h-4 text-emerald-600" />
              <span>{isArabic ? 'المجموعة والمواعيد المفضلة' : 'Preferred Class & Schedule'}</span>
            </CardTitle>

            <div className="space-y-4 text-xs">
              {registration.preferredGroup ? (
                <div className="p-4 rounded-2xl bg-brand-50/50 dark:bg-brand-950/30 border border-brand-200 dark:border-brand-900 space-y-1">
                  <span className="text-slate-400 font-bold block">{isArabic ? 'المجموعة المختارة:' : 'Selected Group:'}</span>
                  <div className="font-semibold text-sm text-brand-600 dark:text-brand-400">
                    {registration.preferredGroup.name}
                  </div>
                  {registration.preferredGroup.scheduleInfo && (
                    <p className="text-xs text-slate-600 dark:text-slate-300">
                      {localizeText(registration.preferredGroup.scheduleInfo)}
                    </p>
                  )}
                </div>
              ) : (
                <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/80 font-bold text-slate-600 dark:text-slate-300">
                  {isArabic ? 'أي موعد مناسب (مرن)' : 'Flexible Schedule'}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <span className="text-slate-400 font-bold block mb-1">
                    {isArabic ? 'تفاصيل الأيام المفضلة:' : 'Preferred Days:'}
                  </span>
                  <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 font-bold text-brand-600 dark:text-brand-400">
                    {registration.preferredDays || (isArabic ? 'أي يوم مناسب' : 'Any day')}
                  </div>
                </div>

                <div>
                  <span className="text-slate-400 font-bold block mb-1">
                    {isArabic ? 'الأوقات المفضلة:' : 'Preferred Times:'}
                  </span>
                  <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 font-bold text-brand-600 dark:text-brand-400">
                    {registration.preferredTimes || (isArabic ? 'أي وقت مناسب' : 'Any time')}
                  </div>
                </div>
              </div>
            </div>
          </Card>

          {/* Parent Information Card */}
          <Card className="p-6 space-y-4">
            <CardTitle className="text-base flex items-center gap-2">
              <Phone className="w-4 h-4 text-amber-600" />
              <span>{isArabic ? 'بيانات ولي الأمر' : 'Parent / Guardian Contact'}</span>
            </CardTitle>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
              <div>
                <span className="text-slate-400 font-bold block">{isArabic ? 'اسم ولي الأمر' : 'Parent Name'}</span>
                <span className="font-bold text-slate-900 dark:text-slate-100">
                  {registration.parentName || '—'}
                </span>
              </div>

              <div>
                <span className="text-slate-400 font-bold block">{isArabic ? 'رقم هاتف ولي الأمر' : 'Phone'}</span>
                <span className="font-mono text-slate-800 dark:text-slate-200 dir-ltr text-right rtl:text-left">
                  {registration.parentPhone || '—'}
                </span>
              </div>

              <div>
                <span className="text-slate-400 font-bold block">{isArabic ? 'صلة القرابة' : 'Relationship'}</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">
                  {registration.parentRelationship ? formatStatus(registration.parentRelationship) : '—'}
                </span>
              </div>
            </div>
          </Card>
        </div>

        {/* Right Column: Admin Notes & Status Details */}
        <div className="space-y-6">
          {/* Application Metadata Card */}
          <Card className="p-6 space-y-4">
            <CardTitle className="text-base">{isArabic ? 'بيانات الطلب والتدقيق' : 'Application Metadata'}</CardTitle>

            <div className="space-y-3 text-xs">
              <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                <span className="text-slate-400">{isArabic ? 'رقم المرجع' : 'Ref Code'}</span>
                <span className="font-mono font-bold text-brand-600 dark:text-brand-400">
                  {registration.registrationCode}
                </span>
              </div>

              <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                <span className="text-slate-400">{isArabic ? 'تاريخ التقديم' : 'Submitted At'}</span>
                <span>{formatDate(registration.createdAt)}</span>
              </div>

              {registration.reviewedAt && (
                <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                  <span className="text-slate-400">{isArabic ? 'تاريخ التقييم' : 'Reviewed At'}</span>
                  <span>{formatDate(registration.reviewedAt)}</span>
                </div>
              )}

              {registration.reviewedByUser && (
                <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                  <span className="text-slate-400">{isArabic ? 'تم التقييم بواسطة' : 'Reviewed By'}</span>
                  <span className="font-bold">{registration.reviewedByUser.firstName}</span>
                </div>
              )}

              {registration.createdStudent && (
                <div className="p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 space-y-1">
                  <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-bold block">
                    {isArabic ? 'تم إنشاء حساب الطالب مرتبط:' : 'Linked Student Account:'}
                  </span>
                  <div className="flex items-center justify-between font-mono font-semibold text-emerald-700 dark:text-emerald-300">
                    <span>{registration.createdStudent.user.loginId}</span>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => navigate(`/admin/students/${registration.createdStudentId}`)}
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </Card>

          {/* Internal Admin Notes */}
          <Card className="p-6 space-y-4">
            <CardTitle className="text-base">{isArabic ? 'ملاحظات الإدارة الداخلية' : 'Internal Admin Notes'}</CardTitle>

            <textarea
              rows={4}
              value={adminNotes || registration.adminNotes || ''}
              onChange={(e) => setAdminNotes(e.target.value)}
              placeholder={isArabic ? 'اكتب ملاحظات خاصة بالإدارة حول الطالب...' : 'Write internal admin notes...'}
              className="w-full p-3 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs focus:ring-2 focus:ring-brand-500 outline-none"
            />

            <Button
              size="sm"
              variant="outline"
              className="w-full"
              onClick={() => updateMutation.mutate({ adminNotes })}
              disabled={updateMutation.isPending}
            >
              {isArabic ? 'حفظ الملاحظات' : 'Save Admin Notes'}
            </Button>
          </Card>
        </div>
      </div>

      {/* Approve & Create Account Modal */}
      {isApproveModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 max-w-md w-full space-y-4 shadow-2xl">
            <div className="flex items-center gap-3 text-emerald-600 dark:text-emerald-400">
              <UserCheck className="w-6 h-6" />
              <h3 className="font-semibold text-lg text-slate-900 dark:text-slate-100">
                {isArabic ? 'قبول وتأهيل حساب الطالب' : 'Approve Student Application'}
              </h3>
            </div>

            <p className="text-xs text-slate-500">
              {isArabic
                ? 'سيتم قبول هذا الطلب فوراً وإنشاء حساب طالب رسمي، وتوليد كلمة مرور مؤقتة ورابط الواتساب للتفعيل.'
                : 'This action will officially create a Student User account, generate credentials, and provide a WhatsApp activation link.'}
            </p>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 mb-1 block">
                  {isArabic ? 'تعيين لمجموعة دراسية (اختياري)' : 'Assign to Class Group (Optional)'}
                </label>
                <Select
                  value={selectedGroupId}
                  onChange={(e) => setSelectedGroupId(e.target.value)}
                  options={[
                    { value: '', label: isArabic ? '-- بدون مجموعة حالياً --' : '-- No Group Assignment --' },
                    ...groups.map((g) => ({ value: g.id, label: g.name }))
                  ]}
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <Button variant="ghost" onClick={() => setIsApproveModalOpen(false)}>
                {t('common.cancel')}
              </Button>
              <Button onClick={() => approveMutation.mutate()} disabled={approveMutation.isPending}>
                {approveMutation.isPending
                  ? t('common.loading')
                  : isArabic
                  ? 'تأكيد القبول وإنشاء الحساب'
                  : 'Confirm Approval & Create Account'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {isRejectModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 max-w-md w-full space-y-4 shadow-2xl">
            <h3 className="font-semibold text-lg text-rose-600 dark:text-rose-400">
              {isArabic ? 'رفض طلب التسجيل' : 'Reject Registration'}
            </h3>

            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-1 block">
                {isArabic ? 'سبب الرفض (اختياري)' : 'Rejection Reason (Optional)'}
              </label>
              <textarea
                rows={3}
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder={isArabic ? 'سبب رفض الطلب...' : 'Reason for rejection...'}
                className="w-full p-3 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs outline-none"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <Button variant="ghost" onClick={() => setIsRejectModalOpen(false)}>
                {t('common.cancel')}
              </Button>
              <Button
                variant="danger"
                onClick={() =>
                  updateMutation.mutate({ status: 'REJECTED', rejectionReason })
                }
                disabled={updateMutation.isPending}
              >
                {isArabic ? 'تأكيد الرفض' : 'Confirm Rejection'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Account Generated Credentials & WhatsApp Onboarding Modal */}
      {approvalResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-slate-900 border border-emerald-500/30 rounded-3xl p-6 max-w-lg w-full space-y-6 shadow-2xl">
            <div className="flex items-center gap-3 text-emerald-600 dark:text-emerald-400">
              <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 flex items-center justify-center font-bold">
                <Sparkles className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-semibold text-lg text-slate-900 dark:text-slate-100">
                  {isArabic ? 'تم قبول الطالب وإصدار الحساب! 🎉' : 'Account Created Successfully! 🎉'}
                </h3>
                <p className="text-xs text-slate-500">
                  {isArabic ? 'بيانات دخول الطالب الجديدة جاهزة للتسليم' : 'New student login credentials are ready'}
                </p>
              </div>
            </div>

            {/* Credentials Card */}
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[11px] text-slate-400 font-bold block">{isArabic ? 'اسم المستخدم (Login ID)' : 'Login ID'}</span>
                  <span className="font-mono font-semibold text-sm text-brand-600 dark:text-brand-400">
                    {approvalResult.credentials.loginId}
                  </span>
                </div>
                <Button size="sm" variant="ghost" onClick={() => copyToClipboard(approvalResult.credentials.loginId, 'login')}>
                  {copiedLoginId ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                </Button>
              </div>

              <div className="flex items-center justify-between border-t border-slate-200/60 dark:border-slate-700/60 pt-3">
                <div>
                  <span className="text-[11px] text-slate-400 font-bold block">{isArabic ? 'كلمة المرور المؤقتة' : 'Temporary Password'}</span>
                  <span className="font-mono font-semibold text-sm text-emerald-600 dark:text-emerald-400">
                    {approvalResult.credentials.temporaryPassword}
                  </span>
                </div>
                <Button size="sm" variant="ghost" onClick={() => copyToClipboard(approvalResult.credentials.temporaryPassword, 'pass')}>
                  {copiedPassword ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                </Button>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="space-y-3">
              <Button
                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold h-11 rounded-2xl shadow-lg shadow-emerald-600/20"
                onClick={() => window.open(approvalResult.whatsappOnboarding.whatsappUrl, '_blank')}
              >
                <MessageSquare className="w-5 h-5 mr-2" />
                <span>{isArabic ? 'إرسال بيانات الدخول عبر الواتساب 🚀' : 'Send Credentials via WhatsApp 🚀'}</span>
              </Button>

              <Button
                variant="outline"
                className="w-full"
                onClick={() => setApprovalResult(null)}
              >
                {t('common.close')}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 max-w-md w-full space-y-4 shadow-2xl">
            <h3 className="font-semibold text-lg text-rose-600 dark:text-rose-400 flex items-center gap-2">
              <Trash2 className="w-5 h-5" />
              <span>{isArabic ? 'حذف طلب التسجيل نهائياً' : 'Delete Registration'}</span>
            </h3>

            <div className="flex items-start gap-3 p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/60 text-rose-800 dark:text-rose-200 text-xs">
              <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
              <div className="leading-relaxed">
                {isArabic ? (
                  <>
                    هل أنت متأكد من حذف طلب تسجيل الطالب{' '}
                    <span className="font-bold underline">{registration?.firstName} {registration?.lastName}</span> نهائياً؟
                    سيتم إزالة هذا الطلب وبياناته من سجلات النظام بالكامل.
                  </>
                ) : (
                  <>
                    Are you sure you want to permanently delete registration for{' '}
                    <span className="font-bold underline">{registration?.firstName} {registration?.lastName}</span>?
                    This action cannot be undone.
                  </>
                )}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <Button
                variant="ghost"
                onClick={() => setIsDeleteModalOpen(false)}
                disabled={deleteMutation.isPending}
              >
                {t('common.cancel')}
              </Button>
              <Button
                variant="danger"
                isLoading={deleteMutation.isPending}
                onClick={() => deleteMutation.mutate()}
              >
                <Trash2 className="w-4 h-4 mr-1.5" />
                <span>{isArabic ? 'تأكيد الحذف نهائياً' : 'Delete Permanently'}</span>
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
