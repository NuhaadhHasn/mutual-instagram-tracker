import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { InstagramUser } from '../shared/types';
import { resolveUsernames } from './usernamePrivacy';

export type RecencyScope = 'all' | '7' | '30';

/**
 * Keep a user list to those followed within the last N days. Mirrors the
 * recency-pill math in the list screens (timestamp is seconds since epoch).
 * Used by the filtered/smart export (C14).
 */
export function filterByRecency<T extends { timestamp?: number }>(
  users: T[],
  scope: RecencyScope,
): T[] {
  if (scope === 'all') return users;
  const windowMs = (scope === '7' ? 7 : 30) * 24 * 60 * 60 * 1000;
  const cutoff = Date.now() - windowMs;
  return users.filter((u) => u.timestamp != null && u.timestamp * 1000 >= cutoff);
}

/** CSV-escape a single field (double quotes, wrap in quotes). */
export function escapeCsvField(v: string): string {
  return `"${(v ?? '').replace(/"/g, '""')}"`;
}

/**
 * Build a `Username,Profile URL,Followed On` CSV from a user list. In hashed
 * mode usernames become SHA-256 pseudonyms and the profile URL is blanked (it
 * embeds the plaintext handle). D6.
 */
export async function buildUserCsv(
  users: InstagramUser[],
  opts: { hashed: boolean },
): Promise<string> {
  const names = await resolveUsernames(
    users.map((u) => u.username),
    opts.hashed ? 'hashed' : 'plain',
  );
  const header = 'Username,Profile URL,Followed On';
  const rows = users.map((u, i) => {
    const date = u.timestamp
      ? new Date(u.timestamp * 1000).toLocaleDateString()
      : '';
    const url = opts.hashed ? '' : u.profileUrl;
    return `${escapeCsvField(names[i])},${escapeCsvField(url)},${escapeCsvField(date)}`;
  });
  return [header, ...rows].join('\n');
}

/**
 * Write a CSV string to a dated temp file and open the OS share sheet. UI-free
 * (no dialog dependency): returns whether the share sheet was available plus the
 * file path, so the caller can fall back to a "saved to <path>" message.
 */
export async function writeAndShareCsv(
  fileBase: string,
  csv: string,
  dialogTitle: string,
): Promise<{ shared: boolean; fileUri: string }> {
  const today = new Date().toISOString().split('T')[0];
  const fileUri = (FileSystem.documentDirectory ?? '') + `${fileBase}_${today}.csv`;
  await FileSystem.writeAsStringAsync(fileUri, csv, {
    encoding: FileSystem.EncodingType.UTF8,
  });
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(fileUri, {
      mimeType: 'text/csv',
      dialogTitle,
      UTI: 'public.comma-separated-values-text',
    });
    return { shared: true, fileUri };
  }
  return { shared: false, fileUri };
}
