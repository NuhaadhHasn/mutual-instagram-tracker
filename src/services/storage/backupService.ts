import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import { dataStore } from './dataStore';
import {
  FollowerData,
  HistoricalSnapshot,
  UnfollowedUser,
  WhitelistUser,
} from '../../shared/types';

const BACKUP_VERSION = 1;
const APP = 'mutual';

export interface BackupPayload {
  app: typeof APP;
  version: number;
  exportedAt: number;
  followerData: FollowerData | null;
  whitelist: WhitelistUser[];
  unfollowed: UnfollowedUser[];
  history: HistoricalSnapshot[];
}

export const backupService = {
  /**
   * Build a backup JSON file from current AsyncStorage state and open the
   * OS share sheet so the user can save it anywhere they like.
   */
  async exportToFile(): Promise<void> {
    const [followerData, whitelist, unfollowed, history] = await Promise.all([
      dataStore.getFollowerData(),
      dataStore.getWhitelist(),
      dataStore.getUnfollowed(),
      dataStore.getHistory(),
    ]);

    const payload: BackupPayload = {
      app: APP,
      version: BACKUP_VERSION,
      exportedAt: Date.now(),
      followerData,
      whitelist,
      unfollowed,
      history,
    };

    const today = new Date().toISOString().split('T')[0];
    const fileName = `mutual-backup_${today}.json`;
    const fileUri = (FileSystem.documentDirectory ?? '') + fileName;
    await FileSystem.writeAsStringAsync(fileUri, JSON.stringify(payload, null, 2), {
      encoding: FileSystem.EncodingType.UTF8,
    });

    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(fileUri, {
        mimeType: 'application/json',
        dialogTitle: 'Save Mutual backup',
        UTI: 'public.json',
      });
    }
  },

  /**
   * Pick a backup JSON, validate it, write to AsyncStorage. Returns the
   * decoded payload so the caller can refresh the Zustand store.
   */
  async restoreFromFile(): Promise<BackupPayload> {
    const result = await DocumentPicker.getDocumentAsync({
      type: ['application/json', 'text/plain', '*/*'],
      copyToCacheDirectory: true,
    });

    if (result.canceled || !result.assets || result.assets.length === 0) {
      throw new Error('File selection cancelled');
    }

    const uri = result.assets[0].uri;
    const raw = await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.UTF8,
    });

    let parsed: any;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new Error('That file is not valid JSON.');
    }

    if (!parsed || parsed.app !== APP) {
      throw new Error('That file does not look like a Mutual backup.');
    }
    if (typeof parsed.version !== 'number') {
      throw new Error('Backup is missing a version number.');
    }
    if (parsed.version > BACKUP_VERSION) {
      throw new Error(
        'This backup was made by a newer version of Mutual. Update the app and try again.',
      );
    }

    const payload: BackupPayload = {
      app: APP,
      version: parsed.version,
      exportedAt: typeof parsed.exportedAt === 'number' ? parsed.exportedAt : Date.now(),
      followerData: parsed.followerData ?? null,
      whitelist: Array.isArray(parsed.whitelist) ? parsed.whitelist : [],
      unfollowed: Array.isArray(parsed.unfollowed) ? parsed.unfollowed : [],
      history: Array.isArray(parsed.history) ? parsed.history : [],
    };

    // Wipe current state and write the restored copy.
    await dataStore.clearAll();
    if (payload.followerData) {
      await dataStore.saveFollowerData(payload.followerData);
    }
    if (payload.whitelist.length > 0) {
      await dataStore.saveWhitelist(payload.whitelist);
    }
    if (payload.unfollowed.length > 0) {
      await dataStore.saveUnfollowed(payload.unfollowed);
    }
    // History uses saveSnapshot one-by-one; here we write directly via the
    // public method to preserve the existing 50-snapshot cap.
    for (const snap of payload.history.slice(-50)) {
      await dataStore.saveSnapshot(snap);
    }

    return payload;
  },
};
