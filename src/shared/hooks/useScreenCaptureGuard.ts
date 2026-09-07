import { useEffect } from 'react';
import * as ScreenCapture from 'expo-screen-capture';

import { useAppStore } from '../store/appStore';

const TAG = 'mutual-privacy';

/**
 * When enabled, blocks screenshots and screen recording app-wide (Android
 * FLAG_SECURE; iOS blocks screen recording and shows a blank capture). This is
 * the reliable cross-platform option — `addScreenshotListener` fires only after
 * the fact and is unreliable on Android, so we prevent capture instead of
 * reacting to it. Items C11 / D3.
 *
 * ⚠️ This hook used to end both calls with `.catch(() => {})`, which silently
 * discarded failures. Because the Settings switch renders the `blockScreenshots`
 * PREFERENCE, a failed `preventScreenCaptureAsync` left the toggle reading "on"
 * — in the success colour — while nothing was actually blocked. A privacy
 * control that lies is worse than one that is plainly unavailable, so the real
 * outcome is now recorded in `screenshotGuardFailed` and surfaced in Settings.
 */
export function useScreenCaptureGuard(enabled: boolean) {
  const setScreenshotGuardFailed = useAppStore((s) => s.setScreenshotGuardFailed);

  useEffect(() => {
    if (!enabled) {
      // Not asked for → not "failed". Clear any stale warning from a previous
      // enable so the row doesn't keep warning after the user turns it off.
      setScreenshotGuardFailed(false);
      return;
    }

    let cancelled = false;

    ScreenCapture.preventScreenCaptureAsync(TAG)
      .then(() => {
        if (!cancelled) setScreenshotGuardFailed(false);
      })
      .catch((error) => {
        // Never swallow: the user believes they are protected.
        console.warn('Screenshot block could not be applied:', error);
        if (!cancelled) setScreenshotGuardFailed(true);
      });

    return () => {
      cancelled = true;
      ScreenCapture.allowScreenCaptureAsync(TAG).catch((error) => {
        // Failing to RELEASE the block is not a privacy risk (it fails closed —
        // capture stays blocked), so it must not set the warning flag. Still log
        // it rather than hiding it.
        console.warn('Screenshot block could not be released:', error);
      });
    };
  }, [enabled, setScreenshotGuardFailed]);
}
