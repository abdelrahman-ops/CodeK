import { ContentAuthority, CurriculumType, Difficulty, QuestionType, TaskType } from '@prisma/client';

export interface ParsedConceptCard {
  title: string;
  explanation: string;
  takeaway: string;
  terminology: string[];
}

export interface ParsedVideo {
  code: string; // e.g. "VID-01"
  title: string;
  durationMinutes: number;
  objective: string;
  outline: string;
}

export interface ParsedTask {
  code: string; // e.g. "G11-T1-CH01-L01-TASK"
  title: string;
  scenario: string;
  requirements: string;
  taskType: TaskType;
  difficulty: Difficulty;
  estimatedDurationMinutes: number;
  xpReward: number;
  authority: ContentAuthority;
}

export interface ParsedChallenge {
  code: string; // e.g. "G11-T1-CH01-L01-CHALLENGE"
  title: string;
  requirements: string;
  taskType: TaskType;
  difficulty: Difficulty;
  estimatedDurationMinutes: number;
  xpReward: number;
  authority: ContentAuthority;
}

export interface ParsedQuestion {
  questionText: string;
  questionType: QuestionType;
  options: string[];
  correctAnswer: string;
  explanation: string;
  difficulty: string;
  sourceConcept: string;
  marks: number;
  order: number;
}

export interface ParsedExam {
  code: string; // e.g. "G11-T1-CH01-L01-QUIZ"
  title: string;
  description: string;
  durationMinutes: number;
  totalMarks: number;
  xpReward: number;
  authority: ContentAuthority;
  questions: ParsedQuestion[];
}

export interface ParsedLesson {
  code: string; // e.g. "G11-T1-CH01-L01"
  lessonNumber: string; // "1-1"
  order: number; // 1 - 14
  chapterCode: string; // "G11-T1-CH01"
  chapterTitle: string;
  officialTitle: string;
  pageRange: string; // "ص 4 – 11"
  description: string;
  learningOutcomes: string[];
  coreConcepts: string[];
  content: string; // full markdown explanation
  conceptCards: ParsedConceptCard[];
  video: ParsedVideo;
  task: ParsedTask;
  challenge: ParsedChallenge;
  exam: ParsedExam;
  authority: ContentAuthority;
}

export interface ParsedChapter {
  code: string; // "G11-T1-CH01"
  chapterNumber: number; // 1 - 4
  title: string;
  order: number;
  authority: ContentAuthority;
  lessons: ParsedLesson[];
}

export interface ParsedCourse {
  code: string; // "G11-T1-EB-2026"
  title: string;
  description: string;
  type: CurriculumType;
  track: string;
  academicYear: string;
  term: string;
  authority: ContentAuthority;
  chapters: ParsedChapter[];
}

export interface ParsedCurriculumPackage {
  specHash: string; // SHA-256 of the markdown spec file
  pipelineVersion: string;
  course: ParsedCourse;
  totalChapters: number;
  totalLessons: number;
  totalVideos: number;
  totalTasks: number;
  totalChallenges: number;
  totalExams: number;
  totalQuestions: number;
}

export interface ValidationCountCheck {
  expected: number;
  actual: number;
  status: 'PASS' | 'FAIL';
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  counts: Record<string, ValidationCountCheck>;
}

export interface DiffItem {
  entity: 'Curriculum' | 'Section' | 'Lesson' | 'VideoAsset' | 'Task' | 'Challenge' | 'Exam' | 'Question';
  code: string;
  action: 'CREATE' | 'UPDATE' | 'UNCHANGED' | 'CONFLICT';
  details?: string;
}

export interface PipelineDiff {
  creates: number;
  updates: number;
  unchanged: number;
  conflicts: number;
  items: DiffItem[];
}

export interface LegacySnapshot {
  curriculaCount: number;
  curriculaIds: string[];
  sectionsCount: number;
  lessonsCount: number;
  lessonProgressCount: number;
  tasksCount: number;
  examsCount: number;
  videosCount: number;
  timestamp: string;
}
