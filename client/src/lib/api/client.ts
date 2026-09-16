import axios, { AxiosError, AxiosRequestConfig } from 'axios';
import {
  ApiResponse,
  User,
  StudentDashboardData,
  ParentDashboardData,
  AdminDashboardData,
  Curriculum,
  Section,
  Lesson,
  VideoAsset,
  PlaybackInfo,
  StudentLessonProgress,
  LessonProgressStatus,
  CourseProgress,
  Task,
  Submission,
  Exam,
  MonthlyLeaderboardData,
  Payment,
  PaymentSummary,
  NotificationItem,
  AuditLogItem,
  Group,
  Session,
  AttendanceRosterItem,
  ClassmatePeer,
  LoginResponse,
  ResetStudentPasswordResponse,
  StudentRegistration,
  PublicRegistrationStatus,
  RegistrationSetting,
  ListAdminRegistrationsResponse,
  ApproveRegistrationResponse,
  LessonAccessDecision,
  EducationalAccessGrant,
  SubscriptionPlan,
  Subscription,
  PaymentTransaction,
  CheckoutResponse,
  StudentSubscriptionResponse,
  AdminSubscriptionItem,
  RegisterStudentInput,
  RegisterResponse,
  StudentProfile,
  PaginationMeta
} from '../../types/api.js';
import { saveTokens, getDevRefreshToken, clearAuthStorage } from '../auth-storage.js';

const baseURL = (import.meta as any).env?.VITE_API_URL || '/api/v1';

export const apiClient = axios.create({
  baseURL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Attach access token
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('academy_access_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Helper to safely set headers on Axios config (supporting both AxiosHeaders class and plain objects)
function setAuthorizationHeader(config: AxiosRequestConfig, token: string) {
  if (!config.headers) {
    config.headers = {};
  }
  if (typeof (config.headers as any).set === 'function') {
    (config.headers as any).set('Authorization', `Bearer ${token}`);
  } else {
    config.headers['Authorization'] = `Bearer ${token}`;
    config.headers['authorization'] = `Bearer ${token}`;
  }
}

// Single-flight refresh promise state
let activeRefreshPromise: Promise<string> | null = null;

async function requestTokenRefresh(): Promise<string> {
  if (activeRefreshPromise) {
    return activeRefreshPromise;
  }

  activeRefreshPromise = (async () => {
    try {
      const refreshUrl = baseURL.endsWith('/') ? `${baseURL}auth/refresh` : `${baseURL}/auth/refresh`;
      const devRefreshToken = getDevRefreshToken();
      const payload = devRefreshToken ? { refreshToken: devRefreshToken } : {};
      const res = await axios.post(refreshUrl, payload, { withCredentials: true });
      const newAccessToken = res.data?.data?.accessToken;
      const newRefreshToken = res.data?.data?.refreshToken;

      if (!newAccessToken) {
        throw new Error('No access token returned from refresh endpoint');
      }

      saveTokens(newAccessToken, newRefreshToken);
      return newAccessToken;
    } catch (err) {
      clearAuthStorage();
      throw err;
    } finally {
      activeRefreshPromise = null;
    }
  })();

  return activeRefreshPromise;
}

// Response interceptor with single-flight mutex-protected token refresh
apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as (AxiosRequestConfig & { _retry?: boolean }) | undefined;

    // Do NOT intercept auth endpoints or already-retried requests
    const isAuthEndpoint =
      !originalRequest ||
      !originalRequest.url ||
      originalRequest.url.includes('/auth/login') ||
      originalRequest.url.includes('/auth/verify-2fa') ||
      originalRequest.url.includes('/auth/resend-2fa') ||
      originalRequest.url.includes('/auth/refresh') ||
      originalRequest.url.includes('/auth/logout');

    if (originalRequest && error.response?.status === 401 && !originalRequest._retry && !isAuthEndpoint) {
      originalRequest._retry = true;

      try {
        const newAccessToken = await requestTokenRefresh();
        setAuthorizationHeader(originalRequest, newAccessToken);
        return apiClient(originalRequest);
      } catch (refreshErr) {
        return Promise.reject(refreshErr);
      }
    }

    return Promise.reject(error);
  }
);

// API Functions Map
export const api = {
  auth: {
    register: (data: RegisterStudentInput) =>
      apiClient.post<ApiResponse<RegisterResponse>>('/auth/register', data),
    login: (data: { loginId: string; password: string }) =>
      apiClient.post<ApiResponse<LoginResponse>>('/auth/login', data),
    verify2FA: (data: { tempToken: string; otpCode: string }) =>
      apiClient.post<ApiResponse<{ user: User; accessToken: string; refreshToken: string; mustChangePassword: boolean }>>('/auth/verify-2fa', data),
    resend2FA: (data: { tempToken: string }) =>
      apiClient.post<ApiResponse<{ success: boolean; tempToken: string; emailMasked: string }>>('/auth/resend-2fa', data),
    refresh: (tokenOverride?: string) => {
      const devToken = tokenOverride || getDevRefreshToken();
      const payload = devToken ? { refreshToken: devToken } : {};
      return apiClient.post<ApiResponse<{ user: User; accessToken: string; refreshToken?: string }>>(
        '/auth/refresh',
        payload
      );
    },
    getMe: () => apiClient.get<ApiResponse<User>>('/auth/me'),
    changePassword: (data: { currentPassword: string; newPassword: string }) =>
      apiClient.post<ApiResponse<{ success: boolean }>>('/auth/change-password', data),
    setupPassword: (data: { token: string; newPassword: string }) =>
      apiClient.post<ApiResponse<{ user: User; accessToken: string; refreshToken: string }>>('/auth/setup-password', data),
    resetPassword: (data: { token: string; newPassword: string }) =>
      apiClient.post<ApiResponse<{ success: boolean }>>('/auth/reset-password', data),
    verifyEmail: (data: { userId: string; otpCode: string }) =>
      apiClient.post<ApiResponse<{ user: User; accessToken: string; refreshToken: string; mustChangePassword: boolean; learningModeSelected: boolean }>>('/auth/verify-email', data),
    resendVerification: (data: { userId: string }) =>
      apiClient.post<ApiResponse<{ success: boolean; resendCooldownSeconds: number; emailMasked: string; devOtp?: string }>>('/auth/resend-verification', data),
    selectLearningMode: (data: { mode: 'ONLINE' | 'HYBRID' }) =>
      apiClient.post<ApiResponse<{ success: boolean; mode: string; learningModeSelected: boolean; student: StudentProfile }>>('/auth/select-learning-mode', data),
    logout: () => apiClient.post('/auth/logout')
  },
  dashboard: {
    getStudentDashboard: () => apiClient.get<ApiResponse<StudentDashboardData>>('/dashboard/student'),
    getParentDashboard: () => apiClient.get<ApiResponse<ParentDashboardData>>('/dashboard/parent'),
    getAdminDashboard: () => apiClient.get<ApiResponse<AdminDashboardData>>('/dashboard/admin')
  },
  groups: {
    list: (activeOnly?: boolean) => apiClient.get<ApiResponse<Group[]>>('/groups', { params: { activeOnly } }),
    getById: (id: string) => apiClient.get<ApiResponse<Group & { members?: ClassmatePeer[] }>>(`/groups/${id}`),
    create: (data: any) => apiClient.post<ApiResponse<Group>>('/groups', data),
    update: (id: string, data: any) => apiClient.patch<ApiResponse<Group>>(`/groups/${id}`, data),
    delete: (id: string) => apiClient.delete<ApiResponse<{ success: boolean }>>(`/groups/${id}`),
    bulkDelete: (ids: string[]) =>
      apiClient.delete<ApiResponse<{ success: boolean; count: number; ids: string[]; failed?: { id: string; name: string; reason: string }[] }>>('/groups/bulk', { data: { ids } }),
    enrollStudent: (groupId: string, studentId: string) => apiClient.post<ApiResponse<any>>(`/groups/${groupId}/enroll`, { studentId }),
    enroll: (groupId: string, studentId: string) => apiClient.post<ApiResponse<any>>(`/groups/${groupId}/enroll`, { studentId }),
    removeStudent: (groupId: string, studentId: string) => apiClient.delete<ApiResponse<any>>(`/groups/${groupId}/enrollments/${studentId}`)
  },
  sessions: {
    list: (params?: { groupId?: string; status?: string }) => apiClient.get<ApiResponse<Session[]>>('/sessions', { params }),
    getTodaySchedule: (date?: string) => apiClient.get<ApiResponse<any[]>>('/sessions/today-schedule', { params: { date } }),
    getNextNumber: (groupId: string) => apiClient.get<ApiResponse<{ groupId: string; nextSessionNumber: number }>>(`/sessions/next-number/${groupId}`),
    getById: (id: string) => apiClient.get<ApiResponse<Session & { hasActiveToken?: boolean }>>(`/sessions/${id}`),
    create: (data: any) => apiClient.post<ApiResponse<Session>>('/sessions', data),
    update: (id: string, data: any) => apiClient.patch<ApiResponse<Session>>(`/sessions/${id}`, data),
    delete: (id: string) => apiClient.delete<ApiResponse<{ success: boolean }>>(`/sessions/${id}`),
    bulkDelete: (ids: string[]) =>
      apiClient.delete<ApiResponse<{ success: boolean; count: number; ids: string[] }>>('/sessions/bulk', { data: { ids } }),
    start: (id: string) => apiClient.post<ApiResponse<{ sessionId: string; status: string; qrToken: string; expiresAt: string }>>(`/sessions/${id}/start`),
    getQrToken: (id: string) => apiClient.get<ApiResponse<{ sessionId: string; expiresAt: string }>>(`/sessions/${id}/qr-token`)
  },
  attendance: {
    confirmStudent: (data: { sessionId: string; token?: string; qrToken?: string }) =>
      apiClient.post<ApiResponse<{ attendance: any; xpAwarded: number; unlockedLessons: Lesson[] }>>('/attendance/confirm-student', data),
    studentScan: (data: { sessionId: string; token?: string; qrToken?: string }) =>
      apiClient.post<ApiResponse<{ attendance: any; xpAwarded: number; unlockedLessons: Lesson[] }>>('/attendance/confirm-student', data),
    adminMark: (data: { sessionId: string; studentId: string; status: string; notes?: string }) =>
      apiClient.post<ApiResponse<any>>('/attendance/admin-mark', data),
    getSessionRoster: (sessionId: string) =>
      apiClient.get<ApiResponse<{ sessionId: string; sessionNumber: number; groupName: string; totalEnrolled: number; presentCount: number; absentCount: number; roster: AttendanceRosterItem[] }>>(`/attendance/session/${sessionId}`),
    adminBulkMark: (data: { sessionId: string; studentIds: string[]; status: string; notes?: string }) =>
      apiClient.post<ApiResponse<{ success: boolean; successful: string[]; failed: { id: string; reason: string }[] }>>('/attendance/admin-bulk-mark', data)
  },
  curriculum: {
    list: () => apiClient.get<ApiResponse<Curriculum[]>>('/curriculum'),
    getById: (id: string) => apiClient.get<ApiResponse<Curriculum>>(`/curriculum/${id}`),
    create: (data: any) => apiClient.post<ApiResponse<Curriculum>>('/curriculum', data),
    update: (id: string, data: any) => apiClient.patch<ApiResponse<Curriculum>>(`/curriculum/${id}`, data),
    delete: (id: string) => apiClient.delete<ApiResponse<{ success: boolean }>>(`/curriculum/${id}`),
    bulkDelete: (ids: string[]) =>
      apiClient.delete<ApiResponse<{ success: boolean; count: number; ids: string[] }>>('/curriculum/bulk', { data: { ids } }),
    listSections: (curriculumId: string) => apiClient.get<ApiResponse<Section[]>>(`/curriculum/${curriculumId}/sections`),
    createSection: (curriculumId: string, data: any) => apiClient.post<ApiResponse<Section>>(`/curriculum/${curriculumId}/sections`, data),
    updateSection: (sectionId: string, data: any) => apiClient.patch<ApiResponse<Section>>(`/curriculum/sections/${sectionId}`, data),
    deleteSection: (sectionId: string) => apiClient.delete<ApiResponse<{ success: boolean }>>(`/curriculum/sections/${sectionId}`),
    bulkPublishSections: (ids: string[], isPublished: boolean) =>
      apiClient.patch<ApiResponse<{ success: boolean; count: number; ids: string[] }>>('/curriculum/sections/bulk-publish', { ids, isPublished }),
    bulkDeleteSections: (ids: string[]) =>
      apiClient.delete<ApiResponse<{ success: boolean; successful: string[]; failed: { id: string; reason: string }[] }>>('/curriculum/sections/bulk', { data: { ids } }),
    reorderSections: (curriculumId: string, data: { items: { id: string; order: number }[] }) =>
      apiClient.post<ApiResponse<Section[]>>(`/curriculum/${curriculumId}/sections/reorder`, data),
    getProgress: (curriculumId: string, params?: { studentId?: string }) =>
      apiClient.get<ApiResponse<CourseProgress>>(`/curriculum/${curriculumId}/progress`, { params }),
    getStudentSummary: () => apiClient.get<ApiResponse<any[]>>('/curriculum/student/summary')
  },
  courses: {
    list: () => apiClient.get<ApiResponse<Curriculum[]>>('/courses'),
    getById: (id: string) => apiClient.get<ApiResponse<Curriculum>>(`/courses/${id}`),
    create: (data: any) => apiClient.post<ApiResponse<Curriculum>>('/courses', data),
    update: (id: string, data: any) => apiClient.patch<ApiResponse<Curriculum>>(`/courses/${id}`, data),
    delete: (id: string) => apiClient.delete<ApiResponse<{ success: boolean }>>(`/courses/${id}`),
    bulkDelete: (ids: string[]) =>
      apiClient.delete<ApiResponse<{ success: boolean; count: number; ids: string[] }>>('/courses/bulk', { data: { ids } }),
    getStudentSummary: () => apiClient.get<ApiResponse<any[]>>('/courses/student/summary')
  },
  lessons: {
    list: (params?: { curriculumId?: string; sectionId?: string }) => apiClient.get<ApiResponse<Lesson[]>>('/lessons', { params }),
    getById: (id: string) => apiClient.get<ApiResponse<Lesson>>(`/lessons/${id}`),
    create: (data: any) => apiClient.post<ApiResponse<Lesson>>('/lessons', data),
    update: (id: string, data: any) => apiClient.patch<ApiResponse<Lesson>>(`/lessons/${id}`, data),
    delete: (id: string) => apiClient.delete<ApiResponse<{ success: boolean }>>(`/lessons/${id}`),
    bulkPublish: (ids: string[], isPublished: boolean) =>
      apiClient.patch<ApiResponse<{ success: boolean; count: number; ids: string[] }>>('/lessons/bulk-publish', { ids, isPublished }),
    bulkDelete: (ids: string[]) =>
      apiClient.delete<ApiResponse<{ success: boolean; successful: string[]; failed: { id: string; reason: string }[] }>>('/lessons/bulk', { data: { ids } }),
    reorder: (data: { items: { id: string; order: number; sectionId?: string | null }[] }) =>
      apiClient.post<ApiResponse<{ success: boolean }>>('/lessons/reorder', data),
    getProgress: (lessonId: string) => apiClient.get<ApiResponse<StudentLessonProgress>>(`/lessons/${lessonId}/progress`),
    updateProgress: (lessonId: string, data: { status?: LessonProgressStatus; progressPercentage?: number; lastWatchedPosition?: number; completed?: boolean }) =>
      apiClient.post<ApiResponse<StudentLessonProgress>>(`/lessons/${lessonId}/progress`, data),
    linkSession: (lessonId: string, data: { sessionId: string; order?: number }) =>
      apiClient.post<ApiResponse<any>>(`/lessons/${lessonId}/link-session`, data),
    getPlayback: (lessonId: string) =>
      apiClient.get<ApiResponse<PlaybackInfo>>(`/lessons/${lessonId}/playback`),
    getVideoStatus: (lessonId: string) =>
      apiClient.get<ApiResponse<{ lessonId: string; video: VideoAsset | null }>>(`/lessons/${lessonId}/video`),
    removeVideo: (lessonId: string) =>
      apiClient.delete<ApiResponse<{ success: boolean }>>(`/lessons/${lessonId}/video`)
  },
  videos: {
    createDirectUpload: (data: { title?: string; maxDurationSeconds?: number; isPrivate?: boolean; lessonId?: string }) =>
      apiClient.post<ApiResponse<{ uploadUrl: string; providerVideoId: string; videoAssetId: string; isDirectPost: boolean }>>('/videos/direct-upload', data),
    confirmUpload: (data: { videoAssetId: string; lessonId?: string }) =>
      apiClient.post<ApiResponse<VideoAsset>>('/videos/confirm-upload', data),
    connectExternal: (data: { url: string; title?: string; durationSeconds?: number; lessonId?: string }) =>
      apiClient.post<ApiResponse<VideoAsset>>('/videos/connect-external', data),
    attachToLesson: (lessonId: string, videoAssetId: string) =>
      apiClient.post<ApiResponse<Lesson>>(`/videos/lessons/${lessonId}/attach`, { videoAssetId }),
    detachFromLesson: (lessonId: string) =>
      apiClient.delete<ApiResponse<Lesson>>(`/videos/lessons/${lessonId}/detach`),
    getById: (id: string) =>
      apiClient.get<ApiResponse<VideoAsset & { previewPlayback?: PlaybackInfo }>>(`/videos/${id}`),
    delete: (id: string) =>
      apiClient.delete<ApiResponse<{ success: boolean }>>(`/videos/${id}`)
  },
  tasks: {
    list: (params?: { lessonId?: string; groupId?: string; taskType?: string }) => apiClient.get<ApiResponse<Task[]>>('/tasks', { params }),
    getById: (id: string) => apiClient.get<ApiResponse<Task>>(`/tasks/${id}`),
    create: (data: any) => apiClient.post<ApiResponse<Task>>('/tasks', data),
    update: (id: string, data: any) => apiClient.patch<ApiResponse<Task>>(`/tasks/${id}`, data),
    delete: (id: string) => apiClient.delete<ApiResponse<{ success: boolean }>>(`/tasks/${id}`),
    bulkPublish: (ids: string[], isPublished: boolean) =>
      apiClient.patch<ApiResponse<{ success: boolean; count: number; ids: string[] }>>('/tasks/bulk-publish', { ids, isPublished }),
    bulkDelete: (ids: string[]) =>
      apiClient.delete<ApiResponse<{ success: boolean; successful: string[]; failed: { id: string; reason: string }[] }>>('/tasks/bulk', { data: { ids } }),
    assign: (taskId: string, data: { groupId: string; dueDate?: string }) => apiClient.post<ApiResponse<any>>(`/tasks/${taskId}/assign`, data)
  },
  submissions: {
    submit: (data: { taskId: string; content?: string; fileUrl?: string; githubUrl?: string }) =>
      apiClient.post<ApiResponse<Submission>>('/submissions', data),
    list: (params?: { taskId?: string; studentId?: string; status?: string }) =>
      apiClient.get<ApiResponse<Submission[]>>('/submissions', { params }),
    review: (id: string, data: { status: string; feedback?: string }) =>
      apiClient.patch<ApiResponse<Submission>>(`/submissions/${id}/review`, data)
  },
  exams: {
    list: (params?: { curriculumId?: string; groupId?: string }) => apiClient.get<ApiResponse<Exam[]>>('/exams', { params }),
    getById: (id: string) => apiClient.get<ApiResponse<Exam>>(`/exams/${id}`),
    create: (data: any) => apiClient.post<ApiResponse<Exam>>('/exams', data),
    update: (id: string, data: any) => apiClient.patch<ApiResponse<Exam>>(`/exams/${id}`, data),
    delete: (id: string) => apiClient.delete<ApiResponse<{ success: boolean }>>(`/exams/${id}`),
    bulkPublish: (ids: string[], isPublished: boolean) =>
      apiClient.patch<ApiResponse<{ success: boolean; count: number; ids: string[] }>>('/exams/bulk-publish', { ids, isPublished }),
    bulkDelete: (ids: string[]) =>
      apiClient.delete<ApiResponse<{ success: boolean; successful: string[]; failed: { id: string; reason: string }[] }>>('/exams/bulk', { data: { ids } }),
    addQuestion: (examId: string, data: any) => apiClient.post<ApiResponse<any>>(`/exams/${examId}/questions`, data),
    deleteQuestion: (examId: string, questionId: string) => apiClient.delete<ApiResponse<{ success: boolean }>>(`/exams/${examId}/questions/${questionId}`),
    getAttempts: (examId: string) => apiClient.get<ApiResponse<{ examId: string; examTitle: string; totalMarks: number; attempts: any[] }>>(`/exams/${examId}/attempts`),
    submit: (examId: string, data: { answers: Record<string, string> }) =>
      apiClient.post<ApiResponse<{ attempt: any; score: number; totalMarks: number; percentage: number; xpEarned: number }>>(`/exams/${examId}/submit`, data)
  },
  gamification: {
    getLeaderboard: (params?: { year?: number; month?: number; groupId?: string; period?: 'weekly' | 'monthly' | 'semester' }) =>
      apiClient.get<ApiResponse<MonthlyLeaderboardData>>('/gamification/leaderboard', { params }),
    finalizeLeaderboard: (data: { year: number; month: number }) =>
      apiClient.post<ApiResponse<any>>('/gamification/leaderboard/finalize', data),
    getAchievements: () => apiClient.get<ApiResponse<any[]>>('/gamification/achievements'),
    createAchievement: (data: any) => apiClient.post<ApiResponse<any>>('/gamification/achievements', data),
    awardAchievement: (data: { studentId: string; achievementId: string }) =>
      apiClient.post<ApiResponse<any>>('/gamification/achievements/award', data),
    getXpHistory: (params?: { studentId?: string; page?: number; limit?: number }) =>
      apiClient.get<ApiResponse<any[]>>('/gamification/xp-history', { params })
  },
  payments: {
    list: (params?: { year?: number; month?: number; status?: string; groupId?: string }) =>
      apiClient.get<ApiResponse<Payment[]>>('/payments', { params }),
    getSummary: (params?: { year?: number; month?: number }) =>
      apiClient.get<ApiResponse<PaymentSummary>>('/payments/summary', { params }),
    record: (data: { studentId: string; year: number; month: number; amount: number; status: string; notes?: string }) =>
      apiClient.post<ApiResponse<Payment>>('/payments', data),
    bulkStatus: (data: { paymentIds: string[]; status: string; notes?: string }) =>
      apiClient.patch<ApiResponse<{ success: boolean; count: number; paymentIds: string[] }>>('/payments/bulk-status', data),
    getStudentPayments: (studentId: string) => apiClient.get<ApiResponse<Payment[]>>(`/payments/student/${studentId}`)
  },
  notifications: {
    list: (params?: { unreadOnly?: boolean }) => apiClient.get<ApiResponse<NotificationItem[]>>('/notifications', { params }),
    markAsRead: (id: string) => apiClient.patch<ApiResponse<any>>(`/notifications/${id}/read`),
    markAllAsRead: () => apiClient.post<ApiResponse<any>>('/notifications/read-all'),
    send: (data: { userId: string; title: string; message: string; type?: string }) =>
      apiClient.post<ApiResponse<any>>('/notifications', data)
  },
  users: {
    list: (params?: { role?: string; search?: string; page?: number; limit?: number }) =>
      apiClient.get<ApiResponse<User[]>>('/users', { params }),
    getById: (id: string) => apiClient.get<ApiResponse<User>>(`/users/${id}`),
    createStudent: (data: any) => apiClient.post<ApiResponse<{ user: User; student: any; temporaryPassword: string }>>('/users/students', data),
    createParent: (data: any) => apiClient.post<ApiResponse<{ user: User; parent: any; temporaryPassword: string; inviteToken?: string }>>('/users/parents', data),
    generateResetLink: (id: string) => apiClient.post<ApiResponse<{ loginId: string; token: string; expiresAt: string }>>(`/users/${id}/generate-reset-link`),
    generateInviteLink: (id: string) => apiClient.post<ApiResponse<{ loginId: string; token: string; expiresAt: string }>>(`/users/${id}/generate-invite-link`),
    update: (id: string, data: any) => apiClient.patch<ApiResponse<User>>(`/users/${id}`, data),
    delete: (id: string) => apiClient.delete<ApiResponse<{ success: boolean }>>(`/users/${id}`)
  },
  students: {
    list: (params?: { groupId?: string; search?: string }) => apiClient.get<ApiResponse<any[]>>('/students', { params }),
    getById: (id: string) => apiClient.get<ApiResponse<any>>(`/students/${id}`),
    getProgress: (id: string) => apiClient.get<ApiResponse<any>>(`/students/${id}/progress`),
    create: (data: any) => apiClient.post<ApiResponse<{ user: User; student: any; temporaryPassword: string; group?: any }>>('/users/students', data),
    update: (id: string, data: any) => apiClient.patch<ApiResponse<any>>(`/students/${id}`, data),
    bulkStatus: (studentIds: string[], isActive: boolean) =>
      apiClient.patch<ApiResponse<{ success: boolean; count: number; studentIds: string[] }>>('/students/bulk-status', { studentIds, isActive }),
    bulkAssignGroup: (studentIds: string[], groupId: string | null) =>
      apiClient.post<ApiResponse<{ success: boolean; successful: string[]; failed: { id: string; reason: string }[] }>>('/students/bulk-assign-group', { studentIds, groupId }),
    bulkDelete: (studentIds: string[]) =>
      apiClient.delete<ApiResponse<{ success: boolean; successful: string[]; failed: { id: string; reason: string }[] }>>('/students/bulk', { data: { studentIds } }),
    resetPassword: (id: string, data?: { customPassword?: string; mustChangePassword?: boolean }) =>
      apiClient.post<ApiResponse<ResetStudentPasswordResponse>>(`/students/${id}/reset-password`, data || {}),
    delete: (id: string) => apiClient.delete<ApiResponse<{ success: boolean }>>(`/students/${id}`)
  },
  parents: {
    list: (params?: { search?: string }) => apiClient.get<ApiResponse<any[]>>('/users', { params: { role: 'PARENT', ...params } }),
    create: (data: any) => apiClient.post<ApiResponse<{ user: User; parent: any; temporaryPassword: string }>>('/users/parents', data),
    getMyChildren: () => apiClient.get<ApiResponse<any[]>>('/parents/my-children'),
    linkChild: (data: { parentId: string; studentId: string; relationship?: string; isPrimary?: boolean }) =>
      apiClient.post<ApiResponse<any>>('/parents/link-child', data),
    updateRelationship: (data: { parentId: string; studentId: string; relationship: string; isPrimary?: boolean }) =>
      apiClient.patch<ApiResponse<any>>('/parents/update-relationship', data),
    unlinkChild: (parentId: string, studentId: string) =>
      apiClient.delete<ApiResponse<any>>('/parents/unlink-child', { params: { parentId, studentId } }),
    delete: (id: string) => apiClient.delete<ApiResponse<{ success: boolean }>>(`/parents/${id}`)
  },
  audit: {
    list: (params?: { action?: string; entityType?: string; page?: number; limit?: number }) =>
      apiClient.get<ApiResponse<AuditLogItem[]>>('/audit-logs', { params })
  },
  registrations: {
    getPublicStatus: () => apiClient.get<ApiResponse<PublicRegistrationStatus>>('/public/registration-status'),
    submitPublic: (data: any) => apiClient.post<ApiResponse<StudentRegistration>>('/public/registrations', data),
    listAdmin: (params?: { search?: string; status?: string; page?: number; limit?: number }) =>
      apiClient.get<ListAdminRegistrationsResponse>('/admin/registrations', { params }),
    getAdminSettings: () => apiClient.get<ApiResponse<PublicRegistrationStatus>>('/admin/registrations/settings'),
    updateAdminSettings: (data: { isOpen?: boolean; startDate?: string | null; endDate?: string | null; maxRegistrations?: number | null }) =>
      apiClient.patch<ApiResponse<RegistrationSetting>>('/admin/registrations/settings', data),
    getAdminById: (id: string) => apiClient.get<ApiResponse<StudentRegistration>>(`/admin/registrations/${id}`),
    updateAdmin: (id: string, data: { adminNotes?: string | null; rejectionReason?: string | null; status?: string }) =>
      apiClient.patch<ApiResponse<StudentRegistration>>(`/admin/registrations/${id}`, data),
    bulkStatus: (data: { registrationIds: string[]; status: string; rejectionReason?: string | null }) =>
      apiClient.patch<ApiResponse<{ success: boolean; count: number; registrationIds: string[] }>>('/admin/registrations/bulk-status', data),
    bulkApprove: (data: { registrationIds: string[]; groupId?: string | null }) =>
      apiClient.post<ApiResponse<{ success: boolean; successful: any[]; failed: any[] }>>('/admin/registrations/bulk-approve', data),
    approve: (id: string, data?: { groupId?: string | null; adminNotes?: string | null }) =>
      apiClient.post<ApiResponse<ApproveRegistrationResponse>>(`/admin/registrations/${id}/approve`, data || {})
  },
  access: {
    getLessonAccess: (lessonId: string) =>
      apiClient.get<ApiResponse<LessonAccessDecision>>(`/access/lessons/${lessonId}/access`),
    listGrants: (params?: { studentId?: string; scope?: string; isActive?: boolean }) =>
      apiClient.get<ApiResponse<EducationalAccessGrant[]>>('/access/grants', { params }),
    createGrant: (data: {
      studentId: string;
      scope: string;
      curriculumId?: string | null;
      lessonId?: string | null;
      reason: string;
      validFrom?: string;
      validUntil?: string | null;
    }) => apiClient.post<ApiResponse<EducationalAccessGrant>>('/access/grants', data),
    revokeGrant: (id: string, reason?: string) =>
      apiClient.post<ApiResponse<EducationalAccessGrant>>(`/access/grants/${id}/revoke`, { reason })
  },
  subscriptions: {
    listPlans: () => apiClient.get<ApiResponse<SubscriptionPlan[]>>('/access/plans'),
    createPlan: (data: {
      name: string;
      code: string;
      description?: string;
      price: number;
      currency?: string;
      billingInterval?: string;
      isActive?: boolean;
      features?: any;
    }) => apiClient.post<ApiResponse<SubscriptionPlan>>('/billing/admin/plans', data),
    updatePlan: (id: string, data: any) =>
      apiClient.patch<ApiResponse<SubscriptionPlan>>(`/billing/admin/plans/${id}`, data),
    deletePlan: (id: string) =>
      apiClient.delete<ApiResponse<{ success: boolean; deleted?: boolean; deactivated?: boolean; message: string }>>(`/billing/admin/plans/${id}`)
  },
  billing: {
    getPaymentMethods: () =>
      apiClient.get<ApiResponse<Array<{ id: string; nameAr: string; nameEn: string; isAutomatic: boolean; receivingAccount?: string; instructions?: string }>>>('/billing/payment-methods'),
    checkout: (data?: { planId?: string; paymentMethod?: string }) =>
      apiClient.post<ApiResponse<any>>('/billing/checkout', data || {}),
    submitManualPayment: (transactionId: string, data: { senderPhone?: string; referenceNumber?: string; receiptUrl?: string; notes?: string }) =>
      apiClient.post<ApiResponse<any>>(`/billing/manual-payments/${transactionId}/submit`, data),
    getMySubscription: () =>
      apiClient.get<ApiResponse<StudentSubscriptionResponse>>('/billing/my-subscription'),
    getMyPayments: () =>
      apiClient.get<ApiResponse<PaymentTransaction[]>>('/billing/my-payments'),
    cancelSubscription: (reason?: string) =>
      apiClient.post<ApiResponse<Subscription>>('/billing/cancel', { reason }),
    adminListSubscriptions: (params?: { status?: string; studentId?: string; page?: number; limit?: number }) =>
      apiClient.get<{ data: AdminSubscriptionItem[]; meta: any }>('/billing/admin/subscriptions', { params }),
    adminListTransactions: (params?: {
      status?: string;
      studentId?: string;
      provider?: string;
      search?: string;
      learningMode?: string;
      fromDate?: string;
      toDate?: string;
      page?: number;
      pageSize?: number;
      limit?: number;
    }) =>
      apiClient.get<{ data: PaymentTransaction[]; pagination: PaginationMeta; meta: any }>('/billing/admin/transactions', { params }),
    adminRefund: (id: string, reason: string) =>
      apiClient.post<ApiResponse<PaymentTransaction>>(`/billing/admin/transactions/${id}/refund`, { reason }),
    adminRecordManualPayment: (data: { studentId: string; notes?: string; idempotencyKey?: string }) =>
      apiClient.post<ApiResponse<{ transaction: PaymentTransaction; subscription: Subscription; isDuplicate?: boolean }>>('/billing/admin/manual-record', data),
    adminGetSettings: () =>
      apiClient.get<ApiResponse<any>>('/billing/admin/settings'),
    adminUpdateSettings: (data: any) =>
      apiClient.patch<ApiResponse<any>>('/billing/admin/settings', data),
    adminConfirmManualPayment: (transactionId: string) =>
      apiClient.post<ApiResponse<any>>(`/billing/admin/manual-payments/${transactionId}/confirm`),
    adminRejectManualPayment: (transactionId: string, reason: string) =>
      apiClient.post<ApiResponse<any>>(`/billing/admin/manual-payments/${transactionId}/reject`, { reason }),
    adminBulkConfirmManualPayments: (ids: string[]) =>
      apiClient.post<ApiResponse<any>>('/billing/admin/manual-payments/bulk-confirm', { ids }),
    adminBulkRejectManualPayments: (ids: string[], reason: string) =>
      apiClient.post<ApiResponse<any>>('/billing/admin/manual-payments/bulk-reject', { ids, reason }),
    adminBulkUpdatePlanStatus: (ids: string[], isActive: boolean) =>
      apiClient.patch<ApiResponse<any>>('/billing/admin/plans/bulk-status', { ids, isActive }),
    adminListPlans: () =>
      apiClient.get<ApiResponse<SubscriptionPlan[]>>('/billing/admin/plans'),
    adminCreatePlan: (data: any) =>
      apiClient.post<ApiResponse<SubscriptionPlan>>('/billing/admin/plans', data),
    adminUpdatePlan: (id: string, data: any) =>
      apiClient.patch<ApiResponse<SubscriptionPlan>>(`/billing/admin/plans/${id}`, data),
    adminDeletePlan: (id: string) =>
      apiClient.delete<ApiResponse<{ success: boolean; deleted?: boolean; deactivated?: boolean; message: string }>>(`/billing/admin/plans/${id}`)
  }
};
