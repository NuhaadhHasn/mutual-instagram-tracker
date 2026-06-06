import { useCallback } from 'react';
import { dataStore } from '../../services/storage/dataStore';
import { useAppStore } from '../store/appStore';

/**
 * Recent-search history (#11). Reads the persisted list from the store and
 * exposes `record` (persist + refresh) and `clear`. Global across accounts.
 */
export function useRecentSearches() {
  const recent = useAppStore((s) => s.recentSearches);
  const setRecentSearches = useAppStore((s) => s.setRecentSearches);

  const record = useCallback(
    async (term: string) => {
      const updated = await dataStore.addRecentSearch(term);
      setRecentSearches(updated);
    },
    [setRecentSearches],
  );

  const clear = useCallback(async () => {
    await dataStore.clearRecentSearches();
    setRecentSearches([]);
  }, [setRecentSearches]);

  return { recent, record, clear };
}
