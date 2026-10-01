import React from 'react';
import { Link } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { ArrowRight, ArrowLeft } from 'lucide-react';
import { DoodleBracket } from '@/components/shared/doodle-accents';
import {
  scaleReveal,
  staggerContainer,
  itemFadeUp,
  viewportOnce,
  subtleHoverButton,
  subtleTapButton,
} from './motion';

interface CtaSectionProps {
  isRtl: boolean;
  isAuthenticated: boolean;
  getDashboardPath: () => string;
}

export const CtaSection: React.FC<CtaSectionProps> = ({
  isRtl,
  isAuthenticated,
  getDashboardPath,
}) => {
  const shouldReduceMotion = useReducedMotion();
  const ArrowIcon = isRtl ? ArrowLeft : ArrowRight;

  return (
    <section className="py-10 sm:py-16 relative overflow-hidden bg-slate-50 dark:bg-slate-950">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative">
        <motion.div
          initial={shouldReduceMotion ? false : 'hidden'}
          whileInView="visible"
          viewport={viewportOnce}
          variants={scaleReveal}
          className="p-8 sm:p-12 rounded-3xl bg-gradient-to-tr from-brand-600 via-brand-700 to-indigo-800 text-white shadow-2xl relative overflow-hidden"
        >
          {/* Background sketch elements with subtle float */}
          <div className="absolute top-4 start-6 text-brand-400/40">
            <DoodleBracket type="left" animate={true} />
          </div>
          <div className="absolute bottom-4 end-6 text-brand-400/40">
            <DoodleBracket type="right" animate={true} />
          </div>

          {/* Storyset Collaborative Achievement Accent */}
          <motion.div
            animate={
              shouldReduceMotion
                ? undefined
                : {
                    y: [0, -6, 0],
                    rotate: [0, 1.2, 0],
                  }
            }
            transition={{ duration: 7, repeat: Infinity, ease: 'easeInOut' }}
            className="hidden md:block absolute -bottom-10 -start-10 w-60 h-60 opacity-20 pointer-events-none select-none"
          >
            <img
              src="/illustrations/team-spirit-pana.svg"
              alt=""
              aria-hidden="true"
              className="w-full h-full object-contain"
            />
          </motion.div>

          <motion.div
            variants={staggerContainer(0.08)}
            className="relative z-10 max-w-2xl mx-auto space-y-6"
          >
            <motion.h2 variants={itemFadeUp} className="text-3xl sm:text-5xl font-bold tracking-tight">
              {isRtl ? 'جاهز لبدء رحلتك البرمجية؟' : 'Ready to Start Your Journey?'}
            </motion.h2>
            <motion.p variants={itemFadeUp} className="text-sm sm:text-base text-brand-100 leading-relaxed">
              {isRtl
                ? 'انضم إلى منصة كودك اليوم، وابدأ التعلّم وفق منهج دراسي منتظم، تدريبات عملية مستمرة، ومتابعة دقيقة لكل خطوة.'
                : 'Join CodeK Academy today. Experience structured, grade-based learning with continuous practice and dedicated guidance.'}
            </motion.p>

            <motion.div variants={itemFadeUp} className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4">
              <motion.div
                whileHover={shouldReduceMotion ? undefined : subtleHoverButton}
                whileTap={shouldReduceMotion ? undefined : subtleTapButton}
                className="w-full sm:w-auto"
              >
                <Link
                  to={isAuthenticated ? getDashboardPath() : '/register'}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-xl text-base font-bold bg-white text-brand-900 hover:bg-slate-100 transition shadow-lg"
                >
                  <span>
                    {isAuthenticated
                      ? isRtl
                        ? 'لوحة التحكم'
                        : 'Dashboard'
                      : isRtl
                      ? 'ابدأ التعلّم الآن'
                      : 'Start Learning Now'}
                  </span>
                  <ArrowIcon className="w-5 h-5" />
                </Link>
              </motion.div>

              {!isAuthenticated && (
                <motion.div
                  whileHover={shouldReduceMotion ? undefined : subtleHoverButton}
                  whileTap={shouldReduceMotion ? undefined : subtleTapButton}
                  className="w-full sm:w-auto"
                >
                  <Link
                    to="/login"
                    className="w-full sm:w-auto inline-flex items-center justify-center px-6 py-3.5 rounded-xl text-base font-semibold text-white bg-brand-800/60 hover:bg-brand-800 border border-brand-500/50 transition"
                  >
                    <span>{isRtl ? 'تسجيل الدخول' : 'Log In'}</span>
                  </Link>
                </motion.div>
              )}
            </motion.div>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
};
