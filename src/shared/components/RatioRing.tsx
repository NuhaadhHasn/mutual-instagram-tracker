import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { useTheme } from '../context/ThemeContext';

type Props = {
  /** 0–100, how much of the ring is filled. */
  percentage: number;
  size?: number;
  stroke?: number;
  /** Ring (progress) color. Defaults to theme primary. */
  color?: string;
  /** Track (background) color. Defaults to theme border. */
  trackColor?: string;
  /** Big center text. Defaults to `${pct}%`. */
  centerValue?: string;
  /** Small label under the center value. */
  centerLabel?: string;
  /** Color of the center value text. Defaults to `color`. */
  valueColor?: string;
};

/**
 * Circular progress dial. Extracted from AnalyticsScreen so it can be reused
 * for the Dashboard account-health dial (C12). Pure presentational component.
 */
export default function RatioRing({
  percentage,
  size = 170,
  stroke = 14,
  color,
  trackColor,
  centerValue,
  centerLabel,
  valueColor,
}: Props) {
  const { colors } = useTheme();
  const ringColor = color ?? colors.primary;
  const track = trackColor ?? colors.border;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const pct = Math.min(100, Math.max(0, percentage));
  const dashOffset = circumference - (pct / 100) * circumference;

  return (
    <View
      style={{
        width: size,
        height: size,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Svg width={size} height={size}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={track}
          strokeWidth={stroke}
          fill="transparent"
        />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={ringColor}
          strokeWidth={stroke}
          fill="transparent"
          strokeDasharray={`${circumference}`}
          strokeDashoffset={dashOffset}
          strokeLinecap="round"
          rotation="-90"
          originX={size / 2}
          originY={size / 2}
        />
      </Svg>
      <View style={styles.center}>
        <Text style={[styles.value, { color: valueColor ?? ringColor }]}>
          {centerValue ?? `${pct.toFixed(0)}%`}
        </Text>
        {centerLabel ? (
          <Text style={[styles.label, { color: colors.textSecondary }]}>
            {centerLabel}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  value: {
    fontSize: 30,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  label: {
    fontSize: 12,
    marginTop: 2,
  },
});
