import React from 'react';
import { useTranslation } from 'react-i18next';
import { setAppLanguage } from '../../i18n/index.js';
import { useUiStore } from '../../store/ui-store.js';
import { useAuth } from '../../context/auth-context.js';
import {
  NavbarSection,
  HeroSection,
  PracticeVsWatchingSection,
  OfferSection,
  HowItWorksSection,
  StudentStorySection,
  DeliverablesSection,
  CurriculumTracksSection,
  FounderSection,
  UnifiedAudienceSection,
  FaqSection,
  CtaSection,
  FooterSection,
} from '@/components/landing';
import { ScrollToTopMouse } from '@/components/shared/ScrollToTopMouse';

export function LandingPage() {
  const { i18n } = useTranslation();
  const { theme, setTheme } = useUiStore();
  const { user, isAuthenticated } = useAuth();

  const isRtl = i18n.language === 'ar';

  const toggleLanguage = () => {
    const nextLang = i18n.language === 'ar' ? 'en' : 'ar';
    setAppLanguage(nextLang);
  };

  const getDashboardPath = () => {
    if (!user) return '/login';
    if (user.role === 'ADMIN') return '/admin';
    if (user.role === 'PARENT') return '/parent';
    return '/student';
  };

  return (
    <div
      dir={isRtl ? 'rtl' : 'ltr'}
      className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans selection:bg-brand-500 selection:text-white transition-colors"
    >
      {/* 1. STICKY TOPBAR / NAVIGATION */}
      <NavbarSection
        isRtl={isRtl}
        theme={theme}
        setTheme={setTheme}
        toggleLanguage={toggleLanguage}
        isAuthenticated={isAuthenticated}
        getDashboardPath={getDashboardPath}
      />

      <main>
        {/* 2. HERO SECTION WITH TYPEWRITER TERMINAL */}
        <HeroSection
          isRtl={isRtl}
          isAuthenticated={isAuthenticated}
          getDashboardPath={getDashboardPath}
        />

        {/* 2.5 ACTIVE CONSTRUCTION VS PASSIVE WATCHING */}
        {/* <PracticeVsWatchingSection isRtl={isRtl} /> */}

        {/* 3. WHAT WE OFFER */}
        <OfferSection isRtl={isRtl} />

        {/* 4. HOW LEARNING WORKS (01 to 06 JOURNEY + DEBUGGING LAB) */}
        <HowItWorksSection isRtl={isRtl} />

        {/* 5. THE STUDENT STORY SECTION */}
        {/* <StudentStorySection isRtl={isRtl} /> */}

        {/* 6. WHAT STUDENTS ACTUALLY GET */}
        <DeliverablesSection isRtl={isRtl} />

        {/* 7. CURRICULUM TRACKS */}
        <CurriculumTracksSection isRtl={isRtl} />

        {/* 8. FOUNDER / ABOUT SECTION */}
        <FounderSection isRtl={isRtl} />

        {/* 9. UNIFIED STUDENTS & PARENTS CARD WITH SLASH DIVIDER */}
        <UnifiedAudienceSection isRtl={isRtl} />

        {/* 10. FAQ SECTION */}
        <FaqSection isRtl={isRtl} />

        {/* 11. FINAL CALL TO ACTION */}
        <CtaSection
          isRtl={isRtl}
          isAuthenticated={isAuthenticated}
          getDashboardPath={getDashboardPath}
        />
      </main>

      {/* 12. FOOTER */}
      <FooterSection isRtl={isRtl} />

      {/* Floating Scroll to Top Mouse */}
      <ScrollToTopMouse isRtl={isRtl} />
    </div>
  );
}

export default LandingPage;
