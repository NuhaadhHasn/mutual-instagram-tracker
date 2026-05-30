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
import { useRoute, RouteProp } from '@react-navigation/native';

import { useAppStore } from '../../shared/store/appStore';
import { dataStore } from '../../services/storage/dataStore';
import { openInstagramProfile } from '../../services/openInstagramProfile';
import { resolveUsernames } from '../../services/usernamePrivacy';
import { isLikelyBot } from '../../shared/utils/botHeuristic';
import {
  InstagramUser,
  UnfollowedUser,
  WhitelistUser,
} from '../../shared/types';
import {
  ColorSet,
  DarkGradients,
  Gradients,
  Shadows,
  Spacing,
} from '../../shared/constants/theme';
import { useTheme } from '../../shared/context/ThemeContext';
import UserAvatar from '../../shared/components/UserAvatar';
import AnimatedFadeSlide from '../../shared/components/AnimatedFadeSlide';
import UserItemSkeleton from '../../shared/components/skeletons/UserItemSkeleton';
import { useRefreshAppData } from '../../shared/hooks/useRefreshAppData';
import { useMultiSelect } from '../../shared/hooks/useMultiSelect';
import { useDialog } from '../../shared/context/DialogContext';
import { haptic } from '../../shared/utils/haptics';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';

export type UsersListKind =
  | 'followers'
  | 'following'
  | 'mutual'
  | 'fans';

type Params = {
  kind: UsersListKind;
};

type SortKey = 'username' | 'date';
type RecencyFilter = 'all' | '7' | '30';

const CONFIG: Record<
  UsersListKind,
  { title: string; subtitle: string; emoji: string; emptyTitle: string }
> = {
  followers: {
    title: 'Followers',
    subtitle: 'Everyone who follows you',
    emoji: '👥',
    emptyTitle: 'No followers found',
  },
  following: {
    title: 'Following',
    subtitle: 'Everyone you follow',
    emoji: '➡️',
    emptyTitle: 'Not following anyone',
  },
  mutual: {
    title: 'Mutual',
    subtitle: 'People who follow each other',
    emoji: '❤️',
    emptyTitle: 'No mutual follows',
  },
  fans: {
    title: 'Fans',
    subtitle: "People who follow you but you don't follow back",
    emoji: '🤝',
    emptyTitle: 'You follow everyone back!',
  },
};

// Fixed row footprint (userItem minHeight 70 + marginBottom 8). Keep in sync
// with the userItem style + getItemLayout below.
const ITEM_HEIGHT = 78;

type Styles = ReturnType<typeof makeStyles>;

type UserRowProps = {
  user: InstagramUser;
  index: number;
  isSelected: boolean;
  isWhitelisted: boolean;
  isUnfollowed: boolean;
  isBot: boolean;
  selectionActive: boolean;
  onTap: (u: InstagramUser) => void;
  onLong: (u: InstagramUser) => void;
  colors: ColorSet;
  styles: Styles;
};

// Module-scope + memoized so its component identity is stable across parent
// re-renders (was inline → React remounted every row each render). C15e item 1.
const UserRow = React.memo(function UserRow({
  user,
  index,
  isSelected,
  isWhitelisted,
  isUnfollowed,
  isBot,
  selectionActive,
  onTap,
  onLong,
  colors,
  styles,
}: UserRowProps) {
  return (
    // Entrance animation disabled: FlashList recycles cells, so a per-row
    // staggered fade keyed to index re-fires on scroll. C15e-6.
    <AnimatedFadeSlide index={index} disabled>
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={() => onTap(user)}
        onLongPress={() => onLong(user)}
        delayLongPress={350}
        style={[
          styles.userItem,
          isSelected && {
            borderColor: colors.primary,
            borderWidth: 2,
            backgroundColor: colors.primary + '10',
          },
        ]}
      >
        {selectionActive ? (
          <View
            style={[
              styles.checkbox,
              isSelected && { backgroundColor: colors.primary, borderColor: colors.primary },
            ]}
          >
            {isSelected && (
              <Ionicons name="checkmark" size={14} color="#fff" />
            )}
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
        </View>
        {(isWhitelisted || isUnfollowed) && !selectionActive && (
          <View style={styles.badgeRow}>
            {isWhitelisted && (
              <Ionicons
                name="shield-checkmark"
                size={14}
                color="#4CAF50"
                style={{ marginRight: 6 }}
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
    </AnimatedFadeSlide>
  );
});

export default function UsersListScreen({ navigation }: any) {
  const route = useRoute<RouteProp<Record<string, Params>, string>>();
  const kind = route.params.kind;
  const cfg = CONFIG[kind];

  const followerData = useAppStore((s) => s.followerData);
  const whitelist = useAppStore((s) => s.whitelist);
  const unfollowed = useAppStore((s) => s.unfollowed);
  const setWhitelist = useAppStore((s) => s.setWhitelist);
  const setUnfollowed = useAppStore((s) => s.setUnfollowed);
  const isHydrating = useAppStore((s) => s.isHydrating);
  const dialog = useDialog();
  const { refresh, refreshing } = useRefreshAppData();
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortKey>('username');
  const [recency, setRecency] = useState<RecencyFilter>('all');
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const heroGradient = isDark ? DarkGradients.primary : Gradients.primary;
  const multi = useMultiSelect<string>();

  const data = useMemo<InstagramUser[]>(() => {
    if (!followerData) return [];
    switch (kind) {
      case 'followers':
        return followerData.followers;
      case 'following':
        return followerData.following;
      case 'fans':
        return followerData.fans;
      case 'mutual': {
        const followerSet = new Set(
          followerData.followers.map((f) => f.username),
        );
        return followerData.following.filter((f) => followerSet.has(f.username));
      }
    }
  }, [followerData, kind]);

  // Whether this list carries timestamps at all (followers/following do; the
  // derived mutual/fans lists may not) — gate the recency pills on it. C2.
  const hasTimestamps = useMemo(() => data.some((u) => !!u.timestamp), [data]);

  const sorted = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    let filtered = q
      ? data.filter((u) => u.username.toLowerCase().includes(q))
      : data;
    if (recency !== 'all') {
      const windowMs = (recency === '7' ? 7 : 30) * 24 * 60 * 60 * 1000;
      const cutoff = Date.now() - windowMs;
      filtered = filtered.filter(
        (u) => u.timestamp && u.timestamp * 1000 >= cutoff,
      );
    }
    return [...filtered].sort((a, b) => {
      if (sortBy === 'username') return a.username.localeCompare(b.username);
      return (b.timestamp || 0) - (a.timestamp || 0);
    });
  }, [data, searchQuery, sortBy, recency]);

  const whitelistSet = useMemo(
    () => new Set(whitelist.map((w) => w.username)),
    [whitelist],
  );
  const unfollowedSet = useMemo(
    () => new Set(unfollowed.map((u) => u.username)),
    [unfollowed],
  );

  const handleOpenProfile = (user: InstagramUser) => {
    openInstagramProfile(user.username, user.profileUrl);
  };

  const handleLongPress = (user: InstagramUser) => {
    haptic.longPress();
    multi.select(user.username);
  };

  const handleTap = (user: InstagramUser) => {
    if (multi.isActive) {
      multi.toggle(user.username);
      return;
    }
    handleOpenProfile(user);
  };

  const selectedUsers = useMemo(
    () => sorted.filter((u) => multi.has(u.username)),
    [sorted, multi],
  );

  const bulkWhitelist = async () => {
    const list = await dataStore.getWhitelist();
    const existing = new Set(list.map((w) => w.username));
    const toAdd: WhitelistUser[] = selectedUsers
      .filter((u) => !existing.has(u.username))
      .map((u) => ({
        username: u.username,
        profileUrl: u.profileUrl,
        addedAt: Date.now(),
      }));
    if (toAdd.length === 0) {
      dialog.alert({
        title: 'Already whitelisted',
        message: 'Every selected user is already on the whitelist.',
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
    const list = await dataStore.getUnfollowed();
    const existing = new Set(list.map((u) => u.username));
    const toAdd: UnfollowedUser[] = selectedUsers
      .filter((u) => !existing.has(u.username))
      .map((u) => ({
        username: u.username,
        profileUrl: u.profileUrl,
        unfollowedAt: Date.now(),
      }));
    if (toAdd.length === 0) {
      dialog.alert({
        title: 'Already marked',
        message: 'Every selected user is already marked as unfollowed.',
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

  const handleExport = async () => {
    if (data.length === 0) {
      dialog.alert({
        title: 'Nothing to export',
        message: `Your ${cfg.title.toLowerCase()} list is empty.`,
        icon: 'information-circle',
      });
      return;
    }
    const mode = await dialog.actionSheet({
      title: `Export ${cfg.title}`,
      message: 'Choose how usernames are written to the file.',
      options: [
        { label: 'Plain usernames', value: 'plain', icon: 'person-outline' },
        { label: 'Hashed (private)', value: 'hashed', icon: 'lock-closed-outline' },
      ],
    });
    if (!mode) return;
    try {
      const hashed = mode === 'hashed';
      const names = await resolveUsernames(
        data.map((u) => u.username),
        hashed ? 'hashed' : 'plain',
      );
      const escape = (v: string) => `"${(v ?? '').replace(/"/g, '""')}"`;
      const header = 'Username,Profile URL,Followed On\n';
      const rows = data
        .map((u, i) => {
          const date = u.timestamp
            ? new Date(u.timestamp * 1000).toLocaleDateString()
            : '';
          // Hashed mode omits the profile URL — it embeds the plaintext handle.
          const url = hashed ? '' : u.profileUrl;
          return `${escape(names[i])},${escape(url)},${escape(date)}`;
        })
        .join('\n');
      const csv = header + rows;
      const today = new Date().toISOString().split('T')[0];
      const fileName = `mutual-${kind}${hashed ? '-hashed' : ''}_${today}.csv`;
      const fileUri = (FileSystem.documentDirectory ?? '') + fileName;
      await FileSystem.writeAsStringAsync(fileUri, csv, {
        encoding: FileSystem.EncodingType.UTF8,
      });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri, {
          mimeType: 'text/csv',
          dialogTitle: `Export ${cfg.title}`,
          UTI: 'public.comma-separated-values-text',
        });
      } else {
        dialog.alert({
          title: 'Saved',
          message: `File saved to ${fileUri}`,
          icon: 'document-text',
        });
      }
    } catch (err: any) {
      dialog.alert({
        title: 'Export failed',
        message: err?.message || 'Could not export.',
        icon: 'alert-circle',
        iconColor: colors.error,
      });
    }
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
            onPress={() => {
              if (multi.isActive) {
                multi.clear();
                return;
              }
              navigation.goBack();
            }}
            hitSlop={12}
            style={styles.backBtn}
          >
            <Ionicons
              name={multi.isActive ? 'close' : 'chevron-back'}
              size={26}
              color="#fff"
            />
          </TouchableOpacity>
          <View style={styles.titleRow}>
            <Text style={styles.headerTitle}>
              {multi.isActive ? `${multi.count} selected` : cfg.title}
            </Text>
            {!multi.isActive && (
              <View style={styles.countBadge}>
                <Text style={styles.countBadgeText}>{data.length}</Text>
              </View>
            )}
          </View>
          <View style={{ flex: 1 }} />
          {multi.isActive ? (
            <>
              <TouchableOpacity
                onPress={() => multi.selectMany(sorted.map((u) => u.username))}
                hitSlop={10}
                style={[styles.headerBtn, { marginRight: 8 }]}
              >
                <Ionicons name="checkmark-done" size={20} color="#fff" />
              </TouchableOpacity>
            </>
          ) : (
            <>
              <TouchableOpacity
                onPress={handleExport}
                hitSlop={10}
                style={[styles.headerBtn, { marginRight: 8 }]}
              >
                <Ionicons name="share-outline" size={20} color="#fff" />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={refresh}
                hitSlop={10}
                disabled={refreshing}
                style={styles.headerBtn}
              >
                <Ionicons
                  name="refresh"
                  size={20}
                  color={refreshing ? 'rgba(255,255,255,0.5)' : '#fff'}
                />
              </TouchableOpacity>
            </>
          )}
        </View>
        <Text style={styles.headerSubtitle}>{cfg.subtitle}</Text>
        {!multi.isActive && (
          <Text style={styles.hint}>
            Tip: long-press to select multiple
          </Text>
        )}
      </LinearGradient>

      <View style={styles.content}>
        {multi.isActive ? (
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
        ) : (
          <View style={styles.controls}>
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
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={10}>
                  <Ionicons
                    name="close-circle"
                    size={18}
                    color={colors.textSecondary}
                  />
                </TouchableOpacity>
              )}
            </View>
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
        )}

        {!multi.isActive && hasTimestamps && (
          <View style={styles.recencyRow}>
            <SortPill
              label="All"
              active={recency === 'all'}
              onPress={() => setRecency('all')}
            />
            <SortPill
              label="Last 7 days"
              active={recency === '7'}
              onPress={() => setRecency('7')}
            />
            <SortPill
              label="Last 30 days"
              active={recency === '30'}
              onPress={() => setRecency('30')}
            />
          </View>
        )}

        {isHydrating && data.length === 0 ? (
          <View style={{ padding: Spacing.md }}>
            {Array.from({ length: 6 }).map((_, i) => (
              <UserItemSkeleton key={i} />
            ))}
          </View>
        ) : (
          <FlashList
            data={sorted}
            keyExtractor={(item, idx) => `${item.username}-${idx}`}
            renderItem={({ item, index }) => (
              <UserRow
                user={item}
                index={index}
                isSelected={multi.has(item.username)}
                isWhitelisted={whitelistSet.has(item.username)}
                isUnfollowed={unfollowedSet.has(item.username)}
                isBot={isLikelyBot(item.username)}
                selectionActive={multi.isActive}
                onTap={handleTap}
                onLong={handleLongPress}
                colors={colors}
                styles={styles}
              />
            )}
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
                  {searchQuery ? '🔍' : cfg.emoji}
                </Text>
                <Text style={styles.emptyListTitle}>
                  {searchQuery ? 'No matches' : cfg.emptyTitle}
                </Text>
                <Text style={styles.emptyListSubtitle}>
                  {searchQuery ? 'Try a different search term.' : ''}
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
    root: { flex: 1, backgroundColor: colors.surface },
    headerGradient: {
      paddingHorizontal: Spacing.lg,
      paddingBottom: Spacing.xl + Spacing.md,
    },
    headerTopRow: { flexDirection: 'row', alignItems: 'center' },
    backBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: 'rgba(255,255,255,0.15)',
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: Spacing.sm,
    },
    headerBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: 'rgba(255,255,255,0.15)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    titleRow: { flexDirection: 'row', alignItems: 'center' },
    headerTitle: {
      fontSize: 28,
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
    countBadgeText: { color: '#fff', fontWeight: 'bold', fontSize: 13 },
    headerSubtitle: {
      fontSize: 13,
      color: 'rgba(255,255,255,0.85)',
      marginTop: 6,
    },
    hint: {
      fontSize: 11,
      color: 'rgba(255,255,255,0.75)',
      marginTop: 2,
      fontStyle: 'italic',
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
    sortRow: { flexDirection: 'row', marginTop: Spacing.sm + 2 },
    recencyRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      paddingHorizontal: Spacing.md,
      paddingTop: Spacing.sm,
      gap: Spacing.sm,
    },
    sortPill: {
      paddingHorizontal: 14,
      paddingVertical: 6,
      borderRadius: 16,
      backgroundColor: colors.sortPillInactive,
      marginRight: Spacing.sm,
    },
    sortPillActive: { backgroundColor: colors.primary },
    sortPillText: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    sortPillTextActive: { color: '#fff' },
    bulkBar: {
      flexDirection: 'row',
      gap: 10,
      paddingHorizontal: Spacing.lg,
      paddingTop: Spacing.md,
      paddingBottom: Spacing.sm,
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
      borderWidth: 0,
      borderColor: 'transparent',
      // Constant height so getItemLayout (ITEM_HEIGHT=78 incl. 8 margin) stays
      // exact whether the row shows the 46px avatar or the 26px select checkbox.
      minHeight: 70,
      ...Shadows.sm,
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
    userInfo: { flex: 1, marginLeft: Spacing.md },
    username: { fontSize: 15, fontWeight: '700', color: colors.text },
    timestamp: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
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
    openBtn: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: colors.primary + '15',
      alignItems: 'center',
      justifyContent: 'center',
    },
    badgeRow: { flexDirection: 'row', alignItems: 'center', marginRight: 8 },
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
