import React, { useEffect, useState } from 'react';
import { Clock, AlertTriangle } from 'lucide-react';
import { cn } from '../../lib/utils.js';

interface ExamTimerProps {
  durationMinutes: number;
  onTimeUp: () => void;
  className?: string;
}

export function ExamTimer({ durationMinutes, onTimeUp, className }: ExamTimerProps) {
  const [secondsRemaining, setSecondsRemaining] = useState(durationMinutes * 60);

  useEffect(() => {
    if (secondsRemaining <= 0) {
      onTimeUp();
      return;
    }

    const interval = setInterval(() => {
      setSecondsRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          onTimeUp();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [secondsRemaining, onTimeUp]);

  const minutes = Math.floor(secondsRemaining / 60);
  const seconds = secondsRemaining % 60;

  const isLowTime = secondsRemaining <= 300; // Under 5 minutes

  return (
    <div
      className={cn(
        'inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl font-mono font-bold text-sm border shadow-sm select-none',
        isLowTime
          ? 'bg-rose-50 dark:bg-rose-950/80 border-rose-300 dark:border-rose-800 text-rose-700 dark:text-rose-300 animate-pulse'
          : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200',
        className
      )}
    >
      {isLowTime ? (
        <AlertTriangle className="w-4 h-4 text-rose-500" />
      ) : (
        <Clock className="w-4 h-4 text-brand-500" />
      )}
      <span>
        {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
      </span>
    </div>
  );
}
