import crypto from 'crypto';

function randomChars(length: number): string {
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'; // No ambiguous 0, 1, I, O
  let result = '';
  const bytes = crypto.randomBytes(length);
  for (let i = 0; i < length; i++) {
    result += chars[bytes[i] % chars.length];
  }
  return result;
}

export function generateStudentCode(): string {
  return `STU-${randomChars(4)}`;
}

export function generateParentCode(): string {
  return `PAR-${randomChars(4)}`;
}

export function generateAdminCode(): string {
  return `ADM-${randomChars(4)}`;
}

export function generateAnonymousCode(): string {
  return `CODE-${randomChars(4)}`;
}

export function generateRegistrationCode(): string {
  return `REG-${randomChars(5)}`;
}
