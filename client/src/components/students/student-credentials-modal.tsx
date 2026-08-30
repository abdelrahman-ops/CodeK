import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog } from '../ui/dialog.js';
import { Button } from '../ui/button.js';
import { Check, Copy, MessageCircle, ShieldCheck } from 'lucide-react';
import { useToast } from '../ui/toast.js';

export interface StudentCredentialsData {
  studentId: string;
  loginId: string;
  studentName: string;
  phone?: string | null;
  temporaryPassword: string;
  groupName?: string | null;
  groupSchedule?: string | null;
  whatsappGroupUrl?: string | null;
}

interface StudentCredentialsModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: StudentCredentialsData | null;
  title?: string;
}

export function StudentCredentialsModal({
  isOpen,
  onClose,
  data,
  title
}: StudentCredentialsModalProps) {
  const { t, i18n } = useTranslation();
  const toast = useToast();
  const [copied, setCopied] = useState(false);

  if (!data) return null;

  const isArabic = i18n.language === 'ar';
  const loginUrl = window.location.origin + '/login';

  const generateMessage = (includeGroupLink: boolean = false) => {
    if (isArabic) {
      let msg = `أهلاً بك في أكاديمية البرمجة.\nتم إعداد بيانات حسابك في الأكاديمية.\n\nرابط الدخول:\n${loginUrl}\n\nرقم الدخول:\n${data.loginId}\n\nكلمة المرور المؤقتة:\n${data.temporaryPassword}`;

      if (data.groupName) {
        msg += `\n\nالمجموعة:\n${data.groupName}`;
      }
      if (data.groupSchedule) {
        msg += `\n\nالموعد:\n${data.groupSchedule}`;
      }
      if (includeGroupLink && data.whatsappGroupUrl) {
        msg += `\n\nرابط مجموعة الواتساب:\n${data.whatsappGroupUrl}`;
      }

      msg += `\n\nيرجى تغيير كلمة المرور بعد أول تسجيل دخول.`;
      return msg;
    } else {
      let msg = `Welcome to the Coding Academy.\nYour account credentials have been prepared.\n\nLogin URL:\n${loginUrl}\n\nLogin ID:\n${data.loginId}\n\nTemporary Password:\n${data.temporaryPassword}`;

      if (data.groupName) {
        msg += `\n\nGroup:\n${data.groupName}`;
      }
      if (data.groupSchedule) {
        msg += `\n\nSchedule:\n${data.groupSchedule}`;
      }
      if (includeGroupLink && data.whatsappGroupUrl) {
        msg += `\n\nWhatsApp Group Link:\n${data.whatsappGroupUrl}`;
      }

      msg += `\n\nPlease change your password after your first login.`;
      return msg;
    }
  };

  const handleCopy = async () => {
    const text = generateMessage(Boolean(data.whatsappGroupUrl));
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success(t('common.copied') || 'Credentials copied to clipboard');
      setTimeout(() => setCopied(false), 2500);
    } catch {
      toast.error('Failed to copy');
    }
  };

  const handleWhatsApp = (includeGroupLink: boolean = false) => {
    const text = generateMessage(includeGroupLink);
    const encodedText = encodeURIComponent(text);

    let phoneNormalized = data.phone ? data.phone.replace(/\D/g, '') : '';
    if (phoneNormalized.startsWith('01') && phoneNormalized.length === 11) {
      phoneNormalized = '20' + phoneNormalized.substring(1); // Egypt country code
    }

    const waUrl = phoneNormalized
      ? `https://wa.me/${phoneNormalized}?text=${encodedText}`
      : `https://wa.me/?text=${encodedText}`;

    window.open(waUrl, '_blank', 'noopener,noreferrer');
  };

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title={title || (t('students.credentialsTitle') || 'Student Login Credentials')}
      description={t('students.credentialsSubtitle') || 'Share these temporary credentials with the student'}
      maxWidth="lg"
    >
      <div className="space-y-5">
        <div className="p-4 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 rounded-2xl flex items-start gap-3 text-xs text-amber-800 dark:text-amber-300">
          <ShieldCheck className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div>
            <strong className="font-bold">{t('students.temporarySecurityNotice') || 'Temporary Credentials Security'}:</strong>
            <p className="mt-0.5 leading-relaxed">
              {t('students.temporarySecurityDesc') ||
                'This temporary password will only be shown now. The student will be required to choose a new password upon first login.'}
            </p>
          </div>
        </div>

        <div className="p-4 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-3 font-mono text-sm">
          <div className="flex justify-between items-center pb-2 border-b border-slate-200/60 dark:border-slate-800/60">
            <span className="text-slate-500 dark:text-slate-400 text-xs font-sans">{t('students.name') || 'Student Name'}:</span>
            <span className="font-bold text-slate-800 dark:text-slate-200 font-sans">{data.studentName}</span>
          </div>

          <div className="flex justify-between items-center pb-2 border-b border-slate-200/60 dark:border-slate-800/60">
            <span className="text-slate-500 dark:text-slate-400 text-xs font-sans">{t('auth.loginId') || 'Login ID'}:</span>
            <span className="font-black text-brand-600 dark:text-brand-400 text-base">{data.loginId}</span>
          </div>

          <div className="flex justify-between items-center pb-2 border-b border-slate-200/60 dark:border-slate-800/60">
            <span className="text-slate-500 dark:text-slate-400 text-xs font-sans">{t('auth.temporaryPassword') || 'Temporary Password'}:</span>
            <span className="font-black text-rose-600 dark:text-rose-400 text-base">{data.temporaryPassword}</span>
          </div>

          {data.groupName && (
            <div className="flex justify-between items-center pb-2 border-b border-slate-200/60 dark:border-slate-800/60">
              <span className="text-slate-500 dark:text-slate-400 text-xs font-sans">{t('groups.group') || 'Group'}:</span>
              <span className="font-medium text-slate-700 dark:text-slate-300 font-sans">{data.groupName}</span>
            </div>
          )}

          {data.groupSchedule && (
            <div className="flex justify-between items-center pb-2 border-b border-slate-200/60 dark:border-slate-800/60">
              <span className="text-slate-500 dark:text-slate-400 text-xs font-sans">{t('groups.schedule') || 'Schedule'}:</span>
              <span className="font-medium text-slate-700 dark:text-slate-300 font-sans">{data.groupSchedule}</span>
            </div>
          )}

          {data.whatsappGroupUrl && (
            <div className="flex justify-between items-center">
              <span className="text-slate-500 dark:text-slate-400 text-xs font-sans">{t('groups.whatsappGroup') || 'WhatsApp Group'}:</span>
              <span className="text-emerald-600 dark:text-emerald-400 text-xs font-sans truncate max-w-[200px]">{data.whatsappGroupUrl}</span>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
          <Button variant="outline" onClick={handleCopy} className="gap-1.5 text-xs">
            {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
            <span>{copied ? (t('common.copied') || 'Copied') : (t('common.copyCredentials') || 'Copy Credentials')}</span>
          </Button>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => handleWhatsApp(false)}
              className="gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10"
            >
              <MessageCircle className="w-4 h-4" />
              <span>{t('common.sendWhatsApp') || 'Send WhatsApp'}</span>
            </Button>

            {data.whatsappGroupUrl && (
              <Button
                variant="primary"
                onClick={() => handleWhatsApp(true)}
                className="gap-1.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                <MessageCircle className="w-4 h-4" />
                <span>{t('common.sendWhatsAppWithGroup') || 'Send WhatsApp + Group'}</span>
              </Button>
            )}

            <Button variant="outline" onClick={onClose} className="text-xs">
              {t('common.done') || 'Done'}
            </Button>
          </div>
        </div>
      </div>
    </Dialog>
  );
}
