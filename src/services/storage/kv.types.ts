/**
 * The storage contract shared by every platform.
 *
 * The whole app persists through these four methods and nothing else, so the
 * only thing that has to change to run on a new platform is which file backs
 * them. `kv.ts` (native) uses AsyncStorage; `kv.web.ts` uses IndexedDB. Metro
 * picks the `.web` variant automatically when bundling for web, so the Android
 * bundle never sees the web implementation and vice versa.
 *
 * Both implementations are typed as `KvStore`, which is what stops the two from
 * drifting apart: tsc resolves importers to `kv.ts`, so a signature that only
 * changed in `kv.web.ts` would otherwise go unnoticed until runtime.
 */
export interface KvStore {
  /** The stored string, or null when the key is absent. */
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
  /** Every key currently held, in no guaranteed order. */
  getAllKeys(): Promise<string[]>;
}
