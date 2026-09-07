import React from 'react';
import type { WidgetTaskHandlerProps } from 'react-native-android-widget';

import { dataStore } from '../../services/storage/dataStore';
import { MutualSummaryWidget } from './MutualSummaryWidget';

/**
 * Headless task that Android invokes to paint the widget (C10).
 *
 * ⚠️ Reached ONLY via the lazy `require` in `src/services/widget.ts` — never
 * import this from a screen, App.tsx or index.ts (it value-imports the native
 * library, which is a fatal Expo Go redbox at module load).
 *
 * ⚠️ NEVER read the D2-encrypted keys here. A headless task is a FRESH JS
 * context: the in-memory master-key cache is cold, so `getFollowerData()` would
 * silently return null and the widget would render blank for every user who has
 * encryption-at-rest enabled. That is exactly why `widget_summary` is a separate
 * plaintext, aggregate-only key read via `getWidgetSummary()`.
 */

const WIDGET_NAME = 'MutualSummary';

/**
 * Shared renderer, also used by `requestWidgetUpdate` from the app side.
 * `info` carries the launcher's MEASURED size (dp) so the widget can pick a
 * compact or full layout — without it the widget always drew the full grid and
 * looked empty at small sizes.
 */
export function renderMutualWidget(
  summary: Awaited<ReturnType<typeof dataStore.getWidgetSummary>>,
  info?: { width: number; height: number },
) {
  return (
    <MutualSummaryWidget
      summary={summary}
      width={info?.width}
      height={info?.height}
    />
  );
}

export const widgetTaskHandler = async (
  props: WidgetTaskHandlerProps,
): Promise<void> => {
  // An unhandled throw in a headless task surfaces as a background crash/ANR,
  // so the entire body is defensive.
  try {
    if (props.widgetInfo.widgetName !== WIDGET_NAME) return;

    switch (props.widgetAction) {
      case 'WIDGET_ADDED':
      case 'WIDGET_UPDATE':
      case 'WIDGET_RESIZED':
      case 'WIDGET_CLICK': {
        // Plaintext, aggregate-only read — no decrypt, no master key needed.
        const summary = await dataStore.getWidgetSummary();
        props.renderWidget(renderMutualWidget(summary, props.widgetInfo));
        break;
      }
      case 'WIDGET_DELETED':
      default:
        // Nothing to clean up: the widget owns no timers or listeners.
        break;
    }
  } catch (error) {
    console.warn('Widget task handler failed:', error);
  }
};
