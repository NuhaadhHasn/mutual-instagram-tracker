import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { PieChart, BarChart, LineChart } from 'react-native-gifted-charts';
import { useAppStore } from '../../../shared/store/appStore';
import {
  ColorSet,
  DarkGradients,
  Gradients,
  Shadows,
  Spacing,
} from '../../../shared/constants/theme';
import { useTheme } from '../../../shared/context/ThemeContext';
import { AnalyticsStats } from '../../../shared/types';
import { useRefreshAppData } from '../../../shared/hooks/useRefreshAppData';
import AnimatedFadeSlide from '../../../shared/components/AnimatedFadeSlide';
import RatioRing from '../../../shared/components/RatioRing';
import ChartCardSkeleton from '../../../shared/components/skeletons/ChartCardSkeleton';

const SEGMENT_COLORS = {
  mutual: '#4CAF50',
  unfollowers: '#E1306C',
  fans: '#405DE6',
  warning: '#FF9800',
};

type Insight = {
  icon: keyof typeof Ionicons.glyphMap;
  text: string;
  color: string;
  bg: string;
};

function generateInsights(stats: AnalyticsStats): Insight[] {
  const insights: Insight[] = [];

  if (stats.followBackRatio >= 80) {
    insights.push({
      icon: 'star',
      text: `Great engagement! ${stats.followBackRatio.toFixed(0)}% of people follow you back.`,
      color: SEGMENT_COLORS.mutual,
      bg: SEGMENT_COLORS.mutual + '15',
    });
  } else if (stats.followBackRatio < 50) {
    insights.push({
      icon: 'trending-down',
      text: `${stats.unfollowersCount} people don't follow you back. Consider cleaning up your following list.`,
      color: SEGMENT_COLORS.unfollowers,
      bg: SEGMENT_COLORS.unfollowers + '15',
    });
  }

  if (stats.fansCount > 0) {
    insights.push({
      icon: 'heart',
      text: `You have ${stats.fansCount} fans who follow you but you don't follow back.`,
      color: SEGMENT_COLORS.fans,
      bg: SEGMENT_COLORS.fans + '15',
    });
  }

  if (stats.unfollowersCount > stats.followersCount * 0.3) {
    insights.push({
      icon: 'alert-circle',
      text: `Over 30% of people you follow don't follow back. Time to clean house!`,
      color: SEGMENT_COLORS.warning,
      bg: SEGMENT_COLORS.warning + '15',
    });
  }

  if (stats.mutualFollows > 0 && insights.length < 2) {
    insights.push({
      icon: 'people',
      text: `${stats.mutualFollows} mutual connections — people who follow each other.`,
      color: SEGMENT_COLORS.mutual,
      bg: SEGMENT_COLORS.mutual + '15',
    });
  }

  return insights;
}

type Styles = ReturnType<typeof makeStyles>;

// Module-scope + memoized (were inline → new component identity every render →
// React remounted the subtree). styles passed as a prop. C15e item 1.
const InsightCard = React.memo(function InsightCard({
  icon,
  text,
  color,
  bg,
  styles,
}: Insight & { styles: Styles }) {
  return (
    <View
      style={[styles.insightCard, { backgroundColor: bg, borderLeftColor: color }]}
    >
      <Ionicons name={icon} size={22} color={color} />
      <Text style={styles.insightText}>{text}</Text>
    </View>
  );
});

const LegendItem = React.memo(function LegendItem({
  color,
  label,
  count,
  styles,
}: {
  color: string;
  label: string;
  count: number;
  styles: Styles;
}) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendDot, { backgroundColor: color }]} />
      <Text style={styles.legendLabel}>{label}</Text>
      <Text style={styles.legendCount}>{count.toLocaleString()}</Text>
    </View>
  );
});

export default function AnalyticsScreen({ navigation }: any) {
  const followerData = useAppStore((s) => s.followerData);
  const history = useAppStore((s) => s.history);
  const isHydrating = useAppStore((s) => s.isHydrating);
  const { refresh, refreshing } = useRefreshAppData();
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const heroGradient = isDark ? DarkGradients.primary : Gradients.primary;
  const shortGradient = isDark ? DarkGradients.primaryShort : Gradients.primaryShort;

  if (isHydrating && !followerData) {
    return (
      <View style={styles.root}>
        <LinearGradient
          colors={[...heroGradient]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.headerGradient, { paddingTop: insets.top + Spacing.md }]}
        >
          <Text style={styles.headerTitle}>Analytics</Text>
          <Text style={styles.headerSubtitle}>Loading…</Text>
        </LinearGradient>
        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.contentInner}
          showsVerticalScrollIndicator={false}
        >
          {Array.from({ length: 4 }).map((_, i) => (
            <ChartCardSkeleton key={i} />
          ))}
        </ScrollView>
      </View>
    );
  }

  if (!followerData) {
    return (
      <View style={[styles.emptyRoot, { paddingTop: insets.top + Spacing.xl }]}>
        <View style={styles.emptyIconWrap}>
          <Ionicons name="bar-chart-outline" size={48} color={colors.primary} />
        </View>
        <Text style={styles.emptyTitle}>No data yet</Text>
        <Text style={styles.emptySubtitle}>
          Import your Instagram data export to see your follower analytics.
        </Text>
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => navigation.navigate('Import')}
          style={styles.emptyButtonShadow}
        >
          <LinearGradient
            colors={[...shortGradient]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.emptyButton}
          >
            <Text style={styles.emptyButtonText}>Go to Import</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    );
  }

  const { stats } = followerData;
  const insights = useMemo(() => generateInsights(stats), [stats]);

  const breakdownData = useMemo(
    () => [
      { value: Math.max(stats.mutualFollows, 0.0001), color: SEGMENT_COLORS.mutual },
      { value: Math.max(stats.unfollowersCount, 0.0001), color: SEGMENT_COLORS.unfollowers },
      { value: Math.max(stats.fansCount, 0.0001), color: SEGMENT_COLORS.fans },
    ],
    [stats.mutualFollows, stats.unfollowersCount, stats.fansCount]
  );

  const barData = useMemo(
    () =>
      [
        { value: stats.followersCount, label: 'Followers', frontColor: colors.info },
        { value: stats.followingCount, label: 'Following', frontColor: colors.secondary },
        { value: stats.mutualFollows, label: 'Mutual', frontColor: SEGMENT_COLORS.mutual },
        { value: stats.unfollowersCount, label: 'Unfollowers', frontColor: SEGMENT_COLORS.warning },
      ].map((d) => ({
        ...d,
        topLabelComponent: () => (
          <Text style={styles.barTopLabel}>{d.value.toLocaleString()}</Text>
        ),
      })),
    [
      stats.followersCount,
      stats.followingCount,
      stats.mutualFollows,
      stats.unfollowersCount,
      colors.info,
      colors.secondary,
      styles.barTopLabel,
    ]
  );

  const barMax = useMemo(
    () => Math.max(...barData.map((d) => d.value), 1),
    [barData]
  );

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <LinearGradient
        colors={[...heroGradient]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.headerGradient, { paddingTop: insets.top + Spacing.md }]}
      >
        <Text style={styles.headerTitle}>Analytics</Text>
        <Text style={styles.headerSubtitle}>
          Visual insights from your follower data
        </Text>
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
        <AnimatedFadeSlide index={0}>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Follower breakdown</Text>
          <View style={styles.donutWrap}>
            <PieChart
              data={breakdownData}
              donut
              radius={90}
              innerRadius={60}
              innerCircleColor={colors.cardBackground}
              centerLabelComponent={() => (
                <View style={{ alignItems: 'center' }}>
                  <Text style={styles.donutCenterValue}>
                    {stats.followersCount.toLocaleString()}
                  </Text>
                  <Text style={styles.donutCenterLabel}>Followers</Text>
                </View>
              )}
            />
          </View>
          <View style={styles.legendCol}>
            <LegendItem
              color={SEGMENT_COLORS.mutual}
              label="Mutual"
              count={stats.mutualFollows}
              styles={styles}
            />
            <LegendItem
              color={SEGMENT_COLORS.unfollowers}
              label="Unfollowers"
              count={stats.unfollowersCount}
              styles={styles}
            />
            <LegendItem
              color={SEGMENT_COLORS.fans}
              label="Fans"
              count={stats.fansCount}
              styles={styles}
            />
          </View>
        </View>
        </AnimatedFadeSlide>

        <AnimatedFadeSlide index={1}>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Follow-back ratio</Text>
          <View style={styles.ringWrap}>
            <RatioRing percentage={stats.followBackRatio} centerLabel="follow back" />
          </View>
          <Text style={styles.ringDescription}>
            {stats.mutualFollows} of {stats.followingCount} people you follow follow
            you back.
          </Text>
        </View>
        </AnimatedFadeSlide>

        <AnimatedFadeSlide index={2}>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Counts compared</Text>
          <View style={styles.barWrap}>
            <BarChart
              data={barData}
              barWidth={32}
              spacing={18}
              roundedTop
              xAxisThickness={0}
              yAxisThickness={0}
              yAxisTextStyle={{ color: colors.textSecondary, fontSize: 11 }}
              xAxisLabelTextStyle={{
                color: colors.textSecondary,
                fontSize: 11,
              }}
              noOfSections={4}
              maxValue={Math.ceil(barMax * 1.15)}
              isAnimated
              animationDuration={600}
            />
          </View>
        </View>
        </AnimatedFadeSlide>

        {insights.length > 0 && (
          <AnimatedFadeSlide index={3}>
          <View style={styles.insightsBlock}>
            <Text style={styles.sectionTitle}>Insights</Text>
            {insights.map((it, idx) => (
              <InsightCard key={idx} {...it} styles={styles} />
            ))}
          </View>
          </AnimatedFadeSlide>
        )}

        <AnimatedFadeSlide index={4}>
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => navigation.navigate('History')}
          style={styles.trendCard}
        >
          <View style={styles.trendHeader}>
            <View style={styles.trendIconWrap}>
              <Ionicons name="time-outline" size={20} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>Trend</Text>
              {history.length >= 2 ? (
                <Text style={styles.trendDelta}>
                  {(() => {
                    const sorted = [...history].sort((a, b) => a.date - b.date);
                    const last = sorted[sorted.length - 1];
                    const prev = sorted[sorted.length - 2];
                    const d = last.followersCount - prev.followersCount;
                    return `${d > 0 ? '+' : ''}${d.toLocaleString()} followers since last import`;
                  })()}
                </Text>
              ) : (
                <Text style={styles.trendDelta}>
                  Import again to see history
                </Text>
              )}
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
          </View>

          {history.length >= 2 && (
            <View style={styles.sparkWrap}>
              <LineChart
                data={[...history]
                  .sort((a, b) => a.date - b.date)
                  .slice(-6)
                  .map((s) => ({ value: s.followersCount }))}
                height={70}
                width={260}
                initialSpacing={6}
                endSpacing={6}
                spacing={42}
                color1={colors.primary}
                thickness={2}
                hideAxesAndRules
                hideYAxisText
                hideDataPoints
                curved
                disableScroll
                isAnimated
                animationDuration={600}
              />
            </View>
          )}
        </TouchableOpacity>
        </AnimatedFadeSlide>
      </ScrollView>
    </View>
  );
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
      marginBottom: Spacing.sm,
    },
    donutWrap: {
      alignItems: 'center',
      justifyContent: 'center',
      marginVertical: Spacing.sm,
    },
    donutCenterValue: {
      fontSize: 22,
      fontWeight: '800',
      color: colors.text,
      letterSpacing: -0.3,
    },
    donutCenterLabel: {
      fontSize: 12,
      color: colors.textSecondary,
      marginTop: 2,
    },
    legendCol: {
      marginTop: Spacing.sm,
    },
    legendItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 6,
    },
    legendDot: {
      width: 10,
      height: 10,
      borderRadius: 5,
      marginRight: 10,
    },
    legendLabel: {
      flex: 1,
      fontSize: 13,
      color: colors.text,
      fontWeight: '600',
    },
    legendCount: {
      fontSize: 13,
      color: colors.textSecondary,
      fontWeight: '600',
    },
    ringWrap: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: Spacing.sm,
    },
    ringCenter: {
      position: 'absolute',
      alignItems: 'center',
      justifyContent: 'center',
    },
    ringPercent: {
      fontSize: 30,
      fontWeight: '800',
      color: colors.primary,
      letterSpacing: -0.5,
    },
    ringLabel: {
      fontSize: 12,
      color: colors.textSecondary,
      marginTop: 2,
    },
    ringDescription: {
      fontSize: 13,
      color: colors.textSecondary,
      textAlign: 'center',
      marginTop: Spacing.sm,
    },
    barWrap: {
      paddingTop: Spacing.md,
      paddingRight: Spacing.sm,
    },
    barTopLabel: {
      color: colors.textSecondary,
      fontSize: 10,
      fontWeight: '600',
      marginBottom: 2,
    },
    sectionTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.text,
      marginBottom: Spacing.sm,
    },
    insightsBlock: {
      marginTop: Spacing.xs,
    },
    trendCard: {
      backgroundColor: colors.cardBackground,
      borderRadius: 16,
      padding: Spacing.md,
      marginTop: Spacing.md,
      ...Shadows.md,
    },
    trendHeader: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    trendIconWrap: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: colors.primary + '15',
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: Spacing.sm + 2,
    },
    trendDelta: {
      fontSize: 12,
      color: colors.textSecondary,
      marginTop: 2,
    },
    sparkWrap: {
      marginTop: Spacing.sm,
      marginLeft: -Spacing.xs,
      alignItems: 'center',
    },
    insightCard: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 14,
      borderRadius: 12,
      borderLeftWidth: 3,
      marginBottom: 8,
      gap: 12,
    },
    insightText: {
      flex: 1,
      fontSize: 13,
      lineHeight: 18,
      color: colors.text,
    },
    emptyRoot: {
      flex: 1,
      alignItems: 'center',
      backgroundColor: colors.background,
      paddingHorizontal: Spacing.xl,
    },
    emptyIconWrap: {
      width: 96,
      height: 96,
      borderRadius: 48,
      backgroundColor: colors.primary + '15',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: Spacing.lg,
      marginTop: Spacing.xl,
    },
    emptyTitle: {
      fontSize: 22,
      fontWeight: '700',
      color: colors.text,
      marginBottom: Spacing.sm,
    },
    emptySubtitle: {
      fontSize: 14,
      color: colors.textSecondary,
      textAlign: 'center',
      lineHeight: 20,
      marginBottom: Spacing.lg,
    },
    emptyButtonShadow: {
      borderRadius: 28,
      ...Shadows.md,
    },
    emptyButton: {
      height: 52,
      paddingHorizontal: Spacing.xl,
      borderRadius: 28,
      alignItems: 'center',
      justifyContent: 'center',
    },
    emptyButtonText: {
      color: '#fff',
      fontSize: 15,
      fontWeight: '700',
    },
  });
}
