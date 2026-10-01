import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { cn } from '../../lib/utils.js';

interface DoodleProps {
  className?: string;
  color?: string;
  animate?: boolean;
}

/**
 * Hand-drawn SVG underline squiggle.
 * Creates an organic, artistic accent underneath key phrases.
 */
export function DoodleUnderline({ className, animate = false }: DoodleProps) {
  const shouldReduceMotion = useReducedMotion();

  if (animate && !shouldReduceMotion) {
    return (
      <svg
        viewBox="0 0 240 14"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={cn('w-full h-auto select-none pointer-events-none', className)}
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <motion.path
          d="M2 9C50 4 110 11 165 6C195 3 222 8 238 6.5"
          stroke="currentColor"
          strokeWidth="3.2"
          strokeLinecap="round"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={{ duration: 0.85, ease: [0.22, 1, 0.36, 1], delay: 0.2 }}
        />
        <motion.path
          d="M12 11C55 7 115 12 170 8.5C200 6 225 10 234 9"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeOpacity="0.5"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 0.5 }}
          transition={{ duration: 0.85, ease: [0.22, 1, 0.36, 1], delay: 0.35 }}
        />
      </svg>
    );
  }

  return (
    <svg
      viewBox="0 0 240 14"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn('w-full h-auto select-none pointer-events-none', className)}
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <path
        d="M2 9C50 4 110 11 165 6C195 3 222 8 238 6.5"
        stroke="currentColor"
        strokeWidth="3.2"
        strokeLinecap="round"
      />
      <path
        d="M12 11C55 7 115 12 170 8.5C200 6 225 10 234 9"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeOpacity="0.5"
      />
    </svg>
  );
}

/**
 * Hand-drawn 4-point sparkle star.
 */
export function DoodleStar({ className, animate = false }: DoodleProps) {
  const shouldReduceMotion = useReducedMotion();

  const svgContent = (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn('w-6 h-6 select-none pointer-events-none shrink-0', className)}
      aria-hidden="true"
    >
      <path
        d="M16 2C16 10 22 16 30 16C22 16 16 22 16 30C16 22 10 16 2 16C10 16 16 10 16 2Z"
        fill="currentColor"
      />
    </svg>
  );

  if (animate && !shouldReduceMotion) {
    return (
      <motion.div
        animate={{
          scale: [1, 1.15, 1],
          opacity: [0.8, 1, 0.8],
        }}
        transition={{
          duration: 4,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
        className="inline-flex shrink-0"
      >
        {svgContent}
      </motion.div>
    );
  }

  return svgContent;
}

/**
 * Hand-drawn curved arrow with arrowhead.
 */
export function DoodleArrow({
  className,
  flip = false,
  animate = false,
}: DoodleProps & { flip?: boolean }) {
  const shouldReduceMotion = useReducedMotion();

  const svgContent = (
    <svg
      viewBox="0 0 70 50"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn(
        'w-14 h-10 select-none pointer-events-none overflow-visible',
        flip && 'scale-x-[-1]',
        className
      )}
      aria-hidden="true"
    >
      <path
        d="M6 38C22 46 45 42 58 22C64 12 60 8 52 14"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M48 6L60 17L44 24"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );

  if (animate && !shouldReduceMotion) {
    return (
      <motion.div
        animate={{
          y: [0, 4, 0],
          x: flip ? [0, -3, 0] : [0, 3, 0],
        }}
        transition={{
          duration: 3.5,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
        className="inline-flex"
      >
        {svgContent}
      </motion.div>
    );
  }

  return svgContent;
}

/**
 * Hand-drawn highlight circle / loop.
 */
export function DoodleCircle({ className }: DoodleProps) {
  return (
    <svg
      viewBox="0 0 120 60"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn('w-full h-full select-none pointer-events-none overflow-visible', className)}
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <path
        d="M12 34C10 18 35 8 68 7C105 6 116 22 112 36C108 50 78 55 42 54C18 53 4 41 8 28C10 21 22 15 38 12"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray="4 1"
      />
    </svg>
  );
}

/**
 * Hand-drawn curly brackets { }.
 */
export function DoodleBracket({
  className,
  type = 'left',
  animate = false,
}: DoodleProps & { type?: 'left' | 'right' }) {
  const shouldReduceMotion = useReducedMotion();

  const svgContent = (
    <svg
      viewBox="0 0 24 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn(
        'w-6 h-12 select-none pointer-events-none',
        type === 'right' && 'scale-x-[-1]',
        className
      )}
      aria-hidden="true"
    >
      <path
        d="M18 4C10 4 10 14 10 20C10 23 4 24 2 24C4 24 10 25 10 28C10 34 10 44 18 44"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );

  if (animate && !shouldReduceMotion) {
    return (
      <motion.div
        animate={{
          y: type === 'left' ? [0, -5, 0] : [0, 5, 0],
          rotate: type === 'left' ? [-1.5, 1.5, -1.5] : [1.5, -1.5, 1.5],
        }}
        transition={{
          duration: 5.5,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
        className="inline-flex"
      >
        {svgContent}
      </motion.div>
    );
  }

  return svgContent;
}

/**
 * Hand-drawn energetic checkmark.
 */
export function DoodleCheck({ className }: DoodleProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn('w-6 h-6 select-none pointer-events-none', className)}
      aria-hidden="true"
    >
      <path
        d="M4 13.5L9.5 19L20 5.5"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * Hand-drawn lightbulb / idea spark.
 */
export function DoodleIdeaSpark({ className, animate = false }: DoodleProps) {
  const shouldReduceMotion = useReducedMotion();

  const svgContent = (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn('w-8 h-8 select-none pointer-events-none', className)}
      aria-hidden="true"
    >
      <path
        d="M16 4V1M16 31V28M4 16H1M31 16H28M7.5 7.5L5.5 5.5M26.5 26.5L24.5 24.5M24.5 7.5L26.5 5.5M5.5 26.5L7.5 24.5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <circle cx="16" cy="16" r="6" stroke="currentColor" strokeWidth="2.2" />
    </svg>
  );

  if (animate && !shouldReduceMotion) {
    return (
      <motion.div
        animate={{
          scale: [1, 1.12, 1],
          opacity: [0.75, 1, 0.75],
        }}
        transition={{
          duration: 4.5,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
        className="inline-flex"
      >
        {svgContent}
      </motion.div>
    );
  }

  return svgContent;
}
