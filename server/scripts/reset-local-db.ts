import { prisma, pool } from '../src/db/prisma.js';

/**
 * Validates that the current database connection is strictly targeting a local development database.
 * Refuses execution on production, cloud-hosted, or ambiguous database targets.
 * Never prints sensitive connection strings or credentials.
 */
function assertLocalDatabaseSafety(): void {
  const nodeEnv = (process.env.NODE_ENV || 'development').trim().toLowerCase();
  if (nodeEnv === 'production') {
    throw new Error('SAFETY CHECK FAILED: Cannot run local reset when NODE_ENV is set to "production".');
  }

  const rawUrl = (process.env.DATABASE_URL || '').trim();
  if (!rawUrl) {
    throw new Error('SAFETY CHECK FAILED: DATABASE_URL is undefined or empty.');
  }

  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error('SAFETY CHECK FAILED: DATABASE_URL is not a valid URL format.');
  }

  const host = (parsed.hostname || '').toLowerCase();
  const pathname = (parsed.pathname || '').toLowerCase();

  // Cloud/production host indicators
  const prohibitedHostPatterns = [
    'neon.tech',
    'aws',
    'rds.amazonaws.com',
    'azure',
    'database.windows.net',
    'render.com',
    'railway.app',
    'supabase.co',
    'elephantsql.com',
    'planetscale',
    'cloudsql',
    'gcp'
  ];

  for (const pattern of prohibitedHostPatterns) {
    if (host.includes(pattern) || rawUrl.toLowerCase().includes(pattern)) {
      throw new Error(`SAFETY CHECK FAILED: Remote/cloud database host pattern detected ("${pattern}"). Reset aborted.`);
    }
  }

  // Allowed local hostnames only
  const allowedLocalHosts = ['localhost', '127.0.0.1', '::1', 'postgres'];
  if (!allowedLocalHosts.includes(host)) {
    throw new Error(`SAFETY CHECK FAILED: Host "${host}" is not in the allowed local development host list. Reset aborted.`);
  }

  // Check database name for production keywords
  const dbName = pathname.replace(/^\//, '');
  if (dbName.includes('prod') || dbName.includes('production')) {
    throw new Error(`SAFETY CHECK FAILED: Database name "${dbName}" appears to be a production database. Reset aborted.`);
  }
}

async function resetLocalDatabase() {
  console.log('Database reset started...');

  // 1. Enforce safety assertion
  assertLocalDatabaseSafety();

  // 2. Perform transactional deletion in reverse topological dependency order
  const counts = await prisma.$transaction(async (tx) => {
    // 1. Access Grants
    const educationalAccessGrants = await tx.educationalAccessGrant.deleteMany();

    // 2. Billing & Subscriptions & Webhook events
    const paymentWebhookEvents = await tx.paymentWebhookEvent.deleteMany();
    const paymentTransactions = await tx.paymentTransaction.deleteMany();
    const subscriptions = await tx.subscription.deleteMany();
    const subscriptionPlans = await tx.subscriptionPlan.deleteMany();
    const payments = await tx.payment.deleteMany();

    // 3. Exam Submissions & Attempts
    const examAttempts = await tx.examAttempt.deleteMany();
    const examQuestions = await tx.examQuestion.deleteMany();
    const exams = await tx.exam.deleteMany();

    // 4. Task Submissions & Assignments
    const submissions = await tx.submission.deleteMany();
    const taskAssignments = await tx.taskAssignment.deleteMany();
    const tasks = await tx.task.deleteMany();

    // 5. Progress & Session Lessons
    const studentLessonProgress = await tx.studentLessonProgress.deleteMany();
    const sessionLessons = await tx.sessionLesson.deleteMany();

    // 6. Curriculum, Sections, Lessons, Videos
    const lessons = await tx.lesson.deleteMany();
    const sections = await tx.section.deleteMany();
    const curricula = await tx.curriculum.deleteMany();
    const videoAssets = await tx.videoAsset.deleteMany();

    // 7. Attendance & Sessions
    const attendances = await tx.attendance.deleteMany();
    const sessions = await tx.session.deleteMany();

    // 8. Groups & Schedules & Enrollments
    const groupEnrollments = await tx.groupEnrollment.deleteMany();
    const groupSchedules = await tx.groupSchedule.deleteMany();

    // 9. Gamification, Leaderboards & XP
    const monthlyLeaderboardEntries = await tx.monthlyLeaderboardEntry.deleteMany();
    const monthlyLeaderboards = await tx.monthlyLeaderboard.deleteMany();
    const studentAchievements = await tx.studentAchievement.deleteMany();
    const achievements = await tx.achievement.deleteMany();
    const xpTransactions = await tx.xPTransaction.deleteMany();

    // 10. Registrations
    const studentRegistrations = await tx.studentRegistration.deleteMany();

    // 11. Parent-Student associations
    const parentStudents = await tx.parentStudent.deleteMany();

    // 12. Students & Parents profiles
    const students = await tx.student.deleteMany();
    const parents = await tx.parent.deleteMany();

    // 13. Auth Tokens & Audit Logs & Notifications
    const authTokens = await tx.authToken.deleteMany();
    const refreshTokens = await tx.refreshToken.deleteMany();
    const notifications = await tx.notification.deleteMany();
    const auditLogs = await tx.auditLog.deleteMany();

    // 14. Groups
    const groups = await tx.group.deleteMany();

    // 15. Users (Admins, Students, Parents)
    const users = await tx.user.deleteMany();

    // 16. Baseline settings reset (preserve default singleton configuration)
    await tx.registrationSetting.upsert({
      where: { id: 'default' },
      update: { isOpen: true, startDate: null, endDate: null, maxRegistrations: null },
      create: { id: 'default', isOpen: true }
    });

    await tx.paymentSetting.upsert({
      where: { id: 'default' },
      update: {
        vodafoneCashNumber: '01012345678',
        vodafoneCashInstructions: 'حول المبلغ المطلوب إلى رقم فودافون كاش ثم أدخل رقم الهاتف المحول منه ورقم العملية لتأكيد الدفع.',
        instaPayAddress: 'codek@instapay',
        instaPayInstructions: 'حول المبلغ المطلوب عبر تطبيق إنستاباي إلى العنوان أعلاه ثم أدخل الرقم المرجعي للتحويل.',
        vodafoneCashEnabled: true,
        instaPayEnabled: true,
        paymobEnabled: true
      },
      create: { id: 'default' }
    });

    return {
      users: users.count,
      students: students.count,
      parents: parents.count,
      groups: groups.count,
      sessions: sessions.count,
      attendances: attendances.count,
      curricula: curricula.count,
      sections: sections.count,
      lessons: lessons.count,
      videoAssets: videoAssets.count,
      tasks: tasks.count,
      submissions: submissions.count,
      exams: exams.count,
      examQuestions: examQuestions.count,
      examAttempts: examAttempts.count,
      studentLessonProgress: studentLessonProgress.count,
      subscriptions: subscriptions.count,
      subscriptionPlans: subscriptionPlans.count,
      payments: payments.count,
      paymentTransactions: paymentTransactions.count,
      paymentWebhookEvents: paymentWebhookEvents.count,
      educationalAccessGrants: educationalAccessGrants.count,
      studentRegistrations: studentRegistrations.count,
      achievements: achievements.count,
      xpTransactions: xpTransactions.count,
      monthlyLeaderboards: monthlyLeaderboards.count,
      notifications: notifications.count,
      auditLogs: auditLogs.count,
      refreshTokens: refreshTokens.count,
      authTokens: authTokens.count
    };
  });

  // 3. Print concise deletion summary
  console.log(`Deleted ${counts.users} users`);
  console.log(`Deleted ${counts.students} students`);
  console.log(`Deleted ${counts.parents} parents`);
  console.log(`Deleted ${counts.groups} groups`);
  console.log(`Deleted ${counts.sessions} sessions`);
  console.log(`Deleted ${counts.attendances} attendances`);
  console.log(`Deleted ${counts.curricula} curricula`);
  console.log(`Deleted ${counts.sections} sections`);
  console.log(`Deleted ${counts.lessons} lessons`);
  console.log(`Deleted ${counts.videoAssets} video assets`);
  console.log(`Deleted ${counts.tasks} tasks`);
  console.log(`Deleted ${counts.submissions} submissions`);
  console.log(`Deleted ${counts.exams} exams`);
  console.log(`Deleted ${counts.examQuestions} exam questions`);
  console.log(`Deleted ${counts.examAttempts} exam attempts`);
  console.log(`Deleted ${counts.studentLessonProgress} lesson progress records`);
  console.log(`Deleted ${counts.subscriptions} subscriptions`);
  console.log(`Deleted ${counts.subscriptionPlans} subscription plans`);
  console.log(`Deleted ${counts.payments} payments`);
  console.log(`Deleted ${counts.paymentTransactions} payment transactions`);
  console.log(`Deleted ${counts.paymentWebhookEvents} payment webhook events`);
  console.log(`Deleted ${counts.educationalAccessGrants} educational access grants`);
  console.log(`Deleted ${counts.studentRegistrations} student registrations`);
  console.log(`Deleted ${counts.achievements} achievements`);
  console.log(`Deleted ${counts.xpTransactions} XP transactions`);
  console.log(`Deleted ${counts.monthlyLeaderboards} monthly leaderboards`);
  console.log(`Deleted ${counts.notifications} notifications`);
  console.log(`Deleted ${counts.auditLogs} audit logs`);
  console.log(`Deleted ${counts.refreshTokens} refresh tokens`);
  console.log(`Deleted ${counts.authTokens} auth tokens`);
  console.log('Database reset completed.');
}

resetLocalDatabase()
  .catch((err) => {
    console.error('Reset failed:', err.message);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
