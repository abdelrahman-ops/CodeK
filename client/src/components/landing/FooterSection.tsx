import React from 'react';
import { Link } from 'react-router-dom';
import { Logo } from '@/components/ui/logo';

interface FooterSectionProps {
  isRtl: boolean;
}

export const FooterSection: React.FC<FooterSectionProps> = ({ isRtl }) => {
  return (
    <footer className="border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 py-12 text-slate-600 dark:text-slate-400 text-xs sm:text-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 pb-8 border-b border-slate-200 dark:border-slate-800 items-center">
          <div className="md:col-span-5 space-y-3 text-center md:text-start">
            <Logo size="md" />
            <p className="max-w-sm text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              {isRtl
                ? 'أكاديمية تعليم البرمجة والذكاء الاصطناعي لطلاب المدارس بأسلوب هندسي تطبيقي متكامل.'
                : 'Rigorous programming and AI education academy for preparatory and secondary students.'}
            </p>
          </div>

          <div className="md:col-span-7 flex flex-wrap items-center justify-center md:justify-end gap-6 text-xs font-semibold">
            <a href="#offer" className="hover:text-brand-600 dark:hover:text-brand-400 transition">
              {isRtl ? 'ماذا نقدم' : 'What We Offer'}
            </a>
            <a href="#curriculum" className="hover:text-brand-600 dark:hover:text-brand-400 transition">
              {isRtl ? 'المنهج الأكاديمي' : 'Curriculum'}
            </a>
            <a href="#about" className="hover:text-brand-600 dark:hover:text-brand-400 transition">
              {isRtl ? 'عن كودك' : 'About'}
            </a>
            <Link to="/login" className="hover:text-brand-600 dark:hover:text-brand-400 transition">
              {isRtl ? 'تسجيل الدخول' : 'Login'}
            </Link>
            <Link to="/register" className="hover:text-brand-600 dark:hover:text-brand-400 transition">
              {isRtl ? 'إنشاء حساب' : 'Register'}
            </Link>
            <Link to="/student-registration" className="hover:text-brand-600 dark:hover:text-brand-400 transition">
              {isRtl ? 'تقديم طلب' : 'Apply'}
            </Link>
          </div>
        </div>

        <div className="pt-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-400 dark:text-slate-600">
          <p>
            &copy; {new Date().getFullYear()} CodeK Academy. {isRtl ? 'جميع الحقوق محفوظة.' : 'All rights reserved.'}
          </p>
          <p className="font-mono text-[11px] flex items-center gap-2">
            <span>{isRtl ? '.Built with engineering rigor in Egypt' : 'Built with engineering rigor in Egypt.'}</span>
          </p>
        </div>
      </div>
    </footer>
  );
};
