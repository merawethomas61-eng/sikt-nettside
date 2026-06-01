/**
 * AES-256-GCM encrypt/decrypt for server-side secrets (f.eks. WordPress-tokens).
 *
 * ENCRYPTION_KEY genereres med:
 *   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
 * Sett den som Vercel Environment Variable (Production/Preview/Development).
 * Aldri i frontend, aldri med VITE_-prefiks, aldri commit ekte nøkkel.
 */

import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const KEY_HEX_LENGTH = 64;

function getEncryptionKey() {
  const raw = process.env.ENCRYPTION_KEY;
  if (typeof raw !== 'string' || raw.length === 0) {
    throw new Error(
      'ENCRYPTION_KEY mangler. Sett den i Vercel (Environment Variables) som en 64-tegns hex-streng (32 byte).',
    );
  }
  if (!/^[0-9a-fA-F]{64}$/.test(raw)) {
    throw new Error(
      'ENCRYPTION_KEY er ugyldig. Den må være nøyaktig 64 hex-tegn (32 byte), generert med: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"',
    );
  }
  return Buffer.from(raw, 'hex');
}

function assertNonEmptyString(value, label) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`${label} må være en ikke-tom streng.`);
  }
}

/**
 * @param {string} plaintext
 * @returns {string} "ivB64:tagB64:ciphertextB64"
 */
export function encrypt(plaintext) {
  assertNonEmptyString(plaintext, 'plaintext');
  const key = getEncryptionKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('base64')}:${tag.toString('base64')}:${encrypted.toString('base64')}`;
}

/**
 * @param {string} payload
 * @returns {string}
 */
export function decrypt(payload) {
  assertNonEmptyString(payload, 'payload');

  const parts = payload.split(':');
  if (parts.length !== 3) {
    throw new Error(
      'Ugyldig krypterings-payload: forventet format "ivB64:tagB64:dataB64".',
    );
  }

  const [ivB64, tagB64, dataB64] = parts;
  let iv;
  let tag;
  let ciphertext;
  try {
    iv = Buffer.from(ivB64, 'base64');
    tag = Buffer.from(tagB64, 'base64');
    ciphertext = Buffer.from(dataB64, 'base64');
  } catch {
    throw new Error('Ugyldig krypterings-payload: kunne ikke dekode base64.');
  }

  if (iv.length !== IV_LENGTH) {
    throw new Error(`Ugyldig krypterings-payload: IV må være ${IV_LENGTH} byte.`);
  }
  if (tag.length === 0 || ciphertext.length === 0) {
    throw new Error('Ugyldig krypterings-payload: tom authTag eller ciphertext.');
  }

  const key = getEncryptionKey();
  try {
    const decipher = createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);
    const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return decrypted.toString('utf8');
  } catch {
    throw new Error(
      'Dekryptering feilet: ugyldig payload, tuklet data, eller feil ENCRYPTION_KEY.',
    );
  }
}
