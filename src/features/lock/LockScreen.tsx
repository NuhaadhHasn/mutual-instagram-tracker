import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as LocalAuthentication from 'expo-local-authentication';
import { useTheme } from '../../shared/context/ThemeContext';
import { ColorSet, Gradients, DarkGradients, Spacing } from '../../shared/constants/theme';
import { haptic } from '../../shared/utils/haptics';
import { dataStore } from '../../services/storage/dataStore';
import { useAppStore } from '../../shared/store/appStore';

/**
 * Full-screen lock shown before the app content when app-lock is enabled (D1).
 * Authenticates with biometrics, falling back to the device passcode. The app
 * is only the gate — auth is handled entirely by the OS.
 *
 * Wipe-on-tamper (D5): when enabled, GENUINE auth failures (a wrong biometric /
 * passcode → `error === 'authentication_failed'`) increment a persisted counter;
 * once it reaches the threshold the app is fully wiped and `onWiped` fires.
 * Cancelling the OS prompt (`user_cancel` / `system_cancel` / `app_cancel`) is
 * NOT a failure, so backgrounding the app never counts toward a wipe.
 */
export default function LockScreen({
  onUnlock,
  onWiped,
}: {
  onUnlock: () => void;
  onWiped: () => void;
}) {
  const { colors, isDark } = useTheme();
  const styles = makeStyles(colors);
  const [authing, setAuthing] = useState(false);
  // null until the D5 prefs load; warning only shows once it's on with failures.
  const [remaining, setRemaining] = useState<number | null>(null);
  const gradient = isDark ? DarkGradients.primary : Gradients.primary;

  const authenticate = useCallback(async () => {
    if (authing) return;
    setAuthing(true);
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Unlock Mutual',
        fallbackLabel: 'Use passcode',
        disableDeviceFallback: false,
      });
      if (result.success) {
        haptic.success();
        await dataStore.resetFailedUnlocks();
        onUnlock();
        return;
      }

      haptic.error();
      // Only a genuine wrong attempt counts — never a user/system/app cancel.
      const error = (result as { error?: string }).error;
      if (error !== 'authentication_failed') return;

      const wipeOn = await dataStore.getWipeOnTamper();
      if (!wipeOn) return;

      const threshold = await dataStore.getWipeThreshold();
      const count = await dataStore.incrementFailedUnlocks();
      if (count >= threshold) {
        await dataStore.wipeEverything();
        useAppStore.getState().reset();
        await dataStore.resetFailedUnlocks();
        onWiped();
      } else {
        setRemaining(threshold - count);
      }
    } catch {
      haptic.error();
    } finally {
      setAuthing(false);
    }
  }, [authing, onUnlock, onWiped]);

  // Auto-prompt on mount.
  useEffect(() => {
    authenticate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <LinearGradient
      colors={[...gradient]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.root}
    >
      <View style={styles.iconWrap}>
        <Ionicons name="lock-closed" size={48} color="#fff" />
      </View>
      <Text style={styles.title}>Mutual is locked</Text>
      <Text style={styles.subtitle}>
        Unlock with your fingerprint, Face ID, or device passcode.
      </Text>
      {remaining !== null && (
        <View style={styles.warnPill}>
          <Ionicons name="warning" size={14} color="#fff" />
          <Text style={styles.warnText}>
            {remaining} {remaining === 1 ? 'attempt' : 'attempts'} left before
            all data is erased
          </Text>
        </View>
      )}
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={authenticate}
        style={styles.button}
        disabled={authing}
      >
        <Ionicons name="finger-print" size={20} color={colors.primary} />
        <Text style={styles.buttonText}>Unlock</Text>
      </TouchableOpacity>
    </LinearGradient>
  );
}

function makeStyles(colors: ColorSet) {
  return StyleSheet.create({
    root: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: Spacing.xl,
    },
    iconWrap: {
      width: 96,
      height: 96,
      borderRadius: 48,
      backgroundColor: 'rgba(255,255,255,0.18)',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: Spacing.lg,
    },
    title: {
      fontSize: 24,
      fontWeight: '800',
      color: '#fff',
      letterSpacing: -0.3,
    },
    subtitle: {
      fontSize: 14,
      color: 'rgba(255,255,255,0.85)',
      textAlign: 'center',
      marginTop: Spacing.sm,
      marginBottom: Spacing.xl,
      lineHeight: 20,
    },
    warnPill: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: 'rgba(0,0,0,0.28)',
      borderRadius: 20,
      paddingHorizontal: Spacing.md,
      paddingVertical: 8,
      marginBottom: Spacing.lg,
    },
    warnText: {
      color: '#fff',
      fontSize: 13,
      fontWeight: '700',
      marginLeft: 6,
    },
    button: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: '#fff',
      borderRadius: 28,
      paddingHorizontal: Spacing.xl,
      height: 52,
    },
    buttonText: {
      color: colors.primary,
      fontSize: 15,
      fontWeight: '700',
      marginLeft: 8,
    },
  });
}
