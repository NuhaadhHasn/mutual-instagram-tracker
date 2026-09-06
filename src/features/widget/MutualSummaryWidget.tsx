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
 */

// Brand gradient (matches assets/icon.svg) — white text is legible on both stops.
const GRADIENT_FROM = '#833AB4';
const GRADIENT_TO = '#E1306C';
const WHITE = '#FFFFFF';
const MUTED = 'rgba(255, 255, 255, 0.75)';

interface StatProps {
  label: string;
  value: number;
}

function Stat({ label, value }: StatProps) {
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
        text={formatWidgetCount(value)}
        style={{ fontSize: 22, fontWeight: 'bold', color: WHITE }}
      />
      <TextWidget
        text={label}
        style={{ fontSize: 9, color: MUTED, letterSpacing: 0.4 }}
      />
    </FlexWidget>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <FlexWidget
      clickAction="OPEN_APP"
      accessibilityLabel="Mutual follower summary. Opens the app."
      style={{
        height: 'match_parent',
        width: 'match_parent',
        flexDirection: 'column',
        justifyContent: 'space-between',
        paddingHorizontal: 14,
        paddingVertical: 12,
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
}

export function MutualSummaryWidget({ summary }: MutualSummaryWidgetProps) {
  // Empty state — never show zeros pretending to be real data.
  if (!summary) {
    return (
      <Shell>
        <TextWidget
          text="Mutual"
          style={{ fontSize: 11, fontWeight: 'bold', color: WHITE, letterSpacing: 0.6 }}
        />
        <TextWidget
          text="Open Mutual to import your data"
          style={{ fontSize: 12, color: WHITE }}
          maxLines={2}
        />
        <TextWidget text="No data yet" style={{ fontSize: 9, color: MUTED }} />
      </Shell>
    );
  }

  return (
    <Shell>
      <FlexWidget
        style={{
          width: 'match_parent',
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <TextWidget
          text="Mutual"
          style={{ fontSize: 11, fontWeight: 'bold', color: WHITE, letterSpacing: 0.6 }}
        />
        <TextWidget
          text={summary.accountName}
          style={{ fontSize: 9, color: MUTED }}
          truncate="END"
          maxLines={1}
        />
      </FlexWidget>

      <FlexWidget
        style={{
          width: 'match_parent',
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Stat label="FOLLOWERS" value={summary.followers} />
        <Stat label="NOT BACK" value={summary.unfollowers} />
        <Stat label="FANS" value={summary.fans} />
      </FlexWidget>

      <TextWidget
        text={`Updated ${formatWidgetDate(summary.lastUpdated)}`}
        style={{ fontSize: 9, color: MUTED }}
      />
    </Shell>
  );
}
