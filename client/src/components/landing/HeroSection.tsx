import React from 'react';
import { Link } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { ArrowRight, ArrowLeft } from 'lucide-react';
import { DoodleCheck } from '@/components/shared/doodle-accents';
import { HeroTerminal } from './HeroTerminal';
import {
  fadeInUp,
  fadeInDown,
  scaleReveal,
  subtleHoverButton,
  subtleTapButton,
  EASING,
  DURATION,
} from './motion';

interface HeroSectionProps {
  isRtl: boolean;
  isAuthenticated: boolean;
  getDashboardPath: () => string;
}

export const HeroSection: React.FC<HeroSectionProps> = ({
  isRtl,
  isAuthenticated,
  getDashboardPath,
}) => {
  const shouldReduceMotion = useReducedMotion();
  const ArrowIcon = isRtl ? ArrowLeft : ArrowRight;

  return (
    <section id="hero" className="relative pt-4 pb-10 sm:pt-8 sm:pb-14 lg:pt-10 lg:pb-16 overflow-hidden">
      {/* Subtle futuristic grid & radial aura background */}
      <div className="absolute inset-0 bg-[radial-gradient(#6366f1_1px,transparent_1px)] [background-size:24px_24px] opacity-20 dark:opacity-10 pointer-events-none" />
      <div className="absolute top-1/4 start-1/2 -translate-x-1/2 w-96 h-96 bg-brand-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-center">
          {/* Left/Main Column: Headline & Value Proposition */}
          <div className="lg:col-span-7 text-center lg:text-start space-y-4 sm:space-y-6 relative">
            {/* Top Tape Marker / Engineering Badge */}
            <motion.div
              initial={shouldReduceMotion ? false : { opacity: 0, y: -12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: DURATION.standard, ease: EASING.out }}
              className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-amber-500/10 dark:bg-amber-500/15 border border-amber-500/30 text-amber-600 dark:text-amber-400 text-xs sm:text-sm font-mono font-semibold rotate-[-1.5deg] shadow-sm"
            >
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
              <span>
                {isRtl
                  ? ' دفتر المبرمج الواعد '
                  : ' The Student Engineer Notebook'}
              </span>
            </motion.div>

            {/* Main Headline with Hand-Drawn Swoosh & Margin Annotation */}
            <div className="relative">
              <motion.h1
                initial={shouldReduceMotion ? false : { opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: DURATION.reveal, ease: EASING.out, delay: 0.08 }}
                className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-slate-900 dark:text-white !leading-[1.75] sm:!leading-[1.65] lg:!leading-[1.6] pb-2"
              >
                {isRtl ? (
                  <>
                    <span className="block">تعلّم البرمجة بأسلوب هندسي رصين،</span>
                    <span className="block mt-1 sm:mt-2.5">
                      وابنِ{' '}
                      <span
                        className="relative inline-block whitespace-nowrap text-brand-600 dark:text-brand-400 font-ruqaa font-bold text-[1.2em] sm:text-[1.28em] px-1.5"
                        style={{ fontFamily: "'Playpen Sans Arabic', serif" }}
                      >
                        مهارات حقيقية
                        {/* Hand-drawn swoosh underline SVG */}
                        <svg
                          className="absolute -bottom-1.5 sm:-bottom-2 inset-x-0 w-full h-3 sm:h-3.5 text-brand-500/80 dark:text-brand-400 pointer-events-none"
                          fill="none"
                          preserveAspectRatio="none"
                          viewBox="0 0 260 14"
                        >
                          <path
                            d="M2 9C55 3 170 2 258 8C200 13 85 11 12 12"
                            stroke="currentColor"
                            strokeLinecap="round"
                            strokeWidth="3.5"
                          />
                        </svg>
                      </span>{' '}
                      <span className="inline-block whitespace-nowrap">تصنع فارقاً.</span>
                    </span>
                  </>
                ) : (
                  <>
                    <span className="block">Learn Programming with Engineering Rigor,</span>
                    <span className="block mt-1 sm:mt-2.5">
                      and Build{' '}
                      <span
                        className="relative inline-block whitespace-nowrap text-brand-600 dark:text-brand-400 font-square-peg text-[1.45em] sm:text-[1.58em] font-normal leading-none px-2 tracking-wide align-middle"
                        style={{ fontFamily: "'Square Peg', cursive" }}
                      >
                        Real Skills
                        {/* Hand-drawn swoosh underline SVG */}
                        <svg
                          className="absolute -bottom-1 sm:-bottom-1.5 inset-x-0 w-full h-3 sm:h-3.5 text-brand-500/80 dark:text-brand-400 pointer-events-none"
                          fill="none"
                          preserveAspectRatio="none"
                          viewBox="0 0 260 14"
                        >
                          <path
                            d="M2 9C55 3 170 2 258 8C200 13 85 11 12 12"
                            stroke="currentColor"
                            strokeLinecap="round"
                            strokeWidth="3.5"
                          />
                        </svg>
                      </span>{' '}
                      <span className="inline-block whitespace-nowrap">That Last.</span>
                    </span>
                  </>
                )}
              </motion.h1>

              {/* Margin Handwritten Arrow Annotation (Classical Arabic, no slang) */}
              <motion.div
                initial={shouldReduceMotion ? false : { opacity: 0, scale: 0.9, y: -4 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ duration: DURATION.standard, ease: EASING.out, delay: 0.28 }}
                className="hidden sm:flex flex-col items-center absolute -top-9 end-4 sm:end-10 z-10 select-none pointer-events-none"
              >
                <span className="bg-amber-400/15 dark:bg-amber-400/20 text-amber-700 dark:text-amber-300 px-2.5 py-1 rounded-lg border border-amber-500/30 font-mono text-xs font-semibold shadow-xs rotate-[-2deg]">
                  {isRtl ? 'تطبيق وبناء، لا مشاهدة صامتة!' : 'Build & solve, not passive watching!'}
                </span>
                <svg
                  className={`w-6 h-6 text-amber-500 dark:text-amber-400 -mt-0.5 ms-4 ${isRtl ? '-scale-x-100' : ''}`}
                  viewBox="0 0 32 32"
                  fill="none"
                >
                  <path
                    d="M6 4C14 6 22 12 21 24M21 24L16 19M21 24L26 19"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </motion.div>
            </div>

            {/* Supporting Copy */}
            <motion.p
              initial={shouldReduceMotion ? false : { opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: DURATION.reveal, ease: EASING.out, delay: 0.16 }}
              className="text-sm sm:text-base lg:text-lg text-slate-600 dark:text-slate-300 max-w-2xl mx-auto lg:mx-0 leading-relaxed"
            >
              {isRtl
                ? 'منهج دراسي متكامل ومقسم بدقة حسب صفك الدراسي. نتجاوز مجرد المشاهدة السطحية لنخوض في كتابة الكود، حل التحديات المنطقية، وبناء المشاريع مع متابعة أسبوعية دقيقة لكل خطوة.'
                : 'A grade-structured academy designed for school students. Move beyond passive video watching: write real code, solve algorithmic puzzles, and track measurable weekly progress.'}
            </motion.p>

            {/* CTAs */}
            <motion.div
              initial={shouldReduceMotion ? false : { opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: DURATION.reveal, ease: EASING.out, delay: 0.24 }}
              className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-3 sm:gap-4 pt-1"
            >
              <motion.div
                whileHover={shouldReduceMotion ? undefined : subtleHoverButton}
                whileTap={shouldReduceMotion ? undefined : subtleTapButton}
                className="w-full sm:w-auto"
              >
                <Link
                  to={isAuthenticated ? getDashboardPath() : '/register'}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-sm sm:text-base font-bold bg-brand-600 hover:bg-brand-700 text-white shadow-lg shadow-brand-600/25 transition"
                >
                  <span>
                    {isAuthenticated
                      ? isRtl
                        ? 'الانتقال إلى لوحة التحكم'
                        : 'Go to Dashboard'
                      : isRtl
                      ? 'افتح دفترك وابدأ الرحلة'
                      : 'Open Your Notebook & Start'}
                  </span>
                  <ArrowIcon className="w-4 h-4 sm:w-5 sm:h-5" />
                </Link>
              </motion.div>

              <motion.a
                whileHover={shouldReduceMotion ? undefined : subtleHoverButton}
                whileTap={shouldReduceMotion ? undefined : subtleTapButton}
                href="#curriculum"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl text-sm sm:text-base font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/80 transition"
              >
                <span>{isRtl ? 'استكشف المنهج' : 'Explore Curriculum'}</span>
              </motion.a>
            </motion.div>

            {/* Micro Doodles / Core Principles Row (From Stitch) */}
            <motion.div
              initial={shouldReduceMotion ? false : { opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: DURATION.reveal, ease: EASING.out, delay: 0.32 }}
              className="pt-2 flex flex-wrap items-center justify-center lg:justify-start gap-2.5 sm:gap-3 text-xs font-mono text-slate-500 dark:text-slate-400"
            >
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                <span className="font-bold text-brand-600 dark:text-brand-400">#</span>
                <span className="font-sans font-medium text-slate-700 dark:text-slate-300">
                  {isRtl ? 'تفكير منطقي تحليلي' : 'Analytical Logic'}
                </span>
              </div>
              <span className="text-slate-300 dark:text-slate-700">•</span>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                <span className="font-bold text-amber-500">{'{ }'}</span>
                <span className="font-sans font-medium text-slate-700 dark:text-slate-300">
                  {isRtl ? 'مشاريع حقيقية تعمل' : 'Applied Projects'}
                </span>
              </div>
              <span className="text-slate-300 dark:text-slate-700">•</span>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                <span className="font-bold text-cyan-500">λ</span>
                <span className="font-sans font-medium text-slate-700 dark:text-slate-300">
                  {isRtl ? 'بناء ثقة وعقلية هندسية' : 'Engineering Confidence'}
                </span>
              </div>
            </motion.div>

            {/* Trust badges */}
            <motion.div
              initial={shouldReduceMotion ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: DURATION.reveal, ease: EASING.out, delay: 0.4 }}
              className="pt-1 flex flex-wrap items-center justify-center lg:justify-start gap-3 sm:gap-4 text-xs text-slate-500 dark:text-slate-400 font-medium"
            >
              <span className="inline-flex items-center gap-1.5">
                <DoodleCheck className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-500 shrink-0" />
                {isRtl ? 'بدون متطلبات سابقة' : 'No prior experience'}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <DoodleCheck className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-500 shrink-0" />
                {isRtl ? 'منهج مخصص لكل صف' : 'Grade-isolated'}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <DoodleCheck className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-500 shrink-0" />
                {isRtl ? 'متابعة وتقارير أسبوعية' : 'Weekly tracking'}
              </span>
            </motion.div>
          </div>

          {/* Right Column: Clean, Focused Interactive Typewriter Terminal */}
          <motion.div
            initial={shouldReduceMotion ? false : { opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: DURATION.reveal + 0.1, ease: EASING.out, delay: 0.18 }}
            className="lg:col-span-5 relative"
          >
            <HeroTerminal isRtl={isRtl} />
          </motion.div>
        </div>
      </div>
    </section>
  );
};
