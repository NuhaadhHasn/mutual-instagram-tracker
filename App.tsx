import React, { useEffect, useRef, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import Ionicons from '@expo/vector-icons/Ionicons';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { kv } from './src/services/storage/kv';
import { View, AppState } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';

import ImportScreen from './src/features/import/screens/ImportScreen';
import DashboardScreen from './src/features/dashboard/screens/DashboardScreen';
import UnfollowersScreen from './src/features/unfollowers/screens/UnfollowersScreen';
import AnalyticsScreen from './src/features/analytics/screens/AnalyticsScreen';
import SettingsScreen from './src/features/settings/screens/SettingsScreen';
import HistoryScreen from './src/features/history/screens/HistoryScreen';
import FansScreen from './src/features/fans/screens/FansScreen';
import OnboardingScreen from './src/features/onboarding/screens/OnboardingScreen';
import UsersListScreen from './src/features/users/UsersListScreen';
import SearchScreen from './src/features/search/screens/SearchScreen';

import { ThemeProvider, useTheme } from './src/shared/context/ThemeContext';
import { DialogProvider } from './src/shared/context/DialogContext';
import { useAppInit } from './src/shared/hooks/useAppInit';
import { useScreenCaptureGuard } from './src/shared/hooks/useScreenCaptureGuard';
import { useAppStore } from './src/shared/store/appStore';
import { dataStore } from './src/services/storage/dataStore';
import LockScreen from './src/features/lock/LockScreen';
import PassphraseUnlockScreen from './src/features/lock/PassphraseUnlockScreen';
import { needsPassphraseUnlock } from './src/services/storage/masterKey';
import ErrorBoundary from './src/shared/components/ErrorBoundary';
import { canLockApp } from './src/shared/utils/platformCapabilities';
import { useIsDesktop } from './src/shared/hooks/useIsDesktop';
import { Spacing } from './src/shared/constants/theme';

const ONBOARDING_KEY = '@instagram_tracker:onboarding_done';
// Width of the desktop side navigation.
const SIDEBAR_WIDTH = 232;
// Re-lock when the app returns to the foreground after being away this long.
const LOCK_GRACE_MS = 15_000;

// Keep the native splash visible until we've decided whether to show
// onboarding or the main app. Hidden by RootGate once the gate resolves.
SplashScreen.preventAutoHideAsync().catch(() => {});

const Tab = createBottomTabNavigator();
const RootStack = createNativeStackNavigator();

export default function App() {
  return (
    <ErrorBoundary>
      <SafeAreaProvider>
        <ThemeProvider>
          <DialogProvider>
            <RootGate />
          </DialogProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}

function RootGate() {
  const [onboardingDone, setOnboardingDone] = useState<boolean | null>(null);
  const [locked, setLocked] = useState(false);
  // Web-only: true when the at-rest key is passphrase-wrapped and has not been
  // unwrapped yet. Unlike the app lock this is not a courtesy gate — nothing
  // can be decrypted until it clears. Always false on native.
  const [needsPassphrase, setNeedsPassphrase] = useState(false);
  const backgroundedAt = useRef<number | null>(null);

  useEffect(() => {
    Promise.all([
      kv.getItem(ONBOARDING_KEY),
      dataStore.getAppLock(),
      needsPassphraseUnlock(),
    ])
      .then(([val, appLock, needsPass]) => {
        setOnboardingDone(val === 'true');
        setNeedsPassphrase(needsPass);
        // `canLockApp` guards against a permanent lockout: web has no biometric
        // or passcode prompt to unlock WITH, so honouring a stored lock flag
        // there (e.g. carried in from a restored Android backup) would leave the
        // app stuck on a lock screen that can never be satisfied.
        if (appLock && canLockApp) setLocked(true);
      })
      .catch(() => setOnboardingDone(false))
      .finally(() => {
        // Resolved one way or another — let the native splash fade out.
        SplashScreen.hideAsync().catch(() => {});
      });
  }, []);

  // Re-lock when returning to the foreground after a grace period. Reads the
  // live app-lock pref from the store so toggling it in Settings takes effect.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'background' || state === 'inactive') {
        if (backgroundedAt.current === null) backgroundedAt.current = Date.now();
      } else if (state === 'active') {
        const away = backgroundedAt.current;
        backgroundedAt.current = null;
        if (
          useAppStore.getState().appLock &&
          away !== null &&
          Date.now() - away > LOCK_GRACE_MS
        ) {
          setLocked(true);
        }
        // #10: re-check + reschedule reminders on every foreground (cheap —
        // cancel+replace under one id; no-ops when notifications are unavailable).
        import('./src/services/notifications')
          .then((n) => n.rescheduleFromState())
          .catch(() => {});
      }
    });
    return () => sub.remove();
  }, []);

  if (onboardingDone === null) {
    // Keep the JS root pink so there's no white flash if the native
    // splash hides a frame before we render real content.
    return <View style={{ flex: 1, backgroundColor: '#E1306C' }} />;
  }

  if (!onboardingDone) {
    return (
      <OnboardingScreen
        onDone={async () => {
          await kv.setItem(ONBOARDING_KEY, 'true');
          setOnboardingDone(true);
        }}
      />
    );
  }

  if (needsPassphrase) {
    return (
      // ThemedApp is not mounted while this gate is up, so hydration has not
      // run yet — it runs for the first time once the key is in memory, with
      // everything already decryptable.
      <PassphraseUnlockScreen
        onUnlock={() => setNeedsPassphrase(false)}
        onWiped={() => {
          // Same clean-slate reset the app-lock wipe performs.
          setNeedsPassphrase(false);
          setOnboardingDone(false);
        }}
      />
    );
  }

  if (locked) {
    return (
      <LockScreen
        onUnlock={() => setLocked(false)}
        onWiped={() => {
          // D5: data nuked by LockScreen — drop to a clean first-launch state.
          setLocked(false);
          setOnboardingDone(false);
          // #10: cancel any scheduled reminder so it doesn't outlive the wipe.
          import('./src/services/notifications')
            .then((n) => n.cancelImportReminder())
            .catch(() => {});
        }}
      />
    );
  }

  return <ThemedApp />;
}

function ThemedApp() {
  useAppInit();
  const blockScreenshots = useAppStore((s) => s.blockScreenshots);
  useScreenCaptureGuard(blockScreenshots);

  return (
    <NavigationContainer>
      <RootStack.Navigator screenOptions={{ headerShown: false }}>
        <RootStack.Screen name="Tabs" component={TabsNavigator} />
        <RootStack.Screen name="Search" component={SearchScreen} />
        <RootStack.Screen name="History" component={HistoryScreen} />
        <RootStack.Screen name="Fans" component={FansScreen} />
        <RootStack.Screen
          name="Followers"
          component={UsersListScreen}
          initialParams={{ kind: 'followers' }}
        />
        <RootStack.Screen
          name="Following"
          component={UsersListScreen}
          initialParams={{ kind: 'following' }}
        />
        <RootStack.Screen
          name="Mutual"
          component={UsersListScreen}
          initialParams={{ kind: 'mutual' }}
        />
      </RootStack.Navigator>
    </NavigationContainer>
  );
}

function TabsNavigator() {
  const { colors } = useTheme();
  // Desktop swaps the bottom tab bar for a sidebar. React Navigation 7
  // supports this natively via tabBarPosition, so there is no second
  // navigator to keep in sync — the same five screens, laid out differently.
  const isDesktop = useIsDesktop();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarPosition: isDesktop ? 'left' : 'bottom',
        // 'material' is what gives the left rail its full-height list look;
        // the default 'uikit' variant is built for a bottom bar.
        tabBarVariant: isDesktop ? 'material' : 'uikit',
        // Only pinned for the desktop rail. Left undefined elsewhere so React
        // Navigation keeps its own width-based choice on native — forcing
        // 'below-icon' there would override that on wide screens for no reason.
        ...(isDesktop ? { tabBarLabelPosition: 'beside-icon' as const } : {}),
        tabBarIcon: ({ focused, color, size }) => {
          let iconName: any;

          if (route.name === 'Dashboard') {
            iconName = focused ? 'home' : 'home-outline';
          } else if (route.name === 'Unfollowers') {
            iconName = focused ? 'people' : 'people-outline';
          } else if (route.name === 'Analytics') {
            iconName = focused ? 'bar-chart' : 'bar-chart-outline';
          } else if (route.name === 'Import') {
            iconName = focused ? 'cloud-upload' : 'cloud-upload-outline';
          } else if (route.name === 'Settings') {
            iconName = focused ? 'settings' : 'settings-outline';
          }

          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.tabBarInactive,
        tabBarLabelStyle: isDesktop
          ? { fontSize: 14, fontWeight: '600' }
          : { fontSize: 11, fontWeight: '600', marginTop: 2 },
        tabBarStyle: isDesktop
          ? {
              backgroundColor: colors.tabBar,
              // A full-height rail down the left edge, separated by a hairline
              // rather than the phone bar's drop shadow.
              width: SIDEBAR_WIDTH,
              // minWidth too: the navigator applies its own Material default
              // (360dp) as minWidth, which would otherwise win over `width`.
              minWidth: SIDEBAR_WIDTH,
              borderTopWidth: 0,
              borderRightWidth: 1,
              borderRightColor: colors.border,
              paddingTop: Spacing.md,
            }
          : {
              backgroundColor: colors.tabBar,
              borderTopWidth: 0,
              height: 70,
              paddingBottom: 10,
              paddingTop: 8,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: -4 },
              shadowOpacity: 0.08,
              shadowRadius: 12,
              elevation: 10,
            },
      })}
    >
      <Tab.Screen name="Dashboard" component={DashboardScreen} />
      <Tab.Screen name="Unfollowers" component={UnfollowersScreen} />
      <Tab.Screen name="Analytics" component={AnalyticsScreen} />
      <Tab.Screen name="Import" component={ImportScreen} />
      <Tab.Screen name="Settings" component={SettingsScreen} />
    </Tab.Navigator>
  );
}
