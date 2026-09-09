import { Platform } from 'react-native';

/**
 * What the current platform can actually deliver.
 *
 * Mutual's security features lean on things only a mobile OS provides — a
 * hardware keystore, FLAG_SECURE, a biometric prompt, an alarm scheduler, a
 * home screen. A browser has none of them, and the failure mode is quiet: the
 * toggle flips, the switch turns the success colour, and nothing happens. A
 * privacy control that lies is worse than one that is plainly absent, so on web
 * these features are HIDDEN rather than shown broken.
 *
 * Every flag below is `!isWeb` rather than a platform allow-list, so native
 * behaviour is bit-for-bit what it was before web existed.
 */
export const isWeb = Platform.OS === 'web';

/** D1 app lock. No `expo-local-authentication` on web — its web module is a stub. */
export const canLockApp = !isWeb;

/** D3 screenshot block. No web API exists at all; a page cannot refuse capture. */
export const canBlockScreenshots = !isWeb;

/** D5 wipe-on-tamper. Rides on the app lock, and DevTools can read IndexedDB anyway. */
export const canWipeOnTamper = !isWeb;

/**
 * D2 encryption at rest. Available everywhere, by different means: native keeps
 * a key in the device Keychain/Keystore, web generates a NON-EXTRACTABLE
 * WebCrypto key and stores the handle in IndexedDB, where no script can read
 * its bytes back out.
 *
 * The guarantees are NOT equivalent. On web the key lives in the same browser
 * profile as the ciphertext, so encryption there means "not readable text in
 * storage, and no page can steal the key" — not "safe from someone holding the
 * machine". Android backs its key with a hardware keystore and pairs it with an
 * app lock; web has neither. See the threat-model note at the top of
 * `atRestCrypto.web.ts` before writing any user-facing copy about this.
 */
export const canEncryptAtRest = true;

/** C10 home-screen widget. Android-only feature; a browser has no home screen. */
export const canUseWidget = !isWeb;

/**
 * #10 import reminders. Chrome abandoned the Notification Triggers API, so
 * there is no way to schedule a future local notification without a push
 * server — and a push server would mean network calls in a no-network app.
 */
export const canScheduleReminders = !isWeb;

/**
 * True when the platform supports the device-protection block as a whole.
 * Settings uses this to drop the entire toggle card in one piece, since every
 * control in it is device-only.
 */
export const hasDeviceProtections =
  canLockApp &&
  canBlockScreenshots &&
  canWipeOnTamper &&
  canUseWidget &&
  canScheduleReminders;
