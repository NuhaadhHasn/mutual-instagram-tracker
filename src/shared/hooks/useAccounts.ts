import { useCallback } from 'react';
import { dataStore } from '../../services/storage/dataStore';
import { useAppStore } from '../store/appStore';

/**
 * Multi-account controls (C8). Centralises switch / add / rename / delete and
 * keeps the Zustand store in sync, including re-hydrating the four per-account
 * data slices whenever the active account changes (with isHydrating gating so
 * screens show skeletons and never flash another account's data).
 */
export function useAccounts() {
  const accounts = useAppStore((s) => s.accounts);
  const currentAccountId = useAppStore((s) => s.currentAccountId);
  const setAccounts = useAppStore((s) => s.setAccounts);
  const setCurrentAccountId = useAppStore((s) => s.setCurrentAccountId);
  const setFollowerData = useAppStore((s) => s.setFollowerData);
  const setWhitelist = useAppStore((s) => s.setWhitelist);
  const setUnfollowed = useAppStore((s) => s.setUnfollowed);
  const setHistory = useAppStore((s) => s.setHistory);
  const setHydrating = useAppStore((s) => s.setHydrating);

  const reloadActive = useCallback(async () => {
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
  }, [setFollowerData, setWhitelist, setUnfollowed, setHistory]);

  const switchAccount = useCallback(
    async (id: string) => {
      if (id === useAppStore.getState().currentAccountId) return;
      setHydrating(true);
      try {
        await dataStore.setCurrentAccount(id);
        setCurrentAccountId(id);
        await reloadActive();
      } catch (err) {
        console.error('Switch account failed', err);
      } finally {
        setHydrating(false);
      }
    },
    [reloadActive, setCurrentAccountId, setHydrating],
  );

  const addAccount = useCallback(
    async (name: string) => {
      const account = await dataStore.addAccount(name);
      setAccounts(await dataStore.getAccounts());
      await switchAccount(account.id);
      return account;
    },
    [setAccounts, switchAccount],
  );

  const renameAccount = useCallback(
    async (id: string, name: string) => {
      setAccounts(await dataStore.renameAccount(id, name));
    },
    [setAccounts],
  );

  const deleteAccount = useCallback(
    async (id: string) => {
      const res = await dataStore.deleteAccount(id);
      setAccounts(res.accounts);
      if (res.currentAccountId !== useAppStore.getState().currentAccountId) {
        setCurrentAccountId(res.currentAccountId);
        setHydrating(true);
        try {
          await reloadActive();
        } finally {
          setHydrating(false);
        }
      }
      return res;
    },
    [reloadActive, setAccounts, setCurrentAccountId, setHydrating],
  );

  const currentAccount =
    accounts.find((a) => a.id === currentAccountId) ?? null;

  return {
    accounts,
    currentAccountId,
    currentAccount,
    switchAccount,
    addAccount,
    renameAccount,
    deleteAccount,
  };
}
