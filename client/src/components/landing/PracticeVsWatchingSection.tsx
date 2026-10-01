import React from 'react';
import { Video, ArrowLeft, ArrowRight, Check, X, Sparkles, Terminal } from 'lucide-react';
import { SectionTag } from './SectionTag';

interface PracticeVsWatchingProps {
  isRtl: boolean;
}

export const PracticeVsWatchingSection: React.FC<PracticeVsWatchingProps> = ({ isRtl }) => {
  const ArrowIcon = isRtl ? ArrowLeft : ArrowRight;

  return (
    <section className="relative py-10 sm:py-14 bg-slate-100/70 dark:bg-slate-900/60 border-y border-slate-200 dark:border-slate-800/80 overflow-hidden">
      {/* Background Subtle Grid Texture */}
      <div className="absolute inset-0 bg-[radial-gradient(#94a3b8_1px,transparent_1px)] dark:bg-[radial-gradient(#334155_1px,transparent_1px)] [background-size:20px_20px] opacity-25 pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-8 sm:mb-10 space-y-3">
          <SectionTag text={isRtl ? 'منهجية البناء العملي' : 'Active Construction Method'} icon={Terminal} />
          <h2 className="text-2xl sm:text-4xl font-bold text-slate-950 dark:text-white tracking-tight">
            {isRtl
              ? 'البرمجة ممارسة وبناء.. وليست مجرد مشاهدة'
              : 'Coding is Practice & Building — Not Passive Watching'}
          </h2>
          <p className="text-sm sm:text-base text-slate-600 dark:text-slate-300 max-w-2xl mx-auto leading-relaxed">
            {isRtl
              ? 'لماذا تفشل الطرق التقليدية في ترسيخ مهارة الكود، وكيف تمنحك كودك الاستقلالية الهندسية من اليوم الأول؟'
              : 'Why conventional video-watching fails to build genuine coders, and how CodeK fosters immediate problem-solving autonomy.'}
          </p>
        </div>

        {/* Side-by-Side Comparison Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-center">
          {/* 1. Left (In RTL Right): The Passive Frustrating Way */}
          <div className="lg:col-span-5 relative bg-white dark:bg-slate-950/80 p-6 sm:p-8 rounded-3xl border border-rose-200 dark:border-rose-950/40 shadow-md opacity-90">
            <div className="flex items-center justify-between mb-5">
              <span className="text-xs font-mono font-bold bg-rose-100 dark:bg-rose-950/70 text-rose-700 dark:text-rose-300 px-3 py-1 rounded-lg border border-rose-200 dark:border-rose-800">
                {isRtl ? '✕ الطريقة التقليدية المحبطة' : '✕ The Passive Frustrating Way'}
              </span>
              <span className="text-xs font-mono text-slate-400">
                {isRtl ? 'فيديوهات مسجلة لساعات!' : 'Hours of passive video'}
              </span>
            </div>

            {/* Video Player Mockup with Strike Line */}
            <div className="aspect-video bg-slate-100 dark:bg-slate-900 rounded-2xl relative flex flex-col items-center justify-center p-4 text-center overflow-hidden border border-slate-200 dark:border-slate-800">
              {/* Red Strikethrough Diagonal Line */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-[120%] h-1 bg-rose-500 rotate-[-22deg] shadow-md shadow-rose-500/30" />
              </div>

              <Video className="w-12 h-12 text-slate-400 dark:text-slate-600 mb-2 opacity-50" />
              <p className="font-bold text-slate-700 dark:text-slate-300 text-sm">
                {isRtl ? 'مشاهدة سلبية وسرعة تشتت' : 'Passive watching & distraction'}
              </p>
              <span className="text-xs text-slate-500 font-mono mt-1">
                {isRtl ? 'نسيان كل ما شاهدته بمجرد إغلاق الفيديو' : 'Forgotten minutes after closing the tab'}
              </span>
            </div>

            {/* Bullet Pain Points */}
            <ul className="mt-5 space-y-2.5 text-xs sm:text-sm text-slate-600 dark:text-slate-400">
              <li className="flex items-start gap-2">
                <X className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                <span>
                  {isRtl
                    ? 'حفظ سطحي للأوامر والدوال دون فهم عميق لكيفية استخدامها في سياقات جديدة.'
                    : 'Memorizing syntax without understanding algorithmic logic.'}
                </span>
              </li>
              <li className="flex items-start gap-2">
                <X className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                <span>
                  {isRtl
                    ? 'صدمة وعجز تام عند فتح شاشة محرر الكود الفارغة لمحاولة الحل بمفردك.'
                    : 'Freezing before a blank editor when attempting to build alone.'}
                </span>
              </li>
            </ul>
          </div>

          {/* 2. Center: Transformation Arrow Metaphor */}
          <div className="lg:col-span-2 flex flex-col items-center justify-center py-2">
            <div className="w-12 h-12 rounded-full bg-brand-600 text-white flex items-center justify-center shadow-lg shadow-brand-600/30 rotate-90 lg:rotate-0">
              <ArrowIcon className="w-6 h-6" />
            </div>
            <span className="text-[11px] font-mono text-brand-600 dark:text-brand-400 mt-2 font-bold uppercase tracking-wider">
              {isRtl ? 'التحول الهندسي' : 'The Shift'}
            </span>
          </div>

          {/* 3. Right (In RTL Left): CodeK's Active Construction Method */}
          <div className="lg:col-span-5 relative bg-white dark:bg-slate-950 p-6 sm:p-8 rounded-3xl border-2 border-brand-500/40 shadow-xl">
            {/* Top Tape Marker Doodle */}
            <div className="absolute -top-3.5 end-8 bg-amber-300 text-slate-950 px-3 py-0.5 rounded shadow-sm text-[11px] font-mono font-bold rotate-[-2deg] select-none pointer-events-none">
              {isRtl ? 'مُوصى به تربوياً' : 'Recommended'}
            </div>

            <div className="flex items-center justify-between mb-5">
              <span className="text-xs font-mono font-bold bg-brand-500 text-white px-3 py-1 rounded-lg shadow-sm">
                {isRtl ? '✓ أسلوب كودك: البناء الحي' : '✓ CodeK: Live Active Building'}
              </span>
              <span className="text-xs font-mono text-amber-500 font-bold">
                {isRtl ? '100% تطبيقي وعملي' : '100% Applied'}
              </span>
            </div>

            {/* Interactive Workspace Mini-Mockup */}
            <div className="bg-slate-900 rounded-2xl p-4 space-y-2 border border-slate-800 text-left font-mono text-xs text-slate-200">
              <div className="flex items-center justify-between text-[11px] text-slate-400 border-b border-slate-800 pb-2">
                <div className="flex items-center gap-1.5">
                  <Terminal className="w-3.5 h-3.5 text-cyan-400" />
                  <span>mission_solver.py</span>
                </div>
                <span className="text-emerald-400 font-semibold flex items-center gap-1">
                  <Sparkles className="w-3 h-3" /> Live Run
                </span>
              </div>
              <div className="p-2 rounded-lg bg-slate-950 text-slate-300 leading-relaxed text-[11px]">
                <span className="text-slate-500"># اكتب أمر الإطلاق المناسب:</span><br />
                <span className="text-cyan-400">rocket</span>.<span className="text-amber-400">launch</span>(<span className="text-purple-400">speed</span>=<span className="text-emerald-400">120</span>)<br />
                <span className="text-emerald-400 font-bold">&gt;&gt; تم الوصول بنجاح! +50 XP ✨</span>
              </div>
            </div>

            {/* Bullet Strengths */}
            <ul className="mt-5 space-y-2.5 text-xs sm:text-sm text-slate-700 dark:text-slate-300">
              <li className="flex items-start gap-2">
                <Check className="w-4 h-4 text-brand-600 dark:text-brand-400 shrink-0 mt-0.5" />
                <span>
                  {isRtl
                    ? 'كتابة كود حقيقي من أول دقيقة وتجربة النتائج عملياً داخل المحرر.'
                    : 'Writing real code from minute one inside the integrated IDE.'}
                </span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="w-4 h-4 text-brand-600 dark:text-brand-400 shrink-0 mt-0.5" />
                <span>
                  {isRtl
                    ? 'رؤية الأثر المباشر لكل سطر برمجي في أجزاء من الثانية لترسيخ الثقة.'
                    : 'Immediate feedback loop cementing concepts in muscle memory.'}
                </span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="w-4 h-4 text-brand-600 dark:text-brand-400 shrink-0 mt-0.5" />
                <span>
                  {isRtl
                    ? 'بناء عقلية هندسية مستقلة قادرة على تحليل المشكلات وتفكيكها بثقة.'
                    : 'Fostering an independent engineering mindset capable of true problem solving.'}
                </span>
              </li>
            </ul>

            <div className="mt-5 pt-3 border-t border-slate-200 dark:border-slate-800 text-center">
              <span className="inline-block px-3 py-1 bg-amber-500/10 dark:bg-amber-400/10 text-amber-700 dark:text-amber-300 rounded-lg font-mono text-xs font-semibold">
                {isRtl ? '«البرمجة تُكتسب بالأصابع والعقل، لا بمجرد العينين!» ✏️' : '«Coding is built with mind and hands, not just eyes!» ✏️'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
