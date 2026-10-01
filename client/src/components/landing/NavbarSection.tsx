import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { Logo } from '@/components/ui/logo';
import {
  Languages,
  Sun,
  Moon,
  Menu,
  X,
  ArrowRight,
  ArrowLeft,
  Compass,
  Sparkles,
} from 'lucide-react';
import { subtleHoverButton, subtleTapButton, EASING, DURATION } from './motion';

interface NavbarSectionProps {
  isRtl: boolean;
  theme: string;
  setTheme: (theme: 'light' | 'dark' | 'system') => void;
  toggleLanguage: () => void;
  isAuthenticated: boolean;
  getDashboardPath: () => string;
}

export const NavbarSection: React.FC<NavbarSectionProps> = ({
  isRtl,
  theme,
  setTheme,
  toggleLanguage,
  isAuthenticated,
  getDashboardPath,
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const shouldReduceMotion = useReducedMotion();
  const ArrowIcon = isRtl ? ArrowLeft : ArrowRight;

  const navLinks = [
    { href: '#offer', labelAr: 'ماذا نقدم', labelEn: 'What We Offer' },
    { href: '#how-it-works', labelAr: 'كيف نتعلّم', labelEn: 'How It Works' },
    { href: '#curriculum', labelAr: 'المنهج الأكاديمي', labelEn: 'Curriculum' },
    { href: '#students', labelAr: 'للطلاب', labelEn: 'For Students' },
    { href: '#parents', labelAr: 'لأولياء الأمور', labelEn: 'For Parents' },
    { href: '#about', labelAr: 'عن كودك', labelEn: 'About Founder' },
    { href: '#faq', labelAr: 'الأسئلة الشائعة', labelEn: 'FAQ' },
  ];

  return (
    <motion.header
      initial={shouldReduceMotion ? false : { opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: DURATION.standard, ease: EASING.out }}
      className="sticky top-0 z-50 backdrop-blur-md bg-white/90 dark:bg-slate-950/90 border-b border-slate-200/80 dark:border-slate-800/80 transition-colors"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 sm:h-20 flex items-center justify-between gap-4">
        {/* Logo */}
        <Link
          to="/"
          onClick={(e) => {
            if (window.location.pathname === '/') {
              e.preventDefault();
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }
          }}
          className="shrink-0 flex items-center focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 rounded-xl cursor-pointer"
          title={isRtl ? 'الرئيسية (للأعلى)' : 'Home (Top)'}
        >
          <Logo size="md" forceShowTextOnMobile />
        </Link>

        {/* Desktop Navigation Links */}
        <nav className="hidden lg:flex items-center gap-0.5 xl:gap-1.5">
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="px-2.5 xl:px-3 py-1.5 rounded-lg text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-brand-600 dark:hover:text-brand-400 hover:bg-slate-100 dark:hover:bg-slate-900 transition-colors whitespace-nowrap"
            >
              {isRtl ? link.labelAr : link.labelEn}
            </a>
          ))}
        </nav>

        {/* Right Action Area */}
        <div className="flex items-center gap-2 sm:gap-2.5">
          {/* Language Toggle (Icon Only) */}
          <motion.button
            whileHover={shouldReduceMotion ? undefined : subtleHoverButton}
            whileTap={shouldReduceMotion ? undefined : subtleTapButton}
            onClick={toggleLanguage}
            aria-label="Toggle language"
            title={isRtl ? 'Switch to English' : 'التبديل إلى العربية'}
            className="p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-900 border border-slate-200/80 dark:border-slate-800 transition cursor-pointer shrink-0"
          >
            <Languages className="w-4 h-4 text-brand-500" />
          </motion.button>

          {/* Theme Toggle (Light / Dark Only) */}
          <motion.button
            whileHover={shouldReduceMotion ? undefined : subtleHoverButton}
            whileTap={shouldReduceMotion ? undefined : subtleTapButton}
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            aria-label="Toggle theme"
            title={theme === 'dark' ? (isRtl ? 'الوضع المضيء' : 'Light mode') : (isRtl ? 'الوضع المظلم' : 'Dark mode')}
            className="p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-900 border border-slate-200/80 dark:border-slate-800 transition cursor-pointer shrink-0"
          >
            {theme === 'dark' ? (
              <Sun className="w-4 h-4 text-amber-400" />
            ) : (
              <Moon className="w-4 h-4 text-brand-500" />
            )}
          </motion.button>

          {/* Auth Actions: Prominent CTA + Log In */}
          {isAuthenticated ? (
            <motion.div
              whileHover={shouldReduceMotion ? undefined : subtleHoverButton}
              whileTap={shouldReduceMotion ? undefined : subtleTapButton}
            >
              <Link
                to={getDashboardPath()}
                className="inline-flex items-center gap-2 px-3.5 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-bold bg-brand-600 hover:bg-brand-700 text-white shadow-sm shadow-brand-600/30 transition whitespace-nowrap"
              >
                <Compass className="w-4 h-4" />
                <span>{isRtl ? 'لوحة التحكم' : 'Dashboard'}</span>
              </Link>
            </motion.div>
          ) : (
            <motion.div
              whileHover={shouldReduceMotion ? undefined : subtleHoverButton}
              whileTap={shouldReduceMotion ? undefined : subtleTapButton}
              className="hidden sm:inline-block"
            >
              <Link
                to="/register"
                className="inline-flex items-center gap-1.5 px-3.5 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-bold bg-gradient-to-r from-brand-600 via-brand-500 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 text-white shadow-md shadow-brand-500/25 hover:shadow-brand-500/40 border border-brand-400/20 transition-all duration-200 whitespace-nowrap cursor-pointer group"
              >
                <span>{isRtl ? 'ابدأ التعلّم' : 'Start Learning'}</span>
                <ArrowIcon className="w-3.5 h-3.5 group-hover:translate-x-0.5 rtl:group-hover:-translate-x-0.5 transition-transform" />
              </Link>
            </motion.div>
          )}

          {/* Mobile Hamburger Button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Open navigation menu"
            className="lg:hidden p-2 rounded-xl text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-900 border border-slate-200/80 dark:border-slate-800 transition cursor-pointer"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Navigation Drawer with AnimatePresence */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: DURATION.fast + 0.05, ease: EASING.out }}
            className="lg:hidden border-b border-slate-200 dark:border-slate-800 bg-white/98 dark:bg-slate-950/98 backdrop-blur-lg px-4 pt-3 pb-6 space-y-3 overflow-hidden"
          >
            <nav className="flex flex-col space-y-1">
              {navLinks.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className="px-3 py-2.5 rounded-lg text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-900 transition"
                >
                  {isRtl ? link.labelAr : link.labelEn}
                </a>
              ))}
            </nav>

            {!isAuthenticated && (
              <div className="pt-3 border-t border-slate-200 dark:border-slate-800">
                <Link
                  to="/register"
                  onClick={() => setMobileMenuOpen(false)}
                  className="w-full py-2.5 text-center rounded-xl text-sm font-bold bg-gradient-to-r from-brand-600 to-indigo-600 text-white shadow-md shadow-brand-600/25 transition flex items-center justify-center gap-2"
                >
                  <span>{isRtl ? 'ابدأ التعلّم الآن' : 'Start Learning Now'}</span>
                </Link>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.header>
  );
};
