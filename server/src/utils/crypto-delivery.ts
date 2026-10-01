import crypto from 'node:crypto';
import { env } from '../config/env.js';

// Dedicated 32-byte key derived from DELIVERY_ENCRYPTION_KEY (strictly separate from JWT_SECRET)
function getEncryptionKey(): Buffer {
  const rawKey = env.DELIVERY_ENCRYPTION_KEY;
  if (/^[0-9a-fA-F]{64}$/.test(rawKey)) {
    return Buffer.from(rawKey, 'hex');
  }
  return crypto.createHash('sha256').update(rawKey).digest();
}

/**
 * Encrypts a sensitive delivery secret (such as an OTP or reset token)
 * using AES-256-GCM authenticated encryption before storing in PostgreSQL.
 * Format: `<iv_hex>:<authTag_hex>:<ciphertext_hex>`
 */
export function encryptDeliverySecret(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(12); // Standard 12-byte IV for GCM
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');

  return `${iv.toString('hex')}:${authTag}:${encrypted}`;
}

/**
 * Decrypts a delivery secret encrypted with AES-256-GCM.
 * Returns null if decryption fails or authentication tag is invalid.
 */
export function decryptDeliverySecret(payload: string): string | null {
  try {
    const parts = payload.split(':');
    if (parts.length !== 3) {
      return null;
    }

    const [ivHex, authTagHex, ciphertextHex] = parts;
    const key = getEncryptionKey();
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');

    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(ciphertextHex, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  } catch (err) {
    return null;
  }
}

export const decryptForDelivery = decryptDeliverySecret;
