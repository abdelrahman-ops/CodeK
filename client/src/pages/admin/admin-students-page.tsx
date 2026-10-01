import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api/client.js';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Users,
  Plus,
  Search,
  KeyRound,
  CheckCircle2,
  Copy,
  ChevronRight,
  Flame,
  Star,
  Presentation,
  Wallet,
  CreditCard,
  Calendar,
  AlertTriangle,
  Clock,
  Download,
  UserCheck,
  UserX,
  FolderInput,
  Trash2,
  Edit
} from 'lucide-react';
import { Card } from '../../components/ui/card.js';
import { Button } from '../../components/ui/button.js';
import { Input } from '../../components/ui/input.js';
import { Select } from '../../components/ui/select.js';
import { Badge } from '../../components/ui/badge.js';
import { Avatar } from '../../components/ui/avatar.js';
import { Dialog } from '../../components/ui/dialog.js';
import { ConfirmDialog } from '../../components/ui/confirm-dialog.js';
import { useBulkSelection } from '../../hooks/use-bulk-selection.js';
import { BulkSelectionBar } from '../../components/shared/bulk-selection-bar.js';
import { StudentCredentialsModal } from '../../components/students/student-credentials-modal.js';
import { EditStudentModal } from '../../components/students/edit-student-modal.js';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell
} from '../../components/ui/table.js';
import { TableSkeleton } from '../../components/ui/skeleton.js';
import { useToast } from '../../components/ui/toast.js';
import { localizeText, formatStatus, formatStreak } from '../../lib/i18n-helpers.js';
import { StudentProfile } from '../../types/api.js';

export function AdminStudentsPage() {
  const { t, i18n } = useTranslation();
  const isRtl = i18n.language === 'ar';
  const navigate = useNavigate();
  const toast = useToast();
  const queryClient = useQueryClient();

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedGroup, setSelectedGroup] = useState('');
  const [selectedGrade, setSelectedGrade] = useState<string>('');
  const [selectedLearningMode, setSelectedLearningMode] = useState<string>('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<any | null>(null);
  const [createdStudentData, setCreatedStudentData] = useState<any | null>(null);

  // Bulk actions state
  const [isBulkAssignGroupOpen, setIsBulkAssignGroupOpen] = useState(false);
  const [bulkAssignGroupId, setBulkAssignGroupId] = useState('');
  const [isBulkDeleteOpen, setIsBulkDeleteOpen] = useState(false);

  // Manual payment recording modal state
  const [manualPaymentStudent, setManualPaymentStudent] = useState<StudentProfile | null>(null);
  const [manualPaymentNotes, setManualPaymentNotes] = useState('');
  const [manualPaymentAmount, setManualPaymentAmount] = useState<string>('');

  // Form State
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [groupId, setGroupId] = useState('');
  const [programmingLevel, setProgrammingLevel] = useState('BEGINNER');

  const { data: groups } = useQuery({
    queryKey: ['groups'],
    queryFn: async () => (await api.groups.list()).data.data
  });

  const { data: students, isLoading } = useQuery({
    queryKey: ['adminStudents', searchTerm, selectedGroup, selectedGrade],
    queryFn: async () =>
      (
        await api.students.list({
          search: searchTerm || undefined,
          groupId: selectedGroup || undefined,
          grade: selectedGrade || undefined
        })
      ).data.data
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => (await api.students.create(data)).data.data,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['adminStudents'] });
      setIsAddModalOpen(false);
      setFirstName('');
      setLastName('');
      setEmail('');
      setPhone('');
      setGroupId('');
      setProgrammingLevel('BEGINNER');

      if (data) {
        const activeGroup = data.group || groups?.find((g) => g.id === groupId);
        setCreatedStudentData({
          studentId: data.student.id,
          loginId: data.user.loginId,
          studentName: `${data.user.firstName} ${data.user.lastName}`.trim(),
          phone: data.user.phone,
          temporaryPassword: data.temporaryPassword,
          groupName: activeGroup?.name || null,
          groupSchedule: activeGroup?.scheduleInfo || null,
          whatsappGroupUrl: activeGroup?.whatsappGroupUrl || null
        });
      }
      toast.success(t('common.success'));
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error?.message || t('common.error'));
    }
  });

  const manualPaymentMutation = useMutation({
    mutationFn: async ({ studentId, amount, notes }: { studentId: string; amount?: number; notes?: string }) => {
      const res = await api.billing.adminRecordManualPayment({ studentId, amount, notes });
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminStudents'] });
      queryClient.invalidateQueries({ queryKey: ['adminSubscriptions'] });
      queryClient.invalidateQueries({ queryKey: ['adminTransactions'] });
      toast.success(
        isRtl
          ? 'تم تسجيل الدفع بنجاح وتفعيل الاشتراك لمدة 30 يوماً'
          : 'Payment recorded and subscription activated for 30 days'
      );
      setManualPaymentStudent(null);
      setManualPaymentNotes('');
      setManualPaymentAmount('');
    },
    onError: (err: any) => {
      toast.error(
        err.response?.data?.error?.message ||
          (isRtl ? 'فشل تسجيل الدفع' : 'Failed to record manual payment')
      );
    }
  });

  const handleCreateStudent = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate({
      firstName,
      lastName,
      email: email.trim() || undefined,
      phone: phone.trim() || undefined,
      groupId: groupId || undefined,
      programmingLevel
    });
  };

  const handleCloseModal = () => {
    setIsAddModalOpen(false);
    setCreatedStudentData(null);
    setFirstName('');
    setLastName('');
    setEmail('');
    setPhone('');
    setGroupId('');
    setProgrammingLevel('BEGINNER');
  };

  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    return isRtl
      ? d.toLocaleDateString('ar-EG', { year: 'numeric', month: 'short', day: 'numeric' })
      : d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  };

  // Learning-mode semantics:
  // learningModeSelected = false → NOT_SELECTED (لم يحدد المسار)
  // learningModeSelected = true + attendanceRequired = false → ONLINE (أونلاين)
  // learningModeSelected = true + attendanceRequired = true → HYBRID (مدمج)
  const getLearningModeBadge = (student: StudentProfile) => {
    if (!student.learningModeSelected) {
      return (
        <Badge variant="warning" size="sm" className="font-semibold">
          {isRtl ? 'لم يحدد المسار' : 'Not Selected'}
        </Badge>
      );
    }
    if (student.attendanceRequired) {
      return (
        <Badge variant="primary" size="sm" className="font-semibold bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-800">
          {isRtl ? 'مدمج (حضوري + أونلاين)' : 'Hybrid'}
        </Badge>
      );
    }
    return (
      <Badge variant="outline" size="sm" className="font-semibold text-sky-700 border-sky-300 dark:text-sky-300 dark:border-sky-750">
        {isRtl ? 'أونلاين' : 'Online'}
      </Badge>
    );
  };

  // Filter students
  const filteredStudents = students?.filter((student) => {
    if (selectedGrade && student.grade !== selectedGrade) return false;
    if (selectedLearningMode) {
      if (selectedLearningMode === 'NOT_SELECTED' && student.learningModeSelected) return false;
      if (selectedLearningMode === 'HYBRID' && (!student.learningModeSelected || !student.attendanceRequired)) return false;
      if (selectedLearningMode === 'ONLINE' && (!student.learningModeSelected || student.attendanceRequired)) return false;
    }
    return true;
  });

  const selection = useBulkSelection(filteredStudents || []);

  const bulkStatusMutation = useMutation({
    mutationFn: async ({ studentIds, isActive }: { studentIds: string[]; isActive: boolean }) => {
      return (await api.students.bulkStatus(studentIds, isActive)).data.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['adminStudents'] });
      selection.deselectAll();
      toast.success(
        isRtl
          ? `تم تحديث حالة ${data.count} طالب بنجاح`
          : `Successfully updated status for ${data.count} students`
      );
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error?.message || t('common.error'));
    }
  });

  const bulkAssignGroupMutation = useMutation({
    mutationFn: async ({ studentIds, groupId }: { studentIds: string[]; groupId: string | null }) => {
      return (await api.students.bulkAssignGroup(studentIds, groupId)).data.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['adminStudents'] });
      selection.deselectAll();
      setIsBulkAssignGroupOpen(false);
      setBulkAssignGroupId('');
      toast.success(
        isRtl
          ? `تم تعيين ${data.successful.length} طالب إلى المجموعة بنجاح`
          : `Successfully assigned ${data.successful.length} students to group`
      );
      if (data.failed && data.failed.length > 0) {
        toast.info(
          isRtl
            ? `تعذر تعيين ${data.failed.length} طالب`
            : `Failed to assign ${data.failed.length} students`
        );
      }
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error?.message || t('common.error'));
    }
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: async (studentIds: string[]) => {
      return (await api.students.bulkDelete(studentIds)).data.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['adminStudents'] });
      selection.deselectAll();
      setIsBulkDeleteOpen(false);
      toast.success(
        isRtl
          ? `تم حذف ${data.successful.length} طالب بنجاح`
          : `Successfully deleted ${data.successful.length} students`
      );
      if (data.failed && data.failed.length > 0) {
        toast.error(
          isRtl
            ? `تعذر حذف ${data.failed.length} طالب نظراً لوجود سجلات مالية أو اشتراكات أو حضور مرتبط بهم.`
            : `Could not delete ${data.failed.length} students due to existing financial, subscription, or attendance records.`
        );
      }
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error?.message || t('common.error'));
    }
  });

  const handleExportCsv = () => {
    const listToExport = selection.selectedCount > 0
      ? (filteredStudents || []).filter((s) => selection.isSelected(s.id))
      : (filteredStudents || []);

    if (!listToExport.length) return;

    const headers = ['Code', 'First Name', 'Last Name', 'Email', 'Phone', 'Mode', 'Group', 'Subscription', 'XP'];
    const rows = listToExport.map((s) => [
      s.studentCode,
      s.user.firstName,
      s.user.lastName,
      s.user.email || '',
      s.user.phone || '',
      s.learningModeSelected ? (s.attendanceRequired ? 'HYBRID' : 'ONLINE') : 'NOT_SELECTED',
      s.enrollments?.[0]?.group?.name ? localizeText(s.enrollments[0].group.name) : '',
      s.subscriptions?.[0]?.status || 'NONE',
      s.totalXp
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' +
      [headers.join(','), ...rows.map((r) => r.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `students_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2.5">
            <Users className="w-7 h-7 text-brand-600 dark:text-brand-400" />
            <span>{t('nav.students')}</span>
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            {t('students.subtitle')}
          </p>
        </div>

        <Button onClick={() => setIsAddModalOpen(true)}>
          <Plus className="w-4 h-4" />
          <span>{t('students.createStudent')}</span>
        </Button>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1">
          <Input
            placeholder={t('students.searchPlaceholder')}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            leftIcon={<Search className="w-4 h-4" />}
          />
        </div>
        <div className="w-full sm:w-48">
          <Select
            value={selectedGrade}
            onChange={(e: any) => setSelectedGrade(e.target.value)}
            options={[
              { value: '', label: isRtl ? 'جميع الصفوف الدراسية' : 'All Grades' },
              { value: 'GRADE_1', label: isRtl ? 'الصف الأول الثانوي (Grade 10)' : 'Grade 10 (Secondary 1)' },
              { value: 'GRADE_2', label: isRtl ? 'الصف الثاني الثانوي (Grade 11)' : 'Grade 11 (Secondary 2)' },
              { value: 'GRADE_3', label: isRtl ? 'الصف الثالث الثانوي (Grade 12)' : 'Grade 12 (Secondary 3)' }
            ]}
          />
        </div>
        <div className="w-full sm:w-48">
          <Select
            value={selectedGroup}
            onChange={(e: any) => setSelectedGroup(e.target.value)}
            options={[
              { value: '', label: t('students.allGroups') },
              ...(groups?.map((g) => ({ value: g.id, label: localizeText(g.name) })) || [])
            ]}
          />
        </div>
        <div className="w-full sm:w-48">
          <Select
            value={selectedLearningMode}
            onChange={(e: any) => setSelectedLearningMode(e.target.value)}
            options={[
              { value: '', label: isRtl ? 'جميع المسارات التعليمية' : 'All Learning Modes' },
              { value: 'ONLINE', label: isRtl ? 'أونلاين' : 'Online' },
              { value: 'HYBRID', label: isRtl ? 'مدمج (حضوري + أونلاين)' : 'Hybrid' },
              { value: 'NOT_SELECTED', label: isRtl ? 'لم يحدد المسار' : 'Not Selected' }
            ]}
          />
        </div>
      </div>

      {/* Content: Mobile Cards + Desktop Table */}
      {isLoading ? (
        <TableSkeleton rows={6} />
      ) : (
        <>
          {/* Bulk Action Toolbar */}
          <BulkSelectionBar
            totalItems={filteredStudents?.length || 0}
            selectedCount={selection.selectedCount}
            isAllSelected={selection.isAllSelected}
            isIndeterminate={selection.isIndeterminate}
            onToggleSelectAll={selection.toggleSelectAll}
            onDeselectAll={selection.deselectAll}
            onDeleteSelected={() => setIsBulkDeleteOpen(true)}
            isLoading={bulkDeleteMutation.isPending || bulkStatusMutation.isPending || bulkAssignGroupMutation.isPending}
            actions={[
              {
                id: 'activate',
                label: isRtl ? 'تفعيل الحسابات' : 'Activate',
                icon: <UserCheck className="w-3.5 h-3.5" />,
                variant: 'primary',
                onClick: () =>
                  bulkStatusMutation.mutate({
                    studentIds: Array.from(selection.selectedIds),
                    isActive: true
                  })
              },
              {
                id: 'deactivate',
                label: isRtl ? 'تعطيل الحسابات' : 'Deactivate',
                icon: <UserX className="w-3.5 h-3.5" />,
                variant: 'outline',
                onClick: () =>
                  bulkStatusMutation.mutate({
                    studentIds: Array.from(selection.selectedIds),
                    isActive: false
                  })
              },
              {
                id: 'assign-group',
                label: isRtl ? 'تعيين المجموعة' : 'Assign Group',
                icon: <FolderInput className="w-3.5 h-3.5" />,
                variant: 'secondary',
                onClick: () => setIsBulkAssignGroupOpen(true)
              },
              {
                id: 'export-csv',
                label: isRtl ? 'تصدير CSV' : 'Export CSV',
                icon: <Download className="w-3.5 h-3.5" />,
                variant: 'outline',
                onClick: handleExportCsv
              }
            ]}
          />

          {/* Mobile Card List (sm:hidden) */}
          <div className="sm:hidden space-y-3">
            {filteredStudents?.map((student) => {
              const u = student.user;
              const activeGroup = student.enrollments?.[0]?.group?.name ? localizeText(student.enrollments[0].group.name) : t('common.noData');
              const sub = student.subscriptions?.[0];
              const isSubActive = sub?.status === 'ACTIVE' && new Date(sub.currentPeriodEnd) > new Date();
              const isSubExpired = sub && !isSubActive;
              const isHybrid = student.learningModeSelected && student.attendanceRequired;
              const isOnline = student.learningModeSelected && !student.attendanceRequired;
              const isSelected = selection.isSelected(student.id);

              return (
                <Card
                  key={student.id}
                  className={`p-4 space-y-3 transition ${
                    isSelected
                      ? 'border-brand-500 bg-brand-50/20 dark:bg-brand-950/20 shadow-sm'
                      : 'hover:border-brand-500'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => selection.toggle(student.id)}
                        className="w-4 h-4 rounded text-brand-600 focus:ring-brand-500 border-slate-300 dark:border-slate-600 cursor-pointer accent-brand-600"
                      />
                      <Avatar name={`${u.firstName} ${u.lastName}`} src={u.avatarUrl} size="sm" />
                      <div>
                        <div className="font-bold text-sm text-slate-900 dark:text-slate-100">
                          {u.firstName} {u.lastName}
                        </div>
                        <div className="text-xs font-mono text-slate-500 font-bold">
                          {student.studentCode}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 flex-wrap justify-end">
                      {student.grade && (
                        <Badge variant="purple" size="sm">
                          {student.grade === 'GRADE_1'
                            ? (isRtl ? 'الصف 1' : 'Grade 10')
                            : student.grade === 'GRADE_2'
                            ? (isRtl ? 'الصف 2' : 'Grade 11')
                            : (isRtl ? 'الصف 3' : 'Grade 12')}
                        </Badge>
                      )}
                      {getLearningModeBadge(student)}
                    </div>
                  </div>

                  {/* Subscription & Payment Status summary */}
                  <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 space-y-1.5 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">{isRtl ? 'الاشتراك:' : 'Subscription:'}</span>
                      {isSubActive ? (
                        <Badge variant="success" size="sm">{isRtl ? 'نشط' : 'Active'}</Badge>
                      ) : isSubExpired ? (
                        <Badge variant="danger" size="sm">{isRtl ? 'منتهي' : 'Expired'}</Badge>
                      ) : (
                        <Badge variant="secondary" size="sm">{isRtl ? 'غير مفعل' : 'Not Subscribed'}</Badge>
                      )}
                    </div>

                    {sub?.currentPeriodEnd && (
                      <div className="flex items-center justify-between text-slate-600 dark:text-slate-300">
                        <span className="text-slate-500">{isRtl ? 'ينتهي:' : 'Expires:'}</span>
                        <span className="font-medium">{formatDate(sub.currentPeriodEnd)}</span>
                      </div>
                    )}

                    <div className="flex items-center justify-between pt-1 border-t border-slate-200/60 dark:border-slate-700/60">
                      <span className="text-slate-500">{isRtl ? 'الدفع:' : 'Payment:'}</span>
                      {isHybrid ? (
                        isSubActive ? (
                          <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                            {isRtl ? 'تم التسجيل' : 'Recorded'}
                          </span>
                        ) : (
                          <span className="font-semibold text-amber-600 dark:text-amber-400">
                            {isRtl ? 'مطلوب' : 'Due'}
                          </span>
                        )
                      ) : isOnline ? (
                        <span className="font-semibold text-sky-600 dark:text-sky-400">
                          {isSubActive ? 'Paymob' : (isRtl ? 'غير مسدد (Paymob)' : 'Unpaid (Paymob)')}
                        </span>
                      ) : (
                        <span className="text-slate-400">{isRtl ? 'بانتظار تحديد المسار' : 'Pending Onboarding'}</span>
                      )}
                    </div>

                    {/* Hybrid payment button if unpaid or expired */}
                    {isHybrid && (
                      <div className="pt-2">
                        <Button
                          size="sm"
                          className="w-full bg-brand-600 hover:bg-brand-700 text-white text-xs py-1.5 h-auto flex items-center justify-center gap-1.5"
                          onClick={() => setManualPaymentStudent(student)}
                        >
                          <Wallet className="w-3.5 h-3.5" />
                          <span>{isRtl ? 'تسجيل دفع حضوري' : 'Record Payment'}</span>
                        </Button>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800 text-xs font-semibold">
                    <div className="flex items-center gap-3">
                      <span className="flex items-center gap-1 text-amber-600">
                        <Flame className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
                        {formatStreak(student.currentStreak)}
                      </span>
                      <span className="flex items-center gap-1 text-brand-600">
                        <Star className="w-3.5 h-3.5 fill-brand-500 text-brand-500" />
                        {student.totalXp} XP
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setEditingStudent(student)}
                        className="text-xs gap-1"
                      >
                        <Edit className="w-3.5 h-3.5" />
                        <span>{t('common.edit')}</span>
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => navigate(`/admin/students/${student.id}`)}
                      >
                        <span>{t('common.details')}</span>
                        <ChevronRight className="w-4 h-4 rtl:rotate-180" />
                      </Button>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>

          {/* Desktop Table (hidden sm:block) */}
          <div className="hidden sm:block overflow-x-auto rounded-2xl border border-slate-200/80 dark:border-slate-800/80">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10 text-center">
                    <input
                      type="checkbox"
                      checked={selection.isAllSelected}
                      ref={(el) => {
                        if (el) el.indeterminate = selection.isIndeterminate;
                      }}
                      onChange={selection.toggleSelectAll}
                      className="w-4 h-4 rounded text-brand-600 focus:ring-brand-500 border-slate-300 dark:border-slate-600 cursor-pointer accent-brand-600"
                    />
                  </TableHead>
                  <TableHead>{isRtl ? 'الطالب' : 'Student'}</TableHead>
                  <TableHead>{isRtl ? 'الصف والمسار والمجموعة' : 'Grade, Mode & Group'}</TableHead>
                  <TableHead>{isRtl ? 'حالة الاشتراك والدفع' : 'Subscription & Payment'}</TableHead>
                  <TableHead>{t('dashboard.streak')} & XP</TableHead>
                  <TableHead className="text-end">{t('common.actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredStudents?.map((student) => {
                  const u = student.user;
                  const activeGroup = student.enrollments?.[0]?.group?.name ? localizeText(student.enrollments[0].group.name) : t('common.noData');
                  const sub = student.subscriptions?.[0];
                  const isSubActive = sub?.status === 'ACTIVE' && new Date(sub.currentPeriodEnd) > new Date();
                  const isSubExpired = sub && !isSubActive;
                  const isHybrid = student.learningModeSelected && student.attendanceRequired;
                  const isOnline = student.learningModeSelected && !student.attendanceRequired;
                  const isSelected = selection.isSelected(student.id);

                  return (
                    <TableRow key={student.id} className={isSelected ? 'bg-brand-50/30 dark:bg-brand-950/20' : undefined}>
                      <TableCell className="text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => selection.toggle(student.id)}
                          onClick={(e) => e.stopPropagation()}
                          className="w-4 h-4 rounded text-brand-600 focus:ring-brand-500 border-slate-300 dark:border-slate-600 cursor-pointer accent-brand-600"
                        />
                      </TableCell>

                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar name={`${u.firstName} ${u.lastName}`} src={u.avatarUrl} size="sm" />
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-slate-900 dark:text-slate-100">
                                {u.firstName} {u.lastName}
                              </span>
                              <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-[10px] font-mono font-bold text-slate-600 dark:text-slate-400">
                                {student.studentCode}
                              </span>
                            </div>
                            <div className="text-xs text-slate-400">
                              {u.email || u.phone || t('common.noData')}
                            </div>
                          </div>
                        </div>
                      </TableCell>

                      <TableCell>
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {student.grade ? (
                              <Badge variant="purple" size="sm">
                                {student.grade === 'GRADE_1'
                                  ? (isRtl ? 'الصف 1' : 'Grade 10')
                                  : student.grade === 'GRADE_2'
                                  ? (isRtl ? 'الصف 2' : 'Grade 11')
                                  : (isRtl ? 'الصف 3' : 'Grade 12')}
                              </Badge>
                            ) : null}
                            {getLearningModeBadge(student)}
                          </div>
                          <div className="text-xs text-slate-500 flex items-center gap-1">
                            <span className="text-slate-400">{isRtl ? 'المجموعة:' : 'Group:'}</span>
                            <span className="font-medium text-slate-700 dark:text-slate-300">{activeGroup}</span>
                          </div>
                        </div>
                      </TableCell>

                      <TableCell>
                        <div className="space-y-1 py-1">
                          <div className="flex items-center gap-1.5">
                            {isSubActive ? (
                              <Badge variant="success" size="sm">
                                {isRtl ? 'الاشتراك: نشط' : 'Sub: Active'}
                              </Badge>
                            ) : isSubExpired ? (
                              <Badge variant="danger" size="sm">
                                {isRtl ? 'الاشتراك: منتهي' : 'Sub: Expired'}
                              </Badge>
                            ) : (
                              <Badge variant="secondary" size="sm">
                                {isRtl ? 'الاشتراك: غير مفعل' : 'Sub: Inactive'}
                              </Badge>
                            )}
                          </div>

                          {sub?.currentPeriodEnd && (
                            <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1">
                              <Calendar className="w-3 h-3 text-slate-400" />
                              <span>
                                {isRtl ? 'ينتهي:' : 'Ends:'} {formatDate(sub.currentPeriodEnd)}
                              </span>
                            </div>
                          )}

                          <div className="text-xs pt-0.5">
                            {isHybrid ? (
                              isSubActive ? (
                                <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                                  {isRtl ? 'الدفع: تم التسجيل' : 'Payment: Recorded'}
                                </span>
                              ) : (
                                <div className="flex items-center gap-2">
                                  <span className="font-semibold text-amber-600 dark:text-amber-400">
                                    {isRtl ? 'الدفع: مطلوب' : 'Payment: Due'}
                                  </span>
                                  <Button
                                    size="sm"
                                    className="bg-brand-600 hover:bg-brand-700 text-white text-[11px] px-2 py-0.5 h-auto flex items-center gap-1"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setManualPaymentStudent(student);
                                    }}
                                  >
                                    <Wallet className="w-3 h-3" />
                                    <span>{isRtl ? 'تسجيل دفع حضوري' : 'Record Payment'}</span>
                                  </Button>
                                </div>
                              )
                            ) : isOnline ? (
                              <span className="font-semibold text-sky-600 dark:text-sky-400">
                                {isSubActive ? (isRtl ? 'الدفع: Paymob' : 'Payment: Paymob') : (isRtl ? 'الدفع: غير مسدد' : 'Payment: Unpaid')}
                              </span>
                            ) : (
                              <span className="text-slate-400 text-xs">
                                {isRtl ? 'الدفع: بانتظار تحديد المسار' : 'Payment: Pending Onboarding'}
                              </span>
                            )}
                          </div>
                        </div>
                      </TableCell>

                      <TableCell>
                        <div className="flex items-center gap-2 text-xs font-bold">
                          <span className="text-amber-600 dark:text-amber-400 flex items-center gap-1">
                            <Flame className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
                            {formatStreak(student.currentStreak)}
                          </span>
                          <span>•</span>
                          <span className="text-brand-600 dark:text-brand-400 flex items-center gap-1">
                            <Star className="w-3.5 h-3.5 fill-brand-500 text-brand-500" />
                            {student.totalXp} XP
                          </span>
                        </div>
                      </TableCell>

                      <TableCell className="text-end">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setEditingStudent(student)}
                            className="text-xs gap-1"
                          >
                            <Edit className="w-3.5 h-3.5" />
                            <span>{t('common.edit')}</span>
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => navigate(`/admin/students/${student.id}`)}
                          >
                            <span>{t('common.details')}</span>
                            <ChevronRight className="w-4 h-4 rtl:rotate-180" />
                          </Button>
                          {isHybrid && isSubActive && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-xs text-brand-600 border-brand-200 hover:bg-brand-50"
                              onClick={() => setManualPaymentStudent(student)}
                              title={isRtl ? 'تمديد الاشتراك' : 'Extend Subscription'}
                            >
                              <Plus className="w-3 h-3 mr-1" />
                              <span>{isRtl ? 'تجديد' : 'Renew'}</span>
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </>
      )}

      {/* Manual Payment Recording Modal for Hybrid Students */}
      {/* Record Manual Hybrid Payment Modal */}
      {manualPaymentStudent && (
        <Dialog
          isOpen={Boolean(manualPaymentStudent)}
          onClose={() => {
            setManualPaymentStudent(null);
            setManualPaymentNotes('');
            setManualPaymentAmount('');
          }}
          title={isRtl ? 'تسجيل دفع اشتراك حضوري (المسار المدمج)' : 'Record Manual Hybrid Payment'}
          maxWidth="md"
        >
          <div className="space-y-4 py-2">
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-xs text-slate-500">{isRtl ? 'الطالب:' : 'Student:'}</span>
                <span className="font-bold text-sm text-slate-900 dark:text-white">
                  {manualPaymentStudent.user?.firstName || ''} {manualPaymentStudent.user?.lastName || ''} ({manualPaymentStudent.studentCode})
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-slate-500">{isRtl ? 'المسار التعليمي:' : 'Learning Mode:'}</span>
                <Badge variant="primary" size="sm">
                  {isRtl ? 'مدمج (حضوري + أونلاين)' : 'Hybrid'}
                </Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-slate-500">{isRtl ? 'المدة الممنوحة:' : 'Period Duration:'}</span>
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  {isRtl ? '30 يوماً من تاريخ الانتهاء الحالي (أو من اليوم)' : '30 days from current period end'}
                </span>
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                {isRtl ? 'قيمة المبلغ المحصل (ج.م) *' : 'Received Amount (EGP) *'}
              </label>
              <Input
                type="number"
                min="1"
                step="1"
                placeholder={isRtl ? 'أدخل المبلغ المحصل بالجنيه المصري...' : 'Enter amount received in EGP...'}
                value={manualPaymentAmount}
                onChange={(e) => setManualPaymentAmount(e.target.value)}
              />
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                {isRtl
                  ? 'يمكنك إدخال أي مبلغ تحدده الإدارة دون التقيد بأي قيمة افتراضية.'
                  : 'You can enter any custom payment amount as agreed without fixed defaults.'}
              </p>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 block mb-1">
                {isRtl ? 'ملاحظات المعاملة (اختياري):' : 'Transaction Notes (Optional):'}
              </label>
              <textarea
                value={manualPaymentNotes}
                onChange={(e) => setManualPaymentNotes(e.target.value)}
                placeholder={isRtl ? 'مثال: استلام نقدي في مقر الأكاديمية - إيصال رقم 104' : 'e.g., In-person cash payment at reception, receipt #104'}
                rows={3}
                className="w-full text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent p-3 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setManualPaymentStudent(null);
                  setManualPaymentNotes('');
                  setManualPaymentAmount('');
                }}
              >
                {t('common.cancel')}
              </Button>
              <Button
                className="bg-brand-600 text-white hover:bg-brand-700"
                isLoading={manualPaymentMutation.isPending}
                disabled={!manualPaymentAmount || Number(manualPaymentAmount) <= 0}
                onClick={() =>
                  manualPaymentMutation.mutate({
                    studentId: manualPaymentStudent.id,
                    amount: manualPaymentAmount ? Number(manualPaymentAmount) : undefined,
                    notes: manualPaymentNotes || undefined
                  })
                }
              >
                <CheckCircle2 className="w-4 h-4 mr-1.5" />
                <span>{isRtl ? 'تأكيد تسجيل الدفع وتفعيل الاشتراك' : 'Confirm & Activate'}</span>
              </Button>
            </div>
          </div>
        </Dialog>
      )}

      {/* Create Student Modal Form */}
      <Dialog
        isOpen={isAddModalOpen}
        onClose={handleCloseModal}
        title={t('students.createStudent')}
        maxWidth="md"
      >
        <form onSubmit={handleCreateStudent} className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <Input
              label={t('students.firstName')}
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              required
            />
            <Input
              label={t('students.lastName')}
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              required
            />
          </div>

          <Input
            label={t('students.email')}
            type="email"
            placeholder="name@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />

          <Input
            label={t('students.phone')}
            type="tel"
            placeholder="010xxxxxxxx"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />

          <div className="grid grid-cols-2 gap-3">
            <Select
              label={t('students.group')}
              value={groupId}
              onChange={(e: any) => setGroupId(e.target.value)}
              options={[
                { value: '', label: t('students.allGroups') },
                ...(groups?.map((g) => ({ value: g.id, label: localizeText(g.name) })) || [])
              ]}
            />

            <Select
              label={t('students.programmingLevel')}
              value={programmingLevel}
              onChange={(e: any) => setProgrammingLevel(e.target.value)}
              options={[
                { value: 'BEGINNER', label: formatStatus('BEGINNER') },
                { value: 'INTERMEDIATE', label: formatStatus('INTERMEDIATE') },
                { value: 'ADVANCED', label: formatStatus('ADVANCED') }
              ]}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={handleCloseModal}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" isLoading={createMutation.isPending}>
              {t('students.createStudent')}
            </Button>
          </div>
        </form>
      </Dialog>

      {/* Bulk Assign Group Dialog */}
      <Dialog
        isOpen={isBulkAssignGroupOpen}
        onClose={() => setIsBulkAssignGroupOpen(false)}
        title={
          isRtl
            ? `تعيين مجموعة لـ ${selection.selectedCount} طالب محدد`
            : `Assign Group to ${selection.selectedCount} selected students`
        }
      >
        <div className="space-y-4 pt-2">
          <p className="text-sm text-slate-500">
            {isRtl
              ? 'اختر المجموعة المراد نقل أو تسجيل الطلاب المحددين فيها:'
              : 'Select the target group to enroll or move the selected students into:'}
          </p>

          <Select
            label={t('students.group')}
            value={bulkAssignGroupId}
            onChange={(e: any) => setBulkAssignGroupId(e.target.value)}
            options={[
              { value: '', label: isRtl ? '— بدون مجموعة (إلغاء التسجيل) —' : '— No Group (Unassign) —' },
              ...(groups?.map((g) => ({ value: g.id, label: localizeText(g.name) })) || [])
            ]}
          />

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setIsBulkAssignGroupOpen(false)}
              disabled={bulkAssignGroupMutation.isPending}
            >
              {t('common.cancel')}
            </Button>
            <Button
              type="button"
              isLoading={bulkAssignGroupMutation.isPending}
              onClick={() =>
                bulkAssignGroupMutation.mutate({
                  studentIds: Array.from(selection.selectedIds),
                  groupId: bulkAssignGroupId || null
                })
              }
            >
              {isRtl ? 'تطبيق التعيين' : 'Apply Assignment'}
            </Button>
          </div>
        </div>
      </Dialog>

      {/* Bulk Delete Confirm Dialog */}
      <ConfirmDialog
        isOpen={isBulkDeleteOpen}
        onClose={() => setIsBulkDeleteOpen(false)}
        onConfirm={() => bulkDeleteMutation.mutate(Array.from(selection.selectedIds))}
        title={
          isRtl
            ? `حذف ${selection.selectedCount} طالب؟`
            : `Delete ${selection.selectedCount} students?`
        }
        description={
          isRtl
            ? `هل أنت متأكد من حذف ${selection.selectedCount} طالب محدد؟ الطلاب الذين يملكون سجلات دفع أو اشتراكات أو حضور نشطة ستتم حمايتهم ولن يتم حذفهم حفاظاً على تكامل البيانات.`
            : `Are you sure you want to delete ${selection.selectedCount} selected students? Students with payments, subscriptions, or attendance records are strictly protected and will not be deleted to ensure data integrity.`
        }
        isLoading={bulkDeleteMutation.isPending}
        isDestructive={true}
      />

      {/* Rich Student Credentials & WhatsApp Sharing Modal */}
      <StudentCredentialsModal
        isOpen={Boolean(createdStudentData)}
        onClose={() => setCreatedStudentData(null)}
        data={createdStudentData}
      />

      {/* Edit Student Modal */}
      <EditStudentModal
        isOpen={Boolean(editingStudent)}
        onClose={() => setEditingStudent(null)}
        student={editingStudent}
        groups={groups}
      />
    </div>
  );
}
