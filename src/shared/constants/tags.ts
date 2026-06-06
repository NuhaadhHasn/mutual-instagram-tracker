/**
 * Private, local-only tags for whitelisted accounts (C4). One tag per user,
 * stored on `WhitelistUser.category`. Users pick a preset or type a custom one;
 * both get a stable color from `tagColor` so chips look consistent everywhere.
 */
export const TAG_PRESETS = [
  'Friends',
  'Family',
  'Work',
  'Important',
  'Other',
] as const;

// Same palette spirit as UserAvatar — distinct, on-brand hues.
const TAG_COLORS = [
  '#E1306C',
  '#405DE6',
  '#833AB4',
  '#FF9800',
  '#4CAF50',
  '#4ECDC4',
  '#FF6B6B',
];

/** Deterministic color for a tag (preset or custom) — stable across renders. */
export function tagColor(tag: string): string {
  const safe = tag && tag.length > 0 ? tag : '?';
  const index =
    safe.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0) %
    TAG_COLORS.length;
  return TAG_COLORS[index];
}
