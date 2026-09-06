// Pure helpers for the Android home-screen widget (C10).
//
// Deliberately dependency-free (types only) so every bit of logic worth testing
// lives here rather than inside the widget's headless render path, which cannot
// be unit-tested and cannot even be exercised without a physical device.

import type { AnalyticsStats, WidgetSummary } from '../types';

/** Coerce anything non-finite/negative that may have come from old stored data. */
function safeCount(n: number): number {
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

/**
 * Project the app's aggregate stats into the widget payload.
 * NEVER include usernames — see the WidgetSummary docblock.
 */
export function buildWidgetSummary(
  stats: AnalyticsStats,
  accountName: string,
  lastUpdated: number,
): WidgetSummary {
  const ratio = Number.isFinite(stats.followBackRatio)
    ? Math.max(0, Math.min(100, Math.round(stats.followBackRatio)))
    : 0;

  return {
    followers: safeCount(stats.followersCount),
    following: safeCount(stats.followingCount),
    unfollowers: safeCount(stats.unfollowersCount),
    mutual: safeCount(stats.mutualFollows),
    fans: safeCount(stats.fansCount),
    followBackRatio: ratio,
    lastUpdated: Number.isFinite(lastUpdated) ? lastUpdated : 0,
    accountName: accountName || 'default',
  };
}

/**
 * Compact a count for a small widget: 999 -> "999", 1500 -> "1.5K", 1000000 -> "1M".
 * Trailing ".0" is trimmed so 1000 reads as "1K", not "1.0K".
 */
export function formatWidgetCount(n: number): string {
  const v = safeCount(n);
  if (v < 1000) return String(v);

  const compact = (value: number, suffix: string): string => {
    const oneDp = Math.floor(value * 10) / 10;
    const text = oneDp % 1 === 0 ? String(oneDp) : oneDp.toFixed(1);
    return `${text}${suffix}`;
  };

  if (v < 1_000_000) return compact(v / 1000, 'K');
  return compact(v / 1_000_000, 'M');
}

/**
 * "Updated 12 Jul" style label for the widget footer. Returns 'Never' for a
 * missing timestamp so the widget never shows a 1970 date.
 */
export function formatWidgetDate(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return 'Never';
  const d = new Date(ms);
  if (Number.isNaN(d.getTime())) return 'Never';
  const MONTHS = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
  ];
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
}
