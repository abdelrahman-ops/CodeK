import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface ScrollToTopMouseProps {
  isRtl?: boolean;
}

export const ScrollToTopMouse: React.FC<ScrollToTopMouseProps> = ({ isRtl = false }) => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 250) {
        setIsVisible(true);
      } else {
        setIsVisible(false);
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    });
  };

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.button
          initial={{ opacity: 0, scale: 0.7, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.7, y: 20 }}
          whileHover={{ scale: 1.12, y: -3 }}
          whileTap={{ scale: 0.92 }}
          onClick={scrollToTop}
          aria-label={isRtl ? 'العودة إلى أعلى الصفحة' : 'Scroll to top of page'}
          title={isRtl ? 'العودة للأعلى' : 'Scroll to top'}
          className="fixed bottom-6 end-6 z-50 flex items-center justify-center w-12 h-12 rounded-full bg-white/95 dark:bg-slate-900/95 text-brand-600 dark:text-brand-400 border border-slate-200/90 dark:border-slate-800 shadow-xl shadow-brand-500/15 backdrop-blur-md hover:bg-brand-50 dark:hover:bg-brand-950/70 hover:border-brand-500/60 hover:shadow-brand-500/25 transition-colors cursor-pointer group"
        >
          {/* Stylized Computer Mouse with Upward Arrow SVG */}
          <svg
            className="w-5 h-5 group-hover:-translate-y-1 transition-transform duration-300"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            {/* Mouse Shell */}
            <rect x="6" y="2" width="12" height="20" rx="6" />
            {/* Upward Arrow / Scroll Indicator */}
            <path d="m9 9 3-3 3 3" />
            <path d="M12 6v7" />
          </svg>
        </motion.button>
      )}
    </AnimatePresence>
  );
};
