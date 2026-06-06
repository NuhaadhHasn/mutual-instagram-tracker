import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRoute } from '@react-navigation/native';
import { useAppStore } from '../../../shared/store/appStore';
import { openInstagramProfile } from '../../../services/openInstagramProfile';
import { isLikelyBot } from '../../../shared/utils/botHeuristic';
import { ghostScore, GhostBand } from '../../../shared/utils/ghostScore';
import { InstagramUser } from '../../../shared/types';
import {
  ColorSet,
  DarkGradients,
  Gradients,
  Shadows,
  Spacing,
} from '../../../shared/constants/theme';
import { useTheme } from '../../../shared/context/ThemeContext';
import UserAvatar from '../../../shared/components/UserAvatar';
import FreshnessBanner from '../../../shared/components/FreshnessBanner';
import { useRefreshAppData } from '../../../shared/hooks/useRefreshAppData';
import AnimatedFadeSlide from '../../../shared/components/AnimatedFadeSlide';
import UserItemSkeleton from '../../../shared/components/skeletons/UserItemSkeleton';
import RecentSearches from '../../../shared/components/RecentSearches';
import { useRecentSearches } from '../../../shared/hooks/useRecentSearches';
import { useDialog } from '../../../shared/context/DialogContext';
import { useExportUsers } from '../../../shared/hooks/useExportUsers';

type SortKey = 'username' | 'date';

// Fixed row footprint (userItem minHeight 70 + marginBottom 8). Keep in sync
// with the userItem style + getItemLayout below.
const ITEM_HEIGHT = 78;

type Styles = ReturnType<typeof makeStyles>;

// Module-scope + memoized so its component identity is stable across parent
// re-renders (was inline → React remounted every row each render). C15e item 1.
const UserItem = React.memo(function UserItem({
  user,
  isBot,
  ghostBand,
  onPress,
  colors,
  styles,
}: {
  user: InstagramUser;
  isBot: boolean;
  ghostBand?: GhostBand;
  onPress: (u: InstagramUser) => void;
  colors: ColorSet;
  styles: Styles;
}) {
  const ghostColor =
    ghostBand === 'Likely inactive' ? colors.error : colors.warning;
  return (
    <TouchableOpacity
      activeOpacity={0.85}
      style={styles.userItem}
      onPress={() => onPress(user)}
    >
      <UserAvatar username={user.username} size={46} />
      <View style={styles.userInfo}>
        <Text style={styles.username} numberOfLines={1} ellipsizeMode="tail">
          @{user.username}
        </Text>
        {user.timestamp && (
          <Text style={styles.timestamp}>
            Followed you {new Date(user.timestamp * 1000).toLocaleDateString()}
          </Text>
        )}
        {isBot && (
          <View style={styles.botChip}>
            <Ionicons name="alert-circle" size={11} color={colors.warning} />
            <Text style={styles.botChipText}>possible spam</Text>
          </View>
        )}
        {ghostBand && (
          <View style={[styles.ghostChip, { backgroundColor: ghostColor + '1A' }]}>
            <Ionicons name="moon-outline" size={11} color={ghostColor} />
            <Text style={[styles.ghostChipText, { color: ghostColor }]}>
              {ghostBand}
            </Text>
          </View>
        )}
      </View>
      <View style={styles.openBtn}>
        <Ionicons name="arrow-forward" size={16} color={colors.primary} />
      </View>
    </TouchableOpacity>
  );
});

export default function FansScreen({ navigation }: any) {
  const route = useRoute<any>();
  const followerData = useAppStore((s) => s.followerData);
  const isHydrating = useAppStore((s) => s.isHydrating);
  const dialog = useDialog();
  const exportUsers = useExportUsers();
  const { record: recordSearch } = useRecentSearches();
  const [searchQuery, setSearchQuery] = useState<string>(
    route.params?.initialQuery ?? '',
  );
  const [sortBy, setSortBy] = useState<SortKey>('username');
  const { refresh, refreshing } = useRefreshAppData();
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const heroGradient = isDark ? DarkGradients.primary : Gradients.primary;

  const fans = followerData?.fans ?? [];
  const hasTimestamps = useMemo(() => fans.some((u) => !!u.timestamp), [fans]);

  const goToImport = () =>
    navigation.navigate('Tabs', { screen: 'Import' });

  // Filtered/smart export (C14): scope chooser + Plain/Hashed via shared hook.
  const handleExport = () =>
    exportUsers({
      base: fans,
      visible: sortedList,
      fileBase: 'mutual-fans',
      dialogTitle: 'Export Fans',
      listLabel: 'fans',
      hasTimestamps,
    });

  const sortedList = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const filtered = q
      ? fans.filter((u) => u.username.toLowerCase().includes(q))
      : fans;
    return [...filtered].sort((a, b) => {
      if (sortBy === 'username') return a.username.localeCompare(b.username);
      return (b.timestamp || 0) - (a.timestamp || 0);
    });
  }, [fans, searchQuery, sortBy]);

  const handleOpenProfile = (user: InstagramUser) => {
    openInstagramProfile(user.username, user.profileUrl);
  };

  const SortPill = ({
    label,
    active,
    onPress,
  }: {
    label: string;
    active: boolean;
    onPress: () => void;
  }) => (
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


  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <LinearGradient
        colors={[...heroGradient]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.headerGradient, { paddingTop: insets.top + Spacing.md }]}
      >
        <View style={styles.headerTopRow}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            hitSlop={12}
            style={styles.backBtn}
          >
            <Ionicons name="chevron-back" size={26} color="#fff" />
          </TouchableOpacity>
          <View style={styles.titleRow}>
            <Text style={styles.headerTitle}>Fans</Text>
            <View style={styles.countBadge}>
              <Text style={styles.countBadgeText}>{fans.length}</Text>
            </View>
          </View>
          <View style={{ flex: 1 }} />
          <TouchableOpacity
            onPress={handleExport}
            hitSlop={10}
            style={[styles.refreshBtn, { marginRight: 8 }]}
          >
            <Ionicons name="share-outline" size={20} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={refresh}
            hitSlop={10}
            disabled={refreshing}
            style={styles.refreshBtn}
          >
            <Ionicons
              name="refresh"
              size={20}
              color={refreshing ? 'rgba(255,255,255,0.5)' : '#fff'}
            />
          </TouchableOpacity>
        </View>
        <Text style={styles.headerSubtitle}>
          People who follow you but you don't follow back
        </Text>
      </LinearGradient>

      <View style={styles.content}>
        <View style={styles.controls}>
          {followerData && (
            <FreshnessBanner
              lastUpdated={followerData.lastUpdated}
              onPressImport={goToImport}
            />
          )}
          <View style={styles.searchInputContainer}>
            <Ionicons name="search" size={18} color={colors.textSecondary} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search username..."
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholderTextColor={colors.textSecondary}
              autoCorrect={false}
              autoCapitalize="none"
              returnKeyType="search"
              onSubmitEditing={() => recordSearch(searchQuery)}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={10}>
                <Ionicons name="close-circle" size={18} color={colors.textSecondary} />
              </TouchableOpacity>
            )}
          </View>
          {searchQuery.trim().length === 0 && (
            <RecentSearches onPick={(term) => setSearchQuery(term)} />
          )}

          <View style={styles.sortRow}>
            <SortPill
              label="A–Z"
              active={sortBy === 'username'}
              onPress={() => setSortBy('username')}
            />
            <SortPill
              label="Date"
              active={sortBy === 'date'}
              onPress={() => setSortBy('date')}
            />
          </View>
        </View>

        {isHydrating && fans.length === 0 ? (
          <View style={{ padding: Spacing.md }}>
            {Array.from({ length: 6 }).map((_, i) => (
              <UserItemSkeleton key={i} />
            ))}
          </View>
        ) : (
        <FlashList
          data={sortedList}
          keyExtractor={(item, idx) => `${item.username}-${idx}`}
          renderItem={({ item, index }) => {
            const g = ghostScore(item);
            return (
              <AnimatedFadeSlide index={index} disabled>
                <UserItem
                  user={item}
                  isBot={isLikelyBot(item.username)}
                  ghostBand={g.isGhost ? g.band : undefined}
                  onPress={handleOpenProfile}
                  colors={colors}
                  styles={styles}
                />
              </AnimatedFadeSlide>
            );
          }}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={refresh}
              tintColor={colors.primary}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyListContainer}>
              <Text style={{ fontSize: 56 }}>{searchQuery ? '🔍' : '🤝'}</Text>
              <Text style={styles.emptyListTitle}>
                {searchQuery ? 'No matches' : 'You follow everyone back!'}
              </Text>
              <Text style={styles.emptyListSubtitle}>
                {searchQuery
                  ? 'Try a different search term.'
                  : 'No one is following you that you don\'t follow back.'}
              </Text>
            </View>
          }
        />
        )}
      </View>
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
    headerTopRow: {
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
    titleRow: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    refreshBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: 'rgba(255,255,255,0.15)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerTitle: {
      fontSize: 30,
      fontWeight: '800',
      color: '#fff',
      letterSpacing: -0.5,
    },
    countBadge: {
      backgroundColor: 'rgba(255,255,255,0.22)',
      borderRadius: 12,
      paddingHorizontal: 10,
      paddingVertical: 3,
      marginLeft: Spacing.sm,
    },
    countBadgeText: {
      color: '#fff',
      fontWeight: 'bold',
      fontSize: 13,
    },
    headerSubtitle: {
      fontSize: 13,
      color: 'rgba(255,255,255,0.85)',
      marginTop: 6,
    },
    content: {
      flex: 1,
      marginTop: -Spacing.lg,
      backgroundColor: colors.background,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      overflow: 'hidden',
    },
    controls: {
      paddingHorizontal: Spacing.lg,
      paddingTop: Spacing.lg,
      paddingBottom: Spacing.sm,
    },
    searchInputContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.inputBackground,
      borderRadius: 14,
      paddingHorizontal: Spacing.md,
      paddingVertical: 4,
      ...Shadows.sm,
    },
    searchInput: {
      flex: 1,
      fontSize: 15,
      paddingVertical: 8,
      paddingHorizontal: Spacing.sm,
      color: colors.text,
    },
    sortRow: {
      flexDirection: 'row',
      marginTop: Spacing.sm + 2,
    },
    sortPill: {
      paddingHorizontal: 14,
      paddingVertical: 6,
      borderRadius: 16,
      backgroundColor: colors.sortPillInactive,
      marginRight: Spacing.sm,
    },
    sortPillActive: {
      backgroundColor: colors.primary,
    },
    sortPillText: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    sortPillTextActive: {
      color: '#fff',
    },
    listContent: {
      paddingHorizontal: Spacing.md,
      paddingTop: Spacing.sm,
      paddingBottom: Spacing.xl,
    },
    userItem: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.cardBackground,
      borderRadius: 14,
      padding: 12,
      marginBottom: 8,
      // Constant height so getItemLayout (ITEM_HEIGHT=78 incl. 8 margin) is exact.
      minHeight: 70,
      ...Shadows.sm,
    },
    userInfo: {
      flex: 1,
      marginLeft: Spacing.md,
    },
    username: {
      fontSize: 15,
      fontWeight: '700',
      color: colors.text,
    },
    timestamp: {
      fontSize: 12,
      color: colors.textSecondary,
      marginTop: 2,
    },
    botChip: {
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'flex-start',
      marginTop: 4,
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 6,
      backgroundColor: colors.warning + '1A',
    },
    botChipText: {
      fontSize: 10,
      fontWeight: '700',
      color: colors.warning,
      marginLeft: 3,
    },
    ghostChip: {
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'flex-start',
      marginTop: 4,
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 6,
    },
    ghostChipText: {
      fontSize: 10,
      fontWeight: '700',
      marginLeft: 3,
    },
    openBtn: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: colors.primary + '15',
      alignItems: 'center',
      justifyContent: 'center',
    },
    emptyListContainer: {
      alignItems: 'center',
      paddingVertical: Spacing.xl + Spacing.md,
      paddingHorizontal: Spacing.xl,
    },
    emptyListTitle: {
      fontSize: 20,
      fontWeight: '700',
      color: colors.text,
      marginTop: Spacing.md,
      textAlign: 'center',
    },
    emptyListSubtitle: {
      fontSize: 14,
      color: colors.textSecondary,
      textAlign: 'center',
      marginTop: 6,
    },
  });
}
