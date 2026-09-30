import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { Play, RotateCcw, ArrowRight, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

interface HeroTerminalProps {
  isRtl: boolean;
}

interface CodeToken {
  text: string;
  color: string;
}

interface CodeLine {
  raw: string;
  tokens: CodeToken[];
}

const CODE_LINES: CodeLine[] = [
  {
    raw: '# CodeK Academy: Your First Step',
    tokens: [{ text: '# CodeK Academy: Your First Step', color: 'text-slate-500' }],
  },
  {
    raw: 'student = "Ahmed"',
    tokens: [
      { text: 'student', color: 'text-cyan-400' },
      { text: ' = ', color: 'text-slate-400' },
      { text: '"Ahmed"', color: 'text-amber-300' },
    ],
  },
  {
    raw: 'grade = "Grade 2 Secondary"',
    tokens: [
      { text: 'grade', color: 'text-cyan-400' },
      { text: ' = ', color: 'text-slate-400' },
      { text: '"Grade 2 Secondary"', color: 'text-amber-300' },
    ],
  },
  {
    raw: 'skills = ["Python", "AI"]',
    tokens: [
      { text: 'skills', color: 'text-cyan-400' },
      { text: ' = [', color: 'text-slate-400' },
      { text: '"Python"', color: 'text-amber-300' },
      { text: ', ', color: 'text-slate-400' },
      { text: '"AI"', color: 'text-amber-300' },
      { text: ']', color: 'text-slate-400' },
    ],
  },
  {
    raw: 'print(f"Welcome {student}! AI journey starts now.")',
    tokens: [
      { text: 'print', color: 'text-purple-400' },
      { text: '(', color: 'text-slate-400' },
      { text: 'f"Welcome {student}! AI journey starts now."', color: 'text-emerald-400' },
      { text: ')', color: 'text-slate-400' },
    ],
  },
];

export const HeroTerminal: React.FC<HeroTerminalProps> = ({ isRtl }) => {
  const [lineIdx, setLineIdx] = useState(0);
  const [charIdx, setCharIdx] = useState(0);
  const [isTypingComplete, setIsTypingComplete] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [showOutput, setShowOutput] = useState(false);

  const ArrowIcon = isRtl ? ArrowLeft : ArrowRight;

  // Typewriter effect controller
  useEffect(() => {
    if (isTypingComplete) return;

    const currentLine = CODE_LINES[lineIdx];
    if (!currentLine) return;

    if (charIdx < currentLine.raw.length) {
      // Natural typing cadence (14-26ms per char)
      const delay = Math.random() * 12 + 14;
      const timer = setTimeout(() => {
        setCharIdx((prev) => prev + 1);
      }, delay);
      return () => clearTimeout(timer);
    } else {
      // Finished current line
      if (lineIdx < CODE_LINES.length - 1) {
        const pause = setTimeout(() => {
          setLineIdx((prev) => prev + 1);
          setCharIdx(0);
        }, 80);
        return () => clearTimeout(pause);
      } else {
        // All lines finished typing!
        setIsTypingComplete(true);
      }
    }
  }, [lineIdx, charIdx, isTypingComplete]);

  // Handle manual rerun or replay
  const handleReplay = useCallback(() => {
    setLineIdx(0);
    setCharIdx(0);
    setIsTypingComplete(false);
    setIsExecuting(false);
    setShowOutput(false);
  }, []);

  const handleInstantRun = useCallback(() => {
    setLineIdx(CODE_LINES.length - 1);
    setCharIdx(CODE_LINES[CODE_LINES.length - 1].raw.length);
    setIsTypingComplete(true);
    setIsExecuting(true);
    setTimeout(() => {
      setIsExecuting(false);
      setShowOutput(true);
    }, 250);
  }, []);

  // Helper to render tokens with partial character slice
  const renderPartialLine = (line: CodeLine, count: number) => {
    let remaining = count;
    const elements: React.ReactNode[] = [];

    for (let i = 0; i < line.tokens.length; i++) {
      const token = line.tokens[i];
      if (remaining <= 0) break;

      if (remaining >= token.text.length) {
        elements.push(
          <span key={i} className={token.color}>
            {token.text}
          </span>
        );
        remaining -= token.text.length;
      } else {
        elements.push(
          <span key={i} className={token.color}>
            {token.text.slice(0, remaining)}
          </span>
        );
        remaining = 0;
      }
    }

    return elements;
  };

  const shouldReduceMotion = useReducedMotion();

  return (
    <div className="relative">
      {/* Top Floating Sticky Note (Studio concept from stitch) */}
      <motion.div
        dir="ltr"
        animate={
          shouldReduceMotion
            ? undefined
            : {
                y: [0, -5, 0],
                rotate: [-3.5, -2, -3.5],
              }
        }
        transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
        className="hidden sm:block absolute -top-5 -start-4 z-20 bg-amber-300 dark:bg-amber-300 text-slate-950 px-3.5 py-2 rounded-xl shadow-xl rotate-[-3.5deg] text-xs font-mono border border-amber-400 select-none pointer-events-none text-left"
      >
        <div className="flex items-center justify-between border-b border-slate-950/20 pb-1 mb-1 text-[11px] font-bold">
          <span className="opacity-70 font-mono">loop.py</span>
        </div>
        <pre dir="ltr" className="text-[11px] font-mono leading-tight font-semibold text-left">
          <code>{`for idea in creative_mind:
    build(idea)`}</code>
        </pre>
      </motion.div>

      {/* Bottom Floating Stamp (From stitch design) */}
      <motion.div
        animate={
          shouldReduceMotion
            ? undefined
            : {
                y: [0, 4, 0],
                rotate: [2, 3, 2],
              }
        }
        transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
        className="hidden sm:inline-flex items-center gap-1 absolute -bottom-3.5 -end-3 z-20 bg-slate-900/95 border-2 border-dashed border-emerald-500/90 text-emerald-400 px-3 py-1 rounded-xl text-xs font-bold rotate-2 shadow-xl backdrop-blur-md select-none pointer-events-none"
      >
        <span>★ {isRtl ? 'منهج معتمد هندسياً' : 'Engineered Curriculum'}</span>
      </motion.div>

      {/* Outer futuristic glowing aura */}
      <motion.div
        animate={
          shouldReduceMotion
            ? { opacity: 0.65 }
            : {
                opacity: [0.6, 0.85, 0.6],
                scale: [0.99, 1.01, 0.99],
              }
        }
        transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
        className="absolute -inset-1.5 bg-gradient-to-r from-cyan-500/25 via-brand-500/30 to-purple-500/25 rounded-3xl blur-xl pointer-events-none"
      />

      <div
        dir="ltr"
        className="relative rounded-2xl bg-slate-950/95 border border-slate-800 shadow-2xl p-4 sm:p-5 overflow-hidden text-left font-mono text-xs sm:text-[13px] backdrop-blur-xl"
      >
        {/* Terminal Header */}
        <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-800 mb-2.5">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 shrink-0">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500/90 inline-block" />
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500/90 inline-block" />
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/90 inline-block" />
            </div>
            <span className="text-xs text-slate-400 font-mono">main.py</span>
          </div>
          <span className="text-[11px] px-2 py-0.5 rounded bg-slate-800 text-cyan-400 font-sans font-medium border border-cyan-500/30">
            Python 3.12
          </span>
        </div>

        {/* Code Body - Live Typewriter with Syntax Highlighting */}
        <div className="space-y-1 text-slate-300 leading-relaxed font-mono text-[11.5px] sm:text-xs md:text-[13px]">
          {CODE_LINES.map((line, idx) => {
            if (idx < lineIdx) {
              // Completed line
              return (
                <div key={idx} className="whitespace-pre">
                  {line.tokens.map((token, tIdx) => (
                    <span key={tIdx} className={token.color}>
                      {token.text}
                    </span>
                  ))}
                </div>
              );
            }

            if (idx === lineIdx) {
              // Actively typing line
              return (
                <div key={idx} className="whitespace-pre flex items-center">
                  <span>{renderPartialLine(line, charIdx)}</span>
                  {/* Blinking Cyan Cursor */}
                  <motion.span
                    animate={{ opacity: [1, 0, 1] }}
                    transition={{ duration: 0.8, repeat: Infinity, ease: 'easeInOut' }}
                    className="inline-block w-2 h-4 bg-cyan-400 ms-0.5 align-middle shadow-[0_0_8px_#22d3ee]"
                  />
                </div>
              );
            }

            return null;
          })}
        </div>

        {/* Live Terminal Output Tray — ONLY visible after clicking 'تشغيل الكود' */}
        <AnimatePresence>
          {(isExecuting || showOutput) && (
            <motion.div
              initial={{ opacity: 0, height: 0, y: 4 }}
              animate={{ opacity: 1, height: 'auto', y: 0 }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.25 }}
              className="mt-2.5 p-2.5 rounded-xl bg-slate-900/90 border border-slate-800/90 font-mono text-xs overflow-hidden"
            >
              {isExecuting ? (
                <div className="flex items-center gap-2 text-cyan-400 py-1 animate-pulse">
                  <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
                  <span className="text-xs">
                    {isRtl ? 'جارٍ تنفيذ الكود في السحابة...' : 'Executing in cloud sandbox...'}
                  </span>
                </div>
              ) : (
                <div className="space-y-0.5">
                  <div className="flex items-center justify-between text-[11px] text-slate-500">
                    <span>Terminal Output</span>
                    <span className="text-emerald-400 font-sans font-semibold">
                      ● Live Runtime (0.02s)
                    </span>
                  </div>
                  <p className="text-emerald-300 font-semibold truncate text-xs pt-0.5">
                    &gt; Welcome Ahmed! AI journey starts now.
                  </p>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Direct CTA & Controls in terminal card footer */}
        <div className="mt-2.5 pt-2 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2">
            <span className="text-slate-400 font-sans text-[11px]">
              {isRtl ? 'اكتب كودك وتدرّب عملياً' : 'Write code yourself & practice hands-on'}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {isTypingComplete ? (
              <motion.button
                whileHover={shouldReduceMotion ? undefined : { scale: 1.04 }}
                whileTap={shouldReduceMotion ? undefined : { scale: 0.96 }}
                type="button"
                onClick={handleReplay}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs transition border border-slate-700 cursor-pointer"
                title={isRtl ? 'إعادة كتابة الكود' : 'Replay Typewriter'}
              >
                <RotateCcw className="w-3 h-3 text-cyan-400" />
                <span className="font-sans text-[11px]">{isRtl ? 'إعادة' : 'Replay'}</span>
              </motion.button>
            ) : null}

            <motion.button
              whileHover={shouldReduceMotion ? undefined : { scale: 1.03, y: -0.5 }}
              whileTap={shouldReduceMotion ? undefined : { scale: 0.97 }}
              type="button"
              onClick={handleInstantRun}
              disabled={isExecuting}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs shadow-md shadow-emerald-500/25 transition transform cursor-pointer disabled:opacity-75"
            >
              <Play className="w-3 h-3 fill-current" />
              <span className="font-sans">
                {isExecuting
                  ? isRtl
                    ? 'جارٍ التشغيل...'
                    : 'Running...'
                  : isRtl
                  ? 'تشغيل الكود'
                  : 'Run Code'}
              </span>
            </motion.button>
          </div>
        </div>
      </div>
    </div>
  );
};
