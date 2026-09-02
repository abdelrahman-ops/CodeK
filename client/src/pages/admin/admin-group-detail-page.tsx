import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api/client.js';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Presentation,
  Users,
  Plus,
  ChevronLeft,
  Clock,
  Flame,
  Star,
  Trash2,
  CalendarCheck2,
  AlertTriangle,
  UserPlus
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/card.js';
import { Button } from '../../components/ui/button.js';
import { Input } from '../../components/ui/input.js';
import { Badge } from '../../components/ui/badge.js';
import { Avatar } from '../../components/ui/avatar.js';
import { Select } from '../../components/ui/select.js';
import { Dialog } from '../../components/ui/dialog.js';
import { ConfirmDialog } from '../../components/ui/confirm-dialog.js';
import { GroupSchedulePicker } from '../../components/groups/group-schedule-picker.js';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../components/ui/table.js';
import { CardSkeleton, TableSkeleton } from '../../components/ui/skeleton.js';
import { useToast } from '../../components/ui/toast.js';
import { localizeText, formatStatus, formatStreak, formatScheduleDisplay } from '../../lib/i18n-helpers.js';

export function AdminGroupDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const isArabic = i18n.language === 'ar';
  const toast = useToast();
  const queryClient = useQueryClient();

  const [isEnrollModalOpen, setIsEnrollModalOpen] = useState(false);
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [studentToRemove, setStudentToRemove] = useState<{ id: string; name: string } | null>(null);

  const { data: group, isLoading } = useQuery({
    queryKey: ['adminGroupDetail', id],
    queryFn: async () => {
      if (!id) throw new Error('No id');
      return (await api.groups.getById(id)).data.data;
    },
    enabled: Boolean(id)
  });

  const { data: allStudents } = useQuery({
    queryKey: ['allStudentsList'],
    queryFn: async () => (await api.students.list()).data.data
  });

  const enrollMutation = useMutation({
    mutationFn: async (studentId: string) => {
      if (!id) return;
      return (await api.groups.enroll(id, studentId)).data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminGroupDetail', id] });
      queryClient.invalidateQueries({ queryKey: ['groups'] });
      setIsEnrollModalOpen(false);
      setSelectedStudentId('');
      toast.success(t('common.success'));
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error?.message || t('common.error'));
    }
  });

  const removeMutation = useMutation({
    mutationFn: async (studentId: string) => {
      if (!id) return;
      return (await api.groups.removeStudent(id, studentId)).data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminGroupDetail', id] });
      queryClient.invalidateQueries({ queryKey: ['groups'] });
      setStudentToRemove(null);
      toast.success(t('common.success'));
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error?.message || t('common.error'));
    }
  });

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editSchedules, setEditSchedules] = useState<any[]>([]);
  const [editWhatsappGroupUrl, setEditWhatsappGroupUrl] = useState('');
  const [editMaxCapacity, setEditMaxCapacity] = useState(20);

  const updateMutation = useMutation({
    mutationFn: async (data: any) => {
      if (!id) return;
      return (await api.groups.update(id, data)).data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminGroupDetail', id] });
      queryClient.invalidateQueries({ queryKey: ['groups'] });
      setIsEditModalOpen(false);
      toast.success(t('common.success'));
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error?.message || t('common.error'));
    }
  });

  const deleteGroupMutation = useMutation({
    mutationFn: async () => {
      if (!id) return;
      return (await api.groups.delete(id)).data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['groups'] });
      toast.success(t('common.success'));
      navigate('/admin/groups');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error?.message || t('common.error'));
    }
  });

  const handleOpenEdit = () => {
    if (!group) return;
    setEditName(group.name);
    setEditDescription(group.description || '');
    setEditSchedules(group.schedules || []);
    setEditWhatsappGroupUrl(group.whatsappGroupUrl || '');
    setEditMaxCapacity(group.maxCapacity || 20);
    setIsEditModalOpen(true);
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    updateMutation.mutate({
      name: editName,
      description: editDescription.trim() || undefined,
      schedules: editSchedules.length > 0 ? editSchedules : undefined,
      whatsappGroupUrl: editWhatsappGroupUrl.trim() || undefined,
      maxCapacity: Number(editMaxCapacity)
    });
  };

  if (isLoading) return <CardSkeleton />;

  if (!group) return <div className="p-8 text-center text-slate-500">{t('common.noData')}</div>;

  const enrollments = group.enrollments || [];
  const enrolledStudentIds = new Set(enrollments.map((e: any) => e.studentId));
  const availableStudents = allStudents?.filter((s) => !enrolledStudentIds.has(s.id)) || [];
  const isNearCapacity = enrollments.length >= group.maxCapacity;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          onClick={() => navigate('/admin/groups')}
          className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
        >
          <ChevronLeft className="w-4 h-4 rtl:rotate-180" />
          <span>{t('nav.groups')}</span>
        </button>

        <div className="flex items-center gap-2">
          <Button onClick={handleOpenEdit} variant="outline" size="sm">
            {t('groups.editGroup')}
          </Button>

          <Button
            onClick={() => setIsDeleteDialogOpen(true)}
            variant="outline"
            size="sm"
            className="text-rose-600 border-rose-200 hover:bg-rose-50 dark:border-rose-800 dark:hover:bg-rose-950/40"
          >
            <Trash2 className="w-4 h-4" />
            <span>{t('groups.deleteGroup')}</span>
          </Button>

          <Button onClick={() => setIsEnrollModalOpen(true)} size="sm">
            <UserPlus className="w-4 h-4" />
            <span>{t('groups.addStudent')}</span>
          </Button>
        </div>
      </div>

      {/* Group Header Info */}
      <Card className="p-6 border-slate-200/80 dark:border-slate-800/80 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-brand-50 dark:bg-brand-950 text-brand-600 dark:text-brand-400 flex items-center justify-center">
              <Presentation className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-slate-900 dark:text-slate-100">{localizeText(group.name)}</h1>
              <p className="text-xs text-slate-500 mt-0.5">{localizeText(group.description) || t('groups.noDescription')}</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="primary" size="sm">
              <Clock className="w-3.5 h-3.5" />
              <span>{formatScheduleDisplay(group.schedules, group.scheduleInfo, isArabic) || t('common.noSchedule')}</span>
            </Badge>
            <Badge variant={isNearCapacity ? 'warning' : 'success'} size="sm">
              <Users className="w-3.5 h-3.5" />
              <span>{enrollments.length} / {group.maxCapacity} {t('groups.capacity')}</span>
            </Badge>
          </div>
        </div>
      </Card>

      {/* Enrolled Students Table */}
      <Card className="border-slate-200/80 dark:border-slate-800/80 shadow-sm overflow-hidden">
        <CardHeader className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <CardTitle className="text-base font-black flex items-center gap-2">
            <Users className="w-5 h-5 text-brand-600 dark:text-brand-400" />
            <span>{t('groups.enrolledStudents')} ({enrollments.length})</span>
          </CardTitle>
        </CardHeader>

        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('roles.student')}</TableHead>
                  <TableHead>{t('students.studentCode')}</TableHead>
                  <TableHead>{t('students.programmingLevel')}</TableHead>
                  <TableHead>{t('gamification.xp')}</TableHead>
                  <TableHead>{t('students.streak')}</TableHead>
                  <TableHead>{t('common.actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {enrollments.map((enr: any) => {
                  const s = enr.student;
                  const u = s?.user;
                  if (!u) return null;
                  return (
                    <TableRow key={enr.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar name={`${u.firstName} ${u.lastName}`} src={u.avatarUrl} size="sm" />
                          <div>
                            <div className="font-bold text-sm text-slate-900 dark:text-slate-100">
                              {u.firstName} {u.lastName}
                            </div>
                            <div className="text-xs text-slate-500 font-mono">{u.loginId}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-xs font-bold">{s.studentCode}</TableCell>
                      <TableCell>
                        <Badge variant="secondary" size="sm">{formatStatus(s.programmingLevel)}</Badge>
                      </TableCell>
                      <TableCell className="font-bold text-amber-600 dark:text-amber-400">
                        {s.totalXp} XP
                      </TableCell>
                      <TableCell className="font-bold text-orange-600 dark:text-orange-400">
                        {formatStreak(s.currentStreak)}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-rose-600 hover:bg-rose-50 dark:border-rose-800"
                          onClick={() => setStudentToRemove({ id: s.id, name: `${u.firstName} ${u.lastName}` })}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>{t('groups.removeStudent')}</span>
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Edit Group Modal */}
      <Dialog
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title={t('groups.editGroup')}
        maxWidth="lg"
      >
        <form onSubmit={handleSaveEdit} className="space-y-4 py-1">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label={t('groups.groupName')}
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              required
            />
            <Input
              label={t('groups.description') || (isArabic ? 'وصف المجموعة' : 'Group Description')}
              placeholder={isArabic ? 'مثال: المستوى الأول - الأساسيات البرمجية' : 'e.g. Level 1 - Python Fundamentals'}
              value={editDescription}
              onChange={(e) => setEditDescription(e.target.value)}
            />
          </div>

          <GroupSchedulePicker
            schedules={editSchedules}
            onChange={setEditSchedules}
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label={t('groups.whatsappGroupUrl') || (isArabic ? 'رابط مجموعة الواتساب' : 'WhatsApp Group Invite Link')}
              type="url"
              placeholder="https://chat.whatsapp.com/..."
              value={editWhatsappGroupUrl}
              onChange={(e) => setEditWhatsappGroupUrl(e.target.value)}
            />
            <Input
              label={t('groups.maxCapacity')}
              type="number"
              value={editMaxCapacity}
              onChange={(e) => setEditMaxCapacity(Number(e.target.value))}
              min={1}
              max={100}
              required
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
            <Button type="button" variant="outline" onClick={() => setIsEditModalOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" isLoading={updateMutation.isPending}>
              {t('common.save')}
            </Button>
          </div>
        </form>
      </Dialog>

      {/* Add Student to Group Modal */}
      <Dialog isOpen={isEnrollModalOpen} onClose={() => setIsEnrollModalOpen(false)} title={t('groups.addStudent')}>
        <div className="space-y-4">
          <Select
            label={t('groups.selectStudent')}
            value={selectedStudentId}
            onChange={(e) => setSelectedStudentId(e.target.value)}
            options={[
              { value: '', label: `-- ${t('groups.selectStudent')} --` },
              ...availableStudents.map((s) => ({
                value: s.id,
                label: `${s.user.firstName} ${s.user.lastName} (${s.studentCode})`
              }))
            ]}
          />

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setIsEnrollModalOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              type="button"
              disabled={!selectedStudentId}
              isLoading={enrollMutation.isPending}
              onClick={() => enrollMutation.mutate(selectedStudentId)}
            >
              {t('groups.addStudent')}
            </Button>
          </div>
        </div>
      </Dialog>

      {/* Delete Group Confirm Dialog */}
      <ConfirmDialog
        isOpen={isDeleteDialogOpen}
        onClose={() => setIsDeleteDialogOpen(false)}
        onConfirm={() => deleteGroupMutation.mutate()}
        title={t('groups.deleteGroup')}
        description={`${t('groups.confirmDelete')} "${group.name}".`}
        isLoading={deleteGroupMutation.isPending}
        isDestructive={true}
      />

      {/* Remove Student Confirm Dialog */}
      <ConfirmDialog
        isOpen={Boolean(studentToRemove)}
        onClose={() => setStudentToRemove(null)}
        onConfirm={() => {
          if (studentToRemove) {
            removeMutation.mutate(studentToRemove.id);
          }
        }}
        title={t('groups.removeStudent')}
        description={`${t('groups.confirmRemoveStudent')} "${studentToRemove?.name}"`}
        isLoading={removeMutation.isPending}
        isDestructive={true}
      />
    </div>
  );
}
