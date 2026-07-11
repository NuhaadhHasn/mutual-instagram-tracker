// Unit-test config (#19). `jest-expo` applies the project's babel-preset-expo
// transform so TypeScript + the RN/Expo module graph resolve. Our suites target
// PURE logic (scoring heuristics + the follower-derivation math), so they need
// no native mocking. Kept out of `npx tsc --noEmit` via tsconfig `exclude`.
module.exports = {
  preset: 'jest-expo',
  testMatch: ['**/__tests__/**/*.test.ts'],
};
