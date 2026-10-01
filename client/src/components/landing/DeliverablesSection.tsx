import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Layers, Video, FileCode2, Award, CheckCircle2, ShieldCheck, PackageCheck } from 'lucide-react';
import { SectionTag } from './SectionTag';
import {
  fadeInUp,
  staggerContainer,
  itemFadeUp,
  viewportOnce,
  subtleHoverCard,
} from './motion';

interface DeliverablesSectionProps {
  isRtl: boolean;
}

export const DeliverablesSection: React.FC<DeliverablesSectionProps> = ({ isRtl }) => {
  const shouldReduceMotion = useReducedMotion();

  const deliverables = [
    {
      icon: Layers,
      titleAr: 'منهج معتمد ومقسم حسب الصف',
      titleEn: 'Grade-Isolated Official Curriculum',
      descAr: 'محتوى مخصص للصف الأول، الثاني، والثالث الثانوي دون تداخل.',
      descEn: 'Strictly grade-isolated content for Grades 1, 2, and 3 without distraction.',
    },
    {
      icon: Video,
      titleAr: 'فيديوهات شرح احترافية وحصرية',
      titleEn: 'Studio-Quality Lesson Videos',
      descAr: 'شروحات دقيقة بجودة عالية تركّز على الفهم العميق والتطبيق العملي.',
      descEn: 'Crystal-clear lessons emphasizing deep conceptual clarity and practical execution.',
    },
    {
      icon: FileCode2,
      titleAr: 'تحديات برمجية بعد كل درس',
      titleEn: 'Post-Lesson Coding Tasks',
      descAr: 'تمارين كتابية وكود حقيقي يُسلم ويُراجع أسبوعياً لضمان تثبيت المعلومة.',
      descEn: 'Interactive code assignments graded weekly to cement muscle memory.',
    },
    {
      icon: Award,
      titleAr: 'نظام امتحانات وأوسمة إنجاز',
      titleEn: 'Milestone Quizzes & Digital Badges',
      descAr: 'امتحانات تقييمية بعد كل وحدة مع أوسمة رقمية لتحفيز الطلاب.',
      descEn: 'Structured unit exams and verifiable milestone badges driving student motivation.',
    },
    {
      icon: CheckCircle2,
      titleAr: 'تتبّع الحضور ونقاط الخبرة (XP)',
      titleEn: 'Attendance & XP Tracking Engine',
      descAr: 'لوحة تفاعلية تظهر استمرارية الحضور والتقدم ونقاط الخبرة المحققة.',
      descEn: 'Transparent streak tracking, earned XP counters, and personal performance telemetry.',
    },
    {
      icon: ShieldCheck,
      titleAr: 'بوابة مخصصة لمتابعة ولي الأمر',
      titleEn: 'Dedicated Parent Portal',
      descAr: 'متابعة لحظية لسجل حضور الطالب، ودرجاته، وتقارير تقدمه الأسبوعية.',
      descEn: 'Real-time parent monitoring for session attendance, grades, and weekly metrics.',
    },
  ];

  return (
    <section className="py-10 sm:py-16 bg-white dark:bg-slate-900 border-y border-slate-200/80 dark:border-slate-800/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={shouldReduceMotion ? false : 'hidden'}
          whileInView="visible"
          viewport={viewportOnce}
          variants={fadeInUp}
          className="text-center max-w-3xl mx-auto mb-8 sm:mb-12 space-y-3"
        >
          <SectionTag text={isRtl ? 'المخرجات الحقيقية' : 'Concrete Deliverables'} icon={PackageCheck} />
          <h2 className="text-2xl sm:text-4xl font-bold text-slate-950 dark:text-white tracking-tight">
            {isRtl ? 'ماذا يحصل عليه الطالب فعلياً؟' : 'What Students Actually Receive'}
          </h2>
          <p className="text-base sm:text-lg text-slate-600 dark:text-slate-300">
            {isRtl
              ? 'قدرات وأدوات حقيقية مثبتة داخل منصة كودك لدعم رحلة التعلّم أسبوعاً بعد أسبوع.'
              : 'Real, operational platform features engineered to guarantee learning continuity.'}
          </p>
        </motion.div>

        <motion.div
          initial={shouldReduceMotion ? false : 'hidden'}
          whileInView="visible"
          viewport={viewportOnce}
          variants={staggerContainer(0.08)}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8"
        >
          {deliverables.map((item, idx) => {
            const Icon = item.icon;
            return (
              <motion.div
                key={idx}
                variants={itemFadeUp}
                whileHover={shouldReduceMotion ? undefined : subtleHoverCard}
                className="group p-6 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 hover:border-brand-500/40 hover:shadow-lg transition-colors duration-200 flex items-start gap-4"
              >
                <div className="w-10 h-10 rounded-xl bg-brand-500/10 dark:bg-brand-500/20 text-brand-600 dark:text-brand-400 flex items-center justify-center shrink-0 mt-1 group-hover:scale-105 transition-transform">
                  <Icon className="w-5 h-5" />
                </div>
                <div className="space-y-1.5">
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    {isRtl ? item.titleAr : item.titleEn}
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                    {isRtl ? item.descAr : item.descEn}
                  </p>
                </div>
              </motion.div>
            );
          })}
        </motion.div>
      </div>
    </section>
  );
};
