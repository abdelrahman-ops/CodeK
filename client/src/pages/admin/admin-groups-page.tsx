import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api/client.js';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Presentation, Plus, Users, Clock, AlertTriangle, ChevronRight } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/card.js';
import { Button } from '../../components/ui/button.js';
import { Input } from '../../components/ui/input.js';
import { Badge } from '../../components/ui/badge.js';
import { Dialog } from '../../components/ui/dialog.js';
import { ConfirmDialog } from '../../components/ui/confirm-dialog.js';
import { GroupSchedulePicker } from '../../components/groups/group-schedule-picker.js';
import { CardSkeleton } from '../../components/ui/skeleton.js';
import { useToast } from '../../components/ui/toast.js';
import { localizeText, formatScheduleDisplay } from '../../lib/i18n-helpers.js';
import { useBulkSelection } from '../../hooks/use-bulk-selection.js';
import { BulkSelectionBar } from '../../components/shared/bulk-selection-bar.js';

export function AdminGroupsPage() {
  const { t, i18n } = useTranslation();
  const isArabic = i18n.language === 'ar';
  const navigate = useNavigate();
  const toast = useToast();
  const queryClient = useQueryClient();

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isBulkDeleteOpen, setIsBulkDeleteOpen] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [schedules, setSchedules] = useState<any[]>([]);
  const [whatsappGroupUrl, setWhatsappGroupUrl] = useState('');
  const [maxCapacity, setMaxCapacity] = useState(20);

  const { data: groups, isLoading } = useQuery({
    queryKey: ['groups'],
    queryFn: async () => (await api.groups.list()).data.data
  });

  const allGroups = groups || [];
  const selection = useBulkSelection(allGroups);

  const createMutation = useMutation({
    mutationFn: async (data: any) => (await api.groups.create(data)).data.data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['groups'] });
      setIsCreateModalOpen(false);
      setName('');
      setDescription('');
      setSchedules([]);
      setWhatsappGroupUrl('');
      toast.success(t('common.success'));
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error?.message || t('common.error'));
    }
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: async (groupIds: string[]) => {
      return (await api.groups.bulkDelete(groupIds)).data.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['groups'] });
      selection.clear();
      setIsBulkDeleteOpen(false);

      if (data.failed && data.failed.length > 0) {
        const failedNames = data.failed.map((f) => f.name).join(', ');
        if (data.count > 0) {
          toast.success(
            isArabic
              ? `تم حذف ${data.count} مجموعة. تعذر حذف (${failedNames}) لوجود حصص أو طلاب ملتحقين.`
              : `Deleted ${data.count} groups. Could not delete (${failedNames}) due to active sessions or enrolled students.`
          );
        } else {
          toast.error(
            isArabic
              ? `تعذر حذف المجموعات المحددة (${failedNames}) لوجود حصص أو طلاب ملتحقين.`
              : `Could not delete selected groups (${failedNames}) due to active sessions or enrolled students.`
          );
        }
      } else {
        toast.success(
          isArabic
            ? `تم حذف ${data.count} مجموعة بنجاح`
            : `Successfully deleted ${data.count} groups`
        );
      }
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error?.message || t('common.error'));
    }
  });

  const handleCreateGroup = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate({
      name,
      description: description.trim() || undefined,
      schedules: schedules.length > 0 ? schedules : undefined,
      whatsappGroupUrl: whatsappGroupUrl.trim() || undefined,
      maxCapacity
    });
  };

  if (isLoading) return <CardSkeleton />;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-slate-100 flex items-center gap-2.5">
            <Presentation className="w-7 h-7 text-brand-600 dark:text-brand-400" />
            <span>{t('nav.groups')}</span>
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            {t('groups.subtitle')}
          </p>
        </div>

        <Button onClick={() => setIsCreateModalOpen(true)}>
          <Plus className="w-4 h-4" />
          <span>{t('groups.createGroup')}</span>
        </Button>
      </div>

      {/* Bulk Selection Bar */}
      <BulkSelectionBar
        totalItems={allGroups.length}
        selectedCount={selection.selectedCount}
        isAllSelected={selection.isAllSelected}
        isIndeterminate={selection.isIndeterminate}
        onToggleSelectAll={selection.toggleSelectAll}
        onDeselectAll={selection.deselectAll}
        onDeleteSelected={() => setIsBulkDeleteOpen(true)}
        isLoading={bulkDeleteMutation.isPending}
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {groups?.map((group) => {
          const studentCount = group._count?.enrollments || 0;
          const isNearCapacity = studentCount >= group.maxCapacity;
          const isSelected = selection.isSelected(group.id);

          return (
            <Card
              key={group.id}
              onClick={() => navigate(`/admin/groups/${group.id}`)}
              className={`p-6 flex flex-col justify-between gap-4 cursor-pointer hover:border-brand-500/60 dark:hover:border-brand-500/60 transition-all hover:shadow-md ${
                isSelected
                  ? 'ring-2 ring-brand-500/40 border-brand-400 bg-brand-50/10 dark:bg-brand-950/10'
                  : 'border-slate-200/80 dark:border-slate-800/80'
              }`}
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div
                      onClick={(e) => e.stopPropagation()}
                      className="flex items-center"
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => selection.toggle(group.id)}
                        className="w-4 h-4 rounded text-brand-600 focus:ring-brand-500 border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 cursor-pointer accent-brand-600"
                      />
                    </div>
                    <div className="w-10 h-10 rounded-2xl bg-brand-50 dark:bg-brand-950 text-brand-600 dark:text-brand-400 flex items-center justify-center">
                      <Presentation className="w-5 h-5" />
                    </div>
                  </div>
                  <Badge variant={isNearCapacity ? 'danger' : 'primary'}>
                    {studentCount} / {group.maxCapacity} {t('roles.student')}
                  </Badge>
                </div>

                <div>
                  <h3 className="font-bold text-lg text-slate-900 dark:text-slate-100 flex items-center justify-between">
                    <span>{localizeText(group.name)}</span>
                    <ChevronRight className="w-4 h-4 text-slate-400 rtl:rotate-180" />
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">{localizeText(group.description)}</p>
                </div>

                {group.scheduleInfo && (
                  <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
                    <Clock className="w-3.5 h-3.5 text-brand-500" />
                    <span>{formatScheduleDisplay(group.schedules, group.scheduleInfo, isArabic)}</span>
                  </div>
                )}
              </div>

              {isNearCapacity && (
                <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{t('groups.capacity')}</span>
                </div>
              )}
            </Card>
          );
        })}
      </div>

      {/* Bulk Delete Groups Confirm Dialog */}
      <ConfirmDialog
        isOpen={isBulkDeleteOpen}
        onClose={() => setIsBulkDeleteOpen(false)}
        onConfirm={() => bulkDeleteMutation.mutate(selection.selectedIds)}
        title={
          isArabic
            ? `حذف ${selection.selectedCount} مجموعة؟`
            : `Delete ${selection.selectedCount} groups?`
        }
        description={
          isArabic
            ? `هل أنت متأكد من حذف ${selection.selectedCount} مجموعة محددة؟ لا يمكن حذف المجموعات التي تحتوي على حصص دراسية سابقة أو طلاب ملتحقين حالياً.`
            : `Are you sure you want to delete ${selection.selectedCount} selected groups? Groups with active class sessions or enrolled students cannot be deleted and will be skipped.`
        }
        isLoading={bulkDeleteMutation.isPending}
        isDestructive={true}
      />

      {/* Create Group Modal */}
      <Dialog
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title={t('groups.createGroup')}
        maxWidth="lg"
      >
        <form onSubmit={handleCreateGroup} className="space-y-4 py-1">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label={t('groups.groupName')}
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
            <Input
              label={t('groups.description') || (isArabic ? 'وصف المجموعة' : 'Group Description')}
              placeholder={isArabic ? 'مثال: المستوى الأول - الأساسيات البرمجية' : 'e.g. Level 1 - Python Fundamentals'}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <GroupSchedulePicker
            schedules={schedules}
            onChange={setSchedules}
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label={t('groups.whatsappGroupUrl') || (isArabic ? 'رابط مجموعة الواتساب' : 'WhatsApp Group Invite Link')}
              type="url"
              placeholder="https://chat.whatsapp.com/..."
              value={whatsappGroupUrl}
              onChange={(e) => setWhatsappGroupUrl(e.target.value)}
            />
            <Input
              label={t('groups.maxCapacity')}
              type="number"
              value={maxCapacity}
              onChange={(e) => setMaxCapacity(Number(e.target.value))}
              min={1}
              max={100}
              required
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
            <Button type="button" variant="outline" onClick={() => setIsCreateModalOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" isLoading={createMutation.isPending}>
              {t('groups.createGroup')}
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}

