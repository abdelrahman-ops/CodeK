import React from 'react';
import { useTranslation } from 'react-i18next';
import { setAppLanguage } from '../../i18n/index.js';
import { useUiStore } from '../../store/ui-store.js';
import { Logo } from '../ui/logo.js';
import { Languages, Sun, Moon, Laptop } from 'lucide-react';

export function AuthHeader() {
  const { i18n } = useTranslation();
  const { theme, setTheme } = useUiStore();

  const toggleLanguage = () => {
    const nextLang = i18n.language === 'ar' ? 'en' : 'ar';
    setAppLanguage(nextLang);
  };

  return (
    <div className="flex items-center justify-between w-full pb-4 sm:pb-6 shrink-0">
      <Logo size="md" />

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={toggleLanguage}
          aria-label="Toggle language"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 transition cursor-pointer"
        >
          <Languages className="w-4 h-4 text-brand-500" />
          <span>{i18n.language === 'ar' ? 'English' : 'العربية'}</span>
        </button>

        <button
          type="button"
          onClick={() => {
            if (theme === 'light') setTheme('dark');
            else if (theme === 'dark') setTheme('system');
            else setTheme('light');
          }}
          aria-label="Toggle theme"
          className="p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 transition cursor-pointer"
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
    </div>
  );
}
