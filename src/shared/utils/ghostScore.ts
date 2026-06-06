import { InstagramUser } from '../types';
import { isLikelyBot } from './botHeuristic';

export type GhostBand =
  | 'Active'
  | 'Aging'
  | 'Possibly inactive'
  | 'Likely inactive';

export type GhostResult = {
  score: number; // 0–100 "ghost likelihood"
  band: GhostBand;
  /** True once the score is worth flagging on a row (band ≥ Possibly inactive). */
  isGhost: boolean;
  /** Theme color slot name to tint the chip with. */
  colorKey: 'success' | 'info' | 'warning' | 'error';
};

const MS_PER_MONTH = 30 * 24 * 60 * 60 * 1000;

/**
 * Composite 0–100 "ghost / likely-inactive" likelihood (C1). All local, heuristic.
 *
 * HONEST CAVEAT: the Instagram ZIP export gives us NO posts, NO engagement and NO
 * last-active data — so true inactivity is unmeasurable. The only inactivity
 * proxy we have is HOW LONG AGO the follow happened (`timestamp`). This score is
 * therefore a hedge, not a verdict — hence the "Possibly/Likely inactive" wording
 * in the UI. It blends:
 *  - follow age (dominant): an old follow is more likely a dormant relationship
 *  - bot-likeness (reuses isLikelyBot): throwaway handles tend not to engage
 *
 * Weights: 70% follow age, 30% bot-likeness. A follow with no timestamp gets no
 * age signal (we can't judge it), so it can only be flagged on bot-likeness.
 */
export function ghostScore(
  user: InstagramUser,
  now: number = Date.now(),
): GhostResult {
  // Age signal: 0 for a brand-new follow, ramping linearly to 1 at ~12 months.
  // (0.5 at 6 months — IMPROVEMENTS.md's "6+ months" reference point.)
  let ageSignal = 0;
  if (user.timestamp) {
    const months = (now - user.timestamp * 1000) / MS_PER_MONTH;
    ageSignal = Math.min(1, Math.max(0, months / 12));
  }

  const botSignal = isLikelyBot(user.username) ? 1 : 0;

  const raw = 0.7 * ageSignal + 0.3 * botSignal;
  const score = Math.round(Math.min(1, Math.max(0, raw)) * 100);

  let band: GhostBand;
  let colorKey: GhostResult['colorKey'];
  if (score >= 70) {
    band = 'Likely inactive';
    colorKey = 'error';
  } else if (score >= 50) {
    band = 'Possibly inactive';
    colorKey = 'warning';
  } else if (score >= 25) {
    band = 'Aging';
    colorKey = 'info';
  } else {
    band = 'Active';
    colorKey = 'success';
  }

  return { score, band, isGhost: score >= 50, colorKey };
}
