import jwt from 'jsonwebtoken';
import { env } from '../../config/env.js';
import { Role } from '@prisma/client';
import { UnauthorizedError } from '../errors/app-error.js';

export interface TokenPayload {
  userId: string;
  loginId: string;
  role: Role;
  studentId?: string;
  parentId?: string;
}

export function signAccessToken(payload: TokenPayload): string {
  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN as any
  });
}

export function signRefreshToken(payload: TokenPayload): string {
  return jwt.sign(payload, env.JWT_REFRESH_SECRET, {
    expiresIn: env.JWT_REFRESH_EXPIRES_IN as any
  });
}

export function verifyAccessToken(token: string): TokenPayload {
  try {
    return jwt.verify(token, env.JWT_SECRET) as TokenPayload;
  } catch (err) {
    throw new UnauthorizedError('Invalid or expired access token');
  }
}

export interface Temp2FAPayload {
  userId: string;
  role: Role;
  purpose: 'ADMIN_2FA';
  otpId?: string;
}

export function sign2FATempToken(userId: string, role: Role, otpId?: string): string {
  const payload: Temp2FAPayload = { userId, role, purpose: 'ADMIN_2FA', otpId };
  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: '5m'
  });
}

export function verify2FATempToken(token: string): Temp2FAPayload {
  try {
    const decoded = jwt.verify(token, env.JWT_SECRET) as Temp2FAPayload;
    if (decoded.purpose !== 'ADMIN_2FA') {
      throw new UnauthorizedError('Invalid 2FA token');
    }
    return decoded;
  } catch {
    throw new UnauthorizedError('Invalid or expired 2FA session. Please log in again.');
  }
}
