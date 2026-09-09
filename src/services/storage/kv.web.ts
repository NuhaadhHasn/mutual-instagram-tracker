import { clear, createStore, del, get, keys, set } from 'idb-keyval';
import { KvStore } from './kv.types';

/**
 * Web key-value storage — IndexedDB, via idb-keyval.
 *
 * WHY NOT localStorage: the default AsyncStorage web shim is localStorage-backed,
 * and localStorage is capped at ~5 MiB counted in UTF-16 (~2.5M characters).
 * A real export lands at ~2.59M characters even after snapshot pruning, so the
 * app would be at or over the ceiling on day one — and comfortably over it with
 * encryption on, since AES + base64 inflates by roughly 1.4x. IndexedDB is
 * quota-managed in the hundreds of MB and stores strings without a
 * serialization hop, so it is the only correct choice here.
 *
 * Metro resolves this file in place of `kv.ts` when the platform is web; it is
 * never part of the Android bundle, which is why `idb-keyval` can be imported
 * at module scope without a Platform check.
 */

// An explicit database name, so the data is obvious in DevTools > Application
// rather than hiding in idb-keyval's generic default store.
const store = createStore('mutual', 'kv');

// Ask the browser once, lazily, to exempt our data from eviction under storage
// pressure. Deferred to the first write rather than module load for two
// reasons: there is nothing worth protecting until something is stored, and
// browsers weigh site engagement when deciding, so asking later is likelier to
// be granted. Fire-and-forget — a refusal is survivable and must never block or
// fail a write.
let persistenceRequested = false;
function requestPersistenceOnce(): void {
  if (persistenceRequested) return;
  persistenceRequested = true;
  void navigator.storage?.persist?.().catch(() => {});
}

export const kv: KvStore = {
  // idb-keyval resolves undefined for a missing key; AsyncStorage resolves null.
  // Normalising here is what lets every existing call site keep its null checks
  // and keeps the two platforms honestly interchangeable.
  getItem: async (key) => (await get<string>(key, store)) ?? null,

  setItem: async (key, value) => {
    requestPersistenceOnce();
    await set(key, value, store);
  },

  removeItem: (key) => del(key, store),

  getAllKeys: async () => (await keys(store)).map(String),
};

/**
 * Drop the entire object store. Not part of `KvStore` — nothing in the app
 * calls it, and the shared wipe path deliberately deletes key-by-key so it only
 * ever touches keys the app owns. Exported for use from the browser console
 * when a development database needs resetting.
 */
export const __clearWebStoreForDev = (): Promise<void> => clear(store);
