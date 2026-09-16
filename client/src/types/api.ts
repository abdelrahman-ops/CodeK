export type Role = 'ADMIN' | 'STUDENT' | 'PARENT';
export type Difficulty = 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED';
export type TaskType = 'DAILY_TASK' | 'CHALLENGE' | 'PROJECT' | 'WEEKLY_CHALLENGE';
export type SubmissionStatus = 'PENDING' | 'REVIEWED' | 'APPROVED' | 'NEEDS_REVISION';
export type SessionStatus = 'SCHEDULED' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
export type AttendanceStatus = 'PRESENT' | 'ABSENT';
export type PaymentStatus = 'PAID' | 'UNPAID';
export type QuestionType = 'MULTIPLE_CHOICE' | 'SHORT_ANSWER';
export type NotificationType =
  | 'INFO'
  | 'LESSON_UNLOCKED'
  | 'TASK_ASSIGNED'
  | 'TASK_REVIEWED'
  | 'ACHIEVEMENT_UNLOCKED'
  | 'EXAM_AVAILABLE'
  | 'EXAM_RESULT'
  | 'LEADERBOARD_FINALIZED'
  | 'PAYMENT_REMINDER';

export interface User {
  id: string;
  loginId: string;
  role: Role;
  firstName: string;
  lastName: string;
  email?: string | null;
  phone?: string | null;
  avatarUrl?: string | null;
  isActive: boolean;
  mustChangePassword: boolean;
  isEmailVerified: boolean;
  createdAt?: string;
  student?: StudentProfile | null;
  parent?: ParentProfile | null;
}

export interface StudentProfile {
  id: string;
  userId: string;
  studentCode: string;
  anonymousLeaderboardCode: string;
  programmingLevel: Difficulty;
  totalXp: number;
  currentStreak: number;
  attendanceRequired?: boolean;
  learningModeSelected?: boolean;
  schoolName?: string | null;
  grade?: string | null;
  dateOfBirth?: string | null;
  enrollments?: GroupEnrollment[];
  achievements?: StudentAchievement[];
  subscriptions?: Array<{
    id: string;
    status: SubscriptionStatus;
    currentPeriodStart: string;
    currentPeriodEnd: string;
    plan?: { id: string; name: string; code: string; price: number };
  }>;
  user?: User;
}

export interface ParentProfile {
  id: string;
  userId: string;
  parentCode: string;
  children?: ParentStudentLink[];
}

export interface ParentStudentLink {
  id: string;
  parentId: string;
  studentId: string;
  relationship: string;
  isPrimary: boolean;
  student: StudentProfile & { user: User };
}

export interface GroupSchedule {
  id?: string;
  groupId?: string;
  dayOfWeek: number; // 0=Sunday, 1=Monday, ..., 6=Saturday
  startTime: string; // "16:00"
  endTime: string;   // "17:30"
  isActive?: boolean;
}

export interface Group {
  id: string;
  name: string;
  description?: string | null;
  scheduleInfo?: string | null;
  schedules?: GroupSchedule[];
  whatsappGroupUrl?: string | null;
  maxCapacity: number;
  isActive: boolean;
  createdAt?: string;
  enrollments?: (GroupEnrollment & { student: StudentProfile & { user: User } })[];
  _count?: {
    enrollments: number;
    sessions: number;
  };
}

export interface GroupEnrollment {
  id: string;
  studentId: string;
  groupId: string;
  startedAt: string;
  endedAt?: string | null;
  isActive: boolean;
  group?: Group;
}

export interface ClassmatePeer {
  studentId: string;
  displayName: string;
  avatarUrl?: string | null;
  achievements: { id: string; name: string; icon: string }[];
}

export interface Session {
  id: string;
  groupId: string;
  group?: Group;
  sessionNumber: number;
  date: string;
  startTime: string;
  endTime: string;
  status: SessionStatus;
  qrToken?: string | null;
  tokenExpiresAt?: string | null;
  sessionLessons?: SessionLesson[];
  attendances?: Attendance[];
  _count?: {
    attendances: number;
  };
}

export interface SessionLesson {
  id: string;
  sessionId: string;
  lessonId: string;
  order: number;
  lesson: Lesson;
}

export interface Attendance {
  id: string;
  sessionId: string;
  studentId: string;
  status: AttendanceStatus;
  isManual: boolean;
  studentConfirmedAt?: string | null;
  adminConfirmedAt?: string | null;
  notes?: string | null;
  student?: StudentProfile & { user: User };
}

export interface AttendanceRosterItem {
  studentId: string;
  studentCode: string;
  firstName: string;
  lastName: string;
  avatarUrl?: string | null;
  status: AttendanceStatus;
  isManual: boolean;
  studentConfirmedAt?: string | null;
  adminConfirmedAt?: string | null;
  notes?: string | null;
}

export type LessonAccessType =
  | 'ATTENDANCE_REQUIRED'
  | 'FREE'
  | 'ENROLLED'
  | 'SUBSCRIPTION_REQUIRED'
  | 'ADMIN_GRANTED';

export type LessonProgressStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED';

export type ContentAuthority = 'OFFICIAL' | 'DERIVED' | 'PROPOSED';

export interface ConceptCard {
  id?: string;
  title: string;
  explanation?: string;
  keyConcept?: string;
  summary?: string;
  takeaway?: string;
  terminology?: string[];
  ministryReference?: string;
  curriculumPage?: number | string;
}

export interface VideoBlueprint {
  id: string;
  code?: string | null;
  provider: string; // 'CLOUDFLARE_STREAM' | 'MOCK' | 'EXTERNAL'
  providerVideoId: string;
  title?: string | null;
  durationSeconds?: number | null;
  thumbnailUrl?: string | null;
  playbackUrl?: string | null;
  authority?: ContentAuthority;
  metadata?: Record<string, any> | null;
}

export interface Section {
  id: string;
  curriculumId: string;
  code?: string | null;
  title: string;
  description?: string | null;
  order: number;
  authority?: ContentAuthority;
  isPublished: boolean;
  createdAt: string;
  updatedAt: string;
  lessons?: Lesson[];
  _count?: {
    lessons: number;
  };
}

export interface StudentLessonProgress {
  id: string;
  studentId: string;
  lessonId: string;
  status: LessonProgressStatus;
  progressPercentage: number;
  lastWatchedPosition: number;
  startedAt?: string | null;
  completedAt?: string | null;
}

export interface CourseProgress {
  curriculumId: string;
  totalLessons: number;
  completedLessons: number;
  percentage: number;
  status: LessonProgressStatus;
}

export type StudentGrade = 'GRADE_1' | 'GRADE_2' | 'GRADE_3';

export interface Curriculum {
  id: string;
  code?: string | null;
  title: string;
  description?: string | null;
  type: 'OFFICIAL_EB' | 'ACADEMY';
  grade?: StudentGrade;
  track?: string | null;
  academicYear?: string | null;
  term?: string | null;
  authority?: ContentAuthority;
  isPublished: boolean;
  sections?: Section[];
  lessons?: Lesson[];
  exams?: Exam[];
  _count?: {
    lessons: number;
    sections?: number;
    exams: number;
  };
}

export interface Lesson {
  id: string;
  curriculumId: string;
  curriculum?: Curriculum;
  sectionId?: string | null;
  section?: Section | null;
  code?: string | null;
  title: string;
  description?: string | null;
  content: string | null;
  conceptCards?: ConceptCard[] | null;
  pageRange?: string | null;
  authority?: ContentAuthority;
  difficulty: Difficulty;
  estimatedDurationMinutes: number;
  order: number;
  isPublished: boolean;
  isFree?: boolean;
  accessType?: LessonAccessType;
  videoUrl?: string | null;
  videoDurationSeconds?: number | null;
  externalResourceUrl?: string | null;
  externalResourceTitle?: string | null;
  isLocked?: boolean;
  lockReason?: string | null;
  lockMessage?: string | null;
  lockMessageAr?: string | null;
  lockMessageEn?: string | null;
  videoId?: string | null;
  video?: VideoAsset | null;
  videoBlueprint?: VideoBlueprint | null;
  tasks?: Task[];
  engineeringTask?: Task | null;
  advancedChallenge?: Task | null;
  taskCount?: number;
  exams?: Exam[];
  quiz?: Exam | null;
  nextSteps?: {
    quiz?: Exam | null;
    exam?: Exam | null;
    task?: Task | null;
    project?: Task | null;
    nextLesson?: { id: string; title: string; order: number } | null;
  } | null;
  progress?: StudentLessonProgress | null;
}

export type VideoAssetStatus = 'PENDING_UPLOAD' | 'PROCESSING' | 'READY' | 'ERROR';

export interface VideoAsset {
  id: string;
  provider: string; // 'MUX' | 'CLOUDFLARE_STREAM' | 'MOCK' | 'EXTERNAL'
  providerVideoId: string;
  uploadId?: string | null;
  playbackId?: string | null;
  title?: string | null;
  durationSeconds?: number | null;
  thumbnailUrl?: string | null;
  playbackUrl?: string | null;
  errorMessage?: string | null;
  isPrivate: boolean;
  status: VideoAssetStatus;
  metadata?: Record<string, any> | null;
  createdAt: string;
  updatedAt: string;
}

export interface PlaybackInfo {
  provider: string;
  providerVideoId: string;
  playbackId?: string;
  token?: string;
  playbackUrl: string | null;
  thumbnailUrl?: string;
  hlsUrl?: string;
  dashUrl?: string;
  durationSeconds?: number;
  isPrivate: boolean;
  expiresAt?: string;
}

export interface Task {
  id: string;
  lessonId?: string | null;
  lesson?: Lesson | null;
  code?: string | null;
  title: string;
  description: string;
  instructions: string;
  taskType: TaskType;
  difficulty: Difficulty;
  estimatedDurationMinutes: number;
  xpReward: number;
  authority?: ContentAuthority;
  isPublished: boolean;
  assignments?: TaskAssignment[];
  assignment?: TaskAssignment | null;
  mySubmission?: Submission | null;
  submissions?: Submission[];
  _count?: {
    submissions: number;
  };
}

export interface TaskAssignment {
  id: string;
  taskId: string;
  groupId: string;
  group?: Group;
  availableAt: string;
  dueDate?: string | null;
}

export interface Submission {
  id: string;
  taskId: string;
  task?: Task;
  studentId: string;
  student?: StudentProfile & { user: User };
  content?: string | null;
  fileUrl?: string | null;
  githubUrl?: string | null;
  status: SubmissionStatus;
  feedback?: string | null;
  submittedAt: string;
  reviewedAt?: string | null;
}

export interface Exam {
  id: string;
  code?: string | null;
  title: string;
  description?: string | null;
  curriculumId?: string | null;
  curriculum?: Curriculum | null;
  groupId?: string | null;
  group?: Group | null;
  lessonId?: string | null;
  lesson?: Lesson | null;
  isQuiz?: boolean;
  authority?: ContentAuthority;
  startsAt: string;
  endsAt: string;
  durationMinutes: number;
  totalMarks: number;
  xpReward: number;
  isPublished: boolean;
  questions?: ExamQuestion[];
  questionCount?: number;
  attempts?: ExamAttempt[];
  myAttempt?: ExamAttempt | null;
  _count?: {
    questions: number;
    attempts: number;
  };
}

export interface ExamQuestion {
  id: string;
  examId: string;
  questionText: string;
  questionType: QuestionType;
  options?: string[] | null;
  correctAnswer?: string | null;
  marks: number;
  order: number;
}

export interface ExamAttempt {
  id: string;
  examId: string;
  exam?: Exam;
  studentId: string;
  answers: string;
  score: number;
  percentage: number;
  xpEarned: number;
  submittedAt: string;
}

export interface XPTransaction {
  id: string;
  studentId: string;
  amount: number;
  reason: string;
  sourceType: string;
  sourceId?: string | null;
  createdAt: string;
}

export interface Achievement {
  id: string;
  code: string;
  name: string;
  description: string;
  icon: string;
  xpReward: number;
  isActive: boolean;
  isUnlocked?: boolean;
  unlockedAt?: string | null;
}

export interface StudentAchievement {
  id: string;
  studentId: string;
  achievementId: string;
  achievement: Achievement;
  unlockedAt: string;
}

export interface LeaderboardEntry {
  rank: number;
  anonymousCode: string;
  monthlyXp: number;
  isCurrentStudent: boolean;
  studentId?: string;
  studentCode?: string;
  studentName?: string;
  avatarUrl?: string | null;
}

export interface MonthlyLeaderboardData {
  year: number;
  month: number;
  period?: 'weekly' | 'monthly' | 'semester';
  status: 'ACTIVE' | 'FINALIZED';
  isFinalized: boolean;
  revealDate?: string | null;
  totalParticipants?: number;
  myRank?: number | null;
  myMonthlyXp?: number;
  entries: LeaderboardEntry[];
}

export interface ExamAttemptItem {
  id: string;
  studentId: string;
  studentCode: string;
  studentName: string;
  avatarUrl?: string | null;
  score: number;
  percentage: number;
  xpEarned: number;
  submittedAt: string;
}

export interface ExamAttemptsData {
  examId: string;
  examTitle: string;
  totalMarks: number;
  attempts: ExamAttemptItem[];
}

export interface Payment {
  id: string;
  studentId: string;
  student?: StudentProfile & { user: User };
  year: number;
  month: number;
  amount: number;
  status: PaymentStatus;
  paidAt?: string | null;
  notes?: string | null;
  createdAt: string;
}

export interface PaymentSummary {
  year: number;
  month: number;
  totalRecords: number;
  paidCount: number;
  unpaidCount: number;
  totalCollectedEgp: number;
  totalExpectedEgp: number;
}

export interface NotificationItem {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: NotificationType;
  readAt?: string | null;
  createdAt: string;
}

export interface AuditLogItem {
  id: string;
  actorUserId?: string | null;
  actor?: {
    id: string;
    loginId: string;
    firstName: string;
    lastName: string;
    role: Role;
  } | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  metadata?: string | null;
  createdAt: string;
}

export interface StudentDashboardData {
  student: {
    id: string;
    studentCode: string;
    anonymousLeaderboardCode: string;
    displayName: string;
    avatarUrl?: string | null;
    programmingLevel: Difficulty;
    totalXp: number;
    currentStreak: number;
    attendanceRequired?: boolean;
    activeGroup: Group | null;
  };
  subscription?: {
    id: string | null;
    status: string;
    currentPeriodStart: string | null;
    currentPeriodEnd: string | null;
    cancelAtPeriodEnd: boolean;
    isActive: boolean;
    plan?: {
      id: string;
      name: string;
      price: number;
      currency: string;
    } | null;
  };
  todaySession: {
    sessionId: string;
    sessionNumber: number;
    date: string;
    startTime: string;
    endTime: string;
    status: SessionStatus;
    attendanceStatus: AttendanceStatus;
    isPresent: boolean;
  } | null;
  todayLessons: {
    id: string;
    title: string;
    description?: string | null;
    difficulty: Difficulty;
    estimatedDurationMinutes: number;
    isLocked: boolean;
    lockReason?: string | null;
    content?: string | null;
    tasks?: Task[];
  }[];
  continueLearning?: {
    courseId: string;
    courseTitle: string;
    lessonId: string;
    lessonTitle: string;
    progressPercentage: number;
    lastWatchedPosition: number;
    status: string;
  } | null;
  upcomingQuizOrExam?: (Exam & { isStarted?: boolean }) | null;
  tasks: {
    id: string;
    title: string;
    taskType: TaskType;
    difficulty: Difficulty;
    xpReward: number;
    mySubmission?: Submission | null;
  }[];
  activeExam: {
    id: string;
    title: string;
    durationMinutes: number;
    totalMarks: number;
    xpReward: number;
    endsAt: string;
    myAttempt?: ExamAttempt | null;
  } | null;
  progress: {
    programming: number;
    problemSolving: number;
    projects: number;
    curriculum: number;
    attendance: number;
  };
  learningAnalytics?: LearningAnalytics;
  rank: {
    rank: number;
    monthlyXp: number;
  } | null;
  leaderboardPreview?: {
    rank: number;
    anonymousCode: string;
    monthlyXp: number;
    isCurrentStudent: boolean;
  }[];
  achievements: {
    id: string;
    name: string;
    icon: string;
    unlockedAt: string;
  }[];
  recentNotifications: NotificationItem[];
}

export interface LearningAnalytics {
  courseProgress: number;
  lessonsCompleted: {
    completed: number;
    total: number;
    percentage: number;
  };
  tasksCompleted: {
    completed: number;
    total: number;
    percentage: number;
  };
  quizPerformance: {
    attempted: number;
    averageScore: number;
  };
  examPerformance: {
    attempted: number;
    averageScore: number;
  };
}

export interface ParentChildSummary {
  studentId: string;
  studentCode: string;
  relationship: string;
  displayName: string;
  avatarUrl?: string | null;
  programmingLevel: Difficulty;
  totalXp: number;
  currentStreak: number;
  activeGroup: Group | null;
  progress: {
    programming: number;
    problemSolving: number;
    projects: number;
    curriculum: number;
    attendance: number;
  };
  learningAnalytics?: LearningAnalytics;
  counts: {
    approvedDailyTasks: number;
    totalDailyTasks: number;
    approvedChallenges: number;
    totalChallenges: number;
    approvedProjects: number;
    totalProjects: number;
    presentSessions: number;
    totalCompletedSessions: number;
  };
  latestExam: {
    examTitle: string;
    score: number;
    totalMarks: number;
    percentage: number;
    submittedAt: string;
  } | null;
  currentMonthPayment: Payment | null;
  achievements: {
    id: string;
    name: string;
    icon: string;
  }[];
}

export interface ParentDashboardData {
  parentCode: string;
  children: ParentChildSummary[];
  recentNotifications: NotificationItem[];
}

export interface TodayScheduleGroup {
  groupId: string;
  groupName: string;
  description?: string | null;
  enrolledStudentsCount: number;
  targetDate: string;
  dayOfWeek: number;
  schedule: {
    id: string;
    startTime: string;
    endTime: string;
  } | null;
  nextSessionNumber: number;
  existingSession: {
    id: string;
    sessionNumber: number;
    startTime: string;
    endTime: string;
    status: SessionStatus;
  } | null;
}

export interface AdminDashboardData {
  overview: {
    totalStudents: number;
    totalParents: number;
    totalGroups: number;
    pendingSubmissionsCount: number;
    activeExamsCount: number;
  };
  financialSummary: PaymentSummary;
  todayScheduledGroups?: TodayScheduleGroup[];
  upcomingOrActiveSessions: {
    id: string;
    sessionNumber: number;
    groupName: string;
    date: string;
    startTime: string;
    endTime: string;
    status: SessionStatus;
    presentAttendanceCount: number;
  }[];
  recentActivity: AuditLogItem[];
}

export interface ApiResponse<T> {
  data: T;
  meta?: {
    total?: number;
    page?: number;
    limit?: number;
    totalPages?: number;
    unreadCount?: number;
    [key: string]: unknown;
  };
}

export interface LoginResponse {
  requires2FA: boolean;
  tempToken?: string;
  emailMasked?: string;
  requiresVerification?: boolean;
  userId?: string;
  devOtp?: string;
  user?: User;
  accessToken?: string;
  refreshToken?: string;
  mustChangePassword?: boolean;
}

export interface RegisterStudentInput {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  phone?: string;
  grade?: string;
  programmingLevel?: Difficulty;
  website?: string;
}

export interface RegisterResponse {
  requiresVerification: boolean;
  userId: string;
  emailMasked: string;
  devOtp?: string;
  user?: User;
  accessToken?: string;
  refreshToken?: string;
  assignedPlan?: {
    id: string;
    code: string;
    name: string;
    price: number;
    currency: string;
    billingInterval: string;
    grade?: string;
  };
}

export interface ResetStudentPasswordResponse {
  studentId: string;
  loginId: string;
  studentName: string;
  phone?: string | null;
  temporaryPassword: string;
  groupName?: string | null;
  groupSchedule?: string | null;
  whatsappGroupUrl?: string | null;
}

export type RegistrationStatus =
  | 'PENDING'
  | 'UNDER_REVIEW'
  | 'APPROVED'
  | 'REJECTED'
  | 'WAITLISTED'
  | 'EXPIRED'
  | 'ARCHIVED';

export type RelationshipType = 'FATHER' | 'MOTHER' | 'GUARDIAN' | 'OTHER';

export interface StudentRegistration {
  id: string;
  registrationCode: string;
  firstName: string;
  lastName: string;
  phone: string;
  whatsappPhone?: string | null;
  email?: string | null;
  dateOfBirth?: string | null;
  schoolName?: string | null;
  grade?: string | null;
  programmingLevel: Difficulty;
  previousExperience?: string | null;
  motivation?: string | null;
  preferredDays?: string | null;
  preferredTimes?: string | null;
  preferredGroupId?: string | null;
  preferredGroup?: { id: string; name: string; scheduleInfo?: string | null } | null;
  parentName?: string | null;
  parentPhone?: string | null;
  parentRelationship?: RelationshipType | null;
  status: RegistrationStatus;
  adminNotes?: string | null;
  rejectionReason?: string | null;
  reviewedAt?: string | null;
  reviewedByUserId?: string | null;
  reviewedByUser?: { id: string; firstName: string; lastName: string; email?: string } | null;
  createdStudentId?: string | null;
  createdStudent?: { id: string; studentCode: string; user: { loginId: string } } | null;
  clientIp?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PublicGroupOption {
  id: string;
  name: string;
  description?: string | null;
  scheduleInfo?: string | null;
  scheduleSummaryAr: string;
  scheduleSummaryEn: string;
  schedules: {
    dayOfWeek: number;
    startTime: string;
    endTime: string;
  }[];
  maxCapacity: number;
  enrolledCount: number;
  isFull: boolean;
}

export interface PublicRegistrationStatus {
  isOpen: boolean;
  closedReason?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  maxRegistrations?: number | null;
  currentRegistrationsCount: number;
  remainingCapacity?: number | null;
  groups?: PublicGroupOption[];
}

export interface RegistrationSetting {
  id: string;
  isOpen: boolean;
  startDate?: string | null;
  endDate?: string | null;
  maxRegistrations?: number | null;
  updatedAt?: string;
}

export interface ListAdminRegistrationsResponse {
  data: StudentRegistration[];
  counts: {
    ALL: number;
    PENDING: number;
    UNDER_REVIEW: number;
    APPROVED: number;
    REJECTED: number;
    WAITLISTED: number;
    EXPIRED: number;
    ARCHIVED: number;
  };
  settings?: RegistrationSetting | null;
  meta?: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface ApproveRegistrationResponse {
  registration: StudentRegistration;
  user: {
    id: string;
    loginId: string;
    firstName: string;
    lastName: string;
    phone?: string | null;
  };
  student: {
    id: string;
    studentCode: string;
  };
  credentials: {
    loginId: string;
    temporaryPassword: string;
    studentCode: string;
  };
  whatsappOnboarding: {
    messageText: string;
    whatsappUrl: string;
    normalizedPhone: string;
  };
}

export type AccessGrantScope = 'ALL_ACCESS' | 'COURSE' | 'LESSON';

export type LessonAccessReason =
  | 'FREE_PREVIEW'
  | 'ENROLLED'
  | 'SUBSCRIPTION_REQUIRED'
  | 'ADMIN_GRANTED'
  | 'ATTENDANCE_REQUIRED'
  | 'NOT_ENROLLED';

export interface LessonAccessDecision {
  allowed: boolean;
  reason: LessonAccessReason;
  isFreePreview: boolean;
  lesson?: {
    id: string;
    title?: string;
    curriculumId?: string;
    isFree: boolean;
    accessType: LessonAccessType;
  };
  grant?: {
    id: string;
    scope: AccessGrantScope;
    reason: string;
    validUntil: string | null;
  } | null;
  lockMessageAr?: string | null;
  lockMessageEn?: string | null;
}

export interface EducationalAccessGrant {
  id: string;
  studentId: string;
  scope: AccessGrantScope;
  curriculumId?: string | null;
  lessonId?: string | null;
  grantedByUserId?: string | null;
  reason: string;
  validFrom: string;
  validUntil?: string | null;
  isActive: boolean;
  revokedAt?: string | null;
  revokedReason?: string | null;
  createdAt: string;
  updatedAt: string;
  student?: {
    studentCode: string;
    user: {
      firstName: string;
      lastName: string;
      email?: string | null;
      loginId: string;
    };
  };
  curriculum?: { id: string; title: string };
  lesson?: { id: string; title: string };
  grantedByUser?: { id: string; firstName: string; lastName: string };
}

export interface PlanBenefit {
  id: string;
  textAr: string;
  textEn?: string;
  icon?: string;
  sortOrder: number;
}

export interface SubscriptionPlan {
  id: string;
  name: string;
  code: string;
  description?: string | null;
  price: number;
  currency: string;
  billingInterval: string;
  isActive: boolean;
  features?: (string | PlanBenefit)[] | null;
  createdAt?: string;
  updatedAt?: string;
}

export type SubscriptionStatus = 'ACTIVE' | 'PAST_DUE' | 'CANCELED' | 'EXPIRED' | 'TRIALING';

export interface Subscription {
  id: string;
  studentId: string;
  planId: string;
  plan?: SubscriptionPlan;
  status: SubscriptionStatus;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
  canceledAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

// ─── Phase 6 & 8: Billing & Payment Types ─────────────────

export type PaymentTransactionStatus = 'PENDING' | 'PAID' | 'FAILED' | 'REFUNDED' | 'CANCELLED' | 'EXPIRED' | 'REJECTED';

export interface PaymentTransaction {
  id: string;
  subscriptionId?: string | null;
  subscription?: {
    id: string;
    status: SubscriptionStatus;
    currentPeriodStart: string;
    currentPeriodEnd: string;
  } | null;
  studentId: string;
  planId?: string | null;
  plan?: { id: string; name: string; code: string; price?: number } | null;
  provider?: string | null;
  providerTransactionId?: string | null;
  amount: number;
  currency: string;
  status: PaymentTransactionStatus;
  description?: string | null;
  paidAt?: string | null;
  refundedAt?: string | null;
  expiresAt?: string | null;
  metadata?: any;
  createdAt: string;
  updatedAt: string;
  student?: {
    id: string;
    studentCode?: string;
    attendanceRequired?: boolean;
    learningModeSelected?: boolean;
    user: { firstName: string; lastName: string; email?: string | null; phone?: string | null; loginId: string };
  };
}

export interface PaginationMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface CheckoutResponse {
  transactionId: string;
  clientSecret: string;
  publicKey: string;
  redirectUrl?: string;
}

export interface StudentSubscriptionResponse {
  subscription: Subscription | null;
  plan: SubscriptionPlan | null;
  isActive: boolean;
}

export interface AdminSubscriptionItem extends Subscription {
  student?: {
    id: string;
    studentCode?: string;
    attendanceRequired?: boolean;
    learningModeSelected?: boolean;
    user: { firstName: string; lastName: string; email?: string | null; phone?: string | null; loginId: string };
  };
}
