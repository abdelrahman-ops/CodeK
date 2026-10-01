import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api/client.js';
import { useTranslation } from 'react-i18next';
import { History, ShieldCheck } from 'lucide-react';
import { Card } from '../../components/ui/card.js';
import { Badge } from '../../components/ui/badge.js';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../components/ui/table.js';
import { TableSkeleton } from '../../components/ui/skeleton.js';
import { AuditLogItem } from '../../types/api.js';
import { localizeText, formatStatus, formatDate } from '../../lib/i18n-helpers.js';

export function AdminAuditLogsPage() {
  const { t } = useTranslation();

  const { data: logs, isLoading } = useQuery<AuditLogItem[]>({
    queryKey: ['adminAuditLogs'],
    queryFn: async () => (await api.audit.list({ limit: 50 })).data.data
  });

  if (isLoading) return <TableSkeleton rows={8} />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-slate-100">
          {t('nav.auditLogs')}
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          {t('auditLogs.subtitle')}
        </p>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t('common.date')}</TableHead>
            <TableHead>{t('auditLogs.actor')}</TableHead>
            <TableHead>{t('auditLogs.action')}</TableHead>
            <TableHead>{t('auditLogs.entity')}</TableHead>
            <TableHead>{t('auditLogs.details')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {logs?.map((log) => (
            <TableRow key={log.id}>
              <TableCell>
                <span className="text-xs text-slate-500 font-mono">
                  {formatDate(log.createdAt)}
                </span>
              </TableCell>

              <TableCell>
                <div className="font-bold text-slate-900 dark:text-slate-100 text-xs">
                  {log.actor ? `${log.actor.firstName} ${log.actor.lastName}` : t('auditLogs.system')}
                </div>
                <div className="text-[11px] text-slate-400 font-mono">
                  {log.actor?.loginId || '-'}
                </div>
              </TableCell>

              <TableCell>
                <Badge variant="primary" size="sm">
                  {formatStatus(log.action)}
                </Badge>
              </TableCell>

              <TableCell>
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  {formatStatus(log.entityType)}
                </span>
              </TableCell>

              <TableCell>
                <span className="text-xs text-slate-500 font-mono max-w-xs truncate block">
                  {log.metadata || '-'}
                </span>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
