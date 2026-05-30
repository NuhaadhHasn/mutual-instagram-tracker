import React from 'react';
import { View, StyleSheet } from 'react-native';
import SkeletonBox from '../SkeletonBox';
import { useTheme } from '../../context/ThemeContext';
import { Shadows, Spacing } from '../../constants/theme';

export default function ChartCardSkeleton({ height = 180 }: { height?: number }) {
  const { colors } = useTheme();
  return (
    <View
      style={[
        styles.card,
        { backgroundColor: colors.cardBackground },
        Shadows.md,
      ]}
    >
      <SkeletonBox width="45%" height={16} style={{ marginBottom: Spacing.sm }} />
      <SkeletonBox width="100%" height={height} borderRadius={12} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
});
