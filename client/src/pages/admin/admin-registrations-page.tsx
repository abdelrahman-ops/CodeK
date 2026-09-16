import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api/client.js';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import {
  FileText,
  Search,
  Filter,
  CheckCircle2,
  XCircle,
  Clock,
  Archive,
  UserCheck,
  Calendar,
  Settings,
  ArrowRight,
  ExternalLink,
  Phone,
  BookOpen
} from 'lucide-react';
import { Card, CardTitle, CardContent } from '../../components/ui/card.js';
import { Button } from '../../components/ui/button.js';
import { Input } from '../../components/ui/input.js';
import { Select } from '../../components/ui/select.js';
import { Badge } from '../../components/ui/badge.js';
import { Dialog } from '../../components/ui/dialog.js';
import { StatCard } from '../../components/ui/stat-card.js';
import { TableSkeleton } from '../../components/ui/skeleton.js';
import { useToast } from '../../components/ui/toast.js';
import { StudentRegistration, RegistrationStatus, PublicRegistrationStatus, ListAdminRegistrationsResponse } from '../../types/api.js';
import { formatStatus, formatDate, localizeText } from '../../lib/i18n-helpers.js';
import { useBulkSelection } from '../../hooks/use-bulk-selection.js';
import { BulkSelectionBar } from '../../components/shared/bulk-selection-bar.js';

export function AdminRegistrationsPage() {
  const { t, i18n } = useTranslation();
  const isArabic = i18n.language === 'ar';
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const toast = useToast();

  const [search, setSearch] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('');
  const [page, setPage] = useState(1);

  // Bulk actions state
  const [isBulkApproveOpen, setIsBulkApproveOpen] = useState(false);
  const [bulkApproveGroupId, setBulkApproveGroupId] = useState('');
  const [isBulkRejectOpen, setIsBulkRejectOpen] = useState(false);
  const [bulkRejectReason, setBulkRejectReason] = useState('');

  // Settings Edit Modal state
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isOpenSetting, setIsOpenSetting] = useState(true);
  const [startDateSetting, setStartDateSetting] = useState('');
  const [endDateSetting, setEndDateSetting] = useState('');
  const [maxRegistrationsSetting, setMaxRegistrationsSetting] = useState<number | ''>('');

  // Fetch Registration List & Counts
  const { data: listData, isLoading } = useQuery<ListAdminRegistrationsResponse>({
    queryKey: ['adminRegistrations', search, selectedStatus, page],
    queryFn: async () =>
      (
        await api.registrations.listAdmin({
          search: search || undefined,
          status: selectedStatus ? (selectedStatus as RegistrationStatus) : undefined,
          page,
          limit: 15
        })
      ).data
  });

  // Settings Mutation
  const updateSettingsMutation = useMutation({
    mutationFn: async () => {
      return (
        await api.registrations.updateAdminSettings({
          isOpen: isOpenSetting,
          startDate: startDateSetting || null,
          endDate: endDateSetting || null,
          maxRegistrations: maxRegistrationsSetting !== '' ? Number(maxRegistrationsSetting) : null
        })
      ).data.data;
    },
    onSuccess: () => {
      toast.success(isArabic ? 'تم تحديث إعدادات التسجيل بنجاح' : 'Registration settings updated');
      queryClient.invalidateQueries({ queryKey: ['adminRegistrations'] });
      setIsSettingsOpen(false);
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error?.message || t('common.error'));
    }
  });

  const registrations = listData?.data || [];
  const counts = listData?.counts || {
    ALL: 0,
    PENDING: 0,
    UNDER_REVIEW: 0,
    APPROVED: 0,
    REJECTED: 0,
    WAITLISTED: 0,
    EXPIRED: 0,
    ARCHIVED: 0
  };
  const settingsData = listData?.settings;
  const meta = listData?.meta;

  const { data: groups } = useQuery({
    queryKey: ['groups'],
    queryFn: async () => (await api.groups.list()).data.data
  });

  const selection = useBulkSelection(registrations);

  // Bulk Approve Mutation
  const bulkApproveMutation = useMutation({
    mutationFn: async ({ registrationIds, groupId }: { registrationIds: string[]; groupId: string | null }) => {
      return (await api.registrations.bulkApprove({ registrationIds, groupId })).data.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['adminRegistrations'] });
      selection.deselectAll();
      setIsBulkApproveOpen(false);
      setBulkApproveGroupId('');
      toast.success(
        isArabic
          ? `تم قبول وتأهيل ${data.successful.length} طلب تسجيل بنجاح`
          : `Successfully approved ${data.successful.length} registrations`
      );
      if (data.failed && data.failed.length > 0) {
        toast.info(
          isArabic
            ? `تعذر قبول ${data.failed.length} طلب`
            : `Failed to approve ${data.failed.length} applications`
        );
      }
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error?.message || t('common.error'));
    }
  });

  // Bulk Reject Mutation
  const bulkRejectMutation = useMutation({
    mutationFn: async ({ registrationIds, reason }: { registrationIds: string[]; reason: string }) => {
      return (
        await api.registrations.bulkStatus({
          registrationIds,
          status: 'REJECTED',
          rejectionReason: reason
        })
      ).data.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['adminRegistrations'] });
      selection.deselectAll();
      setIsBulkRejectOpen(false);
      setBulkRejectReason('');
      toast.success(
        isArabic
          ? `تم رفض ${data.count} طلب تسجيل بنجاح`
          : `Successfully rejected ${data.count} registrations`
      );
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error?.message || t('common.error'));
    }
  });

  // Bulk Archive Mutation
  const bulkArchiveMutation = useMutation({
    mutationFn: async (registrationIds: string[]) => {
      return (
        await api.registrations.bulkStatus({
          registrationIds,
          status: 'ARCHIVED'
        })
      ).data.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['adminRegistrations'] });
      selection.deselectAll();
      toast.success(
        isArabic
          ? `تمت أرشفة ${data.count} طلب بنجاح`
          : `Successfully archived ${data.count} registrations`
      );
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error?.message || t('common.error'));
    }
  });

  const handleOpenSettings = () => {
    if (settingsData) {
      setIsOpenSetting(settingsData.isOpen);
      setStartDateSetting(settingsData.startDate ? settingsData.startDate.split('T')[0] : '');
      setEndDateSetting(settingsData.endDate ? settingsData.endDate.split('T')[0] : '');
      setMaxRegistrationsSetting(settingsData.maxRegistrations ?? '');
    }
    setIsSettingsOpen(true);
  };

  const getStatusBadgeVariant = (status: RegistrationStatus) => {
    switch (status) {
      case 'APPROVED':
        return 'success';
      case 'PENDING':
      case 'UNDER_REVIEW':
        return 'warning';
      case 'REJECTED':
        return 'danger';
      default:
        return 'outline';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-slate-100">
            {isArabic ? 'طلبات التسجيل والتأهيل' : 'Student Registrations'}
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            {isArabic
              ? 'مراجعة طلبات الالتحاق المقدمة عبر الرابط العام وتأهيل حسابات الطلاب الجدد'
              : 'Review prospective student applications and onboard new student accounts'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => window.open('/register', '_blank')}>
            <ExternalLink className="w-4 h-4" />
            <span>{isArabic ? 'فتح نموذج التسجيل العام' : 'Public Register Form'}</span>
          </Button>
          <Button onClick={handleOpenSettings}>
            <Settings className="w-4 h-4" />
            <span>{isArabic ? 'إعدادات فتح التسجيل' : 'Registration Controls'}</span>
          </Button>
        </div>
      </div>

      {/* Top Registration Control Pillar */}
      <Card className="p-5 border-brand-200/60 dark:border-brand-900/40 bg-gradient-to-r from-brand-50/40 via-white to-purple-50/30 dark:from-slate-900 dark:to-brand-950/20">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div
              className={`w-4 h-4 rounded-full animate-pulse ${
                settingsData?.isOpen ? 'bg-emerald-500 shadow-lg shadow-emerald-500/50' : 'bg-rose-500'
              }`}
            />
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base text-slate-900 dark:text-slate-100">
                  {isArabic ? 'حالة باب التسجيل العام:' : 'Public Registration Status:'}
                </h3>
                <Badge variant={settingsData?.isOpen ? 'success' : 'danger'}>
                  {settingsData?.isOpen
                    ? isArabic
                      ? 'مفتوح للجميع'
                      : 'OPEN'
                    : isArabic
                    ? 'مغلق حالياً'
                    : 'CLOSED'}
                </Badge>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                {settingsData?.maxRegistrations
                  ? `${isArabic ? 'الحد الأقصى للتسجيل:' : 'Max limit:'} ${settingsData.maxRegistrations} ${
                      isArabic ? 'طلب' : 'registrations'
                    }`
                  : isArabic
                  ? 'لا يوجد حد أقصى لعدد طلبات التسجيل'
                  : 'Unlimited registration capacity'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4 text-xs">
            <div className="p-3 rounded-xl bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 text-center">
              <span className="text-slate-400 block font-medium">{isArabic ? 'إجمالي الطلبات' : 'Total'}</span>
              <span className="font-black text-sm text-slate-900 dark:text-slate-100">{counts.ALL}</span>
            </div>
            <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 text-center">
              <span className="text-amber-600 dark:text-amber-400 block font-medium">
                {isArabic ? 'قيد المراجعة' : 'Pending'}
              </span>
              <span className="font-black text-sm text-amber-700 dark:text-amber-300">
                {counts.PENDING + counts.UNDER_REVIEW}
              </span>
            </div>
            <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 text-center">
              <span className="text-emerald-600 dark:text-emerald-400 block font-medium">
                {isArabic ? 'مقبول' : 'Approved'}
              </span>
              <span className="font-black text-sm text-emerald-700 dark:text-emerald-300">{counts.APPROVED}</span>
            </div>
          </div>
        </div>
      </Card>

      {/* Filter Tabs & Search */}
      <Card className="p-4 space-y-4">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          {/* Status Tabs */}
          <div className="flex flex-wrap gap-1.5 w-full sm:w-auto">
            {[
              { id: '', labelAr: 'الكل', labelEn: 'All', count: counts.ALL },
              { id: 'PENDING', labelAr: 'جديد', labelEn: 'Pending', count: counts.PENDING },
              { id: 'UNDER_REVIEW', labelAr: 'قيد المراجعة', labelEn: 'Reviewing', count: counts.UNDER_REVIEW },
              { id: 'APPROVED', labelAr: 'مقبول', labelEn: 'Approved', count: counts.APPROVED },
              { id: 'WAITLISTED', labelAr: 'قائمة الانتظار', labelEn: 'Waitlist', count: counts.WAITLISTED },
              { id: 'REJECTED', labelAr: 'مرفوض', labelEn: 'Rejected', count: counts.REJECTED },
              { id: 'ARCHIVED', labelAr: 'أرشيف', labelEn: 'Archived', count: counts.ARCHIVED }
            ].map((tab) => {
              const isSelected = selectedStatus === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => {
                    setSelectedStatus(tab.id);
                    setPage(1);
                  }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                    isSelected
                      ? 'bg-brand-600 text-white shadow-md shadow-brand-600/20'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
                  }`}
                >
                  <span>{isArabic ? tab.labelAr : tab.labelEn}</span>
                  <span
                    className={`px-1.5 py-0.5 rounded-md text-[10px] ${
                      isSelected
                        ? 'bg-white/20 text-white'
                        : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    {tab.count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Search Input */}
          <div className="w-full sm:w-64">
            <Input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder={isArabic ? 'بحث بالاسم، الكود، الهاتف...' : 'Search name, code, phone...'}
            />
          </div>
        </div>

        {/* Bulk Action Toolbar */}
        <BulkSelectionBar
          totalItems={registrations.length}
          selectedCount={selection.selectedCount}
          isAllSelected={selection.isAllSelected}
          isIndeterminate={selection.isIndeterminate}
          onToggleSelectAll={selection.toggleSelectAll}
          onDeselectAll={selection.deselectAll}
          isLoading={bulkApproveMutation.isPending || bulkRejectMutation.isPending || bulkArchiveMutation.isPending}
          actions={[
            {
              id: 'approve',
              label: isArabic ? 'قبول وتأهيل المحدد' : 'Approve Selected',
              icon: <UserCheck className="w-3.5 h-3.5" />,
              variant: 'primary',
              onClick: () => setIsBulkApproveOpen(true)
            },
            {
              id: 'reject',
              label: isArabic ? 'رفض المحدد' : 'Reject Selected',
              icon: <XCircle className="w-3.5 h-3.5" />,
              variant: 'danger',
              onClick: () => setIsBulkRejectOpen(true)
            },
            {
              id: 'archive',
              label: isArabic ? 'أرشفة المحدد' : 'Archive Selected',
              icon: <Archive className="w-3.5 h-3.5" />,
              variant: 'secondary',
              onClick: () => bulkArchiveMutation.mutate(Array.from(selection.selectedIds))
            }
          ]}
        />

        {/* Table */}
        {isLoading ? (
          <TableSkeleton />
        ) : registrations.length === 0 ? (
          <div className="text-center py-12 text-xs text-slate-400">
            {isArabic ? 'لا توجد طلبات تسجيل مطابقة للبحث' : 'No student registrations found.'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left rtl:text-right">
              <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-500 font-bold uppercase tracking-wider border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="w-12 px-4 py-3 text-center">
                    <input
                      type="checkbox"
                      checked={selection.isAllSelected}
                      ref={(el) => {
                        if (el) el.indeterminate = selection.isIndeterminate;
                      }}
                      onChange={selection.toggleSelectAll}
                      className="w-4 h-4 rounded text-brand-600 focus:ring-brand-500 border-slate-300 dark:border-slate-600 cursor-pointer accent-brand-600"
                    />
                  </th>
                  <th className="px-4 py-3">{isArabic ? 'كود مرجع التسجيل' : 'Registration Code'}</th>
                  <th className="px-4 py-3">{isArabic ? 'اسم الطالب' : 'Student Name'}</th>
                  <th className="px-4 py-3">{isArabic ? 'رقم الهاتف' : 'Phone'}</th>
                  <th className="px-4 py-3">{isArabic ? 'المدرسة / الصف' : 'School & Grade'}</th>
                  <th className="px-4 py-3">{isArabic ? 'الخبرة البرمجية' : 'Experience'}</th>
                  <th className="px-4 py-3">{isArabic ? 'تاريخ تقديم الطلب' : 'Submitted At'}</th>
                  <th className="px-4 py-3">{isArabic ? 'الحالة' : 'Status'}</th>
                  <th className="px-4 py-3 text-right rtl:text-left">{isArabic ? 'الإجراءات' : 'Actions'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                {registrations.map((reg) => {
                  const isSelected = selection.isSelected(reg.id);
                  return (
                    <tr
                      key={reg.id}
                      className={`transition-colors ${
                        isSelected
                          ? 'bg-brand-50/40 dark:bg-brand-950/20'
                          : 'hover:bg-slate-50/80 dark:hover:bg-slate-800/40'
                      }`}
                    >
                      <td className="w-12 px-4 py-3 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => selection.toggle(reg.id)}
                          onClick={(e) => e.stopPropagation()}
                          className="w-4 h-4 rounded text-brand-600 focus:ring-brand-500 border-slate-300 dark:border-slate-600 cursor-pointer accent-brand-600"
                        />
                      </td>
                      <td className="px-4 py-3 font-mono font-black text-brand-600 dark:text-brand-400">
                        {reg.registrationCode}
                      </td>
                    <td className="px-4 py-3 font-bold text-slate-900 dark:text-slate-100">
                      {reg.firstName} {reg.lastName}
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-400 dir-ltr text-right rtl:text-left">
                      {reg.phone}
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
                      {reg.schoolName || '—'} {reg.grade ? `(${reg.grade})` : ''}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant="outline" size="sm">
                        {formatStatus(reg.programmingLevel)}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-slate-500">
                      {formatDate(reg.createdAt, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={getStatusBadgeVariant(reg.status)} size="sm">
                        {formatStatus(reg.status)}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-right rtl:text-left">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => navigate(`/admin/registrations/${reg.id}`)}
                      >
                        <span>{isArabic ? 'عرض واستعراض' : 'View Details'}</span>
                        <ArrowRight className="w-3.5 h-3.5 rtl:rotate-180" />
                      </Button>
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Settings Modal */}
      {isSettingsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 max-w-md w-full space-y-4 shadow-2xl">
            <h3 className="font-black text-lg text-slate-900 dark:text-slate-100">
              {isArabic ? 'إعدادات وتسهيلات باب التسجيل' : 'Registration Control Settings'}
            </h3>

            <div className="space-y-4 text-xs">
              <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700">
                <span className="font-bold text-slate-800 dark:text-slate-200">
                  {isArabic ? 'فتح باب التسجيل العام' : 'Public Registration Open'}
                </span>
                <input
                  type="checkbox"
                  checked={isOpenSetting}
                  onChange={(e) => setIsOpenSetting(e.target.checked)}
                  className="w-5 h-5 accent-brand-600 rounded cursor-pointer"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 mb-1 block">
                  {isArabic ? 'تاريخ بداية فتح التسجيل (اختياري)' : 'Start Date (Optional)'}
                </label>
                <Input
                  type="date"
                  value={startDateSetting}
                  onChange={(e) => setStartDateSetting(e.target.value)}
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 mb-1 block">
                  {isArabic ? 'تاريخ نهاية وارتفاع التسجيل (اختياري)' : 'End Date (Optional)'}
                </label>
                <Input
                  type="date"
                  value={endDateSetting}
                  onChange={(e) => setEndDateSetting(e.target.value)}
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 mb-1 block">
                  {isArabic ? 'الحد الأقصى لعدد الطلبات (اختياري)' : 'Maximum Capacity Limit (Optional)'}
                </label>
                <Input
                  type="number"
                  placeholder="e.g. 100"
                  value={maxRegistrationsSetting}
                  onChange={(e) =>
                    setMaxRegistrationsSetting(e.target.value !== '' ? parseInt(e.target.value) : '')
                  }
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <Button variant="ghost" onClick={() => setIsSettingsOpen(false)}>
                {t('common.cancel')}
              </Button>
              <Button
                onClick={() => updateSettingsMutation.mutate()}
                disabled={updateSettingsMutation.isPending}
              >
                {t('common.save')}
              </Button>
            </div>
          </div>
        </div>
      )}
      {/* Bulk Approve Dialog */}
      <Dialog
        isOpen={isBulkApproveOpen}
        onClose={() => setIsBulkApproveOpen(false)}
        title={
          isArabic
            ? `قبول وتأهيل ${selection.selectedCount} طلب تسجيل`
            : `Approve and Onboard ${selection.selectedCount} Registrations`
        }
      >
        <div className="space-y-4 pt-2">
          <p className="text-sm text-slate-500">
            {isArabic
              ? 'سيتم إنشاء حسابات مستخدمين وبطاقات طلاب وتوليد بيانات الدخول تلقائياً للطلبات المحددة. يمكنك اختياريًا إلحاقهم بمجموعة محددة:'
              : 'User accounts, student profiles, and login credentials will be generated automatically. You can optionally assign them to a group now:'}
          </p>

          <Select
            label={isArabic ? 'المجموعة المستهدفة (اختياري)' : 'Target Group (Optional)'}
            value={bulkApproveGroupId}
            onChange={(e: any) => setBulkApproveGroupId(e.target.value)}
            options={[
              { value: '', label: isArabic ? '— بدون تعيين مجموعة حالياً —' : '— No Group Assignment Now —' },
              ...(groups?.map((g) => ({ value: g.id, label: localizeText(g.name) })) || [])
            ]}
          />

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setIsBulkApproveOpen(false)}
              disabled={bulkApproveMutation.isPending}
            >
              {t('common.cancel')}
            </Button>
            <Button
              type="button"
              isLoading={bulkApproveMutation.isPending}
              onClick={() =>
                bulkApproveMutation.mutate({
                  registrationIds: Array.from(selection.selectedIds),
                  groupId: bulkApproveGroupId || null
                })
              }
            >
              {isArabic ? 'تأكيد وقبول الطلبات' : 'Confirm & Approve'}
            </Button>
          </div>
        </div>
      </Dialog>

      {/* Bulk Reject Dialog */}
      <Dialog
        isOpen={isBulkRejectOpen}
        onClose={() => setIsBulkRejectOpen(false)}
        title={
          isArabic
            ? `رفض ${selection.selectedCount} طلب تسجيل`
            : `Reject ${selection.selectedCount} Registrations`
        }
      >
        <div className="space-y-4 pt-2">
          <p className="text-sm text-slate-500">
            {isArabic
              ? 'يرجى كتابة سبب الرفض لتسجيله في سجل الطلبات:'
              : 'Please provide a reason for the rejection to record in the audit log:'}
          </p>

          <Input
            placeholder={isArabic ? 'سبب الرفض (مثلاً: عدم اكتمال البيانات / السن غير مطابق)' : 'Reason (e.g. Incomplete info)'}
            value={bulkRejectReason}
            onChange={(e) => setBulkRejectReason(e.target.value)}
          />

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setIsBulkRejectOpen(false)}
              disabled={bulkRejectMutation.isPending}
            >
              {t('common.cancel')}
            </Button>
            <Button
              type="button"
              variant="danger"
              isLoading={bulkRejectMutation.isPending}
              disabled={!bulkRejectReason.trim()}
              onClick={() =>
                bulkRejectMutation.mutate({
                  registrationIds: Array.from(selection.selectedIds),
                  reason: bulkRejectReason.trim()
                })
              }
            >
              {isArabic ? 'تأكيد الرفض' : 'Confirm Rejection'}
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
