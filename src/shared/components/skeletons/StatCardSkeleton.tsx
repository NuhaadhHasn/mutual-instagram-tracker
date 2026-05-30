import React from 'react';
import { View, StyleSheet } from 'react-native';
import SkeletonBox from '../SkeletonBox';
import { useTheme } from '../../context/ThemeContext';
import { Shadows, Spacing } from '../../constants/theme';

export default function StatCardSkeleton() {
  const { colors } = useTheme();
  return (
    <View style={styles.touch}>
      <View
        style={[
          styles.card,
          { backgroundColor: colors.cardBackground, borderLeftColor: colors.border },
          Shadows.md,
        ]}
      >
        <SkeletonBox width={40} height={40} borderRadius={12} style={{ marginBottom: Spacing.sm }} />
        <SkeletonBox width="55%" height={22} style={{ marginBottom: 6 }} />
        <SkeletonBox width="40%" height={12} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  touch: {
    width: '50%',
    padding: Spacing.xs,
  },
  card: {
    borderRadius: 16,
    padding: Spacing.md,
    borderLeftWidth: 4,
    minHeight: 110,
  },
});
