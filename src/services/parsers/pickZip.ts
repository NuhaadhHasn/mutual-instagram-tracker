import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { PickedZip } from './pickZip.types';

/**
 * Native (Android/iOS) file pick. Behaviour is deliberately unchanged from
 * before the web split existed: copy into the cache directory, stat it, then
 * read it back as base64. See `pickZip.web.ts` for the browser path.
 */
export async function pickZip(): Promise<PickedZip | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: 'application/zip',
    copyToCacheDirectory: true,
  });

  if (result.canceled || !result.assets || result.assets.length === 0) {
    return null;
  }

  const { uri } = result.assets[0];
  const info = await FileSystem.getInfoAsync(uri);

  return {
    size: info.exists && typeof info.size === 'number' ? info.size : undefined,
    load: async () => ({
      data: await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      }),
      base64: true,
    }),
  };
}
