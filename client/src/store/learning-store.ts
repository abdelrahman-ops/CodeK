import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface ActiveLessonState {
  courseId: string;
  lessonId: string;
  lessonTitle?: string;
  courseTitle?: string;
  lastWatchedPosition?: number;
  progressPercentage?: number;
  updatedAt: string;
}

interface LearningStoreState {
  lastActiveLesson: ActiveLessonState | null;
  isMobileSyllabusOpen: boolean;
  setLastActiveLesson: (data: Omit<ActiveLessonState, 'updatedAt'>) => void;
  clearLastActiveLesson: () => void;
  toggleMobileSyllabus: (open?: boolean) => void;
}

export const useLearningStore = create<LearningStoreState>()(
  persist(
    (set) => ({
      lastActiveLesson: null,
      isMobileSyllabusOpen: false,

      setLastActiveLesson: (data) =>
        set({
          lastActiveLesson: {
            ...data,
            updatedAt: new Date().toISOString()
          }
        }),

      clearLastActiveLesson: () => set({ lastActiveLesson: null }),

      toggleMobileSyllabus: (open) =>
        set((state) => ({
          isMobileSyllabusOpen: open !== undefined ? open : !state.isMobileSyllabusOpen
        }))
    }),
    {
      name: 'codek_learning_state'
    }
  )
);
