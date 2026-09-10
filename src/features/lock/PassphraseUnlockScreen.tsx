import React, { useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';

import { useTheme } from '../../shared/context/ThemeContext';
import {
  ColorSet,
  DarkGradients,
  Gradients,
  Spacing,
} from '../../shared/constants/theme';
import { unlockWithPassphrase } from '../../services/storage/masterKey';

/**
 * Shown before any app content when the web build's at-rest key is
 * passphrase-wrapped. Nothing can be decrypted until this succeeds, so unlike
 * the biometric LockScreen this is not a courtesy gate — it is the only path to
 * the data, and there is deliberately no way past it.
 *
 * A wrong passphrase is rejected by AES-GCM's auth tag during unwrap, so there
 * is no guessing oracle beyond "that was wrong". Attempts are not counted or
 * rate-limited: the work factor (PBKDF2 at 600k iterations) is the defence, and
 * a counter would only punish the legitimate user who mistyped.
 */
export default function PassphraseUnlockScreen({
  onUnlock,
}: {
  onUnlock: () => void;
}) {
  const { colors, isDark } = useTheme();
  const styles = makeStyles(colors);
  const [passphrase, setPassphrase] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const gradient = isDark ? DarkGradients.primary : Gradients.primary;

  const attempt = async () => {
    if (busy || !passphrase) return;
    setBusy(true);
    setError(null);
    // Yield once so the spinner paints before PBKDF2 occupies the thread.
    await new Promise((r) => setTimeout(r, 0));
    const ok = await unlockWithPassphrase(passphrase);
    if (ok) {
      onUnlock();
      return;
    }
    setBusy(false);
    setPassphrase('');
    setError('That passphrase did not unlock your data. Try again.');
  };

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={[...gradient]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFillObject}
      />
      <View style={styles.card}>
        <View style={styles.iconWrap}>
          <Ionicons name="lock-closed" size={34} color="#fff" />
        </View>
        <Text style={styles.title}>Unlock Mutual</Text>
        <Text style={styles.subtitle}>
          Your data is encrypted with your passphrase. Enter it to continue.
        </Text>

        <TextInput
          style={styles.input}
          value={passphrase}
          onChangeText={(t) => {
            setPassphrase(t);
            if (error) setError(null);
          }}
          placeholder="Passphrase"
          placeholderTextColor="rgba(255,255,255,0.5)"
          secureTextEntry
          autoFocus
          editable={!busy}
          onSubmitEditing={attempt}
          returnKeyType="go"
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <TouchableOpacity
          style={[styles.button, (!passphrase || busy) && styles.buttonDisabled]}
          onPress={attempt}
          disabled={!passphrase || busy}
          activeOpacity={0.85}
        >
          {busy ? (
            <ActivityIndicator color={colors.primary} />
          ) : (
            <Text style={styles.buttonText}>Unlock</Text>
          )}
        </TouchableOpacity>

        <Text style={styles.hint}>
          There is no recovery. Nobody — including us — can read or reset this;
          that is the point of it. If the passphrase is lost, the only way
          forward is to clear the data and import your export again.
        </Text>
      </View>
    </View>
  );
}

const makeStyles = (colors: ColorSet) =>
  StyleSheet.create({
    container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.lg },
    card: { width: '100%', maxWidth: 420, alignItems: 'center' },
    iconWrap: {
      width: 72,
      height: 72,
      borderRadius: 36,
      backgroundColor: 'rgba(255,255,255,0.18)',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: Spacing.lg,
    },
    title: { fontSize: 26, fontWeight: '800', color: '#fff', marginBottom: Spacing.sm },
    subtitle: {
      fontSize: 15,
      color: 'rgba(255,255,255,0.85)',
      textAlign: 'center',
      marginBottom: Spacing.lg,
      lineHeight: 21,
    },
    input: {
      width: '100%',
      backgroundColor: 'rgba(255,255,255,0.15)',
      borderRadius: 12,
      paddingHorizontal: Spacing.md,
      paddingVertical: 14,
      color: '#fff',
      fontSize: 16,
      marginBottom: Spacing.sm,
    },
    error: {
      color: '#fff',
      backgroundColor: 'rgba(0,0,0,0.25)',
      borderRadius: 8,
      paddingHorizontal: Spacing.sm,
      paddingVertical: 6,
      fontSize: 13,
      marginBottom: Spacing.sm,
      textAlign: 'center',
    },
    button: {
      width: '100%',
      backgroundColor: '#fff',
      borderRadius: 12,
      paddingVertical: 15,
      alignItems: 'center',
      marginTop: Spacing.xs,
    },
    buttonDisabled: { opacity: 0.5 },
    buttonText: { color: colors.primary, fontSize: 16, fontWeight: '700' },
    hint: {
      fontSize: 12,
      color: 'rgba(255,255,255,0.7)',
      textAlign: 'center',
      marginTop: Spacing.lg,
      lineHeight: 18,
    },
  });
