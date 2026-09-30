import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/auth-context.js';
import { useTranslation } from 'react-i18next';
import { cn } from '../../lib/utils.js';
import {
  CalendarCheck2,
  BookOpen,
  CheckSquare,
  Trophy,
  MoreHorizontal,
  Users2,
  Award,
  TrendingUp,
  Settings,
  CreditCard,
  LogOut,
  LayoutDashboard,
  Presentation,
  Users,
  FileCheck2,
  X
} from 'lucide-react';
import { Dialog } from '../ui/dialog.js';

export function MobileNav() {
  const { user, logout } = useAuth();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [isMoreOpen, setIsMoreOpen] = useState(false);

  if (!user) return null;

  const role = user.role.toLowerCase();

  const studentPrimary = [
    { to: '/student', label: t('nav.home'), icon: LayoutDashboard },
    { to: '/student/courses', label: t('nav.courses'), icon: BookOpen },
    { to: '/student/tasks', label: t('nav.tasks'), icon: CheckSquare },
    { to: '/student/subscription', label: t('nav.subscription'), icon: CreditCard }
  ];

  const studentMore = [
    { to: '/student/today', label: t('nav.today'), icon: CalendarCheck2 },
    { to: '/student/leaderboard', label: t('nav.leaderboard'), icon: Trophy },
    { to: '/student/my-group', label: t('nav.myGroup'), icon: Users2 },
    { to: '/student/achievements', label: t('nav.achievements'), icon: Award },
    { to: '/student/progress', label: t('nav.progress'), icon: TrendingUp },
    { to: '/student/settings', label: t('nav.settings'), icon: Settings }
  ];

  const parentPrimary = [
    { to: '/parent', label: t('nav.dashboard'), icon: LayoutDashboard },
    { to: '/parent/children', label: t('parents.linkedChildren'), icon: Users },
    { to: '/parent/payments', label: t('nav.payments'), icon: CreditCard },
    { to: '/parent/settings', label: t('nav.settings'), icon: Settings }
  ];

  const adminPrimary = [
    { to: '/admin', label: t('nav.dashboard'), icon: LayoutDashboard },
    { to: '/admin/sessions', label: t('nav.sessions'), icon: CalendarCheck2 },
    { to: '/admin/students', label: t('nav.students'), icon: Users },
    { to: '/admin/submissions', label: t('nav.submissions'), icon: FileCheck2 }
  ];

  const adminMore = [
    { to: '/admin/groups', label: t('nav.groups'), icon: Presentation },
    { to: '/admin/parents', label: t('nav.parents'), icon: Users2 },
    { to: '/admin/curriculum', label: t('nav.curriculum'), icon: BookOpen },
    { to: '/admin/tasks', label: t('nav.tasks'), icon: CheckSquare },
    { to: '/admin/leaderboard', label: t('nav.leaderboard'), icon: Trophy },
    { to: '/admin/billing', label: t('nav.billing'), icon: CreditCard },
    { to: '/admin/payments', label: t('nav.payments'), icon: CreditCard },
    { to: '/admin/settings', label: t('nav.settings'), icon: Settings }
  ];

  const primaryLinks =
    role === 'student' ? studentPrimary : role === 'parent' ? parentPrimary : adminPrimary;

  const moreLinks =
    role === 'student' ? studentMore : role === 'admin' ? adminMore : [];

  return (
    <>
      <nav className="fixed bottom-0 inset-x-0 z-30 bg-white/95 dark:bg-slate-900/95 backdrop-blur-lg border-t border-slate-200/80 dark:border-slate-800/80 lg:hidden px-2 py-1 flex items-center justify-around select-none shadow-lg">
        {primaryLinks.map((link) => {
          const Icon = link.icon;
          return (
            <NavLink
              key={link.to}
              to={link.to}
              className={({ isActive }) =>
                cn(
                  'flex flex-col items-center gap-1 py-1.5 px-3 rounded-2xl text-[11px] font-medium transition-all min-w-[56px]',
                  isActive
                    ? 'text-brand-600 dark:text-brand-400 bg-brand-50/60 dark:bg-brand-950/60'
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                )
              }
            >
              <Icon className="w-5 h-5 shrink-0" />
              <span className="truncate max-w-[64px]">{link.label}</span>
            </NavLink>
          );
        })}

        {moreLinks.length > 0 && (
          <button
            type="button"
            onClick={() => setIsMoreOpen(true)}
            className="flex flex-col items-center gap-1 py-1.5 px-3 rounded-2xl text-[11px] font-medium text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 min-w-[56px]"
          >
            <MoreHorizontal className="w-5 h-5 shrink-0" />
            <span>{t('common.more') || 'More'}</span>
          </button>
        )}
      </nav>

      {/* Mobile "More" Slide-up Drawer / Sheet */}
      <Dialog
        isOpen={isMoreOpen}
        onClose={() => setIsMoreOpen(false)}
        title={t('common.moreMenu') || 'Academy Menu'}
        maxWidth="sm"
      >
        <div className="space-y-2 py-2">
          <div className="grid grid-cols-2 gap-2">
            {moreLinks.map((link) => {
              const Icon = link.icon;
              return (
                <button
                  key={link.to}
                  onClick={() => {
                    setIsMoreOpen(false);
                    navigate(link.to);
                  }}
                  className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 hover:bg-brand-50 dark:hover:bg-brand-950/40 border border-slate-200/60 dark:border-slate-700/60 flex flex-col items-center text-center gap-2 transition"
                >
                  <div className="w-9 h-9 rounded-xl bg-white dark:bg-slate-700 text-brand-600 dark:text-brand-400 flex items-center justify-center shadow-sm">
                    <Icon className="w-5 h-5" />
                  </div>
                  <span className="text-xs font-medium text-slate-800 dark:text-slate-200">
                    {link.label}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="pt-3 border-t border-slate-100 dark:border-slate-800">
            <button
              onClick={() => {
                setIsMoreOpen(false);
                logout();
              }}
              className="w-full p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 font-medium text-xs flex items-center justify-center gap-2 border border-rose-200 dark:border-rose-800/60"
            >
              <LogOut className="w-4 h-4" />
              <span>{t('nav.logout')}</span>
            </button>
          </div>
        </div>
      </Dialog>
    </>
  );
}
