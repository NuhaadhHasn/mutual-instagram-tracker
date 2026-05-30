import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  FollowerData,
  HistoricalSnapshot,
  UnfollowedUser,
  WhitelistUser,
} from '../../shared/types';

const KEYS = {
  FOLLOWER_DATA: '@instagram_tracker:follower_data',
  WHITELIST: '@instagram_tracker:whitelist',
  HISTORY: '@instagram_tracker:history',
  UNFOLLOWED: '@instagram_tracker:unfollowed',
  IMPORT_COUNT: '@instagram_tracker:import_count',
  BLOCK_SCREENSHOTS: '@instagram_tracker:block_screenshots',
  APP_LOCK: '@instagram_tracker:app_lock',
};

export class DataStore {
  /**
   * Save follower data
   */
  async saveFollowerData(data: FollowerData): Promise<void> {
    try {
      await AsyncStorage.setItem(KEYS.FOLLOWER_DATA, JSON.stringify(data));
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
      const raw = await AsyncStorage.getItem(KEYS.FOLLOWER_DATA);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as FollowerData;
      const migrated = migrateFollowerData(parsed);
      if (migrated !== parsed) {
        await AsyncStorage.setItem(KEYS.FOLLOWER_DATA, JSON.stringify(migrated));
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
      await AsyncStorage.setItem(KEYS.WHITELIST, JSON.stringify(whitelist));
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
      const data = await AsyncStorage.getItem(KEYS.WHITELIST);
      return data ? JSON.parse(data) : [];
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
      await AsyncStorage.setItem(KEYS.HISTORY, JSON.stringify(trimmed));
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
      const data = await AsyncStorage.getItem(KEYS.HISTORY);
      return data ? JSON.parse(data) : [];
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
      await AsyncStorage.removeItem(KEYS.HISTORY);
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
      await AsyncStorage.setItem(KEYS.UNFOLLOWED, JSON.stringify(list));
    } catch (error) {
      console.error('Error saving unfollowed:', error);
      throw error;
    }
  }

  async getUnfollowed(): Promise<UnfollowedUser[]> {
    try {
      const data = await AsyncStorage.getItem(KEYS.UNFOLLOWED);
      return data ? JSON.parse(data) : [];
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
   * Clear all data
   */
  async clearAll(): Promise<void> {
    try {
      await Promise.all([
        AsyncStorage.removeItem(KEYS.FOLLOWER_DATA),
        AsyncStorage.removeItem(KEYS.WHITELIST),
        AsyncStorage.removeItem(KEYS.HISTORY),
        AsyncStorage.removeItem(KEYS.UNFOLLOWED),
      ]);
    } catch (error) {
      console.error('Error clearing data:', error);
      throw error;
    }
  }

  /**
   * Check if data exists
   */
  async hasData(): Promise<boolean> {
    try {
      const data = await AsyncStorage.getItem(KEYS.FOLLOWER_DATA);
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
