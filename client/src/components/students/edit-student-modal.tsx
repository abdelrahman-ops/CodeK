import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api/client.js';
import { Dialog } from '../ui/dialog.js';
import { Input } from '../ui/input.js';
import { Select } from '../ui/select.js';
import { Button } from '../ui/button.js';
import { useToast } from '../ui/toast.js';
import { localizeText } from '../../lib/i18n-helpers.js';

interface EditStudentModalProps {
  isOpen: boolean;
  onClose: () => void;
  student: any | null;
  groups?: Array<{ id: string; name: any }>;
  onSaved?: () => void;
}

export function EditStudentModal({
  isOpen,
  onClose,
  student,
  groups = [],
  onSaved
}: EditStudentModalProps) {
  const { t, i18n } = useTranslation();
  const isRtl = i18n.language === 'ar';
  const toast = useToast();
  const queryClient = useQueryClient();

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [grade, setGrade] = useState('');
  const [groupId, setGroupId] = useState('');
  const [programmingLevel, setProgrammingLevel] = useState('BEGINNER');
  const [schoolName, setSchoolName] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [attendanceRequired, setAttendanceRequired] = useState(false);

  useEffect(() => {
    if (student) {
      const u = student.user || {};
      setFirstName(u.firstName || '');
      setLastName(u.lastName || '');
      setEmail(u.email || '');
      setPhone(u.phone || '');
      setGrade(student.grade || '');
      const activeEnrollment = (student.enrollments || []).find((e: any) => e.isActive);
      setGroupId(activeEnrollment?.groupId || activeEnrollment?.group?.id || '');
      setProgrammingLevel(student.programmingLevel || 'BEGINNER');
      setSchoolName(student.schoolName || '');
      setIsActive(u.isActive !== false);
      setAttendanceRequired(Boolean(student.attendanceRequired));
    }
  }, [student, isOpen]);

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!student?.id) return;
      const payload: any = {
        firstName: firstName.trim() || undefined,
        lastName: lastName.trim() || undefined,
        email: email.trim() || undefined,
        phone: phone.trim() || null,
        grade: grade || null,
        groupId: groupId || null,
        programmingLevel,
        schoolName: schoolName.trim() || null,
        isActive,
        attendanceRequired
      };
      return (await api.students.update(student.id, payload)).data.data;
    },
    onSuccess: () => {
      toast.success(isRtl ? 'تم تحديث بيانات الطالب بنجاح' : 'Student updated successfully');
      queryClient.invalidateQueries({ queryKey: ['adminStudents'] });
      queryClient.invalidateQueries({ queryKey: ['adminStudentDetail', student?.id] });
      queryClient.invalidateQueries({ queryKey: ['groups'] });
      onClose();
      if (onSaved) onSaved();
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error?.message || t('common.error'));
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstName.trim() || !lastName.trim()) {
      toast.error(isRtl ? 'الاسم الأول واسم العائلة مطلوبان' : 'First and last name are required');
      return;
    }
    updateMutation.mutate();
  };

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title={isRtl ? 'تعديل بيانات الطالب' : 'Edit Student Profile'}
      maxWidth="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4 pt-2">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              {t('auth.firstName')} <span className="text-rose-500">*</span>
            </label>
            <Input
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              placeholder="e.g. أحمد"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              {t('auth.lastName')} <span className="text-rose-500">*</span>
            </label>
            <Input
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              placeholder="e.g. محمد"
              required
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              {t('auth.email')}
            </label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="student@example.com"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              {t('auth.phone')}
            </label>
            <Input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="01xxxxxxxxx"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              {isRtl ? 'الصف الدراسي' : 'Student Grade'}
            </label>
            <Select
              value={grade}
              onChange={(e: any) => setGrade(e.target.value)}
              options={[
                { value: '', label: isRtl ? 'غير محدد' : 'Unassigned' },
                { value: 'GRADE_1', label: isRtl ? 'الصف الأول الثانوي (Grade 10)' : 'Grade 10 (Secondary 1)' },
                { value: 'GRADE_2', label: isRtl ? 'الصف الثاني الثانوي (Grade 11)' : 'Grade 11 (Secondary 2)' },
                { value: 'GRADE_3', label: isRtl ? 'الصف الثالث الثانوي (Grade 12)' : 'Grade 12 (Secondary 3)' }
              ]}
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              {t('students.group')}
            </label>
            <Select
              value={groupId}
              onChange={(e: any) => setGroupId(e.target.value)}
              options={[
                { value: '', label: isRtl ? 'بدون مجموعة' : 'No Group' },
                ...(groups.map((g) => ({
                  value: g.id,
                  label: localizeText(g.name)
                })) || [])
              ]}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              {t('students.programmingLevel')}
            </label>
            <Select
              value={programmingLevel}
              onChange={(e: any) => setProgrammingLevel(e.target.value)}
              options={[
                { value: 'BEGINNER', label: isRtl ? 'مبتدئ' : 'Beginner' },
                { value: 'INTERMEDIATE', label: isRtl ? 'متوسط' : 'Intermediate' },
                { value: 'ADVANCED', label: isRtl ? 'متقدم' : 'Advanced' }
              ]}
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              {isRtl ? 'المدرسة' : 'School'}
            </label>
            <Input
              value={schoolName}
              onChange={(e) => setSchoolName(e.target.value)}
              placeholder="e.g. مدرسة النيل الثانوية"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              {isRtl ? 'المسار التعليمي' : 'Learning Track'}
            </label>
            <Select
              value={attendanceRequired ? 'HYBRID' : 'ONLINE'}
              onChange={(e: any) => setAttendanceRequired(e.target.value === 'HYBRID')}
              options={[
                { value: 'ONLINE', label: isRtl ? 'أونلاين بالكامل' : '100% Online' },
                { value: 'HYBRID', label: isRtl ? 'مدمج (حضوري + أونلاين)' : 'Hybrid (In-Person + Online)' }
              ]}
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              {isRtl ? 'حالة الحساب' : 'Account Status'}
            </label>
            <Select
              value={isActive ? 'ACTIVE' : 'INACTIVE'}
              onChange={(e: any) => setIsActive(e.target.value === 'ACTIVE')}
              options={[
                { value: 'ACTIVE', label: isRtl ? 'نشط (مسموح بالدخول)' : 'Active (Login Enabled)' },
                { value: 'INACTIVE', label: isRtl ? 'معطل (محظور مؤقتاً)' : 'Inactive (Suspended)' }
              ]}
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-4 border-t border-slate-100 dark:border-slate-800">
          <Button type="button" variant="outline" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" isLoading={updateMutation.isPending} className="bg-brand-600 hover:bg-brand-700 text-white font-bold">
            {t('common.save')}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
