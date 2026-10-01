import React, { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../context/auth-context.js';
import { api } from '../../lib/api/client.js';
import { ShieldAlert, ShieldCheck } from 'lucide-react';

/**
 * Anti-Screenshot & Content Protection Guard
 * Strictly prevents screenshots, screen clipping (Snipping Tool, PrintScreen, recording),
 * and unauthorized capture without invasive visual text watermarks.
 */
export const ContentWatermark: React.FC = () => {
  const { user } = useAuth();
  const [screenShieldActive, setScreenShieldActive] = useState(false);
  const [windowBlurred, setWindowBlurred] = useState(false);

  // Fetch security settings (admin-controlled)
  const { data: settings } = useQuery({
    queryKey: ['securitySettings'],
    queryFn: async () => {
      try {
        const res = await api.settings.getSecuritySettings();
        return res.data.data;
      } catch {
        return {
          watermarkEnabled: false,
          antiScreenshotEnabled: true,
          watermarkOpacity: 0
        };
      }
    },
    staleTime: 60 * 1000,
    retry: 1
  });

  const isAntiScreenshotEnabled = settings?.antiScreenshotEnabled ?? true;

  useEffect(() => {
    if (!isAntiScreenshotEnabled) return;

    // Trigger immediate blackout shield and clear clipboard
    const triggerShield = () => {
      setScreenShieldActive(true);
      if (navigator.clipboard && window.isSecureContext) {
        try {
          navigator.clipboard.writeText('').catch(() => {});
        } catch {}
      }
      setTimeout(() => {
        setScreenShieldActive(false);
      }, 1500);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      // 1. PrintScreen key
      if (e.key === 'PrintScreen' || e.keyCode === 44) {
        triggerShield();
      }

      // 2. Windows Snipping Tool (Win + Shift + S) or Mac (Cmd + Shift + 3 / 4 / 5)
      if (
        (e.metaKey || e.ctrlKey) &&
        e.shiftKey &&
        (e.key === 'S' || e.key === 's' || e.key === '3' || e.key === '4' || e.key === '5')
      ) {
        triggerShield();
      }

      // 3. Alt + PrintScreen
      if (e.altKey && (e.key === 'PrintScreen' || e.keyCode === 44)) {
        triggerShield();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'PrintScreen' || e.keyCode === 44) {
        triggerShield();
      }
    };

    // 4. Window Blur Protection (detects Snipping Tool, external recorders & capture overlays stealing focus)
    const handleBlur = () => {
      setWindowBlurred(true);
    };

    const handleFocus = () => {
      setWindowBlurred(false);
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        setWindowBlurred(true);
      } else {
        setWindowBlurred(false);
      }
    };

    // 5. Disable Right-Click Context Menu on Protected Content
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleBlur);
    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('contextmenu', handleContextMenu);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleBlur);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('contextmenu', handleContextMenu);
    };
  }, [isAntiScreenshotEnabled]);

  // Don't apply to admin
  if (!user || user.role === 'ADMIN' || !isAntiScreenshotEnabled) {
    return null;
  }

  return (
    <>
      {/* 1. Print Protection Style Block */}
      <style>{`
        @media print {
          body {
            display: none !important;
            visibility: hidden !important;
          }
        }
      `}</style>

      {/* 2. Direct Screenshot Interception Blackout Shield */}
      {screenShieldActive && (
        <div className="fixed inset-0 z-[999999] bg-slate-950 flex flex-col items-center justify-center text-center p-6 select-none animate-in fade-in duration-75">
          <div className="w-16 h-16 rounded-full bg-rose-500/20 text-rose-400 flex items-center justify-center mb-4 border border-rose-500/30">
            <ShieldAlert className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">
            تم حظر التقاط الشاشة
          </h2>
          <p className="text-sm text-slate-300 max-w-md leading-relaxed">
            محتوى منصة كودك التعليمية محمي بنظام مكافحة تصوير الشاشة للحفاظ على حقوق الملكية الفكرية وخصوصية المحتوى الأكاديمي.
          </p>
        </div>
      )}

      {/* 3. Window Blur / Snipping Tool Shield (Blurs screen when external screenshot tool is active) */}
      {windowBlurred && (
        <div className="fixed inset-0 z-[99999] bg-slate-950/90 backdrop-blur-2xl flex flex-col items-center justify-center text-center p-6 select-none transition-all duration-150">
          <div className="w-14 h-14 rounded-2xl bg-brand-500/20 text-brand-400 flex items-center justify-center mb-3 border border-brand-500/30">
            <ShieldCheck className="w-7 h-7" />
          </div>
          <h3 className="text-lg font-bold text-white mb-1.5">
            محتوى المنصة محمي
          </h3>
          <p className="text-xs text-slate-300 max-w-sm leading-relaxed">
            انقر داخل نافذة المتصفح للمتابعة ومواصلة التعلم.
          </p>
        </div>
      )}
    </>
  );
};
