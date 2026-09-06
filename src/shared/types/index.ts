// Type definitions for Mutual

// A tracked Instagram account (C8 multi-account). The `default` account maps to
// the original un-suffixed storage keys so existing single-account data is
// preserved with zero migration; additional accounts namespace their keys by id.
export interface Account {
  id: string;
  name: string;
  createdAt: number;
}

export interface InstagramUser {
  username: string;
  profileUrl: string;
  timestamp?: number;
}

export interface FollowerData {
  followers: InstagramUser[];
  following: InstagramUser[];
  unfollowers: InstagramUser[];
  fans: InstagramUser[];
  stats: AnalyticsStats;
  lastUpdated: number;
}

export interface HistoricalSnapshot {
  id: string;
  date: number;
  followersCount: number;
  followingCount: number;
  unfollowersCount: number;
  mutualFollows: number;
  fansCount: number;
  followBackRatio: number;
  // Optional username sets, stored from the import that introduced them onward
  // (older count-only snapshots leave these undefined). Enables set-diffing who
  // joined/left between two imports. C5.
  followerUsernames?: string[];
  followingUsernames?: string[];
}

export interface AnalyticsStats {
  followersCount: number;
  followingCount: number;
  unfollowersCount: number;
  mutualFollows: number;
  followBackRatio: number;
  fansCount: number; // People who follow you but you don't follow back
}

// Aggregate-only payload the Android home-screen widget reads (C10).
// Deliberately stored UNENCRYPTED and separately from `follower_data`, because a
// widget runs in a headless JS context with a cold master-key cache — reading the
// encrypted store there would render a blank widget for anyone with D2 enabled.
// NEVER put usernames (or ghost/bot lists) in here: a widget is visible on the
// home screen even while the D1 app lock is engaged.
export interface WidgetSummary {
  followers: number;
  following: number;
  unfollowers: number;
  mutual: number;
  fans: number;
  followBackRatio: number; // percent 0-100, same convention as AnalyticsStats
  lastUpdated: number; // ms epoch, from FollowerData.lastUpdated
  accountName: string; // so a stale write is visible rather than silently wrong
}

export interface WhitelistUser {
  username: string;
  profileUrl: string;
  addedAt: number;
  category?: string; // Private, local-only tag (one per user; preset or custom). C4.
  note?: string; // Private, local-only label/note for this account. C4.
}

export interface UnfollowedUser {
  username: string;
  profileUrl: string;
  unfollowedAt: number;
}
