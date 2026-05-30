// Type definitions for Mutual

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
  category?: string;
  note?: string; // Private, local-only label/note for this account. C4.
}

export interface UnfollowedUser {
  username: string;
  profileUrl: string;
  unfollowedAt: number;
}
