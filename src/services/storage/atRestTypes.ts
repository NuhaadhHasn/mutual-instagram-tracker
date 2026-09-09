/**
 * Types shared by both at-rest encryption implementations.
 *
 * Native (`atRestCrypto.ts`) uses AES-256-CBC via crypto-js, because it has to
 * run inside Expo Go where WebCrypto is not available. Web
 * (`atRestCrypto.web.ts`) uses AES-256-GCM through `crypto.subtle`, which is
 * both faster and authenticated.
 *
 * The envelope shape is deliberately common to both so the format is
 * self-describing: `cipher` says which algorithm produced it, and the type
 * guard below recognises either. At-rest envelopes never move between
 * platforms — they live in local storage and a backup export decrypts before
 * writing — but a value that cannot be decrypted must still be *recognised* as
 * ciphertext. If the guard failed to match, the caller would hand the raw
 * envelope object back as if it were the data.
 */

export const AT_REST_FORMAT = 1;

export type AtRestCipher = 'AES-256-CBC' | 'AES-256-GCM';

export interface AtRestEnvelope {
  v: 'mtl-ar'; // marker, distinct from the backup envelope's { app: 'mutual' }
  enc: true;
  format: number; // AT_REST_FORMAT
  cipher: AtRestCipher;
  /** base64. 16-byte IV for CBC, 12-byte nonce for GCM — fresh for every value. */
  iv: string;
  /** base64 ciphertext. For GCM this includes the trailing 16-byte auth tag. */
  ct: string;
}

/** Thrown when at-rest decryption fails (missing/rotated key or corruption). */
export class AtRestDecryptError extends Error {
  constructor() {
    super('Could not decrypt at-rest data');
    this.name = 'AtRestDecryptError';
  }
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
    (e.cipher === 'AES-256-CBC' || e.cipher === 'AES-256-GCM') &&
    typeof e.iv === 'string' &&
    (e.iv as string).length > 0 &&
    typeof e.ct === 'string' &&
    (e.ct as string).length > 0
  );
}
