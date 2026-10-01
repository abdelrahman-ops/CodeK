import React, { useState, useEffect } from 'react';
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
  X,
  ChevronLeft,
  ChevronRight,
  PanelLeftClose,
  PanelLeftOpen
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
  const { t, i18n } = useTranslation();
  const isRtl = i18n.language === 'ar';

  const [isCollapsed, setIsCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem('codek_sidebar_collapsed') === 'true';
    } catch {
      return false;
    }
  });

  const toggleCollapsed = () => {
    setIsCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('codek_sidebar_collapsed', String(next));
      } catch {}
      return next;
    });
  };

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
        { to: '/student/courses', labelKey: 'nav.courses', icon: BookOpen },
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
        { to: '/student/subscription', labelKey: 'nav.subscription', icon: CreditCard },
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
        { to: '/admin/billing', labelKey: 'nav.billing', icon: CreditCard },
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
          'fixed inset-y-0 start-0 z-40 bg-white dark:bg-slate-900 border-e border-slate-200/80 dark:border-slate-800/80 flex flex-col transition-all duration-300 lg:static lg:translate-x-0 relative',
          isCollapsed ? 'lg:w-20' : 'lg:w-64',
          'w-64',
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

        {/* Sleek Floating Arrow in Top Corner Aside — Zero space taken from sidebar */}
        <button
          onClick={toggleCollapsed}
          type="button"
          title={isCollapsed ? (isRtl ? 'توسيع القائمة' : 'Expand Sidebar') : (isRtl ? 'طي القائمة' : 'Collapse Sidebar')}
          className={cn(
            'hidden lg:flex absolute top-3.5 z-50 w-6 h-6 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm items-center justify-center text-slate-500 hover:text-brand-600 dark:hover:text-brand-400 hover:border-brand-400 transition-all cursor-pointer',
            isRtl ? '-left-3' : '-right-3'
          )}
        >
          {isCollapsed ? (
            isRtl ? <ChevronLeft className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />
          ) : (
            isRtl ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronLeft className="w-3.5 h-3.5" />
          )}
        </button>

        {/* Navigation Content */}
        <div className={cn(
          'flex-1 space-y-4 overflow-y-auto scrollbar-thin transition-all',
          isCollapsed ? 'px-2 py-3' : 'px-3 py-3.5'
        )}>
          {groups.map((group, gIdx) => (
            <div key={gIdx} className="space-y-1">
              {isCollapsed ? (
                gIdx > 0 && <div className="my-2 border-t border-slate-100 dark:border-slate-800" />
              ) : (
                <div className="px-3.5 py-1 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 select-none">
                  {t(group.labelKey) || group.labelKey.split('.')[1]}
                </div>
              )}

              {group.items.map((link) => {
                const Icon = link.icon;
                const label = t(link.labelKey);

                return (
                  <NavLink
                    key={link.to}
                    to={link.to}
                    end={link.end}
                    onClick={onClose}
                    title={isCollapsed ? label : undefined}
                    className={({ isActive }) =>
                      cn(
                        'flex items-center rounded-xl text-sm font-semibold transition-all select-none group',
                        isCollapsed
                          ? 'justify-center w-11 h-11 mx-auto'
                          : 'gap-3 px-3.5 py-2.5',
                        isActive
                          ? 'bg-brand-50/90 dark:bg-brand-950/80 text-brand-700 dark:text-brand-300 font-bold shadow-xs border border-brand-200/80 dark:border-brand-700/60'
                          : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/60 hover:text-slate-950 dark:hover:text-white'
                      )
                    }
                  >
                    <Icon className="w-[18px] h-[18px] shrink-0" />
                    {!isCollapsed && <span className="truncate">{label}</span>}
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
