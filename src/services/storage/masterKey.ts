import * as SecureStore from 'expo-secure-store';
import { generateMasterKey } from './atRestCrypto';

/**
 * The D2 at-rest master key lives in the device Keychain/Keystore
 * (expo-secure-store, hardware-backed) — NOT in AsyncStorage. It's cached in a
 * module-level variable so the hot read/write path can read it synchronously
 * (getCachedMasterKey) after a one-time async load at hydration. One key covers
 * every account.
 */

const SECURE_KEY = 'mutual_at_rest_master_key_v1';

let cachedKey: string | null = null;

/**
 * Load the master key from secure-store into the in-memory cache (once).
 * Returns null if none is stored (encryption never enabled) or secure-store is
 * unavailable. Never throws — callers treat null as "no key".
 */
export async function loadMasterKey(): Promise<string | null> {
  if (cachedKey) return cachedKey;
  try {
    const stored = await SecureStore.getItemAsync(SECURE_KEY);
    cachedKey = stored ?? null;
    return cachedKey;
  } catch {
    return null;
  }
}

/**
 * Synchronous accessor for the hot read/write path. Only valid after
 * loadMasterKey() / createAndStoreMasterKey() has run (both happen before any
 * encrypted read: loadMasterKey in initEncryptionState at hydration).
 */
export function getCachedMasterKey(): string | null {
  return cachedKey;
}

/**
 * Generate a fresh master key, persist it to secure-store, cache it, and return
 * it. Throws if secure-store is unavailable — the caller (enableEncryption)
 * surfaces that as a failure and leaves the toggle off.
 */
export async function createAndStoreMasterKey(): Promise<string> {
  const key = generateMasterKey();
  await SecureStore.setItemAsync(SECURE_KEY, key);
  cachedKey = key;
  return key;
}

/** Delete the master key from secure-store and clear the cache. Best-effort (never throws). */
export async function deleteMasterKey(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(SECURE_KEY);
  } catch {
    // Swallow — wipe/disable must never throw on key removal.
  }
  cachedKey = null;
}

/** Clear only the in-memory cache (e.g. after a wipe). */
export function clearCachedMasterKey(): void {
  cachedKey = null;
}

// ---- passphrase mode: web-only, stubbed here -------------------------------
//
// The browser has no keystore, so `masterKey.web.ts` offers an optional mode
// where the data key is wrapped with a PBKDF2 key derived from a passphrase.
// Native does not need it — the key already lives in the device Keychain /
// Keystore, which is strictly stronger than anything a passphrase buys — but
// the shared startup path in App.tsx calls these on every platform, so they
// exist here as honest no-ops.

/** Always false on native: the Keychain/Keystore key needs no passphrase. */
export async function needsPassphraseUnlock(): Promise<boolean> {
  return false;
}

/** Always false on native — nothing is passphrase-wrapped here. */
export async function isPassphraseProtected(): Promise<boolean> {
  return false;
}

/**
 * Never reachable on native; `needsPassphraseUnlock` gates every caller.
 *
 * The parameter is unused but MUST stay, and must keep the same type as the web
 * implementation: tsc resolves importers to this file, so a signature that
 * exists only on the web side would compile here and blow up in the browser.
 * (These two modules have no shared contract file the way `kv` and
 * `atRestCrypto` do, because the key itself is a `string` here and a
 * `CryptoKey` there — so keeping the signatures aligned is manual.)
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function unlockWithPassphrase(_passphrase: string): Promise<boolean> {
  return false;
}

/** Never reachable on native; Settings only offers the choice when isWeb. */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function createAndStoreMasterKeyWithPassphrase(
  _passphrase: string,
): Promise<string> {
  throw new Error('Passphrase-wrapped keys are a web-only mode');
}
