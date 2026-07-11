import { ghostScore } from '../ghostScore';
import { InstagramUser } from '../../types';

const MS_PER_MONTH = 30 * 24 * 60 * 60 * 1000;
const NOW = 1_700_000_000_000; // fixed clock so age math is deterministic

// user.timestamp is in SECONDS; ghostScore multiplies it by 1000.
const monthsAgo = (m: number) => (NOW - m * MS_PER_MONTH) / 1000;

const user = (over: Partial<InstagramUser>): InstagramUser => ({
  username: 'someone',
  profileUrl: 'https://instagram.com/someone',
  ...over,
});

describe('ghostScore', () => {
  it('treats a timestamp-less, non-bot follow as Active', () => {
    const r = ghostScore(user({}), NOW);
    expect(r.score).toBe(0);
    expect(r.band).toBe('Active');
    expect(r.isGhost).toBe(false);
  });

  it('flags an old (12-month) follow as Likely inactive', () => {
    const r = ghostScore(user({ timestamp: monthsAgo(12) }), NOW);
    expect(r.score).toBe(70); // ageSignal 1 → 0.7*100
    expect(r.band).toBe('Likely inactive');
    expect(r.isGhost).toBe(true);
    expect(r.colorKey).toBe('error');
  });

  it('uses the 6-month reference as roughly half the age signal', () => {
    const r = ghostScore(user({ timestamp: monthsAgo(6) }), NOW);
    expect(r.score).toBe(35); // ageSignal 0.5 → 0.7*0.5*100
    expect(r.band).toBe('Aging');
    expect(r.isGhost).toBe(false);
  });

  it('adds the bot signal on top of age (old + bot handle → max)', () => {
    const r = ghostScore(
      user({ username: 'user883921', timestamp: monthsAgo(12) }),
      NOW,
    );
    expect(r.score).toBe(100); // 0.7 age + 0.3 bot
    expect(r.band).toBe('Likely inactive');
  });

  it('can only flag a timestamp-less follow via bot-likeness (never age)', () => {
    const r = ghostScore(user({ username: 'user883921' }), NOW);
    expect(r.score).toBe(30); // botSignal only → 0.3*100
    expect(r.band).toBe('Aging');
    expect(r.isGhost).toBe(false);
  });
});
