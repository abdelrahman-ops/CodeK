import { Variants } from 'framer-motion';

/**
 * Standard motion timing tokens (in seconds)
 */
export const DURATION = {
  fast: 0.2,       // Micro-interactions, hover, tap
  standard: 0.45,  // Card transitions, accordions
  reveal: 0.6,     // Section & container reveals
  float: 6.0,      // Slow organic ambient idle motion
};

/**
 * Standard easing curves
 */
export const EASING = {
  out: [0.22, 1, 0.36, 1] as const,       // Smooth deceleration (cubic-bezier)
  inOut: [0.4, 0, 0.2, 1] as const,       // Gentle symmetrical transition
};

/**
 * Stagger intervals
 */
export const STAGGER = {
  tight: 0.05,
  standard: 0.08,
  loose: 0.12,
};

/**
 * Common Viewport Trigger Configuration:
 * - Triggers once when 15% of element is in view
 * - Prevents elements repeatedly disappearing/reappearing
 */
export const viewportOnce = {
  once: true,
  amount: 0.15,
};

/**
 * Fade up entrance variant
 */
export const fadeInUp: Variants = {
  hidden: { opacity: 0, y: 22 },
  visible: (customDelay: number = 0) => ({
    opacity: 1,
    y: 0,
    transition: {
      duration: DURATION.reveal,
      ease: EASING.out,
      delay: customDelay,
    },
  }),
};

/**
 * Fade down entrance variant (e.g. top badge, navbar)
 */
export const fadeInDown: Variants = {
  hidden: { opacity: 0, y: -12 },
  visible: (customDelay: number = 0) => ({
    opacity: 1,
    y: 0,
    transition: {
      duration: DURATION.standard,
      ease: EASING.out,
      delay: customDelay,
    },
  }),
};

/**
 * Directional horizontal entrance variants
 */
export const fadeInLeft: Variants = {
  hidden: { opacity: 0, x: -24 },
  visible: (customDelay: number = 0) => ({
    opacity: 1,
    x: 0,
    transition: {
      duration: DURATION.reveal,
      ease: EASING.out,
      delay: customDelay,
    },
  }),
};

export const fadeInRight: Variants = {
  hidden: { opacity: 0, x: 24 },
  visible: (customDelay: number = 0) => ({
    opacity: 1,
    x: 0,
    transition: {
      duration: DURATION.reveal,
      ease: EASING.out,
      delay: customDelay,
    },
  }),
};

/**
 * Scale reveal variant (for cards, founder frame, terminal)
 */
export const scaleReveal: Variants = {
  hidden: { opacity: 0, scale: 0.96 },
  visible: (customDelay: number = 0) => ({
    opacity: 1,
    scale: 1,
    transition: {
      duration: DURATION.reveal,
      ease: EASING.out,
      delay: customDelay,
    },
  }),
};

/**
 * Stagger container helper
 */
export const staggerContainer = (
  staggerTime: number = STAGGER.standard,
  delayChildren: number = 0
): Variants => ({
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: staggerTime,
      delayChildren,
    },
  },
});

/**
 * Standard staggered item
 */
export const itemFadeUp: Variants = {
  hidden: { opacity: 0, y: 18 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: DURATION.standard,
      ease: EASING.out,
    },
  },
};

/**
 * Micro-interactions: Card Hover
 */
export const subtleHoverCard = {
  y: -4,
  transition: {
    duration: DURATION.fast,
    ease: EASING.out,
  },
};

/**
 * Micro-interactions: Button Hover & Tap
 */
export const subtleHoverButton = {
  y: -1.5,
  scale: 1.01,
  transition: {
    duration: DURATION.fast,
    ease: EASING.out,
  },
};

export const subtleTapButton = {
  scale: 0.98,
};

/**
 * Ambient floating idle motion (ultra-subtle, non-distracting)
 */
export const ambientFloat: Variants = {
  animate: {
    y: [0, -6, 0],
    rotate: [0, 1.2, 0],
    transition: {
      duration: DURATION.float,
      repeat: Infinity,
      ease: 'easeInOut',
    },
  },
};

/**
 * Reduced-motion fallback generator:
 * If prefers-reduced-motion is active, disable all spatial offsets and loops.
 */
export const getReducedMotionVariants = (variants: Variants, shouldReduce: boolean): Variants => {
  if (!shouldReduce) return variants;

  const reduced: Variants = {};
  for (const [key, val] of Object.entries(variants)) {
    if (typeof val === 'function') {
      reduced[key] = () => ({
        opacity: 1,
        y: 0,
        x: 0,
        scale: 1,
        transition: { duration: 0 },
      });
    } else if (typeof val === 'object' && val !== null) {
      reduced[key] = {
        opacity: 1,
        y: 0,
        x: 0,
        scale: 1,
        transition: { duration: 0 },
      };
    }
  }
  return reduced;
};
