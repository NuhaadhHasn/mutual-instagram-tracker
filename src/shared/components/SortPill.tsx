import React from 'react';
import {
  StyleProp,
  Text,
  TextStyle,
  TouchableOpacity,
  ViewStyle,
} from 'react-native';

// Module-scope + memoized shared filter/sort pill. Was duplicated inline inside
// the Unfollowers / Fans / UsersList screen functions (new component identity
// every parent render → React remounted each pill). C15e item 1.
export interface SortPillStyles {
  sortPill: StyleProp<ViewStyle>;
  sortPillActive: StyleProp<ViewStyle>;
  sortPillText: StyleProp<TextStyle>;
  sortPillTextActive: StyleProp<TextStyle>;
}

export interface SortPillProps {
  label: string;
  active: boolean;
  onPress: () => void;
  styles: SortPillStyles;
}

const SortPill = React.memo(function SortPill({
  label,
  active,
  onPress,
  styles,
}: SortPillProps) {
  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={onPress}
      style={[styles.sortPill, active && styles.sortPillActive]}
    >
      <Text style={[styles.sortPillText, active && styles.sortPillTextActive]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
});

export default SortPill;
