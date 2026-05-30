import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { Shadows, Spacing } from '../constants/theme';

export function ageDays(timestamp: number): number {
  return Math.floor((Date.now() - timestamp) / (24 * 60 * 60 * 1000));
}

export function ageLabel(timestamp: number): string {
  const days = ageDays(timestamp);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 30) return `${days} days ago`;
  const months = Math.floor(days / 30);
  if (months === 1) return '1 month ago';
  return `${months} months ago`;
}

export default function FreshnessBanner({
  lastUpdated,
  onPressImport,
  warnAfterDays = 14,
}: {
  lastUpdated: number;
  onPressImport: () => void;
  warnAfterDays?: number;
}) {
  const { colors } = useTheme();
  const days = ageDays(lastUpdated);
  if (days < warnAfterDays) return null;

  const stale = days >= 30;
  const bg = stale ? '#FF980015' : colors.primary + '12';
  const accent = stale ? '#FF9800' : colors.primary;

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={onPressImport}
      style={[styles.banner, { backgroundColor: bg, borderLeftColor: accent }]}
    >
      <Ionicons name="time-outline" size={18} color={accent} />
      <View style={styles.body}>
        <Text style={[styles.title, { color: colors.text }]}>
          {stale
            ? `Data is ${ageLabel(lastUpdated)} — likely stale`
            : `Data imported ${ageLabel(lastUpdated)}`}
        </Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          Tap to import a fresh ZIP from Instagram
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderLeftWidth: 3,
    marginBottom: Spacing.sm,
    gap: 10,
    ...Shadows.sm,
  },
  body: { flex: 1 },
  title: { fontSize: 13, fontWeight: '700' },
  subtitle: { fontSize: 11, marginTop: 1 },
});
