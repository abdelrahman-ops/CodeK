import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../../context/auth-context.js';
import { useTranslation } from 'react-i18next';
import { cn } from '../../lib/utils.js';
import { Logo } from '../ui/logo.js';
import {
  LayoutDashboard,
  CalendarCheck2,
  Users2,
  BookOpen,
  CheckSquare,
  GraduationCap,
  Trophy,
  Award,
  TrendingUp,
  CreditCard,
  Settings,
  Presentation,
  FileCheck2,
  FileText,
  History,
  Send,
  Users,
  QrCode,
  Sparkles,
  HelpCircle,
  X
} from 'lucide-react';

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

interface NavGroup {
  labelKey: string;
  items: {
    to: string;
    labelKey: string;
    icon: React.ComponentType<{ className?: string }>;
    end?: boolean;
  }[];
}

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  const { user } = useAuth();
  const { t } = useTranslation();

  const studentGroups: NavGroup[] = [
    {
      labelKey: 'nav.groupOverview',
      items: [
        { to: '/student', labelKey: 'nav.home', icon: LayoutDashboard, end: true },
        { to: '/student/today', labelKey: 'nav.today', icon: CalendarCheck2 }
      ]
    },
    {
      labelKey: 'nav.groupLearning',
      items: [
        { to: '/student/curriculum', labelKey: 'nav.curriculum', icon: BookOpen },
        { to: '/student/tasks', labelKey: 'nav.tasks', icon: CheckSquare },
        { to: '/student/exams', labelKey: 'nav.exams', icon: GraduationCap }
      ]
    },
    {
      labelKey: 'nav.groupCommunity',
      items: [
        { to: '/student/my-group', labelKey: 'nav.myGroup', icon: Users2 },
        { to: '/student/leaderboard', labelKey: 'nav.leaderboard', icon: Trophy },
        { to: '/student/achievements', labelKey: 'nav.achievements', icon: Award },
        { to: '/student/progress', labelKey: 'nav.progress', icon: TrendingUp }
      ]
    },
    {
      labelKey: 'nav.groupAccount',
      items: [
        { to: '/student/settings', labelKey: 'nav.settings', icon: Settings }
      ]
    }
  ];

  const parentGroups: NavGroup[] = [
    {
      labelKey: 'nav.groupOverview',
      items: [
        { to: '/parent', labelKey: 'nav.dashboard', icon: LayoutDashboard, end: true },
        { to: '/parent/children', labelKey: 'parents.linkedChildren', icon: Users }
      ]
    },
    {
      labelKey: 'nav.groupFinancial',
      items: [
        { to: '/parent/payments', labelKey: 'nav.payments', icon: CreditCard }
      ]
    },
    {
      labelKey: 'nav.groupAccount',
      items: [
        { to: '/parent/settings', labelKey: 'nav.settings', icon: Settings }
      ]
    }
  ];

  const adminGroups: NavGroup[] = [
    {
      labelKey: 'nav.groupOverview',
      items: [
        { to: '/admin', labelKey: 'nav.dashboard', icon: LayoutDashboard, end: true },
        { to: '/admin/sessions', labelKey: 'nav.sessions', icon: CalendarCheck2 }
      ]
    },
    {
      labelKey: 'nav.groupAcademic',
      items: [
        { to: '/admin/registrations', labelKey: 'nav.registrations', icon: FileText },
        { to: '/admin/students', labelKey: 'nav.students', icon: Users },
        { to: '/admin/groups', labelKey: 'nav.groups', icon: Presentation },
        { to: '/admin/parents', labelKey: 'nav.parents', icon: Users2 },
        { to: '/admin/curriculum', labelKey: 'nav.curriculum', icon: BookOpen },
        { to: '/admin/tasks', labelKey: 'nav.tasks', icon: CheckSquare },
        { to: '/admin/submissions', labelKey: 'nav.submissions', icon: FileCheck2 },
        { to: '/admin/exams', labelKey: 'nav.exams', icon: GraduationCap },
        { to: '/admin/leaderboard', labelKey: 'nav.leaderboard', icon: Trophy }
      ]
    },
    {
      labelKey: 'nav.groupFinancial',
      items: [
        { to: '/admin/payments', labelKey: 'nav.payments', icon: CreditCard },
        { to: '/admin/notifications', labelKey: 'nav.notifications', icon: Send },
        { to: '/admin/audit-logs', labelKey: 'nav.auditLogs', icon: History },
        { to: '/admin/settings', labelKey: 'nav.settings', icon: Settings }
      ]
    }
  ];

  const groups =
    user?.role === 'ADMIN'
      ? adminGroups
      : user?.role === 'PARENT'
      ? parentGroups
      : studentGroups;

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          onClick={onClose}
          className="fixed inset-0 z-40 bg-slate-950/60 backdrop-blur-sm lg:hidden transition-opacity"
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={cn(
          'fixed inset-y-0 start-0 z-40 w-60 bg-white dark:bg-slate-900 border-e border-slate-200/80 dark:border-slate-800/80 flex flex-col transition-transform duration-200 lg:static lg:translate-x-0',
          isOpen ? 'translate-x-0' : '-translate-x-full rtl:translate-x-full lg:rtl:translate-x-0'
        )}
      >
        {/* Mobile Header in Drawer */}
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between lg:hidden">
          <Logo size="sm" />
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Content */}
        <div className="flex-1 px-3 py-3 space-y-4 overflow-y-auto scrollbar-thin">
          {groups.map((group, gIdx) => (
            <div key={gIdx} className="space-y-1">
              <div className="px-3 py-1 text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 select-none">
                {t(group.labelKey) || group.labelKey.split('.')[1]}
              </div>

              {group.items.map((link) => {
                const Icon = link.icon;
                return (
                  <NavLink
                    key={link.to}
                    to={link.to}
                    end={link.end}
                    onClick={onClose}
                    className={({ isActive }) =>
                      cn(
                        'flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold transition-all select-none',
                        isActive
                          ? 'bg-brand-50 dark:bg-brand-950/60 text-brand-600 dark:text-brand-400 font-extrabold shadow-sm border border-brand-200/60 dark:border-brand-800/60'
                          : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-slate-100'
                      )
                    }
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span className="truncate">{t(link.labelKey)}</span>
                  </NavLink>
                );
              })}
            </div>
          ))}
        </div>
      </aside>
    </>
  );
}
