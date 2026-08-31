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
  ResendAdminOtpInput
} from './auth.schema.js';
import { createAuditLog } from '../audit/audit.service.js';
import { emailService } from '../../services/email/email.service.js';
import { AuthTokenType, Role } from '@prisma/client';
import { env } from '../../config/env.js';

function maskEmail(email?: string | null): string {
  if (!email) return 'your registered email';
  const parts = email.split('@');
  if (parts.length !== 2) return email;
  const name = parts[0];
  const domain = parts[1];
  const maskedName = name.length <= 2 ? `${name[0]}***` : `${name[0]}***${name[name.length - 1]}`;
  return `${maskedName}@${domain}`;
}

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

  // 1. ADMIN 2FA FLOW: If user is ADMIN, require Email OTP verification
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

        if (timeSinceCreation < cooldownMs) {
          return { reuse: true, record: existingChallenge, rawOtp: isTest ? '123456' : undefined };
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
        devOtp: isTest ? '123456' : undefined
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

  // 2. STUDENT & PARENT LOGIN FLOW (Direct Session)
  const payload: TokenPayload = {
    userId: user.id,
    loginId: user.loginId,
    role: user.role,
    studentId: user.student?.id,
    parentId: user.parent?.id
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
    role: user.role
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
    parentId: tokenRecord.user.parent?.id
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
    student: user.student,
    parent: user.parent
  };
}
