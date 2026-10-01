import React from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { setAppLanguage } from '../../i18n/index.js';
import { useUiStore } from '../../store/ui-store.js';
import { Logo } from '../../components/ui/logo.js';
import { Languages, Sun, Moon, Laptop } from 'lucide-react';

export function AuthLayout() {
  const { t, i18n } = useTranslation();
  const { theme, setTheme } = useUiStore();
  const location = useLocation();

  const isFullPageAuth = location.pathname.startsWith('/login') || location.pathname.startsWith('/register');

  if (isFullPageAuth) {
    return (
      <div className="min-h-screen min-h-[100dvh] w-full overflow-x-hidden bg-white dark:bg-slate-950 transition-colors duration-200">
        <Outlet />
      </div>
    );
  }

  const toggleLanguage = () => {
    const nextLang = i18n.language === 'ar' ? 'en' : 'ar';
    setAppLanguage(nextLang);
  };

  return (
    <div className="min-h-screen min-h-[100dvh] overflow-x-hidden bg-slate-50 dark:bg-slate-950 flex flex-col justify-between transition-colors duration-200">
      {/* Top Header */}
      <header className="p-4 sm:p-6 max-w-7xl w-full mx-auto flex items-center justify-between shrink-0">
        <Logo size="md" />

        <div className="flex items-center gap-2">
          <button
            onClick={toggleLanguage}
            aria-label="Toggle language"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 transition cursor-pointer"
          >
            <Languages className="w-4 h-4 text-brand-500" />
            <span>{i18n.language === 'ar' ? 'English' : 'العربية'}</span>
          </button>

          <button
            onClick={() => {
              if (theme === 'light') setTheme('dark');
              else if (theme === 'dark') setTheme('system');
              else setTheme('light');
            }}
            aria-label="Toggle theme"
            className="p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 transition cursor-pointer"
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
      </header>

      {/* Main Outlet Container */}
      <main className="flex-1 flex flex-col items-center justify-center p-3 sm:p-6 py-4 sm:py-8 w-full">
        <div className="w-full max-w-5xl mx-auto flex justify-center my-auto">
          <Outlet />
        </div>
      </main>

      {/* Footer */}
      <footer className="p-4 text-center text-xs text-slate-400 dark:text-slate-600 font-medium shrink-0">
        &copy; {new Date().getFullYear()} {t('common.appName')}. {t('common.allRightsReserved') || 'All rights reserved.'}
      </footer>
    </div>
  );
}
