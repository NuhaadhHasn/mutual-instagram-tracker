import AsyncStorage from '@react-native-async-storage/async-storage';
import { KvStore } from './kv.types';

/**
 * Native (Android/iOS) key-value storage — AsyncStorage, exactly as the app has
 * always used it. This file is a thin pass-through by design: introducing the
 * facade must not change a single byte of what Android reads or writes.
 *
 * See `kv.web.ts` for the IndexedDB implementation and `kv.types.ts` for why
 * both are typed against a shared interface.
 */
export const kv: KvStore = {
  getItem: (key) => AsyncStorage.getItem(key),

  setItem: (key, value) => AsyncStorage.setItem(key, value),

  removeItem: (key) => AsyncStorage.removeItem(key),

  // AsyncStorage 2.x returns a readonly array; copy it so callers get the
  // plain, mutable string[] the contract promises.
  getAllKeys: async () => [...(await AsyncStorage.getAllKeys())],
};
