import * as DocumentPicker from 'expo-document-picker';
import { PickedZip } from './pickZip.types';

/**
 * Web file pick. Shorter than the native path because the browser has already
 * done the work: the picked asset carries the actual `File`, and JSZip reads a
 * Blob natively, so there is no filesystem call and no base64 hop at all.
 */
export async function pickZip(): Promise<PickedZip | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: 'application/zip',
    // Web-only option, and it defaults to TRUE — left alone, the picker runs a
    // FileReader over the entire archive to produce a base64 data URL before it
    // ever returns. We want the File itself, so this must be explicitly off.
    base64: false,
  });

  if (result.canceled || !result.assets || result.assets.length === 0) {
    return null;
  }

  const asset = result.assets[0];
  const file = asset.file;
  if (!file) {
    // Only reachable if a future version of expo-document-picker stops
    // populating `file`. Fail loudly rather than quietly fetching the object
    // URL instead: a page served under `connect-src 'none'` cannot fetch even
    // its own blob: URLs, so that fallback would break exactly where it matters.
    throw new Error('The browser did not return the selected file.');
  }

  return {
    // The browser reports size without reading the file, so the zip-bomb guard
    // still runs before a single byte is loaded.
    size: asset.size,
    load: async () => ({ data: file, base64: false }),
  };
}
