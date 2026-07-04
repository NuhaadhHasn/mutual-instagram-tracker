import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  Account,
  FollowerData,
  HistoricalSnapshot,
  UnfollowedUser,
  WhitelistUser,
} from '../../shared/types';
import {
  decryptWithKey,
  decryptWithKeyAsync,
  encryptWithKey,
  encryptWithKeyAsync,
  isAtRestEnvelope,
} from './atRestCrypto';
import {
  clearCachedMasterKey,
  createAndStoreMasterKey,
  deleteMasterKey,
  getCachedMasterKey,
  loadMasterKey,
} from './masterKey';

// Per-account keys (namespaced by current account id — see keyFor) + global,
// device-level keys (accounts registry, current pointer, prefs) that are NOT
// namespaced and shared across all accounts.
const KEYS = {
  FOLLOWER_DATA: '@instagram_tracker:follower_data',
  WHITELIST: '@instagram_tracker:whitelist',
  HISTORY: '@instagram_tracker:history',
  UNFOLLOWED: '@instagram_tracker:unfollowed',
  // Global (not per-account):
  ACCOUNTS: '@instagram_tracker:accounts',
  CURRENT_ACCOUNT: '@instagram_tracker:current_account',
  IMPORT_COUNT: '@instagram_tracker:import_count',
  BLOCK_SCREENSHOTS: '@instagram_tracker:block_screenshots',
  APP_LOCK: '@instagram_tracker:app_lock',
  WIPE_ON_TAMPER: '@instagram_tracker:wipe_on_tamper',
  WIPE_THRESHOLD: '@instagram_tracker:wipe_threshold',
  FAILED_UNLOCKS: '@instagram_tracker:failed_unlocks',
  RECENT_SEARCHES: '@instagram_tracker:recent_searches',
  STORAGE_ENCRYPTED: '@instagram_tracker:storage_encrypted',
  NOTIFICATION_FREQUENCY: '@instagram_tracker:notification_frequency',
};

// How many recent search terms to keep (#11).
const MAX_RECENT_SEARCHES = 12;

// Shared storage prefix — used by wipeEverything to nuke every key we own
// (including the onboarding flag, which lives outside KEYS in App.tsx).
const STORAGE_PREFIX = '@instagram_tracker:';

// Wipe-on-tamper threshold bounds (D5). Default matches the IMPROVEMENTS roadmap.
const DEFAULT_WIPE_THRESHOLD = 10;
const MIN_WIPE_THRESHOLD = 3;
const MAX_WIPE_THRESHOLD = 20;

// Notification reminder frequency in days (#10). 0 = off.
const DEFAULT_NOTIFICATION_FREQUENCY = 0;
const ALLOWED_NOTIFICATION_FREQUENCIES = [0, 7, 14, 30];

// The first/default account reuses the original un-suffixed keys, so data saved
// before multi-account existed stays exactly where it was (zero byte-migration).
// Every other account suffixes its keys with `:<id>`.
const DEFAULT_ACCOUNT_ID = 'default';

function keyFor(base: string, accountId: string): string {
  return accountId === DEFAULT_ACCOUNT_ID ? base : `${base}:${accountId}`;
}

// Per-account keys holding sensitive user data — the only keys D2 encrypts.
const SENSITIVE_BASE_KEYS = [
  KEYS.FOLLOWER_DATA,
  KEYS.WHITELIST,
  KEYS.HISTORY,
  KEYS.UNFOLLOWED,
];

// follower_data is the large blob (can be several MB) — use the async,
// yield-first crypto variants for it so a busy overlay can paint first.
const isLargeKey = (base: string): boolean => base === KEYS.FOLLOWER_DATA;

export class DataStore {
  // Cached active account id so the (synchronous-feeling) key builder is cheap.
  private currentAccountId: string | null = null;

  // D2: whether sensitive at-rest data is currently encrypted. Mirrors the
  // persisted STORAGE_ENCRYPTED flag; set once at hydration (initEncryptionState).
  private storageEncryptedFlag = false;

  /**
   * Resolve (and cache) the active account id, seeding the accounts registry on
   * first run so a fresh install / pre-multi-account install always has one.
   */
  private async ensureCurrentAccountId(): Promise<string> {
    if (this.currentAccountId) return this.currentAccountId;
    await this.getAccounts(); // seeds the default account if the registry is empty
    const stored = await AsyncStorage.getItem(KEYS.CURRENT_ACCOUNT);
    this.currentAccountId = stored ?? DEFAULT_ACCOUNT_ID;
    return this.currentAccountId;
  }

  /** Build the storage key for `base` under the active account. */
  private async k(base: string): Promise<string> {
    return keyFor(base, await this.ensureCurrentAccountId());
  }

  // ---- D2: encryption-at-rest -----------------------------------------------

  /** Persisted flag: are the sensitive per-account keys encrypted at rest? */
  async getStorageEncrypted(): Promise<boolean> {
    try {
      return (await AsyncStorage.getItem(KEYS.STORAGE_ENCRYPTED)) === 'true';
    } catch {
      return false;
    }
  }

  /** Set the encryption flag (persisted + in-memory). */
  async setStorageEncrypted(enabled: boolean): Promise<void> {
    this.storageEncryptedFlag = enabled;
    try {
      await AsyncStorage.setItem(
        KEYS.STORAGE_ENCRYPTED,
        enabled ? 'true' : 'false',
      );
    } catch (error) {
      console.error('Error saving encryption flag:', error);
    }
  }

  /**
   * Load encryption state at hydration: read the flag AND load the master key
   * into the in-memory cache. Must run before any sensitive get* so reads can
   * decrypt. Loading the key even when the flag is off lets reads recover from
   * an interrupted disable (envelopes still on disk).
   */
  async initEncryptionState(): Promise<void> {
    this.storageEncryptedFlag = await this.getStorageEncrypted();
    await loadMasterKey();
  }

  /**
   * Serialize + (optionally) encrypt a value, then persist it. Sensitive keys
   * route through here. When encryption is on and the key is cached, the stored
   * form is JSON.stringify(envelope); otherwise plain JSON (back-compat).
   */
  private async writeValue(
    fullKey: string,
    obj: unknown,
    large = false,
  ): Promise<void> {
    const json = JSON.stringify(obj);
    const key = this.storageEncryptedFlag ? getCachedMasterKey() : null;
    if (key) {
      const env = large
        ? await encryptWithKeyAsync(json, key)
        : encryptWithKey(json, key);
      await AsyncStorage.setItem(fullKey, JSON.stringify(env));
    } else {
      await AsyncStorage.setItem(fullKey, json);
    }
  }

  /**
   * Read + parse a value, transparently decrypting if it's an at-rest envelope.
   * Plaintext (non-envelope) values still read fine (back-compat / mixed state).
   * Throws if an envelope is present but no key is cached — callers' try/catch
   * turns that into their safe default (fail-closed, never returns garbage).
   */
  private async readValue<T>(fullKey: string, large = false): Promise<T | null> {
    const raw = await AsyncStorage.getItem(fullKey);
    if (raw == null) return null;
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return null;
    }
    if (isAtRestEnvelope(parsed)) {
      const key = getCachedMasterKey();
      if (!key) {
        throw new Error('Encrypted data present but master key unavailable');
      }
      const json = large
        ? await decryptWithKeyAsync(parsed, key)
        : decryptWithKey(parsed, key);
      return JSON.parse(json) as T;
    }
    return parsed as T;
  }

  /**
   * Enable at-rest encryption: create+store a master key, then re-encrypt every
   * account's sensitive slices that are still plaintext. Order is key-first,
   * flag-last so an interruption leaves already-encrypted values readable (reads
   * decrypt whenever the key exists, independent of the flag). Idempotent.
   */
  async enableEncryption(): Promise<void> {
    // Reuse an existing key if one is present — NEVER mint a new key over an
    // old one. Overwriting would orphan any values already encrypted under the
    // previous key (e.g. after an interrupted enable), permanently losing them.
    const key =
      getCachedMasterKey() ??
      (await loadMasterKey()) ??
      (await createAndStoreMasterKey());
    const accounts = await this.getAccounts();
    for (const acc of accounts) {
      for (const base of SENSITIVE_BASE_KEYS) {
        const fullKey = keyFor(base, acc.id);
        const raw = await AsyncStorage.getItem(fullKey);
        if (raw == null) continue;
        let parsed: unknown;
        try {
          parsed = JSON.parse(raw);
        } catch {
          continue;
        }
        if (isAtRestEnvelope(parsed)) continue; // already encrypted
        const env = isLargeKey(base)
          ? await encryptWithKeyAsync(raw, key)
          : encryptWithKey(raw, key);
        await AsyncStorage.setItem(fullKey, JSON.stringify(env));
      }
    }
    await this.setStorageEncrypted(true); // flag + persist LAST
  }

  /**
   * Disable at-rest encryption: clear the flag first (so concurrent writes go
   * out plaintext), decrypt every slice back to plaintext, then delete the key
   * LAST — never while ciphertext remains. Aborts before the key delete if any
   * decrypt fails, so data stays recoverable.
   */
  async disableEncryption(): Promise<void> {
    // Fetch the key BEFORE clearing the flag. If it's unavailable we must not
    // half-disable (flag off while ciphertext remains on disk), which could let
    // a later empty read overwrite encrypted data — refuse and stay encrypted.
    const key = getCachedMasterKey() ?? (await loadMasterKey());
    if (!key) {
      throw new Error('Cannot disable encryption: master key unavailable');
    }
    await this.setStorageEncrypted(false); // now safe to clear flag
    const accounts = await this.getAccounts();
    for (const acc of accounts) {
      for (const base of SENSITIVE_BASE_KEYS) {
        const fullKey = keyFor(base, acc.id);
        const raw = await AsyncStorage.getItem(fullKey);
        if (raw == null) continue;
        let parsed: unknown;
        try {
          parsed = JSON.parse(raw);
        } catch {
          continue;
        }
        if (!isAtRestEnvelope(parsed)) continue; // already plaintext
        const plaintext = isLargeKey(base)
          ? await decryptWithKeyAsync(parsed, key)
          : decryptWithKey(parsed, key);
        await AsyncStorage.setItem(fullKey, plaintext);
      }
    }
    await deleteMasterKey(); // LAST — only after everything is plaintext
  }

  // ---- Accounts (C8) --------------------------------------------------------

  /**
   * The accounts registry. Seeds a single default account (mapping to the
   * legacy un-suffixed keys) the first time it's read.
   */
  async getAccounts(): Promise<Account[]> {
    try {
      const raw = await AsyncStorage.getItem(KEYS.ACCOUNTS);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed as Account[];
      }
    } catch (error) {
      console.error('Error getting accounts:', error);
    }
    const seed: Account[] = [
      { id: DEFAULT_ACCOUNT_ID, name: 'Account 1', createdAt: Date.now() },
    ];
    try {
      await AsyncStorage.setItem(KEYS.ACCOUNTS, JSON.stringify(seed));
    } catch (error) {
      console.error('Error seeding accounts:', error);
    }
    return seed;
  }

  /** The active account id (defaults to the seeded default account). */
  async getCurrentAccountId(): Promise<string> {
    return this.ensureCurrentAccountId();
  }

  /** Switch the active account. Caller is responsible for re-hydrating state. */
  async setCurrentAccount(id: string): Promise<void> {
    this.currentAccountId = id;
    await AsyncStorage.setItem(KEYS.CURRENT_ACCOUNT, id);
  }

  /** Create a new (empty) account and return it. Does not switch to it. */
  async addAccount(name: string): Promise<Account> {
    const accounts = await this.getAccounts();
    const account: Account = {
      id: `acc_${Date.now().toString(36)}${Math.floor(Math.random() * 1e4).toString(36)}`,
      name: name.trim() || `Account ${accounts.length + 1}`,
      createdAt: Date.now(),
    };
    await AsyncStorage.setItem(
      KEYS.ACCOUNTS,
      JSON.stringify([...accounts, account]),
    );
    return account;
  }

  /** Rename an account; returns the updated registry. */
  async renameAccount(id: string, name: string): Promise<Account[]> {
    const accounts = await this.getAccounts();
    const updated = accounts.map((a) =>
      a.id === id ? { ...a, name: name.trim() || a.name } : a,
    );
    await AsyncStorage.setItem(KEYS.ACCOUNTS, JSON.stringify(updated));
    return updated;
  }

  /**
   * Delete an account and its four data slices. Never deletes the last account.
   * If the deleted account was active, switches to the first remaining one.
   * Returns the updated registry + the (possibly new) active account id.
   */
  async deleteAccount(
    id: string,
  ): Promise<{ accounts: Account[]; currentAccountId: string }> {
    const accounts = await this.getAccounts();
    if (accounts.length <= 1) {
      return { accounts, currentAccountId: await this.ensureCurrentAccountId() };
    }
    const remaining = accounts.filter((a) => a.id !== id);
    await AsyncStorage.setItem(KEYS.ACCOUNTS, JSON.stringify(remaining));
    await Promise.all([
      AsyncStorage.removeItem(keyFor(KEYS.FOLLOWER_DATA, id)),
      AsyncStorage.removeItem(keyFor(KEYS.WHITELIST, id)),
      AsyncStorage.removeItem(keyFor(KEYS.HISTORY, id)),
      AsyncStorage.removeItem(keyFor(KEYS.UNFOLLOWED, id)),
    ]);

    let current = await this.ensureCurrentAccountId();
    if (current === id) {
      current = remaining[0].id;
      await this.setCurrentAccount(current);
    }
    return { accounts: remaining, currentAccountId: current };
  }

  // ---- Per-account data -----------------------------------------------------

  /**
   * Save follower data
   */
  async saveFollowerData(data: FollowerData): Promise<void> {
    try {
      await this.writeValue(await this.k(KEYS.FOLLOWER_DATA), data, true);
    } catch (error) {
      console.error('Error saving follower data:', error);
      throw error;
    }
  }

  /**
   * Get follower data. Backfills missing derived fields (fans, unfollowers,
   * stats.fansCount) for data saved before those fields existed, and re-saves
   * the migrated copy so subsequent loads are clean.
   */
  async getFollowerData(): Promise<FollowerData | null> {
    try {
      const key = await this.k(KEYS.FOLLOWER_DATA);
      const parsed = await this.readValue<FollowerData>(key, true);
      if (!parsed) return null;
      const migrated = migrateFollowerData(parsed);
      if (migrated !== parsed) {
        await this.writeValue(key, migrated, true);
      }
      return migrated;
    } catch (error) {
      console.error('Error getting follower data:', error);
      return null;
    }
  }

  /**
   * Save whitelist
   */
  async saveWhitelist(whitelist: WhitelistUser[]): Promise<void> {
    try {
      await this.writeValue(await this.k(KEYS.WHITELIST), whitelist);
    } catch (error) {
      console.error('Error saving whitelist:', error);
      throw error;
    }
  }

  /**
   * Get whitelist
   */
  async getWhitelist(): Promise<WhitelistUser[]> {
    try {
      const data = await this.readValue<WhitelistUser[]>(await this.k(KEYS.WHITELIST));
      return data ?? [];
    } catch (error) {
      console.error('Error getting whitelist:', error);
      return [];
    }
  }

  /**
   * Add user to whitelist
   */
  async addToWhitelist(user: WhitelistUser): Promise<void> {
    try {
      const whitelist = await this.getWhitelist();
      const exists = whitelist.some(u => u.username === user.username);

      if (!exists) {
        whitelist.push(user);
        await this.saveWhitelist(whitelist);
      }
    } catch (error) {
      console.error('Error adding to whitelist:', error);
      throw error;
    }
  }

  /**
   * Set (or clear, when note is empty) the private note on a whitelist entry.
   * Returns the updated whitelist. C4.
   */
  async setWhitelistNote(username: string, note: string): Promise<WhitelistUser[]> {
    try {
      const whitelist = await this.getWhitelist();
      const updated = whitelist.map((u) =>
        u.username === username
          ? { ...u, note: note.trim() ? note.trim() : undefined }
          : u,
      );
      await this.saveWhitelist(updated);
      return updated;
    } catch (error) {
      console.error('Error setting whitelist note:', error);
      throw error;
    }
  }

  /**
   * Set (or clear, when category is null/empty) the private tag on a whitelist
   * entry. Returns the updated whitelist. C4.
   */
  async setWhitelistCategory(
    username: string,
    category: string | null,
  ): Promise<WhitelistUser[]> {
    try {
      const trimmed = category?.trim() ? category.trim() : undefined;
      const whitelist = await this.getWhitelist();
      const updated = whitelist.map((u) =>
        u.username === username ? { ...u, category: trimmed } : u,
      );
      await this.saveWhitelist(updated);
      return updated;
    } catch (error) {
      console.error('Error setting whitelist category:', error);
      throw error;
    }
  }

  /**
   * Remove user from whitelist
   */
  async removeFromWhitelist(username: string): Promise<void> {
    try {
      const whitelist = await this.getWhitelist();
      const filtered = whitelist.filter(u => u.username !== username);
      await this.saveWhitelist(filtered);
    } catch (error) {
      console.error('Error removing from whitelist:', error);
      throw error;
    }
  }

  /**
   * Remove multiple whitelist entries at once. Returns the updated list. C15b.
   */
  async removeManyFromWhitelist(usernames: string[]): Promise<WhitelistUser[]> {
    try {
      const set = new Set(usernames);
      const whitelist = await this.getWhitelist();
      const updated = whitelist.filter((u) => !set.has(u.username));
      await this.saveWhitelist(updated);
      return updated;
    } catch (error) {
      console.error('Error bulk-removing from whitelist:', error);
      throw error;
    }
  }

  /**
   * Append a historical snapshot (caps at last 50 entries)
   */
  async saveSnapshot(snapshot: HistoricalSnapshot): Promise<void> {
    try {
      const history = await this.getHistory();
      history.push(snapshot);
      const trimmed = history.slice(-50);
      await this.writeValue(await this.k(KEYS.HISTORY), trimmed);
    } catch (error) {
      console.error('Error saving snapshot:', error);
      throw error;
    }
  }

  /**
   * Get history (oldest → newest)
   */
  async getHistory(): Promise<HistoricalSnapshot[]> {
    try {
      const data = await this.readValue<HistoricalSnapshot[]>(await this.k(KEYS.HISTORY));
      return data ?? [];
    } catch (error) {
      console.error('Error getting history:', error);
      return [];
    }
  }

  /**
   * Clear history only
   */
  async clearHistory(): Promise<void> {
    try {
      await AsyncStorage.removeItem(await this.k(KEYS.HISTORY));
    } catch (error) {
      console.error('Error clearing history:', error);
      throw error;
    }
  }

  /**
   * Save unfollowed list
   */
  async saveUnfollowed(list: UnfollowedUser[]): Promise<void> {
    try {
      await this.writeValue(await this.k(KEYS.UNFOLLOWED), list);
    } catch (error) {
      console.error('Error saving unfollowed:', error);
      throw error;
    }
  }

  async getUnfollowed(): Promise<UnfollowedUser[]> {
    try {
      const data = await this.readValue<UnfollowedUser[]>(await this.k(KEYS.UNFOLLOWED));
      return data ?? [];
    } catch (error) {
      console.error('Error getting unfollowed:', error);
      return [];
    }
  }

  async addToUnfollowed(user: UnfollowedUser): Promise<void> {
    try {
      const list = await this.getUnfollowed();
      if (!list.some((u) => u.username === user.username)) {
        list.push(user);
        await this.saveUnfollowed(list);
      }
    } catch (error) {
      console.error('Error adding to unfollowed:', error);
      throw error;
    }
  }

  async removeFromUnfollowed(username: string): Promise<void> {
    try {
      const list = await this.getUnfollowed();
      await this.saveUnfollowed(list.filter((u) => u.username !== username));
    } catch (error) {
      console.error('Error removing from unfollowed:', error);
      throw error;
    }
  }

  /**
   * Remove multiple unfollowed entries at once. Returns the updated list. C15b.
   */
  async removeManyFromUnfollowed(usernames: string[]): Promise<UnfollowedUser[]> {
    try {
      const set = new Set(usernames);
      const list = await this.getUnfollowed();
      const updated = list.filter((u) => !set.has(u.username));
      await this.saveUnfollowed(updated);
      return updated;
    } catch (error) {
      console.error('Error bulk-removing from unfollowed:', error);
      throw error;
    }
  }

  // ---- Global, device-level prefs (shared across accounts) ------------------

  /**
   * Increment and return the lifetime successful-import count. Used to trigger
   * the store-review prompt after a few imports.
   */
  async incrementImportCount(): Promise<number> {
    try {
      const raw = await AsyncStorage.getItem(KEYS.IMPORT_COUNT);
      const next = (raw ? parseInt(raw, 10) || 0 : 0) + 1;
      await AsyncStorage.setItem(KEYS.IMPORT_COUNT, String(next));
      return next;
    } catch (error) {
      console.error('Error incrementing import count:', error);
      return 0;
    }
  }

  /**
   * Recent search terms (#11), newest-first, de-duped, capped. Global (shared
   * across accounts) — searching is a personal habit, not per-account data.
   */
  async getRecentSearches(): Promise<string[]> {
    try {
      const raw = await AsyncStorage.getItem(KEYS.RECENT_SEARCHES);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      console.error('Error getting recent searches:', error);
      return [];
    }
  }

  /** Record a term (trim, drop blanks, move to front, de-dupe, cap). #11. */
  async addRecentSearch(term: string): Promise<string[]> {
    try {
      const trimmed = term.trim();
      if (!trimmed) return this.getRecentSearches();
      const current = await this.getRecentSearches();
      const deduped = current.filter(
        (t) => t.toLowerCase() !== trimmed.toLowerCase(),
      );
      const updated = [trimmed, ...deduped].slice(0, MAX_RECENT_SEARCHES);
      await AsyncStorage.setItem(KEYS.RECENT_SEARCHES, JSON.stringify(updated));
      return updated;
    } catch (error) {
      console.error('Error adding recent search:', error);
      return this.getRecentSearches();
    }
  }

  async clearRecentSearches(): Promise<void> {
    try {
      await AsyncStorage.removeItem(KEYS.RECENT_SEARCHES);
    } catch (error) {
      console.error('Error clearing recent searches:', error);
    }
  }

  /**
   * Screenshot-blocking privacy preference (FLAG_SECURE). Defaults to off.
   */
  async getBlockScreenshots(): Promise<boolean> {
    try {
      return (await AsyncStorage.getItem(KEYS.BLOCK_SCREENSHOTS)) === 'true';
    } catch {
      return false;
    }
  }

  async setBlockScreenshots(enabled: boolean): Promise<void> {
    try {
      await AsyncStorage.setItem(KEYS.BLOCK_SCREENSHOTS, enabled ? 'true' : 'false');
    } catch (error) {
      console.error('Error saving screenshot preference:', error);
    }
  }

  /**
   * App-lock (biometric/passcode on launch) preference. Defaults to off. D1.
   */
  async getAppLock(): Promise<boolean> {
    try {
      return (await AsyncStorage.getItem(KEYS.APP_LOCK)) === 'true';
    } catch {
      return false;
    }
  }

  async setAppLock(enabled: boolean): Promise<void> {
    try {
      await AsyncStorage.setItem(KEYS.APP_LOCK, enabled ? 'true' : 'false');
    } catch (error) {
      console.error('Error saving app-lock preference:', error);
    }
  }

  /**
   * Wipe-on-tamper preference (D5). Erases everything after too many failed
   * unlock attempts. Only meaningful when app lock is on. Defaults to off.
   */
  async getWipeOnTamper(): Promise<boolean> {
    try {
      return (await AsyncStorage.getItem(KEYS.WIPE_ON_TAMPER)) === 'true';
    } catch {
      return false;
    }
  }

  async setWipeOnTamper(enabled: boolean): Promise<void> {
    try {
      await AsyncStorage.setItem(
        KEYS.WIPE_ON_TAMPER,
        enabled ? 'true' : 'false',
      );
    } catch (error) {
      console.error('Error saving wipe-on-tamper preference:', error);
    }
  }

  /** Failed-unlock count before a wipe fires (clamped). D5. */
  async getWipeThreshold(): Promise<number> {
    try {
      const raw = await AsyncStorage.getItem(KEYS.WIPE_THRESHOLD);
      const n = raw ? parseInt(raw, 10) : NaN;
      if (Number.isFinite(n)) {
        return Math.min(MAX_WIPE_THRESHOLD, Math.max(MIN_WIPE_THRESHOLD, n));
      }
    } catch {
      // fall through to default
    }
    return DEFAULT_WIPE_THRESHOLD;
  }

  async setWipeThreshold(n: number): Promise<void> {
    try {
      const clamped = Math.min(
        MAX_WIPE_THRESHOLD,
        Math.max(MIN_WIPE_THRESHOLD, Math.round(n)),
      );
      await AsyncStorage.setItem(KEYS.WIPE_THRESHOLD, String(clamped));
    } catch (error) {
      console.error('Error saving wipe threshold:', error);
    }
  }

  /**
   * Persisted failed-unlock counter (D5). Persisted (not in-memory) so a
   * force-quit between attempts can't reset it. Reset to 0 on a successful
   * unlock and after a wipe.
   */
  async getFailedUnlocks(): Promise<number> {
    try {
      const raw = await AsyncStorage.getItem(KEYS.FAILED_UNLOCKS);
      const n = raw ? parseInt(raw, 10) : 0;
      return Number.isFinite(n) && n > 0 ? n : 0;
    } catch {
      return 0;
    }
  }

  async incrementFailedUnlocks(): Promise<number> {
    try {
      const next = (await this.getFailedUnlocks()) + 1;
      await AsyncStorage.setItem(KEYS.FAILED_UNLOCKS, String(next));
      return next;
    } catch (error) {
      console.error('Error incrementing failed unlocks:', error);
      return 0;
    }
  }

  async resetFailedUnlocks(): Promise<void> {
    try {
      await AsyncStorage.removeItem(KEYS.FAILED_UNLOCKS);
    } catch (error) {
      console.error('Error resetting failed unlocks:', error);
    }
  }

  // ---- Notification reminders (#10) -----------------------------------------

  /** Reminder frequency in days (global). 0 = off. Validated against presets. */
  async getNotificationFrequency(): Promise<number> {
    try {
      const raw = await AsyncStorage.getItem(KEYS.NOTIFICATION_FREQUENCY);
      const n = raw ? parseInt(raw, 10) : NaN;
      if (Number.isFinite(n) && ALLOWED_NOTIFICATION_FREQUENCIES.includes(n)) {
        return n;
      }
    } catch {
      // fall through to default
    }
    return DEFAULT_NOTIFICATION_FREQUENCY;
  }

  async setNotificationFrequency(days: number): Promise<void> {
    try {
      const n = ALLOWED_NOTIFICATION_FREQUENCIES.includes(days)
        ? days
        : DEFAULT_NOTIFICATION_FREQUENCY;
      await AsyncStorage.setItem(KEYS.NOTIFICATION_FREQUENCY, String(n));
    } catch (error) {
      console.error('Error saving notification frequency:', error);
    }
  }

  /**
   * Full nuclear reset (D5 wipe-on-tamper). Removes EVERY key this app owns —
   * all accounts' data, the accounts registry, every device pref, AND the
   * onboarding flag — so the app drops back to a clean first-launch state with
   * no trace. Uses Promise.all(removeItem), never multiRemove (Expo Go rule).
   */
  async wipeEverything(): Promise<void> {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const ours = keys.filter((k) => k.startsWith(STORAGE_PREFIX));
      await Promise.all(ours.map((k) => AsyncStorage.removeItem(k)));
      // D2: also delete the at-rest master key from secure-store + clear caches.
      await deleteMasterKey();
      clearCachedMasterKey();
      this.storageEncryptedFlag = false;
      // Drop the cached account id so the next read re-seeds the default.
      this.currentAccountId = null;
    } catch (error) {
      console.error('Error wiping all data:', error);
      throw error;
    }
  }

  /**
   * Clear all data for the ACTIVE account (leaves other accounts untouched).
   */
  async clearAll(): Promise<void> {
    try {
      await Promise.all([
        AsyncStorage.removeItem(await this.k(KEYS.FOLLOWER_DATA)),
        AsyncStorage.removeItem(await this.k(KEYS.WHITELIST)),
        AsyncStorage.removeItem(await this.k(KEYS.HISTORY)),
        AsyncStorage.removeItem(await this.k(KEYS.UNFOLLOWED)),
      ]);
    } catch (error) {
      console.error('Error clearing data:', error);
      throw error;
    }
  }

  /**
   * Check if data exists for the active account
   */
  async hasData(): Promise<boolean> {
    try {
      const data = await AsyncStorage.getItem(await this.k(KEYS.FOLLOWER_DATA));
      return data !== null;
    } catch (error) {
      return false;
    }
  }
}

export const dataStore = new DataStore();

function migrateFollowerData(data: FollowerData): FollowerData {
  const followers = data.followers ?? [];
  const following = data.following ?? [];
  let changed = false;
  let { unfollowers, fans, stats } = data;

  if (!Array.isArray(unfollowers)) {
    const followerUsernames = new Set(followers.map((f) => f.username));
    unfollowers = following.filter((f) => !followerUsernames.has(f.username));
    changed = true;
  }

  if (!Array.isArray(fans)) {
    const followingUsernames = new Set(following.map((f) => f.username));
    fans = followers.filter((f) => !followingUsernames.has(f.username));
    changed = true;
  }

  if (!stats || typeof stats.fansCount !== 'number') {
    const mutual = following.length - unfollowers.length;
    stats = {
      followersCount: followers.length,
      followingCount: following.length,
      unfollowersCount: unfollowers.length,
      mutualFollows: mutual,
      followBackRatio:
        following.length > 0 ? (mutual / following.length) * 100 : 0,
      fansCount: fans.length,
    };
    changed = true;
  }

  if (!changed) return data;
  return { ...data, unfollowers, fans, stats };
}
