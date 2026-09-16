import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api/client.js';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import {
  CalendarCheck2,
  Plus,
  QrCode,
  Clock,
  Trash2,
  Users,
  CheckCircle2,
  AlertCircle,
  Calendar as CalendarIcon,
  Filter,
  Check,
  ChevronDown
} from 'lucide-react';
import { Card } from '../../components/ui/card.js';
import { Button } from '../../components/ui/button.js';
import { Badge } from '../../components/ui/badge.js';
import { ConfirmDialog } from '../../components/ui/confirm-dialog.js';
import { CardSkeleton } from '../../components/ui/skeleton.js';
import { useToast } from '../../components/ui/toast.js';
import { localizeText, formatStatus, formatDate, formatTime12h } from '../../lib/i18n-helpers.js';
import { CreateSessionModal } from '../../components/sessions/create-session-modal.js';
import { Session } from '../../types/api.js';
import { useBulkSelection } from '../../hooks/use-bulk-selection.js';
import { BulkSelectionBar } from '../../components/shared/bulk-selection-bar.js';

export function AdminSessionsPage() {
  const { t, i18n } = useTranslation();
  const isArabic = i18n.language === 'ar';
  const navigate = useNavigate();
  const toast = useToast();
  const queryClient = useQueryClient();

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [sessionToDelete, setSessionToDelete] = useState<Session | null>(null);
  const [isBulkDeleteOpen, setIsBulkDeleteOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [selectedGroupId, setSelectedGroupId] = useState<string>('ALL');

  const { data: sessions, isLoading: isLoadingSessions } = useQuery({
    queryKey: ['adminSessions'],
    queryFn: async () => (await api.sessions.list()).data.data
  });

  const { data: groups } = useQuery({
    queryKey: ['groups'],
    queryFn: async () => (await api.groups.list()).data.data
  });

  const allSessions = sessions || [];

  // Filter sessions
  const filteredSessions = allSessions.filter((sess) => {
    const matchesStatus = statusFilter === 'ALL' || sess.status === statusFilter;
    const matchesGroup = selectedGroupId === 'ALL' || sess.groupId === selectedGroupId || sess.group?.id === selectedGroupId;
    return matchesStatus && matchesGroup;
  });

  const selection = useBulkSelection(filteredSessions);

  const deleteSessionMutation = useMutation({
    mutationFn: async (sessionId: string) => {
      return (await api.sessions.delete(sessionId)).data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminSessions'] });
      queryClient.invalidateQueries({ queryKey: ['adminDashboard'] });
      setSessionToDelete(null);
      toast.success(isArabic ? 'تم حذف الحصة بنجاح' : 'Session deleted successfully');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error?.message || t('common.error'));
    }
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: async (sessionIds: string[]) => {
      return (await api.sessions.bulkDelete(sessionIds)).data.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['adminSessions'] });
      queryClient.invalidateQueries({ queryKey: ['adminDashboard'] });
      selection.clear();
      setIsBulkDeleteOpen(false);
      toast.success(
        isArabic
          ? `تم حذف ${data.count} حصة بنجاح`
          : `Successfully deleted ${data.count} sessions`
      );
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error?.message || t('common.error'));
    }
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      return (await api.sessions.update(id, { status })).data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminSessions'] });
      queryClient.invalidateQueries({ queryKey: ['adminDashboard'] });
      toast.success(isArabic ? 'تم تحديث حالة الحصة' : 'Session status updated');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error?.message || t('common.error'));
    }
  });

  if (isLoadingSessions) return <CardSkeleton />;

  const counts = {
    all: allSessions.length,
    scheduled: allSessions.filter((s) => s.status === 'SCHEDULED').length,
    active: allSessions.filter((s) => s.status === 'ACTIVE').length,
    completed: allSessions.filter((s) => s.status === 'COMPLETED').length,
    cancelled: allSessions.filter((s) => s.status === 'CANCELLED').length
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-slate-100 flex items-center gap-2.5">
            <CalendarCheck2 className="w-7 h-7 text-brand-600 dark:text-brand-400" />
            <span>{t('nav.sessions')}</span>
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            {isArabic
              ? 'إدارة جدول الحصص الحضورية، عرض رمز QR التفاعلي، وتسجيل الحضور ومتابعة المجموعات'
              : 'Manage classroom sessions, launch live QR projectors, and track attendance'}
          </p>
        </div>

        <Button onClick={() => setIsCreateModalOpen(true)} className="shrink-0 shadow-md shadow-brand-500/20">
          <Plus className="w-4 h-4" />
          <span>{t('sessions.createSession')}</span>
        </Button>
      </div>

      {/* Filter Bar & Group Selector */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 p-2 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs">
        {/* Status Filter Tabs */}
        <div className="flex items-center gap-1 overflow-x-auto pb-1 md:pb-0 scrollbar-none">
          <button
            type="button"
            onClick={() => setStatusFilter('ALL')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 ${
              statusFilter === 'ALL'
                ? 'bg-brand-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <span>{isArabic ? 'الكل' : 'All'}</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-white/20 dark:bg-white/10 font-mono">
              {counts.all}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter('ACTIVE')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 ${
              statusFilter === 'ACTIVE'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>{isArabic ? 'نشطة الآن' : 'Active'}</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-white/20 font-mono">
              {counts.active}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter('SCHEDULED')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 ${
              statusFilter === 'SCHEDULED'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <span>{isArabic ? 'مجدولة' : 'Scheduled'}</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-white/20 font-mono">
              {counts.scheduled}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter('COMPLETED')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 ${
              statusFilter === 'COMPLETED'
                ? 'bg-slate-700 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <span>{isArabic ? 'مكتملة' : 'Completed'}</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-white/20 font-mono">
              {counts.completed}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter('CANCELLED')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 ${
              statusFilter === 'CANCELLED'
                ? 'bg-rose-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <span>{isArabic ? 'ملغاة' : 'Cancelled'}</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-white/20 font-mono">
              {counts.cancelled}
            </span>
          </button>
        </div>

        {/* Group Dropdown Filter */}
        {groups && groups.length > 0 && (
          <div className="flex items-center gap-2 px-2 shrink-0">
            <span className="text-xs text-slate-400 font-bold hidden sm:inline">{isArabic ? 'المجموعة:' : 'Group:'}</span>
            <select
              value={selectedGroupId}
              onChange={(e) => setSelectedGroupId(e.target.value)}
              className="px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              <option value="ALL">{isArabic ? 'جميع المجموعات' : 'All Groups'}</option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {localizeText(g.name)}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Bulk Selection Bar */}
      <BulkSelectionBar
        totalItems={filteredSessions.length}
        selectedCount={selection.selectedCount}
        isAllSelected={selection.isAllSelected}
        isIndeterminate={selection.isIndeterminate}
        onToggleSelectAll={selection.toggleSelectAll}
        onDeselectAll={selection.deselectAll}
        onDeleteSelected={() => setIsBulkDeleteOpen(true)}
        isLoading={bulkDeleteMutation.isPending}
      />

      {/* Sessions List */}
      {filteredSessions.length === 0 ? (
        <Card className="p-12 text-center space-y-3 bg-slate-50/50 dark:bg-slate-900/50 border-dashed border-2 border-slate-200 dark:border-slate-800">
          <div className="w-12 h-12 rounded-2xl bg-brand-50 dark:bg-brand-950 text-brand-600 dark:text-brand-400 flex items-center justify-center mx-auto">
            <CalendarCheck2 className="w-6 h-6" />
          </div>
          <h3 className="font-black text-base text-slate-800 dark:text-slate-200">
            {isArabic ? 'لا توجد حصص تطابق التصفية الحالية' : 'No sessions matching this filter'}
          </h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            {isArabic
              ? 'يمكنك جدولة حصة جديدة الآن بالضغط على زر "جدولة حصة جديدة" بالأعلى'
              : 'You can schedule a new session using the create button above.'}
          </p>
          <Button size="sm" onClick={() => setIsCreateModalOpen(true)} className="mt-2">
            <Plus className="w-4 h-4" />
            <span>{t('sessions.createSession')}</span>
          </Button>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredSessions.map((sess) => {
            const isActive = sess.status === 'ACTIVE';
            const isCompleted = sess.status === 'COMPLETED';
            const isCancelled = sess.status === 'CANCELLED';
            const isSelected = selection.isSelected(sess.id);

            return (
              <Card
                key={sess.id}
                className={`p-5 transition-all hover:shadow-md border flex flex-col md:flex-row items-start md:items-center justify-between gap-4 ${
                  isSelected
                    ? 'ring-2 ring-brand-500/40 border-brand-400 bg-brand-50/20 dark:bg-brand-950/20'
                    : isActive
                    ? 'bg-emerald-50/30 dark:bg-emerald-950/20 border-emerald-300 dark:border-emerald-800 ring-1 ring-emerald-500/20'
                    : isCancelled
                    ? 'opacity-70 bg-rose-50/20 dark:bg-rose-950/10 border-slate-200 dark:border-slate-800'
                    : 'bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800'
                }`}
              >
                <div className="flex items-start md:items-center gap-3.5 flex-1 min-w-0">
                  {/* Row Checkbox */}
                  <div className="pt-1 md:pt-0 shrink-0">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => selection.toggle(sess.id)}
                      className="w-4 h-4 rounded text-brand-600 focus:ring-brand-500 border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 cursor-pointer accent-brand-600"
                    />
                  </div>

                  {/* Session Info */}
                  <div className="space-y-2 flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <h3 className="font-black text-base sm:text-lg text-slate-900 dark:text-slate-100 flex items-center gap-2">
                        <span>{sess.group?.name ? localizeText(sess.group.name) : t('students.group')}</span>
                        <span className="text-brand-600 dark:text-brand-400 font-extrabold">
                          #{sess.sessionNumber}
                        </span>
                      </h3>

                      {/* Status Badge */}
                      <Badge
                        variant={isActive ? 'success' : isCompleted ? 'secondary' : isCancelled ? 'danger' : 'primary'}
                        size="sm"
                      >
                        {isActive && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse mr-1" />}
                        <span>{formatStatus(sess.status)}</span>
                      </Badge>
                    </div>

                    {/* Metadata Chips: Date, 12h Time, Attendance Count */}
                    <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 font-medium">
                      <span className="flex items-center gap-1 text-slate-700 dark:text-slate-300 font-bold">
                        <CalendarIcon className="w-3.5 h-3.5 text-brand-500" />
                        <span>{formatDate(sess.date)}</span>
                      </span>

                      <span className="text-slate-300 dark:text-slate-700">•</span>

                      <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200">
                        <Clock className="w-3.5 h-3.5 text-brand-500 shrink-0" />
                        <span dir="ltr" className="font-mono font-bold">
                          {formatTime12h(sess.startTime, isArabic)} – {formatTime12h(sess.endTime, isArabic)}
                        </span>
                      </span>

                      <span className="text-slate-300 dark:text-slate-700">•</span>

                      <span className="flex items-center gap-1 font-bold text-slate-600 dark:text-slate-400">
                        <Users className="w-3.5 h-3.5 text-brand-500" />
                        <span>{sess._count?.attendances || 0} {t('sessions.presentCount')}</span>
                      </span>
                    </div>
                  </div>
                </div>

                {/* Actions Buttons Group */}
                <div className="flex items-center gap-2 self-stretch md:self-center justify-end border-t md:border-t-0 pt-3 md:pt-0 border-slate-100 dark:border-slate-800">
                  {/* Status Switcher Shortcut */}
                  {!isCancelled && (
                    <select
                      value={sess.status}
                      onChange={(e) => updateStatusMutation.mutate({ id: sess.id, status: e.target.value })}
                      disabled={updateStatusMutation.isPending}
                      className="text-xs px-2.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-bold text-slate-700 dark:text-slate-300 focus:outline-none"
                    >
                      <option value="SCHEDULED">{isArabic ? 'مجدولة' : 'Scheduled'}</option>
                      <option value="ACTIVE">{isArabic ? 'نشطة (جارية)' : 'Active'}</option>
                      <option value="COMPLETED">{isArabic ? 'مكتملة' : 'Completed'}</option>
                      <option value="CANCELLED">{isArabic ? 'إلغاء الحصة' : 'Cancelled'}</option>
                    </select>
                  )}

                  {/* Projector QR Button */}
                  <Button
                    size="sm"
                    variant={isActive ? 'primary' : 'outline'}
                    onClick={() => navigate(`/admin/sessions/${sess.id}/qr`)}
                    className="shadow-xs"
                  >
                    <QrCode className="w-4 h-4" />
                    <span>{t('common.projectorQr')}</span>
                  </Button>

                  {/* Delete Session Button */}
                  <button
                    type="button"
                    onClick={() => setSessionToDelete(sess)}
                    className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 border border-transparent hover:border-rose-200 dark:hover:border-rose-900 transition-all"
                    title={isArabic ? 'حذف هذه الحصة' : 'Delete Session'}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Delete Session Confirm Dialog */}
      <ConfirmDialog
        isOpen={Boolean(sessionToDelete)}
        onClose={() => setSessionToDelete(null)}
        onConfirm={() => {
          if (sessionToDelete) {
            deleteSessionMutation.mutate(sessionToDelete.id);
          }
        }}
        title={isArabic ? 'حذف الحصة' : 'Delete Session'}
        description={
          isArabic
            ? `هل أنت متأكد من حذف الحصة رقم #${sessionToDelete?.sessionNumber} لمجموعة "${sessionToDelete?.group?.name || ''}"؟ سيتم حذف الحصة وسجلات الحضور التابعة لها نهائياً.`
            : `Are you sure you want to delete session #${sessionToDelete?.sessionNumber} for "${sessionToDelete?.group?.name || ''}"? This will permanently remove the session and its attendance records.`
        }
        isLoading={deleteSessionMutation.isPending}
        isDestructive={true}
      />

      {/* Bulk Delete Sessions Confirm Dialog */}
      <ConfirmDialog
        isOpen={isBulkDeleteOpen}
        onClose={() => setIsBulkDeleteOpen(false)}
        onConfirm={() => bulkDeleteMutation.mutate(selection.selectedIds)}
        title={
          isArabic
            ? `حذف ${selection.selectedCount} حصة؟`
            : `Delete ${selection.selectedCount} sessions?`
        }
        description={
          isArabic
            ? `هل أنت متأكد من حذف ${selection.selectedCount} حصة محددة؟ سيتم حذف الحصص وسجلات الحضور التابعة لها نهائياً ولا يمكن التراجع عن هذا الإجراء.`
            : `Are you sure you want to delete ${selection.selectedCount} selected sessions? This will permanently delete them and all associated attendance records. This action cannot be undone.`
        }
        isLoading={bulkDeleteMutation.isPending}
        isDestructive={true}
      />

      <CreateSessionModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
      />
    </div>
  );
}

