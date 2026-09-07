import React from 'react';
import { FlexWidget, TextWidget } from 'react-native-android-widget';
import type { ColorProp } from 'react-native-android-widget';

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
 * ── DESIGN NOTES (v3 — "Ink") ────────────────────────────────────────────────
 * Two earlier versions looked crooked and cheap. Both causes were measurable:
 *
 * 1. ALIGNMENT. `justifyContent: 'space-between'` makes this library INJECT
 *    invisible `flex: 1` spacer children, so a 3-cell row was really 5 weighted
 *    views. Worse, a `flex` child without `width: 0` only shares the LEFTOVER
 *    space, so each column's width depended on its label's string width — which
 *    is why "FOLLOWERS/FOLLOWING/MUTUAL" and "NOT BACK/FANS/FOLLOW-BACK" drifted
 *    apart (measured: x=98/225/339 vs 93/202/322).
 *    => NEVER use justifyContent: 'space-between' here. Every flexed child gets
 *       `width: 0` (in a row) or `height: 0` (in a column). Gutters come from
 *       `flexGap`, which is subtracted BEFORE weights so columns stay exact.
 *    => Every TextWidget in a cell needs an explicit `width` or `textAlign`,
 *       `truncate` and `adjustsFontSizeToFit` are all silent no-ops.
 *
 * 2. COLOUR. Against the old full-bleed #833AB4→#E1306C gradient, every label
 *    measured between 2.38:1 and 4.40:1 contrast — ALL failing WCAG AA, worst at
 *    the pink stop. `rgba(255,255,255,0.75)` isn't a colour; it's a colour that
 *    changes with whatever is behind it. Now: a neutral dark surface with solid
 *    hex text (every pair clears 4.5:1) and the brand pink spent ONLY on the hero
 *    number — so it reads as brand AND as emphasis at once.
 *
 * 3. DATA. `following = mutual + unfollowers` and `followers = mutual + fans`,
 *    so {unfollowers, followers, mutual, fans} determines all six numbers
 *    including the ratio. Dropping the printed "Following" and "Follow-back %"
 *    costs the user NOTHING and buys a hero. Same data, with a protagonist.
 *
 * 4. Labels are sentence case at 11sp — 9sp is below the entire Material 3 type
 *    scale, and six all-caps micro-labels are the strongest "2016 dashboard"
 *    tell in the old design.
 *
 * No hooks / no useTheme(): a widget has no React context. Light and dark are
 * shipped as two trees via WidgetRepresentation `{light, dark}` instead.
 */

/** Resolved palette. Solid hex only — never rgba over an unknown backdrop. */
export interface Skin {
  // ColorProp (= HexColor | RgbaColor) is a template-literal type, not `string` —
  // plain string fails the library's style prop types.
  shell: ColorProp;
  divider: ColorProp;
  value: ColorProp;
  label: ColorProp;
  dim: ColorProp;
  accent: ColorProp;
}

/** M3-style dark surface (tone 6, plum-tinted). All text ≥ 4.5:1 on `shell`. */
export const INK_DARK: Skin = {
  shell: '#151315',
  divider: '#332E34',
  value: '#F4F1F6', // 16.5:1
  label: '#CAC5CC', // 10.9:1
  dim: '#988D9C', //  5.8:1
  accent: '#FF7BA8', //  7.6:1 — brand #E1306C lifted to ~tone 72
};

/** Light variant. Raw #E1306C is only 4.0:1 on white, so the accent darkens. */
export const INK_LIGHT: Skin = {
  shell: '#FFFBFF',
  divider: '#E5DFE5',
  value: '#1C1B1F',
  label: '#4A454E',
  dim: '#6F6A73',
  accent: '#C21E5A', // 5.6:1
};

/** Below this height (dp) there is no room for a second tier. */
const COMPACT_MAX_HEIGHT = 110;
/** Below this width (dp) three columns would be unreadable. */
const COMPACT_MAX_WIDTH = 160;
const HEADROOM_TALL = 168;
const HEADROOM_MID = 140;

interface Profile {
  pad: number;
  gap: number;
  hero: number;
  stat: number;
  showAccount: boolean;
}

/** Type/space ladder by measured height. Real steps, not two unbridged sizes. */
function profileFor(h: number): Profile {
  if (h >= HEADROOM_TALL) {
    return { pad: 16, gap: 14, hero: 34, stat: 19, showAccount: true };
  }
  if (h >= HEADROOM_MID) {
    return { pad: 14, gap: 12, hero: 30, stat: 18, showAccount: true };
  }
  // Tightest FULL size: 110dp - 24 padding = 86dp of content; tier1 44 + gap 8
  // + tier2 33 = 85. Fits only because the account line is dropped here.
  return { pad: 12, gap: 8, hero: 26, stat: 17, showAccount: false };
}

/** One support cell. `width: 0` + `flex: 1` == Android `0dp` + `layout_weight=1`. */
function Cell({
  label,
  value,
  size,
  s,
}: {
  label: string;
  value: string;
  size: number;
  s: Skin;
}) {
  return (
    <FlexWidget
      style={{
        width: 0,
        flex: 1,
        height: 'wrap_content',
        flexDirection: 'column',
        alignItems: 'flex-start',
        justifyContent: 'flex-end',
      }}
    >
      <TextWidget
        text={value}
        maxLines={1}
        style={{
          width: 'match_parent',
          textAlign: 'left',
          // NOTE: adjustsFontSizeToFit is a STYLE prop here, not a JSX prop.
          adjustsFontSizeToFit: true,
          fontSize: size,
          fontWeight: '600',
          color: s.value,
          letterSpacing: -0.3,
        }}
      />
      <TextWidget
        text={label}
        maxLines={1}
        truncate="END"
        style={{
          width: 'match_parent',
          textAlign: 'left',
          fontSize: 11,
          fontWeight: '500',
          color: s.label,
          letterSpacing: 0.5,
        }}
      />
    </FlexWidget>
  );
}

function Shell({
  s,
  pad,
  gap,
  children,
}: {
  s: Skin;
  pad: number;
  gap: number;
  children: React.ReactNode;
}) {
  return (
    <FlexWidget
      clickAction="OPEN_APP"
      accessibilityLabel="Mutual follower summary. Opens the app."
      style={{
        width: 'match_parent',
        height: 'match_parent',
        flexDirection: 'column',
        paddingHorizontal: pad,
        paddingVertical: pad,
        borderRadius: 16,
        backgroundColor: s.shell,
        flexGap: gap,
      }}
    >
      {children}
    </FlexWidget>
  );
}

export interface MutualSummaryWidgetProps {
  summary: WidgetSummary | null;
  /** Measured size from the launcher, in dp. */
  width?: number;
  height?: number;
  skin?: Skin;
}

export function MutualSummaryWidget({
  summary,
  width,
  height,
  skin = INK_DARK,
}: MutualSummaryWidgetProps) {
  const s = skin;
  // Never treat 0/undefined as "tiny" — a 0-size measure would misroute the
  // layout. Fall back to the mid profile.
  const h = typeof height === 'number' && height > 0 ? height : HEADROOM_MID;
  const w = typeof width === 'number' && width > 0 ? width : 250;
  const p = profileFor(h);
  const compact = h < COMPACT_MAX_HEIGHT || w < COMPACT_MAX_WIDTH;

  // ---- Empty state. Same shell, same ladder — never zeros faked as data. ---
  if (!summary) {
    return (
      <Shell s={s} pad={p.pad} gap={4}>
        <FlexWidget
          style={{
            width: 'match_parent',
            height: 0,
            flex: 1,
            flexDirection: 'column',
            justifyContent: 'center',
          }}
        >
          <TextWidget
            text="Mutual"
            style={{
              width: 'match_parent',
              textAlign: 'left',
              fontSize: 12,
              fontWeight: '600',
              color: s.value,
              letterSpacing: 0.4,
            }}
          />
          <TextWidget
            text="Tap to import your data"
            maxLines={2}
            style={{
              width: 'match_parent',
              textAlign: 'left',
              fontSize: 13,
              fontWeight: '500',
              color: s.label,
            }}
          />
        </FlexWidget>
      </Shell>
    );
  }

  const heroLabel = w >= 230 ? 'Not following back' : 'Not back';

  // ---- TIER 1: hero (flexed, absorbs all slack) + brand/meta block. -------
  // The old design's dead band came from TWO flexed tiers each centring their
  // content. Now only tier 1 flexes; tier 2 is wrap_content, so slack collects
  // as breathing room above the hero instead of as a hole through the middle.
  const tier1 = (
    <FlexWidget
      style={{
        width: 'match_parent',
        height: 0,
        flex: 1,
        flexDirection: 'row',
        alignItems: 'flex-end', // hero + meta share one bottom rail
      }}
    >
      <FlexWidget
        style={{
          width: 0,
          flex: 3,
          height: 'wrap_content',
          flexDirection: 'column',
          alignItems: 'flex-start',
        }}
      >
        <TextWidget
          text={formatWidgetCount(summary.unfollowers)}
          maxLines={1}
          allowFontScaling={false}
          style={{
            width: 'match_parent',
            textAlign: 'left',
            adjustsFontSizeToFit: true,
            fontSize: p.hero,
            fontWeight: '700',
            color: s.accent, // the ONLY brand-coloured thing on the widget
            letterSpacing: -0.8,
          }}
        />
        <TextWidget
          text={heroLabel}
          maxLines={1}
          truncate="END"
          style={{
            width: 'match_parent',
            textAlign: 'left',
            fontSize: 12,
            fontWeight: '500',
            color: s.label,
            letterSpacing: 0.3,
          }}
        />
      </FlexWidget>

      {/* height match_parent + justifyContent flex-start pins this to the TOP
          while the hero bottom-aligns (on a column, justifyContent = vertical). */}
      <FlexWidget
        style={{
          width: 0,
          flex: 2,
          height: 'match_parent',
          flexDirection: 'column',
          alignItems: 'flex-end',
          justifyContent: 'flex-start',
        }}
      >
        <TextWidget
          text="Mutual"
          style={{
            width: 'match_parent',
            textAlign: 'right',
            fontSize: 12,
            fontWeight: '600',
            color: s.value,
            letterSpacing: 0.4,
          }}
        />
        {p.showAccount && summary.accountName !== 'default' ? (
          <TextWidget
            text={summary.accountName}
            maxLines={1}
            truncate="END"
            style={{
              width: 'match_parent',
              textAlign: 'right',
              fontSize: 11,
              fontWeight: '400',
              color: s.dim,
            }}
          />
        ) : null}
        <TextWidget
          text={formatWidgetDate(summary.lastUpdated)}
          maxLines={1}
          style={{
            width: 'match_parent',
            textAlign: 'right',
            fontSize: 11,
            fontWeight: '400',
            color: s.dim,
          }}
        />
      </FlexWidget>
    </FlexWidget>
  );

  // Compact is a SUBSET of the full design, not a second design: same shell,
  // same skin, same ladder, same hero. Resizing adds a tier rather than
  // switching to a different-looking widget.
  if (compact) {
    return (
      <Shell s={s} pad={10} gap={0}>
        {tier1}
      </Shell>
    );
  }

  // ---- TIER 2: three exact columns; wrap_content so slack goes to tier 1. --
  return (
    <Shell s={s} pad={p.pad} gap={p.gap}>
      {tier1}
      <FlexWidget
        style={{
          width: 'match_parent',
          height: 'wrap_content',
          flexDirection: 'row',
          alignItems: 'flex-end',
          flexGap: 10, // gutters BETWEEN cells only — keeps columns exact
        }}
      >
        <Cell s={s} size={p.stat} label="Followers" value={formatWidgetCount(summary.followers)} />
        <Cell s={s} size={p.stat} label="Mutual" value={formatWidgetCount(summary.mutual)} />
        <Cell s={s} size={p.stat} label="Fans" value={formatWidgetCount(summary.fans)} />
      </FlexWidget>
    </Shell>
  );
}
