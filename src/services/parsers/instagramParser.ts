import JSZip from 'jszip';
import { InstagramUser, FollowerData } from '../../shared/types';
import { computeDerived } from './computeFollowerData';
import { pickZip } from './pickZip';

// Defensive limits (D8) — reject pathological inputs before they can OOM the JS
// thread or hang the UI. A real IG export is a few MB; 100MB is a generous cap.
const MAX_ZIP_BYTES = 100 * 1024 * 1024;
const MAX_USERS = 2_000_000;

/**
 * Backing out of the system file picker is a NORMAL user action, not a failure.
 * It still has to unwind the async parse, so it travels as a throw — but callers
 * must be able to recognise it WITHOUT string-matching the message. Matching on
 * text was fragile: rewording the message silently turned every cancel into an
 * "Import failed" dialog. Check with `isPickerCancelled(err)` instead.
 */
export class PickerCancelledError extends Error {
  readonly cancelled = true as const;
  constructor() {
    super('File selection cancelled');
    this.name = 'PickerCancelledError';
  }
}

/** True when the user simply dismissed the picker. Safe on unknown values. */
export function isPickerCancelled(error: unknown): boolean {
  return error instanceof PickerCancelledError;
}

export class InstagramDataParser {
  /**
   * Pick and parse Instagram data export ZIP file
   */
  async pickAndParseZip(): Promise<FollowerData> {
    try {
      // Pick ZIP file. The picker and the byte-read are platform-split — see
      // pickZip.types.ts — so this method stays identical on native and web.
      const picked = await pickZip();

      if (!picked) {
        // Normal user action - not an error. See PickerCancelledError above.
        throw new PickerCancelledError();
      }

      // Reject oversized files before reading them into memory (zip-bomb guard).
      if (picked.size !== undefined && picked.size > MAX_ZIP_BYTES) {
        throw new Error(
          `That file is too large (${Math.round(picked.size / 1024 / 1024)}MB). ` +
            `Please pick your Instagram data ZIP (normally a few MB).`,
        );
      }

      // Read file
      const { data, base64 } = await picked.load();

      // Unzip and parse
      return await this.parseZipContent(data, base64);
    } catch (error) {
      // A cancel is not a failure - logging it as one produced a red LogBox in
      // dev every time the user backed out of the picker. Still rethrow so the
      // caller can unwind, just quietly.
      if (!isPickerCancelled(error)) {
        console.error('Error picking/parsing file:', error);
      }
      throw error;
    }
  }

  /**
   * Parse ZIP file content
   */
  private async parseZipContent(
    content: string | Blob,
    base64: boolean,
  ): Promise<FollowerData> {
    try {
      // Load ZIP. Native hands over a base64 string; web hands over the picked
      // File directly, which JSZip reads as a Blob with no decoding step.
      const zip = await JSZip.loadAsync(content, base64 ? { base64: true } : undefined);

      // Find and parse followers file
      const followersFile = zip.file(/followers_1\.json$/i)?.[0];
      if (!followersFile) {
        throw new Error('followers_1.json not found in ZIP');
      }
      const followersContent = await followersFile.async('text');
      const followersData = JSON.parse(followersContent);

      // Find and parse following file
      const followingFile = zip.file(/following\.json$/i)?.[0];
      if (!followingFile) {
        throw new Error('following.json not found in ZIP');
      }
      const followingContent = await followingFile.async('text');
      const followingData = JSON.parse(followingContent);

      // Process data
      return this.processData(followersData, followingData);
    } catch (error) {
      console.error('Error parsing ZIP content:', error);
      throw new Error('Failed to parse Instagram data. Please ensure you uploaded the correct ZIP file.');
    }
  }

  /**
   * Process raw Instagram data
   */
  private processData(followersRaw: any, followingRaw: any): FollowerData {
    // Validate top-level shape before touching nested fields.
    const followingList = followingRaw?.relationships_following;
    if (!Array.isArray(followersRaw) || !Array.isArray(followingList)) {
      throw new Error('Unexpected data format');
    }
    if (followersRaw.length > MAX_USERS || followingList.length > MAX_USERS) {
      throw new Error('This export is unexpectedly large and cannot be processed.');
    }

    // Extract followers — skip any malformed entries instead of crashing.
    const followers: InstagramUser[] = followersRaw
      .map((item: any) => {
        const entry = item?.string_list_data?.[0];
        if (!entry?.value) return null;
        return {
          username: entry.value,
          profileUrl: entry.href ?? `https://instagram.com/${entry.value}`,
          timestamp: entry.timestamp,
        } as InstagramUser;
      })
      .filter((u): u is InstagramUser => u !== null);

    // Extract following — `title` is the username; URL lives in string_list_data.
    const following: InstagramUser[] = followingList
      .map((item: any) => {
        const username = item?.title;
        if (!username) return null;
        const href = item?.string_list_data?.[0]?.href;
        return {
          username,
          profileUrl: href ? href.replace('/_u/', '/') : `https://instagram.com/${username}`,
          timestamp: item?.string_list_data?.[0]?.timestamp,
        } as InstagramUser;
      })
      .filter((u): u is InstagramUser => u !== null);

    // Derive unfollowers / fans / stats (shared pure math — see computeFollowerData).
    const { unfollowers, fans, stats } = computeDerived(followers, following);

    const data: FollowerData = {
      followers,
      following,
      unfollowers,
      fans,
      stats,
      lastUpdated: Date.now(),
    };

    if (!this.validateData(data)) {
      throw new Error('Parsed data failed validation');
    }
    return data;
  }

  /**
   * Validate Instagram data structure
   */
  private validateData(data: any): boolean {
    return (
      Array.isArray(data.followers) &&
      Array.isArray(data.following) &&
      data.stats &&
      typeof data.stats.followersCount === 'number'
    );
  }
}

export const instagramParser = new InstagramDataParser();
