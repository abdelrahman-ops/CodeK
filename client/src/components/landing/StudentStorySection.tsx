import React from 'react';
import { Link } from 'react-router-dom';
import { Sparkles, ArrowRight, ArrowLeft } from 'lucide-react';
import { SectionTag } from './SectionTag';

interface StudentStorySectionProps {
  isRtl: boolean;
}

export const StudentStorySection: React.FC<StudentStorySectionProps> = ({ isRtl }) => {
  const ArrowIcon = isRtl ? ArrowLeft : ArrowRight;

  return (
    <section className="py-10 sm:py-14 bg-slate-900 text-white relative overflow-hidden border-t border-slate-800">
      <div className="absolute inset-0 bg-[radial-gradient(#6366f1_1px,transparent_1px)] [background-size:24px_24px] opacity-15 pointer-events-none" />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
          {/* Story Visual with Lab Image */}
          <div className="lg:col-span-6 relative">
            <div className="relative rounded-3xl overflow-hidden border-2 border-brand-500/30 shadow-2xl shadow-brand-500/10 group">
              <img
                src="/images/students-coding-lab.jpg"
                alt="Students in CodeK AI Lab"
                className="w-full h-auto object-cover transform group-hover:scale-105 transition duration-500"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent" />
              <div className="absolute bottom-3 start-3 end-3 p-3.5 rounded-2xl bg-slate-950/85 backdrop-blur-md border border-slate-800 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="font-semibold text-slate-200">
                    {isRtl ? 'معمل البرمجة والذكاء الاصطناعي — بيئة حية' : 'AI & Coding Lab — Live Environment'}
                  </span>
                </div>
                <span className="text-brand-400 font-mono font-bold text-[11px]">CodeK Academy</span>
              </div>
            </div>
          </div>

          {/* Story Chapters */}
          <div className="lg:col-span-6 space-y-5 relative">
            {/* Subtle Storyset Learning Accent */}
            <div className="hidden xl:block absolute -top-8 -end-6 w-36 h-36 opacity-15 pointer-events-none select-none">
              <img
                src="/illustrations/learning-rafiki.svg"
                alt=""
                aria-hidden="true"
                className="w-full h-full object-contain filter drop-shadow-md"
              />
            </div>

            <SectionTag text={isRtl ? 'قصة طالب في كودك' : 'The CodeK Student Story'} icon={Sparkles} />

            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight leading-snug">
              {isRtl ? (
                <>
                  من المشاهدة السطحية.. إلى{' '}
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-400 to-cyan-400">
                    بناء مشاريع برمجية حقيقية
                  </span>
                </>
              ) : (
                <>
                  From Passive Browsing to{' '}
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-400 to-cyan-400">
                    Building Real Software
                  </span>
                </>
              )}
            </h2>

            <p className="text-sm sm:text-base text-slate-300 leading-relaxed">
              {isRtl
                ? 'الكثير من الطلاب يبدأون بمشاهدة مقاطع يوتيوب عشوائية، فيشعرون بالملل والتشتت بعد أيام قليلة. في كودك، نصنع قصة مختلفة تماماً:'
                : 'Many students begin with scattered video tutorials, quickly becoming overwhelmed and losing direction. At CodeK, we forge a completely different journey:'}
            </p>

            {/* 3 Chapters */}
            <div className="space-y-3 pt-1">
              <div className="p-3.5 rounded-xl bg-slate-800/80 border border-slate-700/80 flex items-start gap-3">
                <div className="w-7 h-7 rounded-lg bg-brand-500/20 text-brand-300 font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                  1
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white mb-0.5">
                    {isRtl ? 'وضوح المسار والمنهج الدراسي' : 'Clear Structured Roadmap'}
                  </h4>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    {isRtl
                      ? 'طالب الصف الأول أو الثاني يجد محتوى صفّه بالتحديد مقسماً إلى وحدات ودروس واضحة.'
                      : 'Content strictly organized by student grade with zero confusion.'}
                  </p>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-800/80 border border-slate-700/80 flex items-start gap-3">
                <div className="w-7 h-7 rounded-lg bg-cyan-500/20 text-cyan-300 font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                  2
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white mb-0.5">
                    {isRtl ? 'كتابة الكود والتعلم بالخطأ' : 'Hands-on Coding & Debugging'}
                  </h4>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    {isRtl
                      ? 'لا تخرج من درس دون كتابة كود كامل وتشغيله واكتشاف أخطائه وتصحيحها.'
                      : 'Write and test real code after every concept under direct instructor guidance.'}
                  </p>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-800/80 border border-slate-700/80 flex items-start gap-3">
                <div className="w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-300 font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                  3
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white mb-0.5">
                    {isRtl ? 'بناء عقلية هندسية تدوم' : 'An Enduring Engineering Mindset'}
                  </h4>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    {isRtl
                      ? 'اكتساب القدرة على حل المسائل الحسابية والذكاء الاصطناعي والتفوق الأكاديمي.'
                      : 'Master computational logic, problem solving, and pre-university readiness.'}
                  </p>
                </div>
              </div>
            </div>

            {/* Story CTA */}
            <div className="pt-2">
              <Link
                to="/register"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 text-white shadow-lg shadow-brand-600/25 transition transform hover:-translate-y-0.5"
              >
                <span>{isRtl ? 'ابدأ رحلتك معنا الآن' : 'Start Your Journey With Us'}</span>
                <ArrowIcon className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
