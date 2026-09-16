/**
 * Production Admin Bootstrap Script — CodeK Academy
 *
 * Mode: CREATE-IF-MISSING (Strictly Non-Destructive)
 * Invariants:
 * 1. Never deletes or truncates any database table.
 * 2. Never overwrites or resets an existing administrator's password.
 * 3. Enforces strong password criteria (>=12 chars, mixed case, numbers/symbols).
 * 4. Rejects insecure development default passwords.
 * 5. Never logs passwords, tokens, or credentials to stdout/stderr.
 */

import { Role } from '@prisma/client';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

import { prisma } from '../src/db/prisma.js';

function isStrongPassword(pwd: string): { valid: boolean; reason?: string } {
  if (!pwd || pwd.length < 12) {
    return { valid: false, reason: 'Password must be at least 12 characters long.' };
  }
  const disallowedDefaults = [
    'admin@123456',
    'adminsuper110616010@here',
    'student@123',
    'parent@123',
    'password123',
    'adminadmin',
    'changeme123'
  ];
  if (disallowedDefaults.includes(pwd.toLowerCase().trim())) {
    return { valid: false, reason: 'Default or predictable development password is strictly rejected in production.' };
  }
  const hasUpper = /[A-Z]/.test(pwd);
  const hasLower = /[a-z]/.test(pwd);
  const hasDigit = /[0-9]/.test(pwd);
  const hasSpecial = /[^A-Za-z0-9]/.test(pwd);

  if (!hasUpper || !hasLower || (!hasDigit && !hasSpecial)) {
    return {
      valid: false,
      reason: 'Password must contain uppercase letters, lowercase letters, and at least one number or special character.'
    };
  }

  return { valid: true };
}

async function bootstrapAdmin() {
  console.log('--- CodeK Production Admin Provisioning ---');

  const loginId = (process.env.ADMIN_LOGIN_ID || '').trim();
  const rawEmail = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
  const rawPassword = (process.env.ADMIN_PASSWORD || '').trim();
  const fullName = (process.env.ADMIN_NAME || 'Academy Administrator').trim();
  const phone = (process.env.ADMIN_PHONE || '+201000000000').trim();

  if (!loginId) {
    console.error('❌ Error: ADMIN_LOGIN_ID environment variable is required.');
    process.exit(1);
  }

  if (!rawEmail || !rawEmail.includes('@')) {
    console.error('❌ Error: Valid ADMIN_EMAIL environment variable is required.');
    process.exit(1);
  }

  // Check if admin user already exists (Create-if-missing invariant)
  const existingUser = await prisma.user.findFirst({
    where: {
      OR: [
        { loginId },
        { email: rawEmail }
      ]
    }
  });

  if (existingUser) {
    console.log(`ℹ️ Notice: User with Login ID "${loginId}" or Email "${rawEmail}" already exists (ID: ${existingUser.id}, Role: ${existingUser.role}).`);
    console.log('🔒 Invariant Preserved: Existing administrator accounts and passwords are NEVER modified or overwritten by bootstrap.');
    console.log('✅ Admin bootstrap completed (no changes required).\n');
    return;
  }

  // Validate password strength for new administrator creation
  const passwordCheck = isStrongPassword(rawPassword);
  if (!passwordCheck.valid) {
    console.error(`❌ Insecure Password Error: ${passwordCheck.reason}`);
    console.error('Please configure a strong ADMIN_PASSWORD in your production environment variables.');
    process.exit(1);
  }

  // Hash password with bcrypt cost factor 12
  const passwordHash = await bcrypt.hash(rawPassword, 12);
  const nameParts = fullName.split(' ');
  const firstName = nameParts[0] || 'Admin';
  const lastName = nameParts.slice(1).join(' ') || 'User';

  const newAdmin = await prisma.user.create({
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

  console.log('✅ Administrator account created successfully:');
  console.log(`   - User ID  : ${newAdmin.id}`);
  console.log(`   - Login ID : ${newAdmin.loginId}`);
  console.log(`   - Email    : ${newAdmin.email}`);
  console.log(`   - Name     : ${newAdmin.firstName} ${newAdmin.lastName}`);
  console.log(`   - Role     : ${newAdmin.role}`);
  console.log('🔒 Security Note: Password securely stored as bcrypt hash; zero secrets exposed.\n');
}

bootstrapAdmin()
  .catch((err) => {
    console.error('❌ Unexpected error during admin bootstrap:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
