import { prisma } from '../../db/prisma.js';
import {
  hashPassword,
  verifyPassword,
  hashToken,
  generateRandomToken,
  generateNumericOtp
} from '../../common/utils/crypto.js';
import {
  signAccessToken,
  sign2FATempToken,
  verify2FATempToken,
  TokenPayload
} from '../../common/utils/jwt.js';
import {
  BadRequestError,
  NotFoundError,
  UnauthorizedError
} from '../../common/errors/app-error.js';
import {
  ChangePasswordInput,
  LoginInput,
  ResetPasswordInput,
  SetupPasswordInput,
  VerifyAdminOtpInput,
  ResendAdminOtpInput,
  RegisterStudentInput,
  VerifyEmailInput,
  ResendVerificationInput,
  SelectLearningModeInput
} from './auth.schema.js';
import {
  generateStudentCode,
  generateAnonymousCode
} from '../../common/utils/code-gen.js';
import { createAuditLog } from '../audit/audit.service.js';
import { emailService } from '../../services/email/email.service.js';
import { AuthTokenType, Difficulty, Role, SubscriptionStatus } from '@prisma/client';
import { env } from '../../config/env.js';
import { getPlanForGrade } from '../billing/billing.service.js';

function maskEmail(email?: string | null): string {
  if (!email) return 'your registered email';
  const parts = email.split('@');
  if (parts.length !== 2) return email;
  const name = parts[0];
  const domain = parts[1];
  const maskedName = name.length <= 2 ? `${name[0]}***` : `${name[0]}***${name[name.length - 1]}`;
  return `${maskedName}@${domain}`;
}

const devOtpCache = new Map<string, string>();

export async function login(input: LoginInput) {
  const { loginId, password } = input;

  // Lookup by loginId OR email (case-insensitive for email, uppercase for loginId)
  const user = await prisma.user.findFirst({
    where: {
      OR: [
        { loginId: loginId.toUpperCase() },
        { loginId: loginId },
        { email: loginId.toLowerCase() }
      ]
    },
    include: {
      student: true,
      parent: true
    }
  });

  if (!user) {
    throw new UnauthorizedError('Invalid credentials');
  }

  if (!user.isActive) {
    throw new UnauthorizedError('Account is disabled. Please contact the administrator.');
  }

  const isValidPassword = await verifyPassword(password, user.passwordHash);
  if (!isValidPassword) {
    await createAuditLog({
      actorUserId: user.id,
      action: 'LOGIN_FAILED',
      entityType: 'User',
      entityId: user.id,
      metadata: { loginId }
    });
    throw new UnauthorizedError('Invalid credentials');
  }

  // 1. Check email verification: Unverified users must verify email before normal session is issued
  if (!user.isEmailVerified && user.role === Role.STUDENT) {
    return {
      requiresVerification: true,
      requires2FA: false,
      userId: user.id,
      emailMasked: maskEmail(user.email)
    };
  }

  // 2. ADMIN 2FA FLOW: If user is ADMIN, require Email OTP verification
  if (user.role === Role.ADMIN) {
    const now = new Date();
    const recipientEmail = user.email || env.ADMIN_EMAIL || 'admin@codek.local';
    const adminName = `${user.firstName} ${user.lastName}`.trim();
    const isTest = env.NODE_ENV === 'test';

    // Execute check and challenge creation inside an interactive Prisma transaction to prevent race conditions
    const tokenResult = await prisma.$transaction(async (tx) => {
      // Lock user record for update to prevent concurrent race conditions
      await tx.$executeRaw`SELECT id FROM "User" WHERE id = ${user.id} FOR UPDATE`;

      // Find any existing active, unexpired, pending OTP challenge for this user
      const existingChallenge = await tx.authToken.findFirst({
        where: {
          userId: user.id,
          type: AuthTokenType.ADMIN_LOGIN_OTP,
          status: 'PENDING',
          expiresAt: { gt: now }
        },
        orderBy: { createdAt: 'desc' }
      });

      if (existingChallenge) {
        const cooldownMs = 30 * 1000;
        const timeSinceCreation = now.getTime() - existingChallenge.createdAt.getTime();

        if (timeSinceCreation < cooldownMs && (!isTest || devOtpCache.has(existingChallenge.id))) {
          return { reuse: true, record: existingChallenge };
        } else {
          await tx.authToken.updateMany({
            where: {
              userId: user.id,
              type: AuthTokenType.ADMIN_LOGIN_OTP,
              status: 'PENDING'
            },
            data: { status: 'INVALIDATED' }
          });
        }
      }

      await tx.authToken.updateMany({
        where: {
          userId: user.id,
          type: AuthTokenType.ADMIN_LOGIN_OTP,
          expiresAt: { lt: now },
          status: 'PENDING'
        },
        data: { status: 'EXPIRED' }
      });

      const rawOtp = generateNumericOtp(6);
      const hashedOtp = hashToken(rawOtp);
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

      const newRecord = await tx.authToken.create({
        data: {
          userId: user.id,
          tokenHash: hashedOtp,
          type: AuthTokenType.ADMIN_LOGIN_OTP,
          status: 'PENDING',
          expiresAt,
          attempts: 0
        }
      });

      devOtpCache.set(newRecord.id, rawOtp);

      return { reuse: false, record: newRecord, rawOtp };
    });

    if (tokenResult.reuse) {
      await createAuditLog({
        actorUserId: user.id,
        action: 'OTP_RESEND_BLOCKED',
        entityType: 'User',
        entityId: user.id,
        metadata: { reason: 'COOLDOWN_ACTIVE', challengeId: tokenResult.record.id }
      });

      const tempToken = sign2FATempToken(user.id, user.role, tokenResult.record.id);
      return {
        requires2FA: true,
        tempToken,
        emailMasked: maskEmail(recipientEmail),
        devOtp: isTest ? devOtpCache.get(tokenResult.record.id) : undefined
      };
    }

    const tempToken = sign2FATempToken(user.id, user.role, tokenResult.record.id);

    // Send OTP via Email Service
    await emailService.sendAdminLoginOtp(recipientEmail, tokenResult.rawOtp!, adminName);

    await createAuditLog({
      actorUserId: user.id,
      action: 'OTP_REQUESTED',
      entityType: 'User',
      entityId: user.id,
      metadata: { email: maskEmail(recipientEmail), challengeId: tokenResult.record.id }
    });

    await createAuditLog({
      actorUserId: user.id,
      action: 'OTP_EMAIL_SENT',
      entityType: 'User',
      entityId: user.id,
      metadata: { email: maskEmail(recipientEmail), challengeId: tokenResult.record.id }
    });

    return {
      requires2FA: true,
      tempToken,
      emailMasked: maskEmail(recipientEmail),
      devOtp: isTest ? tokenResult.rawOtp : undefined
    };
  }

  // 3. STUDENT & PARENT LOGIN FLOW (Direct Session)
  const payload: TokenPayload = {
    userId: user.id,
    loginId: user.loginId,
    role: user.role,
    studentId: user.student?.id,
    parentId: user.parent?.id,
    isEmailVerified: user.isEmailVerified
  };

  const accessToken = signAccessToken(payload);
  const rawRefreshToken = generateRandomToken(32);
  const hashedRefreshToken = hashToken(rawRefreshToken);

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 30); // 30 days persistent session

  await prisma.refreshToken.create({
    data: {
      tokenHash: hashedRefreshToken,
      userId: user.id,
      expiresAt
    }
  });

  await createAuditLog({
    actorUserId: user.id,
    action: 'LOGIN_SUCCESS',
    entityType: 'User',
    entityId: user.id,
    metadata: { role: user.role, loginId: user.loginId }
  });

  return {
    requires2FA: false,
    user: {
      id: user.id,
      loginId: user.loginId,
      role: user.role,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      phone: user.phone,
      avatarUrl: user.avatarUrl,
      mustChangePassword: user.mustChangePassword,
      isEmailVerified: user.isEmailVerified,
      student: user.student,
      parent: user.parent
    },
    accessToken,
    refreshToken: rawRefreshToken,
    mustChangePassword: user.mustChangePassword
  };
}

export async function verifyAdminOtp(input: VerifyAdminOtpInput) {
  const { tempToken, otpCode } = input;

  // 1. Verify 2FA temp token
  const decoded = verify2FATempToken(tempToken);

  if (decoded.role !== Role.ADMIN) {
    throw new UnauthorizedError('Unauthorized 2FA verification');
  }

  const now = new Date();

  // 2. Find active OTP token record
  const tokenRecord = decoded.otpId
    ? await prisma.authToken.findUnique({
        where: { id: decoded.otpId },
        include: {
          user: {
            include: {
              student: true,
              parent: true
            }
          }
        }
      })
    : await prisma.authToken.findFirst({
        where: {
          userId: decoded.userId,
          type: AuthTokenType.ADMIN_LOGIN_OTP,
          status: 'PENDING'
        },
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            include: {
              student: true,
              parent: true
            }
          }
        }
      });

  if (!tokenRecord || tokenRecord.status !== 'PENDING' || tokenRecord.usedAt !== null) {
    await createAuditLog({
      actorUserId: decoded.userId,
      action: 'OTP_REJECTED',
      entityType: 'User',
      entityId: decoded.userId,
      metadata: { reason: 'INVALID_OR_EXPIRED_SESSION' }
    });
    throw new BadRequestError('Invalid or expired verification session. Please log in again.');
  }

  // 3. Check expiration
  if (tokenRecord.expiresAt < now) {
    await prisma.authToken.updateMany({
      where: { id: tokenRecord.id },
      data: { status: 'EXPIRED' }
    });
    await createAuditLog({
      actorUserId: decoded.userId,
      action: 'OTP_EXPIRED',
      entityType: 'User',
      entityId: decoded.userId,
      metadata: { challengeId: tokenRecord.id }
    });
    throw new BadRequestError('Verification code has expired. Please request a new code.');
  }

  // 4. Check max attempts brute-force protection (Max 5 attempts)
  if (tokenRecord.attempts >= 5) {
    await prisma.authToken.updateMany({
      where: { id: tokenRecord.id },
      data: { status: 'INVALIDATED' }
    });
    await createAuditLog({
      actorUserId: decoded.userId,
      action: 'OTP_REJECTED',
      entityType: 'User',
      entityId: decoded.userId,
      metadata: { reason: 'TOO_MANY_ATTEMPTS', challengeId: tokenRecord.id }
    });
    throw new BadRequestError('Too many failed attempts. Verification code has been invalidated. Please log in again.');
  }

  // 5. Verify hashed OTP
  const hashedInput = hashToken(otpCode.trim());
  if (hashedInput !== tokenRecord.tokenHash) {
    await prisma.authToken.updateMany({
      where: { id: tokenRecord.id },
      data: { attempts: { increment: 1 } }
    });

    const attemptsCount = tokenRecord.attempts + 1;
    if (attemptsCount >= 5) {
      await prisma.authToken.updateMany({
        where: { id: tokenRecord.id },
        data: { status: 'INVALIDATED' }
      });
    }

    await createAuditLog({
      actorUserId: decoded.userId,
      action: 'OTP_REJECTED',
      entityType: 'User',
      entityId: decoded.userId,
      metadata: { attempts: attemptsCount, challengeId: tokenRecord.id }
    });

    const remaining = 5 - attemptsCount;
    throw new BadRequestError(
      remaining > 0
        ? `Invalid verification code. ${remaining} attempt(s) remaining.`
        : 'Too many failed attempts. Verification code has been invalidated.'
    );
  }

  // 6. Mark OTP as VERIFIED
  await prisma.authToken.updateMany({
    where: { id: tokenRecord.id },
    data: {
      status: 'VERIFIED',
      usedAt: now
    }
  });

  const user = tokenRecord.user;

  await createAuditLog({
    actorUserId: user.id,
    action: 'OTP_VERIFIED',
    entityType: 'User',
    entityId: user.id,
    metadata: { challengeId: tokenRecord.id }
  });

  // 7. Issue authenticated session tokens
  const payload: TokenPayload = {
    userId: user.id,
    loginId: user.loginId,
    role: user.role,
    isEmailVerified: user.isEmailVerified
  };

  const accessToken = signAccessToken(payload);
  const rawRefreshToken = generateRandomToken(32);
  const hashedRefreshToken = hashToken(rawRefreshToken);

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 30); // 30 days

  await prisma.refreshToken.create({
    data: {
      tokenHash: hashedRefreshToken,
      userId: user.id,
      expiresAt
    }
  });

  await createAuditLog({
    actorUserId: user.id,
    action: 'ADMIN_2FA_SUCCESS',
    entityType: 'User',
    entityId: user.id,
    metadata: { role: user.role, loginId: user.loginId }
  });

  await createAuditLog({
    actorUserId: user.id,
    action: 'LOGIN_SUCCESS',
    entityType: 'User',
    entityId: user.id,
    metadata: { role: user.role, loginId: user.loginId }
  });

  return {
    user: {
      id: user.id,
      loginId: user.loginId,
      role: user.role,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      phone: user.phone,
      avatarUrl: user.avatarUrl,
      mustChangePassword: user.mustChangePassword,
      isEmailVerified: user.isEmailVerified,
      student: user.student,
      parent: user.parent
    },
    accessToken,
    refreshToken: rawRefreshToken,
    mustChangePassword: user.mustChangePassword
  };
}

export async function resendAdminOtp(input: ResendAdminOtpInput) {
  const { tempToken } = input;
  const decoded = verify2FATempToken(tempToken);

  const user = await prisma.user.findUnique({
    where: { id: decoded.userId }
  });

  if (!user || user.role !== Role.ADMIN) {
    throw new UnauthorizedError('Unauthorized');
  }

  const now = new Date();

  // Enforce 30-second cooldown between requests from latest creation
  const recentToken = await prisma.authToken.findFirst({
    where: {
      userId: user.id,
      type: AuthTokenType.ADMIN_LOGIN_OTP,
      status: 'PENDING',
      createdAt: { gt: new Date(now.getTime() - 30 * 1000) }
    }
  });

  if (recentToken) {
    await createAuditLog({
      actorUserId: user.id,
      action: 'OTP_RESEND_BLOCKED',
      entityType: 'User',
      entityId: user.id,
      metadata: { reason: 'COOLDOWN_ACTIVE', challengeId: recentToken.id }
    });
    throw new BadRequestError('Please wait a moment before requesting another verification code');
  }

  // Invalidate old pending OTPs
  await prisma.authToken.updateMany({
    where: {
      userId: user.id,
      type: AuthTokenType.ADMIN_LOGIN_OTP,
      status: 'PENDING'
    },
    data: { status: 'INVALIDATED' }
  });

  const rawOtp = generateNumericOtp(6);
  const hashedOtp = hashToken(rawOtp);
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

  const newRecord = await prisma.authToken.create({
    data: {
      userId: user.id,
      tokenHash: hashedOtp,
      type: AuthTokenType.ADMIN_LOGIN_OTP,
      status: 'PENDING',
      expiresAt,
      attempts: 0
    }
  });

  devOtpCache.set(newRecord.id, rawOtp);

  const recipientEmail = user.email || env.ADMIN_EMAIL || 'admin@codek.local';
  const adminName = `${user.firstName} ${user.lastName}`.trim();
  await emailService.sendAdminLoginOtp(recipientEmail, rawOtp, adminName);

  await createAuditLog({
    actorUserId: user.id,
    action: 'OTP_REQUESTED',
    entityType: 'User',
    entityId: user.id,
    metadata: { resend: true, email: maskEmail(recipientEmail), challengeId: newRecord.id }
  });

  await createAuditLog({
    actorUserId: user.id,
    action: 'OTP_EMAIL_SENT',
    entityType: 'User',
    entityId: user.id,
    metadata: { resend: true, email: maskEmail(recipientEmail), challengeId: newRecord.id }
  });

  const newTempToken = sign2FATempToken(user.id, user.role, newRecord.id);
  const isTest = env.NODE_ENV === 'test';

  return {
    success: true,
    tempToken: newTempToken,
    emailMasked: maskEmail(recipientEmail),
    devOtp: isTest ? rawOtp : undefined
  };
}

export async function refresh(rawRefreshToken: string) {
  const hashedToken = hashToken(rawRefreshToken);

  const tokenRecord = await prisma.refreshToken.findUnique({
    where: { tokenHash: hashedToken },
    include: {
      user: {
        include: {
          student: true,
          parent: true
        }
      }
    }
  });

  if (!tokenRecord) {
    throw new UnauthorizedError('Invalid or expired refresh token');
  }

  if (tokenRecord.expiresAt < new Date()) {
    await prisma.refreshToken.delete({ where: { id: tokenRecord.id } });
    throw new UnauthorizedError('Refresh token expired');
  }

  // Reject disabled/inactive users and revoke all refresh tokens for this user
  if (!tokenRecord.user || !tokenRecord.user.isActive) {
    await prisma.refreshToken.deleteMany({
      where: { userId: tokenRecord.userId }
    });
    throw new UnauthorizedError('Account is disabled');
  }

  // Reject unverified users
  if (!tokenRecord.user.isEmailVerified) {
    await prisma.refreshToken.deleteMany({
      where: { userId: tokenRecord.userId }
    });
    throw new UnauthorizedError('Account email is not verified');
  }

  // Invalidate old refresh token (Strict Token Rotation)
  await prisma.refreshToken.delete({
    where: { id: tokenRecord.id }
  });

  // Issue new token pair
  const payload: TokenPayload = {
    userId: tokenRecord.user.id,
    loginId: tokenRecord.user.loginId,
    role: tokenRecord.user.role,
    studentId: tokenRecord.user.student?.id,
    parentId: tokenRecord.user.parent?.id,
    isEmailVerified: tokenRecord.user.isEmailVerified
  };

  const newAccessToken = signAccessToken(payload);
  const newRawRefreshToken = generateRandomToken(32);
  const newHashedRefreshToken = hashToken(newRawRefreshToken);

  const newExpiresAt = new Date();
  newExpiresAt.setDate(newExpiresAt.getDate() + 30); // 30 days

  await prisma.refreshToken.create({
    data: {
      tokenHash: newHashedRefreshToken,
      userId: tokenRecord.userId,
      expiresAt: newExpiresAt
    }
  });

  await createAuditLog({
    actorUserId: tokenRecord.userId,
    action: 'REFRESH_TOKEN_ROTATED',
    entityType: 'User',
    entityId: tokenRecord.userId
  });

  return {
    accessToken: newAccessToken,
    refreshToken: newRawRefreshToken,
    user: {
      id: tokenRecord.user.id,
      loginId: tokenRecord.user.loginId,
      role: tokenRecord.user.role,
      firstName: tokenRecord.user.firstName,
      lastName: tokenRecord.user.lastName,
      email: tokenRecord.user.email,
      phone: tokenRecord.user.phone,
      avatarUrl: tokenRecord.user.avatarUrl,
      mustChangePassword: tokenRecord.user.mustChangePassword,
      student: tokenRecord.user.student,
      parent: tokenRecord.user.parent
    }
  };
}

export async function logout(rawRefreshToken?: string, userId?: string) {
  if (rawRefreshToken) {
    const hashedToken = hashToken(rawRefreshToken);
    await prisma.refreshToken.deleteMany({
      where: { tokenHash: hashedToken }
    });
  } else if (userId) {
    await prisma.refreshToken.deleteMany({
      where: { userId }
    });
  }

  if (userId) {
    await createAuditLog({
      actorUserId: userId,
      action: 'LOGOUT',
      entityType: 'User',
      entityId: userId
    });
  }

  return { success: true };
}

export async function changePassword(userId: string, input: ChangePasswordInput) {
  const user = await prisma.user.findUnique({
    where: { id: userId }
  });

  if (!user) {
    throw new NotFoundError('User not found');
  }

  const isValid = await verifyPassword(input.currentPassword, user.passwordHash);
  if (!isValid) {
    throw new BadRequestError('Current password is incorrect');
  }

  const newPasswordHash = await hashPassword(input.newPassword);

  await prisma.user.update({
    where: { id: userId },
    data: {
      passwordHash: newPasswordHash,
      mustChangePassword: false
    }
  });

  await createAuditLog({
    actorUserId: userId,
    action: 'PASSWORD_CHANGED',
    entityType: 'User',
    entityId: userId
  });

  return { success: true, message: 'Password changed successfully' };
}

export async function setupPassword(input: SetupPasswordInput) {
  const hashed = hashToken(input.token);

  const authToken = await prisma.authToken.findFirst({
    where: {
      tokenHash: hashed,
      type: AuthTokenType.PARENT_INVITE,
      usedAt: null,
      expiresAt: { gt: new Date() }
    },
    include: {
      user: {
        include: {
          student: true,
          parent: true
        }
      }
    }
  });

  if (!authToken) {
    throw new BadRequestError('Invalid or expired setup token');
  }

  const newHash = await hashPassword(input.newPassword);

  await prisma.$transaction([
    prisma.user.update({
      where: { id: authToken.userId },
      data: {
        passwordHash: newHash,
        mustChangePassword: false
      }
    }),
    prisma.authToken.update({
      where: { id: authToken.id },
      data: { usedAt: new Date() }
    })
  ]);

  await createAuditLog({
    actorUserId: authToken.userId,
    action: 'ACCOUNT_ACTIVATED',
    entityType: 'User',
    entityId: authToken.userId
  });

  const payload: TokenPayload = {
    userId: authToken.user.id,
    loginId: authToken.user.loginId,
    role: authToken.user.role,
    studentId: authToken.user.student?.id,
    parentId: authToken.user.parent?.id
  };

  const accessToken = signAccessToken(payload);
  const rawRefreshToken = generateRandomToken(32);
  const hashedRefreshToken = hashToken(rawRefreshToken);

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 30);

  await prisma.refreshToken.create({
    data: {
      tokenHash: hashedRefreshToken,
      userId: authToken.userId,
      expiresAt
    }
  });

  return {
    user: {
      id: authToken.user.id,
      loginId: authToken.user.loginId,
      role: authToken.user.role,
      firstName: authToken.user.firstName,
      lastName: authToken.user.lastName,
      student: authToken.user.student,
      parent: authToken.user.parent
    },
    accessToken,
    refreshToken: rawRefreshToken
  };
}

export async function resetPassword(input: ResetPasswordInput) {
  const hashed = hashToken(input.token);

  const authToken = await prisma.authToken.findFirst({
    where: {
      tokenHash: hashed,
      type: AuthTokenType.PASSWORD_RESET,
      usedAt: null,
      expiresAt: { gt: new Date() }
    }
  });

  if (!authToken) {
    throw new BadRequestError('Invalid or expired password reset link');
  }

  const newHash = await hashPassword(input.newPassword);

  await prisma.$transaction([
    prisma.user.update({
      where: { id: authToken.userId },
      data: {
        passwordHash: newHash,
        mustChangePassword: false
      }
    }),
    prisma.authToken.update({
      where: { id: authToken.id },
      data: { usedAt: new Date() }
    }),
    // Invalidate existing refresh tokens on password reset
    prisma.refreshToken.deleteMany({
      where: { userId: authToken.userId }
    })
  ]);

  await createAuditLog({
    actorUserId: authToken.userId,
    action: 'PASSWORD_RESET',
    entityType: 'User',
    entityId: authToken.userId
  });

  return { success: true, message: 'Password reset successfully' };
}

export async function getMe(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      student: {
        include: {
          enrollments: {
            where: { isActive: true },
            include: { group: true }
          }
        }
      },
      parent: {
        include: {
          children: {
            include: {
              student: {
                include: {
                  user: {
                    select: {
                      id: true,
                      firstName: true,
                      lastName: true,
                      avatarUrl: true
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  });

  if (!user) {
    throw new NotFoundError('User not found');
  }

  return {
    id: user.id,
    loginId: user.loginId,
    role: user.role,
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    phone: user.phone,
    avatarUrl: user.avatarUrl,
    mustChangePassword: user.mustChangePassword,
    isEmailVerified: user.isEmailVerified,
    student: user.student,
    parent: user.parent
  };
}

// ─────────────────────────────────────────────────────────
// SELF-SERVICE: Register Student Account
// ─────────────────────────────────────────────────────────

export async function registerStudent(input: RegisterStudentInput) {
  // 1. Honeypot check for spam bots
  if (input.website && input.website.trim().length > 0) {
    throw new BadRequestError('Invalid registration submission');
  }

  const normalizedEmail = input.email.toLowerCase().trim();
  const normalizedPhone = input.phone && input.phone.trim().length > 0 ? input.phone.trim() : null;

  // 2. Pre-checks for duplicates
  const existingEmail = await prisma.user.findFirst({
    where: { email: normalizedEmail }
  });
  if (existingEmail) {
    throw new BadRequestError('An account with this email already exists');
  }

  if (normalizedPhone) {
    const existingPhone = await prisma.user.findFirst({
      where: { phone: normalizedPhone }
    });
    if (existingPhone) {
      throw new BadRequestError('An account with this phone number already exists');
    }
  }

  // 3. Secure password hashing
  const passwordHash = await hashPassword(input.password);

  // 4. Atomic database creation
  try {
    const { user, student, rawOtp, otpId } = await prisma.$transaction(async (tx) => {
      // Generate unique login ID (STU-XXXX)
      let loginId = generateStudentCode();
      while (await tx.user.findUnique({ where: { loginId } })) {
        loginId = generateStudentCode();
      }

      // Generate unique anonymous leaderboard code (CODE-XXXX)
      let anonymousCode = generateAnonymousCode();
      while (await tx.student.findFirst({ where: { anonymousLeaderboardCode: anonymousCode } })) {
        anonymousCode = generateAnonymousCode();
      }

      // Create User (Role strictly STUDENT, mustChangePassword = false, isEmailVerified = false)
      const newUser = await tx.user.create({
        data: {
          loginId,
          passwordHash,
          mustChangePassword: false,
          isEmailVerified: false,
          email: normalizedEmail,
          phone: normalizedPhone,
          role: Role.STUDENT,
          firstName: input.firstName.trim(),
          lastName: input.lastName.trim(),
          isActive: true
        }
      });

      // Create Student (attendanceRequired = false, learningModeSelected = false, grade stored)
      const newStudent = await tx.student.create({
        data: {
          userId: newUser.id,
          studentCode: loginId,
          anonymousLeaderboardCode: anonymousCode,
          grade: input.grade || null,
          programmingLevel: input.programmingLevel || Difficulty.BEGINNER,
          attendanceRequired: false,
          learningModeSelected: false,
          totalXp: 0,
          currentStreak: 0
        }
      });

      // Generate verification OTP (6 digits, 10 min validity)
      const rawOtp = generateNumericOtp(6);
      const hashedOtp = hashToken(rawOtp);
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

      const otpRecord = await tx.authToken.create({
        data: {
          userId: newUser.id,
          tokenHash: hashedOtp,
          type: AuthTokenType.EMAIL_VERIFICATION,
          status: 'PENDING',
          expiresAt,
          attempts: 0
        }
      });

      return { user: newUser, student: newStudent, rawOtp, otpId: otpRecord.id };
    });

    devOtpCache.set(user.id, rawOtp);
    devOtpCache.set(otpId, rawOtp);

    // Send verification email via EmailService
    if (user.email) {
      await emailService.sendEmailVerificationOtp(user.email, rawOtp, user.firstName);
    }

    // Resolve active subscription plan & price from the selected grade (server-authoritative)
    let assignedPlan: {
      id: string;
      code: string;
      name: string;
      price: number;
      currency: string;
      billingInterval: string;
      grade?: string;
    } | null = null;

    if (input.grade) {
      const plan = await getPlanForGrade(input.grade);
      if (plan) {
        assignedPlan = {
          id: plan.id,
          code: plan.code,
          name: plan.name,
          price: plan.price,
          currency: plan.currency,
          billingInterval: plan.billingInterval,
          grade: input.grade
        };

        // Create initial subscription record permanently locking historical pricing in metadata
        const now = new Date();
        const periodEnd = new Date();
        periodEnd.setDate(periodEnd.getDate() + 30);

        await prisma.subscription.create({
          data: {
            studentId: student.id,
            planId: plan.id,
            status: SubscriptionStatus.ACTIVE,
            currentPeriodStart: now,
            currentPeriodEnd: periodEnd,
            metadata: {
              grade: input.grade,
              assignedPrice: plan.price,
              assignedCurrency: plan.currency,
              assignedAt: now.toISOString()
            }
          }
        });
      }
    }

    // Audit Logs
    await createAuditLog({
      actorUserId: user.id,
      action: 'STUDENT_SELF_REGISTERED',
      entityType: 'User',
      entityId: user.id,
      metadata: {
        loginId: user.loginId,
        email: user.email,
        studentId: student.id,
        grade: student.grade,
        assignedPlanCode: assignedPlan?.code,
        assignedPrice: assignedPlan?.price,
        programmingLevel: student.programmingLevel,
        attendanceRequired: student.attendanceRequired,
        learningModeSelected: student.learningModeSelected
      }
    });

    await createAuditLog({
      actorUserId: user.id,
      action: 'OTP_REQUESTED',
      entityType: 'User',
      entityId: user.id,
      metadata: {
        type: 'EMAIL_VERIFICATION',
        email: maskEmail(user.email),
        challengeId: otpId
      }
    });

    // Create persistent refresh token session matching login
    const rawRefreshToken = generateRandomToken(32);
    const hashedRefreshToken = hashToken(rawRefreshToken);
    const refreshExpiresAt = new Date();
    refreshExpiresAt.setDate(refreshExpiresAt.getDate() + 30); // 30 days persistent session

    await prisma.refreshToken.create({
      data: {
        tokenHash: hashedRefreshToken,
        userId: user.id,
        expiresAt: refreshExpiresAt
      }
    });

    const isTest = env.NODE_ENV === 'test';
    const isDev = env.NODE_ENV === 'development';

    return {
      requiresVerification: true,
      userId: user.id,
      refreshToken: rawRefreshToken,
      emailMasked: maskEmail(user.email),
      devOtp: (isTest || isDev) ? rawOtp : undefined,
      assignedPlan: assignedPlan || undefined,
      user: {
        id: user.id,
        loginId: user.loginId,
        role: user.role,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        phone: user.phone,
        avatarUrl: user.avatarUrl,
        mustChangePassword: user.mustChangePassword,
        isEmailVerified: user.isEmailVerified,
        student: {
          id: student.id,
          studentCode: student.studentCode,
          grade: student.grade,
          programmingLevel: student.programmingLevel,
          attendanceRequired: student.attendanceRequired,
          learningModeSelected: student.learningModeSelected,
          totalXp: student.totalXp,
          currentStreak: student.currentStreak
        }
      }
    };
  } catch (error: any) {
    if (error?.code === 'P2002') {
      const target = error?.meta?.target;
      if (Array.isArray(target) && target.includes('email')) {
        throw new BadRequestError('An account with this email already exists');
      }
      if (Array.isArray(target) && target.includes('loginId')) {
        throw new BadRequestError('Account identifier conflict. Please try again.');
      }
      throw new BadRequestError('An account with these details already exists');
    }
    throw error;
  }
}

// ─────────────────────────────────────────────────────────
// EMAIL VERIFICATION: Verify OTP & Issue Session
// ─────────────────────────────────────────────────────────

export async function verifyEmail(input: VerifyEmailInput) {
  const user = await prisma.user.findUnique({
    where: { id: input.userId },
    include: {
      student: true,
      parent: true
    }
  });

  if (!user) {
    throw new BadRequestError('Invalid or expired verification code');
  }

  if (user.isEmailVerified) {
    throw new BadRequestError('Email is already verified. Please log in.');
  }

  const now = new Date();

  // Find the latest active EMAIL_VERIFICATION challenge for this user
  const tokenRecord = await prisma.authToken.findFirst({
    where: {
      userId: user.id,
      type: AuthTokenType.EMAIL_VERIFICATION,
      status: 'PENDING'
    },
    orderBy: { createdAt: 'desc' }
  });

  if (!tokenRecord || tokenRecord.usedAt !== null) {
    throw new BadRequestError('Invalid or expired verification code');
  }

  // Check expiration (10 minutes)
  if (tokenRecord.expiresAt < now) {
    await prisma.authToken.updateMany({
      where: { id: tokenRecord.id },
      data: { status: 'EXPIRED' }
    });
    throw new BadRequestError('Verification code has expired. Please request a new code.');
  }

  // Check max attempts brute-force protection (Max 5 attempts)
  if (tokenRecord.attempts >= 5) {
    await prisma.authToken.updateMany({
      where: { id: tokenRecord.id },
      data: { status: 'INVALIDATED' }
    });
    throw new BadRequestError('Too many failed attempts. Verification code has been invalidated. Please request a new code.');
  }

  // Verify hashed OTP
  const hashedInput = hashToken(input.otpCode.trim());
  if (hashedInput !== tokenRecord.tokenHash) {
    const attemptsCount = tokenRecord.attempts + 1;
    await prisma.authToken.updateMany({
      where: { id: tokenRecord.id },
      data: {
        attempts: { increment: 1 },
        status: attemptsCount >= 5 ? 'INVALIDATED' : 'PENDING'
      }
    });

    const remaining = 5 - attemptsCount;
    throw new BadRequestError(
      remaining > 0
        ? `Invalid verification code. ${remaining} attempt(s) remaining.`
        : 'Too many failed attempts. Verification code has been invalidated. Please request a new code.'
    );
  }

  // Atomic state transition
  const rawRefreshToken = generateRandomToken(32);
  const hashedRefreshToken = hashToken(rawRefreshToken);
  const refreshExpiresAt = new Date();
  refreshExpiresAt.setDate(refreshExpiresAt.getDate() + 30); // 30 days

  await prisma.$transaction(async (tx) => {
    // 1. Mark this token as VERIFIED and used
    await tx.authToken.update({
      where: { id: tokenRecord.id },
      data: {
        status: 'VERIFIED',
        usedAt: now
      }
    });

    // 2. Atomically set User.isEmailVerified = true
    await tx.user.update({
      where: { id: user.id },
      data: { isEmailVerified: true }
    });

    // 3. Invalidate any other pending verification tokens for this user
    await tx.authToken.updateMany({
      where: {
        userId: user.id,
        type: AuthTokenType.EMAIL_VERIFICATION,
        status: 'PENDING',
        id: { not: tokenRecord.id }
      },
      data: { status: 'INVALIDATED' }
    });

    // 4. Create authenticated refresh token session
    await tx.refreshToken.create({
      data: {
        tokenHash: hashedRefreshToken,
        userId: user.id,
        expiresAt: refreshExpiresAt
      }
    });
  });

  await createAuditLog({
    actorUserId: user.id,
    action: 'EMAIL_VERIFIED',
    entityType: 'User',
    entityId: user.id,
    metadata: { challengeId: tokenRecord.id, email: user.email }
  });

  await createAuditLog({
    actorUserId: user.id,
    action: 'LOGIN_SUCCESS',
    entityType: 'User',
    entityId: user.id,
    metadata: { role: user.role, loginId: user.loginId, context: 'POST_VERIFICATION' }
  });

  const payload: TokenPayload = {
    userId: user.id,
    loginId: user.loginId,
    role: user.role,
    studentId: user.student?.id,
    parentId: user.parent?.id,
    isEmailVerified: true
  };

  const accessToken = signAccessToken(payload);

  return {
    user: {
      id: user.id,
      loginId: user.loginId,
      role: user.role,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      phone: user.phone,
      avatarUrl: user.avatarUrl,
      mustChangePassword: user.mustChangePassword,
      isEmailVerified: true,
      student: user.student,
      parent: user.parent
    },
    accessToken,
    refreshToken: rawRefreshToken
  };
}

// ─────────────────────────────────────────────────────────
// EMAIL VERIFICATION: Resend OTP (60s Cooldown)
// ─────────────────────────────────────────────────────────

export async function resendVerificationOtp(input: ResendVerificationInput) {
  const user = await prisma.user.findUnique({
    where: { id: input.userId }
  });

  if (!user) {
    return {
      success: true,
      message: 'If the account exists, a verification code has been sent.'
    };
  }

  if (user.isEmailVerified) {
    return {
      success: true,
      message: 'Email is already verified. Please log in.'
    };
  }

  const now = new Date();

  // Enforce 60-second cooldown between requests from latest creation
  const recentToken = await prisma.authToken.findFirst({
    where: {
      userId: user.id,
      type: AuthTokenType.EMAIL_VERIFICATION,
      createdAt: { gt: new Date(now.getTime() - 60 * 1000) }
    },
    orderBy: { createdAt: 'desc' }
  });

  if (recentToken) {
    const elapsedSeconds = Math.floor((now.getTime() - recentToken.createdAt.getTime()) / 1000);
    const remainingSeconds = Math.max(1, 60 - elapsedSeconds);
    throw new BadRequestError(`Please wait ${remainingSeconds} second(s) before requesting another verification code`);
  }

  // Invalidate old pending verification OTPs
  await prisma.authToken.updateMany({
    where: {
      userId: user.id,
      type: AuthTokenType.EMAIL_VERIFICATION,
      status: 'PENDING'
    },
    data: { status: 'INVALIDATED' }
  });

  const rawOtp = generateNumericOtp(6);
  const hashedOtp = hashToken(rawOtp);
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

  const newRecord = await prisma.authToken.create({
    data: {
      userId: user.id,
      tokenHash: hashedOtp,
      type: AuthTokenType.EMAIL_VERIFICATION,
      status: 'PENDING',
      expiresAt,
      attempts: 0
    }
  });

  devOtpCache.set(user.id, rawOtp);
  devOtpCache.set(newRecord.id, rawOtp);

  if (user.email) {
    await emailService.sendEmailVerificationOtp(user.email, rawOtp, user.firstName);
  }

  await createAuditLog({
    actorUserId: user.id,
    action: 'OTP_REQUESTED',
    entityType: 'User',
    entityId: user.id,
    metadata: { resend: true, type: 'EMAIL_VERIFICATION', email: maskEmail(user.email), challengeId: newRecord.id }
  });

  const isTest = env.NODE_ENV === 'test';
  const isDev = env.NODE_ENV === 'development';

  return {
    success: true,
    message: 'Verification code sent',
    emailMasked: maskEmail(user.email),
    devOtp: (isTest || isDev) ? rawOtp : undefined
  };
}

// ─────────────────────────────────────────────────────────
// LEARNING MODE: Select Mode (Online or Hybrid)
// ─────────────────────────────────────────────────────────

export async function selectLearningMode(userId: string, input: SelectLearningModeInput) {
  const student = await prisma.student.findUnique({
    where: { userId }
  });

  if (!student) {
    throw new NotFoundError('Student profile not found');
  }

  if (student.learningModeSelected) {
    throw new BadRequestError('Learning mode has already been selected. Please contact administration to request a change.');
  }

  const updatedStudent = await prisma.student.update({
    where: { id: student.id },
    data: {
      attendanceRequired: input.mode === 'HYBRID',
      learningModeSelected: true
    }
  });

  await createAuditLog({
    actorUserId: userId,
    action: 'STUDENT_LEARNING_MODE_SELECTED',
    entityType: 'Student',
    entityId: student.id,
    metadata: {
      mode: input.mode,
      attendanceRequired: updatedStudent.attendanceRequired
    }
  });

  return {
    success: true,
    mode: input.mode,
    learningModeSelected: updatedStudent.learningModeSelected,
    student: {
      id: updatedStudent.id,
      studentCode: updatedStudent.studentCode,
      attendanceRequired: updatedStudent.attendanceRequired,
      learningModeSelected: updatedStudent.learningModeSelected
    }
  };
}

