import React, { useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  FlatList,
  TouchableOpacity,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ColorSet,
  DarkGradients,
  Gradients,
  Shadows,
  Spacing,
} from '../../../shared/constants/theme';
import { useTheme } from '../../../shared/context/ThemeContext';
import AnimatedFadeSlide from '../../../shared/components/AnimatedFadeSlide';
import { haptic } from '../../../shared/utils/haptics';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

type Slide = {
  id: string;
  kind: 'logo' | 'icon';
  icon?: keyof typeof Ionicons.glyphMap;
  iconColor?: string;
  title: string;
  subtitle: string;
  steps?: string[];
};

const SLIDES: Slide[] = [
  {
    id: '1',
    kind: 'logo',
    title: 'Welcome to Mutual',
    subtitle:
      "See who's really with you. A privacy-first follower tracker — 100% on your device.",
  },
  {
    id: '2',
    kind: 'icon',
    icon: 'shield-checkmark',
    iconColor: '#4CAF50',
    title: '100% private',
    subtitle:
      'No login. No servers. No tracking. Your Instagram data never leaves your phone.',
  },
  {
    id: '3',
    kind: 'icon',
    icon: 'document-text',
    title: 'How to get your data',
    subtitle: 'Instagram lets you export your follow lists in a few taps.',
    steps: [
      'Instagram → Settings → Accounts Center',
      'Your information → Download your information',
      'Request download → choose JSON format',
      'Wait for the email, download the ZIP',
      'Come back here and tap Import',
    ],
  },
  {
    id: '4',
    kind: 'icon',
    icon: 'rocket',
    title: "You're ready",
    subtitle:
      'Import your ZIP whenever you have it. Until then, everything else is one tap away.',
  },
];

export default function OnboardingScreen({ onDone }: { onDone: () => void }) {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const flatListRef = useRef<FlatList<Slide>>(null);
  const [currentIndex, setCurrentIndex] = useState(0);

  const gradient = isDark ? DarkGradients.primary : Gradients.primary;
  const buttonGradient = isDark ? DarkGradients.primaryShort : Gradients.primaryShort;
  const isLast = currentIndex === SLIDES.length - 1;

  const goNext = () => {
    haptic.tap();
    if (isLast) {
      onDone();
      return;
    }
    const next = currentIndex + 1;
    setCurrentIndex(next);
    flatListRef.current?.scrollToIndex({ index: next, animated: true });
  };

  const skip = () => {
    haptic.tap();
    onDone();
  };

  const renderItem = ({ item, index }: { item: Slide; index: number }) => (
    <View style={[styles.slide, { width: SCREEN_W }]} key={item.id}>
      <AnimatedFadeSlide
        index={0}
        variant="scale"
        disabled={index !== currentIndex}
      >
        {item.kind === 'logo' ? (
          <Image source={require('../../../../assets/icon.png')} style={styles.logo} />
        ) : (
          <View style={styles.iconWrap}>
            <Ionicons
              name={item.icon ?? 'sparkles'}
              size={84}
              color={item.iconColor ?? '#fff'}
            />
          </View>
        )}
      </AnimatedFadeSlide>

      <AnimatedFadeSlide index={1} disabled={index !== currentIndex}>
        <Text style={styles.slideTitle}>{item.title}</Text>
      </AnimatedFadeSlide>

      <AnimatedFadeSlide index={2} disabled={index !== currentIndex}>
        <Text style={styles.slideSubtitle}>{item.subtitle}</Text>
      </AnimatedFadeSlide>

      {item.steps && (
        <View style={styles.stepsCard}>
          {item.steps.map((step, i) => (
            <AnimatedFadeSlide key={i} index={3 + i} disabled={index !== currentIndex}>
              <View style={styles.stepRow}>
                <View style={styles.stepCircle}>
                  <Text style={styles.stepNumber}>{i + 1}</Text>
                </View>
                <Text style={styles.stepText}>{step}</Text>
              </View>
            </AnimatedFadeSlide>
          ))}
        </View>
      )}
    </View>
  );

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <LinearGradient
        colors={[...gradient]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFillObject}
      />
      <FlatList
        ref={flatListRef}
        data={SLIDES}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        scrollEnabled={false}
        keyExtractor={(s) => s.id}
        renderItem={renderItem}
        contentContainerStyle={{ paddingTop: insets.top + Spacing.xl }}
      />

      <View style={[styles.controls, { paddingBottom: insets.bottom + Spacing.lg }]}>
        <View style={styles.dots}>
          {SLIDES.map((_, i) => (
            <View
              key={i}
              style={[styles.dot, i === currentIndex && styles.dotActive]}
            />
          ))}
        </View>

        <TouchableOpacity
          activeOpacity={0.85}
          onPress={goNext}
          style={styles.nextBtnShadow}
        >
          <LinearGradient
            colors={[...buttonGradient]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.nextBtn}
          >
            <Text style={styles.nextBtnText}>
              {isLast ? 'Get started' : 'Next'}
            </Text>
            <Ionicons
              name={isLast ? 'checkmark' : 'arrow-forward'}
              size={20}
              color="#fff"
            />
          </LinearGradient>
        </TouchableOpacity>

        {!isLast && (
          <TouchableOpacity onPress={skip} style={styles.skipBtn} hitSlop={10}>
            <Text style={styles.skipText}>Skip</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

function makeStyles(_colors: ColorSet) {
  return StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: '#E1306C',
    },
    slide: {
      paddingHorizontal: Spacing.xl,
      paddingTop: Spacing.xl,
      alignItems: 'center',
    },
    logo: {
      width: 160,
      height: 160,
      borderRadius: 36,
      marginBottom: Spacing.xl,
      ...Shadows.lg,
    },
    iconWrap: {
      width: 140,
      height: 140,
      borderRadius: 70,
      backgroundColor: 'rgba(255,255,255,0.18)',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: Spacing.xl,
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.28)',
    },
    slideTitle: {
      fontSize: 30,
      fontWeight: '800',
      color: '#fff',
      textAlign: 'center',
      letterSpacing: -0.5,
      marginBottom: Spacing.sm,
    },
    slideSubtitle: {
      fontSize: 15,
      color: 'rgba(255,255,255,0.9)',
      textAlign: 'center',
      lineHeight: 22,
      marginBottom: Spacing.lg,
      paddingHorizontal: Spacing.md,
    },
    stepsCard: {
      width: '100%',
      backgroundColor: 'rgba(255,255,255,0.13)',
      borderRadius: 18,
      padding: Spacing.md,
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.2)',
    },
    stepRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: Spacing.sm,
    },
    stepCircle: {
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: '#fff',
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 12,
    },
    stepNumber: {
      color: '#E1306C',
      fontWeight: '800',
      fontSize: 13,
    },
    stepText: {
      flex: 1,
      color: '#fff',
      fontSize: 14,
      fontWeight: '500',
      lineHeight: 20,
    },
    controls: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      paddingHorizontal: Spacing.xl,
      paddingTop: Spacing.lg,
      alignItems: 'center',
    },
    dots: {
      flexDirection: 'row',
      marginBottom: Spacing.md,
    },
    dot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: 'rgba(255,255,255,0.4)',
      marginHorizontal: 4,
    },
    dotActive: {
      width: 24,
      backgroundColor: '#fff',
    },
    nextBtnShadow: {
      width: '100%',
      borderRadius: 28,
      ...Shadows.md,
    },
    nextBtn: {
      height: 54,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 28,
      gap: 8,
    },
    nextBtnText: {
      color: '#fff',
      fontSize: 16,
      fontWeight: '700',
      letterSpacing: 0.2,
    },
    skipBtn: {
      marginTop: 14,
      paddingVertical: 6,
      paddingHorizontal: 14,
    },
    skipText: {
      color: 'rgba(255,255,255,0.85)',
      fontSize: 14,
      fontWeight: '600',
    },
  });
}
