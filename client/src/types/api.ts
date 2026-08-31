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
  schoolName?: string | null;
  dateOfBirth?: string | null;
  enrollments?: GroupEnrollment[];
  achievements?: StudentAchievement[];
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

export interface Curriculum {
  id: string;
  title: string;
  description?: string | null;
  type: 'OFFICIAL_EB' | 'ACADEMY';
  track?: string | null;
  isPublished: boolean;
  lessons?: Lesson[];
  exams?: Exam[];
  _count?: {
    lessons: number;
    exams: number;
  };
}

export interface Lesson {
  id: string;
  curriculumId: string;
  curriculum?: Curriculum;
  title: string;
  description?: string | null;
  content: string | null;
  difficulty: Difficulty;
  estimatedDurationMinutes: number;
  order: number;
  isPublished: boolean;
  externalResourceUrl?: string | null;
  externalResourceTitle?: string | null;
  isLocked?: boolean;
  lockReason?: string | null;
  tasks?: Task[];
  taskCount?: number;
}

export interface Task {
  id: string;
  lessonId?: string | null;
  lesson?: Lesson | null;
  title: string;
  description: string;
  instructions: string;
  taskType: TaskType;
  difficulty: Difficulty;
  estimatedDurationMinutes: number;
  xpReward: number;
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
  title: string;
  description?: string | null;
  curriculumId?: string | null;
  curriculum?: Curriculum | null;
  groupId?: string | null;
  group?: Group | null;
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
    activeGroup: Group | null;
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
  rank: {
    rank: number;
    monthlyXp: number;
  } | null;
  achievements: {
    id: string;
    name: string;
    icon: string;
    unlockedAt: string;
  }[];
  recentNotifications: NotificationItem[];
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
  user?: User;
  accessToken?: string;
  refreshToken?: string;
  mustChangePassword?: boolean;
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


