import React from 'react';
import { View, StyleSheet } from 'react-native';
import SkeletonBox from '../SkeletonBox';
import { useTheme } from '../../context/ThemeContext';
import { Shadows, Spacing } from '../../constants/theme';

export default function UserItemSkeleton() {
  const { colors } = useTheme();
  return (
    <View
      style={[
        styles.row,
        { backgroundColor: colors.cardBackground },
        Shadows.sm,
      ]}
    >
      <SkeletonBox width={46} height={46} borderRadius={23} />
      <View style={styles.body}>
        <SkeletonBox width="60%" height={14} style={{ marginBottom: 6 }} />
        <SkeletonBox width="40%" height={11} />
      </View>
      <SkeletonBox width={32} height={32} borderRadius={16} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    padding: 12,
    marginBottom: 8,
  },
  body: {
    flex: 1,
    marginLeft: Spacing.md,
  },
});
