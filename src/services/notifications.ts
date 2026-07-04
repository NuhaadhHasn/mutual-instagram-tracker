import { Platform } from 'react-native';
import Constants, { ExecutionEnvironment } from 'expo-constants';

/**
 * Local, opt-in "time to re-import your data" reminders (#10).
 *
 * 100% local — NO push tokens, NO network (consistent with Mutual's no-network
 * guarantee; local notifications don't need the INTERNET permission).
 *
 * ⚠️ Expo Go: importing `expo-notifications` in Expo Go (SDK 53+) THROWS a fatal
 * "remote push removed from Expo Go" error at module-load time (its module
 * registers a push-token listener on import). So we must NEVER pull it into the
 * module graph in Expo Go. We therefore:
 *   1) detect Expo Go via expo-constants and short-circuit (never require it), and
 *   2) lazy-`require` it (not a static import) inside a try/catch so it stays out
 *      of the startup bundle and any failure degrades gracefully.
 * Result: in Expo Go the feature is cleanly unavailable; in a dev/production
 * build local notifications work normally. `import type` below is erased at
 * compile time, so it does NOT trigger a runtime load.
 */

const IMPORT_REMINDER_ID = 'import-reminder';
const ANDROID_CHANNEL_ID = 'import-reminders';
const MS_PER_DAY = 24 * 60 * 60 * 1000;
const OVERDUE_DELAY_DAYS = 1;
const REMINDER_HOUR = 11; // local time of day the reminder fires

const COPY = {
  title: 'Time to refresh Mutual',
  body: (days: number): string =>
    `It's been ${days} ${days === 1 ? 'day' : 'days'} since your last update — import your latest data to see who changed.`,
};

const isExpoGo =
  Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

// Lazily-resolved expo-notifications module. `undefined` = not tried yet,
// `null` = unavailable (Expo Go or load failure). Never statically imported.
let _mod: typeof import('expo-notifications') | null | undefined;

function getNotifications(): typeof import('expo-notifications') | null {
  if (_mod !== undefined) return _mod;
  if (isExpoGo) {
    _mod = null; // never require in Expo Go — it would throw a fatal redbox
    return _mod;
  }
  try {
    _mod = require('expo-notifications') as typeof import('expo-notifications');
  } catch {
    _mod = null;
  }
  return _mod;
}

/** Is the native notifications module present and usable (i.e. not Expo Go)? */
export function isAvailable(): boolean {
  const N = getNotifications();
  return !!N && typeof N.scheduleNotificationAsync === 'function';
}

/** Set the in-app foreground presentation behaviour once (no sound/badge). */
export function configureForegroundHandler(): void {
  const N = getNotifications();
  if (!N) return;
  try {
    N.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: false,
        shouldSetBadge: false,
      }),
    });
  } catch {
    // non-fatal
  }
}

/** True if notification permission is currently granted. */
export async function hasPermission(): Promise<boolean> {
  const N = getNotifications();
  if (!N) return false;
  try {
    const { status } = await N.getPermissionsAsync();
    return status === 'granted';
  } catch {
    return false;
  }
}

/** Request permission (no-op prompt if already granted / permanently denied). */
export async function requestPermission(): Promise<boolean> {
  const N = getNotifications();
  if (!N) return false;
  try {
    const existing = await N.getPermissionsAsync();
    if (existing.status === 'granted') return true;
    if (!existing.canAskAgain && existing.status === 'denied') return false;
    const req = await N.requestPermissionsAsync();
    return req.status === 'granted';
  } catch {
    return false;
  }
}

/** Create the Android notification channel (no-op on iOS / when unavailable). */
export async function ensureAndroidChannel(): Promise<void> {
  const N = getNotifications();
  if (!N || Platform.OS !== 'android') return;
  try {
    await N.setNotificationChannelAsync(ANDROID_CHANNEL_ID, {
      name: 'Import reminders',
      importance: N.AndroidImportance.DEFAULT,
      vibrationPattern: [0, 200],
      lockscreenVisibility: N.AndroidNotificationVisibility.PRIVATE,
    });
  } catch {
    // ignore
  }
}

/** Cancel the scheduled reminder (if any). */
export async function cancelImportReminder(): Promise<void> {
  const N = getNotifications();
  if (!N) return;
  try {
    await N.cancelScheduledNotificationAsync(IMPORT_REMINDER_ID);
  } catch {
    // ignore
  }
}

/**
 * Compute the next fire date: `anchor + frequency`, snapped to REMINDER_HOUR
 * local. If that instant is already past, fire tomorrow instead (never a past
 * clock time).
 */
function computeFireDate(frequencyDays: number, anchor: number): Date {
  const d = new Date(anchor + frequencyDays * MS_PER_DAY);
  d.setHours(REMINDER_HOUR, 0, 0, 0);
  const now = Date.now();
  if (d.getTime() <= now) {
    const soon = new Date(now + OVERDUE_DELAY_DAYS * MS_PER_DAY);
    soon.setHours(REMINDER_HOUR, 0, 0, 0);
    if (soon.getTime() <= now) soon.setTime(soon.getTime() + MS_PER_DAY);
    return soon;
  }
  return d;
}

/**
 * Schedule the import reminder. Cancels any existing one first (cancel+replace
 * under a single id). `frequencyDays <= 0` means "off" — just cancel.
 */
export async function scheduleImportReminder(
  frequencyDays: number,
  lastImportAt: number | null,
): Promise<void> {
  const N = getNotifications();
  if (!N) return;
  await cancelImportReminder();
  if (!frequencyDays || frequencyDays <= 0) return; // Off
  await ensureAndroidChannel();
  const anchor = lastImportAt ?? Date.now();
  const fireDate = computeFireDate(frequencyDays, anchor);
  const elapsedDays = Math.max(
    1,
    Math.round((fireDate.getTime() - anchor) / MS_PER_DAY),
  );
  const trigger: import('expo-notifications').DateTriggerInput = {
    type: N.SchedulableTriggerInputTypes.DATE,
    date: fireDate,
    ...(Platform.OS === 'android' ? { channelId: ANDROID_CHANNEL_ID } : {}),
  };
  try {
    await N.scheduleNotificationAsync({
      identifier: IMPORT_REMINDER_ID,
      content: {
        title: COPY.title,
        body: COPY.body(elapsedDays),
      },
      trigger,
    });
  } catch {
    // scheduling failure is non-fatal
  }
}

/**
 * Re-read the stored frequency + last-import time and reschedule accordingly.
 * Cancels if disabled or permission was revoked. Uses a dynamic import of
 * dataStore to avoid an import cycle. Safe to call on launch, foreground, and
 * after every import; no-ops entirely when notifications are unavailable.
 */
export async function rescheduleFromState(): Promise<void> {
  if (!isAvailable()) return;
  try {
    const { dataStore } = await import('./storage/dataStore');
    const freq = await dataStore.getNotificationFrequency();
    if (!freq || freq <= 0) {
      await cancelImportReminder();
      return;
    }
    if (!(await hasPermission())) {
      await cancelImportReminder();
      return;
    }
    const history = await dataStore.getHistory();
    // history isn't guaranteed date-sorted (restore can reorder) — take the max.
    const lastImportAt = history.length
      ? Math.max(...history.map((h) => h.date))
      : null;
    await scheduleImportReminder(freq, lastImportAt);
  } catch {
    // ignore
  }
}
