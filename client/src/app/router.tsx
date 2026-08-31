import React from 'react';
import { createBrowserRouter, Navigate } from 'react-router-dom';

// Layouts
import { AuthLayout } from './layouts/auth-layout.js';
import { StudentLayout, ParentLayout, AdminLayout } from './layouts/student-layout.js';

// Auth Pages
import { LoginPage } from '../pages/auth/login-page.js';
import { ChangePasswordPage, SetupPasswordPage, ResetPasswordPage } from '../pages/auth/change-password-page.js';

// Student Pages
import { StudentHomePage } from '../pages/student/student-home-page.js';
import { TodayPage } from '../pages/student/today-page.js';
import { MyGroupPage } from '../pages/student/my-group-page.js';
import { CurriculumPage, LessonViewPage } from '../pages/student/curriculum-page.js';
import { TasksPage, TaskViewPage } from '../pages/student/tasks-page.js';
import { ExamsPage, ExamTakePage } from '../pages/student/exams-page.js';
import { LeaderboardPage } from '../pages/student/leaderboard-page.js';
import { AchievementsPage } from '../pages/student/achievements-page.js';
import { ProgressPage } from '../pages/student/progress-page.js';
import { SettingsPage } from '../pages/student/settings-page.js';

// Parent Pages
import { ParentDashboardPage } from '../pages/parent/parent-dashboard-page.js';
import { ParentChildrenPage, ParentPaymentsPage } from '../pages/parent/parent-children-page.js';

// Admin Pages
import { AdminDashboardPage } from '../pages/admin/admin-dashboard-page.js';
import { AdminStudentsPage } from '../pages/admin/admin-students-page.js';
import { AdminStudentDetailPage } from '../pages/admin/admin-student-detail-page.js';
import { AdminParentsPage } from '../pages/admin/admin-parents-page.js';
import { AdminGroupsPage } from '../pages/admin/admin-groups-page.js';
import { AdminGroupDetailPage } from '../pages/admin/admin-group-detail-page.js';
import { AdminSessionsPage } from '../pages/admin/admin-sessions-page.js';
import { AdminSessionQrPage } from '../pages/admin/admin-session-qr-page.js';
import { AdminCurriculumPage, AdminLessonEditorPage } from '../pages/admin/admin-curriculum-page.js';
import { AdminTasksPage } from '../pages/admin/admin-tasks-page.js';
import { AdminSubmissionsPage } from '../pages/admin/admin-submissions-page.js';
import { AdminExamsPage, AdminExamBuilderPage } from '../pages/admin/admin-exams-page.js';
import { AdminLeaderboardPage } from '../pages/admin/admin-leaderboard-page.js';
import { AdminPaymentsPage } from '../pages/admin/admin-payments-page.js';
import { AdminNotificationsPage } from '../pages/admin/admin-notifications-page.js';
import { AdminAuditLogsPage } from '../pages/admin/admin-audit-logs-page.js';
import { PublicRegistrationPage } from '../pages/public/public-registration-page.js';
import { AdminRegistrationsPage } from '../pages/admin/admin-registrations-page.js';
import { AdminRegistrationDetailPage } from '../pages/admin/admin-registration-detail-page.js';

export const router = createBrowserRouter([
  // Standalone Public Registration
  { path: '/register', element: <PublicRegistrationPage /> },
  { path: '/student-registration', element: <PublicRegistrationPage /> },

  // Public / Auth Routes
  {
    element: <AuthLayout />,
    children: [
      { path: '/login', element: <LoginPage /> },
      { path: '/change-password', element: <ChangePasswordPage /> },
      { path: '/setup/:token', element: <SetupPasswordPage /> },
      { path: '/reset-password/:token', element: <ResetPasswordPage /> }
    ]
  },

  // Student Experience
  {
    path: '/student',
    element: <StudentLayout />,
    children: [
      { index: true, element: <StudentHomePage /> },
      { path: 'today', element: <TodayPage /> },
      { path: 'my-group', element: <MyGroupPage /> },
      { path: 'curriculum', element: <CurriculumPage /> },
      { path: 'lessons/:id', element: <LessonViewPage /> },
      { path: 'tasks', element: <TasksPage /> },
      { path: 'tasks/:id', element: <TaskViewPage /> },
      { path: 'exams', element: <ExamsPage /> },
      { path: 'exams/:id', element: <ExamTakePage /> },
      { path: 'leaderboard', element: <LeaderboardPage /> },
      { path: 'achievements', element: <AchievementsPage /> },
      { path: 'progress', element: <ProgressPage /> },
      { path: 'settings', element: <SettingsPage /> }
    ]
  },

  // Parent Experience
  {
    path: '/parent',
    element: <ParentLayout />,
    children: [
      { index: true, element: <ParentDashboardPage /> },
      { path: 'children', element: <ParentChildrenPage /> },
      { path: 'payments', element: <ParentPaymentsPage /> },
      { path: 'settings', element: <SettingsPage /> }
    ]
  },

  // Admin Experience
  {
    path: '/admin',
    element: <AdminLayout />,
    children: [
      { index: true, element: <AdminDashboardPage /> },
      { path: 'registrations', element: <AdminRegistrationsPage /> },
      { path: 'registrations/:id', element: <AdminRegistrationDetailPage /> },
      { path: 'students', element: <AdminStudentsPage /> },
      { path: 'students/:id', element: <AdminStudentDetailPage /> },
      { path: 'parents', element: <AdminParentsPage /> },
      { path: 'groups', element: <AdminGroupsPage /> },
      { path: 'groups/:id', element: <AdminGroupDetailPage /> },
      { path: 'sessions', element: <AdminSessionsPage /> },
      { path: 'sessions/:id/qr', element: <AdminSessionQrPage /> },
      { path: 'curriculum', element: <AdminCurriculumPage /> },
      { path: 'lessons/:id/edit', element: <AdminLessonEditorPage /> },
      { path: 'tasks', element: <AdminTasksPage /> },
      { path: 'submissions', element: <AdminSubmissionsPage /> },
      { path: 'exams', element: <AdminExamsPage /> },
      { path: 'exams/:id/builder', element: <AdminExamBuilderPage /> },
      { path: 'leaderboard', element: <AdminLeaderboardPage /> },
      { path: 'payments', element: <AdminPaymentsPage /> },
      { path: 'notifications', element: <AdminNotificationsPage /> },
      { path: 'audit-logs', element: <AdminAuditLogsPage /> },
      { path: 'settings', element: <SettingsPage /> }
    ]
  },

  // Fallback Catch-all
  {
    path: '*',
    element: <Navigate to="/login" replace />
  }
]);
