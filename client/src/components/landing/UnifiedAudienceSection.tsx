import React from 'react';
import { Link } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { ArrowLeft, ArrowRight, Check, Code2, ShieldCheck, Sparkles, Users } from 'lucide-react';
import { SectionTag } from './SectionTag';
import {
  fadeInUp,
  scaleReveal,
  staggerContainer,
  itemFadeUp,
  viewportOnce,
  subtleHoverButton,
  subtleTapButton,
} from './motion';

interface UnifiedAudienceSectionProps { isRtl: boolean; }
interface NotebookPageProps {
  accent: 'cyan' | 'amber'; isRtl: boolean; audience: string; title: React.ReactNode;
  description: string; points: string[]; action: string; to: string;
}

const NotebookPage: React.FC<NotebookPageProps> = ({ accent, isRtl, audience, title, description, points, action, to }) => {
  const shouldReduceMotion = useReducedMotion();
  const isStudent = accent === 'cyan';
  const ArrowIcon = isRtl ? ArrowLeft : ArrowRight;
  const Icon = isStudent ? Code2 : ShieldCheck;
  const colors = isStudent
    ? { chip: 'border-cyan-700/25 bg-cyan-50/90 text-cyan-800', icon: 'text-cyan-700', action: 'bg-cyan-700 text-white hover:bg-cyan-800', wash: 'from-cyan-500/[0.10] via-transparent to-transparent' }
    : { chip: 'border-amber-700/25 bg-amber-50/90 text-amber-800', icon: 'text-amber-700', action: 'bg-amber-500 text-slate-950 hover:bg-amber-600', wash: 'from-amber-500/[0.10] via-transparent to-transparent' };

  return (
    <article className={`relative overflow-hidden bg-gradient-to-br ${colors.wash} px-6 py-8 text-slate-900 sm:px-10 sm:py-10 lg:px-12 lg:py-10`} style={{ backgroundImage: 'linear-gradient(rgba(255,253,241,.82), rgba(255,253,241,.9)), url("/images/school notebook paper sheet Background.jpeg")', backgroundSize: 'cover', backgroundPosition: 'center' }}>
      <div className="relative z-10 flex h-full flex-col justify-between">
        <div className="pt-1"><div className={`inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-[11px] font-bold ${colors.chip}`}><Icon className="h-3.5 w-3.5" /><span>{audience}</span></div></div>
        <div className="pt-4"><h3 className="text-xl font-bold leading-snug sm:text-2xl">{title}</h3><p className="mt-3 text-xs leading-6 text-slate-700 sm:text-sm">{description}</p></div>
        <ul className="space-y-2.5 pt-4 text-xs font-medium text-slate-800 sm:text-sm">{points.map((point, index) => <li key={index} className="flex items-start gap-2.5"><span className="mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-slate-900 text-white"><Check className="h-2.5 w-2.5" /></span><span>{point}</span></li>)}</ul>
        <div className="pt-6">
          <motion.div
            whileHover={shouldReduceMotion ? undefined : subtleHoverButton}
            whileTap={shouldReduceMotion ? undefined : subtleTapButton}
            className="inline-block"
          >
            <Link to={to} className={`inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-bold shadow-sm transition ${colors.action}`}>{action}<ArrowIcon className="h-4 w-4" /></Link>
          </motion.div>
        </div>
      </div>
    </article>
  );
};

export const UnifiedAudienceSection: React.FC<UnifiedAudienceSectionProps> = ({ isRtl }) => {
  const shouldReduceMotion = useReducedMotion();

  const studentTitle = isRtl ? (
    <>البرمجة متعة <span className="text-cyan-700">حلّ المشكلات</span>، وليست واجباً ثقيلاً</>
  ) : (
    <>Coding is the thrill of <span className="text-cyan-700">problem solving</span>, not a tedious chore</>
  );

  const parentTitle = isRtl ? (
    <>استثمار حقيقي في <span className="text-amber-700">مهارة المستقبل</span></>
  ) : (
    <>A genuine investment in <span className="text-amber-700">future skills</span></>
  );

  const studentPoints = isRtl
    ? [
        'محرّر برمجي سحابي من أول درس',
        'تحديات أسبوعية ونقاط خبرة تشجّع التقدّم',
        'مشروعات عملية تُظهر ما تعلّمته',
      ]
    : [
        'In-browser cloud code editor from the very first lesson',
        'Weekly coding challenges and XP that motivate progress',
        'Practical capstone projects showcasing real skills',
      ];

  const parentPoints = isRtl
    ? [
        'تقارير دورية للحضور وإنجاز المهام',
        'تقييم عملي يركّز على الفهم لا الحفظ',
        'بيئة تعليمية آمنة بإشراف متخصص',
      ]
    : [
        'Periodic attendance logs and assignment completion reports',
        'Practical evaluations focused on comprehension over memorization',
        'Safe, focused learning environment under expert mentorship',
      ];

  return (
    <section id="students" className="relative scroll-mt-20 overflow-hidden bg-slate-50 py-10 dark:bg-slate-950 sm:py-16">
      <div id="parents" className="mx-auto max-w-7xl scroll-mt-24 px-4 sm:px-6 lg:px-8">
        <motion.header
          initial={shouldReduceMotion ? false : 'hidden'}
          whileInView="visible"
          viewport={viewportOnce}
          variants={fadeInUp}
          className="mx-auto mb-6 max-w-2xl text-center sm:mb-10"
        >
          <SectionTag text={isRtl ? 'شراكة تعليمية واضحة' : 'Clear Educational Partnership'} icon={Users} />
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-950 dark:text-white sm:text-4xl">
            {isRtl ? 'دفتر واحد، رحلتان متكاملتان' : 'One Notebook, Two Complementary Journeys'}
          </h2>
          <p className="mt-4 text-sm leading-7 text-slate-600 dark:text-slate-300 sm:text-base">
            {isRtl
              ? 'مساحة واضحة للطالب ليبني ويجرّب، ولوحة متابعة تمنح ولي الأمر صورة دقيقة عن التقدّم.'
              : 'A dedicated workspace for students to build and experiment, and a progress dashboard giving parents total transparency.'}
          </p>
        </motion.header>

        <motion.div
          initial={shouldReduceMotion ? false : 'hidden'}
          whileInView="visible"
          viewport={viewportOnce}
          variants={scaleReveal}
          className="relative rounded-[28px] bg-slate-800 p-1.5 shadow-[0_28px_65px_-24px_rgba(15,23,42,0.75)] sm:p-2"
        >
          <div className="relative overflow-hidden rounded-[22px] bg-[#182231]">
            <div className="relative grid lg:grid-cols-[minmax(0,1fr)_48px_minmax(0,1fr)]">
              <div className="group relative">
                <NotebookPage
                  accent="cyan"
                  isRtl={isRtl}
                  audience={isRtl ? 'للطلاب' : 'For Students'}
                  title={studentTitle}
                  description={
                    isRtl
                      ? 'اكتب كودك بنفسك، جرّب، أخطئ، ثم أصلح. هنا تتحوّل الأفكار الصغيرة إلى مشروعات تعمل أمامك.'
                      : 'Write your own code, experiment, make mistakes, and fix them. Watch ideas turn into real, functioning projects right before you.'
                  }
                  points={studentPoints}
                  action={isRtl ? 'انضم إلى زملائك' : 'Join Your Peers'}
                  to="/register"
                />
              </div>
              <div className="relative hidden items-center justify-center bg-slate-800 lg:flex" aria-hidden="true">
                <div className="absolute inset-y-0 w-px bg-black/30" />
                <div className="relative flex h-full flex-col justify-around py-8">
                  {[0, 1, 2, 3].map((ring) => (
                    <span
                      key={ring}
                      className="h-7 w-1.5 rounded-full border border-slate-400/50 bg-gradient-to-r from-slate-500 via-slate-100 to-slate-600 shadow-sm"
                    />
                  ))}
                </div>
              </div>
              <div className="group relative border-t border-dashed border-slate-700 lg:border-t-0">
                <NotebookPage
                  accent="amber"
                  isRtl={isRtl}
                  audience={isRtl ? 'لأولياء الأمور' : 'For Parents'}
                  title={parentTitle}
                  description={
                    isRtl
                      ? 'نحوّل وقت الشاشة إلى تعلّم منضبط وملموس، مع متابعة تساعدك على رؤية التزام ابنك وتقدّمه خطوة بخطوة.'
                      : 'We transform screen time into structured, tangible learning, with insights that help you see your child’s commitment and progress step by step.'
                  }
                  points={parentPoints}
                  action={isRtl ? 'قدّم طلب تسجيل' : 'Apply for Enrollment'}
                  to="/student-registration"
                />
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
};
