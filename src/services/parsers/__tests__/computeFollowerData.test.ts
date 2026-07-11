import {
  computeDerived,
  computeStats,
  deriveFans,
  deriveUnfollowers,
} from '../computeFollowerData';
import { InstagramUser } from '../../../shared/types';

const u = (username: string): InstagramUser => ({
  username,
  profileUrl: `https://instagram.com/${username}`,
});

// alice & bob & carol follow me; I follow bob, carol, dave, eve.
//  → mutual: bob, carol   → unfollowers: dave, eve   → fans: alice
const followers = [u('alice'), u('bob'), u('carol')];
const following = [u('bob'), u('carol'), u('dave'), u('eve')];

describe('deriveUnfollowers', () => {
  it('returns people I follow who do not follow me back', () => {
    expect(deriveUnfollowers(followers, following).map((x) => x.username)).toEqual([
      'dave',
      'eve',
    ]);
  });

  it('is empty when every followed account follows back', () => {
    expect(deriveUnfollowers(followers, followers)).toEqual([]);
  });
});

describe('deriveFans', () => {
  it('returns people who follow me but I do not follow back', () => {
    expect(deriveFans(followers, following).map((x) => x.username)).toEqual([
      'alice',
    ]);
  });
});

describe('computeStats', () => {
  it('computes counts, mutual (following − unfollowers) and follow-back ratio', () => {
    const unfollowers = deriveUnfollowers(followers, following);
    const fans = deriveFans(followers, following);
    const stats = computeStats(followers, following, unfollowers, fans);
    expect(stats).toEqual({
      followersCount: 3,
      followingCount: 4,
      unfollowersCount: 2,
      mutualFollows: 2,
      followBackRatio: 50,
      fansCount: 1,
    });
  });

  it('does not divide by zero when following is empty', () => {
    const stats = computeStats([], [], [], []);
    expect(stats.followBackRatio).toBe(0);
    expect(Number.isNaN(stats.followBackRatio)).toBe(false);
  });
});

describe('computeDerived', () => {
  it('produces unfollowers, fans and stats together', () => {
    const d = computeDerived(followers, following);
    expect(d.unfollowers.map((x) => x.username)).toEqual(['dave', 'eve']);
    expect(d.fans.map((x) => x.username)).toEqual(['alice']);
    expect(d.stats.mutualFollows).toBe(2);
    expect(d.stats.followBackRatio).toBe(50);
  });

  it('handles empty input without throwing', () => {
    const d = computeDerived([], []);
    expect(d.unfollowers).toEqual([]);
    expect(d.fans).toEqual([]);
    expect(d.stats.followersCount).toBe(0);
    expect(d.stats.followBackRatio).toBe(0);
  });
});
