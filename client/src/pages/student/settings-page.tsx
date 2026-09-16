import React, { useState } from 'react';
import { useAuth } from '../../context/auth-context.js';
import { useUiStore, ACCENT_PALETTES } from '../../store/ui-store.js';
import { useTranslation } from 'react-i18next';
import { setAppLanguage } from '../../i18n/index.js';
import { api } from '../../lib/api/client.js';
import {
  Settings,
  User,
  Shield,
  Languages,
  Sun,
  Moon,
  Laptop,
  Lock,
  Star,
  CheckCircle2,
  CalendarCheck2,
  CheckSquare,
  Zap,
  GraduationCap,
  Award,
  Trophy,
  HelpCircle,
  Palette,
  Check
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/card.js';
import { Button } from '../../components/ui/button.js';
import { Input } from '../../components/ui/input.js';
import { PasswordInput } from '../../components/ui/password-input.js';
import { Badge } from '../../components/ui/badge.js';
import { Dialog } from '../../components/ui/dialog.js';
import { useToast } from '../../components/ui/toast.js';
import { formatStatus } from '../../lib/i18n-helpers.js';

export function SettingsPage() {
  const { user } = useAuth();
  const { theme, setTheme, accent, setAccent } = useUiStore();
  const { t, i18n } = useTranslation();
  const toast = useToast();

  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleLanguageChange = (lang: 'ar' | 'en') => {
    setAppLanguage(lang);
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast.error(t('auth.passwordsDoNotMatch'));
      return;
    }

    setIsLoading(true);
    try {
      await api.auth.changePassword({ currentPassword, newPassword });
      toast.success(t('auth.passwordChangedSuccess'));
      setIsPasswordModalOpen(false);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      toast.error(err.response?.data?.error?.message || t('common.error'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-slate-100 flex items-center gap-2.5">
          <Settings className="w-7 h-7 text-brand-600 dark:text-brand-400" />
          <span>{t('settings.title')}</span>
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          {t('settings.subtitle')}
        </p>
      </div>

      {/* Profile Overview Card */}
      <Card className="p-5 sm:p-6 border-slate-200/80 dark:border-slate-800/80 shadow-sm space-y-4">
        <CardTitle className="text-base font-black flex items-center gap-2">
          <User className="w-5 h-5 text-brand-500" />
          <span>{t('nav.profile')}</span>
        </CardTitle>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs sm:text-sm">
          <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/60">
            <span className="text-slate-400 block text-[11px] font-bold uppercase">{t('students.firstName')}</span>
            <span className="font-bold text-slate-900 dark:text-slate-100 mt-0.5 block">
              {user?.firstName} {user?.lastName}
            </span>
          </div>

          <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/60">
            <span className="text-slate-400 block text-[11px] font-bold uppercase">{t('auth.loginId')}</span>
            <span className="font-mono font-bold text-slate-900 dark:text-slate-100 mt-0.5 block">
              {user?.loginId}
            </span>
          </div>

          <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/60">
            <span className="text-slate-400 block text-[11px] font-bold uppercase">{t('auditLogs.entity')}</span>
            <Badge variant="primary" size="sm" className="mt-1">
              {formatStatus(user?.role)}
            </Badge>
          </div>
        </div>
      </Card>

      {/* SECTION: SCORING & XP SYSTEM EXPLANATION */}
      <Card className="p-5 sm:p-6 border-slate-200/80 dark:border-slate-800/80 shadow-sm space-y-4">
        <div>
          <CardTitle className="text-base font-black flex items-center gap-2 text-slate-900 dark:text-slate-100">
            <HelpCircle className="w-5 h-5 text-amber-500" />
            <span>{t('scoring.title')}</span>
          </CardTitle>
          <p className="text-xs text-slate-500 mt-1">
            {t('scoring.subtitle')}
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          {/* Attendance */}
          <div className="p-4 rounded-2xl bg-slate-50/70 dark:bg-slate-800/50 border border-slate-200/70 dark:border-slate-700/70 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="font-black text-sm text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <CalendarCheck2 className="w-4 h-4 text-brand-500" />
                <span>{t('scoring.attendanceTitle')}</span>
              </span>
              <Badge variant="primary" size="sm">+10 XP</Badge>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed">
              {t('scoring.attendanceDesc')}
            </p>
          </div>

          {/* Daily Tasks */}
          <div className="p-4 rounded-2xl bg-slate-50/70 dark:bg-slate-800/50 border border-slate-200/70 dark:border-slate-700/70 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="font-black text-sm text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <CheckSquare className="w-4 h-4 text-brand-500" />
                <span>{t('scoring.taskTitle')}</span>
              </span>
              <Badge variant="primary" size="sm">+30 XP</Badge>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed">
              {t('scoring.taskDesc')}
            </p>
          </div>

          {/* Challenges */}
          <div className="p-4 rounded-2xl bg-slate-50/70 dark:bg-slate-800/50 border border-slate-200/70 dark:border-slate-700/70 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="font-black text-sm text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Zap className="w-4 h-4 text-amber-500" />
                <span>{t('scoring.challengeTitle')}</span>
              </span>
              <Badge variant="primary" size="sm">+50 XP</Badge>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed">
              {t('scoring.challengeDesc')}
            </p>
          </div>

          {/* Monthly Exams */}
          <div className="p-4 rounded-2xl bg-slate-50/70 dark:bg-slate-800/50 border border-slate-200/70 dark:border-slate-700/70 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="font-black text-sm text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <GraduationCap className="w-4 h-4 text-emerald-500" />
                <span>{t('scoring.examTitle')}</span>
              </span>
              <Badge variant="success" size="sm">{t('scoring.examTitle')}</Badge>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed">
              {t('scoring.examDesc')}
            </p>
          </div>
        </div>

        {/* Leaderboard Rules Box */}
        <div className="p-4 rounded-2xl bg-amber-50/60 dark:bg-amber-950/30 border border-amber-200/60 dark:border-amber-800/60 text-xs text-amber-900 dark:text-amber-300 space-y-1">
          <div className="font-black flex items-center gap-1.5">
            <Trophy className="w-4 h-4 text-amber-500" />
            <span>{t('scoring.leaderboardTitle')}</span>
          </div>
          <p className="leading-relaxed text-amber-800 dark:text-amber-400">
            {t('scoring.leaderboardDesc')}
          </p>
        </div>
      </Card>

      {/* COMPACT ACCENT COLOR PALETTE SELECTOR */}
      <Card className="p-5 sm:p-6 border-slate-200/80 dark:border-slate-800/80 shadow-sm space-y-4">
        <div>
          <CardTitle className="text-base font-black flex items-center gap-2 text-slate-900 dark:text-slate-100">
            <Palette className="w-5 h-5 text-brand-500" />
            <span>{t('settings.accentColor')}</span>
          </CardTitle>
          <p className="text-xs text-slate-500 mt-1">
            {t('settings.accentColorSubtitle')}
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2.5">
          {ACCENT_PALETTES.map((pal) => {
            const isSelected = accent === pal.id;
            const localizedName = i18n.language === 'ar' ? pal.nameAr : pal.name;

            return (
              <button
                key={pal.id}
                onClick={() => setAccent(pal.id)}
                className={`p-2.5 rounded-2xl border transition flex flex-col items-center gap-2 text-xs font-bold select-none ${
                  isSelected
                    ? 'bg-slate-100 dark:bg-slate-800 border-brand-500 ring-2 ring-brand-500/30 text-slate-900 dark:text-slate-100 shadow-sm'
                    : 'bg-slate-50/70 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700/80 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-600'
                }`}
              >
                <div className="relative">
                  <span
                    className="w-7 h-7 rounded-full shadow-sm flex items-center justify-center transition-transform"
                    style={{ backgroundColor: pal.previewColor }}
                  >
                    {isSelected && <Check className="w-4 h-4 text-white stroke-[3]" />}
                  </span>
                </div>
                <span className="truncate max-w-[84px]">{localizedName}</span>
              </button>
            );
          })}
        </div>
      </Card>

      {/* Preferences & Security */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Language Selection */}
        <Card className="p-5 sm:p-6 border-slate-200/80 dark:border-slate-800/80 shadow-sm space-y-3">
          <CardTitle className="text-base font-black flex items-center gap-2">
            <Languages className="w-5 h-5 text-brand-500" />
            <span>{t('settings.language')}</span>
          </CardTitle>

          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => handleLanguageChange('en')}
              className={`p-3 rounded-2xl border text-xs font-bold transition flex items-center justify-center gap-2 ${i18n.language === 'en' ? 'bg-brand-50 dark:bg-brand-950/80 border-brand-500 text-brand-600 dark:text-brand-400' : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700'}`}
            >
              <span>English (LTR)</span>
            </button>
            <button
              onClick={() => handleLanguageChange('ar')}
              className={`p-3 rounded-2xl border text-xs font-bold transition flex items-center justify-center gap-2 ${i18n.language === 'ar' ? 'bg-brand-50 dark:bg-brand-950/80 border-brand-500 text-brand-600 dark:text-brand-400' : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700'}`}
            >
              <span>العربية (RTL)</span>
            </button>
          </div>
        </Card>

        {/* Theme Mode Selection */}
        <Card className="p-5 sm:p-6 border-slate-200/80 dark:border-slate-800/80 shadow-sm space-y-3">
          <CardTitle className="text-base font-black flex items-center gap-2">
            <Sun className="w-5 h-5 text-amber-500" />
            <span>{t('settings.theme')}</span>
          </CardTitle>

          <div className="grid grid-cols-3 gap-2">
            <button
              onClick={() => setTheme('light')}
              className={`p-2.5 rounded-2xl border text-xs font-bold transition flex flex-col items-center gap-1.5 ${theme === 'light' ? 'bg-brand-50 dark:bg-brand-950/80 border-brand-500 text-brand-600 dark:text-brand-400' : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700'}`}
            >
              <Sun className="w-4 h-4" />
              <span>{t('settings.light')}</span>
            </button>
            <button
              onClick={() => setTheme('dark')}
              className={`p-2.5 rounded-2xl border text-xs font-bold transition flex flex-col items-center gap-1.5 ${theme === 'dark' ? 'bg-brand-50 dark:bg-brand-950/80 border-brand-500 text-brand-600 dark:text-brand-400' : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700'}`}
            >
              <Moon className="w-4 h-4" />
              <span>{t('settings.dark')}</span>
            </button>
            <button
              onClick={() => setTheme('system')}
              className={`p-2.5 rounded-2xl border text-xs font-bold transition flex flex-col items-center gap-1.5 ${theme === 'system' ? 'bg-brand-50 dark:bg-brand-950/80 border-brand-500 text-brand-600 dark:text-brand-400' : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700'}`}
            >
              <Laptop className="w-4 h-4" />
              <span>{t('settings.system')}</span>
            </button>
          </div>
        </Card>
      </div>

      {/* Security */}
      <Card className="p-5 sm:p-6 border-slate-200/80 dark:border-slate-800/80 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center justify-center">
            <Lock className="w-5 h-5" />
          </div>
          <div>
            <h4 className="font-bold text-sm text-slate-900 dark:text-slate-100">
              {t('settings.changePassword')}
            </h4>
            <p className="text-xs text-slate-500">{t('settings.changePassword')}</p>
          </div>
        </div>

        <Button variant="outline" size="sm" onClick={() => setIsPasswordModalOpen(true)}>
          {t('settings.changePassword')}
        </Button>
      </Card>

      {/* Change Password Dialog */}
      <Dialog
        isOpen={isPasswordModalOpen}
        onClose={() => setIsPasswordModalOpen(false)}
        title={t('settings.changePassword')}
        maxWidth="sm"
      >
        <form onSubmit={handlePasswordChange} className="space-y-4 py-2">
          <PasswordInput
            label={t('auth.currentPassword')}
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            required
          />
          <PasswordInput
            label={t('auth.newPassword')}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
          />
          <PasswordInput
            label={t('auth.confirmNewPassword')}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
          />

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => setIsPasswordModalOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" isLoading={isLoading}>
              {t('common.save')}
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
