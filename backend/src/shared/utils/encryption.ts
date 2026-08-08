import crypto from 'node:crypto';
import { env } from '../../config/env.js';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;

function getKey(): Buffer {
  const key = Buffer.from(env.ENCRYPTION_KEY, 'hex');
  if (key.length !== 32) {
    throw new Error('ENCRYPTION_KEY must be 32 bytes (64 hex chars)');
  }
  return key;
}

/** Encrypts a UTF-8 string, returning `iv:authTag:ciphertext` as hex. */
export function encrypt(plaintext: string): string {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${ciphertext.toString('hex')}`;
}

/** Decrypts a string produced by {@link encrypt}. */
export function decrypt(payload: string): string {
  const [ivHex, authTagHex, ciphertextHex] = payload.split(':');
  if (!ivHex || !authTagHex || !ciphertextHex) {
    throw new Error('Invalid encrypted payload format');
  }
  const decipher = crypto.createDecipheriv(ALGORITHM, getKey(), Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(ciphertextHex, 'hex')),
    decipher.final(),
  ]);
  return plaintext.toString('utf8');
}
