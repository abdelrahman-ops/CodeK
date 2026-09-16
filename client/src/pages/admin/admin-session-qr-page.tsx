import React, { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api/client.js';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  ChevronLeft,
  QrCode,
  Users,
  Play,
  CheckCircle2,
  XCircle,
  Clock,
  RefreshCw,
  AlertCircle,
  Trash2
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/card.js';
import { Button } from '../../components/ui/button.js';
import { Badge } from '../../components/ui/badge.js';
import { ConfirmDialog } from '../../components/ui/confirm-dialog.js';
import { Avatar } from '../../components/ui/avatar.js';
import { CardSkeleton } from '../../components/ui/skeleton.js';
import { QRCodeSVG } from 'qrcode.react';
import { useToast } from '../../components/ui/toast.js';
import { useBulkSelection } from '../../hooks/use-bulk-selection.js';
import { localizeText, formatStatus } from '../../lib/i18n-helpers.js';

export function AdminSessionQrPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const isArabic = i18n.language === 'ar';
  const toast = useToast();
  const queryClient = useQueryClient();

  const [activeQrToken, setActiveQrToken] = useState<string | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  const { data: session, isLoading: sessionLoading } = useQuery({
    queryKey: ['session', id],
    queryFn: async () => {
      if (!id) throw new Error('No id');
      return (await api.sessions.getById(id)).data.data;
    },
    enabled: Boolean(id)
  });

  const { data: rosterData, refetch: refetchRoster } = useQuery({
    queryKey: ['sessionRoster', id],
    queryFn: async () => {
      if (!id) throw new Error('No id');
      return (await api.attendance.getSessionRoster(id)).data.data;
    },
    enabled: Boolean(id),
    refetchInterval: 4000
  });

  const startSessionMutation = useMutation({
    mutationFn: async () => {
      if (!id) throw new Error('No id');
      return (await api.sessions.start(id)).data.data;
    },
    onSuccess: (data) => {
      setActiveQrToken(data.qrToken);
      queryClient.invalidateQueries({ queryKey: ['session', id] });
      toast.success(t('sessions.qrRefreshed'));
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error?.message || t('common.error'));
    }
  });

  const manualMarkMutation = useMutation({
    mutationFn: async (data: { studentId: string; status: string }) => {
      if (!id) return;
      return (await api.attendance.adminMark({ sessionId: id, ...data })).data.data;
    },
    onSuccess: () => {
      refetchRoster();
      toast.success(t('common.success'));
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error?.message || t('common.error'));
    }
  });

  const deleteSessionMutation = useMutation({
    mutationFn: async () => {
      if (!id) return;
      return (await api.sessions.delete(id)).data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminSessions'] });
      queryClient.invalidateQueries({ queryKey: ['adminDashboard'] });
      toast.success(isArabic ? 'تم حذف الحصة بنجاح' : 'Session deleted successfully');
      navigate('/admin/sessions');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error?.message || t('common.error'));
    }
  });

  if (sessionLoading) return <CardSkeleton />;

  if (!session) return <div className="p-8 text-center text-slate-500">{t('common.noData')}</div>;

  const roster = rosterData?.roster || [];
  const presentCount = rosterData?.presentCount || 0;
  const totalEnrolled = rosterData?.totalEnrolled || roster.length;

  const selectionItems = useMemo(
    () => roster.map((s: any) => ({ ...s, id: s.studentId })),
    [roster]
  );
  const selection = useBulkSelection(selectionItems);

  const bulkMarkMutation = useMutation({
    mutationFn: async (status: 'PRESENT' | 'ABSENT') => {
      if (!id) return;
      return (await api.attendance.adminBulkMark({
        sessionId: id,
        studentIds: Array.from(selection.selectedIds),
        status
      })).data;
    },
    onSuccess: (_, status) => {
      refetchRoster();
      toast.success(
        status === 'PRESENT'
          ? (isArabic ? 'تم تسجيل حضور الطلاب المحددين' : 'Selected students marked present')
          : (isArabic ? 'تم تسجيل غياب الطلاب المحددين' : 'Selected students marked absent')
      );
      selection.deselectAll();
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error?.message || t('common.error'));
    }
  });

  const qrPayload = activeQrToken ? JSON.stringify({ sessionId: session.id, token: activeQrToken }) : '';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate('/admin/sessions')}
          className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
        >
          <ChevronLeft className="w-4 h-4 rtl:rotate-180" />
          <span>{t('nav.sessions')}</span>
        </button>

        <div className="flex items-center gap-2">
          <Badge variant={session.status === 'ACTIVE' ? 'success' : 'primary'}>
            {formatStatus(session.status)}
          </Badge>

          <Button
            size="sm"
            variant="outline"
            className="text-rose-600 border-rose-200 hover:bg-rose-50 dark:border-rose-900 dark:hover:bg-rose-950/40"
            onClick={() => setIsDeleteDialogOpen(true)}
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>{isArabic ? 'حذف الحصة' : 'Delete Session'}</span>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left 7 Cols: Big Projector QR Display */}
        <div className="lg:col-span-7 space-y-4">
          <Card className="p-8 flex flex-col items-center justify-center text-center gap-6 bg-white dark:bg-slate-900 shadow-2xl border-slate-200/80 dark:border-slate-800">
            <div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-brand-50 dark:bg-brand-950 text-brand-600 dark:text-brand-400 text-xs font-extrabold mb-2">
                <span>{session.group?.name ? localizeText(session.group.name) : t('students.group')}</span>
                <span>•</span>
                <span>{t('sessions.sessionNumber')} #{session.sessionNumber}</span>
              </div>
              <h1 className="text-2xl sm:text-4xl font-black text-slate-900 dark:text-slate-100">
                {t('sessions.qrProjector')}
              </h1>
              <p className="text-sm text-slate-500 mt-1">
                {t('dashboard.step1AttendanceDesc')}
              </p>
            </div>

            {/* QR Display */}
            {activeQrToken ? (
              <div className="p-6 rounded-3xl bg-white border-4 border-brand-500 shadow-xl flex flex-col items-center gap-4">
                <QRCodeSVG
                  value={qrPayload}
                  size={260}
                  level="H"
                  includeMargin={true}
                />
                <div className="space-y-1">
                  <div className="text-xs text-slate-500 font-bold uppercase tracking-wider">
                    {t('sessions.manualToken')}
                  </div>
                  <div className="font-mono text-xl font-black text-slate-900 tracking-wider bg-slate-100 px-4 py-1.5 rounded-xl border border-slate-300">
                    {activeQrToken}
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-12 rounded-3xl bg-slate-50 dark:bg-slate-800/60 border-2 border-dashed border-slate-300 dark:border-slate-700 flex flex-col items-center gap-4 text-center max-w-md">
                <QrCode className="w-16 h-16 text-slate-400" />
                <div className="space-y-1">
                  <p className="text-sm font-bold text-slate-800 dark:text-slate-200">
                    {session.status === 'ACTIVE'
                      ? t('sessions.qrUnavailableOnRefresh')
                      : t('sessions.liveAttendance')}
                  </p>
                  <p className="text-xs text-slate-500">
                    {t('sessions.regeneratePrompt')}
                  </p>
                </div>
                <Button
                  size="lg"
                  onClick={() => startSessionMutation.mutate()}
                  isLoading={startSessionMutation.isPending}
                  className="mt-2"
                >
                  <RefreshCw className="w-4 h-4" />
                  <span>{session.status === 'ACTIVE' ? t('sessions.regenerateQr') : t('sessions.startSession')}</span>
                </Button>
              </div>
            )}

            {/* Live Counter */}
            <div className="flex items-center gap-6 pt-4 border-t border-slate-100 dark:border-slate-800 w-full justify-around">
              <div>
                <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400">{presentCount}</div>
                <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">{t('attendance.present')}</div>
              </div>
              <div className="w-px h-8 bg-slate-200 dark:bg-slate-700" />
              <div>
                <div className="text-2xl font-black text-rose-600 dark:text-rose-400">{Math.max(0, totalEnrolled - presentCount)}</div>
                <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">{t('attendance.absent')}</div>
              </div>
              <div className="w-px h-8 bg-slate-200 dark:bg-slate-700" />
              <div>
                <div className="text-2xl font-black text-slate-900 dark:text-slate-100">{totalEnrolled}</div>
                <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">{t('groups.maxCapacity')}</div>
              </div>
            </div>

            {activeQrToken && (
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => startSessionMutation.mutate()}
                  isLoading={startSessionMutation.isPending}
                >
                  <RefreshCw className="w-4 h-4" />
                  <span>{t('sessions.regenerateQr')}</span>
                </Button>
              </div>
            )}
          </Card>
        </div>

        {/* Right 5 Cols: Live Attendance Roster */}
        <div className="lg:col-span-5 space-y-4">
          <Card className="p-6 border-slate-200/80 dark:border-slate-800/80 shadow-sm flex flex-col h-full">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-brand-600 dark:text-brand-400" />
                <h3 className="font-black text-base text-slate-900 dark:text-slate-100">
                  {t('attendance.roster')}
                </h3>
              </div>
              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 animate-pulse">
                {t('sessions.liveIndicator')}
              </span>
            </div>

            {/* Select All & Summary Bar */}
            {roster.length > 0 && (
              <div className="flex items-center justify-between py-2 px-1 border-b border-slate-100 dark:border-slate-800 text-xs font-bold text-slate-500">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selection.isAllSelected}
                    ref={(el) => {
                      if (el) el.indeterminate = selection.isIndeterminate;
                    }}
                    onChange={selection.toggleSelectAll}
                    className="w-4 h-4 rounded text-brand-600 focus:ring-brand-500 border-slate-300 dark:border-slate-600 cursor-pointer"
                  />
                  <span>{isArabic ? 'تحديد الكل' : 'Select All'} ({selection.selectedCount}/{roster.length})</span>
                </label>
                {selection.selectedCount > 0 && (
                  <button
                    type="button"
                    onClick={selection.deselectAll}
                    className="text-xs text-brand-600 dark:text-brand-400 hover:underline"
                  >
                    {isArabic ? 'إلغاء التحديد' : 'Clear'}
                  </button>
                )}
              </div>
            )}

            {/* Bulk Actions Floating / Top Bar */}
            {selection.selectedCount > 0 && (
              <div className="p-3 bg-brand-50/70 dark:bg-brand-950/40 rounded-xl border border-brand-200/60 dark:border-brand-800/60 flex items-center justify-between gap-2">
                <span className="text-xs font-bold text-brand-900 dark:text-brand-100">
                  {selection.selectedCount} {isArabic ? 'محدد' : 'selected'}
                </span>
                <div className="flex items-center gap-1.5">
                  <Button
                    size="sm"
                    className="h-7 px-2.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                    onClick={() => bulkMarkMutation.mutate('PRESENT')}
                    isLoading={bulkMarkMutation.isPending}
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>{isArabic ? 'تسجيل حضور' : 'Mark Present'}</span>
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 px-2.5 text-xs text-rose-600 border-rose-200 hover:bg-rose-50 dark:border-rose-900"
                    onClick={() => bulkMarkMutation.mutate('ABSENT')}
                    isLoading={bulkMarkMutation.isPending}
                  >
                    <XCircle className="w-3.5 h-3.5" />
                    <span>{isArabic ? 'تسجيل غياب' : 'Mark Absent'}</span>
                  </Button>
                </div>
              </div>
            )}

            <div className="divide-y divide-slate-100 dark:divide-slate-800/80 overflow-y-auto max-h-[480px] -mx-6 px-6">
              {roster.map((student: any) => {
                const isPresent = student.status === 'PRESENT';
                const isSelected = selection.isSelected(student.studentId);
                return (
                  <div
                    key={student.studentId}
                    className={`py-3 px-2 rounded-xl flex items-center justify-between gap-3 transition ${
                      isSelected ? 'bg-brand-50/40 dark:bg-brand-950/40' : ''
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => selection.toggle(student.studentId)}
                        className="w-4 h-4 rounded text-brand-600 focus:ring-brand-500 border-slate-300 dark:border-slate-600 cursor-pointer shrink-0"
                      />
                      <Avatar name={student.studentName || `${student.firstName || ''} ${student.lastName || ''}`} src={student.avatarUrl} size="sm" />
                      <div className="min-w-0">
                        <div className="font-bold text-sm text-slate-900 dark:text-slate-100 truncate">
                          {student.studentName || `${student.firstName || ''} ${student.lastName || ''}`.trim() || student.studentCode || 'Student'}
                        </div>
                        <div className="text-xs text-slate-400 font-mono">
                          {student.studentCode}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <Badge variant={isPresent ? 'success' : 'secondary'} size="sm">
                        {formatStatus(student.status)}
                      </Badge>

                      <Button
                        size="sm"
                        variant="outline"
                        className={`h-7 px-2 text-xs ${
                          isPresent
                            ? 'text-rose-600 hover:bg-rose-50 dark:border-rose-800'
                            : 'text-emerald-600 hover:bg-emerald-50 dark:border-emerald-800'
                        }`}
                        onClick={() =>
                          manualMarkMutation.mutate({
                            studentId: student.studentId,
                            status: isPresent ? 'ABSENT' : 'PRESENT'
                          })
                        }
                        isLoading={manualMarkMutation.isPending}
                      >
                        {isPresent ? t('attendance.markAbsent') : t('attendance.markPresent')}
                      </Button>
                    </div>
                  </div>
                );
              })}

              {roster.length === 0 && (
                <div className="py-12 text-center text-xs text-slate-400">
                  {t('attendance.noEnrolledStudents')}
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>

      {/* Delete Session Confirm Dialog */}
      <ConfirmDialog
        isOpen={isDeleteDialogOpen}
        onClose={() => setIsDeleteDialogOpen(false)}
        onConfirm={() => deleteSessionMutation.mutate()}
        title={isArabic ? 'حذف الحصة' : 'Delete Session'}
        description={
          isArabic
            ? `هل أنت متأكد من حذف الحصة رقم #${session.sessionNumber} لمجموعة "${session.group?.name || ''}"؟ سيتم حذف الحصة وسجلات الحضور التابعة لها نهائياً.`
            : `Are you sure you want to delete session #${session.sessionNumber} for "${session.group?.name || ''}"? This will permanently remove the session and all attendance records.`
        }
        isLoading={deleteSessionMutation.isPending}
        isDestructive={true}
      />
    </div>
  );
}
