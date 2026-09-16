import React, { useState } from 'react';
import { Outlet, Navigate } from 'react-router-dom';
import { useAuth } from '../../context/auth-context.js';
import { Topbar } from '../../components/layout/topbar.js';
import { Sidebar } from '../../components/layout/sidebar.js';
import { MobileNav } from '../../components/layout/mobile-nav.js';
import { Skeleton } from '../../components/ui/skeleton.js';

export function StudentLayout() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center p-6 bg-slate-50 dark:bg-slate-950">
        <Skeleton className="w-full max-w-lg h-64 rounded-3xl" />
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />;
  }

  // Phase 7 Security Guard: Email verification gate
  if (user.role === 'STUDENT' && user.isEmailVerified === false) {
    return <Navigate to="/verify-email" replace />;
  }

  // Phase 7 Onboarding Guard: Learning mode selection gate
  if (user.role === 'STUDENT' && user.student && user.student.learningModeSelected === false) {
    return <Navigate to="/onboarding/learning-mode" replace />;
  }

  if (user.mustChangePassword) {
    return <Navigate to="/change-password" replace />;
  }

  if (user.role !== 'STUDENT') {
    return <Navigate to={user.role === 'ADMIN' ? '/admin' : '/parent'} replace />;
  }

  return (
    <div className="h-screen bg-slate-50/70 dark:bg-slate-950 flex flex-col transition-colors duration-200 overflow-hidden">
      <Topbar onToggleSidebar={() => setSidebarOpen(!sidebarOpen)} />
      <div className="flex-1 flex overflow-hidden">
        <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <main className="flex-1 overflow-y-auto overflow-x-hidden p-4 sm:p-6 lg:p-8 pb-28 lg:pb-8">
          <div className="max-w-6xl mx-auto">
            <Outlet />
          </div>
        </main>
      </div>
      <MobileNav />
    </div>
  );
}

export function ParentLayout() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center p-6 bg-slate-50 dark:bg-slate-950">
        <Skeleton className="w-full max-w-lg h-64 rounded-3xl" />
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />;
  }

  if (user.mustChangePassword) {
    return <Navigate to="/change-password" replace />;
  }

  if (user.role !== 'PARENT') {
    return <Navigate to={user.role === 'ADMIN' ? '/admin' : '/student'} replace />;
  }

  return (
    <div className="h-screen bg-slate-50/70 dark:bg-slate-950 flex flex-col transition-colors duration-200 overflow-hidden">
      <Topbar onToggleSidebar={() => setSidebarOpen(!sidebarOpen)} />
      <div className="flex-1 flex overflow-hidden">
        <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <main className="flex-1 overflow-y-auto overflow-x-hidden p-4 sm:p-6 lg:p-8 pb-28 lg:pb-8">
          <div className="max-w-5xl mx-auto">
            <Outlet />
          </div>
        </main>
      </div>
      <MobileNav />
    </div>
  );
}

export function AdminLayout() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center p-6 bg-slate-50 dark:bg-slate-950">
        <Skeleton className="w-full max-w-lg h-64 rounded-3xl" />
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />;
  }

  if (user.mustChangePassword) {
    return <Navigate to="/change-password" replace />;
  }

  if (user.role !== 'ADMIN') {
    return <Navigate to={user.role === 'STUDENT' ? '/student' : '/parent'} replace />;
  }

  return (
    <div className="h-screen bg-slate-50/70 dark:bg-slate-950 flex flex-col transition-colors duration-200 overflow-hidden">
      <Topbar onToggleSidebar={() => setSidebarOpen(!sidebarOpen)} />
      <div className="flex-1 flex overflow-hidden">
        <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <main className="flex-1 overflow-y-auto overflow-x-hidden p-4 sm:p-6 lg:p-8 pb-28 lg:pb-8">
          <div className="max-w-7xl mx-auto">
            <Outlet />
          </div>
        </main>
      </div>
      <MobileNav />
    </div>
  );
}
