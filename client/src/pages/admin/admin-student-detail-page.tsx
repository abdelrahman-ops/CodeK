import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api/client.js';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  ChevronLeft,
  Flame,
  Star,
  Trophy,
  CalendarCheck2,
  CheckSquare,
  CreditCard,
  Phone,
  School,
  Award,
  Trash2
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/card.js';
import { Avatar } from '../../components/ui/avatar.js';
import { Badge } from '../../components/ui/badge.js';
import { Progress } from '../../components/ui/progress.js';
import { Button } from '../../components/ui/button.js';
import { Dialog } from '../../components/ui/dialog.js';
import { Input } from '../../components/ui/input.js';
import { ConfirmDialog } from '../../components/ui/confirm-dialog.js';
import { StudentCredentialsModal, StudentCredentialsData } from '../../components/students/student-credentials-modal.js';
import { CardSkeleton } from '../../components/ui/skeleton.js';
import { useToast } from '../../components/ui/toast.js';
import { KeyRound, ShieldAlert } from 'lucide-react';
import { localizeText, formatStatus, formatStreak, formatCurrency, formatDate } from '../../lib/i18n-helpers.js';

export function AdminStudentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const toast = useToast();
  const queryClient = useQueryClient();

  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isResetDialogOpen, setIsResetDialogOpen] = useState(false);
  const [resetMode, setResetMode] = useState<'AUTO' | 'CUSTOM'>('AUTO');
  const [customPassword, setCustomPassword] = useState('');
  const [mustChangePassword, setMustChangePassword] = useState(true);
  const [credentialsData, setCredentialsData] = useState<StudentCredentialsData | null>(null);

  const { data: student, isLoading } = useQuery({
    queryKey: ['adminStudentDetail', id],
    queryFn: async () => {
      if (!id) throw new Error('No id');
      return (await api.students.getById(id)).data.data;
    },
    enabled: Boolean(id)
  });

  const { data: progress } = useQuery({
    queryKey: ['adminStudentProgress', id],
    queryFn: async () => {
      if (!id) return null;
      return (await api.students.getProgress(id)).data.data;
    },
    enabled: Boolean(id)
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!id) return;
      return (await api.students.delete(id)).data.data;
    },
    onSuccess: () => {
      toast.success(t('common.success'));
      queryClient.invalidateQueries({ queryKey: ['adminStudents'] });
      navigate('/admin/students');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error?.message || t('common.error'));
    }
  });

  const resetPasswordMutation = useMutation({
    mutationFn: async (payload?: { customPassword?: string; mustChangePassword?: boolean }) => {
      if (!id) return;
      return (await api.students.resetPassword(id, payload)).data.data;
    },
    onSuccess: (data) => {
      setIsResetDialogOpen(false);
      setCustomPassword('');
      setResetMode('AUTO');
      if (data) {
        setCredentialsData(data);
        toast.success(t('students.passwordResetSuccess') || 'Password updated successfully');
      }
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error?.message || t('common.error'));
    }
  });

  if (isLoading) return <CardSkeleton />;

  if (!student) return <div className="p-8 text-center text-slate-500">{t('common.noData')}</div>;

  const u = student.user;
  const metrics = progress?.metrics || { programming: 0, problemSolving: 0, curriculum: 0, projects: 0, attendance: 0 };
  const enrollments = student.enrollments || [];
  const attendances = student.attendances || [];
  const submissions = student.submissions || [];
  const payments = student.payments || [];
  const achievements = student.achievements || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate('/admin/students')}
          className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
        >
          <ChevronLeft className="w-4 h-4 rtl:rotate-180" />
          <span>{t('students.title')}</span>
        </button>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsResetDialogOpen(true)}
            className="text-amber-600 border-amber-200 hover:bg-amber-50 dark:border-amber-800 dark:hover:bg-amber-950/40"
          >
            <KeyRound className="w-4 h-4" />
            <span>{t('students.resetPassword') || 'Reset Password'}</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsDeleteDialogOpen(true)}
            className="text-rose-600 border-rose-200 hover:bg-rose-50 dark:border-rose-800 dark:hover:bg-rose-950/40"
          >
            <Trash2 className="w-4 h-4" />
            <span>{t('students.deleteStudent')}</span>
          </Button>
        </div>
      </div>

      {/* Header Profile Card */}
      <Card className="p-6 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white rounded-3xl shadow-xl">
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
          <Avatar name={`${u.firstName} ${u.lastName}`} src={u.avatarUrl} size="lg" />

          <div className="flex-1 text-center sm:text-start space-y-2">
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
              <h1 className="text-2xl font-black">{u.firstName} {u.lastName}</h1>
              <Badge variant="primary" size="sm">{student.studentCode}</Badge>
              <Badge variant="secondary" size="sm">{formatStatus(student.programmingLevel)}</Badge>
            </div>

            <p className="text-xs text-slate-400 font-mono">{u.loginId} • {u.phone || t('common.noPhone')}</p>

            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-4 pt-2 text-xs font-bold">
              <span className="flex items-center gap-1 text-amber-400">
                <Star className="w-4 h-4 fill-current" />
                {student.totalXp} XP
              </span>
              <span className="flex items-center gap-1 text-orange-400">
                <Flame className="w-4 h-4 fill-current" />
                {formatStreak(student.currentStreak)}
              </span>
              {student.schoolName && (
                <span className="flex items-center gap-1 text-slate-300">
                  <School className="w-4 h-4" />
                  {student.schoolName}
                </span>
              )}
            </div>
          </div>
        </div>
      </Card>

      {/* Progress Dimensions Matrix */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card className="p-4 space-y-2 border-slate-200/80 dark:border-slate-800/80">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-500 font-bold">{t('students.programmingLevel')}</span>
            <span className="font-black text-brand-600 dark:text-brand-400">{metrics.programming}%</span>
          </div>
          <Progress value={metrics.programming} />
        </Card>

        <Card className="p-4 space-y-2 border-slate-200/80 dark:border-slate-800/80">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-500 font-bold">{t('tasks.taskTypeChallenge')}</span>
            <span className="font-black text-purple-600 dark:text-purple-400">{metrics.problemSolving}%</span>
          </div>
          <Progress value={metrics.problemSolving} />
        </Card>

        <Card className="p-4 space-y-2 border-slate-200/80 dark:border-slate-800/80">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-500 font-bold">{t('nav.curriculum')}</span>
            <span className="font-black text-emerald-600 dark:text-emerald-400">{metrics.curriculum}%</span>
          </div>
          <Progress value={metrics.curriculum} />
        </Card>

        <Card className="p-4 space-y-2 border-slate-200/80 dark:border-slate-800/80">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-500 font-bold">{t('tasks.taskTypeProject')}</span>
            <span className="font-black text-amber-600 dark:text-amber-400">{metrics.projects}%</span>
          </div>
          <Progress value={metrics.projects} />
        </Card>

        <Card className="p-4 space-y-2 border-slate-200/80 dark:border-slate-800/80">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-500 font-bold">{t('dashboard.attendance')}</span>
            <span className="font-black text-blue-600 dark:text-blue-400">{metrics.attendance}%</span>
          </div>
          <Progress value={metrics.attendance} />
        </Card>
      </div>

      {/* Tabs / Multi-card Data Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Enrollments & Class Info */}
        <Card className="p-6 space-y-4 border-slate-200/80 dark:border-slate-800/80">
          <h3 className="font-black text-base text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <CalendarCheck2 className="w-5 h-5 text-brand-600 dark:text-brand-400" />
            <span>{t('groups.enrolledGroups')}</span>
          </h3>

          <div className="space-y-2">
            {enrollments.length > 0 ? (
              enrollments.map((e: any) => (
                <div key={e.id} className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60 flex items-center justify-between">
                  <div>
                    <div className="font-bold text-sm text-slate-900 dark:text-slate-100">{localizeText(e.group.name)}</div>
                    <div className="text-xs text-slate-500">{localizeText(e.group.scheduleInfo) || t('common.noSchedule')}</div>
                  </div>
                  <Badge variant={e.isActive ? 'success' : 'secondary'} size="sm">
                    {e.isActive ? t('common.active') : t('common.archived')}
                  </Badge>
                </div>
              ))
            ) : (
              <div className="text-xs text-slate-400 py-4 text-center">{t('common.noData')}</div>
            )}
          </div>
        </Card>

        {/* Linked Parents */}
        <Card className="p-6 space-y-4 border-slate-200/80 dark:border-slate-800/80">
          <h3 className="font-black text-base text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Phone className="w-5 h-5 text-brand-600 dark:text-brand-400" />
            <span>{t('parents.title')}</span>
          </h3>

          <div className="space-y-2">
            {(student.parents || []).length > 0 ? (
              student.parents.map((rel: any) => (
                <div key={rel.id} className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60 flex items-center justify-between">
                  <div>
                    <div className="font-bold text-sm text-slate-900 dark:text-slate-100">
                      {rel.parent.user.firstName} {rel.parent.user.lastName}
                    </div>
                    <div className="text-xs text-slate-500 font-mono">{rel.parent.user.phone}</div>
                  </div>
                  <Badge variant="primary" size="sm">
                    {formatStatus(rel.relationship)}
                  </Badge>
                </div>
              ))
            ) : (
              <div className="text-xs text-slate-400 py-4 text-center">{t('common.noData')}</div>
            )}
          </div>
        </Card>
      </div>

      {/* Interactive Reset / Change Password Dialog */}
      <Dialog
        isOpen={isResetDialogOpen}
        onClose={() => setIsResetDialogOpen(false)}
        title={t('students.resetPassword') || 'Reset Student Password'}
        description={`${t('students.confirmResetPassword') || 'Reset credentials for'} "${u.firstName} ${u.lastName}" (${student.studentCode})`}
        maxWidth="md"
      >
        <div className="space-y-5 pt-2">
          {/* Mode Selector */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setResetMode('AUTO')}
              className={`p-3.5 rounded-2xl border text-left rtl:text-right transition-all flex flex-col justify-between gap-2 ${
                resetMode === 'AUTO'
                  ? 'border-indigo-500 bg-indigo-50/70 dark:bg-indigo-950/30 text-indigo-900 dark:text-indigo-200 shadow-sm'
                  : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-300'
              }`}
            >
              <div className="font-bold text-xs">{t('students.generateRandomPassword') || 'Auto-Generate Password'}</div>
              <div className="text-[11px] opacity-75">8-character secure random temporary password</div>
            </button>

            <button
              type="button"
              onClick={() => setResetMode('CUSTOM')}
              className={`p-3.5 rounded-2xl border text-left rtl:text-right transition-all flex flex-col justify-between gap-2 ${
                resetMode === 'CUSTOM'
                  ? 'border-indigo-500 bg-indigo-50/70 dark:bg-indigo-950/30 text-indigo-900 dark:text-indigo-200 shadow-sm'
                  : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-300'
              }`}
            >
              <div className="font-bold text-xs">{t('students.setCustomPassword') || 'Set Custom Password'}</div>
              <div className="text-[11px] opacity-75">Assign specific password (min 6 chars)</div>
            </button>
          </div>

          {/* Custom Password Input */}
          {resetMode === 'CUSTOM' && (
            <div className="space-y-2 animate-in fade-in duration-150">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                {t('students.customPasswordLabel') || 'New Custom Password'}
              </label>
              <Input
                type="text"
                value={customPassword}
                onChange={(e) => setCustomPassword(e.target.value)}
                placeholder={t('students.customPasswordPlaceholder') || 'Enter at least 6 characters (e.g. Student@123)'}
                className="font-mono text-sm"
                autoFocus
              />
            </div>
          )}

          {/* Must Change Password Checkbox */}
          <label className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 cursor-pointer">
            <input
              type="checkbox"
              checked={mustChangePassword}
              onChange={(e) => setMustChangePassword(e.target.checked)}
              className="mt-0.5 w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500"
            />
            <div className="text-xs text-slate-600 dark:text-slate-300">
              <span className="font-semibold">{t('students.requirePasswordChange') || 'Require password change on next login'}</span>
              <p className="text-[11px] text-slate-400 mt-0.5">Forces the student to select a personal password upon first signing in.</p>
            </div>
          </label>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsResetDialogOpen(false)}
              disabled={resetPasswordMutation.isPending}
            >
              {t('common.cancel')}
            </Button>
            <Button
              type="button"
              variant="primary"
              size="sm"
              disabled={
                resetPasswordMutation.isPending ||
                (resetMode === 'CUSTOM' && (!customPassword || customPassword.trim().length < 6))
              }
              isLoading={resetPasswordMutation.isPending}
              onClick={() =>
                resetPasswordMutation.mutate({
                  customPassword: resetMode === 'CUSTOM' ? customPassword.trim() : undefined,
                  mustChangePassword
                })
              }
            >
              <KeyRound className="w-4 h-4" />
              <span>{t('students.resetPassword') || 'Update Password'}</span>
            </Button>
          </div>
        </div>
      </Dialog>

      {/* Student Credentials & WhatsApp Modal */}
      <StudentCredentialsModal
        isOpen={Boolean(credentialsData)}
        onClose={() => setCredentialsData(null)}
        data={credentialsData}
        title={t('students.newCredentialsTitle') || 'New Temporary Credentials'}
      />

      {/* Confirm Delete Dialog */}
      <ConfirmDialog
        isOpen={isDeleteDialogOpen}
        onClose={() => setIsDeleteDialogOpen(false)}
        onConfirm={() => deleteMutation.mutate()}
        title={t('students.deleteStudent')}
        description={`${t('students.confirmDelete')} "${u.firstName} ${u.lastName}" (${student.studentCode})`}
        isLoading={deleteMutation.isPending}
        isDestructive={true}
      />
    </div>
  );
}
