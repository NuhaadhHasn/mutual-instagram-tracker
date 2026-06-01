import React, { forwardRef, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { captureRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import { AnalyticsStats } from '../../shared/types';
import {
  BorderRadius,
  ColorSet,
  Gradients,
  Shadows,
  Spacing,
} from '../../shared/constants/theme';
import { healthScore } from '../../shared/utils/healthScore';
import RatioRing from '../../shared/components/RatioRing';
import { useTheme } from '../../shared/context/ThemeContext';
import { haptic } from '../../shared/utils/haptics';

type ShapeKey = 'story' | 'square';

// The shareable card always uses the vibrant brand gradient + white text (a
// recognizable, on-brand artifact regardless of the in-app theme). Aggregate
// numbers only — never any usernames (privacy-first).
const CARD_WIDTH = 300;
const SHAPES: Record<
  ShapeKey,
  { w: number; h: number; label: string; icon: keyof typeof Ionicons.glyphMap }
> = {
  story: {
    w: CARD_WIDTH,
    h: Math.round((CARD_WIDTH * 16) / 9),
    label: 'Story 9:16',
    icon: 'phone-portrait-outline',
  },
  square: {
    w: CARD_WIDTH,
    h: CARD_WIDTH,
    label: 'Square 1:1',
    icon: 'square-outline',
  },
};

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <View style={cardStyles.tile}>
      <Text style={cardStyles.tileValue}>{value}</Text>
      <Text style={cardStyles.tileLabel}>{label}</Text>
    </View>
  );
}

// The capture target. forwardRef so captureRef() can grab the rendered view.
const StatCardArt = forwardRef<View, { shape: ShapeKey; stats: AnalyticsStats }>(
  function StatCardArt({ shape, stats }, ref) {
    const dims = SHAPES[shape];
    const health = healthScore(stats);
    const tall = shape === 'story';
    return (
      <View
        ref={ref}
        collapsable={false}
        style={{
          width: dims.w,
          height: dims.h,
          borderRadius: 20,
          overflow: 'hidden',
        }}
      >
        <LinearGradient
          colors={[...Gradients.primary]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[
            cardStyles.fill,
            { justifyContent: tall ? 'space-between' : 'center' },
          ]}
        >
          <View style={cardStyles.brandRow}>
            <View style={cardStyles.brandIcon}>
              <Ionicons name="infinite" size={18} color="#fff" />
            </View>
            <Text style={cardStyles.brandName}>Mutual</Text>
          </View>

          <View style={cardStyles.ringWrap}>
            <RatioRing
              percentage={health.score}
              size={tall ? 132 : 104}
              stroke={10}
              color="#fff"
              valueColor="#fff"
              trackColor="rgba(255,255,255,0.3)"
              centerValue={String(health.score)}
            />
            <Text style={cardStyles.bandText}>{health.band} health</Text>
          </View>

          <View style={cardStyles.tileGrid}>
            <StatTile label="Followers" value={stats.followersCount.toLocaleString()} />
            <StatTile label="Following" value={stats.followingCount.toLocaleString()} />
            <StatTile label="Mutual" value={stats.mutualFollows.toLocaleString()} />
            <StatTile label="Fans" value={stats.fansCount.toLocaleString()} />
          </View>

          <View style={cardStyles.bottom}>
            <View style={cardStyles.followBackPill}>
              <Ionicons name="sync" size={13} color="#fff" />
              <Text style={cardStyles.followBackText}>
                {stats.followBackRatio.toFixed(0)}% follow back
              </Text>
            </View>
            <Text style={cardStyles.tagline}>see who&apos;s really with you</Text>
          </View>
        </LinearGradient>
      </View>
    );
  },
);

type Props = {
  visible: boolean;
  onClose: () => void;
  stats: AnalyticsStats;
};

export default function ShareStatModal({ visible, onClose, stats }: Props) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const [shape, setShape] = useState<ShapeKey>('story');
  const [busy, setBusy] = useState(false);
  const cardRef = useRef<View>(null);

  const handleShare = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const uri = await captureRef(cardRef, {
        format: 'png',
        quality: 1,
        result: 'tmpfile',
      });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, {
          mimeType: 'image/png',
          dialogTitle: 'Share your Mutual stats',
          UTI: 'public.png',
        });
        haptic.success();
      }
    } catch {
      haptic.error();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.headerRow}>
            <Text style={styles.title}>Share your stats</Text>
            <TouchableOpacity onPress={onClose} hitSlop={10}>
              <Ionicons name="close" size={24} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <View style={styles.toggle}>
            {(Object.keys(SHAPES) as ShapeKey[]).map((key) => {
              const active = shape === key;
              return (
                <TouchableOpacity
                  key={key}
                  activeOpacity={0.85}
                  onPress={() => setShape(key)}
                  style={[styles.segment, active && { backgroundColor: colors.primary }]}
                >
                  <Ionicons
                    name={SHAPES[key].icon}
                    size={15}
                    color={active ? '#fff' : colors.textSecondary}
                  />
                  <Text
                    style={[
                      styles.segmentText,
                      { color: active ? '#fff' : colors.textSecondary },
                    ]}
                  >
                    {SHAPES[key].label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <ScrollView
            style={styles.previewScroll}
            contentContainerStyle={styles.previewContent}
            showsVerticalScrollIndicator={false}
          >
            <StatCardArt ref={cardRef} shape={shape} stats={stats} />
          </ScrollView>

          <Text style={styles.privacyNote}>
            Only your totals are shown — no usernames are ever included.
          </Text>

          <TouchableOpacity
            activeOpacity={0.85}
            onPress={handleShare}
            disabled={busy}
            style={styles.shareBtnShadow}
          >
            <LinearGradient
              colors={[...Gradients.primaryShort]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.shareBtn}
            >
              {busy ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Ionicons name="share-social" size={18} color="#fff" />
                  <Text style={styles.shareBtnText}>Share image</Text>
                </>
              )}
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// Fixed brand-styled artifact (white on gradient) — intentionally theme-independent.
const cardStyles = StyleSheet.create({
  fill: {
    flex: 1,
    paddingHorizontal: 22,
    paddingVertical: 26,
    alignItems: 'center',
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  brandIcon: {
    width: 30,
    height: 30,
    borderRadius: 9,
    backgroundColor: 'rgba(255,255,255,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  brandName: {
    fontSize: 20,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: -0.3,
  },
  ringWrap: {
    alignItems: 'center',
    marginVertical: 6,
  },
  bandText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
    marginTop: 8,
    opacity: 0.95,
  },
  tileGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    width: '100%',
  },
  tile: {
    width: '50%',
    alignItems: 'center',
    paddingVertical: 8,
  },
  tileValue: {
    fontSize: 22,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: -0.4,
  },
  tileLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.85)',
    marginTop: 1,
  },
  bottom: {
    alignItems: 'center',
  },
  followBackPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    gap: 6,
  },
  followBackText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
  tagline: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 10,
    fontStyle: 'italic',
  },
});

function makeStyles(colors: ColorSet) {
  return StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.6)',
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: Spacing.lg,
    },
    sheet: {
      width: '100%',
      maxWidth: 380,
      maxHeight: '90%',
      backgroundColor: colors.cardBackground,
      borderRadius: 24,
      padding: Spacing.lg,
      ...Shadows.lg,
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: Spacing.md,
    },
    title: {
      fontSize: 18,
      fontWeight: '800',
      color: colors.text,
      letterSpacing: -0.2,
    },
    toggle: {
      flexDirection: 'row',
      backgroundColor: colors.surfaceElevated,
      borderRadius: 12,
      padding: 4,
      marginBottom: Spacing.md,
    },
    segment: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 8,
      borderRadius: 8,
      gap: 6,
    },
    segmentText: {
      fontSize: 13,
      fontWeight: '600',
    },
    previewScroll: {
      alignSelf: 'stretch',
    },
    previewContent: {
      alignItems: 'center',
      paddingVertical: Spacing.sm,
    },
    privacyNote: {
      fontSize: 12,
      color: colors.textSecondary,
      textAlign: 'center',
      marginTop: Spacing.sm,
      marginBottom: Spacing.md,
      lineHeight: 17,
    },
    shareBtnShadow: {
      borderRadius: BorderRadius.lg + 4,
      ...Shadows.md,
    },
    shareBtn: {
      height: 50,
      borderRadius: BorderRadius.lg + 4,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
    },
    shareBtnText: {
      color: '#fff',
      fontSize: 15,
      fontWeight: '700',
      letterSpacing: 0.2,
    },
  });
}
