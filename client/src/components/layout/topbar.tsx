import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/auth-context.js';
import { useUiStore } from '../../store/ui-store.js';
import { useTranslation } from 'react-i18next';
import { setAppLanguage } from '../../i18n/index.js';
import {
  Bell,
  Sun,
  Moon,
  Laptop,
  Languages,
  LogOut,
  Flame,
  Star,
  Trophy,
  Menu,
  Check,
  Shield
} from 'lucide-react';
import { Avatar } from '../ui/avatar.js';
import { Badge } from '../ui/badge.js';
import { Logo } from '../ui/logo.js';
import { api } from '../../lib/api/client.js';
import { NotificationItem } from '../../types/api.js';
import { formatStatus, localizeText, formatStreak } from '../../lib/i18n-helpers.js';

interface TopbarProps {
  onToggleSidebar?: () => void;
}

export function Topbar({ onToggleSidebar }: TopbarProps) {
  const { user, logout } = useAuth();
  const { theme, setTheme } = useUiStore();
  const { t, i18n } = useTranslation();

  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);

  useEffect(() => {
    if (user) {
      api.notifications.list({ unreadOnly: true })
        .then((res) => setNotifications(res.data.data))
        .catch(() => {});
    }
  }, [user]);

  const toggleLanguage = () => {
    const nextLang = i18n.language === 'ar' ? 'en' : 'ar';
    setAppLanguage(nextLang);
  };

  const handleMarkAllRead = async () => {
    try {
      await api.notifications.markAllAsRead();
      setNotifications([]);
    } catch {}
  };

  const isStudent = user?.role === 'STUDENT';
  const student = user?.student;

  return (
    <header className="sticky top-0 z-30 h-16 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800/80 px-4 lg:px-6 flex items-center justify-between transition-colors">
      {/* Left: Mobile menu button + Academy Brand Logo */}
      <div className="flex items-center gap-3">
        <button
          onClick={onToggleSidebar}
          className="lg:hidden p-2 rounded-xl text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          aria-label="Toggle navigation"
        >
          <Menu className="w-5 h-5" />
        </button>

        <Logo size="md" />
      </div>

      {/* Center: Student Quick Gamification Badges (SVG Icons only, zero emojis) */}
      {isStudent && student && (
        <div className="hidden md:flex items-center gap-3">
          {/* Streak */}
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-400 font-semibold text-xs">
            <Flame className="w-4 h-4 fill-amber-500 text-amber-500 animate-pulse" />
            <span>{formatStreak(student.currentStreak)}</span>
          </div>

          {/* XP */}
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-brand-50 dark:bg-brand-950/60 border border-brand-200 dark:border-brand-800 text-brand-700 dark:text-brand-300 font-semibold text-xs">
            <Star className="w-4 h-4 fill-brand-500 text-brand-500" />
            <span>{student.totalXp} XP</span>
          </div>

          {/* Anon Code */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-mono font-bold text-xs border border-slate-200/60 dark:border-slate-700">
            <Shield className="w-3.5 h-3.5 text-brand-500" />
            <span>{student.anonymousLeaderboardCode}</span>
          </div>
        </div>
      )}

      {/* Right: Actions (Language, Theme, Notifications, User) */}
      <div className="flex items-center gap-2">
        {/* Language Switcher */}
        <button
          onClick={toggleLanguage}
          className="flex items-center gap-1.5 p-2 sm:px-2.5 sm:py-1.5 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 transition"
          title="Switch Language"
        >
          <Languages className="w-4 h-4 text-brand-500" />
          <span className="hidden sm:inline">{i18n.language === 'ar' ? 'English' : 'العربية'}</span>
        </button>

        {/* Theme Toggle */}
        <div className="relative">
          <button
            onClick={() => {
              if (theme === 'light') setTheme('dark');
              else if (theme === 'dark') setTheme('system');
              else setTheme('light');
            }}
            className="p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            title={`Current Theme: ${theme}`}
          >
            {theme === 'light' ? (
              <Sun className="w-4 h-4 text-amber-500" />
            ) : theme === 'dark' ? (
              <Moon className="w-4 h-4 text-brand-400" />
            ) : (
              <Laptop className="w-4 h-4" />
            )}
          </button>
        </div>

        {/* Notification Bell */}
        <div className="relative">
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className="relative p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            <Bell className="w-4 h-4" />
            {notifications.length > 0 && (
              <span className="absolute top-1.5 end-1.5 w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
            )}
          </button>

          {/* Notifications Dropdown */}
          {showNotifications && (
            <div className="absolute end-0 mt-2 w-80 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl p-3 z-50 animate-in fade-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100 dark:border-slate-800">
                <span className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                  {t('nav.notifications')}
                </span>
                {notifications.length > 0 && (
                  <button
                    onClick={handleMarkAllRead}
                    className="text-[11px] font-semibold text-brand-600 dark:text-brand-400 hover:underline"
                  >
                    {t('notifications.markAllAsRead')}
                  </button>
                )}
              </div>

              <div className="max-h-60 overflow-y-auto space-y-2">
                {notifications.length === 0 ? (
                  <div className="text-center py-4 text-xs text-slate-400">
                    {t('notifications.noNotifications')}
                  </div>
                ) : (
                  notifications.map((n) => (
                    <div
                      key={n.id}
                      className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/60 text-xs"
                    >
                      <div className="font-semibold text-slate-900 dark:text-slate-100">{localizeText(n.title)}</div>
                      <div className="text-slate-500 dark:text-slate-400 mt-0.5">{localizeText(n.message)}</div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* User Profile */}
        <div className="relative">
          <button
            onClick={() => setShowUserMenu(!showUserMenu)}
            className="flex items-center gap-2 p-1 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            <Avatar name={`${user?.firstName} ${user?.lastName}`} size="sm" />
            <span className="hidden sm:inline text-xs font-medium text-slate-800 dark:text-slate-200">
              {user?.firstName}
            </span>
          </button>

          {showUserMenu && (
            <div className="absolute end-0 mt-2 w-56 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl p-2 z-50 animate-in fade-in zoom-in-95 duration-150">
              <div className="p-3 border-b border-slate-100 dark:border-slate-800">
                <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  {user?.firstName} {user?.lastName}
                </div>
                <div className="text-xs text-slate-500 font-mono mt-0.5">{user?.loginId}</div>
                <Badge
                  variant={user?.role === 'ADMIN' ? 'danger' : user?.role === 'PARENT' ? 'warning' : 'primary'}
                  size="sm"
                  className="mt-2"
                >
                  {formatStatus(user?.role)}
                </Badge>
              </div>

              <div className="pt-1">
                <button
                  onClick={logout}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-xl transition"
                >
                  <LogOut className="w-4 h-4" />
                  <span>{t('nav.logout')}</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
