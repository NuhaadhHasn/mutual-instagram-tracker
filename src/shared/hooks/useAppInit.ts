import { useEffect } from 'react';
import { dataStore } from '../../services/storage/dataStore';
import { useAppStore } from '../store/appStore';

export function useAppInit() {
  const setFollowerData = useAppStore((s) => s.setFollowerData);
  const setWhitelist = useAppStore((s) => s.setWhitelist);
  const setUnfollowed = useAppStore((s) => s.setUnfollowed);
  const setHistory = useAppStore((s) => s.setHistory);
  const setHydrating = useAppStore((s) => s.setHydrating);
  const setBlockScreenshots = useAppStore((s) => s.setBlockScreenshots);
  const setAppLock = useAppStore((s) => s.setAppLock);
  const setAccounts = useAppStore((s) => s.setAccounts);
  const setCurrentAccountId = useAppStore((s) => s.setCurrentAccountId);

  useEffect(() => {
    // Resolve the active account first so the per-account reads below land in
    // the right namespace, and expose the registry to the UI (C8).
    dataStore
      .getCurrentAccountId()
      .then((currentAccountId) =>
        Promise.all([
          dataStore.getFollowerData(),
          dataStore.getWhitelist(),
          dataStore.getUnfollowed(),
          dataStore.getHistory(),
          dataStore.getBlockScreenshots(),
          dataStore.getAppLock(),
          dataStore.getAccounts(),
        ]).then(
          ([data, whitelist, unfollowed, history, blockScreenshots, appLock, accounts]) => {
            if (data) setFollowerData(data);
            setWhitelist(whitelist);
            setUnfollowed(unfollowed);
            setHistory(history);
            setBlockScreenshots(blockScreenshots);
            setAppLock(appLock);
            setAccounts(accounts);
            setCurrentAccountId(currentAccountId);
          },
        ),
      )
      .catch((err) => {
        console.error('App init failed', err);
      })
      .finally(() => {
        setHydrating(false);
      });
  }, [
    setFollowerData,
    setWhitelist,
    setUnfollowed,
    setHistory,
    setHydrating,
    setBlockScreenshots,
    setAppLock,
    setAccounts,
    setCurrentAccountId,
  ]);
}
