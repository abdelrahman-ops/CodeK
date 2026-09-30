import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { GraduationCap } from 'lucide-react';
import { SectionTag } from './SectionTag';
import {
  fadeInUp,
  staggerContainer,
  itemFadeUp,
  viewportOnce,
  subtleHoverCard,
} from './motion';

interface CurriculumTracksSectionProps {
  isRtl: boolean;
}

export const CurriculumTracksSection: React.FC<CurriculumTracksSectionProps> = ({ isRtl }) => {
  const shouldReduceMotion = useReducedMotion();

  return (
    <section id="curriculum" className="scroll-mt-20 sm:scroll-mt-24 py-10 sm:py-14">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={shouldReduceMotion ? false : 'hidden'}
          whileInView="visible"
          viewport={viewportOnce}
          variants={fadeInUp}
          className="text-center max-w-2xl mx-auto mb-8 space-y-2"
        >
          <SectionTag text={isRtl ? 'المناهج الدراسية' : 'Curricula'} icon={GraduationCap} />
          <h2 className="text-xl sm:text-3xl font-bold text-slate-950 dark:text-white tracking-tight">
            {isRtl ? 'الصفوف الدراسية' : 'Academic Grades'}
          </h2>
        </motion.div>

        {/* Compact 3 Grade Cards */}
        <motion.div
          initial={shouldReduceMotion ? false : 'hidden'}
          whileInView="visible"
          viewport={viewportOnce}
          variants={staggerContainer(0.08)}
          className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-5xl mx-auto"
        >
          {/* Grade 1 */}
          <motion.div
            variants={itemFadeUp}
            whileHover={shouldReduceMotion ? undefined : { y: -3, transition: { duration: 0.2 } }}
            className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-brand-500/40 transition-colors shadow-xs flex items-center gap-3.5"
          >
            <div className="w-11 h-11 rounded-xl bg-brand-50 dark:bg-brand-950/60 text-brand-600 dark:text-brand-400 flex items-center justify-center shrink-0">
              <GraduationCap className="w-6 h-6" />
            </div>
            <div className="min-w-0">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                {isRtl ? 'الصف الأول الثانوي' : '1st Secondary Grade'}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {isRtl ? '' : 'Core Logic & Coding'}
              </p>
            </div>
          </motion.div>

          {/* Grade 2 (Featured Official) */}
          <motion.div
            variants={itemFadeUp}
            whileHover={shouldReduceMotion ? undefined : { y: -3, transition: { duration: 0.2 } }}
            className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-900 border-2 border-brand-500 shadow-md shadow-brand-500/10 flex items-center gap-3.5 relative overflow-hidden transition-colors"
          >
            <div className="w-11 h-11 rounded-xl bg-brand-500/15 text-brand-600 dark:text-brand-400 flex items-center justify-center shrink-0">
              <GraduationCap className="w-6 h-6" />
            </div>
            <div className="min-w-0">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                {isRtl ? 'الصف الثاني الثانوي' : '2nd Secondary Grade'}
              </h3>
              <p className="text-xs text-brand-600 dark:text-brand-400 font-semibold">
                {isRtl ? '' : 'Programming & AI (G11)'}
              </p>
            </div>
          </motion.div>

          {/* Grade 3 */}
          <motion.div
            variants={itemFadeUp}
            whileHover={shouldReduceMotion ? undefined : { y: -3, transition: { duration: 0.2 } }}
            className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-brand-500/40 transition-colors shadow-xs flex items-center gap-3.5"
          >
            <div className="w-11 h-11 rounded-xl bg-brand-50 dark:bg-brand-950/60 text-brand-600 dark:text-brand-400 flex items-center justify-center shrink-0">
              <GraduationCap className="w-6 h-6" />
            </div>
            <div className="min-w-0">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                {isRtl ? 'الصف الثالث الثانوي' : '3rd Secondary Grade'}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {isRtl ? '' : 'Systems & University Prep'}
              </p>
            </div>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
};
