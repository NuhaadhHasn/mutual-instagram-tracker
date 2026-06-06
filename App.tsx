import React, { useEffect, useRef, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
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
import ErrorBoundary from './src/shared/components/ErrorBoundary';

const ONBOARDING_KEY = '@instagram_tracker:onboarding_done';
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
  const backgroundedAt = useRef<number | null>(null);

  useEffect(() => {
    Promise.all([AsyncStorage.getItem(ONBOARDING_KEY), dataStore.getAppLock()])
      .then(([val, appLock]) => {
        setOnboardingDone(val === 'true');
        if (appLock) setLocked(true);
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
          await AsyncStorage.setItem(ONBOARDING_KEY, 'true');
          setOnboardingDone(true);
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

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
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
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
          marginTop: 2,
        },
        tabBarStyle: {
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
