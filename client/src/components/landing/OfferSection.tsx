import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { BookOpen, Code2, Cpu, CheckCircle2, TrendingUp, Layers } from 'lucide-react';
import { DoodleIdeaSpark } from '@/components/shared/doodle-accents';
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

interface OfferSectionProps {
  isRtl: boolean;
}

export const OfferSection: React.FC<OfferSectionProps> = ({ isRtl }) => {
  const shouldReduceMotion = useReducedMotion();

  const features = [
    {
      icon: BookOpen,
      badge: '01',
      titleAr: 'دروس منهجية متدرجة',
      titleEn: 'Structured Modular Lessons',
      descAr: 'مسار تعليمي مدروس ومقسم إلى وحدات وموضوعات محدودة وفق المنهج الدراسي، يأخذ الطالب خطوة بخطوة من المفاهيم الأساسية حتى التطبيقات المتقدمة.',
      descEn: 'A structured curriculum broken down into clear academic units, guiding students from fundamentals to applied mastery.',
    },
    {
      icon: Code2,
      badge: '02',
      titleAr: 'تطبيق عملي وتحديات برمجية',
      titleEn: 'Hands-On Code Challenges',
      descAr: 'لا يكتفي الطالب بالمشاهدة بل يكتب كوده بنفسه، يحل مسائل وتحديات بعد كل درس لترسيخ المفاهيم، ويحصل على تقييم فوري من المعلم.',
      descEn: 'Students write code actively, solving challenges after each concept with instructor feedback.',
    },
    {
      icon: Cpu,
      badge: '03',
      titleAr: 'الذكاء الاصطناعي وبناء المشاريع',
      titleEn: 'AI Engineering & Capstone Projects',
      descAr: 'تطبيقات عملية على الذكاء الاصطناعي والمفاهيم الخوارزمية، مما يمكّن الطالب من بناء مشاريع واقعية قابلة للعرض.',
      descEn: 'Applied AI and algorithmic reasoning enabling students to build portfolio-ready capstones.',
    },
    {
      icon: CheckCircle2,
      badge: '04',
      titleAr: 'امتحانات دورية وتدريب مستمر',
      titleEn: 'Periodic Exams & Practice',
      descAr: 'امتحانات دورية بعد كل وحدة لقياس الاستيعاب، مع بنك أسئلة وتدريبات تفاعلية لضمان الجاهزية التامة للاختبارات المدرسية.',
      descEn: 'Unit-level evaluations and interactive practice banks ensure total school exam readiness.',
    },
    {
      icon: TrendingUp,
      badge: '05',
      titleAr: 'متابعة أسبوعية دقيقة مع ولي الأمر',
      titleEn: 'Dedicated Weekly Parent Reporting',
      descAr: 'لوحة تحكم وتقارير دورية تضع ولي الأمر في قلب رحلة ابنه: الحضور، درجات الامتحانات، وتسليم المهام أولاً بأول.',
      descEn: 'Comprehensive parent dashboards tracking attendance, assessment scores, and task submissions.',
    },
    {
      icon: Layers,
      badge: '06',
      titleAr: 'فصل تام لكل صف دراسي',
      titleEn: 'Curriculum-Based Isolation',
      descAr: 'تنظيم صارم يضمن حصول طالب الصف الأول أو الثاني أو الثالث على المحتوى والتحديات والامتحانات الخاصة بمرحلته الدراسية دون تشتيت.',
      descEn: 'Content and assessments are strictly organized around each student’s actual academic grade and curriculum.',
    },
  ];

  return (
    <section id="offer" className="scroll-mt-20 sm:scroll-mt-24 py-10 sm:py-16 bg-white dark:bg-slate-900 border-y border-slate-200/80 dark:border-slate-800/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <motion.div
          initial={shouldReduceMotion ? false : 'hidden'}
          whileInView="visible"
          viewport={viewportOnce}
          variants={fadeInUp}
          className="text-center max-w-3xl mx-auto mb-8 sm:mb-12 space-y-3 relative"
        >
          <motion.div
            animate={
              shouldReduceMotion
                ? undefined
                : {
                    y: [0, -6, 0],
                    rotate: [0, 1.5, 0],
                  }
            }
            transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
            className="hidden lg:block absolute -top-8 -start-10 w-28 h-28 opacity-15 pointer-events-none select-none"
          >
            <img
              src="/illustrations/developer-activity-rafiki.svg"
              alt=""
              aria-hidden="true"
              className="w-full h-full object-contain"
            />
          </motion.div>
          <SectionTag text={isRtl ? 'مميزات التجربة التعليمية' : 'The Learning Experience'} icon={Layers} />
          <h2 className="text-2xl sm:text-4xl font-bold text-slate-950 dark:text-white tracking-tight">
            {isRtl ? 'لماذا تختلف تجربة كودك؟' : 'Why CodeK Stands Apart'}
          </h2>
          <p className="text-base sm:text-lg text-slate-600 dark:text-slate-300">
            {isRtl
              ? 'تعليم صُمم لبناء عقلية التفكير الهندسي وحل المشكلات، وليس مجرد حفظ أكواد سطحية.'
              : 'Engineered to develop analytical problem-solving minds, moving far beyond rote syntax.'}
          </p>
        </motion.div>

        {/* Cards Grid */}
        <motion.div
          initial={shouldReduceMotion ? false : 'hidden'}
          whileInView="visible"
          viewport={viewportOnce}
          variants={staggerContainer(0.08)}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8"
        >
          {features.map((feature, idx) => {
            const Icon = feature.icon;
            return (
              <motion.div
                key={idx}
                variants={itemFadeUp}
                whileHover={shouldReduceMotion ? undefined : subtleHoverCard}
                className="group relative p-6 sm:p-7 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 hover:border-brand-500/50 dark:hover:border-brand-500/50 hover:shadow-xl transition-colors duration-200 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-5">
                    <div className="w-12 h-12 rounded-xl bg-brand-500/10 dark:bg-brand-500/20 text-brand-600 dark:text-brand-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                      <Icon className="w-6 h-6" />
                    </div>
                    <span className="font-mono text-xs font-bold text-slate-400 dark:text-slate-600">
                      {feature.badge}
                    </span>
                  </div>

                  <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2.5">
                    {isRtl ? feature.titleAr : feature.titleEn}
                  </h3>
                  <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                    {isRtl ? feature.descAr : feature.descEn}
                  </p>
                </div>

                <div className="mt-6 pt-4 border-t border-slate-200/60 dark:border-slate-800/60 flex items-center justify-between text-xs font-semibold text-brand-600 dark:text-brand-400">
                  <span>{isRtl ? 'تطبيق عملي متكامل' : 'Applied Learning'}</span>
                  <DoodleIdeaSpark animate={true} className="w-4 h-4 text-accent-500 opacity-60" />
                </div>
              </motion.div>
            );
          })}
        </motion.div>
      </div>
    </section>
  );
};
