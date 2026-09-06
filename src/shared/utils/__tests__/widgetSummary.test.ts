import {
  buildWidgetSummary,
  formatWidgetCount,
  formatWidgetDate,
} from '../widgetSummary';
import type { AnalyticsStats } from '../../types';

const stats = (over: Partial<AnalyticsStats> = {}): AnalyticsStats => ({
  followersCount: 1200,
  followingCount: 800,
  unfollowersCount: 150,
  mutualFollows: 650,
  followBackRatio: 81,
  fansCount: 550,
  ...over,
});

describe('buildWidgetSummary', () => {
  it('maps AnalyticsStats onto the widget payload', () => {
    const s = buildWidgetSummary(stats(), 'default', 1_700_000_000_000);
    expect(s).toEqual({
      followers: 1200,
      following: 800,
      unfollowers: 150,
      mutual: 650,
      fans: 550,
      followBackRatio: 81,
      lastUpdated: 1_700_000_000_000,
      accountName: 'default',
    });
  });

  it('keeps followBackRatio a 0-100 percent and clamps out-of-range values', () => {
    expect(buildWidgetSummary(stats({ followBackRatio: 140 }), 'a', 1).followBackRatio).toBe(100);
    expect(buildWidgetSummary(stats({ followBackRatio: -5 }), 'a', 1).followBackRatio).toBe(0);
    expect(buildWidgetSummary(stats({ followBackRatio: 81.6 }), 'a', 1).followBackRatio).toBe(82);
  });

  it('coerces non-finite / negative counts to 0 rather than rendering NaN', () => {
    const s = buildWidgetSummary(
      stats({ followersCount: NaN, fansCount: -3 }),
      'a',
      1,
    );
    expect(s.followers).toBe(0);
    expect(s.fans).toBe(0);
  });

  it('falls back to "default" for an empty account name', () => {
    expect(buildWidgetSummary(stats(), '', 1).accountName).toBe('default');
  });

  it('never carries username-bearing fields (privacy invariant)', () => {
    const s = buildWidgetSummary(stats(), 'default', 1);
    expect(Object.keys(s).sort()).toEqual([
      'accountName',
      'fans',
      'followBackRatio',
      'followers',
      'following',
      'lastUpdated',
      'mutual',
      'unfollowers',
    ]);
  });
});

describe('formatWidgetCount', () => {
  it('leaves counts under 1000 alone', () => {
    expect(formatWidgetCount(0)).toBe('0');
    expect(formatWidgetCount(999)).toBe('999');
  });

  it('compacts thousands and trims a trailing .0', () => {
    expect(formatWidgetCount(1000)).toBe('1K');
    expect(formatWidgetCount(1500)).toBe('1.5K');
    expect(formatWidgetCount(12_340)).toBe('12.3K');
    expect(formatWidgetCount(999_999)).toBe('999.9K');
  });

  it('compacts millions', () => {
    expect(formatWidgetCount(1_000_000)).toBe('1M');
    expect(formatWidgetCount(2_500_000)).toBe('2.5M');
  });

  it('is defensive about bad input', () => {
    expect(formatWidgetCount(NaN)).toBe('0');
    expect(formatWidgetCount(-10)).toBe('0');
  });
});

describe('formatWidgetDate', () => {
  it('formats a real timestamp as "D Mon"', () => {
    // 2026-07-12T00:00:00Z — construct locally to avoid TZ drift on the day value
    const ms = new Date(2026, 6, 12).getTime();
    expect(formatWidgetDate(ms)).toBe('12 Jul');
  });

  it('returns Never for missing/invalid timestamps instead of a 1970 date', () => {
    expect(formatWidgetDate(0)).toBe('Never');
    expect(formatWidgetDate(-1)).toBe('Never');
    expect(formatWidgetDate(NaN)).toBe('Never');
  });
});
