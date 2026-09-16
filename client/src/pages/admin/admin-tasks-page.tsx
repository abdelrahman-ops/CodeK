import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api/client.js';
import { useTranslation } from 'react-i18next';
import { CheckSquare, Plus, Clock, Star, Send, Trash2, Check, X } from 'lucide-react';
import { Card } from '../../components/ui/card.js';
import { Button } from '../../components/ui/button.js';
import { Input, Textarea } from '../../components/ui/input.js';
import { Select } from '../../components/ui/select.js';
import { Badge } from '../../components/ui/badge.js';
import { Dialog } from '../../components/ui/dialog.js';
import { ConfirmDialog } from '../../components/ui/confirm-dialog.js';
import { CardSkeleton } from '../../components/ui/skeleton.js';
import { useToast } from '../../components/ui/toast.js';
import { localizeText, formatStatus, formatDuration, formatXp } from '../../lib/i18n-helpers.js';
import { useBulkSelection } from '../../hooks/use-bulk-selection.js';
import { BulkSelectionBar } from '../../components/shared/bulk-selection-bar.js';

export function AdminTasksPage() {
  const { t } = useTranslation();
  const toast = useToast();
  const queryClient = useQueryClient();

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [instructions, setInstructions] = useState('');
  const [taskType, setTaskType] = useState('DAILY_TASK');
  const [difficulty, setDifficulty] = useState('BEGINNER');
  const [xpReward, setXpReward] = useState(30);
  const [estimatedDuration, setEstimatedDuration] = useState(30);
  const [selectedGroupId, setSelectedGroupId] = useState('');

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [taskToDelete, setTaskToDelete] = useState<{ id: string; title: string } | null>(null);
  const [isBulkDeleteOpen, setIsBulkDeleteOpen] = useState(false);

  const { data: groups } = useQuery({
    queryKey: ['groups'],
    queryFn: async () => (await api.groups.list()).data.data
  });

  const { data: tasks, isLoading } = useQuery({
    queryKey: ['adminTasks'],
    queryFn: async () => (await api.tasks.list()).data.data
  });

  const selection = useBulkSelection(tasks || []);

  const bulkPublishMutation = useMutation({
    mutationFn: async ({ ids, isPublished }: { ids: string[]; isPublished: boolean }) =>
      (await api.tasks.bulkPublish(ids, isPublished)).data.data,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['adminTasks'] });
      selection.deselectAll();
      toast.success(t('common.success'));
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error?.message || t('common.error'));
    }
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: async (ids: string[]) => (await api.tasks.bulkDelete(ids)).data.data,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['adminTasks'] });
      selection.deselectAll();
      setIsBulkDeleteOpen(false);
      toast.success(t('common.success'));
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error?.message || t('common.error'));
    }
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => (await api.tasks.create(data)).data.data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminTasks'] });
      setIsCreateModalOpen(false);
      setTitle('');
      setDescription('');
      setInstructions('');
      toast.success(t('common.success'));
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error?.message || t('common.error'));
    }
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => (await api.tasks.update(id, data)).data.data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminTasks'] });
      setIsEditModalOpen(false);
      setEditingTaskId(null);
      toast.success(t('common.success'));
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error?.message || t('common.error'));
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => (await api.tasks.delete(id)).data.data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminTasks'] });
      setTaskToDelete(null);
      toast.success(t('common.success'));
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error?.message || t('common.error'));
    }
  });

  const handleCreateTask = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate({
      title,
      description,
      instructions,
      taskType,
      difficulty,
      xpReward: Number(xpReward),
      estimatedDurationMinutes: Number(estimatedDuration),
      groupIds: selectedGroupId ? [selectedGroupId] : undefined
    });
  };

  const handleOpenEdit = (task: any) => {
    setEditingTaskId(task.id);
    setTitle(task.title);
    setDescription(task.description);
    setInstructions(task.instructions || '');
    setTaskType(task.taskType);
    setDifficulty(task.difficulty);
    setXpReward(task.xpReward);
    setEstimatedDuration(task.estimatedDurationMinutes);
    setIsEditModalOpen(true);
  };

  const handleUpdateTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTaskId) return;
    updateMutation.mutate({
      id: editingTaskId,
      data: {
        title,
        description,
        instructions,
        taskType,
        difficulty,
        xpReward: Number(xpReward),
        estimatedDurationMinutes: Number(estimatedDuration)
      }
    });
  };

  if (isLoading) return <CardSkeleton />;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <CheckSquare className="w-7 h-7 text-brand-600 dark:text-brand-400" />
            <span>{t('tasks.title')}</span>
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            {t('tasks.subtitle')}
          </p>
        </div>

        <Button onClick={() => {
          setTitle('');
          setDescription('');
          setInstructions('');
          setIsCreateModalOpen(true);
        }}>
          <Plus className="w-4 h-4" />
          <span>{t('tasks.createTask')}</span>
        </Button>
      </div>

      {/* Bulk Action Toolbar */}
      <BulkSelectionBar
        totalItems={tasks?.length || 0}
        selectedCount={selection.selectedCount}
        isAllSelected={selection.isAllSelected}
        isIndeterminate={selection.isIndeterminate}
        onToggleSelectAll={selection.toggleSelectAll}
        onDeselectAll={selection.deselectAll}
        onDeleteSelected={() => setIsBulkDeleteOpen(true)}
        isLoading={bulkDeleteMutation.isPending || bulkPublishMutation.isPending}
        actions={[
          {
            id: 'publish',
            label: 'نشر المحدد',
            icon: <Check className="w-3.5 h-3.5" />,
            variant: 'primary',
            onClick: () =>
              bulkPublishMutation.mutate({
                ids: Array.from(selection.selectedIds),
                isPublished: true
              })
          },
          {
            id: 'unpublish',
            label: 'إلغاء النشر (مسودة)',
            icon: <X className="w-3.5 h-3.5" />,
            variant: 'secondary',
            onClick: () =>
              bulkPublishMutation.mutate({
                ids: Array.from(selection.selectedIds),
                isPublished: false
              })
          }
        ]}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {tasks?.map((task) => {
          const isSelected = selection.isSelected(task.id);
          return (
            <Card
              key={task.id}
              className={`p-6 flex flex-col justify-between gap-4 transition shadow-sm ${
                isSelected
                  ? 'border-brand-500 bg-brand-50/20 dark:bg-brand-950/20 ring-2 ring-brand-500/20'
                  : 'border-slate-200/80 dark:border-slate-800/80'
              }`}
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => selection.toggle(task.id)}
                      onClick={(e) => e.stopPropagation()}
                      className="w-4 h-4 rounded text-brand-600 focus:ring-brand-500 border-slate-300 dark:border-slate-600 cursor-pointer accent-brand-600"
                    />
                    <Badge variant="primary">{formatStatus(task.taskType)}</Badge>
                  </div>
                  <span className="text-xs font-bold text-amber-600 dark:text-amber-400">
                    {formatXp(task.xpReward)}
                  </span>
                </div>

              <h3 className="font-bold text-lg text-slate-900 dark:text-slate-100">
                {localizeText(task.title)}
              </h3>
              <p className="text-xs text-slate-500 line-clamp-3">
                {localizeText(task.description)}
              </p>
            </div>

            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-400">
              <span className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                {formatDuration(task.estimatedDurationMinutes)} • <strong className="uppercase">{formatStatus(task.difficulty)}</strong>
              </span>

              <div className="flex items-center gap-2">
                <Button size="sm" variant="outline" onClick={() => handleOpenEdit(task)}>
                  {t('common.edit')}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setTaskToDelete({ id: task.id, title: task.title })}
                  className="text-rose-600 border-rose-200 hover:bg-rose-50 dark:border-rose-800"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>{t('common.delete')}</span>
                </Button>
              </div>
            </div>
          </Card>
          );
        })}
      </div>

      {/* Create Task Modal */}
      <Dialog
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title={t('tasks.createTask')}
        maxWidth="lg"
      >
        <form onSubmit={handleCreateTask} className="space-y-4 py-2">
          <Input
            label={t('tasks.taskTitle')}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />

          <Textarea
            label={t('tasks.description')}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            required
            rows={2}
          />

          <Textarea
            label={t('tasks.instructions')}
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            placeholder={t('tasks.instructionsPlaceholder')}
            rows={3}
          />

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <Select
              label={t('tasks.taskType')}
              value={taskType}
              onChange={(e) => setTaskType(e.target.value)}
              options={[
                { value: 'DAILY_TASK', label: t('tasks.taskTypeDaily') },
                { value: 'CHALLENGE', label: t('tasks.taskTypeChallenge') },
                { value: 'PROJECT', label: t('tasks.taskTypeProject') },
                { value: 'WEEKLY_CHALLENGE', label: t('tasks.taskTypeWeekly') }
              ]}
            />

            <Select
              label={t('tasks.difficulty')}
              value={difficulty}
              onChange={(e) => setDifficulty(e.target.value)}
              options={[
                { value: 'BEGINNER', label: t('levels.beginner') },
                { value: 'INTERMEDIATE', label: t('levels.intermediate') },
                { value: 'ADVANCED', label: t('levels.advanced') }
              ]}
            />

            <Input
              label={t('tasks.xpReward')}
              type="number"
              value={xpReward}
              onChange={(e) => setXpReward(Number(e.target.value))}
              min={5}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input
              label={t('tasks.durationMinutes')}
              type="number"
              value={estimatedDuration}
              onChange={(e) => setEstimatedDuration(Number(e.target.value))}
              min={5}
              required
            />

            <Select
              label={t('tasks.assignToGroup')}
              value={selectedGroupId}
              onChange={(e) => setSelectedGroupId(e.target.value)}
              options={[
                { value: '', label: `-- ${t('common.all')} --` },
                ...(groups || []).map((g) => ({
                  value: g.id,
                  label: g.name
                }))
              ]}
            />
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => setIsCreateModalOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" isLoading={createMutation.isPending}>
              {t('common.create')}
            </Button>
          </div>
        </form>
      </Dialog>

      {/* Edit Task Modal */}
      <Dialog
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title={t('tasks.editTask')}
        maxWidth="lg"
      >
        <form onSubmit={handleUpdateTask} className="space-y-4 py-2">
          <Input
            label={t('tasks.taskTitle')}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />

          <Textarea
            label={t('tasks.description')}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            required
            rows={2}
          />

          <Textarea
            label={t('tasks.instructions')}
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            placeholder={t('tasks.instructionsPlaceholder')}
            rows={3}
          />

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Select
              label={t('tasks.taskType')}
              value={taskType}
              onChange={(e) => setTaskType(e.target.value)}
              options={[
                { value: 'DAILY_TASK', label: t('tasks.taskTypeDaily') },
                { value: 'CHALLENGE', label: t('tasks.taskTypeChallenge') },
                { value: 'PROJECT', label: t('tasks.taskTypeProject') },
                { value: 'WEEKLY_CHALLENGE', label: t('tasks.taskTypeWeekly') }
              ]}
            />

            <Select
              label={t('tasks.difficulty')}
              value={difficulty}
              onChange={(e) => setDifficulty(e.target.value)}
              options={[
                { value: 'BEGINNER', label: t('levels.beginner') },
                { value: 'INTERMEDIATE', label: t('levels.intermediate') },
                { value: 'ADVANCED', label: t('levels.advanced') }
              ]}
            />

            <Input
              label={t('tasks.xpReward')}
              type="number"
              value={xpReward}
              onChange={(e) => setXpReward(Number(e.target.value))}
              min={5}
              required
            />

            <Input
              label={t('tasks.durationMinutes')}
              type="number"
              value={estimatedDuration}
              onChange={(e) => setEstimatedDuration(Number(e.target.value))}
              min={5}
              required
            />
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => setIsEditModalOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" isLoading={updateMutation.isPending}>
              {t('common.save')}
            </Button>
          </div>
        </form>
      </Dialog>

      {/* Delete Task Confirm Dialog */}
      <ConfirmDialog
        isOpen={Boolean(taskToDelete)}
        onClose={() => setTaskToDelete(null)}
        onConfirm={() => {
          if (taskToDelete) {
            deleteMutation.mutate(taskToDelete.id);
          }
        }}
        title={t('common.delete')}
        description={`${t('tasks.confirmDeleteTask')} "${taskToDelete?.title}"`}
        isLoading={deleteMutation.isPending}
        isDestructive={true}
      />

      {/* Bulk Delete Tasks Confirm Dialog */}
      <ConfirmDialog
        isOpen={isBulkDeleteOpen}
        onClose={() => setIsBulkDeleteOpen(false)}
        onConfirm={() => bulkDeleteMutation.mutate(Array.from(selection.selectedIds))}
        title={`حذف ${selection.selectedCount} مهمة؟`}
        description={`هل أنت متأكد من حذف ${selection.selectedCount} مهمة محددة؟ سيتم حذف المهام وتكليفاتها التابعة نهائياً.`}
        isLoading={bulkDeleteMutation.isPending}
        isDestructive={true}
      />
    </div>
  );
}
