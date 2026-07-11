import { isLikelyBot } from '../botHeuristic';

describe('isLikelyBot', () => {
  it('returns false for empty / clean usernames', () => {
    expect(isLikelyBot('')).toBe(false);
    expect(isLikelyBot('john')).toBe(false);
    expect(isLikelyBot('sarah_jones')).toBe(false);
  });

  it('flags a run of 4+ consecutive digits (strong signal)', () => {
    expect(isLikelyBot('user938271')).toBe(true);
    expect(isLikelyBot('jane88291')).toBe(true);
  });

  it('is conservative: a single weak signal is not enough', () => {
    // 3 dots → separatorHeavy, but that alone must NOT flag.
    expect(isLikelyBot('a.b.c.d')).toBe(false);
  });

  it('flags when two weak signals combine (very-long-random + separators)', () => {
    // length ≥25 with a digit (veryLongRandom) + ≥3 underscores (separatorHeavy),
    // and no 4-digit run so it can only pass via the two-weak-signal path.
    expect(isLikelyBot('aaaaaaaaaaaaaaaaaaaa_1_2_3')).toBe(true);
  });
});
