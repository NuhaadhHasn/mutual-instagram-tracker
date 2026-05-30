import * as Crypto from 'expo-crypto';

export type ExportMode = 'plain' | 'hashed';

/**
 * Truncated SHA-256 hex of the lowercased username — a stable pseudonym that
 * can't be reversed back to the handle, so a shared/backed-up export file never
 * leaks the actual follower list. Item D6.
 *
 * Note: when exporting hashed usernames, callers must also omit the profile URL
 * (it embeds the plaintext handle), otherwise hashing is pointless.
 */
export async function hashUsername(username: string): Promise<string> {
  const digest = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    username.trim().toLowerCase(),
  );
  return digest.slice(0, 16);
}

/**
 * Resolve a list of usernames to either their plaintext form or hashed
 * pseudonyms, preserving order. Hashing runs in parallel.
 */
export async function resolveUsernames(
  usernames: string[],
  mode: ExportMode,
): Promise<string[]> {
  if (mode === 'plain') return usernames;
  return Promise.all(usernames.map((u) => hashUsername(u)));
}
