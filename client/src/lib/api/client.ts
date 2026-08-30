import axios, { AxiosError, AxiosRequestConfig } from 'axios';
import {
  ApiResponse,
  User,
  StudentDashboardData,
  ParentDashboardData,
  AdminDashboardData,
  Curriculum,
  Lesson,
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
  ResetStudentPasswordResponse
} from '../../types/api.js';

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

// Refresh token mutex / queue state
let isRefreshing = false;
let refreshSubscribers: Array<(token: string) => void> = [];

function subscribeTokenRefresh(cb: (token: string) => void) {
  refreshSubscribers.push(cb);
}

function onRefreshed(token: string) {
  refreshSubscribers.forEach((cb) => cb(token));
  refreshSubscribers = [];
}

// Response interceptor with mutex-protected token refresh
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
      originalRequest.url.includes('/auth/logout') ||
      originalRequest.url.includes('/auth/me');

    if (originalRequest && error.response?.status === 401 && !originalRequest._retry && !isAuthEndpoint) {
      originalRequest._retry = true;
      const refreshToken = localStorage.getItem('academy_refresh_token');

      // If no refresh token in localStorage, just clean up tokens without hard page reload
      if (!refreshToken) {
        localStorage.removeItem('academy_access_token');
        localStorage.removeItem('academy_refresh_token');
        localStorage.removeItem('academy_user');
        return Promise.reject(error);
      }

      if (isRefreshing) {
        // Queue this request until refresh completes
        return new Promise((resolve, reject) => {
          subscribeTokenRefresh((newToken: string) => {
            if (!newToken) {
              return reject(error);
            }
            if (originalRequest.headers) {
              originalRequest.headers.Authorization = `Bearer ${newToken}`;
            }
            resolve(apiClient(originalRequest));
          });
        });
      }

      isRefreshing = true;

      try {
        const refreshUrl = baseURL.endsWith('/') ? `${baseURL}auth/refresh` : `${baseURL}/auth/refresh`;
        const res = await axios.post(refreshUrl, { refreshToken }, { withCredentials: true });
        const newAccessToken = res.data?.data?.accessToken;
        const newRefreshToken = res.data?.data?.refreshToken || refreshToken;

        if (newAccessToken) {
          localStorage.setItem('academy_access_token', newAccessToken);
          if (newRefreshToken) {
            localStorage.setItem('academy_refresh_token', newRefreshToken);
          }

          if (originalRequest.headers) {
            originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
          }

          onRefreshed(newAccessToken);
          return apiClient(originalRequest);
        } else {
          throw new Error('No access token returned from refresh');
        }
      } catch (refreshErr) {
        localStorage.removeItem('academy_access_token');
        localStorage.removeItem('academy_refresh_token');
        localStorage.removeItem('academy_user');
        onRefreshed('');
        return Promise.reject(refreshErr);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

// API Functions Map
export const api = {
  auth: {
    login: (data: { loginId: string; password: string }) =>
      apiClient.post<ApiResponse<LoginResponse>>('/auth/login', data),
    verify2FA: (data: { tempToken: string; otpCode: string }) =>
      apiClient.post<ApiResponse<{ user: User; accessToken: string; refreshToken: string; mustChangePassword: boolean }>>('/auth/verify-2fa', data),
    resend2FA: (data: { tempToken: string }) =>
      apiClient.post<ApiResponse<{ success: boolean; tempToken: string; emailMasked: string }>>('/auth/resend-2fa', data),
    refresh: () =>
      apiClient.post<ApiResponse<{ user: User; accessToken: string; refreshToken: string }>>('/auth/refresh'),
    getMe: () => apiClient.get<ApiResponse<User>>('/auth/me'),
    changePassword: (data: { currentPassword: string; newPassword: string }) =>
      apiClient.post<ApiResponse<{ success: boolean }>>('/auth/change-password', data),
    setupPassword: (data: { token: string; newPassword: string }) =>
      apiClient.post<ApiResponse<{ user: User; accessToken: string; refreshToken: string }>>('/auth/setup-password', data),
    resetPassword: (data: { token: string; newPassword: string }) =>
      apiClient.post<ApiResponse<{ success: boolean }>>('/auth/reset-password', data),
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
    enrollStudent: (groupId: string, studentId: string) => apiClient.post<ApiResponse<any>>(`/groups/${groupId}/enroll`, { studentId }),
    enroll: (groupId: string, studentId: string) => apiClient.post<ApiResponse<any>>(`/groups/${groupId}/enroll`, { studentId }),
    removeStudent: (groupId: string, studentId: string) => apiClient.delete<ApiResponse<any>>(`/groups/${groupId}/enrollments/${studentId}`)
  },
  sessions: {
    list: (params?: { groupId?: string; status?: string }) => apiClient.get<ApiResponse<Session[]>>('/sessions', { params }),
    getById: (id: string) => apiClient.get<ApiResponse<Session & { hasActiveToken?: boolean }>>(`/sessions/${id}`),
    create: (data: any) => apiClient.post<ApiResponse<Session>>('/sessions', data),
    update: (id: string, data: any) => apiClient.patch<ApiResponse<Session>>(`/sessions/${id}`, data),
    delete: (id: string) => apiClient.delete<ApiResponse<{ success: boolean }>>(`/sessions/${id}`),
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
      apiClient.get<ApiResponse<{ sessionId: string; sessionNumber: number; groupName: string; totalEnrolled: number; presentCount: number; absentCount: number; roster: AttendanceRosterItem[] }>>(`/attendance/session/${sessionId}`)
  },
  curriculum: {
    list: () => apiClient.get<ApiResponse<Curriculum[]>>('/curriculum'),
    getById: (id: string) => apiClient.get<ApiResponse<Curriculum>>(`/curriculum/${id}`),
    create: (data: any) => apiClient.post<ApiResponse<Curriculum>>('/curriculum', data),
    update: (id: string, data: any) => apiClient.patch<ApiResponse<Curriculum>>(`/curriculum/${id}`, data),
    delete: (id: string) => apiClient.delete<ApiResponse<{ success: boolean }>>(`/curriculum/${id}`)
  },
  lessons: {
    list: (params?: { curriculumId?: string }) => apiClient.get<ApiResponse<Lesson[]>>('/lessons', { params }),
    getById: (id: string) => apiClient.get<ApiResponse<Lesson>>(`/lessons/${id}`),
    create: (data: any) => apiClient.post<ApiResponse<Lesson>>('/lessons', data),
    update: (id: string, data: any) => apiClient.patch<ApiResponse<Lesson>>(`/lessons/${id}`, data),
    delete: (id: string) => apiClient.delete<ApiResponse<{ success: boolean }>>(`/lessons/${id}`),
    linkSession: (lessonId: string, data: { sessionId: string; order?: number }) =>
      apiClient.post<ApiResponse<any>>(`/lessons/${lessonId}/link-session`, data)
  },
  tasks: {
    list: (params?: { lessonId?: string; groupId?: string; taskType?: string }) => apiClient.get<ApiResponse<Task[]>>('/tasks', { params }),
    getById: (id: string) => apiClient.get<ApiResponse<Task>>(`/tasks/${id}`),
    create: (data: any) => apiClient.post<ApiResponse<Task>>('/tasks', data),
    update: (id: string, data: any) => apiClient.patch<ApiResponse<Task>>(`/tasks/${id}`, data),
    delete: (id: string) => apiClient.delete<ApiResponse<{ success: boolean }>>(`/tasks/${id}`),
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
  }
};
