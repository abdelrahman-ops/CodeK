import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api/client.js';
import { useTranslation } from 'react-i18next';
import { CreditCard, Check, X, Plus, DollarSign } from 'lucide-react';
import { Card } from '../../components/ui/card.js';
import { Button } from '../../components/ui/button.js';
import { Input } from '../../components/ui/input.js';
import { Select } from '../../components/ui/select.js';
import { Badge } from '../../components/ui/badge.js';
import { Avatar } from '../../components/ui/avatar.js';
import { Dialog } from '../../components/ui/dialog.js';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../components/ui/table.js';
import { TableSkeleton } from '../../components/ui/skeleton.js';
import { StatCard } from '../../components/ui/stat-card.js';
import { useToast } from '../../components/ui/toast.js';
import { useBulkSelection } from '../../hooks/use-bulk-selection.js';
import { BulkSelectionBar } from '../../components/shared/bulk-selection-bar.js';
import { Payment } from '../../types/api.js';
import { localizeText, formatStatus, formatCurrency } from '../../lib/i18n-helpers.js';

export function AdminPaymentsPage() {
  const { t } = useTranslation();
  const toast = useToast();
  const queryClient = useQueryClient();

  const currentRealYear = new Date().getFullYear();
  const currentRealMonth = new Date().getMonth() + 1;

  const [selectedYear, setSelectedYear] = useState<number>(currentRealYear);
  const [selectedMonth, setSelectedMonth] = useState<number>(currentRealMonth);
  const [selectedGroup, setSelectedGroup] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [isRecordModalOpen, setIsRecordModalOpen] = useState(false);

  // Form State
  const [studentId, setStudentId] = useState('');
  const [formYear, setFormYear] = useState(currentRealYear);
  const [formMonth, setFormMonth] = useState(currentRealMonth);
  const [amount, setAmount] = useState(250);
  const [status, setStatus] = useState('PAID');
  const [notes, setNotes] = useState('Paid in cash');

  const years = [currentRealYear - 1, currentRealYear, currentRealYear + 1];
  const months = [
    { num: 1, name: '1' },
    { num: 2, name: '2' },
    { num: 3, name: '3' },
    { num: 4, name: '4' },
    { num: 5, name: '5' },
    { num: 6, name: '6' },
    { num: 7, name: '7' },
    { num: 8, name: '8' },
    { num: 9, name: '9' },
    { num: 10, name: '10' },
    { num: 11, name: '11' },
    { num: 12, name: '12' }
  ];

  const { data: groups } = useQuery({
    queryKey: ['groups'],
    queryFn: async () => (await api.groups.list()).data.data
  });

  const { data: students } = useQuery({
    queryKey: ['allStudentsList'],
    queryFn: async () => (await api.students.list()).data.data,
    enabled: isRecordModalOpen
  });

  const { data: summary } = useQuery({
    queryKey: ['paymentSummary', selectedYear, selectedMonth],
    queryFn: async () => (await api.payments.getSummary({ year: selectedYear, month: selectedMonth })).data.data
  });

  const { data: paymentsRes, isLoading } = useQuery({
    queryKey: ['adminPayments', selectedYear, selectedMonth, selectedGroup, filterStatus],
    queryFn: async () =>
      (await api.payments.list({
        year: selectedYear,
        month: selectedMonth,
        groupId: selectedGroup || undefined,
        status: filterStatus || undefined
      })).data
  });

  const payments = paymentsRes?.data || [];
  const selection = useBulkSelection(payments);

  const bulkStatusMutation = useMutation({
    mutationFn: async ({ status }: { status: string }) => {
      return (await api.payments.bulkStatus({
        paymentIds: Array.from(selection.selectedIds),
        status
      })).data;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['adminPayments'] });
      queryClient.invalidateQueries({ queryKey: ['paymentSummary'] });
      toast.success(vars.status === 'PAID' ? 'تم تحديد المدفوعات كمدفوعة بنجاح' : 'تم تحديد المدفوعات كغير مدفوعة بنجاح');
      selection.deselectAll();
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error?.message || t('common.error'));
    }
  });

  const recordMutation = useMutation({
    mutationFn: async (data: any) => (await api.payments.record(data)).data.data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminPayments'] });
      queryClient.invalidateQueries({ queryKey: ['paymentSummary'] });
      setIsRecordModalOpen(false);
      toast.success(t('common.success'));
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error?.message || t('common.error'));
    }
  });

  const handleRecordPayment = (e: React.FormEvent) => {
    e.preventDefault();
    recordMutation.mutate({
      studentId,
      year: Number(formYear),
      month: Number(formMonth),
      amount: Number(amount),
      status,
      notes
    });
  };

  const handleToggleStatus = (p: Payment) => {
    const nextStatus = p.status === 'PAID' ? 'UNPAID' : 'PAID';
    recordMutation.mutate({
      studentId: p.studentId,
      year: p.year,
      month: p.month,
      amount: p.amount,
      status: nextStatus
    });
  };

  if (isLoading) return <TableSkeleton rows={6} />;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <CreditCard className="w-7 h-7 text-brand-600 dark:text-brand-400" />
            <span>{t('payments.title')}</span>
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            {t('payments.subtitle')}
          </p>
        </div>

        <Button onClick={() => {
          setFormYear(selectedYear);
          setFormMonth(selectedMonth);
          setIsRecordModalOpen(true);
        }}>
          <Plus className="w-4 h-4" />
          <span>{t('payments.recordPayment')}</span>
        </Button>
      </div>

      {/* Year Navigation Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-3xl bg-slate-100/80 dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{t('payments.year')}:</span>
          <div className="flex items-center gap-1 p-1 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200/60 dark:border-slate-700">
            {years.map((y) => (
              <button
                key={y}
                type="button"
                onClick={() => setSelectedYear(y)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition ${selectedYear === y ? 'bg-brand-600 text-white shadow-sm' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'}`}
              >
                {y}
              </button>
            ))}
          </div>
        </div>

        {/* Group Filter */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{t('students.group')}:</span>
          <select
            value={selectedGroup}
            onChange={(e) => setSelectedGroup(e.target.value)}
            className="px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-800 dark:text-slate-200 outline-none"
          >
            <option value="">{t('students.allGroups')}</option>
            {groups?.map((g) => (
              <option key={g.id} value={g.id}>{localizeText(g.name)}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Month Navigation Pills */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-2 scrollbar-none">
        {months.map((m) => (
          <button
            key={m.num}
            type="button"
            onClick={() => setSelectedMonth(m.num)}
            className={`px-4 py-2 rounded-2xl text-xs font-black transition whitespace-nowrap ${selectedMonth === m.num ? 'bg-brand-600 text-white shadow-md shadow-brand-500/20 scale-105' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'}`}
          >
            {t('payments.month')} {m.name}
          </button>
        ))}
      </div>

      {/* Financial Summary Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          title={t('payments.totalCollected')}
          value={formatCurrency(summary?.totalCollectedEgp || 0)}
          subtitle={`${summary?.paidCount || 0} ${t('roles.student')}`}
          icon={<CreditCard className="w-5 h-5 text-emerald-600" />}
        />
        <StatCard
          title={t('payments.targetRevenue')}
          value={formatCurrency(summary?.totalExpectedEgp || 0)}
          subtitle={`${summary?.totalRecords || 0} ${t('roles.student')}`}
          icon={<DollarSign className="w-5 h-5 text-brand-600" />}
        />
        <StatCard
          title={t('payments.pendingCollection')}
          value={formatCurrency((summary?.totalExpectedEgp || 0) - (summary?.totalCollectedEgp || 0))}
          subtitle={`${summary?.unpaidCount || 0} ${t('roles.student')}`}
          icon={<CreditCard className="w-5 h-5 text-amber-600" />}
        />
      </div>

      {/* Status Filter Tabs */}
      <div className="flex items-center gap-1.5 p-1 bg-slate-200/60 dark:bg-slate-800/60 rounded-xl w-fit">
        {['', 'PAID', 'UNPAID'].map((st) => (
          <button
            key={st}
            onClick={() => setFilterStatus(st)}
            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition ${filterStatus === st ? 'bg-white dark:bg-slate-900 text-brand-600 dark:text-brand-400 shadow-sm' : 'text-slate-600 dark:text-slate-400'}`}
          >
            {st ? formatStatus(st) : t('common.all')}
          </button>
        ))}
      </div>

      <BulkSelectionBar
        totalItems={payments.length}
        selectedCount={selection.selectedCount}
        isAllSelected={selection.isAllSelected}
        isIndeterminate={selection.isIndeterminate}
        onToggleSelectAll={selection.toggleSelectAll}
        onDeselectAll={selection.deselectAll}
        isLoading={bulkStatusMutation.isPending}
        actions={[
          {
            id: 'mark-paid',
            label: 'تحديد كمدفوع',
            icon: <Check className="w-3.5 h-3.5" />,
            variant: 'primary',
            onClick: () => bulkStatusMutation.mutate({ status: 'PAID' })
          },
          {
            id: 'mark-unpaid',
            label: 'تحديد كغير مدفوع',
            icon: <X className="w-3.5 h-3.5" />,
            variant: 'secondary',
            onClick: () => bulkStatusMutation.mutate({ status: 'UNPAID' })
          }
        ]}
      />

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-12">
              <input
                type="checkbox"
                checked={selection.isAllSelected}
                ref={(el) => {
                  if (el) el.indeterminate = selection.isIndeterminate;
                }}
                onChange={selection.toggleSelectAll}
                className="w-4 h-4 rounded text-brand-600 focus:ring-brand-500 border-slate-300 dark:border-slate-600 cursor-pointer"
              />
            </TableHead>
            <TableHead>{t('roles.student')}</TableHead>
            <TableHead>{t('payments.month')} / {t('payments.year')}</TableHead>
            <TableHead>{t('payments.amount')}</TableHead>
            <TableHead>{t('common.status')}</TableHead>
            <TableHead>{t('common.actions')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {payments?.map((p) => {
            const studentUser = p.student?.user;
            const isPaid = p.status === 'PAID';
            const isSelected = selection.isSelected(p.id);

            return (
              <TableRow key={p.id} className={isSelected ? 'bg-brand-50/20 dark:bg-brand-950/20' : ''}>
                <TableCell>
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => selection.toggle(p.id)}
                    className="w-4 h-4 rounded text-brand-600 focus:ring-brand-500 border-slate-300 dark:border-slate-600 cursor-pointer"
                  />
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <Avatar name={`${studentUser?.firstName} ${studentUser?.lastName}`} size="sm" />
                    <div>
                      <div className="font-bold text-slate-900 dark:text-slate-100">
                        {studentUser?.firstName} {studentUser?.lastName}
                      </div>
                      <div className="text-xs text-slate-500 font-mono">
                        {p.student?.studentCode}
                      </div>
                    </div>
                  </div>
                </TableCell>

                <TableCell>
                  <span className="font-bold text-sm text-slate-800 dark:text-slate-200">
                    {t('payments.month')} {p.month} / {p.year}
                  </span>
                </TableCell>

                <TableCell>
                  <span className="font-bold text-slate-900 dark:text-slate-100">
                    {formatCurrency(p.amount)}
                  </span>
                </TableCell>

                <TableCell>
                  <Badge variant={isPaid ? 'success' : 'warning'}>
                    {formatStatus(p.status)}
                  </Badge>
                </TableCell>

                <TableCell>
                  <Button
                    size="sm"
                    variant={isPaid ? 'outline' : 'primary'}
                    onClick={() => handleToggleStatus(p)}
                  >
                    {isPaid ? t('payments.markUnpaid') : t('payments.markPaid')}
                  </Button>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      {/* Record Payment Dialog */}
      <Dialog
        isOpen={isRecordModalOpen}
        onClose={() => setIsRecordModalOpen(false)}
        title={t('payments.recordPayment')}
        maxWidth="md"
      >
        <form onSubmit={handleRecordPayment} className="space-y-4 py-2">
          <Select
            label={t('roles.student')}
            value={studentId}
            onChange={(e) => setStudentId(e.target.value)}
            options={[
              { value: '', label: t('roles.student') },
              ...(students?.map((s) => ({
                value: s.id,
                label: `${s.user?.firstName} ${s.user?.lastName} (${s.studentCode})`
              })) || [])
            ]}
            required
          />

          <div className="grid grid-cols-2 gap-3">
            <Input
              label={`${t('payments.month')} (1-12)`}
              type="number"
              value={formMonth}
              onChange={(e) => setFormMonth(Number(e.target.value))}
              min={1}
              max={12}
              required
            />
            <Input
              label={t('payments.year')}
              type="number"
              value={formYear}
              onChange={(e) => setFormYear(Number(e.target.value))}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input
              label={t('payments.amount')}
              type="number"
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value))}
              required
            />
            <Select
              label={t('common.status')}
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              options={[
                { value: 'PAID', label: formatStatus('PAID') },
                { value: 'UNPAID', label: formatStatus('UNPAID') }
              ]}
            />
          </div>

          <Input
            label={t('payments.notes')}
            placeholder={t('payments.notes')}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => setIsRecordModalOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" isLoading={recordMutation.isPending} disabled={!studentId}>
              {t('payments.recordPayment')}
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
