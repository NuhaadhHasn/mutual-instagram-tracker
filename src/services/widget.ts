import { Platform } from 'react-native';
import Constants, { ExecutionEnvironment } from 'expo-constants';

import { dataStore } from './storage/dataStore';
import { buildWidgetSummary } from '../shared/utils/widgetSummary';
import type { AnalyticsStats } from '../shared/types';

/**
 * Android home-screen widget bridge (C10).
 *
 * ⚠️ THE GUARD. `react-native-android-widget` resolves its native module via
 * `TurboModuleRegistry.getEnforcing('AndroidWidget')`, which THROWS when the
 * module is absent — and under the New Architecture (default on SDK 55) its
 * `dummyModuleProxy` fallback is dead code. So an eager import is a fatal
 * Expo Go redbox at module-load time, exactly like `expo-notifications`.
 * We therefore mirror `./notifications.ts`:
 *   1) detect Expo Go via expo-constants and short-circuit (never require it), and
 *   2) lazy-`require` inside try/catch so failure degrades gracefully.
 * `typeof import(...)` below is a TYPE position only — erased at compile time,
 * so it never triggers a runtime load.
 *
 * INVARIANT: this file is the ONLY module allowed to reach
 * `src/features/widget/*`, and `src/features/widget/*` is the only place allowed
 * to *value*-import `react-native-android-widget`.
 *
 * Storage writes deliberately happen OUTSIDE the availability guard, so the
 * summary key stays correct even in Expo Go — only the native repaint no-ops.
 */

const WIDGET_NAME = 'MutualSummary';

const isExpoGo =
  Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

// `undefined` = not tried yet, `null` = unavailable (Expo Go / non-Android /
// load failure). Never statically imported.
let _mod: typeof import('react-native-android-widget') | null | undefined;

function getWidgetMod(): typeof import('react-native-android-widget') | null {
  if (_mod !== undefined) return _mod;
  if (isExpoGo || Platform.OS !== 'android') {
    _mod = null;
    return _mod;
  }
  try {
    _mod = require('react-native-android-widget') as typeof import('react-native-android-widget');
  } catch {
    _mod = null;
  }
  return _mod;
}

/** Is the native widget module present and usable (i.e. a real Android build)? */
export function isAvailable(): boolean {
  const W = getWidgetMod();
  return !!W && typeof W.registerWidgetTaskHandler === 'function';
}

/**
 * Register the headless task that renders the widget. Called once from
 * `index.ts`. No-ops in Expo Go / on iOS.
 */
export function registerWidgetTask(): void {
  const W = getWidgetMod();
  if (!W) return;
  try {
    // Lazy-required so the widget UI never enters an eagerly-evaluated path.
    const { widgetTaskHandler } = require('../features/widget/widgetTaskHandler') as
      typeof import('../features/widget/widgetTaskHandler');
    W.registerWidgetTaskHandler(widgetTaskHandler);
  } catch (error) {
    console.warn('Widget task registration failed:', error);
  }
}

/** Ask Android to repaint any placed widget now. No-ops when unavailable. */
export async function requestUpdate(): Promise<void> {
  const W = getWidgetMod();
  if (!W) return;
  try {
    const { renderMutualWidget } = require('../features/widget/widgetTaskHandler') as
      typeof import('../features/widget/widgetTaskHandler');
    const summary = await dataStore.getWidgetSummary();
    await W.requestWidgetUpdate({
      widgetName: WIDGET_NAME,
      renderWidget: () => renderMutualWidget(summary),
    });
  } catch (error) {
    console.warn('Widget update failed:', error);
  }
}

/**
 * Write the aggregate summary for the ACTIVE account, then repaint.
 * Safe to call anywhere — the write works in Expo Go, the repaint no-ops.
 */
export async function refreshSummary(
  stats: AnalyticsStats,
  lastUpdated: number,
): Promise<void> {
  try {
    const accountId = await dataStore.getCurrentAccountId();
    const accounts = await dataStore.getAccounts();
    const name = accounts.find((a) => a.id === accountId)?.name ?? 'default';
    await dataStore.saveWidgetSummary(
      buildWidgetSummary(stats, name, lastUpdated),
    );
  } catch (error) {
    console.warn('Widget summary write failed:', error);
    return;
  }
  await requestUpdate();
}

/**
 * Refresh only if the user opted in. Reads current data itself so callers stay
 * one line (used from app init, after an import, and on account switch).
 */
export async function refreshIfEnabled(): Promise<void> {
  try {
    if (!(await dataStore.getWidgetEnabled())) return;
    const data = await dataStore.getFollowerData();
    if (!data) return;
    await refreshSummary(data.stats, data.lastUpdated);
  } catch (error) {
    console.warn('Widget refresh skipped:', error);
  }
}

/** Turn the widget off: drop the stored counts and repaint to the empty state. */
export async function disableWidget(): Promise<void> {
  await dataStore.clearWidgetSummary();
  await requestUpdate();
}
