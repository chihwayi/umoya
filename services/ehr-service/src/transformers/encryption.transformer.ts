import { ValueTransformer } from 'typeorm';
import * as crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const KEY_HEX = process.env.ENCRYPTION_KEY || '';
const KEY = KEY_HEX ? Buffer.from(KEY_HEX, 'hex') : null;
const KEY_LENGTH = 32; // 256-bit

if (KEY && KEY.length !== KEY_LENGTH && process.env.NODE_ENV === 'production') {
  throw new Error('ENCRYPTION_KEY must be a 64-character hex string (32 bytes)');
}

export function encrypt(text: string): string {
  if (!text || !KEY || KEY.length !== KEY_LENGTH) return text;
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, KEY, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

export function decrypt(text: string): string {
  if (!text || !text.includes(':') || !KEY || KEY.length !== KEY_LENGTH) return text;
  const parts = text.split(':');
  if (parts.length < 3) return text;
  const [ivHex, authTagHex, ...encParts] = parts;
  const encrypted = encParts.join(':');
  try {
    const decipher = crypto.createDecipheriv(ALGORITHM, KEY, Buffer.from(ivHex, 'hex'));
    decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch {
    return text;
  }
}

export const encryptionTransformer: ValueTransformer = {
  to: (value: string | null) => (value ? encrypt(value) : value),
  from: (value: string | null) => (value ? decrypt(value) : value),
};
