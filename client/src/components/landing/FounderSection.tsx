import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { GraduationCap, Terminal, ShieldCheck } from 'lucide-react';
import { SectionTag } from './SectionTag';
import {
  fadeInUp,
  fadeInDown,
  scaleReveal,
  staggerContainer,
  itemFadeUp,
  viewportOnce,
  DURATION,
  EASING,
} from './motion';

interface FounderSectionProps {
  isRtl: boolean;
}

export const FounderSection: React.FC<FounderSectionProps> = ({ isRtl }) => {
  const shouldReduceMotion = useReducedMotion();

  return (
    <section id="about" className="scroll-mt-20 sm:scroll-mt-24 py-10 sm:py-16 bg-white dark:bg-slate-900 border-y border-slate-200/80 dark:border-slate-800/80 overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          {/* Left: Founder Portrait Container */}
          <motion.div
            initial={shouldReduceMotion ? false : 'hidden'}
            whileInView="visible"
            viewport={viewportOnce}
            variants={scaleReveal}
            className="lg:col-span-5 flex justify-center relative"
          >
            <div className="relative w-full max-w-sm">
              {/* Hand-drawn accent tag */}
              <motion.div
                initial={shouldReduceMotion ? false : { opacity: 0, y: -8, rotate: -4 }}
                whileInView={{ opacity: 1, y: 0, rotate: -4 }}
                viewport={viewportOnce}
                transition={{ duration: DURATION.standard, ease: EASING.out, delay: 0.15 }}
                className="absolute -top-4 -start-4 z-10 px-3 py-1 rounded-lg bg-amber-400 text-slate-950 font-mono text-xs font-semibold shadow-md rotate-[-4deg]"
              >
                ★ Founder &amp; Educator
              </motion.div>

              {/* Frame Container */}
              <div className="relative rounded-3xl p-3 bg-gradient-to-tr from-brand-600/20 via-slate-100 to-accent-500/20 dark:from-brand-900/40 dark:via-slate-800 dark:to-accent-900/30 border-2 border-slate-200 dark:border-slate-700 shadow-xl overflow-hidden">
                <div className="rounded-2xl overflow-hidden aspect-[4/5] bg-slate-950 relative flex items-center justify-center">
                  <img
                    src="/images/founder-abdelrahman.jpg"
                    alt="Eng. Abdelrahman Ataa"
                    onError={(e) => {
                      // Seamless fallback to the local photo if jpg path differs
                      e.currentTarget.src = '/images/me.jpg';
                    }}
                    className="w-full h-full object-cover object-center"
                  />
                </div>

                {/* Caption Bar */}
                <div className="pt-3.5 pb-1 px-2 text-center">
                  <h4 className="text-base font-bold text-slate-900 dark:text-white">
                    {isRtl ? 'م. عبدالرحمن عطاء' : 'Eng. Abdelrahman Ataa'}
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                    {isRtl ? 'بكالوريوس هندسة حاسبات واتصالات جامعة المنصورة' : 'Bsc of Computer & Communication Engineering, Mansoura University'}
                  </p>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Right: Message & Vision */}
          <motion.div
            initial={shouldReduceMotion ? false : 'hidden'}
            whileInView="visible"
            viewport={viewportOnce}
            variants={staggerContainer(0.08)}
            className="lg:col-span-7 space-y-6 text-center lg:text-start relative"
          >
            <motion.div variants={itemFadeUp}>
              <SectionTag text={isRtl ? 'من يقف وراء كودك؟' : 'Who is Behind CodeK?'} icon={GraduationCap} />
            </motion.div>

            <motion.h2
              variants={itemFadeUp}
              className="text-2xl sm:text-4xl font-bold text-slate-950 dark:text-white tracking-tight leading-snug"
            >
              {isRtl ? (
                <>
                  &quot;بنيت كودك لأمنح الطلاب تعليماً برمجياً{' '}
                  <span className="text-brand-600 dark:text-brand-400">حقيقياً، عملياً، ومفهوماً.&quot;</span>
                </>
              ) : (
                <>
                  &quot;I built CodeK to make programming education{' '}
                  <span className="text-brand-600 dark:text-brand-400">structured, practical, and truly understood.&quot;</span>
                </>
              )}
            </motion.h2>

            <motion.div variants={itemFadeUp} className="space-y-4 text-sm sm:text-base text-slate-600 dark:text-slate-300 leading-relaxed">
              <p>
                {isRtl
                  ? 'على مدار سنوات من العمل في هندسة البرمجيات والتدريس، لاحظت أن المشكلة الكبرى التي تواجه المبتدئين ليست صعوبة الأكواد، بل غياب المنهج المتكامل والتطبيق العملي الحقيقي. الكثير يشاهد مقاطع الفيديو، لكن قليلين هم من يستطيعون الجلوس أمام شاشة فارغة وبناء حل من الصفر.'
                  : 'Throughout years in software engineering and instruction, I observed that the primary obstacle for learners isn’t syntax complexity, but the absence of disciplined curriculum and real problem solving. Many watch videos, but few learn how to think and code from scratch.'}
              </p>
              <p>
                {isRtl
                  ? 'في كودك، لا ندرّب الطلاب ليكونوا مجرد ناسخين للأوامر؛ بل نزرع فيهم عقلية المهندس: كيف يفكك المسألة الكبيرة إلى أجزاء صغيرة، كيف يبحث عن مكمن الخطأ (Debugging)، وكيف يبني برمجيات يفخر بها.'
                  : 'At CodeK, we do not train students to memorize commands; we cultivate the engineer’s mindset: breaking large problems into manageable components, debugging rigorously, and writing software with pride.'}
              </p>
            </motion.div>

            <motion.div variants={itemFadeUp} className="pt-2 flex flex-wrap items-center justify-center lg:justify-start gap-4">
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300">
                <Terminal className="w-4 h-4 text-brand-500" />
                <span>{isRtl ? 'تعليم هندسي تطبيقي' : 'Applied Engineering Pedagogy'}</span>
              </div>
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300">
                <ShieldCheck className="w-4 h-4 text-emerald-500" />
                <span>{isRtl ? 'إشراف ومتابعة مباشرة' : 'Direct Instructor Supervision'}</span>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </div>
    </section>
  );
};
