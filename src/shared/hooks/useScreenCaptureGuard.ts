import { useEffect } from 'react';
import * as ScreenCapture from 'expo-screen-capture';

const TAG = 'mutual-privacy';

/**
 * When enabled, blocks screenshots and screen recording app-wide (Android
 * FLAG_SECURE; iOS blocks screen recording and shows a blank capture). This is
 * the reliable cross-platform option — `addScreenshotListener` fires only after
 * the fact and is unreliable on Android, so we prevent capture instead of
 * reacting to it. Items C11 / D3.
 */
export function useScreenCaptureGuard(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    ScreenCapture.preventScreenCaptureAsync(TAG).catch(() => {});
    return () => {
      ScreenCapture.allowScreenCaptureAsync(TAG).catch(() => {});
    };
  }, [enabled]);
}
