import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type ThemeMode = 'light' | 'dark' | 'system';
export type AccentColor = 'default' | 'ocean' | 'purple' | 'rose' | 'emerald' | 'amber' | 'monochrome';

export interface AccentOption {
  id: AccentColor;
  name: string;
  nameAr: string;
  previewColor: string;
}

export const ACCENT_PALETTES: AccentOption[] = [
  { id: 'default', name: 'Default', nameAr: 'الافتراضي', previewColor: '#6366f1' },
  { id: 'ocean', name: 'Ocean', nameAr: 'محيطي', previewColor: '#0ea5e9' },
  { id: 'purple', name: 'Purple', nameAr: 'بنفسجي', previewColor: '#a855f7' },
  { id: 'rose', name: 'Rose', nameAr: 'وردي', previewColor: '#f43f5e' },
  { id: 'emerald', name: 'Emerald', nameAr: 'زمردي', previewColor: '#10b981' },
  { id: 'amber', name: 'Amber', nameAr: 'كهرماني', previewColor: '#f59e0b' },
  { id: 'monochrome', name: 'Monochrome', nameAr: 'أحادي', previewColor: '#64748b' }
];

interface UiState {
  theme: ThemeMode;
  accent: AccentColor;
  setTheme: (theme: ThemeMode) => void;
  setAccent: (accent: AccentColor) => void;
}

function applyThemeToDom(theme: ThemeMode) {
  if (typeof window === 'undefined') return;
  const isDark =
    theme === 'dark' ||
    (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);

  if (isDark) {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }
}

function applyAccentToDom(accent: AccentColor) {
  if (typeof window === 'undefined') return;
  document.documentElement.dataset.accent = accent;
  document.documentElement.setAttribute('data-accent', accent);
}

// Attach system theme listener once
if (typeof window !== 'undefined') {
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
    const currentTheme = useUiStore.getState().theme;
    if (currentTheme === 'system') {
      if (e.matches) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    }
  });
}

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      theme: 'system',
      accent: 'default',
      setTheme: (theme) => {
        applyThemeToDom(theme);
        set({ theme });
      },
      setAccent: (accent) => {
        applyAccentToDom(accent);
        set({ accent });
      }
    }),
    {
      name: 'academy_ui_preferences',
      onRehydrateStorage: () => (state) => {
        if (state) {
          applyThemeToDom(state.theme);
          applyAccentToDom(state.accent);
        }
      }
    }
  )
);

// Immediately apply initial values on script load
if (typeof window !== 'undefined') {
  try {
    const raw = localStorage.getItem('academy_ui_preferences');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed?.state?.theme) applyThemeToDom(parsed.state.theme);
      if (parsed?.state?.accent) applyAccentToDom(parsed.state.accent);
    } else {
      applyThemeToDom('system');
      applyAccentToDom('default');
    }
  } catch {}
}
