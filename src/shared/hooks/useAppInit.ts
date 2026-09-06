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
  const setWipeOnTamper = useAppStore((s) => s.setWipeOnTamper);
  const setWipeThreshold = useAppStore((s) => s.setWipeThreshold);
  const setStorageEncrypted = useAppStore((s) => s.setStorageEncrypted);
  const setNotificationFrequency = useAppStore((s) => s.setNotificationFrequency);
  const setWidgetEnabled = useAppStore((s) => s.setWidgetEnabled);
  const setRecentSearches = useAppStore((s) => s.setRecentSearches);
  const setAccounts = useAppStore((s) => s.setAccounts);
  const setCurrentAccountId = useAppStore((s) => s.setCurrentAccountId);

  useEffect(() => {
    // Resolve the active account first so the per-account reads below land in
    // the right namespace, and expose the registry to the UI (C8).
    dataStore
      .getCurrentAccountId()
      .then(async (currentAccountId) => {
        // D2: load the encryption flag + master key BEFORE any sensitive read,
        // so getFollowerData/getWhitelist/etc. can decrypt during hydration.
        await dataStore.initEncryptionState();
        const [
          data,
          whitelist,
          unfollowed,
          history,
          blockScreenshots,
          appLock,
          wipeOnTamper,
          wipeThreshold,
          storageEncrypted,
          notificationFrequency,
          recentSearches,
          accounts,
          widgetEnabled,
        ] = await Promise.all([
          dataStore.getFollowerData(),
          dataStore.getWhitelist(),
          dataStore.getUnfollowed(),
          dataStore.getHistory(),
          dataStore.getBlockScreenshots(),
          dataStore.getAppLock(),
          dataStore.getWipeOnTamper(),
          dataStore.getWipeThreshold(),
          dataStore.getStorageEncrypted(),
          dataStore.getNotificationFrequency(),
          dataStore.getRecentSearches(),
          dataStore.getAccounts(),
          dataStore.getWidgetEnabled(),
        ]);
        if (data) setFollowerData(data);
        setWhitelist(whitelist);
        setUnfollowed(unfollowed);
        setHistory(history);
        setBlockScreenshots(blockScreenshots);
        setAppLock(appLock);
        setWipeOnTamper(wipeOnTamper);
        setWipeThreshold(wipeThreshold);
        setStorageEncrypted(storageEncrypted);
        setNotificationFrequency(notificationFrequency);
        setRecentSearches(recentSearches);
        setAccounts(accounts);
        setWidgetEnabled(widgetEnabled);
        setCurrentAccountId(currentAccountId);
      })
      .catch((err) => {
        console.error('App init failed', err);
      })
      .finally(() => {
        setHydrating(false);
        // #10: configure the foreground handler + (re)schedule local reminders
        // once hydration is done. Lazy-imported so the native module stays off
        // the critical path; rescheduleFromState re-reads pref + history itself.
        import('../../services/notifications')
          .then((n) => {
            n.configureForegroundHandler();
            return n.rescheduleFromState();
          })
          .catch(() => {});
        // C10: keep the home-screen widget in sync on every launch, so it stays
        // fresh without needing a re-import. refreshIfEnabled re-reads the
        // opt-in flag + follower data itself; no-ops in Expo Go.
        import('../../services/widget')
          .then((w) => w.refreshIfEnabled())
          .catch(() => {});
      });
  }, [
    setFollowerData,
    setWhitelist,
    setUnfollowed,
    setHistory,
    setHydrating,
    setBlockScreenshots,
    setAppLock,
    setWipeOnTamper,
    setWipeThreshold,
    setStorageEncrypted,
    setNotificationFrequency,
    setWidgetEnabled,
    setRecentSearches,
    setAccounts,
    setCurrentAccountId,
  ]);
}
