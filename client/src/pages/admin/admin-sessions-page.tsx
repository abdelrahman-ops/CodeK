import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api/client.js';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { CalendarCheck2, Plus, QrCode, Play, Users, Clock } from 'lucide-react';
import { Card } from '../../components/ui/card.js';
import { Button } from '../../components/ui/button.js';
import { Input } from '../../components/ui/input.js';
import { Select } from '../../components/ui/select.js';
import { Badge } from '../../components/ui/badge.js';
import { Dialog } from '../../components/ui/dialog.js';
import { CardSkeleton } from '../../components/ui/skeleton.js';
import { useToast } from '../../components/ui/toast.js';
import { localizeText, formatStatus, formatDate, formatTime } from '../../lib/i18n-helpers.js';

export function AdminSessionsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const toast = useToast();
  const queryClient = useQueryClient();

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [groupId, setGroupId] = useState('');
  const [sessionNumber, setSessionNumber] = useState(1);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [startTime, setStartTime] = useState('17:00');
  const [endTime, setEndTime] = useState('18:30');

  const { data: groups } = useQuery({
    queryKey: ['groups'],
    queryFn: async () => (await api.groups.list()).data.data
  });

  const { data: sessions, isLoading } = useQuery({
    queryKey: ['adminSessions'],
    queryFn: async () => (await api.sessions.list()).data.data
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => (await api.sessions.create(data)).data.data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminSessions'] });
      setIsCreateModalOpen(false);
      toast.success(t('common.success'));
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error?.message || t('common.error'));
    }
  });

  const handleCreateSession = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate({
      groupId,
      sessionNumber: Number(sessionNumber),
      date: new Date(date).toISOString(),
      startTime,
      endTime
    });
  };

  if (isLoading) return <CardSkeleton />;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-slate-100 flex items-center gap-2.5">
            <CalendarCheck2 className="w-7 h-7 text-brand-600 dark:text-brand-400" />
            <span>{t('nav.sessions')}</span>
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            {t('sessions.subtitle')}
          </p>
        </div>

        <Button onClick={() => setIsCreateModalOpen(true)}>
          <Plus className="w-4 h-4" />
          <span>{t('sessions.createSession')}</span>
        </Button>
      </div>

      <div className="space-y-4">
        {sessions?.map((sess) => (
          <Card key={sess.id} className="p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2.5">
                <h3 className="font-bold text-lg text-slate-900 dark:text-slate-100">
                  {sess.group?.name ? localizeText(sess.group.name) : t('students.group')} — {t('sessions.sessionNumber')} #{sess.sessionNumber}
                </h3>
                <Badge variant={sess.status === 'ACTIVE' ? 'success' : sess.status === 'COMPLETED' ? 'secondary' : 'primary'}>
                  {formatStatus(sess.status)}
                </Badge>
              </div>

              <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500">
                <span>{formatDate(sess.date)}</span>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" />
                  {formatTime(sess.startTime)} - {formatTime(sess.endTime)}
                </span>
                <span>•</span>
                <span>{sess._count?.attendances || 0} {t('sessions.presentCount')}</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                size="sm"
                onClick={() => navigate(`/admin/sessions/${sess.id}/qr`)}
              >
                <QrCode className="w-4 h-4" />
                <span>{t('common.projectorQr')}</span>
              </Button>
            </div>
          </Card>
        ))}
      </div>

      {/* Schedule Session Modal */}
      <Dialog
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title={t('sessions.createSession')}
        maxWidth="md"
      >
        <form onSubmit={handleCreateSession} className="space-y-4 py-2">
          <Select
            label={t('students.group')}
            value={groupId}
            onChange={(e) => setGroupId(e.target.value)}
            options={[
              { value: '', label: t('students.group') },
              ...(groups?.map((g) => ({ value: g.id, label: localizeText(g.name) })) || [])
            ]}
            required
          />

          <Input
            label={t('sessions.sessionNumber')}
            type="number"
            value={sessionNumber}
            onChange={(e) => setSessionNumber(Number(e.target.value))}
            min={1}
            required
          />

          <Input
            label={t('sessions.sessionDate')}
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
          />

          <div className="grid grid-cols-2 gap-3">
            <Input
              label={t('sessions.startTime')}
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              required
            />
            <Input
              label={t('sessions.endTime')}
              type="time"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              required
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => setIsCreateModalOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" isLoading={createMutation.isPending} disabled={!groupId}>
              {t('sessions.createSession')}
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
