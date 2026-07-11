import { TAG_PRESETS, tagColor } from '../tags';

describe('tagColor', () => {
  it('is deterministic for a given tag', () => {
    expect(tagColor('Friends')).toBe(tagColor('Friends'));
    expect(tagColor('literally anything')).toBe(tagColor('literally anything'));
  });

  it('always returns a 6-digit hex color', () => {
    for (const preset of TAG_PRESETS) {
      expect(tagColor(preset)).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }
    expect(tagColor('Custom Tag')).toMatch(/^#[0-9A-Fa-f]{6}$/);
  });

  it('maps known inputs to their expected palette slot (char-sum mod 7)', () => {
    expect(tagColor('Friends')).toBe('#405DE6');
    expect(tagColor('Work')).toBe('#FF6B6B');
  });

  it('falls back to a stable color for empty input', () => {
    expect(tagColor('')).toBe('#E1306C'); // uses "?" → charCode 63 % 7 = 0
  });
});
