import { prisma, pool } from '../src/db/prisma.js';
import { env } from '../src/config/env.js';

async function main() {
  console.log('=== DATABASE PRE-RESET AUDIT ===\n');

  // 1. Environment and Connection Info
  const dbUrl = process.env.DATABASE_URL || '';
  const nodeEnv = process.env.NODE_ENV || 'undefined';
  const urlSafe = dbUrl.replace(/:([^:@]+)@/, ':****@');
  console.log('Environment Configuration:');
  console.log(`- NODE_ENV: ${nodeEnv}`);
  console.log(`- DATABASE_URL: ${urlSafe}`);

  const isLocalOrDev =
    dbUrl.includes('localhost') ||
    dbUrl.includes('127.0.0.1') ||
    dbUrl.includes('postgres:5432') ||
    dbUrl.includes('coding_lab_db');
  const isNeonOrProd =
    dbUrl.includes('neon.tech') ||
    dbUrl.includes('aws') ||
    nodeEnv === 'production';

  console.log(`- Target Environment Type: ${isLocalOrDev ? 'LOCAL / DEVELOPMENT' : 'REMOTE / PRODUCTION'}`);
  console.log(`- Production Protection Check: ${isNeonOrProd ? 'WARNING: PRODUCTION-LIKE URL DETECTED' : 'SAFE: LOCAL DEV DB'}\n`);

  // 2. Table Row Counts
  console.log('--- TABLE RECORD COUNTS ---');
  const counts: Record<string, number> = {};
  
  // Dynamic count from information_schema
  const tables: any[] = await prisma.$queryRaw`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    ORDER BY table_name;
  `;

  for (const t of tables) {
    const tableName = t.table_name;
    const res: any[] = await prisma.$queryRawUnsafe(`SELECT COUNT(*)::int as count FROM "${tableName}"`);
    counts[tableName] = res[0]?.count || 0;
    console.log(`- ${tableName.padEnd(28)}: ${counts[tableName]}`);
  }

  // 3. Detailed breakdown of Curricula
  console.log('\n--- EXISTING CURRICULA ---');
  const curricula = await prisma.curriculum.findMany({
    include: {
      _count: {
        select: {
          sections: true,
          lessons: true,
          accessGrants: true,
        },
      },
    },
    orderBy: { createdAt: 'asc' },
  });

  console.log(`Total Curricula: ${curricula.length}`);
  const officialCurricula = curricula.filter(c => c.authority === 'OFFICIAL' || (c.code && c.code.startsWith('G11')));
  const legacyCurricula = curricula.filter(c => !(c.authority === 'OFFICIAL' || (c.code && c.code.startsWith('G11'))));
  console.log(`- Official Ministry Curricula: ${officialCurricula.length}`);
  console.log(`- Legacy / Test Curricula: ${legacyCurricula.length}`);

  for (const c of curricula.slice(0, 10)) {
    console.log(`  * [${c.code || 'NO_CODE'}] "${c.title}" | Authority: ${c.authority} | Sections: ${c._count.sections}, Lessons: ${c._count.lessons}, Grants: ${c._count.accessGrants}`);
  }
  if (curricula.length > 10) {
    console.log(`  ... and ${curricula.length - 10} more curricula (mostly test duplicates).`);
  }

  // Group legacy curricula by title to see pattern
  const titleGroups: Record<string, number> = {};
  for (const c of curricula) {
    titleGroups[c.title] = (titleGroups[c.title] || 0) + 1;
  }
  console.log('\nCurricula Sample Title Distribution:');
  for (const [title, count] of Object.entries(titleGroups).slice(0, 10)) {
    console.log(`  - "${title}": ${count} instances`);
  }

  // 4. Detailed breakdown of Sections & Lessons
  console.log('\n--- EXISTING SECTIONS & LESSONS ---');
  const sectionCount = await prisma.section.count();
  const lessonCount = await prisma.lesson.count();
  const officialLessonCount = await prisma.lesson.count({
    where: { code: { startsWith: 'G11' } },
  });
  console.log(`- Total Sections: ${sectionCount}`);
  console.log(`- Total Lessons: ${lessonCount}`);
  console.log(`  * With G11 Official Code: ${officialLessonCount}`);
  console.log(`  * Without G11 Official Code (Legacy/Test): ${lessonCount - officialLessonCount}`);

  // 5. Existing Tasks, Exams, Questions, Videos
  console.log('\n--- EXISTING LEARNING CONTENT (TASKS, EXAMS, QUESTIONS, VIDEOS) ---');
  const taskCount = await prisma.task.count();
  const taskOfficial = await prisma.task.count({ where: { code: { startsWith: 'G11' } } });
  const examCount = await prisma.exam.count();
  const examOfficial = await prisma.exam.count({ where: { code: { startsWith: 'G11' } } });
  const questionCount = await prisma.examQuestion.count();
  const videoCount = await prisma.videoAsset.count();

  console.log(`- Tasks: ${taskCount} (Official G11: ${taskOfficial}, Legacy: ${taskCount - taskOfficial})`);
  console.log(`- Exams: ${examCount} (Official G11: ${examOfficial}, Legacy: ${examCount - examOfficial})`);
  console.log(`- Exam Questions: ${questionCount}`);
  console.log(`- Video Assets: ${videoCount}`);

  // 6. User and Student Accounts breakdown
  console.log('\n--- USER & STUDENT ACCOUNTS ---');
  const userCountsByRole: any[] = await prisma.user.groupBy({
    by: ['role'],
    _count: { id: true },
  });
  for (const u of userCountsByRole) {
    console.log(`- Role ${u.role}: ${u._count.id}`);
  }

  const adminUsers = await prisma.user.findMany({
    where: { role: 'ADMIN' },
    select: { id: true, email: true, loginId: true, firstName: true, lastName: true, role: true },
  });
  console.log('Admin Users:');
  for (const a of adminUsers) {
    console.log(`  * ID: ${a.id} | Email: ${a.email} | LoginID: ${a.loginId} | Name: ${a.firstName} ${a.lastName}`);
  }

  const studentCount = await prisma.student.count();
  const parentCount = await prisma.parent.count();
  console.log(`- Student Profile Records: ${studentCount}`);
  console.log(`- Parent Profile Records: ${parentCount}`);

  // 7. Student Progress, Submissions, Attempts, Activity
  console.log('\n--- STUDENT ACTIVITY / LEARNING DATA ---');
  const progressCount = await prisma.studentLessonProgress.count();
  const submissionCount = await prisma.submission.count();
  const attemptCount = await prisma.examAttempt.count();
  const xpCount = await prisma.xPTransaction.count();
  const grantCount = await prisma.educationalAccessGrant.count();
  const subCount = await prisma.subscription.count();
  const txCount = await prisma.paymentTransaction.count();
  const notifCount = await prisma.notification.count();
  const auditLogCount = await prisma.auditLog.count();
  const refreshTokens = await prisma.refreshToken.count();

  console.log(`- Student Lesson Progress: ${progressCount}`);
  console.log(`- Task Submissions: ${submissionCount}`);
  console.log(`- Exam Attempts: ${attemptCount}`);
  console.log(`- XP Transactions: ${xpCount}`);
  console.log(`- Educational Access Grants: ${grantCount}`);
  console.log(`- Subscriptions: ${subCount}`);
  console.log(`- Payment Transactions: ${txCount}`);
  console.log(`- Notifications: ${notifCount}`);
  console.log(`- Audit Logs: ${auditLogCount}`);
  console.log(`- Refresh Tokens: ${refreshTokens}`);

  // 8. Foreign Key Constraints inspection
  console.log('\n--- FOREIGN KEY RELATIONSHIPS (Cascades & Dependencies) ---');
  const fks: any[] = await prisma.$queryRaw`
    SELECT
      tc.table_name,
      kcu.column_name,
      ccu.table_name AS foreign_table_name,
      ccu.column_name AS foreign_column_name,
      rc.delete_rule
    FROM information_schema.table_constraints AS tc
    JOIN information_schema.key_column_usage AS kcu
      ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
    JOIN information_schema.referential_constraints AS rc
      ON tc.constraint_name = rc.constraint_name
    JOIN information_schema.constraint_column_usage AS ccu
      ON ccu.constraint_name = tc.constraint_name
      AND ccu.table_schema = tc.table_schema
    WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = 'public'
    ORDER BY tc.table_name, kcu.column_name;
  `;
  console.log(`Total Foreign Key Constraints: ${fks.length}`);
  const cascadeRules: Record<string, number> = {};
  for (const fk of fks) {
    cascadeRules[fk.delete_rule] = (cascadeRules[fk.delete_rule] || 0) + 1;
  }
  console.log('Delete rules summary:', cascadeRules);

  // 9. Prisma Migrations History
  console.log('\n--- PRISMA MIGRATION HISTORY ---');
  const migrations: any[] = await prisma.$queryRaw`
    SELECT id, migration_name, finished_at, rolled_back_at, applied_steps_count
    FROM _prisma_migrations
    ORDER BY finished_at ASC;
  `;
  for (const m of migrations) {
    console.log(`- [${m.finished_at ? 'APPLIED' : 'PENDING'}] ${m.migration_name} (steps: ${m.applied_steps_count})`);
  }

  // 10. System Configuration Records
  console.log('\n--- SYSTEM / INFRASTRUCTURE CONFIGURATION ---');
  const regSettings = await prisma.registrationSetting.findMany();
  console.log(`- Registration Settings: ${regSettings.length} row(s)`);
  for (const s of regSettings) {
    console.log(`  * Allow Student Reg: ${s.allowStudentRegistration}, Allow Parent Reg: ${s.allowParentRegistration}`);
  }

  const subPlans = await prisma.subscriptionPlan.findMany();
  console.log(`- Subscription Plans: ${subPlans.length} row(s)`);
  for (const sp of subPlans) {
    console.log(`  * Plan: ${sp.name} (${sp.code}) - ${sp.price} EGP`);
  }

  console.log('\n=== AUDIT COMPLETED SUCCESSFULLY ===');
}

main()
  .catch((e) => {
    console.error('Audit failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
