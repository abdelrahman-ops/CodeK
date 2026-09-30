import React, { useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { ChevronDown, HelpCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SectionTag } from './SectionTag';
import {
  fadeInUp,
  staggerContainer,
  itemFadeUp,
  viewportOnce,
  DURATION,
  EASING,
} from './motion';

interface FaqSectionProps {
  isRtl: boolean;
}

export const FaqSection: React.FC<FaqSectionProps> = ({ isRtl }) => {
  const [activeFaq, setActiveFaq] = useState<number | null>(null);
  const shouldReduceMotion = useReducedMotion();

  const faqs = [
    {
      qAr: 'لمن صُممت منصة كودك؟',
      qEn: 'Who is CodeK Academy designed for?',
      aAr: 'صُممت منصة كودك لطلاب المدارس الإعدادية والثانوية (صفوف الأول، الثاني، والثالث الثانوي) الراغبين في تعلّم البرمجة والذكاء الاصطناعي بمنهجية هندسية منظمة.',
      aEn: 'CodeK Academy is tailored for preparatory and secondary school students (Grades 1, 2, and 3) seeking to master programming and AI through a rigorous engineering methodology.',
    },
    {
      qAr: 'هل يحتاج الطالب إلى خبرة برمجية سابقة للبدء؟',
      qEn: 'Does the student need prior programming experience?',
      aAr: 'لا، المنهج مصمم ليبدأ من الصفر تماماً مع مفاهيم التفكير الخوارزمي المنطقي، ثم يتدرج بسلاسة نحو البرمجة المتقدمة وبناء المشروعات.',
      aEn: 'No previous coding experience is needed. Courses start from foundational computational logic and smoothly advance to complex problem solving.',
    },
    {
      qAr: 'كيف يضمن النظام عدم تشتت الطالب بين محتويات الصفوف الأخرى؟',
      qEn: 'How does the platform ensure content isolation across grades?',
      aAr: 'تعتمد المنصة مبدأ العزل التام للمحتوى (Grade Isolation)؛ حيث يرتبط حساب الطالب بصفّه الأكاديمي، ولا يظهر له سوى المنهج والدروس والمهام والامتحانات الخاصة بصفّه فقط.',
      aEn: 'The platform strictly isolates curriculum content per academic grade. Students only view, attempt, and interact with material matching their specific academic grade.',
    },
    {
      qAr: 'كيف تضمنون التطبيق العملي وعدم المشاهدة فقط؟',
      qEn: 'How do you ensure practical engagement over passive watching?',
      aAr: 'كل درس يتبعه تحدي برمجي إجباري يكتبه الطالب بنفسه على المنصة، مع تقييم أسبوعي من المدرّب ومتابعة دقيقة لدرجات الاختبارات الدورية.',
      aEn: 'Every concept requires immediate hands-on coding challenges submitted and reviewed on the platform, backed by periodic progress checks.',
    },
    {
      qAr: 'كيف يتابع ولي الأمر مستوى وتقدم ابنه؟',
      qEn: 'How can parents monitor their child’s progress?',
      aAr: 'يمتلك ولي الأمر بوابة متابعة خاصة تعرض تقارير الحضور، درجات الامتحانات الشهرية، وتقييمات الواجبات ليكون شريكاً في كل خطوة.',
      aEn: 'Parents have dedicated dashboards visualizing attendance logs, exam scores, and weekly completion metrics with total transparency.',
    },
    {
      qAr: 'كيف يسجل الطالب ويبدأ الدراسة؟',
      qEn: 'How do students enroll and begin?',
      aAr: 'يمكن لولي الأمر أو الطالب إنشاء حساب وتحديد الصف الدراسي، ثم تفعيل الاشتراك عبر بوابة الدفع الإلكتروني المعتمدة لبدء حضور الحصص فوراً.',
      aEn: 'Parents or students register an account, select the student’s academic grade, and complete enrollment through our secure payment gateway to unlock their full curriculum instantly.',
    },
  ];

  return (
    <section id="faq" className="scroll-mt-20 sm:scroll-mt-24 py-10 sm:py-16 bg-white dark:bg-slate-900 border-y border-slate-200/80 dark:border-slate-800/80">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={shouldReduceMotion ? false : 'hidden'}
          whileInView="visible"
          viewport={viewportOnce}
          variants={fadeInUp}
          className="text-center mb-8 sm:mb-10 space-y-3"
        >
          <SectionTag text={isRtl ? 'إجابات واضحة' : 'FAQ'} icon={HelpCircle} />
          <h2 className="text-2xl sm:text-4xl font-bold text-slate-950 dark:text-white tracking-tight">
            {isRtl ? 'الأسئلة الشائعة' : 'Frequently Asked Questions'}
          </h2>
        </motion.div>

        <motion.div
          initial={shouldReduceMotion ? false : 'hidden'}
          whileInView="visible"
          viewport={viewportOnce}
          variants={staggerContainer(0.06)}
          className="space-y-4"
        >
          {faqs.map((faq, idx) => {
            const isOpen = activeFaq === idx;
            return (
              <motion.div
                key={idx}
                variants={itemFadeUp}
                className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 overflow-hidden transition-colors"
              >
                <button
                  type="button"
                  onClick={() => setActiveFaq(isOpen ? null : idx)}
                  className="w-full p-5 sm:p-6 text-start flex items-center justify-between gap-4 font-bold text-slate-900 dark:text-white focus:outline-none cursor-pointer"
                >
                  <span className="text-sm sm:text-base">{isRtl ? faq.qAr : faq.qEn}</span>
                  <ChevronDown
                    className={cn(
                      'w-5 h-5 text-slate-400 transition-transform duration-200 shrink-0',
                      isOpen && 'transform rotate-180 text-brand-500'
                    )}
                  />
                </button>

                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      initial={shouldReduceMotion ? false : { height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.25, ease: EASING.out }}
                      className="overflow-hidden"
                    >
                      <div className="px-5 sm:px-6 pb-5 sm:pb-6 text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed border-t border-slate-200/60 dark:border-slate-800/60 pt-4">
                        {isRtl ? faq.aAr : faq.aEn}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </motion.div>
      </div>
    </section>
  );
};
