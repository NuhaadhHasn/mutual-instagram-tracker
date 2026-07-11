import * as FileSystem from 'expo-file-system/legacy';
import * as DocumentPicker from 'expo-document-picker';
import JSZip from 'jszip';
import { InstagramUser, FollowerData } from '../../shared/types';
import { computeDerived } from './computeFollowerData';

// Defensive limits (D8) — reject pathological inputs before they can OOM the JS
// thread or hang the UI. A real IG export is a few MB; 100MB is a generous cap.
const MAX_ZIP_BYTES = 100 * 1024 * 1024;
const MAX_USERS = 2_000_000;

export class InstagramDataParser {
  /**
   * Pick and parse Instagram data export ZIP file
   */
  async pickAndParseZip(): Promise<FollowerData> {
    try {
      // Pick ZIP file
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/zip',
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) {
        throw new Error('File selection cancelled');
      }

      const uri = result.assets[0].uri;

      // Reject oversized files before reading them into memory (zip-bomb guard).
      const info = await FileSystem.getInfoAsync(uri);
      if (info.exists && typeof info.size === 'number' && info.size > MAX_ZIP_BYTES) {
        throw new Error(
          `That file is too large (${Math.round(info.size / 1024 / 1024)}MB). ` +
            `Please pick your Instagram data ZIP (normally a few MB).`,
        );
      }

      // Read file
      const fileContent = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      // Unzip and parse
      return await this.parseZipContent(fileContent);
    } catch (error) {
      console.error('Error picking/parsing file:', error);
      throw error;
    }
  }

  /**
   * Parse ZIP file content
   */
  private async parseZipContent(base64Content: string): Promise<FollowerData> {
    try {
      // Load ZIP
      const zip = await JSZip.loadAsync(base64Content, { base64: true });

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
