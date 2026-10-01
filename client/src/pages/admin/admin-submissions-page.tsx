import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api/client.js';
import { useTranslation } from 'react-i18next';
import { FileCheck2, Check, X, Github, ExternalLink } from 'lucide-react';
import { Card } from '../../components/ui/card.js';
import { Button } from '../../components/ui/button.js';
import { Badge } from '../../components/ui/badge.js';
import { Textarea } from '../../components/ui/input.js';
import { Avatar } from '../../components/ui/avatar.js';
import { Dialog } from '../../components/ui/dialog.js';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../components/ui/table.js';
import { TableSkeleton } from '../../components/ui/skeleton.js';
import { useToast } from '../../components/ui/toast.js';
import { Submission } from '../../types/api.js';
import { localizeText, formatStatus, formatDate } from '../../lib/i18n-helpers.js';

export function AdminSubmissionsPage() {
  const { t } = useTranslation();
  const toast = useToast();
  const queryClient = useQueryClient();

  const [selectedSubmission, setSelectedSubmission] = useState<Submission | null>(null);
  const [feedback, setFeedback] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('PENDING');

  const { data: submissions, isLoading } = useQuery<Submission[]>({
    queryKey: ['adminSubmissions', filterStatus],
    queryFn: async () => (await api.submissions.list({ status: filterStatus || undefined })).data.data
  });

  const reviewMutation = useMutation({
    mutationFn: async (data: { id: string; status: string; feedback?: string }) =>
      (await api.submissions.review(data.id, { status: data.status, feedback: data.feedback })).data.data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminSubmissions'] });
      queryClient.invalidateQueries({ queryKey: ['adminDashboard'] });
      setSelectedSubmission(null);
      setFeedback('');
      toast.success(t('common.success'));
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error?.message || t('common.error'));
    }
  });

  const handleReview = (status: 'APPROVED' | 'NEEDS_REVISION') => {
    if (!selectedSubmission) return;
    reviewMutation.mutate({
      id: selectedSubmission.id,
      status,
      feedback: feedback.trim() || undefined
    });
  };

  if (isLoading) return <TableSkeleton rows={6} />;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-slate-100">
            {t('nav.submissions')}
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            {t('tasks.subtitle')}
          </p>
        </div>

        {/* Filter Buttons */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-200/60 dark:bg-slate-800/60 rounded-xl">
          {['PENDING', 'APPROVED', 'NEEDS_REVISION', ''].map((st) => (
            <button
              key={st}
              onClick={() => setFilterStatus(st)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${filterStatus === st ? 'bg-white dark:bg-slate-900 text-brand-600 dark:text-brand-400 shadow-sm' : 'text-slate-600 dark:text-slate-400'}`}
            >
              {st ? formatStatus(st) : t('common.all')}
            </button>
          ))}
        </div>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t('roles.student')}</TableHead>
            <TableHead>{t('tasks.taskTitle')}</TableHead>
            <TableHead>{t('common.date')}</TableHead>
            <TableHead>{t('common.status')}</TableHead>
            <TableHead>{t('common.actions')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {submissions?.map((sub) => {
            const studentUser = sub.student?.user;

            return (
              <TableRow key={sub.id}>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <Avatar name={`${studentUser?.firstName} ${studentUser?.lastName}`} size="sm" />
                    <div>
                      <div className="font-bold text-slate-900 dark:text-slate-100">
                        {studentUser?.firstName} {studentUser?.lastName}
                      </div>
                      <div className="text-xs text-slate-500 font-mono">
                        {sub.student?.studentCode}
                      </div>
                    </div>
                  </div>
                </TableCell>

                <TableCell>
                  <div className="font-semibold text-slate-900 dark:text-slate-100">
                    {localizeText(sub.task?.title)}
                  </div>
                  <div className="text-xs text-brand-600 dark:text-brand-400 font-bold">
                    +{sub.task?.xpReward} XP
                  </div>
                </TableCell>

                <TableCell>
                  <span className="text-xs text-slate-500">
                    {formatDate(sub.submittedAt)}
                  </span>
                </TableCell>

                <TableCell>
                  <Badge
                    variant={
                      sub.status === 'APPROVED'
                        ? 'success'
                        : sub.status === 'PENDING'
                        ? 'warning'
                        : 'danger'
                    }
                    size="sm"
                  >
                    {formatStatus(sub.status)}
                  </Badge>
                </TableCell>

                <TableCell>
                  <Button
                    size="sm"
                    onClick={() => {
                      setSelectedSubmission(sub);
                      setFeedback(sub.feedback || '');
                    }}
                  >
                    {t('tasks.gradeSubmission')}
                  </Button>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      {/* Review Dialog */}
      <Dialog
        isOpen={Boolean(selectedSubmission)}
        onClose={() => setSelectedSubmission(null)}
        title={t('tasks.gradeSubmission')}
        maxWidth="lg"
      >
        {selectedSubmission && (
          <div className="space-y-4 py-2">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h4 className="font-bold text-slate-900 dark:text-slate-100">
                  {localizeText(selectedSubmission.task?.title)}
                </h4>
                <p className="text-xs text-slate-500">
                  {selectedSubmission.student?.user.firstName} {selectedSubmission.student?.user.lastName} ({selectedSubmission.student?.studentCode})
                </p>
              </div>
              <Badge variant="primary">+{selectedSubmission.task?.xpReward} XP</Badge>
            </div>

            {/* Code / Content */}
            {selectedSubmission.content && (
              <div className="space-y-1">
                <span className="text-xs font-bold text-slate-500">{t('tasks.textCodeAnswer')}:</span>
                <pre className="p-4 rounded-2xl bg-slate-950 text-slate-100 font-mono text-xs overflow-x-auto max-h-64">
                  <code>{selectedSubmission.content}</code>
                </pre>
              </div>
            )}

            {selectedSubmission.githubUrl && (
              <div className="flex items-center gap-2 text-xs">
                <Github className="w-4 h-4 text-slate-500" />
                <a
                  href={selectedSubmission.githubUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-brand-600 underline font-mono"
                >
                  {selectedSubmission.githubUrl}
                </a>
              </div>
            )}

            <Textarea
              label={t('tasks.instructorFeedback')}
              placeholder={t('tasks.feedback')}
              rows={3}
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
            />

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
              <Button
                variant="outline"
                onClick={() => handleReview('NEEDS_REVISION')}
                isLoading={reviewMutation.isPending}
              >
                <X className="w-4 h-4 text-rose-500" />
                <span>{t('tasks.requestRevision')}</span>
              </Button>
              <Button
                variant="success"
                onClick={() => handleReview('APPROVED')}
                isLoading={reviewMutation.isPending}
              >
                <Check className="w-4 h-4" />
                <span>{t('tasks.approve')}</span>
              </Button>
            </div>
          </div>
        )}
      </Dialog>
    </div>
  );
}
