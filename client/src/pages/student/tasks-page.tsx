import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api/client.js';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  CheckSquare,
  Clock,
  ArrowRight,
  ChevronLeft,
  Send,
  Github,
  Link as LinkIcon,
  Code2,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { Card } from '../../components/ui/card.js';
import { Button } from '../../components/ui/button.js';
import { Badge } from '../../components/ui/badge.js';
import { Textarea, Input } from '../../components/ui/input.js';
import { CardSkeleton } from '../../components/ui/skeleton.js';
import { useToast } from '../../components/ui/toast.js';
import { CelebrationModal } from '../../components/shared/celebration-modal.js';
import { Task } from '../../types/api.js';
import { localizeText, formatStatus, formatDuration, formatXp } from '../../lib/i18n-helpers.js';

export function TasksPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const { data: tasks, isLoading } = useQuery<Task[]>({
    queryKey: ['studentTasks'],
    queryFn: async () => (await api.tasks.list()).data.data
  });

  if (isLoading) return <CardSkeleton />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-slate-100">
          {t('tasks.title')}
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          {t('tasks.subtitle')}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {tasks?.map((task) => {
          const submission = task.mySubmission;
          const isApproved = submission?.status === 'APPROVED';

          return (
            <Card
              key={task.id}
              className={`p-5 flex flex-col justify-between gap-4 transition hover:border-brand-300 dark:hover:border-brand-700 ${isApproved ? 'border-emerald-300 dark:border-emerald-900/60 bg-emerald-50/10' : ''}`}
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Badge
                    variant={
                      isApproved
                        ? 'success'
                        : submission?.status === 'PENDING'
                        ? 'warning'
                        : submission?.status === 'NEEDS_REVISION'
                        ? 'danger'
                        : 'outline'
                    }
                    size="sm"
                  >
                    {submission ? formatStatus(submission.status) : t('common.notSubmitted')}
                  </Badge>
                  <span className="text-xs font-bold text-brand-600 dark:text-brand-400">
                    {formatXp(task.xpReward)}
                  </span>
                </div>

                <h3 className="font-bold text-base text-slate-900 dark:text-slate-100">
                  {localizeText(task.title)}
                </h3>
                <p className="text-xs text-slate-500 line-clamp-2">{localizeText(task.description)}</p>
              </div>

              <div className="pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" />
                    {formatDuration(task.estimatedDurationMinutes)}
                  </span>
                  <span>•</span>
                  <span>{formatStatus(task.difficulty)}</span>
                </div>

                <Button size="sm" onClick={() => navigate(`/student/tasks/${task.id}`)}>
                  <span>{submission ? t('common.viewSolution') : t('common.solveTask')}</span>
                  <ArrowRight className="w-4 h-4 rtl:rotate-180" />
                </Button>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

export function TaskViewPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const toast = useToast();

  const [content, setContent] = useState('');
  const [githubUrl, setGithubUrl] = useState('');
  const [fileUrl, setFileUrl] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [celebration, setCelebration] = useState<{ isOpen: boolean; title: string; subtitle?: string; xp?: number } | null>(null);

  const { data: task, isLoading, refetch } = useQuery<Task>({
    queryKey: ['task', id],
    queryFn: async () => {
      if (!id) throw new Error('No id');
      return (await api.tasks.getById(id)).data.data;
    },
    enabled: Boolean(id)
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || (!content.trim() && !githubUrl.trim() && !fileUrl.trim())) {
      toast.error(t('tasks.textCodeAnswer') + ' - ' + t('common.error'));
      return;
    }

    setIsSubmitting(true);
    try {
      await api.submissions.submit({
        taskId: id,
        content: content.trim() || undefined,
        githubUrl: githubUrl.trim() || undefined,
        fileUrl: fileUrl.trim() || undefined
      });
      toast.success(t('tasks.submitted') + ' - ' + t('common.success'));
      await refetch();
    } catch (err: any) {
      toast.error(err.response?.data?.error?.message || t('common.error'));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) return <CardSkeleton />;

  if (!task) return <div className="p-8 text-center text-slate-500">{t('common.noData')}</div>;

  const submission = task.mySubmission;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <button
        onClick={() => navigate('/student/tasks')}
        className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
      >
        <ChevronLeft className="w-4 h-4 rtl:rotate-180" />
        <span>{t('tasks.title')}</span>
      </button>

      {/* Task Header Card */}
      <Card className="p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Badge variant="primary">{formatStatus(task.taskType)}</Badge>
          <div className="flex items-center gap-3 text-xs">
            <span className="font-bold text-amber-600 dark:text-amber-400">{formatXp(task.xpReward)}</span>
            <span>•</span>
            <span className="text-slate-500">{formatDuration(task.estimatedDurationMinutes)}</span>
            <span>•</span>
            <span className="uppercase font-semibold text-slate-500">{formatStatus(task.difficulty)}</span>
          </div>
        </div>

        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-slate-100">{localizeText(task.title)}</h1>
          <p className="text-sm text-slate-600 dark:text-slate-300 mt-2 leading-relaxed">
            {localizeText(task.description)}
          </p>
        </div>

        {task.instructions && (
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 space-y-1 text-xs sm:text-sm">
            <div className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
              <Code2 className="w-4 h-4 text-brand-500" />
              <span>{t('tasks.instructions')}</span>
            </div>
            <p className="text-slate-600 dark:text-slate-300 whitespace-pre-wrap">{localizeText(task.instructions)}</p>
          </div>
        )}
      </Card>

      {/* Submission Status or Submission Form */}
      {submission ? (
        <Card className="p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
            <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
              {t('tasks.submitted')}
            </h3>
            <Badge
              variant={
                submission.status === 'APPROVED'
                  ? 'success'
                  : submission.status === 'PENDING'
                  ? 'warning'
                  : 'danger'
              }
            >
              {formatStatus(submission.status)}
            </Badge>
          </div>

          {submission.content && (
            <div className="space-y-1">
              <span className="text-xs font-semibold text-slate-500">{t('tasks.textCodeAnswer')}:</span>
              <pre className="p-4 rounded-2xl bg-slate-950 text-slate-100 font-mono text-xs overflow-x-auto">
                <code>{submission.content}</code>
              </pre>
            </div>
          )}

          {submission.githubUrl && (
            <div className="flex items-center gap-2 text-xs">
              <Github className="w-4 h-4 text-slate-500" />
              <a href={submission.githubUrl} target="_blank" rel="noreferrer" className="text-brand-600 dark:text-brand-400 font-mono underline">
                {submission.githubUrl}
              </a>
            </div>
          )}

          {submission.feedback && (
            <div className="p-4 rounded-2xl bg-brand-50/50 dark:bg-brand-950/30 border border-brand-200 dark:border-brand-800 space-y-1">
              <span className="text-xs font-bold text-brand-900 dark:text-brand-300">
                {t('tasks.feedback')}:
              </span>
              <p className="text-sm text-slate-700 dark:text-slate-300">{submission.feedback}</p>
            </div>
          )}
        </Card>
      ) : (
        <Card className="p-6 space-y-4">
          <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
            {t('tasks.submitSolution')}
          </h3>

          <form onSubmit={handleSubmit} className="space-y-4">
            <Textarea
              label={t('tasks.textCodeAnswer')}
              placeholder={t('common.pasteCodeHere')}
              rows={6}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              disabled={isSubmitting}
            />

            <Input
              label={t('tasks.githubUrl')}
              placeholder="https://github.com/username/project"
              value={githubUrl}
              onChange={(e) => setGithubUrl(e.target.value)}
              leftIcon={<Github className="w-4 h-4" />}
              disabled={isSubmitting}
            />

            <Input
              label={t('tasks.fileUrl')}
              placeholder="https://drive.google.com/..."
              value={fileUrl}
              onChange={(e) => setFileUrl(e.target.value)}
              leftIcon={<LinkIcon className="w-4 h-4" />}
              disabled={isSubmitting}
            />

            <Button type="submit" size="lg" className="w-full" isLoading={isSubmitting}>
              <Send className="w-4 h-4" />
              <span>{t('tasks.submitSolution')}</span>
            </Button>
          </form>
        </Card>
      )}

      {celebration && (
        <CelebrationModal
          isOpen={celebration.isOpen}
          onClose={() => setCelebration(null)}
          title={celebration.title}
          subtitle={celebration.subtitle}
          xpEarned={celebration.xp}
        />
      )}
    </div>
  );
}
