import { Role } from '@prisma/client';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Load environment variables from server root .env
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

// Import initialized Prisma Client with PG Adapter
import { prisma } from '../src/db/prisma.js';

async function main() {
  if (process.env.NODE_ENV === 'production') {
    console.error('❌ SEED ABORTED: Database wiping / development seeding is strictly forbidden in production!');
    process.exit(1);
  }

  console.log('====================================================');
  console.log('🔄 Cleaning entire database & Seeding Admin User only');
  console.log('====================================================\n');

  // 1. Wipe all tables in reverse dependency order
  console.log('🗑️  Wiping all existing database records...');
  await prisma.auditLog.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.monthlyLeaderboardEntry.deleteMany();
  await prisma.monthlyLeaderboard.deleteMany();
  await prisma.studentAchievement.deleteMany();
  await prisma.achievement.deleteMany();
  await prisma.xPTransaction.deleteMany();
  await prisma.examAttempt.deleteMany();
  await prisma.examQuestion.deleteMany();
  await prisma.exam.deleteMany();
  await prisma.submission.deleteMany();
  await prisma.taskAssignment.deleteMany();
  await prisma.task.deleteMany();
  await prisma.sessionLesson.deleteMany();
  await prisma.lesson.deleteMany();
  await prisma.curriculum.deleteMany();
  await prisma.attendance.deleteMany();
  await prisma.session.deleteMany();
  await prisma.groupEnrollment.deleteMany();
  await prisma.group.deleteMany();
  await prisma.parentStudent.deleteMany();
  await prisma.parent.deleteMany();
  await prisma.student.deleteMany();
  await prisma.authToken.deleteMany();
  await prisma.refreshToken.deleteMany();
  await prisma.user.deleteMany();
  console.log('✅ Database completely cleared.\n');

  // 2. Read admin credentials strictly from .env
  const loginId = (process.env.ADMIN_LOGIN_ID || 'ADM-001').trim();
  const rawEmail = (process.env.ADMIN_EMAIL || 'admin@codek.local').trim().toLowerCase();
  const rawPassword = (process.env.ADMIN_PASSWORD || 'Admin@123456').trim();
  const fullName = (process.env.ADMIN_NAME || 'Admin User').trim();
  const phone = process.env.ADMIN_PHONE ? process.env.ADMIN_PHONE.trim() : '+201000000000';

  const nameParts = fullName.split(' ');
  const firstName = nameParts[0] || 'Admin';
  const lastName = nameParts.slice(1).join(' ') || 'Manager';

  console.log('🔑 Reading Admin configuration from .env:');
  console.log(`   - Login ID : ${loginId}`);
  console.log(`   - Email    : ${rawEmail}`);
  console.log(`   - Name     : ${firstName} ${lastName}`);
  console.log(`   - Phone    : ${phone}\n`);

  const passwordHash = await bcrypt.hash(rawPassword, 10);

  // 3. Create Admin user
  const admin = await prisma.user.create({
    data: {
      loginId,
      email: rawEmail,
      passwordHash,
      firstName,
      lastName,
      phone,
      role: Role.ADMIN,
      mustChangePassword: false,
      isEmailVerified: true,
      isActive: true
    }
  });

  console.log('====================================================');
  console.log('🎉 Admin user created successfully!');
  console.log('====================================================');
  console.log(`   User ID     : ${admin.id}`);
  console.log(`   Login ID    : ${admin.loginId}`);
  console.log(`   Email       : ${admin.email}`);
  console.log(`   Name        : ${admin.firstName} ${admin.lastName}`);
  console.log(`   Role        : ${admin.role}`);
  console.log('====================================================\n');
}

main()
  .catch((e) => {
    console.error('❌ Error during Admin seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
