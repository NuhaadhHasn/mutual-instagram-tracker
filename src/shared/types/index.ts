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

export interface FollowerChange {
  username: string;
  profileUrl: string;
  date: number;
  type: 'gained' | 'lost';
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
