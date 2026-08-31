import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api/client.js';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { CalendarCheck2, Plus, QrCode, Clock } from 'lucide-react';
import { Card } from '../../components/ui/card.js';
import { Button } from '../../components/ui/button.js';
import { Badge } from '../../components/ui/badge.js';
import { CardSkeleton } from '../../components/ui/skeleton.js';
import { localizeText, formatStatus, formatDate, formatTime } from '../../lib/i18n-helpers.js';
import { CreateSessionModal } from '../../components/sessions/create-session-modal.js';

export function AdminSessionsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  const { data: sessions, isLoading } = useQuery({
    queryKey: ['adminSessions'],
    queryFn: async () => (await api.sessions.list()).data.data
  });

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

      <CreateSessionModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
      />
    </div>
  );
}
