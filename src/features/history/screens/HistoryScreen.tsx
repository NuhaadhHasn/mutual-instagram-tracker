import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LineChart } from 'react-native-gifted-charts';
import { useAppStore } from '../../../shared/store/appStore';
import {
  ColorSet,
  DarkGradients,
  Gradients,
  Shadows,
  Spacing,
} from '../../../shared/constants/theme';
import { useTheme } from '../../../shared/context/ThemeContext';
import { HistoricalSnapshot } from '../../../shared/types';
import { useRefreshAppData } from '../../../shared/hooks/useRefreshAppData';
import AnimatedFadeSlide from '../../../shared/components/AnimatedFadeSlide';
import ChartCardSkeleton from '../../../shared/components/skeletons/ChartCardSkeleton';
import SnapshotItemSkeleton from '../../../shared/components/skeletons/SnapshotItemSkeleton';

const SCREEN_WIDTH = Dimensions.get('window').width;
const POSITIVE = '#4CAF50';
const NEGATIVE = '#E1306C';

export default function HistoryScreen({ navigation }: any) {
  const history = useAppStore((s) => s.history);
  const isHydrating = useAppStore((s) => s.isHydrating);
  const { refresh, refreshing } = useRefreshAppData();
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const heroGradient = isDark ? DarkGradients.primary : Gradients.primary;

  const ordered = useMemo(() => [...history].sort((a, b) => a.date - b.date), [history]);
  const recent = useMemo(() => ordered.slice(-10), [ordered]);
  const reversed = useMemo(() => [...ordered].reverse(), [ordered]);

  const followerLine = useMemo(
    () =>
      recent.map((s) => ({
        value: s.followersCount,
        label: formatChartLabel(s.date),
      })),
    [recent],
  );

  const unfollowerLine = useMemo(
    () => recent.map((s) => ({ value: s.unfollowersCount })),
    [recent],
  );

  const lineMax = useMemo(() => {
    const fmax = Math.max(...recent.map((s) => s.followersCount), 1);
    return Math.ceil((fmax * 1.15) / 10) * 10;
  }, [recent]);

  const current = ordered[ordered.length - 1];
  const previous = ordered[ordered.length - 2];

  // Follower milestones the user has crossed — shown as badges on the trend
  // card. C6 (lightweight: badges rather than fragile in-chart overlays).
  const MILESTONES = [100, 500, 1000, 5000, 10000, 50000, 100000];
  const reachedMilestones = useMemo(() => {
    const count = current?.followersCount ?? 0;
    return MILESTONES.filter((m) => count >= m);
  }, [current]);

  // Who joined / left between the two most recent imports — only possible when
  // both snapshots carry username sets (imports from C5 onward). C5.
  const followerDiff = useMemo(() => {
    if (!current?.followerUsernames || !previous?.followerUsernames) return null;
    const prev = new Set(previous.followerUsernames);
    const curr = new Set(current.followerUsernames);
    const gained = current.followerUsernames.filter((u) => !prev.has(u));
    const lost = previous.followerUsernames.filter((u) => !curr.has(u));
    return { gained, lost };
  }, [current, previous]);

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <LinearGradient
        colors={[...heroGradient]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.headerGradient, { paddingTop: insets.top + Spacing.md }]}
      >
        <View style={styles.headerRow}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            hitSlop={12}
            style={styles.backBtn}
          >
            <Ionicons name="chevron-back" size={26} color="#fff" />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>History</Text>
            <Text style={styles.headerSubtitle}>
              {history.length} {history.length === 1 ? 'import' : 'imports'} saved
            </Text>
          </View>
        </View>
      </LinearGradient>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentInner}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={refresh}
            tintColor={colors.primary}
          />
        }
      >
        {isHydrating && history.length === 0 && (
          <>
            <ChartCardSkeleton />
            <ChartCardSkeleton height={100} />
            {Array.from({ length: 4 }).map((_, i) => (
              <SnapshotItemSkeleton key={i} />
            ))}
          </>
        )}

        {!isHydrating && history.length === 0 && (
          <View style={styles.infoCard}>
            <Ionicons
              name="time-outline"
              size={32}
              color={colors.primary}
              style={{ marginBottom: Spacing.sm }}
            />
            <Text style={styles.infoTitle}>No imports yet</Text>
            <Text style={styles.infoText}>
              Import your Instagram ZIP from the Import tab to start tracking how
              your follower counts change over time.
            </Text>
          </View>
        )}

        {history.length === 1 && (
          <View style={styles.infoCard}>
            <Ionicons
              name="hourglass-outline"
              size={32}
              color={colors.primary}
              style={{ marginBottom: Spacing.sm }}
            />
            <Text style={styles.infoTitle}>Import again to see trends</Text>
            <Text style={styles.infoText}>
              You have 1 snapshot. Import a fresh ZIP later and we'll show how your
              follower counts changed since this one.
            </Text>
          </View>
        )}

        {history.length >= 2 && (
          <>
            <AnimatedFadeSlide index={0}>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Follower trend</Text>
              <Text style={styles.cardSubtitle}>
                Last {recent.length} {recent.length === 1 ? 'import' : 'imports'}
              </Text>
              <View style={styles.chartWrap}>
                <LineChart
                  data={followerLine}
                  data2={unfollowerLine}
                  width={SCREEN_WIDTH - Spacing.lg * 2 - Spacing.md * 2 - 40}
                  height={180}
                  initialSpacing={10}
                  endSpacing={10}
                  spacing={Math.max(
                    32,
                    (SCREEN_WIDTH - Spacing.lg * 2 - Spacing.md * 2 - 60) /
                      Math.max(recent.length - 1, 1),
                  )}
                  thickness={2}
                  color1={POSITIVE}
                  color2={NEGATIVE}
                  dataPointsColor1={POSITIVE}
                  dataPointsColor2={NEGATIVE}
                  dataPointsRadius={4}
                  curved
                  hideRules
                  xAxisColor={colors.border}
                  yAxisColor={colors.border}
                  yAxisTextStyle={{ color: colors.textSecondary, fontSize: 10 }}
                  xAxisLabelTextStyle={{
                    color: colors.textSecondary,
                    fontSize: 10,
                  }}
                  noOfSections={4}
                  maxValue={lineMax}
                  isAnimated
                  animationDuration={600}
                />
              </View>
              <View style={styles.chartLegend}>
                <LegendDot color={POSITIVE} label="Followers" />
                <LegendDot color={NEGATIVE} label="Unfollowers" />
              </View>
              {reachedMilestones.length > 0 && (
                <View style={styles.milestoneRow}>
                  {reachedMilestones.map((m) => (
                    <View key={m} style={styles.milestoneBadge}>
                      <Ionicons name="trophy" size={12} color={colors.warning} />
                      <Text style={styles.milestoneText}>
                        {m >= 1000 ? `${m / 1000}k` : m}
                      </Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
            </AnimatedFadeSlide>

            {current && previous && (
              <AnimatedFadeSlide index={1}>
                <ComparisonCard
                  current={current}
                  previous={previous}
                  colors={colors}
                  styles={styles}
                />
              </AnimatedFadeSlide>
            )}

            {followerDiff && (
              <AnimatedFadeSlide index={2}>
                <ChangeCard
                  gained={followerDiff.gained}
                  lost={followerDiff.lost}
                  colors={colors}
                  styles={styles}
                />
              </AnimatedFadeSlide>
            )}
          </>
        )}

        {reversed.length > 0 && (
          <View style={styles.listBlock}>
            <AnimatedFadeSlide index={2}>
              <Text style={styles.sectionTitle}>All snapshots</Text>
            </AnimatedFadeSlide>
            {reversed.map((s, idx) => (
              <AnimatedFadeSlide key={s.id} index={3 + idx}>
                <SnapshotItem
                  snapshot={s}
                  isLatest={idx === 0}
                  colors={colors}
                  styles={styles}
                />
              </AnimatedFadeSlide>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const LegendDot = React.memo(function LegendDot({
  color,
  label,
}: {
  color: string;
  label: string;
}) {
  return (
    <View style={legendDotStyles.row}>
      <View style={[legendDotStyles.dot, { backgroundColor: color }]} />
      <Text style={[legendDotStyles.label, { color }]}>{label}</Text>
    </View>
  );
});

const legendDotStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', marginRight: Spacing.lg },
  dot: { width: 10, height: 10, borderRadius: 5, marginRight: 6 },
  label: { fontSize: 12, fontWeight: '600' },
});

const ComparisonCard = React.memo(function ComparisonCard({
  current,
  previous,
  colors,
  styles,
}: {
  current: HistoricalSnapshot;
  previous: HistoricalSnapshot;
  colors: ColorSet;
  styles: ReturnType<typeof makeStyles>;
}) {
  const diff = {
    followers: current.followersCount - previous.followersCount,
    unfollowers: current.unfollowersCount - previous.unfollowersCount,
    following: current.followingCount - previous.followingCount,
  };

  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Since last import</Text>
      <Text style={styles.cardSubtitle}>
        vs {new Date(previous.date).toLocaleDateString()}
      </Text>
      <View style={styles.diffRow}>
        <DiffItem
          label="Followers"
          diff={diff.followers}
          positiveIsGood
          colors={colors}
          styles={styles}
        />
        <DiffItem
          label="Unfollowers"
          diff={diff.unfollowers}
          positiveIsGood={false}
          colors={colors}
          styles={styles}
        />
        <DiffItem
          label="Following"
          diff={diff.following}
          positiveIsGood={null}
          colors={colors}
          styles={styles}
        />
      </View>
    </View>
  );
});

const MAX_CHANGE_NAMES = 30;

const ChangeNames = React.memo(function ChangeNames({
  names,
  colors,
  styles,
}: {
  names: string[];
  colors: ColorSet;
  styles: ReturnType<typeof makeStyles>;
}) {
  const shown = names.slice(0, MAX_CHANGE_NAMES);
  const extra = names.length - shown.length;
  return (
    <View style={styles.chipWrap}>
      {shown.map((u) => (
        <View key={u} style={styles.chip}>
          <Text style={styles.chipText} numberOfLines={1}>
            @{u}
          </Text>
        </View>
      ))}
      {extra > 0 && (
        <Text style={styles.chipMore}>+{extra} more</Text>
      )}
    </View>
  );
});

const ChangeCard = React.memo(function ChangeCard({
  gained,
  lost,
  colors,
  styles,
}: {
  gained: string[];
  lost: string[];
  colors: ColorSet;
  styles: ReturnType<typeof makeStyles>;
}) {
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Who changed</Text>
      <Text style={styles.cardSubtitle}>Followers gained & lost since last import</Text>

      <Text style={[styles.changeHeading, { color: POSITIVE }]}>
        ↑ {gained.length} gained
      </Text>
      {gained.length > 0 ? (
        <ChangeNames names={gained} colors={colors} styles={styles} />
      ) : (
        <Text style={styles.changeEmpty}>No new followers.</Text>
      )}

      <Text style={[styles.changeHeading, { color: NEGATIVE, marginTop: Spacing.md }]}>
        ↓ {lost.length} lost
      </Text>
      {lost.length > 0 ? (
        <ChangeNames names={lost} colors={colors} styles={styles} />
      ) : (
        <Text style={styles.changeEmpty}>No followers lost.</Text>
      )}
    </View>
  );
});

const DiffItem = React.memo(function DiffItem({
  label,
  diff,
  positiveIsGood,
  colors,
  styles,
}: {
  label: string;
  diff: number;
  positiveIsGood: boolean | null;
  colors: ColorSet;
  styles: ReturnType<typeof makeStyles>;
}) {
  const color =
    diff === 0
      ? colors.textSecondary
      : positiveIsGood === null
      ? colors.textSecondary
      : (diff > 0) === positiveIsGood
      ? POSITIVE
      : NEGATIVE;

  return (
    <View style={styles.diffItem}>
      <Text style={[styles.diffValue, { color }]}>
        {diff > 0 ? '+' : ''}
        {diff.toLocaleString()}
      </Text>
      <Text style={styles.diffLabel}>{label}</Text>
    </View>
  );
});

const SnapshotItem = React.memo(function SnapshotItem({
  snapshot,
  isLatest,
  colors,
  styles,
}: {
  snapshot: HistoricalSnapshot;
  isLatest: boolean;
  colors: ColorSet;
  styles: ReturnType<typeof makeStyles>;
}) {
  const d = new Date(snapshot.date);
  return (
    <View style={styles.snapshotItem}>
      <View style={styles.snapshotLeft}>
        <Text style={styles.snapshotDate}>
          {d.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          })}
        </Text>
        <Text style={styles.snapshotTime}>
          {d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
        </Text>
        {isLatest && (
          <View style={styles.latestBadge}>
            <Text style={styles.latestBadgeText}>Latest</Text>
          </View>
        )}
      </View>
      <View style={styles.snapshotStats}>
        <Text style={[styles.snapshotPrimary, { color: POSITIVE }]}>
          {snapshot.followersCount.toLocaleString()} followers
        </Text>
        <Text style={styles.snapshotSecondary}>
          {snapshot.unfollowersCount.toLocaleString()} unfollowers
        </Text>
      </View>
    </View>
  );
});

function formatChartLabel(timestamp: number): string {
  const d = new Date(timestamp);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

function makeStyles(colors: ColorSet) {
  return StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: colors.surface,
    },
    headerGradient: {
      paddingHorizontal: Spacing.lg,
      paddingBottom: Spacing.xl + Spacing.md,
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    backBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: 'rgba(255,255,255,0.15)',
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: Spacing.sm,
    },
    headerTitle: {
      fontSize: 30,
      fontWeight: '800',
      color: '#fff',
      letterSpacing: -0.5,
    },
    headerSubtitle: {
      fontSize: 13,
      color: 'rgba(255,255,255,0.85)',
      marginTop: 4,
    },
    content: {
      flex: 1,
      marginTop: -Spacing.lg,
      backgroundColor: colors.background,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
    },
    contentInner: {
      padding: Spacing.lg,
      paddingBottom: Spacing.xl + Spacing.lg,
    },
    infoCard: {
      backgroundColor: colors.cardBackground,
      borderRadius: 16,
      padding: Spacing.lg,
      alignItems: 'center',
      marginBottom: Spacing.md,
      ...Shadows.md,
    },
    infoTitle: {
      fontSize: 17,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 6,
      textAlign: 'center',
    },
    infoText: {
      fontSize: 13,
      color: colors.textSecondary,
      textAlign: 'center',
      lineHeight: 19,
    },
    card: {
      backgroundColor: colors.cardBackground,
      borderRadius: 16,
      padding: Spacing.md,
      marginBottom: Spacing.md,
      ...Shadows.md,
    },
    cardTitle: {
      fontSize: 15,
      fontWeight: '700',
      color: colors.text,
    },
    cardSubtitle: {
      fontSize: 12,
      color: colors.textSecondary,
      marginTop: 2,
      marginBottom: Spacing.sm,
    },
    changeHeading: {
      fontSize: 14,
      fontWeight: '800',
      marginBottom: Spacing.sm,
    },
    changeEmpty: {
      fontSize: 13,
      color: colors.textSecondary,
    },
    chipWrap: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
    },
    chip: {
      backgroundColor: colors.surface,
      borderRadius: 8,
      paddingHorizontal: 8,
      paddingVertical: 4,
      marginRight: 6,
      marginBottom: 6,
      maxWidth: '100%',
    },
    chipText: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.text,
    },
    chipMore: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.textSecondary,
      marginBottom: 6,
    },
    chartWrap: {
      marginTop: Spacing.sm,
      marginLeft: -Spacing.sm,
    },
    chartLegend: {
      flexDirection: 'row',
      marginTop: Spacing.sm,
      paddingLeft: Spacing.xs,
    },
    milestoneRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      marginTop: Spacing.sm,
      gap: 6,
    },
    milestoneBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.warning + '18',
      borderRadius: 8,
      paddingHorizontal: 8,
      paddingVertical: 3,
    },
    milestoneText: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.warning,
      marginLeft: 4,
    },
    diffRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginTop: Spacing.sm,
    },
    diffItem: {
      flex: 1,
      alignItems: 'center',
    },
    diffValue: {
      fontSize: 22,
      fontWeight: '800',
      letterSpacing: -0.3,
    },
    diffLabel: {
      fontSize: 12,
      color: colors.textSecondary,
      marginTop: 4,
      fontWeight: '600',
    },
    sectionTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.text,
      marginBottom: Spacing.sm,
      marginTop: Spacing.xs,
    },
    listBlock: {
      marginTop: Spacing.xs,
    },
    snapshotItem: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.cardBackground,
      borderRadius: 14,
      padding: 14,
      marginBottom: 8,
      ...Shadows.sm,
    },
    snapshotLeft: {
      flex: 1,
    },
    snapshotDate: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.text,
    },
    snapshotTime: {
      fontSize: 12,
      color: colors.textSecondary,
      marginTop: 2,
    },
    latestBadge: {
      alignSelf: 'flex-start',
      marginTop: 6,
      backgroundColor: colors.primary,
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 8,
    },
    latestBadgeText: {
      color: '#fff',
      fontSize: 10,
      fontWeight: '700',
      letterSpacing: 0.3,
    },
    snapshotStats: {
      alignItems: 'flex-end',
    },
    snapshotPrimary: {
      fontSize: 14,
      fontWeight: '700',
    },
    snapshotSecondary: {
      fontSize: 12,
      color: colors.textSecondary,
      marginTop: 2,
    },
  });
}
