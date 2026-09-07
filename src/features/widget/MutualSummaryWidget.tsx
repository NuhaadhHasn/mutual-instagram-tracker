import React from 'react';
import { FlexWidget, TextWidget } from 'react-native-android-widget';

import type { WidgetSummary } from '../../shared/types';
import { formatWidgetCount, formatWidgetDate } from '../../shared/utils/widgetSummary';

/**
 * Android home-screen widget UI (C10).
 *
 * ⚠️ This file VALUE-imports `react-native-android-widget`, which is only safe
 * because nothing evaluates this module eagerly — it is reached exclusively via
 * the lazy `require` in `src/services/widget.ts`. Do NOT import it from a screen,
 * App.tsx, or index.ts.
 *
 * Renders AGGREGATE COUNTS ONLY. A widget stays visible while the D1 app lock is
 * engaged, so usernames (and the ghost/bot lists) must never appear here.
 *
 * No `useTheme()` / no hooks: a widget has no React context and no theme — the
 * brand gradient is hardcoded and reads correctly in both light and dark.
 *
 * RESPONSIVE. The first version used `justifyContent: 'space-between'` on a
 * fixed 3-stat layout, so the taller the widget got the emptier it looked, and
 * `minWidth/minHeight` were set so high the launcher refused to shrink it — a
 * large tile showing 3 of the 6 numbers we already store. Now the layout is
 * chosen from the measured size the launcher gives us:
 *   - COMPACT (short/narrow): one hero number, no wasted rows.
 *   - FULL: all six stats in a 3x2 grid whose rows FLEX to fill the height,
 *     so there is no dead space at any size.
 */

// Brand gradient (matches assets/icon.svg) — white text is legible on both stops.
const GRADIENT_FROM = '#833AB4';
const GRADIENT_TO = '#E1306C';
const WHITE = '#FFFFFF';
const MUTED = 'rgba(255, 255, 255, 0.75)';
const FAINT = 'rgba(255, 255, 255, 0.6)';

/** Below this height (dp) there is no room for a grid — show one number. */
const COMPACT_MAX_HEIGHT = 110;
/** Below this width (dp) three columns would be unreadable. */
const COMPACT_MAX_WIDTH = 160;

interface StatProps {
  label: string;
  value: string;
  size?: number;
}

/** One grid cell. `flex: 1` so a row divides its width evenly. */
function Stat({ label, value, size = 20 }: StatProps) {
  return (
    <FlexWidget
      style={{
        flex: 1,
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <TextWidget
        text={value}
        style={{ fontSize: size, fontWeight: 'bold', color: WHITE }}
      />
      <TextWidget
        text={label}
        style={{ fontSize: 9, color: MUTED, letterSpacing: 0.3 }}
        maxLines={1}
      />
    </FlexWidget>
  );
}

/** A grid row that expands to share the leftover height evenly. */
function Row({ children }: { children: React.ReactNode }) {
  return (
    <FlexWidget
      style={{
        flex: 1,
        width: 'match_parent',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}
    >
      {children}
    </FlexWidget>
  );
}

function Shell({
  children,
  padding,
}: {
  children: React.ReactNode;
  padding: number;
}) {
  return (
    <FlexWidget
      clickAction="OPEN_APP"
      accessibilityLabel="Mutual follower summary. Opens the app."
      style={{
        height: 'match_parent',
        width: 'match_parent',
        flexDirection: 'column',
        paddingHorizontal: padding,
        paddingVertical: padding,
        borderRadius: 16,
        backgroundGradient: {
          from: GRADIENT_FROM,
          to: GRADIENT_TO,
          orientation: 'TL_BR',
        },
      }}
    >
      {children}
    </FlexWidget>
  );
}

export interface MutualSummaryWidgetProps {
  summary: WidgetSummary | null;
  /** Measured size from the launcher, in dp. Absent → assume the full layout. */
  width?: number;
  height?: number;
}

export function MutualSummaryWidget({
  summary,
  width,
  height,
}: MutualSummaryWidgetProps) {
  const compact =
    (typeof height === 'number' && height < COMPACT_MAX_HEIGHT) ||
    (typeof width === 'number' && width < COMPACT_MAX_WIDTH);

  // ---- Empty state. Never show zeros pretending to be data. ----------------
  if (!summary) {
    return (
      <Shell padding={compact ? 10 : 14}>
        <FlexWidget
          style={{
            flex: 1,
            width: 'match_parent',
            flexDirection: 'column',
            justifyContent: 'center',
          }}
        >
          <TextWidget
            text="Mutual"
            style={{
              fontSize: 11,
              fontWeight: 'bold',
              color: WHITE,
              letterSpacing: 0.6,
            }}
          />
          <TextWidget
            text="Tap to import your data"
            style={{ fontSize: compact ? 11 : 13, color: MUTED }}
            maxLines={2}
          />
        </FlexWidget>
      </Shell>
    );
  }

  // ---- COMPACT: one number that answers the actual question. ---------------
  if (compact) {
    return (
      <Shell padding={10}>
        <FlexWidget
          style={{
            flex: 1,
            width: 'match_parent',
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <FlexWidget style={{ flexDirection: 'column' }}>
            <TextWidget
              text={formatWidgetCount(summary.unfollowers)}
              style={{ fontSize: 26, fontWeight: 'bold', color: WHITE }}
            />
            <TextWidget
              text="NOT FOLLOWING BACK"
              style={{ fontSize: 8, color: MUTED, letterSpacing: 0.3 }}
              maxLines={1}
            />
          </FlexWidget>
          <FlexWidget style={{ flexDirection: 'column', alignItems: 'flex-end' }}>
            <TextWidget
              text="Mutual"
              style={{ fontSize: 10, fontWeight: 'bold', color: WHITE }}
            />
            <TextWidget
              text={`${formatWidgetCount(summary.followers)} followers`}
              style={{ fontSize: 9, color: FAINT }}
              maxLines={1}
            />
          </FlexWidget>
        </FlexWidget>
      </Shell>
    );
  }

  // ---- FULL: all six stored numbers, rows flexing to fill the height. -----
  return (
    <Shell padding={12}>
      <FlexWidget
        style={{
          width: 'match_parent',
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <TextWidget
          text="Mutual"
          style={{
            fontSize: 11,
            fontWeight: 'bold',
            color: WHITE,
            letterSpacing: 0.6,
          }}
        />
        <TextWidget
          text={`${summary.accountName} · ${formatWidgetDate(summary.lastUpdated)}`}
          style={{ fontSize: 9, color: FAINT }}
          truncate="END"
          maxLines={1}
        />
      </FlexWidget>

      <Row>
        <Stat label="FOLLOWERS" value={formatWidgetCount(summary.followers)} />
        <Stat label="FOLLOWING" value={formatWidgetCount(summary.following)} />
        <Stat label="MUTUAL" value={formatWidgetCount(summary.mutual)} />
      </Row>
      <Row>
        <Stat label="NOT BACK" value={formatWidgetCount(summary.unfollowers)} />
        <Stat label="FANS" value={formatWidgetCount(summary.fans)} />
        <Stat
          label="FOLLOW-BACK"
          value={`${Math.round(summary.followBackRatio)}%`}
        />
      </Row>
    </Shell>
  );
}
