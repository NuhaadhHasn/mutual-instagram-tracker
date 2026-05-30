import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as StoreReview from 'expo-store-review';
import { instagramParser } from '../../../services/parsers/instagramParser';
import { dataStore } from '../../../services/storage/dataStore';
import { useAppStore } from '../../../shared/store/appStore';
import { FollowerData, HistoricalSnapshot } from '../../../shared/types';
import { useDialog } from '../../../shared/context/DialogContext';
import AnimatedFadeSlide from '../../../shared/components/AnimatedFadeSlide';
import { haptic } from '../../../shared/utils/haptics';
import {
  ColorSet,
  DarkGradients,
  Gradients,
  Shadows,
  Spacing,
} from '../../../shared/constants/theme';
import { useTheme } from '../../../shared/context/ThemeContext';

const CHIPS = ['Privacy First', 'Free', 'No Login'];
const STEPS = [
  'Open Instagram → Settings → Accounts Center',
  'Your Information → Download Your Information',
  'Request Download → choose JSON format',
  'Wait for the email, download the ZIP',
  'Tap "Import Instagram Data" below',
];

export default function ImportScreen({ navigation }: any) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [successData, setSuccessData] = useState<FollowerData | null>(null);
  const setFollowerData = useAppStore((s) => s.setFollowerData);
  const setHistory = useAppStore((s) => s.setHistory);
  const history = useAppStore((s) => s.history);
  const dialog = useDialog();
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const heroGradient = isDark ? DarkGradients.primary : Gradients.primary;
  const buttonGradient = isDark ? DarkGradients.primaryShort : Gradients.primaryShort;

  const handleImportData = async () => {
    try {
      setIsProcessing(true);
      const data = await instagramParser.pickAndParseZip();
      await dataStore.saveFollowerData(data);
      setFollowerData(data);

      const snapshot: HistoricalSnapshot = {
        id: Date.now().toString(),
        date: Date.now(),
        followersCount: data.stats.followersCount,
        followingCount: data.stats.followingCount,
        unfollowersCount: data.stats.unfollowersCount,
        mutualFollows: data.stats.mutualFollows,
        fansCount: data.stats.fansCount,
        followBackRatio: data.stats.followBackRatio,
        // Store the username sets so future imports can diff who joined/left. C5.
        followerUsernames: data.followers.map((u) => u.username),
        followingUsernames: data.following.map((u) => u.username),
      };
      await dataStore.saveSnapshot(snapshot);
      setHistory(await dataStore.getHistory());

      haptic.success();
      setSuccessData(data);

      // Ask for a store rating once the user has gotten value from the app (3rd
      // successful import). Fire-and-forget; the OS heavily throttles this and
      // it's a no-op in Expo Go / unsupported environments. Item 14.
      const importCount = await dataStore.incrementImportCount();
      if (importCount === 3) {
        StoreReview.isAvailableAsync()
          .then((available) => {
            if (available) return StoreReview.requestReview();
          })
          .catch(() => {});
      }
    } catch (error: any) {
      console.error('Import error:', error);
      const msg = error?.message || 'Failed to import Instagram data.';
      if (msg !== 'File selection cancelled') {
        haptic.error();
        dialog.alert({
          title: 'Import failed',
          message: msg,
          icon: 'alert-circle',
          iconColor: colors.error,
        });
      }
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <LinearGradient
        colors={[...heroGradient]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.hero}
      >
        <View style={[styles.heroInner, { paddingTop: insets.top + Spacing.lg }]}>
          <AnimatedFadeSlide index={0} variant="scale">
            <View style={styles.logoCircle}>
              <Ionicons name="infinite" size={40} color="#fff" />
            </View>
          </AnimatedFadeSlide>
          <AnimatedFadeSlide index={1}>
            <Text style={styles.heroTitle}>Mutual</Text>
          </AnimatedFadeSlide>
          <AnimatedFadeSlide index={2}>
            <Text style={styles.heroTagline}>
              See who's really with you — 100% on your device
            </Text>
          </AnimatedFadeSlide>
          <AnimatedFadeSlide index={3}>
            <View style={styles.chipsRow}>
              {CHIPS.map((label) => (
                <View key={label} style={styles.chip}>
                  <Text style={styles.chipText}>{label}</Text>
                </View>
              ))}
            </View>
          </AnimatedFadeSlide>
        </View>
      </LinearGradient>

      <View style={styles.cardWrapper}>
        <ScrollView
          contentContainerStyle={styles.cardContent}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.cardTitle}>How to get your data</Text>
          <Text style={styles.cardSubtitle}>
            Instagram lets you export your follow lists. Follow these steps:
          </Text>

          <View style={styles.steps}>
            {STEPS.map((text, idx) => (
              <AnimatedFadeSlide key={idx} index={4 + idx}>
                <View style={styles.step}>
                  <View style={styles.stepCircle}>
                    <Text style={styles.stepNumber}>{idx + 1}</Text>
                  </View>
                  <Text style={styles.stepText}>{text}</Text>
                </View>
              </AnimatedFadeSlide>
            ))}
          </View>

          <AnimatedFadeSlide index={9} variant="scale">
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => {
              haptic.tap();
              handleImportData();
            }}
            disabled={isProcessing}
            style={styles.importButtonShadow}
          >
            <LinearGradient
              colors={[...buttonGradient]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.importButton}
            >
              {isProcessing ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Ionicons name="cloud-upload-outline" size={22} color="#fff" />
                  <Text style={styles.importButtonText}>Import Instagram Data</Text>
                </>
              )}
            </LinearGradient>
          </TouchableOpacity>
          </AnimatedFadeSlide>

          <Text style={styles.footer}>
            100% Free · Open Source · Privacy First
          </Text>
        </ScrollView>
      </View>

      <SuccessModal
        data={successData}
        previousSnapshot={
          history.length >= 2
            ? [...history].sort((a, b) => a.date - b.date)[history.length - 2]
            : null
        }
        onClose={() => setSuccessData(null)}
        onViewDashboard={() => {
          setSuccessData(null);
          navigation.navigate('Dashboard');
        }}
        colors={colors}
        styles={styles}
        buttonGradient={buttonGradient}
      />
    </View>
  );
}

function SuccessModal({
  data,
  previousSnapshot,
  onClose,
  onViewDashboard,
  colors,
  styles,
  buttonGradient,
}: {
  data: FollowerData | null;
  previousSnapshot: HistoricalSnapshot | null;
  onClose: () => void;
  onViewDashboard: () => void;
  colors: ColorSet;
  styles: ReturnType<typeof makeStyles>;
  buttonGradient: readonly [string, string, ...string[]];
}) {
  if (!data) return null;
  const { stats } = data;

  const cells: {
    icon: keyof typeof Ionicons.glyphMap;
    label: string;
    value: string;
    color: string;
    delta?: number;
    positiveIsGood?: boolean | null;
  }[] = [
    {
      icon: 'people',
      label: 'Followers',
      value: stats.followersCount.toLocaleString(),
      color: colors.info,
      delta: previousSnapshot
        ? stats.followersCount - previousSnapshot.followersCount
        : undefined,
      positiveIsGood: true,
    },
    {
      icon: 'person-add',
      label: 'Following',
      value: stats.followingCount.toLocaleString(),
      color: colors.secondary,
      delta: previousSnapshot
        ? stats.followingCount - previousSnapshot.followingCount
        : undefined,
      positiveIsGood: null,
    },
    {
      icon: 'person-remove',
      label: 'Unfollowers',
      value: stats.unfollowersCount.toLocaleString(),
      color: '#E1306C',
      delta: previousSnapshot
        ? stats.unfollowersCount - previousSnapshot.unfollowersCount
        : undefined,
      positiveIsGood: false,
    },
    {
      icon: 'heart-outline',
      label: 'Fans',
      value: stats.fansCount.toLocaleString(),
      color: '#405DE6',
      delta: previousSnapshot
        ? stats.fansCount - previousSnapshot.fansCount
        : undefined,
      positiveIsGood: true,
    },
    {
      icon: 'heart',
      label: 'Mutual',
      value: stats.mutualFollows.toLocaleString(),
      color: '#4CAF50',
      delta: previousSnapshot
        ? stats.mutualFollows - previousSnapshot.mutualFollows
        : undefined,
      positiveIsGood: true,
    },
    {
      icon: 'pulse',
      label: 'Follow-back',
      value: `${stats.followBackRatio.toFixed(1)}%`,
      color: '#FF9800',
    },
  ];

  return (
    <Modal
      visible={!!data}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.modalBackdrop}>
        <View style={styles.modalCard}>
          <View style={styles.modalCheck}>
            <Ionicons name="checkmark" size={36} color="#fff" />
          </View>
          <Text style={styles.modalTitle}>Import complete</Text>
          <Text style={styles.modalSubtitle}>
            {previousSnapshot
              ? 'Here\'s what changed since your last import.'
              : 'Here\'s your latest follower breakdown.'}
          </Text>

          <View style={styles.modalGrid}>
            {cells.map((c) => (
              <View key={c.label} style={styles.modalCell}>
                <View
                  style={[
                    styles.modalCellIcon,
                    { backgroundColor: c.color + '20' },
                  ]}
                >
                  <Ionicons name={c.icon} size={16} color={c.color} />
                </View>
                <Text style={styles.modalCellValue}>{c.value}</Text>
                <Text style={styles.modalCellLabel}>{c.label}</Text>
                {typeof c.delta === 'number' && c.delta !== 0 && (
                  <Text
                    style={[
                      styles.modalCellDelta,
                      {
                        color:
                          c.positiveIsGood === null
                            ? colors.textSecondary
                            : (c.delta > 0) === c.positiveIsGood
                            ? '#4CAF50'
                            : '#E1306C',
                      },
                    ]}
                  >
                    {c.delta > 0 ? '+' : ''}
                    {c.delta.toLocaleString()}
                  </Text>
                )}
              </View>
            ))}
          </View>

          <TouchableOpacity
            activeOpacity={0.85}
            onPress={onViewDashboard}
            style={styles.modalPrimaryShadow}
          >
            <LinearGradient
              colors={[...buttonGradient]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.modalPrimary}
            >
              <Text style={styles.modalPrimaryText}>View Dashboard</Text>
            </LinearGradient>
          </TouchableOpacity>
          <TouchableOpacity onPress={onClose} style={styles.modalSecondary}>
            <Text style={styles.modalSecondaryText}>Close</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

function makeStyles(colors: ColorSet) {
  return StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: colors.background,
    },
    hero: {
      height: '45%',
      paddingHorizontal: Spacing.lg,
    },
    heroInner: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingBottom: Spacing.xl + Spacing.md,
    },
    logoCircle: {
      width: 72,
      height: 72,
      borderRadius: 36,
      backgroundColor: 'rgba(255,255,255,0.18)',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: Spacing.md,
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.3)',
    },
    heroTitle: {
      fontSize: 26,
      fontWeight: '800',
      color: '#fff',
      letterSpacing: -0.5,
      marginBottom: 6,
    },
    heroTagline: {
      fontSize: 14,
      color: 'rgba(255,255,255,0.85)',
      textAlign: 'center',
      marginBottom: Spacing.md,
      paddingHorizontal: Spacing.sm,
    },
    chipsRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'center',
    },
    chip: {
      paddingHorizontal: 12,
      paddingVertical: 5,
      borderRadius: 20,
      backgroundColor: 'rgba(255,255,255,0.2)',
      marginHorizontal: 4,
      marginVertical: 3,
    },
    chipText: {
      color: '#fff',
      fontSize: 12,
      fontWeight: '600',
    },
    cardWrapper: {
      flex: 1,
      marginTop: -32,
      backgroundColor: colors.background,
      borderTopLeftRadius: 32,
      borderTopRightRadius: 32,
      ...Shadows.lg,
    },
    cardContent: {
      padding: Spacing.lg + Spacing.xs,
      paddingTop: Spacing.xl,
      paddingBottom: Spacing.xl + Spacing.md,
    },
    cardTitle: {
      fontSize: 22,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 6,
    },
    cardSubtitle: {
      fontSize: 14,
      color: colors.textSecondary,
      marginBottom: Spacing.lg,
      lineHeight: 20,
    },
    steps: {
      marginBottom: Spacing.lg,
    },
    step: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      marginBottom: Spacing.md,
    },
    stepCircle: {
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 12,
      marginTop: 1,
    },
    stepNumber: {
      color: '#fff',
      fontWeight: 'bold',
      fontSize: 13,
    },
    stepText: {
      flex: 1,
      fontSize: 15,
      color: colors.text,
      lineHeight: 22,
    },
    importButtonShadow: {
      borderRadius: 28,
      ...Shadows.md,
      marginTop: Spacing.sm,
    },
    importButton: {
      height: 56,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 28,
    },
    importButtonText: {
      color: '#fff',
      fontSize: 16,
      fontWeight: '700',
      marginLeft: Spacing.sm,
      letterSpacing: 0.2,
    },
    footer: {
      fontSize: 12,
      color: colors.textSecondary,
      textAlign: 'center',
      marginTop: Spacing.lg,
      letterSpacing: 0.3,
    },
    modalBackdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.55)',
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: Spacing.lg,
    },
    modalCard: {
      width: '100%',
      maxWidth: 420,
      backgroundColor: colors.cardBackground,
      borderRadius: 24,
      padding: Spacing.lg,
      alignItems: 'center',
      ...Shadows.lg,
    },
    modalCheck: {
      width: 64,
      height: 64,
      borderRadius: 32,
      backgroundColor: '#4CAF50',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: Spacing.sm,
      ...Shadows.md,
    },
    modalTitle: {
      fontSize: 22,
      fontWeight: '800',
      color: colors.text,
      letterSpacing: -0.3,
      marginTop: 6,
    },
    modalSubtitle: {
      fontSize: 13,
      color: colors.textSecondary,
      textAlign: 'center',
      marginTop: 4,
      marginBottom: Spacing.md,
      paddingHorizontal: Spacing.sm,
    },
    modalGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      width: '100%',
      marginBottom: Spacing.md,
    },
    modalCell: {
      width: '33.333%',
      paddingHorizontal: 4,
      paddingVertical: 8,
      alignItems: 'center',
    },
    modalCellIcon: {
      width: 32,
      height: 32,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 6,
    },
    modalCellValue: {
      fontSize: 16,
      fontWeight: '800',
      color: colors.text,
      letterSpacing: -0.2,
    },
    modalCellLabel: {
      fontSize: 11,
      color: colors.textSecondary,
      marginTop: 2,
      fontWeight: '600',
    },
    modalCellDelta: {
      fontSize: 11,
      fontWeight: '700',
      marginTop: 2,
    },
    modalPrimaryShadow: {
      width: '100%',
      borderRadius: 24,
      ...Shadows.md,
    },
    modalPrimary: {
      height: 48,
      borderRadius: 24,
      alignItems: 'center',
      justifyContent: 'center',
    },
    modalPrimaryText: {
      color: '#fff',
      fontSize: 15,
      fontWeight: '700',
      letterSpacing: 0.2,
    },
    modalSecondary: {
      marginTop: 6,
      paddingVertical: 10,
    },
    modalSecondaryText: {
      color: colors.textSecondary,
      fontSize: 13,
      fontWeight: '600',
    },
  });
}
