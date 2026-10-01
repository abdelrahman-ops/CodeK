import React from 'react';
import { BookOpen, Calendar, Layers, Bookmark } from 'lucide-react';
import { ContentAuthority } from '../../types/api';

interface TextbookProvenanceProps {
  authority?: ContentAuthority;
  pageRange?: string | null;
  academicYear?: string | null;
  term?: string | null;
  officialTitle?: string | null;
  track?: string | null;
}

export const TextbookProvenance: React.FC<TextbookProvenanceProps> = ({
  authority,
  pageRange,
  academicYear,
  term,
  officialTitle,
  track
}) => {
  // Graceful fallback for legacy/custom courses: hide banner entirely if not official
  if (authority !== 'OFFICIAL') {
    return null;
  }

  const formatTerm = (t?: string | null) => {
    if (!t) return null;
    if (t === 'TERM_1' || t === '1') return 'الترم الأول';
    if (t === 'TERM_2' || t === '2') return 'الترم الثاني';
    return t;
  };

  return (
    <div className="relative overflow-hidden rounded-xl border border-emerald-500/20 bg-emerald-500/5 dark:bg-emerald-950/10 p-3.5 md:p-4 mb-6 transition-all">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Factual Provenance Statement */}
        <div className="flex items-start gap-2.5">
          <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 mt-0.5 sm:mt-0 shrink-0">
            <BookOpen className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                مرجعية المنهج الدراسي
              </span>
            </div>
            <p className="text-xs md:text-sm font-medium text-foreground mt-0.5">
              محتوى مستند إلى منهج وزارة التربية والتعليم المصرية
            </p>
            {officialTitle && (
              <p className="text-xs text-muted-foreground mt-0.5">
                عنوان الدرس بالكتاب: {officialTitle}
              </p>
            )}
          </div>
        </div>

        {/* Separated Metadata Badges */}
        <div className="flex flex-wrap items-center gap-2 text-xs font-medium">
          {pageRange && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-background border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 shadow-sm">
              <Bookmark className="w-3.5 h-3.5 text-emerald-500" />
              <span>كتاب الوزارة: ص {pageRange.replace(/^ص\s*/, '')}</span>
            </span>
          )}

          {academicYear && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-background border border-border text-muted-foreground shadow-sm">
              <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
              <span>العام: {academicYear}</span>
            </span>
          )}

          {term && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-background border border-border text-muted-foreground shadow-sm">
              <Layers className="w-3.5 h-3.5 text-muted-foreground" />
              <span>{formatTerm(term)}</span>
            </span>
          )}

          {track && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-background border border-border text-muted-foreground shadow-sm">
              <span>{track}</span>
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
