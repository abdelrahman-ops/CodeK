import React, { useState } from 'react';
import { Lightbulb, ChevronRight, ChevronLeft, Sparkles, Tag, Check, CheckCircle2 } from 'lucide-react';
import { ConceptCard } from '../../types/api';

interface ConceptCardsDeckProps {
  cards?: ConceptCard[] | null;
  onDeckCompleted?: () => void;
}

export const ConceptCardsDeck: React.FC<ConceptCardsDeckProps> = ({
  cards,
  onDeckCompleted
}) => {
  if (!cards || cards.length === 0) {
    return null;
  }

  const [currentIndex, setCurrentIndex] = useState(0);
  const [viewedIndices, setViewedIndices] = useState<Set<number>>(new Set([0]));

  const currentCard = cards[currentIndex];
  const totalCards = cards.length;
  const isLast = currentIndex === totalCards - 1;
  const isFirst = currentIndex === 0;

  const handleNext = () => {
    if (!isLast) {
      const nextIdx = currentIndex + 1;
      setCurrentIndex(nextIdx);
      const updated = new Set(viewedIndices);
      updated.add(nextIdx);
      setViewedIndices(updated);

      if (updated.size === totalCards && onDeckCompleted) {
        onDeckCompleted();
      }
    }
  };

  const handlePrev = () => {
    if (!isFirst) {
      setCurrentIndex(currentIndex - 1);
    }
  };

  const handleSelectCard = (index: number) => {
    setCurrentIndex(index);
    const updated = new Set(viewedIndices);
    updated.add(index);
    setViewedIndices(updated);

    if (updated.size === totalCards && onDeckCompleted) {
      onDeckCompleted();
    }
  };

  const progressPercentage = Math.round((viewedIndices.size / totalCards) * 100);

  return (
    <div className="rounded-2xl border border-border bg-card p-4 md:p-6 mb-6 shadow-sm">
      {/* Header with Counter and Progress */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/60 pb-3 mb-4">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
            <Lightbulb className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-foreground text-sm md:text-base">
                بطاقات المفاهيم الأساسية
              </h3>
              <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-700 dark:text-amber-300">
                {currentIndex + 1} من {totalCards}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              مفاهيم ومصطلحات أساسية للاستيعاب السريع والتركيز
            </p>
          </div>
        </div>

        {/* Progress Pill */}
        <div className="flex items-center gap-2">
          <div className="text-xs text-muted-foreground">
            استيعاب البطاقات: <span className="font-semibold text-foreground">{progressPercentage}%</span>
          </div>
          <div className="w-20 h-2 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full bg-amber-500 transition-all duration-300 rounded-full"
              style={{ width: `${progressPercentage}%` }}
            />
          </div>
        </div>
      </div>

      {/* Card Content Display */}
      <div className="relative min-h-[190px] rounded-xl border border-amber-500/20 bg-gradient-to-b from-amber-500/5 to-transparent p-4 md:p-5 flex flex-col justify-between">
        <div className="space-y-3">
          <div className="flex items-start justify-between gap-2">
            <h4 className="text-base md:text-lg font-bold text-foreground">
              {currentCard.title}
            </h4>
            {viewedIndices.has(currentIndex) && (
              <span className="flex items-center gap-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                <Check className="w-3 h-3" />
                تم الاطلاع
              </span>
            )}
          </div>

          <p className="text-sm text-foreground/90 leading-relaxed">
            {currentCard.explanation || currentCard.summary || currentCard.keyConcept}
          </p>

          {/* Key Takeaway Highlight */}
          {(currentCard.takeaway || (currentCard as any).keyTakeaway) && (
            <div className="flex items-start gap-2 p-2.5 rounded-lg bg-background/90 border border-border/80 text-xs text-foreground/90">
              <Sparkles className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold text-amber-700 dark:text-amber-400 ml-1">الخلاصة:</span>
                <span>{currentCard.takeaway || (currentCard as any).keyTakeaway}</span>
              </div>
            </div>
          )}

          {/* Terminology Pills */}
          {((currentCard.terminology && currentCard.terminology.length > 0) || ((currentCard as any).tags && (currentCard as any).tags.length > 0)) && (
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              {(currentCard.terminology || (currentCard as any).tags).map((term: string, tIdx: number) => (
                <span
                  key={tIdx}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-mono bg-muted/80 text-muted-foreground border border-border"
                >
                  <Tag className="w-3 h-3 text-muted-foreground/70" />
                  {term}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Carousel Navigation & Jump Pills */}
        <div className="flex items-center justify-between gap-2 pt-4 mt-2 border-t border-border/40">
          <div className="flex items-center gap-1">
            {cards.map((_, dotIdx) => (
              <button
                key={dotIdx}
                type="button"
                onClick={() => handleSelectCard(dotIdx)}
                className={`w-2.5 h-2.5 rounded-full transition-all ${
                  dotIdx === currentIndex
                    ? 'w-6 bg-amber-500'
                    : viewedIndices.has(dotIdx)
                    ? 'bg-amber-500/40'
                    : 'bg-muted-foreground/20'
                }`}
                title={`الانتقال إلى بطاقة ${dotIdx + 1}`}
              />
            ))}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrev}
              disabled={isFirst}
              className="px-3 py-1.5 rounded-lg text-xs font-medium border border-border bg-background hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center gap-1"
            >
              <ChevronRight className="w-4 h-4" />
              السابق
            </button>

            <button
              type="button"
              onClick={handleNext}
              disabled={isLast}
              className="px-3 py-1.5 rounded-lg text-xs font-medium bg-amber-500 text-white hover:bg-amber-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center gap-1"
            >
              التالي
              <ChevronLeft className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
