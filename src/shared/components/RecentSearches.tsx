import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { ColorSet, Spacing } from '../constants/theme';
import { useRecentSearches } from '../hooks/useRecentSearches';
import { haptic } from '../utils/haptics';

/**
 * Recent-search suggestion chips (#11). Renders nothing when there's no
 * history. Shown under a search bar while its query is empty; tapping a chip
 * re-runs that search via `onPick`.
 */
export default function RecentSearches({
  onPick,
}: {
  onPick: (term: string) => void;
}) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const { recent, clear } = useRecentSearches();

  if (recent.length === 0) return null;

  return (
    <View style={styles.wrap}>
      <View style={styles.headerRow}>
        <Text style={styles.label}>Recent</Text>
        <TouchableOpacity
          onPress={() => {
            haptic.tap();
            clear();
          }}
          hitSlop={8}
        >
          <Text style={styles.clear}>Clear</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.chipsRow}>
        {recent.map((term) => (
          <TouchableOpacity
            key={term}
            activeOpacity={0.7}
            onPress={() => onPick(term)}
            style={styles.chip}
          >
            <Ionicons name="time-outline" size={13} color={colors.textSecondary} />
            <Text style={styles.chipText} numberOfLines={1}>
              {term}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

function makeStyles(colors: ColorSet) {
  return StyleSheet.create({
    wrap: { marginTop: Spacing.sm },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 6,
    },
    label: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.4,
    },
    clear: { fontSize: 12, fontWeight: '700', color: colors.primary },
    chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      maxWidth: 180,
      backgroundColor: colors.sortPillInactive,
      borderRadius: 999,
      paddingHorizontal: 10,
      paddingVertical: 6,
      gap: 4,
    },
    chipText: { fontSize: 13, fontWeight: '600', color: colors.text },
  });
}
