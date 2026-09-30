import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api/client.js';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { GraduationCap, Plus, Clock, HelpCircle, ChevronLeft, Trash2, Eye, ToggleLeft, ToggleRight, Users, CheckCircle2, Check, X } from 'lucide-react';
import { Card } from '../../components/ui/card.js';
import { Button } from '../../components/ui/button.js';
import { Input } from '../../components/ui/input.js';
import { Select } from '../../components/ui/select.js';
import { Badge } from '../../components/ui/badge.js';
import { Dialog } from '../../components/ui/dialog.js';
import { ConfirmDialog } from '../../components/ui/confirm-dialog.js';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../components/ui/table.js';
import { CardSkeleton } from '../../components/ui/skeleton.js';
import { useToast } from '../../components/ui/toast.js';
import { localizeText, formatStatus, formatMarks, formatDuration, formatXp, formatDate } from '../../lib/i18n-helpers.js';
import { useBulkSelection } from '../../hooks/use-bulk-selection.js';
import { BulkSelectionBar } from '../../components/shared/bulk-selection-bar.js';

export function AdminExamsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const toast = useToast();
  const queryClient = useQueryClient();

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [attemptsExamId, setAttemptsExamId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [durationMinutes, setDurationMinutes] = useState(45);
  const [totalMarks, setTotalMarks] = useState(100);
  const [xpReward, setXpReward] = useState(100);
  const [startsAt, setStartsAt] = useState(new Date().toISOString().slice(0, 16));
  const [endsAt, setEndsAt] = useState(new Date(Date.now() + 86400000 * 7).toISOString().slice(0, 16));
  const [examToDelete, setExamToDelete] = useState<{ id: string; title: string } | null>(null);
  const [isBulkDeleteOpen, setIsBulkDeleteOpen] = useState(false);

  const { data: exams, isLoading } = useQuery({
    queryKey: ['adminExams'],
    queryFn: async () => (await api.exams.list()).data.data
  });

  const selection = useBulkSelection(exams || []);

  const bulkPublishMutation = useMutation({
    mutationFn: async ({ ids, isPublished }: { ids: string[]; isPublished: boolean }) =>
      (await api.exams.bulkPublish(ids, isPublished)).data.data,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['adminExams'] });
      selection.deselectAll();
      toast.success(t('common.success'));
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error?.message || t('common.error'));
    }
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: async (ids: string[]) => (await api.exams.bulkDelete(ids)).data.data,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['adminExams'] });
      selection.deselectAll();
      setIsBulkDeleteOpen(false);
      toast.success(t('common.success'));
      if (data.failed && data.failed.length > 0) {
        toast.error(
          `تعذر حذف ${data.failed.length} اختبار نظراً لوجود محاولات طلاب مسجلة.`
        );
      }
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error?.message || t('common.error'));
    }
  });

  const { data: attemptsData, isLoading: isAttemptsLoading } = useQuery({
    queryKey: ['adminExamAttempts', attemptsExamId],
    queryFn: async () => {
      if (!attemptsExamId) return null;
      return (await api.exams.getAttempts(attemptsExamId)).data.data;
    },
    enabled: Boolean(attemptsExamId)
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => (await api.exams.create(data)).data.data,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['adminExams'] });
      setIsCreateModalOpen(false);
      toast.success(t('common.success'));
      navigate(`/admin/exams/${data.id}/builder`);
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error?.message || t('common.error'));
    }
  });

  const deleteExamMutation = useMutation({
    mutationFn: async (id: string) => (await api.exams.delete(id)).data.data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminExams'] });
      toast.success(t('common.success'));
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error?.message || t('common.error'));
    }
  });

  const togglePublishMutation = useMutation({
    mutationFn: async ({ id, isPublished }: { id: string; isPublished: boolean }) =>
      (await api.exams.update(id, { isPublished })).data.data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminExams'] });
      toast.success(t('common.success'));
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error?.message || t('common.error'));
    }
  });

  const handleCreateExam = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate({
      title,
      description: description || undefined,
      durationMinutes: Number(durationMinutes),
      totalMarks: Number(totalMarks),
      xpReward: Number(xpReward),
      startsAt: new Date(startsAt).toISOString(),
      endsAt: new Date(endsAt).toISOString(),
      isPublished: true
    });
  };

  if (isLoading) return <CardSkeleton />;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2.5">
            <GraduationCap className="w-7 h-7 text-brand-600 dark:text-brand-400" />
            <span>{t('nav.exams')}</span>
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            {t('exams.subtitle')}
          </p>
        </div>

        <Button onClick={() => setIsCreateModalOpen(true)}>
          <Plus className="w-4 h-4" />
          <span>{t('exams.createExam')}</span>
        </Button>
      </div>

      {/* Bulk Action Toolbar */}
      <BulkSelectionBar
        totalItems={exams?.length || 0}
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
        {exams?.map((exam) => {
          const isSelected = selection.isSelected(exam.id);
          return (
            <Card
              key={exam.id}
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
                      onChange={() => selection.toggle(exam.id)}
                      onClick={(e) => e.stopPropagation()}
                      className="w-4 h-4 rounded text-brand-600 focus:ring-brand-500 border-slate-300 dark:border-slate-600 cursor-pointer accent-brand-600"
                    />
                    <Badge variant={exam.isPublished ? 'success' : 'secondary'}>
                      {exam.isPublished ? t('exams.published') : t('exams.draft')}
                    </Badge>
                  </div>
                  <span className="text-xs font-bold text-amber-600 dark:text-amber-400">
                    {formatXp(exam.xpReward)}
                  </span>
                </div>

              <h3 className="font-bold text-lg text-slate-900 dark:text-slate-100">
                {localizeText(exam.title)}
              </h3>
              <p className="text-xs text-slate-500 line-clamp-2">{localizeText(exam.description)}</p>
            </div>

            <div className="pt-3 border-t border-slate-100 dark:border-slate-800/80 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <span className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" />
                  {formatDuration(exam.durationMinutes)}
                </span>
                <span>•</span>
                <span>{formatMarks(exam.totalMarks)}</span>
              </div>

              <div className="flex items-center gap-1.5">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => togglePublishMutation.mutate({ id: exam.id, isPublished: !exam.isPublished })}
                  title={exam.isPublished ? t('exams.draft') : t('exams.published')}
                >
                  <span className={`text-xs font-semibold ${exam.isPublished ? 'text-emerald-600' : 'text-slate-400'}`}>
                    {exam.isPublished ? t('exams.published') : t('exams.draft')}
                  </span>
                </Button>

                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setAttemptsExamId(exam.id)}
                >
                  <Users className="w-3.5 h-3.5" />
                  <span>{t('exams.viewResults')}</span>
                </Button>

                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => navigate(`/admin/exams/${exam.id}/builder`)}
                >
                  <span>{t('exams.questions')}</span>
                </Button>

                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setExamToDelete({ id: exam.id, title: exam.title })}
                  className="text-rose-600 border-rose-200 hover:bg-rose-50 dark:border-rose-800"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          </Card>
          );
        })}
      </div>

      {/* Delete Exam Confirm Dialog */}
      <ConfirmDialog
        isOpen={Boolean(examToDelete)}
        onClose={() => setExamToDelete(null)}
        onConfirm={() => {
          if (examToDelete) {
            deleteExamMutation.mutate(examToDelete.id, {
              onSuccess: () => setExamToDelete(null)
            });
          }
        }}
        title={t('exams.deleteExam')}
        description={`${t('exams.confirmDeleteExam')} "${examToDelete?.title}"`}
        isLoading={deleteExamMutation.isPending}
        isDestructive={true}
      />

      {/* Bulk Delete Exams Confirm Dialog */}
      <ConfirmDialog
        isOpen={isBulkDeleteOpen}
        onClose={() => setIsBulkDeleteOpen(false)}
        onConfirm={() => bulkDeleteMutation.mutate(Array.from(selection.selectedIds))}
        title={`حذف ${selection.selectedCount} اختبار؟`}
        description={`هل أنت متأكد من حذف ${selection.selectedCount} اختبار محدد؟ الاختبارات التي تحتوي على محاولات طلاب مسجلة ستتم حمايتها ولن يتم حذفها للحفاظ على سجلات الطلاب.`}
        isLoading={bulkDeleteMutation.isPending}
        isDestructive={true}
      />

      {/* Create Exam Modal */}
      <Dialog
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title={t('exams.createExam')}
        maxWidth="md"
      >
        <form onSubmit={handleCreateExam} className="space-y-4 py-2">
          <Input
            label={t('exams.examTitle')}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />

          <Input
            label={t('tasks.shortDescription')}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />

          <div className="grid grid-cols-3 gap-3">
            <Input
              label={t('curriculum.estimatedDuration')}
              type="number"
              value={durationMinutes}
              onChange={(e) => setDurationMinutes(Number(e.target.value))}
              required
            />
            <Input
              label={t('exams.totalMarks')}
              type="number"
              value={totalMarks}
              onChange={(e) => setTotalMarks(Number(e.target.value))}
              required
            />
            <Input
              label={t('tasks.xpReward')}
              type="number"
              value={xpReward}
              onChange={(e) => setXpReward(Number(e.target.value))}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input
              label={t('exams.startsAt')}
              type="datetime-local"
              value={startsAt}
              onChange={(e) => setStartsAt(e.target.value)}
              required
            />
            <Input
              label={t('exams.endsAt')}
              type="datetime-local"
              value={endsAt}
              onChange={(e) => setEndsAt(e.target.value)}
              required
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => setIsCreateModalOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" isLoading={createMutation.isPending}>
              {t('exams.createExam')}
            </Button>
          </div>
        </form>
      </Dialog>

      {/* View Exam Attempt Results Dialog */}
      <Dialog
        isOpen={Boolean(attemptsExamId)}
        onClose={() => setAttemptsExamId(null)}
        title={t('exams.viewResults')}
        maxWidth="lg"
      >
        <div className="space-y-4 py-2">
          {isAttemptsLoading ? (
            <div className="py-8 text-center text-xs text-slate-400">{t('common.loading')}</div>
          ) : !attemptsData || attemptsData.attempts.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-400">{t('common.noData')}</div>
          ) : (
            <div className="space-y-4">
              <div className="p-3.5 rounded-2xl bg-brand-50/60 dark:bg-brand-950/40 border border-brand-200/60 dark:border-brand-800/40 flex items-center justify-between text-xs font-bold">
                <span>{t('exams.attempts')}: {attemptsData.attempts.length}</span>
                <span className="text-brand-600 dark:text-brand-400">
                  {t('exams.passingThreshold')}: 60%
                </span>
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('roles.student')}</TableHead>
                    <TableHead>{t('exams.score')}</TableHead>
                    <TableHead>{t('exams.percentage')}</TableHead>
                    <TableHead>{t('common.date')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {attemptsData.attempts.map((att: any) => {
                    const stuUser = att.student?.user;
                    const pct = att.percentage ?? Math.round((att.score / (attemptsData.totalMarks || 100)) * 100);
                    const isPassed = pct >= 60;

                    return (
                      <TableRow key={att.id}>
                        <TableCell>
                          <div className="font-bold text-sm text-slate-900 dark:text-slate-100">
                            {stuUser?.firstName} {stuUser?.lastName}
                          </div>
                          <div className="text-xs text-slate-400 font-mono">
                            {att.student?.studentCode}
                          </div>
                        </TableCell>

                        <TableCell>
                          <span className="font-bold text-sm text-slate-800 dark:text-slate-200">
                            {att.score} / {attemptsData.totalMarks}
                          </span>
                        </TableCell>

                        <TableCell>
                          <Badge variant={isPassed ? 'success' : 'danger'}>
                            {pct}% ({isPassed ? t('exams.passed') : t('exams.failed')})
                          </Badge>
                        </TableCell>

                        <TableCell>
                          <span className="text-xs text-slate-500">
                            {formatDate(att.submittedAt)}
                          </span>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}

          <div className="flex justify-end pt-2">
            <Button variant="ghost" onClick={() => setAttemptsExamId(null)}>
              {t('common.close')}
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}

export function AdminExamBuilderPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const toast = useToast();
  const queryClient = useQueryClient();

  const [isQuestionModalOpen, setIsQuestionModalOpen] = useState(false);
  const [questionText, setQuestionText] = useState('');
  const [questionType, setQuestionType] = useState('MULTIPLE_CHOICE');
  const [marks, setMarks] = useState(25);
  const [optA, setOptA] = useState('');
  const [optB, setOptB] = useState('');
  const [optC, setOptC] = useState('');
  const [optD, setOptD] = useState('');
  const [correctAnswer, setCorrectAnswer] = useState('');

  const { data: exam, isLoading } = useQuery({
    queryKey: ['adminExamDetail', id],
    queryFn: async () => {
      if (!id) throw new Error('No id');
      return (await api.exams.getById(id)).data.data;
    },
    enabled: Boolean(id)
  });

  const addQuestionMutation = useMutation({
    mutationFn: async (data: any) => {
      if (!id) return;
      return (await api.exams.addQuestion(id, data)).data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminExamDetail', id] });
      setIsQuestionModalOpen(false);
      setQuestionText('');
      setOptA('');
      setOptB('');
      setOptC('');
      setOptD('');
      setCorrectAnswer('');
      toast.success(t('common.success'));
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error?.message || t('common.error'));
    }
  });

  const deleteQuestionMutation = useMutation({
    mutationFn: async (questionId: string) => {
      if (!id) return;
      return (await api.exams.deleteQuestion(id, questionId)).data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminExamDetail', id] });
      toast.success(t('common.success'));
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error?.message || t('common.error'));
    }
  });

  const handleAddQuestion = (e: React.FormEvent) => {
    e.preventDefault();
    const options = questionType === 'MULTIPLE_CHOICE' ? [optA, optB, optC, optD].filter(Boolean) : undefined;
    addQuestionMutation.mutate({
      questionText,
      questionType,
      options,
      correctAnswer,
      marks: Number(marks)
    });
  };

  const [questionToDelete, setQuestionToDelete] = useState<string | null>(null);

  if (isLoading) return <CardSkeleton />;

  const questions = exam?.questions || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate('/admin/exams')}
          className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
        >
          <ChevronLeft className="w-4 h-4 rtl:rotate-180" />
          <span>{t('nav.exams')}</span>
        </button>

        <Button onClick={() => setIsQuestionModalOpen(true)}>
          <Plus className="w-4 h-4" />
          <span>{t('exams.addQuestion')}</span>
        </Button>
      </div>

      <Card className="p-6">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">{exam?.title ? localizeText(exam.title) : ''}</h1>
        <p className="text-xs text-slate-500 mt-1">
          {questions.length} {t('exams.questions')} • {formatDuration(exam?.durationMinutes)} • {formatMarks(exam?.totalMarks)}
        </p>
      </Card>

      {/* Questions List */}
      <div className="space-y-4">
        {questions.map((q, idx) => (
          <Card key={q.id} className="p-6 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-400">{t('exams.question')} {idx + 1} ({formatMarks(q.marks)})</span>
              <div className="flex items-center gap-2">
                <Badge variant="primary" size="sm">{formatStatus(q.questionType)}</Badge>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setQuestionToDelete(q.id)}
                  className="text-rose-600 border-rose-200 hover:bg-rose-50 dark:border-rose-800"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>

            <h3 className="font-bold text-base text-slate-900 dark:text-slate-100">{localizeText(q.questionText)}</h3>

            {(() => {
              let parsedOptions: string[] = [];
              if (Array.isArray(q.options)) {
                parsedOptions = q.options;
              } else if (typeof q.options === 'string') {
                try {
                  const parsed = JSON.parse(q.options);
                  if (Array.isArray(parsed)) parsedOptions = parsed;
                } catch {
                  parsedOptions = [];
                }
              }
              if (parsedOptions.length === 0) return null;
              return (
                <div className="grid grid-cols-2 gap-2 text-xs">
                  {parsedOptions.map((opt, oIdx) => (
                    <div
                      key={oIdx}
                      className={`p-2.5 rounded-xl border font-semibold ${opt === q.correctAnswer ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-400 text-emerald-800 dark:text-emerald-200' : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700'}`}
                    >
                      {String.fromCharCode(65 + oIdx)}. {opt} {opt === q.correctAnswer ? `(${t('exams.correctAnswer')})` : ''}
                    </div>
                  ))}
                </div>
              );
            })()}
          </Card>
        ))}
      </div>

      {/* Add Question Dialog */}
      <Dialog
        isOpen={isQuestionModalOpen}
        onClose={() => setIsQuestionModalOpen(false)}
        title={t('exams.addQuestion')}
        maxWidth="md"
      >
        <form onSubmit={handleAddQuestion} className="space-y-4 py-2">
          <Input
            label={t('exams.questionText')}
            value={questionText}
            onChange={(e) => setQuestionText(e.target.value)}
            required
          />

          <div className="grid grid-cols-2 gap-3">
            <Select
              label={t('exams.questionType')}
              value={questionType}
              onChange={(e) => setQuestionType(e.target.value)}
              options={[
                { value: 'MULTIPLE_CHOICE', label: formatStatus('MULTIPLE_CHOICE') },
                { value: 'SHORT_ANSWER', label: formatStatus('SHORT_ANSWER') }
              ]}
            />

            <Input
              label={t('exams.marks')}
              type="number"
              value={marks}
              onChange={(e) => setMarks(Number(e.target.value))}
              required
            />
          </div>

          {questionType === 'MULTIPLE_CHOICE' && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <Input label={`${t('exams.options')} A`} value={optA} onChange={(e) => setOptA(e.target.value)} required />
                <Input label={`${t('exams.options')} B`} value={optB} onChange={(e) => setOptB(e.target.value)} required />
                <Input label={`${t('exams.options')} C`} value={optC} onChange={(e) => setOptC(e.target.value)} required />
                <Input label={`${t('exams.options')} D`} value={optD} onChange={(e) => setOptD(e.target.value)} required />
              </div>

              <Input
                label={t('exams.correctAnswer')}
                value={correctAnswer}
                onChange={(e) => setCorrectAnswer(e.target.value)}
                required
              />
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => setIsQuestionModalOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" isLoading={addQuestionMutation.isPending}>
              {t('common.save')}
            </Button>
          </div>
        </form>
      </Dialog>

      {/* Confirm Delete Question Dialog */}
      <ConfirmDialog
        isOpen={Boolean(questionToDelete)}
        onClose={() => setQuestionToDelete(null)}
        onConfirm={() => {
          if (questionToDelete) {
            deleteQuestionMutation.mutate(questionToDelete, {
              onSuccess: () => setQuestionToDelete(null)
            });
          }
        }}
        title={t('exams.deleteQuestion')}
        description={t('exams.confirmDeleteQuestion')}
        isLoading={deleteQuestionMutation.isPending}
        isDestructive={true}
      />
    </div>
  );
}
