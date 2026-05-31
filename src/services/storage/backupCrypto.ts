import * as Crypto from 'expo-crypto';
import CryptoJS from 'crypto-js';

/**
 * Optional passphrase-based encryption for Mutual backup files.
 *
 * Pure-JS only (Expo Go safe): crypto-js for AES + PBKDF2, expo-crypto for a
 * cryptographically-secure RNG (crypto-js's own WordArray.random falls back to
 * Math.random under Hermes, which is NOT secure).
 *
 * Scheme: PBKDF2-HMAC-SHA256 (100k iters) -> 256-bit key; AES-256-CBC + Pkcs7.
 * Salt + IV are random per export and stored (base64) in the envelope alongside
 * the iteration count, so old files stay decryptable if the default ever changes.
 *
 * NOTE: CBC has no authentication tag (crypto-js has no AEAD/GCM). Integrity is
 * checked heuristically by validating the decrypted JSON structure. Adequate for
 * a personal at-rest backup; a future `format: 2` could add encrypt-then-HMAC.
 */

export const ENVELOPE_FORMAT = 1;
export const PBKDF2_ITERATIONS = 100_000;

const APP = 'mutual';

export interface EncryptedEnvelope {
  app: typeof APP;
  encrypted: true;
  format: number;
  kdf: 'PBKDF2';
  hash: 'SHA256';
  iterations: number;
  cipher: 'AES-256-CBC';
  salt: string; // base64, 16 bytes
  iv: string; // base64, 16 bytes
  ciphertext: string; // base64
}

/** Thrown when decryption fails: wrong passphrase or a corrupted/tampered file. */
export class WrongPassphraseError extends Error {
  constructor() {
    super('Wrong passphrase or corrupted file');
    this.name = 'WrongPassphraseError';
  }
}

/**
 * Thrown by restoreFromFile when the picked file is an encrypted envelope.
 * Carries the already-parsed envelope so the UI can prompt for a passphrase
 * and continue without re-opening the file picker.
 */
export class PassphraseRequiredError extends Error {
  envelope: EncryptedEnvelope;
  constructor(envelope: EncryptedEnvelope) {
    super('PASSPHRASE_REQUIRED');
    this.name = 'PassphraseRequiredError';
    this.envelope = envelope;
  }
}

/** Yield once so a busy indicator can paint before the multi-second PBKDF2 blocks the JS thread. */
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

/** Derive a 256-bit AES key from a passphrase + salt via PBKDF2-HMAC-SHA256. */
function deriveKey(passphrase: string, salt: CryptoJS.lib.WordArray, iterations: number) {
  // keySize is in 32-bit words: 256 / 32 = 8 words = 256-bit key.
  // hasher + keySize MUST be explicit (crypto-js defaults to SHA1 / 128-bit).
  return CryptoJS.PBKDF2(passphrase, salt, {
    keySize: 256 / 32,
    iterations,
    hasher: CryptoJS.algo.SHA256,
  });
}

/** Encrypt a plaintext JSON string into a self-describing envelope. */
export async function encryptPayload(
  plaintext: string,
  passphrase: string,
): Promise<EncryptedEnvelope> {
  await yieldToUI();
  const salt = randomWordArray(16);
  const iv = randomWordArray(16);
  const key = deriveKey(passphrase, salt, PBKDF2_ITERATIONS);

  const encrypted = CryptoJS.AES.encrypt(plaintext, key, {
    iv,
    mode: CryptoJS.mode.CBC,
    padding: CryptoJS.pad.Pkcs7,
  });

  return {
    app: APP,
    encrypted: true,
    format: ENVELOPE_FORMAT,
    kdf: 'PBKDF2',
    hash: 'SHA256',
    iterations: PBKDF2_ITERATIONS,
    cipher: 'AES-256-CBC',
    salt: salt.toString(CryptoJS.enc.Base64),
    iv: iv.toString(CryptoJS.enc.Base64),
    ciphertext: encrypted.ciphertext.toString(CryptoJS.enc.Base64),
  };
}

/** Decrypt an envelope back to its plaintext JSON string. Throws WrongPassphraseError on failure. */
export async function decryptPayload(
  env: EncryptedEnvelope,
  passphrase: string,
): Promise<string> {
  await yieldToUI();
  const salt = CryptoJS.enc.Base64.parse(env.salt);
  const iv = CryptoJS.enc.Base64.parse(env.iv);
  const key = deriveKey(passphrase, salt, env.iterations);

  const cipherParams = CryptoJS.lib.CipherParams.create({
    ciphertext: CryptoJS.enc.Base64.parse(env.ciphertext),
  });

  const decrypted = CryptoJS.AES.decrypt(cipherParams, key, {
    iv,
    mode: CryptoJS.mode.CBC,
    padding: CryptoJS.pad.Pkcs7,
  });

  // Layer 1: a wrong key almost always yields bad padding / non-UTF-8 bytes,
  // and toString(Utf8) throws "Malformed UTF-8 data". An empty result also fails.
  let plaintext: string;
  try {
    plaintext = decrypted.toString(CryptoJS.enc.Utf8);
  } catch {
    throw new WrongPassphraseError();
  }
  if (!plaintext) {
    throw new WrongPassphraseError();
  }
  return plaintext;
  // Layer 2 (structural JSON validation) happens in the caller (restoreFromEnvelope).
}

/** Type guard: is this parsed object a supported encrypted envelope? */
export function isEncryptedEnvelope(parsed: unknown): parsed is EncryptedEnvelope {
  if (!parsed || typeof parsed !== 'object') {
    return false;
  }
  const e = parsed as Record<string, unknown>;
  return (
    e.app === APP &&
    e.encrypted === true &&
    typeof e.format === 'number' &&
    e.format <= ENVELOPE_FORMAT &&
    typeof e.iterations === 'number' &&
    e.iterations > 0 &&
    typeof e.salt === 'string' &&
    e.salt.length > 0 &&
    typeof e.iv === 'string' &&
    e.iv.length > 0 &&
    typeof e.ciphertext === 'string' &&
    e.ciphertext.length > 0
  );
}
