import { useCallback, useState } from 'react';
import { dataStore } from '../../services/storage/dataStore';
import { useAppStore } from '../store/appStore';

export function useRefreshAppData() {
  const setFollowerData = useAppStore((s) => s.setFollowerData);
  const setWhitelist = useAppStore((s) => s.setWhitelist);
  const setUnfollowed = useAppStore((s) => s.setUnfollowed);
  const setHistory = useAppStore((s) => s.setHistory);
  const [refreshing, setRefreshing] = useState(false);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const [data, whitelist, unfollowed, history] = await Promise.all([
        dataStore.getFollowerData(),
        dataStore.getWhitelist(),
        dataStore.getUnfollowed(),
        dataStore.getHistory(),
      ]);
      setFollowerData(data);
      setWhitelist(whitelist);
      setUnfollowed(unfollowed);
      setHistory(history);
    } catch (err) {
      console.error('Refresh failed', err);
    } finally {
      setRefreshing(false);
    }
  }, [setFollowerData, setWhitelist, setUnfollowed, setHistory]);

  return { refresh, refreshing };
}
