import * as Crypto from 'expo-crypto';
import CryptoJS from 'crypto-js';

/**
 * Raw-key AES-256 encryption for data AT REST on this device (D2).
 *
 * Distinct from backupCrypto.ts: backups use a passphrase + PBKDF2 because the
 * secret must travel with a portable file. At-rest data is encrypted with a
 * random 256-bit master key held in the device Keychain/Keystore (see
 * masterKey.ts), so there is NO KDF here — the key is already high-entropy.
 * That keeps every read/write fast (no ~5s PBKDF2), which matters because this
 * wraps AsyncStorage reads/writes.
 *
 * Scheme: AES-256-CBC + Pkcs7, fresh random IV per value. Pure-JS (Expo Go
 * safe): crypto-js for AES, expo-crypto for the CSPRNG (crypto-js's own
 * WordArray.random falls back to Math.random under Hermes, which is NOT secure).
 *
 * NOTE: CBC has no auth tag. A wrong/rotated key or tampering is caught
 * heuristically when the decrypted bytes fail UTF-8 (and the caller then fails
 * JSON.parse). Adequate for personal at-rest data; a future format:2 could add
 * encrypt-then-HMAC.
 */

export const AT_REST_FORMAT = 1;

export interface AtRestEnvelope {
  v: 'mtl-ar'; // marker, distinct from the backup envelope's { app: 'mutual' }
  enc: true;
  format: number; // AT_REST_FORMAT
  cipher: 'AES-256-CBC';
  iv: string; // base64, 16 bytes, fresh per value
  ct: string; // base64 ciphertext
}

/** Thrown when at-rest decryption fails (missing/rotated key or corruption). */
export class AtRestDecryptError extends Error {
  constructor() {
    super('Could not decrypt at-rest data');
    this.name = 'AtRestDecryptError';
  }
}

/** Yield once so a busy indicator can paint before a large CPU-bound encrypt/decrypt. */
function yieldToUI(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

/** Pack CSPRNG bytes (expo-crypto) into a crypto-js WordArray (big-endian per 32-bit word). */
function randomWordArray(byteCount: number): CryptoJS.lib.WordArray {
  const bytes = Crypto.getRandomBytes(byteCount); // Uint8Array, secure
  const words: number[] = [];
  for (let i = 0; i < bytes.length; i++) {
    words[i >>> 2] |= bytes[i] << (24 - (i % 4) * 8);
  }
  return CryptoJS.lib.WordArray.create(words, bytes.length);
}

/** Generate a fresh random 256-bit master key, base64-encoded. */
export function generateMasterKey(): string {
  return randomWordArray(32).toString(CryptoJS.enc.Base64);
}

function keyFromB64(keyB64: string): CryptoJS.lib.WordArray {
  return CryptoJS.enc.Base64.parse(keyB64);
}

function encryptInternal(plaintext: string, keyB64: string): AtRestEnvelope {
  const key = keyFromB64(keyB64);
  const iv = randomWordArray(16);
  const encrypted = CryptoJS.AES.encrypt(plaintext, key, {
    iv,
    mode: CryptoJS.mode.CBC,
    padding: CryptoJS.pad.Pkcs7,
  });
  return {
    v: 'mtl-ar',
    enc: true,
    format: AT_REST_FORMAT,
    cipher: 'AES-256-CBC',
    iv: iv.toString(CryptoJS.enc.Base64),
    ct: encrypted.ciphertext.toString(CryptoJS.enc.Base64),
  };
}

function decryptInternal(env: AtRestEnvelope, keyB64: string): string {
  const key = keyFromB64(keyB64);
  const iv = CryptoJS.enc.Base64.parse(env.iv);
  const cipherParams = CryptoJS.lib.CipherParams.create({
    ciphertext: CryptoJS.enc.Base64.parse(env.ct),
  });
  const decrypted = CryptoJS.AES.decrypt(cipherParams, key, {
    iv,
    mode: CryptoJS.mode.CBC,
    padding: CryptoJS.pad.Pkcs7,
  });
  // A wrong key almost always yields bad padding / non-UTF-8 bytes; toString(Utf8)
  // throws "Malformed UTF-8 data". An empty result also fails.
  let plaintext: string;
  try {
    plaintext = decrypted.toString(CryptoJS.enc.Utf8);
  } catch {
    throw new AtRestDecryptError();
  }
  if (!plaintext) throw new AtRestDecryptError();
  return plaintext;
}

/** Encrypt a plaintext string with a raw base64 key (synchronous). */
export function encryptWithKey(plaintext: string, keyB64: string): AtRestEnvelope {
  return encryptInternal(plaintext, keyB64);
}

/** Decrypt an envelope with a raw base64 key (synchronous). Throws AtRestDecryptError. */
export function decryptWithKey(env: AtRestEnvelope, keyB64: string): string {
  return decryptInternal(env, keyB64);
}

/** Async encrypt — yields to the UI first so a busy overlay can paint before a large blob. */
export async function encryptWithKeyAsync(
  plaintext: string,
  keyB64: string,
): Promise<AtRestEnvelope> {
  await yieldToUI();
  return encryptInternal(plaintext, keyB64);
}

/** Async decrypt — yields to the UI first (used for the large follower_data blob). */
export async function decryptWithKeyAsync(
  env: AtRestEnvelope,
  keyB64: string,
): Promise<string> {
  await yieldToUI();
  return decryptInternal(env, keyB64);
}

/** Type guard: is this parsed object one of our at-rest envelopes? */
export function isAtRestEnvelope(parsed: unknown): parsed is AtRestEnvelope {
  if (!parsed || typeof parsed !== 'object') return false;
  const e = parsed as Record<string, unknown>;
  return (
    e.v === 'mtl-ar' &&
    e.enc === true &&
    typeof e.format === 'number' &&
    (e.format as number) <= AT_REST_FORMAT &&
    typeof e.iv === 'string' &&
    (e.iv as string).length > 0 &&
    typeof e.ct === 'string' &&
    (e.ct as string).length > 0
  );
}
