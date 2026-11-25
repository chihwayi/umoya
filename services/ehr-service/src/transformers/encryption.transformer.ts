import { ValueTransformer } from 'typeorm';
import * as crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const KEY_HEX = process.env.ENCRYPTION_KEY || '';
const KEY = KEY_HEX ? Buffer.from(KEY_HEX, 'hex') : null;
const KEY_LENGTH = 32; // 256-bit

function isNonDevEnv(): boolean {
  const env = (process.env.NODE_ENV || process.env.ENVIRONMENT || 'development').toLowerCase();
  return !['dev', 'development', 'local', 'test'].includes(env);
}

// R1/FX-002 (S-004): fail closed. Previously a missing key silently stored
// PLAINTEXT and a wrong-length key silently truncated. In any non-dev env the
// service must refuse to boot instead.
if (isNonDevEnv()) {
  if (!KEY_HEX) {
    throw new Error('ENCRYPTION_KEY is required in non-development environments (refusing to store plaintext)');
  }
  if (!KEY || KEY.length !== KEY_LENGTH || !/^[0-9a-fA-F]{64}$/.test(KEY_HEX)) {
    throw new Error('ENCRYPTION_KEY must be a 64-character hex string (32 bytes)');
  }
} else if (KEY && (KEY.length !== KEY_LENGTH || !/^[0-9a-fA-F]{64}$/.test(KEY_HEX))) {
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

/**
 * R1/FX-002 backfill triage: classify a stored value without a key.
 * - 'empty': NULL/'' (nothing stored)
 * - 'ciphertext-shape': iv:tag:ct hex with 32/32-char iv+tag (likely healthy)
 * - 'truncated': has colons but wrong shape (overflow cut or corruption)
 * - 'plaintext': no colons — stored unencrypted (missing-key era)
 */
export function classifyStoredValue(value: string | null | undefined): string {
  if (value === null || value === undefined || value === '') return 'empty';
  if (!value.includes(':')) return 'plaintext';
  const parts = value.split(':');
  if (
    parts.length >= 3 &&
    /^[0-9a-fA-F]{32}$/.test(parts[0]) &&
    /^[0-9a-fA-F]{32}$/.test(parts[1]) &&
    /^[0-9a-fA-F]+$/.test(parts.slice(2).join(''))
  ) {
    return 'ciphertext-shape';
  }
  return 'truncated';
}
