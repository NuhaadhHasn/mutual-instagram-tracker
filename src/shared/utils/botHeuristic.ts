/**
 * Conservative, username-only "possible spam/bot" heuristic (C3).
 *
 * The ZIP export gives us only username/profileUrl/timestamp — no bio, no
 * profile picture, no follower counts — so this is intentionally cautious to
 * limit false positives. It flags the patterns most strongly associated with
 * throwaway/bot handles. Treat the result as "worth a look," never definitive.
 */
export function isLikelyBot(username: string): boolean {
  if (!username) return false;
  const name = username.toLowerCase();

  // ≥4 consecutive digits (e.g. user_938271, jane88291)
  const hasLongDigitRun = /\d{4,}/.test(name);

  // High digit ratio (lots of numbers relative to length)
  const digitCount = (name.match(/\d/g) || []).length;
  const digitRatio = name.length > 0 ? digitCount / name.length : 0;
  const digitHeavy = name.length >= 6 && digitRatio > 0.4;

  // Excessive separators (e.g. a__b__c, x.y.z.w)
  const underscores = (name.match(/_/g) || []).length;
  const dots = (name.match(/\./g) || []).length;
  const separatorHeavy = underscores >= 3 || dots >= 3;

  // Very long handle that's mostly random alphanumerics
  const veryLongRandom = name.length >= 25 && /\d/.test(name);

  // Require a strong signal: a long digit run, or two weaker signals together.
  if (hasLongDigitRun) return true;
  const weakSignals = [digitHeavy, separatorHeavy, veryLongRandom].filter(Boolean).length;
  return weakSignals >= 2;
}
