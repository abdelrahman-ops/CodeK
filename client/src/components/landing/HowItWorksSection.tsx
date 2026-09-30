import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import {
  BookOpen,
  Terminal,
  Code2,
  Bug,
  Lightbulb,
  Rocket,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  Workflow,
} from 'lucide-react';
import { SectionTag } from './SectionTag';
import {
  fadeInUp,
  staggerContainer,
  itemFadeUp,
  viewportOnce,
  subtleHoverCard,
  DURATION,
  EASING,
} from './motion';

interface HowItWorksSectionProps {
  isRtl: boolean;
}

export const HowItWorksSection: React.FC<HowItWorksSectionProps> = ({ isRtl }) => {
  const shouldReduceMotion = useReducedMotion();
  const ArrowIcon = isRtl ? ArrowLeft : ArrowRight;

  const steps = [
    {
      num: '01',
      icon: BookOpen,
      color: 'text-brand-500 bg-brand-500/10 dark:bg-brand-500/20 border-brand-500/30',
      titleAr: 'اكتشف المفهوم',
      titleEn: 'Discover the Concept',
      descAr: 'نبدأ بربط الفكرة بمثال حي من واقعك اليومي بدون تعقيد، لتستوعب المنطق الرياضي والفكري وراءها أولاً.',
      descEn: 'Connect programming ideas to real-life intuition before diving into theoretical syntax.',
      takeawayAr: '↳ إدراك الرابط المنطقي',
      takeawayEn: '↳ Intuitive Logic',
    },
    {
      num: '02',
      icon: Terminal,
      color: 'text-cyan-500 bg-cyan-500/10 dark:bg-cyan-500/20 border-cyan-500/30',
      titleAr: 'جرّب وطبّق فوراً',
      titleEn: 'Experiment Immediately',
      descAr: 'المحرر السحابي متاح أمامك مباشرة داخل الدرس؛ غيّر المعطيات وشاهد رد فعل الكود حياً أمام عينيك في ثوانٍ.',
      descEn: 'Instant in-browser editor lets you modify values and see immediate execution feedback.',
      takeawayAr: '↳ تغذية راجعة لحظية',
      takeawayEn: '↳ Real-time feedback',
    },
    {
      num: '03',
      icon: Code2,
      color: 'text-amber-500 bg-amber-500/10 dark:bg-amber-500/20 border-amber-500/30',
      titleAr: 'اكتب كودك بيدك',
      titleEn: 'Write Code from Scratch',
      descAr: 'لا نعتمد على النسخ واللصق؛ بل تكتب هيكل الخوارزمية بيدك لبناء الاستقلالية التامة وترسيخ المهارة في ذاكرتك.',
      descEn: 'No copy-pasting: write clean, structured code from scratch to solidify muscle memory.',
      takeawayAr: '↳ ترسيخ الاستقلالية البرمجية',
      takeawayEn: '↳ Independent muscle memory',
    },
    {
      num: '04',
      icon: Bug,
      color: 'text-rose-500 bg-rose-500/10 dark:bg-rose-500/20 border-rose-500/30',
      titleAr: 'واجه التحدي والأخطاء',
      titleEn: 'Debug with Confidence',
      descAr: 'الخطأ البرمجي ليس فشلاً بل هو أعظم وسيلة للتعلم؛ نضع أمامك ألغازاً مقصودة لتدريبك على فن صيد الأخطاء (Debugging).',
      descEn: 'Embrace errors as clues: learn structured systematic debugging to solve complex edge cases.',
      takeawayAr: '↳ التفكير التحليلي وصيد الأخطاء',
      takeawayEn: '↳ Analytical debugging',
    },
    {
      num: '05',
      icon: Lightbulb,
      color: 'text-indigo-500 bg-indigo-500/10 dark:bg-indigo-500/20 border-indigo-500/30',
      titleAr: 'استوعب جوهر الحل',
      titleEn: 'Grasp the Core Solution',
      descAr: 'لحظة الإدراك الحقيقية عندما تكتشف بنفسك سبب نجاح الحل، وكيف يمكنك تطبيقه في بناء أفكار ومشاريع أكثر اتساعاً.',
      descEn: 'The eureka moment: understanding why the solution works and generalizing it.',
      takeawayAr: '↳ استيعاب مفاهيمي عميق',
      takeawayEn: '↳ Conceptual depth',
    },
    {
      num: '06',
      icon: Rocket,
      color: 'text-emerald-500 bg-emerald-500/10 dark:bg-emerald-500/20 border-emerald-500/30',
      titleAr: 'انطلق للمستوى التالي',
      titleEn: 'Level Up & Build',
      descAr: 'فتح مشروع برمجي جديد، حصد أوسمة التميز، وإضافة لعبة تفاعلية أو تطبيق متكامل إلى معرض مشاريعك المعتمد.',
      descEn: 'Unlock advanced capstones, earn verified milestone badges, and enrich your portfolio.',
      takeawayAr: '↳ بناء معرض مشاريع حقيقي',
      takeawayEn: '↳ Portfolio enrichment',
    },
  ];

  return (
    <section id="how-it-works" className="scroll-mt-20 sm:scroll-mt-24 py-10 sm:py-16 overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <motion.div
          initial={shouldReduceMotion ? false : 'hidden'}
          whileInView="visible"
          viewport={viewportOnce}
          variants={fadeInUp}
          className="text-center max-w-3xl mx-auto mb-8 sm:mb-12 space-y-3"
        >
          <SectionTag text={isRtl ? 'خارطة الطريق المنهجية' : 'Systematic Roadmap'} icon={Workflow} />
          <h2 className="text-2xl sm:text-4xl font-bold text-slate-950 dark:text-white tracking-tight">
            {isRtl ? 'رحلة التعلّم: من الفضول إلى الإتقان الهندسي' : 'The Learning Journey: Curiosity to Mastery'}
          </h2>
          <p className="text-base sm:text-lg text-slate-600 dark:text-slate-300">
            {isRtl
              ? 'مسار متدرج ومترابط لا يتوقف عند المشاهدة، بل صُمم كل تمرين فيه ليعمل عقلك وتبني بيدك.'
              : 'A continuous 6-milestone progression transforming raw curiosity into disciplined engineering capability.'}
          </p>
        </motion.div>

        {/* 6-Step Grid Flow */}
        <motion.div
          initial={shouldReduceMotion ? false : 'hidden'}
          whileInView="visible"
          viewport={viewportOnce}
          variants={staggerContainer(0.09)}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8 relative"
        >
          {steps.map((step, idx) => {
            const Icon = step.icon;
            return (
              <motion.div
                key={idx}
                variants={itemFadeUp}
                whileHover={shouldReduceMotion ? undefined : subtleHoverCard}
                className="group relative p-6 sm:p-7 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-brand-500/40 shadow-sm hover:shadow-xl transition-colors duration-200 flex flex-col justify-between space-y-4"
              >
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-mono font-bold text-sm flex items-center justify-center border border-slate-200 dark:border-slate-700">
                      {step.num}
                    </span>
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center border ${step.color}`}>
                      <Icon className="w-5 h-5" />
                    </div>
                  </div>

                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                    {isRtl ? step.titleAr : step.titleEn}
                  </h3>

                  <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                    {isRtl ? step.descAr : step.descEn}
                  </p>
                </div>

                <div className="pt-3 border-t border-slate-100 dark:border-slate-800/80 font-mono text-xs text-brand-600 dark:text-brand-400 font-medium">
                  {isRtl ? step.takeawayAr : step.takeawayEn}
                </div>
              </motion.div>
            );
          })}
        </motion.div>
      </div>
    </section>
  );
};
