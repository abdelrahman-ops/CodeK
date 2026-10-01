import React from 'react';
import { ArrowRight, Clock, Award, ShieldCheck, BookOpen, Folder, Sparkles, ChevronLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Difficulty, ContentAuthority } from '../../types/api';

interface LessonHeaderProps {
  title: string;
  code?: string | null;
  description?: string | null;
  difficulty?: Difficulty;
  estimatedDurationMinutes?: number;
  authority?: ContentAuthority;
  curriculumId?: string;
  curriculumTitle?: string;
  chapterTitle?: string;
  chapterCode?: string | null;
}

export const LessonHeader: React.FC<LessonHeaderProps> = ({
  title,
  code,
  description,
  difficulty = 'BEGINNER',
  estimatedDurationMinutes = 45,
  authority = 'OFFICIAL',
  curriculumId,
  curriculumTitle,
  chapterTitle,
  chapterCode
}) => {
  const getDifficultyLabel = (diff: Difficulty) => {
    switch (diff) {
      case 'BEGINNER':
        return 'مبتدئ';
      case 'INTERMEDIATE':
        return 'متوسط';
      case 'ADVANCED':
        return 'متقدم';
      default:
        return diff;
    }
  };

  const getDifficultyColor = (diff: Difficulty) => {
    switch (diff) {
      case 'BEGINNER':
        return 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20';
      case 'INTERMEDIATE':
        return 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20';
      case 'ADVANCED':
        return 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20';
      default:
        return 'bg-gray-500/10 text-gray-600 border-gray-500/20';
    }
  };

  // Clean out internal code prefix (e.g. "G11-T1-CH01 — ") so students see clear natural Arabic titles
  const cleanChapterTitle = chapterTitle
    ? chapterTitle.replace(/^[A-Z0-9_-]+\s*—\s*/, '')
    : null;

  return (
    <div className="space-y-4 mb-6">
      {/* Semantic Labeled Breadcrumb Hierarchy — Crystal clear what is what */}
      <nav className="flex flex-wrap items-center gap-1.5 sm:gap-2 text-xs" aria-label="مسار الدرس">
        {curriculumId && (
          <Link
            to={`/student/courses/${curriculumId}`}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100/90 dark:bg-slate-800/90 text-slate-700 dark:text-slate-300 hover:bg-brand-50 hover:text-brand-600 dark:hover:bg-brand-950/60 dark:hover:text-brand-400 border border-slate-200/70 dark:border-slate-700/70 transition shadow-2xs group"
            title={curriculumTitle}
          >
            <BookOpen className="w-3.5 h-3.5 text-brand-500 shrink-0" />
            <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 group-hover:text-brand-500">
              المقرر:
            </span>
            <span className="font-semibold truncate max-w-[180px] sm:max-w-[240px]">
              {curriculumTitle || 'المنهج'}
            </span>
          </Link>
        )}

        {cleanChapterTitle && (
          <>
            <ChevronLeft className="w-3.5 h-3.5 text-slate-400 rtl:rotate-0 ltr:rotate-180 shrink-0" />
            <div
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100/90 dark:bg-slate-800/90 text-slate-700 dark:text-slate-300 border border-slate-200/70 dark:border-slate-700/70 shadow-2xs"
              title={cleanChapterTitle}
            >
              <Folder className="w-3.5 h-3.5 text-amber-500 shrink-0" />
              <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500">
                الوحدة:
              </span>
              <span className="font-medium truncate max-w-[180px] sm:max-w-[240px]">
                {cleanChapterTitle}
              </span>
            </div>
          </>
        )}

        <ChevronLeft className="w-3.5 h-3.5 text-slate-400 rtl:rotate-0 ltr:rotate-180 shrink-0" />

        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-brand-50 dark:bg-brand-950/60 text-brand-700 dark:text-brand-300 border border-brand-200/80 dark:border-brand-800/80 font-bold shadow-2xs">
          <Sparkles className="w-3.5 h-3.5 text-brand-500 shrink-0" />
          <span className="text-[10px] font-bold text-brand-500/80">
            الدرس:
          </span>
          <span className="truncate max-w-[200px] sm:max-w-[280px]">
            {title}
          </span>
        </div>
      </nav>

      {/* Main Title & Metadata Badges */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-border/60 pb-4">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            {code && (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-semibold bg-primary/10 text-primary border border-primary/20">
                {code}
              </span>
            )}
            {authority === 'OFFICIAL' && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                <ShieldCheck className="w-3.5 h-3.5" />
                منهج رسمي
              </span>
            )}
            <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium border ${getDifficultyColor(difficulty)}`}>
              {getDifficultyLabel(difficulty)}
            </span>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs text-muted-foreground bg-muted border border-border">
              <Clock className="w-3 h-3" />
              {estimatedDurationMinutes} دقيقة
            </span>
          </div>

          <h1 className="text-xl md:text-2xl font-bold tracking-tight text-foreground">
            {title}
          </h1>

          {description && (
            <p className="text-sm text-muted-foreground line-clamp-2 max-w-3xl">
              {description}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
