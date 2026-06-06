import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAppStore } from '../../../shared/store/appStore';
import { openInstagramProfile } from '../../../services/openInstagramProfile';
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
import RecentSearches from '../../../shared/components/RecentSearches';
import { useRecentSearches } from '../../../shared/hooks/useRecentSearches';

// Global cross-list search (C15c): one box, see every list a handle appears in.
type ListLabel =
  | 'Followers'
  | 'Following'
  | 'Mutual'
  | 'Fans'
  | 'Unfollowers'
  | 'Whitelist'
  | 'Unfollowed';

// Distinct color per list so the membership chips read at a glance.
const LABEL_COLOR: Record<ListLabel, string> = {
  Followers: '#405DE6',
  Following: '#833AB4',
  Mutual: '#4CAF50',
  Fans: '#00A5A5',
  Unfollowers: '#E1306C',
  Whitelist: '#2E9E5B',
  Unfollowed: '#FF9800',
};

type SearchResult = { user: InstagramUser; labels: ListLabel[] };

export default function SearchScreen({ navigation }: any) {
  const followerData = useAppStore((s) => s.followerData);
  const whitelist = useAppStore((s) => s.whitelist);
  const unfollowed = useAppStore((s) => s.unfollowed);
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const heroGradient = isDark ? DarkGradients.primary : Gradients.primary;
  const { record } = useRecentSearches();

  const [query, setQuery] = useState('');

  const results = useMemo<SearchResult[]>(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];

    const map = new Map<string, SearchResult>();
    const add = (u: { username: string; profileUrl: string }, label: ListLabel) => {
      if (!u.username.toLowerCase().includes(q)) return;
      const existing = map.get(u.username);
      if (existing) {
        if (!existing.labels.includes(label)) existing.labels.push(label);
      } else {
        map.set(u.username, { user: u as InstagramUser, labels: [label] });
      }
    };

    if (followerData) {
      const { followers, following, fans, unfollowers } = followerData;
      const followerSet = new Set(followers.map((f) => f.username));
      followers.forEach((u) => add(u, 'Followers'));
      following.forEach((u) => add(u, 'Following'));
      following
        .filter((f) => followerSet.has(f.username))
        .forEach((u) => add(u, 'Mutual'));
      fans.forEach((u) => add(u, 'Fans'));
      unfollowers.forEach((u) => add(u, 'Unfollowers'));
    }
    whitelist.forEach((u) => add(u, 'Whitelist'));
    unfollowed.forEach((u) => add(u, 'Unfollowed'));

    return Array.from(map.values()).sort((a, b) =>
      a.user.username.localeCompare(b.user.username),
    );
  }, [query, followerData, whitelist, unfollowed]);

  const goToList = (label: ListLabel, username: string) => {
    switch (label) {
      case 'Followers':
      case 'Following':
      case 'Mutual':
        navigation.navigate(label, { initialQuery: username });
        break;
      case 'Fans':
        navigation.navigate('Fans', { initialQuery: username });
        break;
      case 'Unfollowers':
        navigation.navigate('Tabs', {
          screen: 'Unfollowers',
          params: { initialQuery: username },
        });
        break;
      case 'Whitelist':
      case 'Unfollowed':
        navigation.navigate('Tabs', { screen: 'Settings' });
        break;
    }
  };

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
          <Text style={styles.headerTitle}>Find a user</Text>
        </View>
        <Text style={styles.headerSubtitle}>
          Search every list at once — see who's where.
        </Text>
      </LinearGradient>

      <View style={styles.content}>
        <View style={styles.searchInputContainer}>
          <Ionicons name="search" size={18} color={colors.textSecondary} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search any username..."
            value={query}
            onChangeText={setQuery}
            placeholderTextColor={colors.textSecondary}
            autoCorrect={false}
            autoCapitalize="none"
            autoFocus
            returnKeyType="search"
            onSubmitEditing={() => record(query)}
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => setQuery('')} hitSlop={10}>
              <Ionicons
                name="close-circle"
                size={18}
                color={colors.textSecondary}
              />
            </TouchableOpacity>
          )}
        </View>

        {query.trim().length === 0 && (
          <RecentSearches onPick={(term) => setQuery(term)} />
        )}

        <FlashList
          data={results}
          keyExtractor={(item) => item.user.username}
          renderItem={({ item }) => (
            <View style={styles.resultRow}>
              <TouchableOpacity
                activeOpacity={0.85}
                style={styles.resultMain}
                onPress={() => {
                  record(query);
                  openInstagramProfile(item.user.username, item.user.profileUrl);
                }}
              >
                <UserAvatar username={item.user.username} size={44} />
                <View style={styles.resultInfo}>
                  <Text
                    style={styles.username}
                    numberOfLines={1}
                    ellipsizeMode="tail"
                  >
                    @{item.user.username}
                  </Text>
                  <View style={styles.chipsRow}>
                    {item.labels.map((label) => (
                      <TouchableOpacity
                        key={label}
                        activeOpacity={0.7}
                        onPress={() => goToList(label, item.user.username)}
                        style={[
                          styles.chip,
                          { backgroundColor: LABEL_COLOR[label] + '1A' },
                        ]}
                      >
                        <Text
                          style={[styles.chipText, { color: LABEL_COLOR[label] }]}
                        >
                          {label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
                <View style={styles.openBtn}>
                  <Ionicons name="open-outline" size={16} color={colors.primary} />
                </View>
              </TouchableOpacity>
            </View>
          )}
          contentContainerStyle={styles.listContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={{ fontSize: 56 }}>{query ? '🔍' : '👀'}</Text>
              <Text style={styles.emptyTitle}>
                {query ? 'No matches' : 'Find anyone, fast'}
              </Text>
              <Text style={styles.emptySubtitle}>
                {query
                  ? 'No user matches that across your lists.'
                  : 'Type a username to see which lists they appear in, then tap a tag to jump there.'}
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
    root: { flex: 1, backgroundColor: colors.background },
    headerGradient: {
      paddingHorizontal: Spacing.lg,
      paddingBottom: Spacing.lg,
    },
    headerTopRow: { flexDirection: 'row', alignItems: 'center' },
    backBtn: { marginRight: Spacing.sm },
    headerTitle: {
      fontSize: 22,
      fontWeight: '800',
      color: '#fff',
      letterSpacing: -0.3,
    },
    headerSubtitle: {
      fontSize: 13,
      color: 'rgba(255,255,255,0.85)',
      marginTop: 6,
    },
    content: { flex: 1, paddingHorizontal: Spacing.md, paddingTop: Spacing.md },
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
    listContent: { paddingTop: Spacing.md, paddingBottom: Spacing.xl },
    resultRow: { marginBottom: 8 },
    resultMain: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.cardBackground,
      borderRadius: 14,
      padding: 12,
      ...Shadows.sm,
    },
    resultInfo: { flex: 1, marginLeft: Spacing.md },
    username: { fontSize: 15, fontWeight: '700', color: colors.text },
    chipsRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      marginTop: 5,
      gap: 6,
    },
    chip: {
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 8,
    },
    chipText: { fontSize: 11, fontWeight: '700' },
    openBtn: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: colors.primary + '15',
      alignItems: 'center',
      justifyContent: 'center',
      marginLeft: 8,
    },
    emptyContainer: {
      alignItems: 'center',
      paddingVertical: Spacing.xl + Spacing.md,
      paddingHorizontal: Spacing.xl,
    },
    emptyTitle: {
      fontSize: 20,
      fontWeight: '700',
      color: colors.text,
      marginTop: Spacing.md,
      textAlign: 'center',
    },
    emptySubtitle: {
      fontSize: 14,
      color: colors.textSecondary,
      textAlign: 'center',
      marginTop: 6,
      lineHeight: 20,
    },
  });
}
