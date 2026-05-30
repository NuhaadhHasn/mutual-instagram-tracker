import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as LocalAuthentication from 'expo-local-authentication';
import { useTheme } from '../../shared/context/ThemeContext';
import { ColorSet, Gradients, DarkGradients, Spacing } from '../../shared/constants/theme';
import { haptic } from '../../shared/utils/haptics';

/**
 * Full-screen lock shown before the app content when app-lock is enabled (D1).
 * Authenticates with biometrics, falling back to the device passcode. The app
 * is only the gate — auth is handled entirely by the OS.
 */
export default function LockScreen({ onUnlock }: { onUnlock: () => void }) {
  const { colors, isDark } = useTheme();
  const styles = makeStyles(colors);
  const [authing, setAuthing] = useState(false);
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
        onUnlock();
      } else {
        haptic.error();
      }
    } catch {
      haptic.error();
    } finally {
      setAuthing(false);
    }
  }, [authing, onUnlock]);

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
