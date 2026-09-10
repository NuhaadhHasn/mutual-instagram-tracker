import { createStore, del, get, set } from 'idb-keyval';

/**
 * The D2 at-rest master key for the browser build.
 *
 * Native keeps a base64 key string in the device Keychain/Keystore. A browser
 * has no keystore, so the equivalent protection here is a **non-extractable
 * `CryptoKey`**: generated with `extractable: false`, it can be handed to
 * `crypto.subtle.encrypt`/`decrypt` but its raw bytes cannot be read back by
 * any script, not even one injected into this origin. `CryptoKey` is
 * structured-cloneable, so IndexedDB stores the handle itself and the material
 * stays inside the browser's crypto implementation.
 *
 * It lives in the SAME object store as the app's data, under the usual key
 * prefix. A separate store was the first instinct, but idb-keyval's
 * `createStore` calls `indexedDB.open(name)` with no version, and IndexedDB
 * only creates object stores during a version upgrade — so a second store can
 * never be added to a database that already exists, and every write to it
 * fails with NotFoundError. Sharing the store avoids that entirely.
 *
 * Nothing reads this key through the `kv` facade, so the facade's
 * string-only contract is unaffected. Keeping the standard prefix means the
 * `getAllKeys()` sweep in `wipeEverything` removes it too, on top of the
 * explicit `deleteMasterKey()` call — a wipe must never leave the key behind.
 *
 * TWO MODES, and the difference is the whole point:
 *
 * 1. DEVICE mode (default, zero friction) — a non-extractable CryptoKey stored
 *    as-is. Convenient, but the key sits in the same browser profile as the
 *    ciphertext, so whoever has the profile has both halves.
 * 2. PASSPHRASE mode — a random data key WRAPPED with a key derived from the
 *    user's passphrase (PBKDF2-SHA256, 600k iterations, random salt). Only the
 *    wrapped blob is stored. Without the passphrase the profile contains
 *    nothing usable, which is the one thing device mode cannot offer. The cost
 *    is real: the passphrase must be entered on every launch, and losing it
 *    loses the data, because there is deliberately no recovery path.
 *
 * Neither is hardware-backed and neither must ever be described that way — see
 * the threat-model note in `atRestCrypto.web.ts`.
 */

// Same database and store as the app data — see the note above on why a
// separate store is not possible. Identical arguments to kv.web.ts, so this
// resolves to the same underlying object store.
const keyStore = createStore('mutual', 'kv');
const KEY_ID = '@instagram_tracker:at_rest_master_key_v1';

let cachedKey: CryptoKey | null = null;

/**
 * Load the master key from IndexedDB into the in-memory cache (once).
 * Returns null when none is stored (encryption never enabled) or storage is
 * unavailable. Never throws — callers treat null as "no key".
 */
export async function loadMasterKey(): Promise<CryptoKey | null> {
  if (cachedKey) return cachedKey;
  try {
    const stored = await get<unknown>(KEY_ID, keyStore);
    // Guard the shape: a partially-written or foreign value must not be
    // mistaken for a usable key. A passphrase-wrapped record is deliberately
    // NOT a usable key here — it needs unlockWithPassphrase() first, and
    // returning null is what makes the app show its unlock gate.
    cachedKey = stored instanceof CryptoKey ? stored : null;
    return cachedKey;
  } catch {
    return null;
  }
}

/**
 * Synchronous accessor for the hot read/write path. Only valid after
 * loadMasterKey() / createAndStoreMasterKey() has run — both happen before any
 * encrypted read (loadMasterKey runs in initEncryptionState at hydration).
 */
export function getCachedMasterKey(): CryptoKey | null {
  return cachedKey;
}

/**
 * Generate a fresh non-extractable AES-256-GCM key, persist it, cache it and
 * return it. Throws if IndexedDB is unavailable, which the caller
 * (enableEncryption) surfaces as a failure that leaves the toggle off.
 */
export async function createAndStoreMasterKey(): Promise<CryptoKey> {
  const key = await crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    false, // non-extractable: the raw bytes can never be read back out
    ['encrypt', 'decrypt'],
  );
  await set(KEY_ID, key, keyStore);
  cachedKey = key;
  return key;
}

/** Delete the master key and clear the cache. Best-effort (never throws). */
export async function deleteMasterKey(): Promise<void> {
  try {
    await del(KEY_ID, keyStore);
  } catch {
    // Swallow — wipe/disable must never throw on key removal.
  }
  cachedKey = null;
}

/** Clear only the in-memory cache (e.g. after a wipe). */
export function clearCachedMasterKey(): void {
  cachedKey = null;
}

// ---- passphrase mode -------------------------------------------------------

/**
 * OWASP's floor for PBKDF2-SHA256 at the time of writing. High enough to make
 * guessing expensive, low enough that `crypto.subtle` finishes in well under a
 * second — native WebCrypto is roughly 3.5x crypto-js, so this costs less here
 * than the 100k the pure-JS backup path uses.
 */
const PBKDF2_ITERATIONS = 600_000;
const SALT_BYTES = 16;
const WRAP_IV_BYTES = 12;

/** Marker so a wrapped record is never mistaken for a bare CryptoKey. */
interface WrappedMasterKey {
  v: 'mtl-wrapped-key';
  kdf: 'PBKDF2-SHA256';
  iterations: number;
  salt: string; // base64
  iv: string; // base64
  wrapped: string; // base64, the data key encrypted under the passphrase key
}

function isWrapped(value: unknown): value is WrappedMasterKey {
  if (!value || typeof value !== 'object') return false;
  const w = value as Record<string, unknown>;
  return w.v === 'mtl-wrapped-key' && typeof w.wrapped === 'string' && typeof w.salt === 'string';
}

const b64 = (bytes: Uint8Array): string => {
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
};

const unb64 = (s: string): Uint8Array<ArrayBuffer> => {
  const bin = atob(s);
  const out = new Uint8Array(new ArrayBuffer(bin.length));
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
};

/** Derive the wrapping key from a passphrase. Never stored, only ever derived. */
async function deriveWrappingKey(
  passphrase: string,
  salt: Uint8Array<ArrayBuffer>,
  iterations: number,
): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(passphrase),
    'PBKDF2',
    false,
    ['deriveKey'],
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['wrapKey', 'unwrapKey'],
  );
}

/**
 * Is a passphrase required before any encrypted data can be read? True only
 * when a wrapped key is stored and has not been unlocked yet this session.
 */
export async function needsPassphraseUnlock(): Promise<boolean> {
  if (cachedKey) return false;
  try {
    return isWrapped(await get(KEY_ID, keyStore));
  } catch {
    return false;
  }
}

/**
 * Turn on encryption in passphrase mode. The data key is generated extractable
 * — it has to be, to be wrappable — but it is never written anywhere in that
 * form: only the wrapped blob is stored, and the plain key stays in memory for
 * this session.
 */
export async function createAndStoreMasterKeyWithPassphrase(
  passphrase: string,
): Promise<CryptoKey> {
  const dataKey = await crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt'],
  );
  const salt = crypto.getRandomValues(new Uint8Array(new ArrayBuffer(SALT_BYTES)));
  const iv = crypto.getRandomValues(new Uint8Array(new ArrayBuffer(WRAP_IV_BYTES)));
  const wrappingKey = await deriveWrappingKey(passphrase, salt, PBKDF2_ITERATIONS);
  const wrapped = await crypto.subtle.wrapKey('raw', dataKey, wrappingKey, {
    name: 'AES-GCM',
    iv,
  });

  const record: WrappedMasterKey = {
    v: 'mtl-wrapped-key',
    kdf: 'PBKDF2-SHA256',
    iterations: PBKDF2_ITERATIONS,
    salt: b64(salt),
    iv: b64(iv),
    wrapped: b64(new Uint8Array(wrapped)),
  };
  await set(KEY_ID, record, keyStore);
  cachedKey = dataKey;
  return dataKey;
}

/**
 * Unwrap the stored key with the user's passphrase and cache it for this
 * session. Returns false on a wrong passphrase — AES-GCM's auth tag fails, so
 * a wrong answer is rejected rather than yielding a garbage key.
 */
export async function unlockWithPassphrase(passphrase: string): Promise<boolean> {
  let record: unknown;
  try {
    record = await get(KEY_ID, keyStore);
  } catch {
    return false;
  }
  if (!isWrapped(record)) return false;
  try {
    const wrappingKey = await deriveWrappingKey(
      passphrase,
      unb64(record.salt),
      record.iterations,
    );
    const key = await crypto.subtle.unwrapKey(
      'raw',
      unb64(record.wrapped),
      wrappingKey,
      { name: 'AES-GCM', iv: unb64(record.iv) },
      { name: 'AES-GCM', length: 256 },
      false, // the unwrapped key is non-extractable in memory
      ['encrypt', 'decrypt'],
    );
    cachedKey = key;
    return true;
  } catch {
    return false;
  }
}

/** Is the stored key protected by a passphrase (as opposed to device mode)? */
export async function isPassphraseProtected(): Promise<boolean> {
  try {
    return isWrapped(await get(KEY_ID, keyStore));
  } catch {
    return false;
  }
}
