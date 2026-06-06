import { create } from 'zustand';
import {
  Account,
  FollowerData,
  HistoricalSnapshot,
  UnfollowedUser,
  WhitelistUser,
} from '../types';

interface AppState {
  // Data
  followerData: FollowerData | null;
  whitelist: WhitelistUser[];
  unfollowed: UnfollowedUser[];
  history: HistoricalSnapshot[];
  isHydrating: boolean;
  isLoading: boolean;
  error: string | null;
  blockScreenshots: boolean;
  appLock: boolean;
  // Wipe-on-tamper (D5)
  wipeOnTamper: boolean;
  wipeThreshold: number;
  // Recent search terms (#11)
  recentSearches: string[];
  // Multi-account (C8)
  accounts: Account[];
  currentAccountId: string | null;

  // Actions
  setFollowerData: (data: FollowerData | null) => void;
  setWhitelist: (whitelist: WhitelistUser[]) => void;
  setUnfollowed: (unfollowed: UnfollowedUser[]) => void;
  setHistory: (history: HistoricalSnapshot[]) => void;
  setHydrating: (hydrating: boolean) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setBlockScreenshots: (enabled: boolean) => void;
  setAppLock: (enabled: boolean) => void;
  setWipeOnTamper: (enabled: boolean) => void;
  setWipeThreshold: (n: number) => void;
  setRecentSearches: (searches: string[]) => void;
  setAccounts: (accounts: Account[]) => void;
  setCurrentAccountId: (id: string | null) => void;
  reset: () => void;
}

export const useAppStore = create<AppState>((set) => ({
  // Initial state
  followerData: null,
  whitelist: [],
  unfollowed: [],
  history: [],
  isHydrating: true,
  isLoading: false,
  error: null,
  blockScreenshots: false,
  appLock: false,
  wipeOnTamper: false,
  wipeThreshold: 10,
  recentSearches: [],
  accounts: [],
  currentAccountId: null,

  // Actions
  setFollowerData: (data) => set({ followerData: data }),
  setWhitelist: (whitelist) => set({ whitelist }),
  setUnfollowed: (unfollowed) => set({ unfollowed }),
  setHistory: (history) => set({ history }),
  setHydrating: (isHydrating) => set({ isHydrating }),
  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error }),
  setBlockScreenshots: (blockScreenshots) => set({ blockScreenshots }),
  setAppLock: (appLock) => set({ appLock }),
  setWipeOnTamper: (wipeOnTamper) => set({ wipeOnTamper }),
  setWipeThreshold: (wipeThreshold) => set({ wipeThreshold }),
  setRecentSearches: (recentSearches) => set({ recentSearches }),
  setAccounts: (accounts) => set({ accounts }),
  setCurrentAccountId: (currentAccountId) => set({ currentAccountId }),
  reset: () => set({
    followerData: null,
    whitelist: [],
    unfollowed: [],
    history: [],
    isLoading: false,
    error: null,
  }),
}));
