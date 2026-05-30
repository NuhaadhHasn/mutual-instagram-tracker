import React, { useEffect } from 'react';
import { StyleProp, ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
  Easing,
} from 'react-native-reanimated';

type Variant = 'slide' | 'scale';

type Props = {
  children: React.ReactNode;
  index?: number;
  delayStep?: number;
  variant?: Variant;
  duration?: number;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
};

const MAX_STAGGER_INDEX = 10;

export default function AnimatedFadeSlide({
  children,
  index = 0,
  delayStep = 60,
  variant = 'slide',
  duration = 320,
  disabled = false,
  style,
}: Props) {
  const opacity = useSharedValue(disabled ? 1 : 0);
  const translateY = useSharedValue(disabled || variant !== 'slide' ? 0 : 16);
  const scale = useSharedValue(disabled || variant !== 'scale' ? 1 : 0.85);

  useEffect(() => {
    if (disabled) {
      opacity.value = 1;
      translateY.value = 0;
      scale.value = 1;
      return;
    }
    const delay = Math.min(index, MAX_STAGGER_INDEX) * delayStep;
    opacity.value = withDelay(
      delay,
      withTiming(1, { duration, easing: Easing.out(Easing.cubic) }),
    );
    if (variant === 'slide') {
      translateY.value = withDelay(
        delay,
        withTiming(0, { duration, easing: Easing.out(Easing.cubic) }),
      );
    } else {
      scale.value = withDelay(
        delay,
        withTiming(1, { duration, easing: Easing.out(Easing.cubic) }),
      );
    }
  }, [disabled, index, delayStep, duration, variant, opacity, translateY, scale]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform:
      variant === 'slide'
        ? [{ translateY: translateY.value }]
        : [{ scale: scale.value }],
  }));

  return <Animated.View style={[style, animatedStyle]}>{children}</Animated.View>;
}
