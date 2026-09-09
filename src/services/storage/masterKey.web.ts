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
 * This is NOT hardware-backed and must never be described that way — see the
 * threat-model note in `atRestCrypto.web.ts`.
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
    const stored = await get<CryptoKey>(KEY_ID, keyStore);
    // Guard the shape: a partially-written or foreign value must not be
    // mistaken for a usable key.
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
