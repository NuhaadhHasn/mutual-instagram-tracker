import { create } from 'zustand';
import {
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
  reset: () => set({
    followerData: null,
    whitelist: [],
    unfollowed: [],
    history: [],
    isLoading: false,
    error: null,
  }),
}));
