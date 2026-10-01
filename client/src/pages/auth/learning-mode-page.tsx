import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Globe, MapPin, CheckCircle2, ArrowRight, ShieldCheck, Sparkles, Building2 } from 'lucide-react';
import { useAuth } from '../../context/auth-context.js';
import { Button } from '../../components/ui/button.js';
import { useToast } from '../../components/ui/toast.js';
import { cn } from '../../lib/utils.js';

export function LearningModePage() {
  const { t, i18n } = useTranslation();
  const isRtl = i18n.language === 'ar';
  const navigate = useNavigate();
  const toast = useToast();
  const { user, selectLearningMode } = useAuth();

  const [selectedMode, setSelectedMode] = useState<'ONLINE' | 'HYBRID' | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConfirm = async () => {
    if (!selectedMode) {
      setError(isRtl ? 'يرجى اختيار نظام التعلم أولاً للمتابعة.' : 'Please select a learning mode to proceed.');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      await selectLearningMode(selectedMode);
      toast.success(
        isRtl
          ? 'تم تأكيد نظام التعلم بنجاح! مرحباً بك في CodeK Academy.'
          : 'Learning track selected successfully! Welcome to CodeK Academy.'
      );
      navigate('/student', { replace: true });
    } catch (err: any) {
      const msg =
        err.response?.data?.error?.message ||
        err.response?.data?.error ||
        (isRtl ? 'فشل حفظ الاختيار. يرجى المحاولة مرة أخرى.' : 'Failed to save selection. Please try again.');
      setError(msg);
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="w-full max-w-3xl mx-auto p-4 sm:p-8 bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-100 dark:border-slate-800">
      <div className="text-center mb-8">
        <div className="inline-flex items-center gap-2 px-3 py-1 bg-brand-50 dark:bg-brand-950/60 text-brand-700 dark:text-brand-300 rounded-full text-xs font-semibold uppercase tracking-wider mb-3">
          <Sparkles className="w-3.5 h-3.5" />
          <span>{t('onboarding.stepBadge', 'Onboarding — Step 2 of 2')}</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-slate-100">
          {t('onboarding.selectLearningModeTitle', 'Choose Your Learning Mode')}
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-2 max-w-xl mx-auto">
          {t(
            'onboarding.selectLearningModeSubtitle',
            'CodeK Academy offers both online-first and hybrid physical tracks. Select the track that matches your schedule.'
          )}
        </p>
      </div>

      {error && (
        <div className="mb-6 p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-xl text-center text-sm text-red-600 dark:text-red-400">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        {/* Option 1: Full Online */}
        <div
          onClick={() => {
            setSelectedMode('ONLINE');
            if (error) setError(null);
          }}
          className={cn(
            'relative cursor-pointer rounded-2xl p-6 border-2 transition-all duration-200 flex flex-col justify-between text-start',
            selectedMode === 'ONLINE'
              ? 'border-brand-500 bg-brand-50/50 dark:bg-brand-950/20 shadow-md ring-2 ring-brand-500/20'
              : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-slate-50/50 dark:bg-slate-900/50'
          )}
        >
          {selectedMode === 'ONLINE' && (
            <div className="absolute top-4 end-4 w-6 h-6 bg-brand-500 text-white rounded-full flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          )}
          <div>
            <div className="w-12 h-12 rounded-xl bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 flex items-center justify-center mb-4">
              <Globe className="w-6 h-6" />
            </div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                {t('onboarding.fullOnlineTitle', 'Full Online Track')}
              </h2>
              <span className="text-[11px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-md bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300">
                {t('onboarding.onlineTag', 'Online-First')}
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
              {t(
                'onboarding.fullOnlineDesc',
                'Learn 100% remotely from home at your own pace with continuous instructor feedback.'
              )}
            </p>

            <div className="mt-5 space-y-2.5 text-xs text-slate-600 dark:text-slate-300">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                <span>{t('onboarding.featFullCurriculum', 'Full video curriculum & tasks')}</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                <span>{t('onboarding.featOnlineExams', 'Online exams, quizzes & grading')}</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                <span>{t('onboarding.featNoSatAttendance', 'No Saturday physical attendance required')}</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                <span>{t('onboarding.featOnlinePayment', 'Online card / smart wallet payment')}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Option 2: Hybrid */}
        <div
          onClick={() => {
            setSelectedMode('HYBRID');
            if (error) setError(null);
          }}
          className={cn(
            'relative cursor-pointer rounded-2xl p-6 border-2 transition-all duration-200 flex flex-col justify-between text-start',
            selectedMode === 'HYBRID'
              ? 'border-brand-500 bg-brand-50/50 dark:bg-brand-950/20 shadow-md ring-2 ring-brand-500/20'
              : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-slate-50/50 dark:bg-slate-900/50'
          )}
        >
          {selectedMode === 'HYBRID' && (
            <div className="absolute top-4 end-4 w-6 h-6 bg-brand-500 text-white rounded-full flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          )}
          <div>
            <div className="w-12 h-12 rounded-xl bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-400 flex items-center justify-center mb-4">
              <Building2 className="w-6 h-6" />
            </div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                {t('onboarding.hybridTitle', 'Hybrid Physical Track')}
              </h2>
              <span className="text-[11px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-md bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300">
                {t('onboarding.hybridTag', 'Physical + Online')}
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
              {t(
                'onboarding.hybridDesc',
                'Combines full digital platform access with in-person Saturday classroom sessions.'
              )}
            </p>

            <div className="mt-5 space-y-2.5 text-xs text-slate-600 dark:text-slate-300">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                <span>{t('onboarding.featFullCurriculum', 'Full video curriculum & tasks')}</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                <span>{t('onboarding.featSatSessions', 'Saturday in-person sessions & mentor review')}</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                <span>{t('onboarding.featSatAttendanceRequired', 'Saturday physical attendance required')}</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                <span>{t('onboarding.featInPersonPayment', 'Cash or electronic payment at academy reception')}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="p-4 bg-slate-50 dark:bg-slate-950/60 rounded-2xl border border-slate-200/60 dark:border-slate-800 mb-8 flex items-start gap-3">
        <ShieldCheck className="w-5 h-5 text-brand-600 dark:text-brand-400 shrink-0 mt-0.5" />
        <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
          <strong>{t('onboarding.importantNote', 'Important note')}:</strong>{' '}
          {t(
            'onboarding.modeLockNotice',
            'Once you select your learning mode, it is set for your account. To change your track later, please contact the academy administration.'
          )}
        </p>
      </div>

      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="text-xs text-slate-400">
          {selectedMode
            ? t('onboarding.selectedPrompt', 'Selected: {{mode}}', { mode: selectedMode })
            : t('onboarding.chooseOnePrompt', 'Please choose a track to continue')}
        </div>
        <Button
          onClick={handleConfirm}
          disabled={!selectedMode || submitting}
          className="w-full sm:w-auto px-8 py-3 rounded-xl font-semibold flex items-center justify-center gap-2"
        >
          <span>{submitting ? t('common.saving', 'Saving...') : t('onboarding.confirmAndEnter', 'Confirm & Enter Academy')}</span>
          <ArrowRight className="w-4 h-4 rtl:rotate-180" />
        </Button>
      </div>
    </div>
  );
}
