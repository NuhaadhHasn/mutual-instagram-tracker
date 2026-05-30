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
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppStore } from '../../../shared/store/appStore';
import { useRefreshAppData } from '../../../shared/hooks/useRefreshAppData';
import {
  ColorSet,
  DarkGradients,
  Gradients,
  Shadows,
  Spacing,
} from '../../../shared/constants/theme';
import { useTheme } from '../../../shared/context/ThemeContext';
import UserAvatar from '../../../shared/components/UserAvatar';
import RatioRing from '../../../shared/components/RatioRing';
import { healthScore } from '../../../shared/utils/healthScore';
import { InstagramUser } from '../../../shared/types';
import FreshnessBanner from '../../../shared/components/FreshnessBanner';
import AnimatedFadeSlide from '../../../shared/components/AnimatedFadeSlide';
import StatCardSkeleton from '../../../shared/components/skeletons/StatCardSkeleton';
import UserItemSkeleton from '../../../shared/components/skeletons/UserItemSkeleton';
import { haptic } from '../../../shared/utils/haptics';

export default function DashboardScreen({ navigation }: any) {
  const followerData = useAppStore((s) => s.followerData);
  const isHydrating = useAppStore((s) => s.isHydrating);
  const { refresh, refreshing } = useRefreshAppData();
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const handleNavWithHaptic = (target: string) => {
    haptic.tap();
    navigation.navigate(target);
  };

  const heroGradient = isDark ? DarkGradients.primary : Gradients.primary;
  const shortGradient = isDark ? DarkGradients.primaryShort : Gradients.primaryShort;

  const StatCard = ({
    icon,
    title,
    value,
    color,
    onPress,
  }: {
    icon: any;
    title: string;
    value: number;
    color: string;
    onPress?: () => void;
  }) => {
    const inner = (
      <View style={[styles.statCard, { borderLeftColor: color }]}>
        <View style={[styles.statIconBg, { backgroundColor: color + '15' }]}>
          <Ionicons name={icon} size={22} color={color} />
        </View>
        <Text style={styles.statValue}>{value.toLocaleString()}</Text>
        <Text style={styles.statLabel}>{title}</Text>
      </View>
    );
    return onPress ? (
      <TouchableOpacity activeOpacity={0.85} onPress={onPress}>
        {inner}
      </TouchableOpacity>
    ) : (
      <View>{inner}</View>
    );
  };

  const ActionButton = ({
    icon,
    label,
    onPress,
  }: {
    icon: any;
    label: string;
    onPress: () => void;
  }) => (
    <TouchableOpacity activeOpacity={0.85} onPress={onPress} style={styles.actionCard}>
      <View style={styles.actionIconBg}>
        <Ionicons name={icon} size={20} color={colors.primary} />
      </View>
      <Text style={styles.actionLabel}>{label}</Text>
    </TouchableOpacity>
  );

  if (isHydrating && !followerData) {
    return (
      <View style={styles.root}>
        <LinearGradient
          colors={[...heroGradient]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.headerGradient, { paddingTop: insets.top + Spacing.md }]}
        >
          <Text style={styles.headerTitle}>Dashboard</Text>
          <Text style={styles.headerSubtitle}>Loading your data…</Text>
        </LinearGradient>
        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.contentInner}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.statsGrid}>
            {Array.from({ length: 5 }).map((_, i) => (
              <StatCardSkeleton key={i} />
            ))}
          </View>
          <View style={styles.ratioCard}>
            <View style={styles.ratioHeader}>
              <UserItemSkeleton />
            </View>
          </View>
          {Array.from({ length: 5 }).map((_, i) => (
            <UserItemSkeleton key={`u-${i}`} />
          ))}
        </ScrollView>
      </View>
    );
  }

  if (!followerData) {
    return (
      <View style={[styles.emptyRoot, { paddingTop: insets.top + Spacing.xl }]}>
        <View style={styles.emptyIconWrap}>
          <Ionicons name="cloud-upload-outline" size={48} color={colors.primary} />
        </View>
        <Text style={styles.emptyTitle}>No data yet</Text>
        <Text style={styles.emptySubtitle}>
          Import your Instagram data export to see who doesn't follow you back.
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
  const recent = followerData.unfollowers.slice(0, 5);
  const health = healthScore(stats);
  const healthColor = colors[health.colorKey];

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <LinearGradient
        colors={[...heroGradient]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.headerGradient, { paddingTop: insets.top + Spacing.md }]}
      >
        <Text style={styles.headerTitle}>Dashboard</Text>
        <Text style={styles.headerSubtitle}>
          Last updated · {new Date(followerData.lastUpdated).toLocaleDateString()}
        </Text>
        <Text style={styles.headerHint}>Tap a card to explore</Text>
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
        <FreshnessBanner
          lastUpdated={followerData.lastUpdated}
          onPressImport={() => navigation.navigate('Import')}
        />

        <View style={styles.statsGrid}>
          <AnimatedFadeSlide index={0} variant="scale" style={styles.statCell}>
            <StatCard
              icon="people"
              title="Followers"
              value={stats.followersCount}
              color={colors.info}
              onPress={() => handleNavWithHaptic('Followers')}
            />
          </AnimatedFadeSlide>
          <AnimatedFadeSlide index={1} variant="scale" style={styles.statCell}>
            <StatCard
              icon="person-add"
              title="Following"
              value={stats.followingCount}
              color={colors.secondary}
              onPress={() => handleNavWithHaptic('Following')}
            />
          </AnimatedFadeSlide>
          <AnimatedFadeSlide index={2} variant="scale" style={styles.statCell}>
            <StatCard
              icon="person-remove"
              title="Unfollowers"
              value={stats.unfollowersCount}
              color={colors.error}
              onPress={() => handleNavWithHaptic('Unfollowers')}
            />
          </AnimatedFadeSlide>
          <AnimatedFadeSlide index={3} variant="scale" style={styles.statCell}>
            <StatCard
              icon="heart"
              title="Mutual"
              value={stats.mutualFollows}
              color={colors.success}
              onPress={() => handleNavWithHaptic('Mutual')}
            />
          </AnimatedFadeSlide>
          <AnimatedFadeSlide index={4} variant="scale" style={styles.statCell}>
            <StatCard
              icon="heart-outline"
              title="Fans"
              value={stats.fansCount}
              color={colors.secondary}
              onPress={() => handleNavWithHaptic('Fans')}
            />
          </AnimatedFadeSlide>
        </View>

        <AnimatedFadeSlide index={5} variant="scale">
        <View style={styles.healthCard}>
          <RatioRing
            percentage={health.score}
            size={104}
            stroke={10}
            color={healthColor}
            valueColor={healthColor}
            centerValue={String(health.score)}
          />
          <View style={styles.healthText}>
            <Text style={styles.healthLabel}>Account health</Text>
            <Text style={[styles.healthBand, { color: healthColor }]}>
              {health.band}
            </Text>
            <Text style={styles.healthDescription}>
              Blends follow-back ratio, mutual share, and unfollower load into one score.
            </Text>
          </View>
        </View>
        </AnimatedFadeSlide>

        <AnimatedFadeSlide index={6}>
        <View style={styles.ratioCard}>
          <View style={styles.ratioHeader}>
            <Text style={styles.ratioTitle}>Follow-back ratio</Text>
            <Text style={styles.ratioPercent}>{stats.followBackRatio.toFixed(1)}%</Text>
          </View>
          <View style={styles.ratioBar}>
            <View
              style={[
                styles.ratioFill,
                {
                  width: `${Math.min(100, Math.max(0, stats.followBackRatio))}%`,
                },
              ]}
            />
          </View>
          <Text style={styles.ratioDescription}>
            {stats.mutualFollows} of {stats.followingCount} people you follow follow you back.
          </Text>
        </View>
        </AnimatedFadeSlide>

        <AnimatedFadeSlide index={6}>
          <Text style={styles.sectionTitle}>Quick actions</Text>
        </AnimatedFadeSlide>
        <View style={styles.actionsRow}>
          <AnimatedFadeSlide index={7} style={{ flex: 1 }}>
            <ActionButton
              icon="list"
              label="View Unfollowers"
              onPress={() => handleNavWithHaptic('Unfollowers')}
            />
          </AnimatedFadeSlide>
          <AnimatedFadeSlide index={8} style={{ flex: 1 }}>
            <ActionButton
              icon="refresh"
              label="Update Data"
              onPress={() => handleNavWithHaptic('Import')}
            />
          </AnimatedFadeSlide>
        </View>

        {recent.length > 0 && (
          <View style={styles.recentBlock}>
            <AnimatedFadeSlide index={9}>
              <View style={styles.recentHeader}>
                <Text style={styles.sectionTitle}>Recent unfollowers</Text>
                <TouchableOpacity onPress={() => navigation.navigate('Unfollowers')}>
                  <Text style={styles.viewAll}>View all</Text>
                </TouchableOpacity>
              </View>
            </AnimatedFadeSlide>
            {recent.map((user: InstagramUser, idx: number) => (
              <AnimatedFadeSlide key={`${user.username}-${idx}`} index={10 + idx}>
                <View style={styles.userRow}>
                  <UserAvatar username={user.username} size={40} />
                  <Text style={styles.username} numberOfLines={1} ellipsizeMode="tail">
                    @{user.username}
                  </Text>
                  <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
                </View>
              </AnimatedFadeSlide>
            ))}
          </View>
        )}
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
    headerHint: {
      fontSize: 12,
      color: 'rgba(255,255,255,0.6)',
      marginTop: 2,
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
    statsGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      marginBottom: Spacing.md,
      marginHorizontal: -Spacing.xs,
    },
    statCardTouch: {
      width: '50%',
      padding: Spacing.xs,
    },
    statCell: {
      width: '50%',
      padding: Spacing.xs,
    },
    statCard: {
      backgroundColor: colors.cardBackground,
      borderRadius: 16,
      padding: Spacing.md,
      borderLeftWidth: 4,
      ...Shadows.md,
      minHeight: 110,
    },
    statIconBg: {
      width: 40,
      height: 40,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: Spacing.sm,
    },
    statValue: {
      fontSize: 24,
      fontWeight: '800',
      color: colors.text,
      letterSpacing: -0.3,
    },
    statLabel: {
      fontSize: 13,
      color: colors.textSecondary,
      marginTop: 2,
    },
    healthCard: {
      backgroundColor: colors.cardBackground,
      borderRadius: 16,
      padding: Spacing.md,
      marginTop: Spacing.sm,
      marginBottom: Spacing.sm,
      flexDirection: 'row',
      alignItems: 'center',
      ...Shadows.sm,
    },
    healthText: {
      flex: 1,
      marginLeft: Spacing.md,
    },
    healthLabel: {
      fontSize: 15,
      fontWeight: '700',
      color: colors.text,
    },
    healthBand: {
      fontSize: 20,
      fontWeight: '800',
      letterSpacing: -0.3,
      marginTop: 2,
    },
    healthDescription: {
      fontSize: 12,
      color: colors.textSecondary,
      marginTop: 4,
      lineHeight: 17,
    },
    ratioCard: {
      backgroundColor: colors.cardBackground,
      borderRadius: 16,
      padding: Spacing.md,
      marginTop: Spacing.sm,
      marginBottom: Spacing.lg,
      ...Shadows.sm,
    },
    ratioHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'baseline',
      marginBottom: Spacing.sm,
    },
    ratioTitle: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.text,
    },
    ratioPercent: {
      fontSize: 22,
      fontWeight: '800',
      color: colors.success,
      letterSpacing: -0.3,
    },
    ratioBar: {
      height: 14,
      backgroundColor: colors.surface,
      borderRadius: 7,
      overflow: 'hidden',
      marginBottom: Spacing.sm,
    },
    ratioFill: {
      height: '100%',
      backgroundColor: colors.success,
      borderRadius: 7,
    },
    ratioDescription: {
      fontSize: 13,
      color: colors.textSecondary,
    },
    sectionTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.text,
      marginBottom: Spacing.sm,
    },
    actionsRow: {
      flexDirection: 'row',
      gap: Spacing.sm,
      marginBottom: Spacing.lg,
    },
    actionCard: {
      flex: 1,
      backgroundColor: colors.cardBackground,
      borderRadius: 14,
      padding: Spacing.md,
      flexDirection: 'row',
      alignItems: 'center',
      ...Shadows.sm,
    },
    actionIconBg: {
      width: 34,
      height: 34,
      borderRadius: 10,
      backgroundColor: colors.primary + '15',
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 10,
    },
    actionLabel: {
      flex: 1,
      fontSize: 13,
      fontWeight: '600',
      color: colors.text,
    },
    recentBlock: {
      marginTop: Spacing.xs,
    },
    recentHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: Spacing.sm,
    },
    viewAll: {
      fontSize: 13,
      color: colors.primary,
      fontWeight: '600',
    },
    userRow: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.cardBackground,
      borderRadius: 14,
      padding: Spacing.sm + 2,
      marginBottom: 8,
      ...Shadows.sm,
    },
    username: {
      flex: 1,
      fontSize: 14,
      fontWeight: '600',
      color: colors.text,
      marginLeft: Spacing.md,
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
