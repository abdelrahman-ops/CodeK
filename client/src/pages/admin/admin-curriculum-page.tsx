import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api/client.js';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { BookOpen, Plus, Clock, Edit, ChevronLeft, Trash2, CheckCircle2, FileText } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/card.js';
import { Button } from '../../components/ui/button.js';
import { Input, Textarea } from '../../components/ui/input.js';
import { Select } from '../../components/ui/select.js';
import { Badge } from '../../components/ui/badge.js';
import { Dialog } from '../../components/ui/dialog.js';
import { ConfirmDialog } from '../../components/ui/confirm-dialog.js';
import { CardSkeleton } from '../../components/ui/skeleton.js';
import { RichTextEditor } from '../../components/shared/rich-text-editor.js';
import { MarkdownViewer } from '../../components/shared/markdown-viewer.js';
import { useToast } from '../../components/ui/toast.js';
import { localizeText, formatStatus, formatDuration } from '../../lib/i18n-helpers.js';

export function AdminCurriculumPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const toast = useToast();
  const queryClient = useQueryClient();

  const [isCurriculumModalOpen, setIsCurriculumModalOpen] = useState(false);
  const [isLessonModalOpen, setIsLessonModalOpen] = useState(false);

  // Curriculum Form
  const [curriculumTitle, setCurriculumTitle] = useState('');
  const [curriculumDescription, setCurriculumDescription] = useState('');
  const [curriculumType, setCurriculumType] = useState('OFFICIAL_EB');

  // Lesson Form
  const [selectedCurriculumId, setSelectedCurriculumId] = useState('');
  const [lessonTitle, setLessonTitle] = useState('');
  const [lessonDescription, setLessonDescription] = useState('');
  const [lessonDifficulty, setLessonDifficulty] = useState('BEGINNER');
  const [estimatedDuration, setEstimatedDuration] = useState(45);
  const [externalResourceUrl, setExternalResourceUrl] = useState('');
  const [externalResourceTitle, setExternalResourceTitle] = useState('');
  const [lessonContent, setLessonContent] = useState('<h2>' + t('lessons.openLesson') + '</h2><p>' + t('curriculum.subtitle') + '</p>');
  const [curriculumToDelete, setCurriculumToDelete] = useState<{ id: string; title: string } | null>(null);
  const [lessonToDelete, setLessonToDelete] = useState<{ id: string; title: string } | null>(null);

  const { data: curricula, isLoading } = useQuery({
    queryKey: ['adminCurricula'],
    queryFn: async () => (await api.curriculum.list()).data.data
  });

  const createCurriculumMutation = useMutation({
    mutationFn: async (data: any) => (await api.curriculum.create(data)).data.data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminCurricula'] });
      setIsCurriculumModalOpen(false);
      setCurriculumTitle('');
      setCurriculumDescription('');
      toast.success(t('common.success'));
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error?.message || t('common.error'));
    }
  });

  const deleteCurriculumMutation = useMutation({
    mutationFn: async (id: string) => (await api.curriculum.delete(id)).data.data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminCurricula'] });
      toast.success(t('common.success'));
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error?.message || t('common.error'));
    }
  });

  const createLessonMutation = useMutation({
    mutationFn: async (data: any) => (await api.lessons.create(data)).data.data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminCurricula'] });
      setIsLessonModalOpen(false);
      setLessonTitle('');
      setLessonDescription('');
      setExternalResourceUrl('');
      setExternalResourceTitle('');
      toast.success(t('common.success'));
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error?.message || t('common.error'));
    }
  });

  const deleteLessonMutation = useMutation({
    mutationFn: async (id: string) => (await api.lessons.delete(id)).data.data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminCurricula'] });
      toast.success(t('common.success'));
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error?.message || t('common.error'));
    }
  });

  const handleCreateCurriculum = (e: React.FormEvent) => {
    e.preventDefault();
    createCurriculumMutation.mutate({
      title: curriculumTitle,
      description: curriculumDescription || undefined,
      type: curriculumType
    });
  };

  const handleCreateLesson = (e: React.FormEvent) => {
    e.preventDefault();
    createLessonMutation.mutate({
      curriculumId: selectedCurriculumId,
      title: lessonTitle,
      description: lessonDescription || undefined,
      difficulty: lessonDifficulty,
      estimatedDurationMinutes: Number(estimatedDuration),
      externalResourceUrl: externalResourceUrl.trim() || undefined,
      externalResourceTitle: externalResourceTitle.trim() || undefined,
      content: lessonContent
    });
  };

  if (isLoading) return <CardSkeleton />;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-slate-100 flex items-center gap-2.5">
            <BookOpen className="w-7 h-7 text-brand-600 dark:text-brand-400" />
            <span>{t('curriculum.title')}</span>
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            {t('curriculum.subtitle')}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setIsCurriculumModalOpen(true)}>
            <Plus className="w-4 h-4" />
            <span>{t('curriculum.createCurriculum')}</span>
          </Button>
          <Button onClick={() => setIsLessonModalOpen(true)}>
            <Plus className="w-4 h-4" />
            <span>{t('curriculum.createLesson')}</span>
          </Button>
        </div>
      </div>

      <div className="space-y-8">
        {curricula?.map((curriculum) => (
          <div key={curriculum.id} className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50 dark:bg-slate-900/60 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800/80">
              <div>
                <div className="flex items-center gap-2.5">
                  <h2 className="text-lg sm:text-xl font-black text-slate-900 dark:text-slate-100">
                    {localizeText(curriculum.title)}
                  </h2>
                  <Badge variant="primary" size="sm">{formatStatus(curriculum.type)}</Badge>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">{localizeText(curriculum.description)}</p>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setCurriculumToDelete({ id: curriculum.id, title: curriculum.title })}
                  className="text-rose-600 border-rose-200 hover:bg-rose-50 dark:border-rose-800 dark:hover:bg-rose-950/40"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>{t('curriculum.deleteCurriculum')}</span>
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {curriculum.lessons?.map((lesson) => (
                <Card key={lesson.id} className="p-5 flex flex-col justify-between gap-4 border-slate-200/80 dark:border-slate-800/80 shadow-sm">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Badge variant="outline" size="sm">{formatStatus(lesson.difficulty)}</Badge>
                      <span className="text-xs text-slate-500 flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" />
                        {formatDuration(lesson.estimatedDurationMinutes)}
                      </span>
                    </div>

                    <h3 className="font-bold text-base text-slate-900 dark:text-slate-100">
                      {localizeText(lesson.title)}
                    </h3>
                    <p className="text-xs text-slate-500 line-clamp-2">{localizeText(lesson.description)}</p>

                    {lesson.externalResourceUrl && (
                      <div className="text-[11px] font-semibold text-brand-600 dark:text-brand-400 bg-brand-50 dark:bg-brand-950/40 px-2.5 py-1 rounded-lg w-fit truncate max-w-full">
                        {t('lessons.externalPresentation')}: {localizeText(lesson.externalResourceTitle) || lesson.externalResourceUrl}
                      </div>
                    )}
                  </div>

                  <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setLessonToDelete({ id: lesson.id, title: lesson.title })}
                      className="text-rose-600 border-rose-200 hover:bg-rose-50 dark:border-rose-800"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>

                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => navigate(`/admin/lessons/${lesson.id}/edit`)}
                    >
                      <Edit className="w-3.5 h-3.5" />
                      <span>{t('curriculum.editLesson')}</span>
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* New Curriculum Modal */}
      <Dialog
        isOpen={isCurriculumModalOpen}
        onClose={() => setIsCurriculumModalOpen(false)}
        title={t('curriculum.createCurriculum')}
        maxWidth="md"
      >
        <form onSubmit={handleCreateCurriculum} className="space-y-4 py-2">
          <Input
            label={t('curriculum.curriculumTitle')}
            value={curriculumTitle}
            onChange={(e) => setCurriculumTitle(e.target.value)}
            required
          />
          <Input
            label={t('tasks.shortDescription')}
            value={curriculumDescription}
            onChange={(e) => setCurriculumDescription(e.target.value)}
          />
          <Select
            label={t('curriculum.track')}
            value={curriculumType}
            onChange={(e) => setCurriculumType(e.target.value)}
            options={[
              { value: 'OFFICIAL_EB', label: formatStatus('OFFICIAL_EB') },
              { value: 'ACADEMY', label: formatStatus('ACADEMY') }
            ]}
          />
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => setIsCurriculumModalOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" isLoading={createCurriculumMutation.isPending}>
              {t('curriculum.createCurriculum')}
            </Button>
          </div>
        </form>
      </Dialog>

      {/* New Lesson Modal */}
      <Dialog
        isOpen={isLessonModalOpen}
        onClose={() => setIsLessonModalOpen(false)}
        title={t('curriculum.createLesson')}
        maxWidth="lg"
      >
        <form onSubmit={handleCreateLesson} className="space-y-4 py-2">
          <Select
            label={t('curriculum.title')}
            value={selectedCurriculumId}
            onChange={(e) => setSelectedCurriculumId(e.target.value)}
            options={[
              { value: '', label: t('curriculum.title') },
              ...(curricula?.map((c) => ({ value: c.id, label: localizeText(c.title) })) || [])
            ]}
            required
          />
          <Input
            label={t('curriculum.lessonTitle')}
            value={lessonTitle}
            onChange={(e) => setLessonTitle(e.target.value)}
            required
          />
          <Input
            label={t('tasks.shortDescription')}
            value={lessonDescription}
            onChange={(e) => setLessonDescription(e.target.value)}
          />
          <div className="grid grid-cols-2 gap-3">
            <Select
              label={t('tasks.difficulty')}
              value={lessonDifficulty}
              onChange={(e) => setLessonDifficulty(e.target.value)}
              options={[
                { value: 'BEGINNER', label: formatStatus('BEGINNER') },
                { value: 'INTERMEDIATE', label: formatStatus('INTERMEDIATE') },
                { value: 'ADVANCED', label: formatStatus('ADVANCED') }
              ]}
            />
            <Input
              label={t('curriculum.estimatedDuration')}
              type="number"
              value={estimatedDuration}
              onChange={(e) => setEstimatedDuration(Number(e.target.value))}
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 rounded-2xl bg-brand-50/50 dark:bg-brand-950/20 border border-brand-200/60 dark:border-brand-800/40">
            <Input
              label={t('curriculum.externalResourceUrl')}
              placeholder="https://www.canva.com/..."
              value={externalResourceUrl}
              onChange={(e) => setExternalResourceUrl(e.target.value)}
            />
            <Input
              label={t('curriculum.externalResourceTitle')}
              placeholder={t('lessons.externalPresentation')}
              value={externalResourceTitle}
              onChange={(e) => setExternalResourceTitle(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
              {t('curriculum.lessonContent')}
            </label>
            <RichTextEditor
              content={lessonContent}
              onChange={setLessonContent}
              minHeight="180px"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => setIsLessonModalOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" isLoading={createLessonMutation.isPending} disabled={!selectedCurriculumId}>
              {t('curriculum.createLesson')}
            </Button>
          </div>
        </form>
      </Dialog>

      {/* Confirm Delete Curriculum Dialog */}
      <ConfirmDialog
        isOpen={Boolean(curriculumToDelete)}
        onClose={() => setCurriculumToDelete(null)}
        onConfirm={() => {
          if (curriculumToDelete) {
            deleteCurriculumMutation.mutate(curriculumToDelete.id, {
              onSuccess: () => setCurriculumToDelete(null)
            });
          }
        }}
        title={t('curriculum.deleteCurriculum')}
        description={`${t('curriculum.confirmDelete')} "${curriculumToDelete?.title}"`}
        isLoading={deleteCurriculumMutation.isPending}
        isDestructive={true}
      />

      {/* Confirm Delete Lesson Dialog */}
      <ConfirmDialog
        isOpen={Boolean(lessonToDelete)}
        onClose={() => setLessonToDelete(null)}
        onConfirm={() => {
          if (lessonToDelete) {
            deleteLessonMutation.mutate(lessonToDelete.id, {
              onSuccess: () => setLessonToDelete(null)
            });
          }
        }}
        title={t('curriculum.deleteLesson')}
        description={`${t('curriculum.confirmDeleteLesson')} "${lessonToDelete?.title}"`}
        isLoading={deleteLessonMutation.isPending}
        isDestructive={true}
      />
    </div>
  );
}

export function AdminLessonEditorPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const toast = useToast();
  const queryClient = useQueryClient();

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [description, setDescription] = useState('');
  const [externalResourceUrl, setExternalResourceUrl] = useState('');
  const [externalResourceTitle, setExternalResourceTitle] = useState('');

  const { data: lesson, isLoading } = useQuery({
    queryKey: ['adminLesson', id],
    queryFn: async () => {
      if (!id) throw new Error('No id');
      const res = (await api.lessons.getById(id)).data.data;
      setTitle(res.title);
      setContent(res.content || '');
      setDescription(res.description || '');
      setExternalResourceUrl(res.externalResourceUrl || '');
      setExternalResourceTitle(res.externalResourceTitle || '');
      return res;
    },
    enabled: Boolean(id)
  });

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!id) return;
      return (await api.lessons.update(id, {
        title,
        content,
        description,
        externalResourceUrl: externalResourceUrl.trim() || undefined,
        externalResourceTitle: externalResourceTitle.trim() || undefined
      })).data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminLesson', id] });
      toast.success(t('common.success'));
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error?.message || t('common.error'));
    }
  });

  if (isLoading) return <CardSkeleton />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate('/admin/curriculum')}
          className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
        >
          <ChevronLeft className="w-4 h-4 rtl:rotate-180" />
          <span>{t('curriculum.title')}</span>
        </button>

        <Button onClick={() => updateMutation.mutate()} isLoading={updateMutation.isPending}>
          <CheckCircle2 className="w-4 h-4" />
          <span>{t('curriculum.saveContent')}</span>
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Rich Text Editor */}
        <Card className="p-6 space-y-4 border-slate-200/80 dark:border-slate-800/80 shadow-sm">
          <Input
            label={t('curriculum.lessonTitle')}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />
          <Input
            label={t('tasks.shortDescription')}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 rounded-2xl bg-brand-50/50 dark:bg-brand-950/20 border border-brand-200/60 dark:border-brand-800/40">
            <Input
              label={t('curriculum.externalResourceUrl')}
              placeholder="https://www.canva.com/..."
              value={externalResourceUrl}
              onChange={(e) => setExternalResourceUrl(e.target.value)}
            />
            <Input
              label={t('curriculum.externalResourceTitle')}
              placeholder={t('lessons.externalPresentation')}
              value={externalResourceTitle}
              onChange={(e) => setExternalResourceTitle(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
              {t('curriculum.lessonContent')}
            </label>
            <RichTextEditor
              content={content}
              onChange={setContent}
              minHeight="350px"
            />
          </div>
        </Card>

        {/* Live Student Preview */}
        <Card className="p-6 space-y-4 overflow-y-auto max-h-[720px] border-slate-200/80 dark:border-slate-800/80 shadow-sm">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100 dark:border-slate-800 pb-2 flex items-center gap-1.5">
            <FileText className="w-4 h-4" />
            <span>{t('lessons.openLesson')}</span>
          </div>
          <MarkdownViewer content={content} />
        </Card>
      </div>
    </div>
  );
}
