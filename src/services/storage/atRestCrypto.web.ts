import {
  AT_REST_FORMAT,
  AtRestDecryptError,
  AtRestEnvelope,
} from './atRestTypes';

export {
  AT_REST_FORMAT,
  AtRestDecryptError,
  isAtRestEnvelope,
} from './atRestTypes';
export type { AtRestEnvelope } from './atRestTypes';

/**
 * At-rest encryption for the browser build (D2), using the platform's own
 * WebCrypto rather than crypto-js.
 *
 * Scheme: AES-256-**GCM**, fresh 12-byte nonce per value, key supplied as a
 * non-extractable `CryptoKey` (see `masterKey.web.ts`).
 *
 * Two reasons this is better than the native CBC path rather than merely
 * different:
 *
 * 1. **GCM is authenticated.** The native implementation notes that CBC has no
 *    auth tag, so tampering is only caught heuristically when the plaintext
 *    fails to decode as UTF-8. GCM verifies an auth tag during decryption and
 *    throws on any modified byte, which closes that gap here.
 * 2. **It is native code.** `crypto.subtle` runs the cipher in the browser
 *    rather than in interpreted JS, so it is several times faster than
 *    crypto-js and does not block the main thread the way a large crypto-js
 *    pass does.
 *
 * WHAT THIS DOES AND DOES NOT PROTECT — read before writing any user-facing
 * copy about it. The key is generated non-extractable, so no script, including
 * one injected into this origin, can read the raw key material out. That is the
 * real guarantee: the data is not sitting in browser storage as readable text,
 * and the key cannot be exfiltrated by a page.
 *
 * It is NOT protection against someone holding the machine. The key is stored
 * in the same browser profile as the ciphertext, so anyone with that profile
 * has both halves; and anyone who can simply open this browser can just use the
 * app. Android answers those with a hardware-backed keystore plus an app lock,
 * and web has neither. Never call this hardware-backed, and never claim it
 * defends against someone reading the profile off disk.
 */

const IV_BYTES = 12; // 96-bit nonce, the size AES-GCM is specified for
const ALGO = 'AES-GCM';

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  // Chunked so a multi-megabyte payload cannot blow the argument limit of
  // String.fromCharCode with a spread.
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

function fromBase64(b64: string): Uint8Array<ArrayBuffer> {
  const binary = atob(b64);
  // Backed by an explicit ArrayBuffer so the type is `Uint8Array<ArrayBuffer>`:
  // WebCrypto's BufferSource excludes SharedArrayBuffer-backed views, which is
  // what a bare `new Uint8Array(n)` widens to under TypeScript 6.
  const out = new Uint8Array(new ArrayBuffer(binary.length));
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

/**
 * The web build never calls the synchronous variants — `dataStore` awaits the
 * async ones on every platform precisely because WebCrypto has no synchronous
 * API. These exist so both implementations present the same module shape, and
 * throw loudly rather than silently returning something wrong if a future
 * caller reaches for them.
 */
const SYNC_UNSUPPORTED =
  'Synchronous at-rest crypto is unavailable on web: WebCrypto is async-only. Use the *Async variants.';

export function encryptWithKey(): never {
  throw new Error(SYNC_UNSUPPORTED);
}

export function decryptWithKey(): never {
  throw new Error(SYNC_UNSUPPORTED);
}

/** Encrypt a plaintext string under the non-extractable master key. */
export async function encryptWithKeyAsync(
  plaintext: string,
  key: CryptoKey,
): Promise<AtRestEnvelope> {
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const ct = await crypto.subtle.encrypt(
    { name: ALGO, iv },
    key,
    new TextEncoder().encode(plaintext),
  );
  return {
    v: 'mtl-ar',
    enc: true,
    format: AT_REST_FORMAT,
    cipher: 'AES-256-GCM',
    iv: toBase64(iv),
    ct: toBase64(new Uint8Array(ct)),
  };
}

/** Decrypt an envelope. Throws AtRestDecryptError on a wrong key or any tampering. */
export async function decryptWithKeyAsync(
  env: AtRestEnvelope,
  key: CryptoKey,
): Promise<string> {
  // A CBC envelope here would mean data written by the native build somehow
  // reached the browser. We cannot decrypt it, and must say so rather than
  // letting a confusing WebCrypto error surface.
  if (env.cipher !== 'AES-256-GCM') throw new AtRestDecryptError();
  try {
    const plain = await crypto.subtle.decrypt(
      { name: ALGO, iv: fromBase64(env.iv) },
      key,
      fromBase64(env.ct),
    );
    return new TextDecoder().decode(plain);
  } catch {
    // GCM throws on a failed auth-tag check, so this covers both a wrong key
    // and a modified ciphertext.
    throw new AtRestDecryptError();
  }
}
