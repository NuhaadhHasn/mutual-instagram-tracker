import { InstagramUser, AnalyticsStats } from '../../shared/types';

/**
 * Pure follower-set math (#19, Tier 2). Extracted from the ZIP parser so it can
 * be unit-tested in plain Node without pulling in expo-file-system / JSZip /
 * AsyncStorage. Shared by BOTH `instagramParser.processData` (always recomputes
 * on import) and `dataStore.migrateFollowerData` (backfills only missing fields
 * on read), which previously duplicated this logic.
 *
 * No I/O, no native modules, no `Date` — deterministic given its inputs.
 */
export type DerivedFollowerData = {
  unfollowers: InstagramUser[];
  fans: InstagramUser[];
  stats: AnalyticsStats;
};

/** People you follow who don't follow you back. */
export function deriveUnfollowers(
  followers: InstagramUser[],
  following: InstagramUser[],
): InstagramUser[] {
  const followerUsernames = new Set(followers.map((f) => f.username));
  return following.filter((f) => !followerUsernames.has(f.username));
}

/** People who follow you but you don't follow back. */
export function deriveFans(
  followers: InstagramUser[],
  following: InstagramUser[],
): InstagramUser[] {
  const followingUsernames = new Set(following.map((f) => f.username));
  return followers.filter((f) => !followingUsernames.has(f.username));
}

/**
 * Aggregate counts + follow-back ratio. `mutualFollows` is derived as
 * `following - unfollowers` (matching the original parser), so the caller passes
 * whichever unfollowers/fans arrays are current (fresh on import, existing on
 * migration) and gets identical numbers.
 */
export function computeStats(
  followers: InstagramUser[],
  following: InstagramUser[],
  unfollowers: InstagramUser[],
  fans: InstagramUser[],
): AnalyticsStats {
  const mutual = following.length - unfollowers.length;
  return {
    followersCount: followers.length,
    followingCount: following.length,
    unfollowersCount: unfollowers.length,
    mutualFollows: mutual,
    followBackRatio:
      following.length > 0 ? (mutual / following.length) * 100 : 0,
    fansCount: fans.length,
  };
}

/** Full derivation used on import: unfollowers + fans + stats from scratch. */
export function computeDerived(
  followers: InstagramUser[],
  following: InstagramUser[],
): DerivedFollowerData {
  const unfollowers = deriveUnfollowers(followers, following);
  const fans = deriveFans(followers, following);
  const stats = computeStats(followers, following, unfollowers, fans);
  return { unfollowers, fans, stats };
}
