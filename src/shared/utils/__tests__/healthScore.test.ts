import { healthScore } from '../healthScore';
import { AnalyticsStats } from '../../types';

const stats = (over: Partial<AnalyticsStats>): AnalyticsStats => ({
  followersCount: 0,
  followingCount: 0,
  unfollowersCount: 0,
  mutualFollows: 0,
  followBackRatio: 0,
  fansCount: 0,
  ...over,
});

describe('healthScore', () => {
  it('is perfect when every follow is mutual and nobody is an unfollower', () => {
    const r = healthScore(
      stats({
        followersCount: 100,
        followingCount: 100,
        mutualFollows: 100,
        unfollowersCount: 0,
      }),
    );
    expect(r.score).toBe(100);
    expect(r.band).toBe('Excellent');
    expect(r.colorKey).toBe('success');
  });

  it('lands in the Good band at a balanced 50/50 profile', () => {
    const r = healthScore(
      stats({
        followersCount: 100,
        followingCount: 100,
        mutualFollows: 50,
        unfollowersCount: 50,
      }),
    );
    expect(r.score).toBe(50);
    expect(r.band).toBe('Good');
    expect(r.colorKey).toBe('info');
  });

  it('lands in the Fair band for a low-mutual, high-unfollower profile', () => {
    const r = healthScore(
      stats({
        followersCount: 100,
        followingCount: 100,
        mutualFollows: 30,
        unfollowersCount: 70,
      }),
    );
    expect(r.score).toBe(30);
    expect(r.band).toBe('Fair');
    expect(r.colorKey).toBe('warning');
  });

  it('never divides by zero on empty stats (guards → Low, not NaN)', () => {
    const r = healthScore(stats({}));
    expect(Number.isNaN(r.score)).toBe(false);
    expect(r.score).toBe(20); // only the 0.2*(1 - 0) term survives
    expect(r.band).toBe('Low');
    expect(r.colorKey).toBe('error');
  });
});
