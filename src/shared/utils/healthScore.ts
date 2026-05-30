import { AnalyticsStats } from '../types';

export type HealthBand = 'Excellent' | 'Good' | 'Fair' | 'Low';

export type HealthResult = {
  score: number; // 0–100
  band: HealthBand;
  /** Theme color slot name to tint the dial with. */
  colorKey: 'success' | 'info' | 'warning' | 'error';
};

/**
 * Composite 0–100 "account health" score (C12). All local, heuristic, no API.
 * Blends three signals the ZIP gives us:
 *  - follow-back ratio (mutual / following): are the people you follow loyal?
 *  - mutual share (mutual / followers): how much of your audience you engage back
 *  - unfollower drag: penalty for following lots of people who don't follow back
 *
 * Weights: 50% follow-back ratio, 30% mutual share, 20% (1 − unfollower share).
 */
export function healthScore(stats: AnalyticsStats): HealthResult {
  const { followersCount, followingCount, mutualFollows, unfollowersCount } = stats;

  const followBackRatio = followingCount > 0 ? mutualFollows / followingCount : 0;
  const mutualShare = followersCount > 0 ? mutualFollows / followersCount : 0;
  const unfollowerShare = followingCount > 0 ? unfollowersCount / followingCount : 0;

  const raw =
    0.5 * followBackRatio + 0.3 * mutualShare + 0.2 * (1 - unfollowerShare);
  const score = Math.round(Math.min(1, Math.max(0, raw)) * 100);

  let band: HealthBand;
  let colorKey: HealthResult['colorKey'];
  if (score >= 75) {
    band = 'Excellent';
    colorKey = 'success';
  } else if (score >= 50) {
    band = 'Good';
    colorKey = 'info';
  } else if (score >= 25) {
    band = 'Fair';
    colorKey = 'warning';
  } else {
    band = 'Low';
    colorKey = 'error';
  }

  return { score, band, colorKey };
}
