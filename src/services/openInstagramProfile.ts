import { Linking } from 'react-native';

/**
 * Open a user's Instagram profile, preferring the native Instagram app over the
 * browser. We try the `instagram://` deep link first; if no handler picks it up
 * (app not installed, or the scheme isn't whitelisted) we fall back to the web
 * profile URL. Any failure degrades silently — this is a best-effort hand-off.
 *
 * SAFE pattern per IMPROVEMENTS.md A3 / Section B: this app is only the launcher.
 * Instagram performs every action through its own UI on the user's tap. We never
 * touch IG's automation surface, so there is zero account-ban risk.
 *
 * Note: on Android 11+ a production build should list `instagram` under
 * `android.queries` (and iOS under `LSApplicationQueriesSchemes`) for the
 * cleanest behaviour, but the try/catch fallback works regardless.
 */
export async function openInstagramProfile(
  username: string,
  fallbackUrl?: string,
): Promise<void> {
  const webUrl = fallbackUrl || `https://instagram.com/${username}`;
  const appUrl = `instagram://user?username=${encodeURIComponent(username)}`;

  // Try the app scheme via openURL directly. openURL (unlike canOpenURL) doesn't
  // require the scheme to be in Android's <queries> allowlist, so this opens the
  // Instagram app whenever it's installed and rejects otherwise — at which point
  // we fall back to the web profile.
  try {
    await Linking.openURL(appUrl);
    return;
  } catch {
    // App not installed / scheme unhandled — fall through to the browser.
  }

  try {
    await Linking.openURL(webUrl);
  } catch {
    // Nothing more we can do; swallow so the UI doesn't crash.
  }
}
