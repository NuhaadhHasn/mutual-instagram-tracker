import React, { useEffect, useMemo, useState } from 'react';
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
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppStore } from '../../../shared/store/appStore';
import { dataStore } from '../../../services/storage/dataStore';
import { openInstagramProfile } from '../../../services/openInstagramProfile';
import { isLikelyBot } from '../../../shared/utils/botHeuristic';
import { ghostScore, GhostBand } from '../../../shared/utils/ghostScore';
import { tagColor } from '../../../shared/constants/tags';
import {
  InstagramUser,
  UnfollowedUser,
  WhitelistUser,
} from '../../../shared/types';
import {
  ColorSet,
  Shadows,
  Spacing,
} from '../../../shared/constants/theme';
import { useTheme } from '../../../shared/context/ThemeContext';
import UserAvatar from '../../../shared/components/UserAvatar';
import FreshnessBanner from '../../../shared/components/FreshnessBanner';
import { useRefreshAppData } from '../../../shared/hooks/useRefreshAppData';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useDialog } from '../../../shared/context/DialogContext';
import AnimatedFadeSlide from '../../../shared/components/AnimatedFadeSlide';
import UserItemSkeleton from '../../../shared/components/skeletons/UserItemSkeleton';
import RecentSearches from '../../../shared/components/RecentSearches';
import { useRecentSearches } from '../../../shared/hooks/useRecentSearches';
import { haptic } from '../../../shared/utils/haptics';
import { useMultiSelect } from '../../../shared/hooks/useMultiSelect';
import { useDragSelect } from '../../../shared/hooks/useDragSelect';
import { useExportUsers } from '../../../shared/hooks/useExportUsers';

type SortKey = 'username' | 'date';

// Fixed row footprint (userItem minHeight 70 + marginBottom 8). Keep in sync
// with the userItem style + getItemLayout below.
const ITEM_HEIGHT = 78;

type Styles = ReturnType<typeof makeStyles>;

type UserItemProps = {
  user: InstagramUser;
  isWhitelisted: boolean;
  isUnfollowed: boolean;
  isBot: boolean;
  // Primitives (not the ghost object) so React.memo stays effective. C1 / C4.
  ghostBand?: GhostBand;
  tag?: string;
  isSelected: boolean;
  selectionActive: boolean;
  onTap: (u: InstagramUser) => void;
  onLong: (u: InstagramUser) => void;
  colors: ColorSet;
  styles: Styles;
};

// Module-scope + memoized so its component identity is stable across parent
// re-renders (was inline → React remounted every row each render). C15e item 1.
const UserItem = React.memo(function UserItem({
  user,
  isWhitelisted,
  isUnfollowed,
  isBot,
  ghostBand,
  tag,
  isSelected,
  selectionActive,
  onTap,
  onLong,
  colors,
  styles,
}: UserItemProps) {
  const ghostColor =
    ghostBand === 'Likely inactive' ? colors.error : colors.warning;
  return (
    <TouchableOpacity
      activeOpacity={0.85}
      style={[
        styles.userItem,
        isSelected && {
          borderColor: colors.primary,
          borderWidth: 2,
          backgroundColor: colors.primary + '10',
        },
      ]}
      onPress={() => onTap(user)}
      onLongPress={() => onLong(user)}
      delayLongPress={350}
    >
      {selectionActive ? (
        <View
          style={[
            styles.checkbox,
            isSelected && {
              backgroundColor: colors.primary,
              borderColor: colors.primary,
            },
          ]}
        >
          {isSelected && <Ionicons name="checkmark" size={14} color="#fff" />}
        </View>
      ) : (
        <UserAvatar username={user.username} size={46} />
      )}
      <View style={styles.userInfo}>
        <Text style={styles.username} numberOfLines={1} ellipsizeMode="tail">
          @{user.username}
        </Text>
        {user.timestamp ? (
          <Text style={styles.timestamp}>
            Followed {new Date(user.timestamp * 1000).toLocaleDateString()}
          </Text>
        ) : null}
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
      {tag && !selectionActive && (
        <View style={[styles.tagChip, { backgroundColor: tagColor(tag) + '1A' }]}>
          <Ionicons name="pricetag" size={10} color={tagColor(tag)} />
          <Text
            style={[styles.tagChipText, { color: tagColor(tag) }]}
            numberOfLines={1}
          >
            {tag}
          </Text>
        </View>
      )}
      {!selectionActive && (isWhitelisted || isUnfollowed) && (
        <View style={styles.whitelistBadge}>
          {isWhitelisted && (
            <Ionicons
              name="shield-checkmark"
              size={14}
              color="#4CAF50"
              style={{ marginRight: isUnfollowed ? 4 : 0 }}
            />
          )}
          {isUnfollowed && (
            <Ionicons name="person-remove" size={14} color="#E1306C" />
          )}
        </View>
      )}
      {!selectionActive && (
        <View style={styles.openBtn}>
          <Ionicons name="arrow-forward" size={16} color={colors.primary} />
        </View>
      )}
    </TouchableOpacity>
  );
});

export default function UnfollowersScreen() {
  const followerData = useAppStore((s) => s.followerData);
  const whitelist = useAppStore((s) => s.whitelist);
  const unfollowed = useAppStore((s) => s.unfollowed);
  const setWhitelist = useAppStore((s) => s.setWhitelist);
  const setUnfollowed = useAppStore((s) => s.setUnfollowed);
  const isHydrating = useAppStore((s) => s.isHydrating);
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const dialog = useDialog();
  const exportUsers = useExportUsers();
  const { record: recordSearch } = useRecentSearches();
  const [searchQuery, setSearchQuery] = useState<string>(
    route.params?.initialQuery ?? '',
  );

  // Unfollowers is a (persistent) tab, so a fresh navigate-with-params won't
  // re-run the useState initializer — apply an incoming global-search query
  // here, then clear the param so re-opening the tab doesn't re-filter. C15c.
  useEffect(() => {
    const q = route.params?.initialQuery;
    if (q != null) {
      setSearchQuery(q);
      navigation.setParams({ initialQuery: undefined });
    }
  }, [route.params?.initialQuery, navigation]);
  const [sortBy, setSortBy] = useState<SortKey>('username');
  const [showWhitelisted, setShowWhitelisted] = useState(false);
  const [showUnfollowed, setShowUnfollowed] = useState(false);
  const { refresh, refreshing } = useRefreshAppData();
  const multi = useMultiSelect<string>();
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const statusBarStyle = isDark ? 'light' : 'dark';

  const goToImport = () => navigation.navigate('Tabs', { screen: 'Import' });

  const whitelistSet = useMemo(
    () => new Set(whitelist.map((w) => w.username)),
    [whitelist],
  );
  // username → tag, for whitelisted users that carry one. C4.
  const whitelistTagMap = useMemo(
    () =>
      new Map(
        whitelist
          .filter((w) => w.category)
          .map((w) => [w.username, w.category as string]),
      ),
    [whitelist],
  );
  const unfollowedSet = useMemo(
    () => new Set(unfollowed.map((u) => u.username)),
    [unfollowed],
  );

  const sortedList = useMemo(() => {
    if (!followerData) return [];
    const q = searchQuery.trim().toLowerCase();
    let filtered = followerData.unfollowers.filter((u) => {
      if (!showWhitelisted && whitelistSet.has(u.username)) return false;
      if (!showUnfollowed && unfollowedSet.has(u.username)) return false;
      return true;
    });
    if (q) {
      filtered = filtered.filter((u) => u.username.toLowerCase().includes(q));
    }
    return [...filtered].sort((a, b) => {
      if (sortBy === 'username') return a.username.localeCompare(b.username);
      return (b.timestamp || 0) - (a.timestamp || 0);
    });
  }, [
    followerData,
    searchQuery,
    sortBy,
    showWhitelisted,
    whitelistSet,
    showUnfollowed,
    unfollowedSet,
  ]);

  const handleOpenProfile = (user: InstagramUser) => {
    openInstagramProfile(user.username, user.profileUrl);
  };

  // Filtered/smart export (C14): scope chooser (incl. "Visible now" = current
  // search + whitelist/unfollowed toggles) + Plain/Hashed, via the shared hook.
  const hasTimestamps = useMemo(
    () => (followerData?.unfollowers ?? []).some((u) => !!u.timestamp),
    [followerData],
  );
  const handleExport = () =>
    exportUsers({
      base: followerData?.unfollowers ?? [],
      visible: sortedList,
      fileBase: 'mutual-unfollowers',
      dialogTitle: 'Export Unfollowers',
      listLabel: 'unfollowers',
      hasTimestamps,
    });

  const handleAddToWhitelist = async (user: InstagramUser) => {
    try {
      const entry: WhitelistUser = {
        username: user.username,
        profileUrl: user.profileUrl,
        addedAt: Date.now(),
      };
      await dataStore.addToWhitelist(entry);
      const updated = await dataStore.getWhitelist();
      setWhitelist(updated);
      dialog.alert({
        title: 'Whitelisted',
        message: `@${user.username} is now hidden from the unfollowers list. You can remove them from Settings.`,
        icon: 'shield-checkmark',
        iconColor: '#4CAF50',
      });
    } catch (err: any) {
      dialog.alert({
        title: 'Could not whitelist',
        message: err?.message || 'Failed to add to whitelist.',
        icon: 'alert-circle',
        iconColor: colors.error,
      });
    }
  };

  const handleAddToUnfollowed = async (user: InstagramUser) => {
    try {
      const entry: UnfollowedUser = {
        username: user.username,
        profileUrl: user.profileUrl,
        unfollowedAt: Date.now(),
      };
      await dataStore.addToUnfollowed(entry);
      setUnfollowed(await dataStore.getUnfollowed());
      dialog.alert({
        title: 'Marked unfollowed',
        message: `@${user.username} marked as unfollowed and hidden from this list.`,
        icon: 'person-remove',
        iconColor: '#E1306C',
      });
    } catch (err: any) {
      dialog.alert({
        title: 'Could not mark',
        message: err?.message || 'Failed to mark unfollowed.',
        icon: 'alert-circle',
        iconColor: colors.error,
      });
    }
  };

  // Gallery-style drag-to-multi-select (C15d). PanResponder-based, no new deps.
  const drag = useDragSelect({
    isActive: multi.isActive,
    selected: multi.selected,
    selectMany: multi.selectMany,
    data: sortedList,
    itemHeight: ITEM_HEIGHT,
    paddingTop: Spacing.md,
  });

  const handleLongPress = (user: InstagramUser) => {
    haptic.longPress();
    multi.select(user.username);
  };

  const bulkWhitelist = async () => {
    const selectedUsernames = Array.from(multi.selected);
    const list = await dataStore.getWhitelist();
    const existing = new Set(list.map((w) => w.username));
    const userMap = new Map(
      (followerData?.unfollowers ?? []).map((u) => [u.username, u]),
    );
    const toAdd: WhitelistUser[] = [];
    for (const name of selectedUsernames) {
      if (existing.has(name)) continue;
      const u = userMap.get(name);
      if (!u) continue;
      toAdd.push({
        username: u.username,
        profileUrl: u.profileUrl,
        addedAt: Date.now(),
      });
    }
    if (toAdd.length === 0) {
      dialog.alert({
        title: 'Nothing to add',
        message: 'Every selected user is already whitelisted.',
        icon: 'information-circle',
      });
      multi.clear();
      return;
    }
    await dataStore.saveWhitelist([...list, ...toAdd]);
    setWhitelist(await dataStore.getWhitelist());
    multi.clear();
    dialog.alert({
      title: 'Whitelisted',
      message: `${toAdd.length} ${toAdd.length === 1 ? 'user' : 'users'} added to whitelist.`,
      icon: 'shield-checkmark',
      iconColor: '#4CAF50',
    });
  };

  const bulkUnfollowed = async () => {
    const selectedUsernames = Array.from(multi.selected);
    const list = await dataStore.getUnfollowed();
    const existing = new Set(list.map((u) => u.username));
    const userMap = new Map(
      (followerData?.unfollowers ?? []).map((u) => [u.username, u]),
    );
    const toAdd: UnfollowedUser[] = [];
    for (const name of selectedUsernames) {
      if (existing.has(name)) continue;
      const u = userMap.get(name);
      if (!u) continue;
      toAdd.push({
        username: u.username,
        profileUrl: u.profileUrl,
        unfollowedAt: Date.now(),
      });
    }
    if (toAdd.length === 0) {
      dialog.alert({
        title: 'Nothing to add',
        message: 'Every selected user is already marked unfollowed.',
        icon: 'information-circle',
      });
      multi.clear();
      return;
    }
    await dataStore.saveUnfollowed([...list, ...toAdd]);
    setUnfollowed(await dataStore.getUnfollowed());
    multi.clear();
    dialog.alert({
      title: 'Marked unfollowed',
      message: `${toAdd.length} ${toAdd.length === 1 ? 'user' : 'users'} marked as unfollowed.`,
      icon: 'person-remove',
      iconColor: '#E1306C',
    });
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

  if (isHydrating && !followerData) {
    return (
      <View style={styles.container}>
        <StatusBar style={statusBarStyle} />
        <View style={[styles.header, { paddingTop: insets.top + Spacing.md }]}>
          <View style={styles.titleRow}>
            <Text style={styles.title}>Unfollowers</Text>
          </View>
          <Text style={styles.subtitle}>Loading…</Text>
        </View>
        <View style={{ padding: Spacing.md }}>
          {Array.from({ length: 6 }).map((_, i) => (
            <UserItemSkeleton key={i} />
          ))}
        </View>
      </View>
    );
  }

  if (!followerData) {
    return (
      <View style={[styles.emptyRoot, { paddingTop: insets.top + Spacing.xl }]}>
        <View style={styles.emptyIconWrap}>
          <Ionicons name="people-outline" size={44} color={colors.primary} />
        </View>
        <Text style={styles.emptyHeroTitle}>No data yet</Text>
        <Text style={styles.emptyHeroSubtitle}>
          Import your Instagram data export from the Import tab to see your unfollowers.
        </Text>
      </View>
    );
  }

  const visibleCount = sortedList.length;
  const hiddenByWhitelist = followerData.unfollowers.filter((u) =>
    whitelistSet.has(u.username),
  ).length;
  const hiddenByUnfollowed = followerData.unfollowers.filter((u) =>
    unfollowedSet.has(u.username),
  ).length;

  const handleTap = (user: InstagramUser) => {
    if (multi.isActive) {
      multi.toggle(user.username);
      return;
    }
    handleOpenProfile(user);
  };

  return (
    <View style={styles.container}>
      <StatusBar style={statusBarStyle} />
      <View style={[styles.header, { paddingTop: insets.top + Spacing.md }]}>
        <View style={styles.titleRow}>
          {multi.isActive ? (
            <TouchableOpacity onPress={multi.clear} hitSlop={10} style={styles.closeBtn}>
              <Ionicons name="close" size={22} color={colors.text} />
            </TouchableOpacity>
          ) : null}
          <Text style={styles.title}>
            {multi.isActive ? `${multi.count} selected` : 'Unfollowers'}
          </Text>
          {!multi.isActive && (
            <View style={styles.countBadge}>
              <Text style={styles.countBadgeText}>{visibleCount}</Text>
            </View>
          )}
          <View style={{ flex: 1 }} />
          {multi.isActive ? (
            <TouchableOpacity
              onPress={() =>
                multi.selectMany(sortedList.map((u) => u.username))
              }
              hitSlop={10}
              style={styles.refreshBtn}
            >
              <Ionicons name="checkmark-done" size={20} color={colors.primary} />
            </TouchableOpacity>
          ) : (
            <>
              <TouchableOpacity
                onPress={handleExport}
                hitSlop={10}
                style={[styles.refreshBtn, { marginRight: 8 }]}
              >
                <Ionicons name="share-outline" size={20} color={colors.primary} />
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
                  color={refreshing ? colors.textSecondary : colors.primary}
                />
              </TouchableOpacity>
            </>
          )}
        </View>
        {!multi.isActive && (
          <Text style={styles.subtitle}>
            People you follow who don't follow back
            {(hiddenByWhitelist > 0 || hiddenByUnfollowed > 0) ? ' ·' : ''}
            {hiddenByWhitelist > 0 && !showWhitelisted
              ? ` ${hiddenByWhitelist} whitelisted`
              : ''}
            {hiddenByUnfollowed > 0 && !showUnfollowed
              ? ` ${hiddenByUnfollowed} unfollowed`
              : ''}
          </Text>
        )}

        {!multi.isActive && (
          <FreshnessBanner
            lastUpdated={followerData.lastUpdated}
            onPressImport={goToImport}
          />
        )}

        {multi.isActive && (
          <View style={styles.bulkBar}>
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={bulkWhitelist}
              style={[styles.bulkBtn, { backgroundColor: '#4CAF5018' }]}
            >
              <Ionicons name="shield-checkmark" size={18} color="#4CAF50" />
              <Text style={[styles.bulkBtnText, { color: '#4CAF50' }]}>
                Whitelist
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={bulkUnfollowed}
              style={[styles.bulkBtn, { backgroundColor: '#E1306C18' }]}
            >
              <Ionicons name="person-remove" size={18} color="#E1306C" />
              <Text style={[styles.bulkBtnText, { color: '#E1306C' }]}>
                Mark unfollowed
              </Text>
            </TouchableOpacity>
          </View>
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
          {hiddenByWhitelist > 0 && !multi.isActive && (
            <SortPill
              label={showWhitelisted ? 'Hide whitelisted' : 'Show whitelisted'}
              active={showWhitelisted}
              onPress={() => setShowWhitelisted((v) => !v)}
            />
          )}
          {hiddenByUnfollowed > 0 && !multi.isActive && (
            <SortPill
              label={showUnfollowed ? 'Hide unfollowed' : 'Show unfollowed'}
              active={showUnfollowed}
              onPress={() => setShowUnfollowed((v) => !v)}
            />
          )}
        </View>

        {!multi.isActive && (
          <Text style={styles.hint}>Tip: long-press to select multiple.</Text>
        )}
      </View>

      <View
        ref={drag.wrapperRef}
        onLayout={drag.onLayout}
        style={{ flex: 1 }}
        {...drag.panHandlers}
      >
      <FlashList
        ref={drag.listRef}
        onScroll={drag.onScroll}
        scrollEventThrottle={16}
        data={sortedList}
        keyExtractor={(item, idx) => `${item.username}-${idx}`}
        renderItem={({ item, index }) => {
          const g = ghostScore(item);
          return (
            <AnimatedFadeSlide index={index} disabled>
              <UserItem
                user={item}
                isWhitelisted={whitelistSet.has(item.username)}
                isUnfollowed={unfollowedSet.has(item.username)}
                isBot={isLikelyBot(item.username)}
                ghostBand={g.isGhost ? g.band : undefined}
                tag={whitelistTagMap.get(item.username)}
                isSelected={multi.has(item.username)}
                selectionActive={multi.isActive}
                onTap={handleTap}
                onLong={handleLongPress}
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
            <Text style={{ fontSize: 56 }}>
              {searchQuery ? '🔍' : '🎉'}
            </Text>
            <Text style={styles.emptyListTitle}>
              {searchQuery ? 'No matches' : "You're all good!"}
            </Text>
            <Text style={styles.emptyListSubtitle}>
              {searchQuery
                ? 'Try a different search term.'
                : 'Everyone you follow follows you back.'}
            </Text>
          </View>
        }
      />
      </View>
    </View>
  );
}

function makeStyles(colors: ColorSet) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.surface,
    },
    header: {
      backgroundColor: colors.cardBackground,
      paddingHorizontal: Spacing.lg,
      paddingBottom: Spacing.md,
      ...Shadows.sm,
    },
    titleRow: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    title: {
      fontSize: 26,
      fontWeight: '800',
      color: colors.text,
      letterSpacing: -0.5,
    },
    countBadge: {
      backgroundColor: colors.primary,
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
    subtitle: {
      fontSize: 13,
      color: colors.textSecondary,
      marginTop: 2,
      marginBottom: Spacing.md,
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
      flexWrap: 'wrap',
      marginTop: Spacing.sm + 2,
    },
    sortPill: {
      paddingHorizontal: 14,
      paddingVertical: 6,
      borderRadius: 16,
      backgroundColor: colors.sortPillInactive,
      marginRight: Spacing.sm,
      marginBottom: 6,
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
    hint: {
      fontSize: 11,
      color: colors.textSecondary,
      marginTop: 2,
      fontStyle: 'italic',
    },
    refreshBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: colors.primary + '12',
      alignItems: 'center',
      justifyContent: 'center',
    },
    closeBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: colors.sortPillInactive,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: Spacing.sm,
    },
    checkbox: {
      width: 26,
      height: 26,
      borderRadius: 13,
      borderWidth: 2,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 10,
    },
    bulkBar: {
      flexDirection: 'row',
      gap: 10,
      marginTop: Spacing.sm,
    },
    bulkBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 12,
      borderRadius: 14,
      gap: 8,
    },
    bulkBtnText: { fontSize: 14, fontWeight: '700' },
    listContent: {
      padding: Spacing.md,
      paddingBottom: Spacing.xl,
    },
    userItem: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.cardBackground,
      borderRadius: 14,
      padding: 12,
      marginBottom: 8,
      // Constant height so getItemLayout (ITEM_HEIGHT=78 incl. 8 margin) stays
      // exact whether the row shows the 46px avatar or the 26px select checkbox.
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
    tagChip: {
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'center',
      maxWidth: 96,
      marginRight: 8,
      paddingHorizontal: 7,
      paddingVertical: 3,
      borderRadius: 8,
    },
    tagChipText: {
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
    whitelistBadge: {
      width: 26,
      height: 26,
      borderRadius: 13,
      backgroundColor: '#4CAF5022',
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 8,
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
    },
    emptyListSubtitle: {
      fontSize: 14,
      color: colors.textSecondary,
      textAlign: 'center',
      marginTop: 6,
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
    emptyHeroTitle: {
      fontSize: 22,
      fontWeight: '700',
      color: colors.text,
      marginBottom: Spacing.sm,
    },
    emptyHeroSubtitle: {
      fontSize: 14,
      color: colors.textSecondary,
      textAlign: 'center',
      lineHeight: 20,
    },
  });
}
