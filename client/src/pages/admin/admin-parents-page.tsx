import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api/client.js';
import { useTranslation } from 'react-i18next';
import {
  Users,
  Plus,
  Link as LinkIcon,
  Copy,
  CheckCircle2,
  Phone,
  Edit2,
  Trash2,
  Shield,
  ArrowRight
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/card.js';
import { Button } from '../../components/ui/button.js';
import { Input } from '../../components/ui/input.js';
import { Select } from '../../components/ui/select.js';
import { Badge } from '../../components/ui/badge.js';
import { Avatar } from '../../components/ui/avatar.js';
import { Dialog } from '../../components/ui/dialog.js';
import { ConfirmDialog } from '../../components/ui/confirm-dialog.js';
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
import { localizeText, formatStatus } from '../../lib/i18n-helpers.js';

export function AdminParentsPage() {
  const { t } = useTranslation();
  const toast = useToast();
  const queryClient = useQueryClient();

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);
  const [isEditRelModalOpen, setIsEditRelModalOpen] = useState(false);

  const [selectedParentId, setSelectedParentId] = useState<string | null>(null);
  const [selectedParentName, setSelectedParentName] = useState<string>('');
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [selectedStudentName, setSelectedStudentName] = useState('');
  const [relationship, setRelationship] = useState('FATHER');
  const [createdParentData, setCreatedParentData] = useState<any | null>(null);

  // Form State for new Parent
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [preferredChannel, setPreferredChannel] = useState('WHATSAPP');

  const { data: parents, isLoading } = useQuery({
    queryKey: ['adminParents'],
    queryFn: async () => (await api.parents.list()).data.data
  });

  const { data: students } = useQuery({
    queryKey: ['studentsList'],
    queryFn: async () => (await api.students.list()).data.data
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => (await api.parents.create(data)).data.data,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['adminParents'] });
      setCreatedParentData(data);
      toast.success(t('common.success'));
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error?.message || t('common.error'));
    }
  });

  const linkMutation = useMutation({
    mutationFn: async (data: any) => (await api.parents.linkChild(data)).data.data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminParents'] });
      setIsLinkModalOpen(false);
      setSelectedParentId(null);
      setSelectedStudentId('');
      toast.success(t('parents.relationshipUpdated'));
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error?.message || t('common.error'));
    }
  });

  const updateRelMutation = useMutation({
    mutationFn: async (data: any) => (await api.parents.updateRelationship(data)).data.data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminParents'] });
      setIsEditRelModalOpen(false);
      setSelectedParentId(null);
      setSelectedStudentId('');
      toast.success(t('parents.relationshipUpdated'));
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error?.message || t('common.error'));
    }
  });

  const unlinkMutation = useMutation({
    mutationFn: async (data: { parentId: string; studentId: string }) =>
      (await api.parents.unlinkChild(data.parentId, data.studentId)).data.data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminParents'] });
      toast.success(t('common.success'));
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error?.message || t('common.error'));
    }
  });

  const handleCreateParent = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate({
      firstName,
      lastName,
      phone,
      email: email.trim() || undefined,
      preferredChannel
    });
  };

  const handleLinkStudent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedParentId || !selectedStudentId) return;
    linkMutation.mutate({
      parentId: selectedParentId,
      studentId: selectedStudentId,
      relationship
    });
  };

  const handleUpdateRelationship = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedParentId || !selectedStudentId) return;
    updateRelMutation.mutate({
      parentId: selectedParentId,
      studentId: selectedStudentId,
      relationship
    });
  };

  const [unlinkToConfirm, setUnlinkToConfirm] = useState<{ parentId: string; studentId: string; parentName: string; childName: string } | null>(null);

  const handleRemoveRelationship = (parentId: string, studentId: string, parentName: string, childName: string) => {
    setUnlinkToConfirm({ parentId, studentId, parentName, childName });
  };

  const openEditRelModal = (parentId: string, studentId: string, parentName: string, studentName: string, currentRel: string) => {
    setSelectedParentId(parentId);
    setSelectedStudentId(studentId);
    setSelectedParentName(parentName);
    setSelectedStudentName(studentName);
    setRelationship(currentRel);
    setIsEditRelModalOpen(true);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success(t('common.copied'));
  };

  // Find currently selected parent's existing linked student IDs to prevent duplicate additions
  const currentSelectedParent = parents?.find((p: any) => p.parent?.id === selectedParentId);
  const existingLinkedStudentIds = new Set(
    (currentSelectedParent?.parent?.children || []).map((rel: any) => rel.studentId)
  );

  const availableStudents = (students || []).filter((s: any) => !existingLinkedStudentIds.has(s.id));

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-slate-100 flex items-center gap-2.5">
            <Users className="w-7 h-7 text-brand-600 dark:text-brand-400" />
            <span>{t('nav.parents')}</span>
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            {t('parents.subtitle')}
          </p>
        </div>

        <Button onClick={() => setIsAddModalOpen(true)}>
          <Plus className="w-4 h-4" />
          <span>{t('parents.createParent')}</span>
        </Button>
      </div>

      {isLoading ? (
        <TableSkeleton rows={5} />
      ) : (
        <>
          {/* Mobile Card List (sm:hidden) */}
          <div className="sm:hidden space-y-4">
            {parents?.map((parent: any) => {
              const children = parent.parent?.children || [];
              const parentFullName = `${parent.firstName} ${parent.lastName}`;

              return (
                <Card key={parent.id} className="p-4 space-y-3.5 border-slate-200/80 dark:border-slate-800/80">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Avatar name={parentFullName} size="sm" />
                      <div>
                        <div className="font-bold text-sm text-slate-900 dark:text-slate-100">
                          {parentFullName}
                        </div>
                        <div className="text-xs font-mono text-slate-500 font-bold">
                          {parent.parent?.parentCode}
                        </div>
                      </div>
                    </div>

                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setSelectedParentId(parent.parent.id);
                        setSelectedParentName(parentFullName);
                        setIsLinkModalOpen(true);
                      }}
                    >
                      <LinkIcon className="w-3.5 h-3.5" />
                      <span>{t('parents.linkChild')}</span>
                    </Button>
                  </div>

                  {/* Linked Relationships with Clear Display and Actions */}
                  <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-2">
                    <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                      {t('parents.linkedChildren')} ({children.length})
                    </div>

                    {children.length > 0 ? (
                      <div className="space-y-1.5">
                        {children.map((rel: any) => {
                          const childName = `${rel.student.user.firstName} ${rel.student.user.lastName}`;
                          return (
                            <div
                              key={rel.id}
                              className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200/60 dark:border-slate-700/60 flex items-center justify-between gap-2 text-xs"
                            >
                              <div className="flex items-center gap-1.5 min-w-0">
                                <span className="font-bold text-slate-900 dark:text-slate-100 truncate">{childName}</span>
                                <Badge variant="primary" size="sm">
                                  {formatStatus(rel.relationship)}
                                </Badge>
                              </div>

                              <div className="flex items-center gap-1 shrink-0">
                                <button
                                  onClick={() => openEditRelModal(parent.parent.id, rel.student.id, parentFullName, childName, rel.relationship)}
                                  className="p-1 rounded-lg text-slate-400 hover:text-brand-600 dark:hover:text-brand-400 hover:bg-slate-100 dark:hover:bg-slate-700 transition"
                                  title={t('parents.editRelationship')}
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => handleRemoveRelationship(parent.parent.id, rel.student.id, parentFullName, childName)}
                                  className="p-1 rounded-lg text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition"
                                  title={t('parents.unlinkChild')}
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="text-xs text-slate-400 italic">{t('common.noData')}</div>
                    )}
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
                  <TableHead>{t('roles.parent')}</TableHead>
                  <TableHead>{t('parents.parentCode')}</TableHead>
                  <TableHead>{t('parents.phone')}</TableHead>
                  <TableHead>{t('parents.linkedChildren')}</TableHead>
                  <TableHead>{t('common.actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {parents?.map((parent: any) => {
                  const children = parent.parent?.children || [];
                  const parentFullName = `${parent.firstName} ${parent.lastName}`;

                  return (
                    <TableRow key={parent.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar name={parentFullName} size="sm" />
                          <div className="font-bold text-slate-900 dark:text-slate-100">
                            {parentFullName}
                          </div>
                        </div>
                      </TableCell>

                      <TableCell>
                        <span className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-xs font-mono font-bold">
                          {parent.parent?.parentCode}
                        </span>
                      </TableCell>

                      <TableCell>
                        <span className="text-xs font-mono text-slate-600 dark:text-slate-400">
                          {parent.phone}
                        </span>
                      </TableCell>

                      <TableCell>
                        <div className="flex flex-col gap-1.5 max-w-md">
                          {children.length > 0 ? (
                            children.map((rel: any) => {
                              const childName = `${rel.student.user.firstName} ${rel.student.user.lastName}`;
                              return (
                                <div
                                  key={rel.id}
                                  className="inline-flex items-center justify-between gap-3 px-2.5 py-1 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200/60 dark:border-slate-700/60 text-xs"
                                >
                                  <div className="flex items-center gap-1.5">
                                    <span className="font-medium text-slate-600 dark:text-slate-400">{parent.firstName}</span>
                                    <ArrowRight className="w-3 h-3 text-slate-400 rtl:rotate-180" />
                                    <span className="font-bold text-slate-900 dark:text-slate-100">{childName}</span>
                                    <Badge variant="primary" size="sm">
                                      {formatStatus(rel.relationship)}
                                    </Badge>
                                  </div>

                                  <div className="flex items-center gap-1">
                                    <button
                                      onClick={() => openEditRelModal(parent.parent.id, rel.student.id, parentFullName, childName, rel.relationship)}
                                      className="p-1 rounded-lg text-slate-400 hover:text-brand-600 dark:hover:text-brand-400 transition"
                                      title={t('parents.editRelationship')}
                                    >
                                      <Edit2 className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      onClick={() => handleRemoveRelationship(parent.parent.id, rel.student.id, parentFullName, childName)}
                                      className="p-1 rounded-lg text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 transition"
                                      title={t('parents.unlinkChild')}
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </div>
                              );
                            })
                          ) : (
                            <span className="text-xs text-slate-400">{t('common.noData')}</span>
                          )}
                        </div>
                      </TableCell>

                      <TableCell>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setSelectedParentId(parent.parent.id);
                            setSelectedParentName(parentFullName);
                            setIsLinkModalOpen(true);
                          }}
                        >
                          <LinkIcon className="w-3.5 h-3.5" />
                          <span>{t('parents.linkChild')}</span>
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </>
      )}

      {/* Create Parent Modal */}
      <Dialog
        isOpen={isAddModalOpen}
        onClose={() => {
          setIsAddModalOpen(false);
          setCreatedParentData(null);
        }}
        title={t('parents.createParent')}
        maxWidth="md"
      >
        {createdParentData ? (
          <div className="space-y-4 py-3">
            <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 space-y-2">
              <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-200 font-bold">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                <span>{t('common.success')}</span>
              </div>
              <p className="text-xs text-emerald-700 dark:text-emerald-300 leading-relaxed">
                {t('students.tempPassword')}
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-100 dark:bg-slate-800 space-y-2 font-mono text-sm">
              <div className="flex justify-between items-center">
                <span className="text-slate-500">{t('parents.parentCode')}:</span>
                <span className="font-bold text-slate-900 dark:text-slate-100">
                  {createdParentData.parent.parentCode}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500">{t('students.tempPassword')}:</span>
                <span className="font-bold text-brand-600 dark:text-brand-400">
                  {createdParentData.temporaryPassword}
                </span>
              </div>
            </div>

            <div className="flex justify-between gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  const text = `CodeK Login Credentials:\nLogin ID: ${createdParentData.parent.parentCode}\nPassword: ${createdParentData.temporaryPassword}`;
                  copyToClipboard(text);
                }}
                className="w-full"
              >
                <Copy className="w-4 h-4" />
                <span>{t('students.copyCredentials')}</span>
              </Button>
              <Button
                type="button"
                onClick={() => {
                  setIsAddModalOpen(false);
                  setCreatedParentData(null);
                }}
                className="w-full"
              >
                {t('common.close')}
              </Button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleCreateParent} className="space-y-4 py-2">
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
              label={t('parents.phone')}
              type="tel"
              placeholder="010xxxxxxxx"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
            />

            <Input
              label={t('students.email')}
              type="email"
              placeholder="name@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="ghost" onClick={() => setIsAddModalOpen(false)}>
                {t('common.cancel')}
              </Button>
              <Button type="submit" isLoading={createMutation.isPending}>
                {t('parents.createParent')}
              </Button>
            </div>
          </form>
        )}
      </Dialog>

      {/* Link Child Modal */}
      <Dialog
        isOpen={isLinkModalOpen}
        onClose={() => setIsLinkModalOpen(false)}
        title={`${t('parents.linkChild')} — ${selectedParentName}`}
        maxWidth="md"
      >
        <form onSubmit={handleLinkStudent} className="space-y-4 py-2">
          {availableStudents.length === 0 ? (
            <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-xs text-amber-800 dark:text-amber-200">
              {t('common.noData')}
            </div>
          ) : (
            <Select
              label={t('parents.selectChild')}
              value={selectedStudentId}
              onChange={(e: any) => setSelectedStudentId(e.target.value)}
              options={[
                { value: '', label: t('parents.selectChild') },
                ...availableStudents.map((s: any) => ({
                  value: s.id,
                  label: `${s.user.firstName} ${s.user.lastName} (${s.studentCode})`
                }))
              ]}
              required
            />
          )}

          <Select
            label={t('parents.relationship')}
            value={relationship}
            onChange={(e: any) => setRelationship(e.target.value)}
            options={[
              { value: 'FATHER', label: t('parents.father') },
              { value: 'MOTHER', label: t('parents.mother') },
              { value: 'GUARDIAN', label: t('parents.guardian') },
              { value: 'OTHER', label: t('parents.other') }
            ]}
            required
          />

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => setIsLinkModalOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" isLoading={linkMutation.isPending} disabled={availableStudents.length === 0}>
              {t('parents.linkChild')}
            </Button>
          </div>
        </form>
      </Dialog>

      {/* Edit Relationship Modal */}
      <Dialog
        isOpen={isEditRelModalOpen}
        onClose={() => setIsEditRelModalOpen(false)}
        title={`${t('parents.editRelationship')} — ${selectedStudentName}`}
        maxWidth="sm"
      >
        <form onSubmit={handleUpdateRelationship} className="space-y-4 py-2">
          <p className="text-xs text-slate-500">
            {t('parents.editRelationship')}: <strong className="text-slate-900 dark:text-slate-100">{selectedParentName}</strong> & <strong className="text-slate-900 dark:text-slate-100">{selectedStudentName}</strong>.
          </p>

          <Select
            label={t('parents.relationship')}
            value={relationship}
            onChange={(e: any) => setRelationship(e.target.value)}
            options={[
              { value: 'FATHER', label: t('parents.father') },
              { value: 'MOTHER', label: t('parents.mother') },
              { value: 'GUARDIAN', label: t('parents.guardian') },
              { value: 'OTHER', label: t('parents.other') }
            ]}
            required
          />

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => setIsEditRelModalOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" isLoading={updateRelMutation.isPending}>
              {t('common.save')}
            </Button>
          </div>
        </form>
      </Dialog>

      {/* Confirm Unlink Child Dialog */}
      <ConfirmDialog
        isOpen={Boolean(unlinkToConfirm)}
        onClose={() => setUnlinkToConfirm(null)}
        onConfirm={() => {
          if (unlinkToConfirm) {
            unlinkMutation.mutate(
              { parentId: unlinkToConfirm.parentId, studentId: unlinkToConfirm.studentId },
              { onSuccess: () => setUnlinkToConfirm(null) }
            );
          }
        }}
        title={t('parents.unlinkChild')}
        description={`${t('parents.confirmUnlink')} (${unlinkToConfirm?.parentName} - ${unlinkToConfirm?.childName})`}
        isLoading={unlinkMutation.isPending}
        isDestructive={true}
      />
    </div>
  );
}
