import React from 'react';
import { View, StyleSheet } from 'react-native';
import SkeletonBox from '../SkeletonBox';
import { useTheme } from '../../context/ThemeContext';
import { Shadows } from '../../constants/theme';

export default function SnapshotItemSkeleton() {
  const { colors } = useTheme();
  return (
    <View
      style={[
        styles.row,
        { backgroundColor: colors.cardBackground },
        Shadows.sm,
      ]}
    >
      <View style={styles.left}>
        <SkeletonBox width="60%" height={14} style={{ marginBottom: 4 }} />
        <SkeletonBox width="40%" height={11} />
      </View>
      <View style={styles.right}>
        <SkeletonBox width={110} height={14} style={{ marginBottom: 4 }} />
        <SkeletonBox width={80} height={11} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    padding: 14,
    marginBottom: 8,
  },
  left: { flex: 1 },
  right: { alignItems: 'flex-end' },
});
