import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api/client.js';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Users,
  Plus,
  Search,
  KeyRound,
  CheckCircle2,
  Copy,
  ChevronRight,
  Flame,
  Star,
  Presentation
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/card.js';
import { Button } from '../../components/ui/button.js';
import { Input } from '../../components/ui/input.js';
import { Select } from '../../components/ui/select.js';
import { Badge } from '../../components/ui/badge.js';
import { Avatar } from '../../components/ui/avatar.js';
import { Dialog } from '../../components/ui/dialog.js';
import { StudentCredentialsModal } from '../../components/students/student-credentials-modal.js';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell
} from '../../components/ui/table.js';
import { TableSkeleton } from '../../components/ui/skeleton.js';
import { useToast } from '../../components/ui/toast.js';
import { localizeText, formatStatus, formatStreak } from '../../lib/i18n-helpers.js';

export function AdminStudentsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const toast = useToast();
  const queryClient = useQueryClient();

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedGroup, setSelectedGroup] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [createdStudentData, setCreatedStudentData] = useState<any | null>(null);

  // Form State
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [groupId, setGroupId] = useState('');
  const [programmingLevel, setProgrammingLevel] = useState('BEGINNER');

  const { data: groups } = useQuery({
    queryKey: ['groups'],
    queryFn: async () => (await api.groups.list()).data.data
  });

  const { data: students, isLoading } = useQuery({
    queryKey: ['adminStudents', searchTerm, selectedGroup],
    queryFn: async () => (await api.students.list({ search: searchTerm || undefined, groupId: selectedGroup || undefined })).data.data
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => (await api.students.create(data)).data.data,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['adminStudents'] });
      setIsAddModalOpen(false);
      setFirstName('');
      setLastName('');
      setEmail('');
      setPhone('');
      setGroupId('');
      setProgrammingLevel('BEGINNER');

      if (data) {
        const activeGroup = data.group || groups?.find((g) => g.id === groupId);
        setCreatedStudentData({
          studentId: data.student.id,
          loginId: data.user.loginId,
          studentName: `${data.user.firstName} ${data.user.lastName}`.trim(),
          phone: data.user.phone,
          temporaryPassword: data.temporaryPassword,
          groupName: activeGroup?.name || null,
          groupSchedule: activeGroup?.scheduleInfo || null,
          whatsappGroupUrl: activeGroup?.whatsappGroupUrl || null
        });
      }
      toast.success(t('common.success'));
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error?.message || t('common.error'));
    }
  });

  const handleCreateStudent = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate({
      firstName,
      lastName,
      email: email.trim() || undefined,
      phone: phone.trim() || undefined,
      groupId: groupId || undefined,
      programmingLevel
    });
  };

  const handleCloseModal = () => {
    setIsAddModalOpen(false);
    setCreatedStudentData(null);
    setFirstName('');
    setLastName('');
    setEmail('');
    setPhone('');
    setGroupId('');
    setProgrammingLevel('BEGINNER');
  };

  const handleCopyCredentials = () => {
    if (!createdStudentData) return;
    const text = `CodeK Login Credentials:\nLogin ID: ${createdStudentData.student.studentCode}\nPassword: ${createdStudentData.temporaryPassword}`;
    navigator.clipboard.writeText(text);
    toast.success(t('common.copied'));
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-slate-100 flex items-center gap-2.5">
            <Users className="w-7 h-7 text-brand-600 dark:text-brand-400" />
            <span>{t('nav.students')}</span>
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            {t('students.subtitle')}
          </p>
        </div>

        <Button onClick={() => setIsAddModalOpen(true)}>
          <Plus className="w-4 h-4" />
          <span>{t('students.createStudent')}</span>
        </Button>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1">
          <Input
            placeholder={t('students.searchPlaceholder')}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            leftIcon={<Search className="w-4 h-4" />}
          />
        </div>
        <div className="w-full sm:w-64">
          <Select
            value={selectedGroup}
            onChange={(e: any) => setSelectedGroup(e.target.value)}
            options={[
              { value: '', label: t('students.allGroups') },
              ...(groups?.map((g) => ({ value: g.id, label: localizeText(g.name) })) || [])
            ]}
          />
        </div>
      </div>

      {/* Content: Mobile Cards + Desktop Table */}
      {isLoading ? (
        <TableSkeleton rows={6} />
      ) : (
        <>
          {/* Mobile Card List (sm:hidden) */}
          <div className="sm:hidden space-y-3">
            {students?.map((student) => {
              const u = student.user;
              const activeGroup = student.enrollments?.[0]?.group?.name ? localizeText(student.enrollments[0].group.name) : t('common.noData');

              return (
                <Card
                  key={student.id}
                  onClick={() => navigate(`/admin/students/${student.id}`)}
                  className="p-4 space-y-3 cursor-pointer hover:border-brand-500 transition active:scale-[0.99]"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Avatar name={`${u.firstName} ${u.lastName}`} src={u.avatarUrl} size="sm" />
                      <div>
                        <div className="font-bold text-sm text-slate-900 dark:text-slate-100">
                          {u.firstName} {u.lastName}
                        </div>
                        <div className="text-xs font-mono text-slate-500 font-bold">
                          {student.studentCode}
                        </div>
                      </div>
                    </div>

                    <Badge variant="primary" size="sm">
                      {activeGroup}
                    </Badge>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800 text-xs font-semibold">
                    <div className="flex items-center gap-3">
                      <span className="flex items-center gap-1 text-amber-600">
                        <Flame className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
                        {formatStreak(student.currentStreak)}
                      </span>
                      <span className="flex items-center gap-1 text-brand-600">
                        <Star className="w-3.5 h-3.5 fill-brand-500 text-brand-500" />
                        {student.totalXp} XP
                      </span>
                    </div>

                    <ChevronRight className="w-4 h-4 text-slate-400 rtl:rotate-180" />
                  </div>
                </Card>
              );
            })}
          </div>

          {/* Desktop Table (hidden sm:block) */}
          <div className="hidden sm:block overflow-x-auto rounded-2xl border border-slate-200/80 dark:border-slate-800/80">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('roles.student')}</TableHead>
                  <TableHead>{t('students.studentCode')}</TableHead>
                  <TableHead>{t('students.group')}</TableHead>
                  <TableHead>{t('students.programmingLevel')}</TableHead>
                  <TableHead>{t('dashboard.streak')} & XP</TableHead>
                  <TableHead>{t('common.actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {students?.map((student) => {
                  const u = student.user;
                  const activeGroup = student.enrollments?.[0]?.group?.name ? localizeText(student.enrollments[0].group.name) : t('common.noData');

                  return (
                    <TableRow key={student.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar name={`${u.firstName} ${u.lastName}`} src={u.avatarUrl} size="sm" />
                          <div>
                            <div className="font-bold text-slate-900 dark:text-slate-100">
                              {u.firstName} {u.lastName}
                            </div>
                            <div className="text-xs text-slate-400">
                              {u.email || u.phone || t('common.noData')}
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-xs font-mono font-bold">
                          {student.studentCode}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge variant={activeGroup === t('common.noData') ? 'secondary' : 'outline'}>
                          {activeGroup}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <span className="text-xs font-semibold">{formatStatus(student.programmingLevel)}</span>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 text-xs font-bold">
                          <span className="text-amber-600 dark:text-amber-400 flex items-center gap-1">
                            <Flame className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
                            {formatStreak(student.currentStreak)}
                          </span>
                          <span>•</span>
                          <span className="text-brand-600 dark:text-brand-400 flex items-center gap-1">
                            <Star className="w-3.5 h-3.5 fill-brand-500 text-brand-500" />
                            {student.totalXp} XP
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => navigate(`/admin/students/${student.id}`)}
                        >
                          <span>{t('common.details')}</span>
                          <ChevronRight className="w-4 h-4 rtl:rotate-180" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </>
      )}      {/* Create Student Modal Form */}
      <Dialog
        isOpen={isAddModalOpen}
        onClose={handleCloseModal}
        title={t('students.createStudent')}
        maxWidth="md"
      >
        <form onSubmit={handleCreateStudent} className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <Input
              label={t('students.firstName')}
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              required
            />
            <Input
              label={t('students.lastName')}
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              required
            />
          </div>

          <Input
            label={t('students.email')}
            type="email"
            placeholder="name@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />

          <Input
            label={t('students.phone')}
            type="tel"
            placeholder="010xxxxxxxx"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />

          <div className="grid grid-cols-2 gap-3">
            <Select
              label={t('students.group')}
              value={groupId}
              onChange={(e: any) => setGroupId(e.target.value)}
              options={[
                { value: '', label: t('students.allGroups') },
                ...(groups?.map((g) => ({ value: g.id, label: localizeText(g.name) })) || [])
              ]}
            />

            <Select
              label={t('students.programmingLevel')}
              value={programmingLevel}
              onChange={(e: any) => setProgrammingLevel(e.target.value)}
              options={[
                { value: 'BEGINNER', label: formatStatus('BEGINNER') },
                { value: 'INTERMEDIATE', label: formatStatus('INTERMEDIATE') },
                { value: 'ADVANCED', label: formatStatus('ADVANCED') }
              ]}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={handleCloseModal}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" isLoading={createMutation.isPending}>
              {t('students.createStudent')}
            </Button>
          </div>
        </form>
      </Dialog>

      {/* Rich Student Credentials & WhatsApp Sharing Modal */}
      <StudentCredentialsModal
        isOpen={Boolean(createdStudentData)}
        onClose={() => setCreatedStudentData(null)}
        data={createdStudentData}
      />
    </div>
  );
}
