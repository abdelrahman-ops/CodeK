import React, { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { api } from '../../lib/api/client.js';
import { useTranslation } from 'react-i18next';
import { Send, Bell, Plus, Users } from 'lucide-react';
import { Card } from '../../components/ui/card.js';
import { Button } from '../../components/ui/button.js';
import { Input, Textarea } from '../../components/ui/input.js';
import { Select } from '../../components/ui/select.js';
import { Badge } from '../../components/ui/badge.js';
import { Dialog } from '../../components/ui/dialog.js';
import { CardSkeleton } from '../../components/ui/skeleton.js';
import { useToast } from '../../components/ui/toast.js';
import { localizeText, formatStatus, formatDate } from '../../lib/i18n-helpers.js';

export function AdminNotificationsPage() {
  const { t } = useTranslation();
  const toast = useToast();

  const [isSendModalOpen, setIsSendModalOpen] = useState(false);
  const [targetUserId, setTargetUserId] = useState('');
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');

  const { data: users } = useQuery({
    queryKey: ['allUsersList'],
    queryFn: async () => (await api.users.list()).data.data,
    enabled: isSendModalOpen
  });

  const { data: notifications, isLoading } = useQuery({
    queryKey: ['adminNotifications'],
    queryFn: async () => (await api.notifications.list()).data.data
  });

  const sendMutation = useMutation({
    mutationFn: async (data: any) => (await api.notifications.send(data)).data.data,
    onSuccess: () => {
      setIsSendModalOpen(false);
      setTitle('');
      setMessage('');
      toast.success(t('common.success'));
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error?.message || t('common.error'));
    }
  });

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    sendMutation.mutate({
      userId: targetUserId,
      title,
      message,
      type: 'INFO'
    });
  };

  if (isLoading) return <CardSkeleton />;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-slate-100">
            {t('nav.notifications')}
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            {t('notifications.subtitle')}
          </p>
        </div>

        <Button onClick={() => setIsSendModalOpen(true)}>
          <Send className="w-4 h-4" />
          <span>{t('notifications.sendNotification')}</span>
        </Button>
      </div>

      <div className="space-y-3">
        {notifications?.map((n) => (
          <Card key={n.id} className="p-4 flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-brand-50 dark:bg-brand-950 text-brand-600 flex items-center justify-center shrink-0 mt-0.5">
                <Bell className="w-4 h-4" />
              </div>
              <div>
                <h4 className="font-bold text-sm text-slate-900 dark:text-slate-100">{localizeText(n.title)}</h4>
                <p className="text-xs text-slate-500 mt-0.5">{localizeText(n.message)}</p>
                <span className="text-[11px] text-slate-400 mt-1 inline-block">
                  {formatDate(n.createdAt)}
                </span>
              </div>
            </div>

            <Badge variant="primary" size="sm">{formatStatus(n.type)}</Badge>
          </Card>
        ))}
      </div>

      {/* Send Modal */}
      <Dialog
        isOpen={isSendModalOpen}
        onClose={() => setIsSendModalOpen(false)}
        title={t('notifications.sendNotification')}
        maxWidth="md"
      >
        <form onSubmit={handleSend} className="space-y-4 py-2">
          <Select
            label={t('notifications.recipient')}
            value={targetUserId}
            onChange={(e) => setTargetUserId(e.target.value)}
            options={[
              { value: '', label: t('notifications.selectRecipient') },
              ...(users?.map((u) => ({
                value: u.id,
                label: `${u.firstName} ${u.lastName} (${formatStatus(u.role)} - ${u.loginId})`
              })) || [])
            ]}
            required
          />

          <Input
            label={t('tasks.taskTitle')}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />

          <Textarea
            label={t('tasks.shortDescription')}
            rows={4}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            required
          />

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => setIsSendModalOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" isLoading={sendMutation.isPending} disabled={!targetUserId}>
              {t('notifications.sendNotification')}
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
