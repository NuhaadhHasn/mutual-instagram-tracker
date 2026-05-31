import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Linking,
  RefreshControl,
  Share,
  Switch,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { dataStore } from '../../../services/storage/dataStore';
import { backupService, BackupPayload } from '../../../services/storage/backupService';
import {
  EncryptedEnvelope,
  PassphraseRequiredError,
  WrongPassphraseError,
} from '../../../services/storage/backupCrypto';
import { resolveUsernames } from '../../../services/usernamePrivacy';
import { useAppStore } from '../../../shared/store/appStore';
import { useMultiSelect } from '../../../shared/hooks/useMultiSelect';
import UserAvatar from '../../../shared/components/UserAvatar';
import { useDialog } from '../../../shared/context/DialogContext';
import { useRefreshAppData } from '../../../shared/hooks/useRefreshAppData';
import AnimatedFadeSlide from '../../../shared/components/AnimatedFadeSlide';
import SkeletonBox from '../../../shared/components/SkeletonBox';
import { haptic } from '../../../shared/utils/haptics';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as LocalAuthentication from 'expo-local-authentication';
import {
  BorderRadius,
  ColorSet,
  DarkGradients,
  Gradients,
  Shadows,
  Spacing,
} from '../../../shared/constants/theme';
import { useTheme, ThemeMode } from '../../../shared/context/ThemeContext';

export default function SettingsScreen({ navigation }: any) {
  const followerData = useAppStore((s) => s.followerData);
  const history = useAppStore((s) => s.history);
  const whitelist = useAppStore((s) => s.whitelist);
  const unfollowed = useAppStore((s) => s.unfollowed);
  const setFollowerData = useAppStore((s) => s.setFollowerData);
  const setHistory = useAppStore((s) => s.setHistory);
  const setWhitelist = useAppStore((s) => s.setWhitelist);
  const setUnfollowed = useAppStore((s) => s.setUnfollowed);
  const reset = useAppStore((s) => s.reset);
  const blockScreenshots = useAppStore((s) => s.blockScreenshots);
  const setBlockScreenshots = useAppStore((s) => s.setBlockScreenshots);
  const appLock = useAppStore((s) => s.appLock);
  const setAppLock = useAppStore((s) => s.setAppLock);
  const isHydrating = useAppStore((s) => s.isHydrating);
  const dialog = useDialog();
  const { refresh, refreshing } = useRefreshAppData();
  const insets = useSafeAreaInsets();
  const { colors, isDark, mode, setMode } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const hasData = !!followerData;
  const heroGradient = isDark ? DarkGradients.primary : Gradients.primary;

  // Search inside the Whitelist / Unfollowed sections (shown only once a list
  // grows past ~10 entries, so short lists stay clean). C15a.
  const SEARCH_THRESHOLD = 10;
  const [whitelistQuery, setWhitelistQuery] = useState('');
  const [unfollowedQuery, setUnfollowedQuery] = useState('');
  // null = idle; otherwise the busy label shown in the crypto overlay.
  const [backupBusy, setBackupBusy] = useState<string | null>(null);

  const filteredWhitelist = useMemo(() => {
    const q = whitelistQuery.trim().toLowerCase();
    return q
      ? whitelist.filter((u) => u.username.toLowerCase().includes(q))
      : whitelist;
  }, [whitelist, whitelistQuery]);

  const filteredUnfollowed = useMemo(() => {
    const q = unfollowedQuery.trim().toLowerCase();
    return q
      ? unfollowed.filter((u) => u.username.toLowerCase().includes(q))
      : unfollowed;
  }, [unfollowed, unfollowedQuery]);

  // Long-press multi-select + bulk remove inside each Settings section. C15b.
  const wlMulti = useMultiSelect<string>();
  const ufMulti = useMultiSelect<string>();

  const bulkRemoveWhitelist = async () => {
    const names = Array.from(wlMulti.selected);
    if (names.length === 0) return;
    const ok = await dialog.confirm({
      title: `Remove ${names.length} from whitelist?`,
      message: 'They will reappear in your lists. This does not affect Instagram.',
      confirmLabel: 'Remove',
      destructive: true,
      icon: 'close-circle',
    });
    if (!ok) return;
    haptic.destructive();
    setWhitelist(await dataStore.removeManyFromWhitelist(names));
    wlMulti.clear();
  };

  const bulkRemoveUnfollowed = async () => {
    const names = Array.from(ufMulti.selected);
    if (names.length === 0) return;
    const ok = await dialog.confirm({
      title: `Remove ${names.length} from unfollowed?`,
      message: 'They will reappear in your unfollowers list. This does not affect Instagram.',
      confirmLabel: 'Remove',
      destructive: true,
      icon: 'close-circle',
    });
    if (!ok) return;
    haptic.destructive();
    setUnfollowed(await dataStore.removeManyFromUnfollowed(names));
    ufMulti.clear();
  };

  const handleClearData = async () => {
    const ok = await dialog.confirm({
      title: 'Clear all data?',
      message:
        'This removes your imported follower data, history, and whitelist. This cannot be undone.',
      confirmLabel: 'Clear all',
      destructive: true,
      icon: 'trash-outline',
    });
    if (!ok) return;
    haptic.destructive();
    await dataStore.clearAll();
    reset();
    navigation.navigate('Import');
  };

  const handleClearHistory = async () => {
    const ok = await dialog.confirm({
      title: 'Clear history?',
      message:
        'Delete all historical import snapshots. Your current follower data stays.',
      confirmLabel: 'Clear',
      destructive: true,
      icon: 'time-outline',
    });
    if (!ok) return;
    haptic.destructive();
    await dataStore.clearHistory();
    setHistory([]);
  };

  const handleExportFullReport = async () => {
    if (!followerData) {
      dialog.alert({
        title: 'Nothing to export',
        message: 'Import data first.',
        icon: 'information-circle',
      });
      return;
    }
    const mode = await dialog.actionSheet({
      title: 'Export full report',
      message: 'Choose how usernames are written to the file.',
      options: [
        { label: 'Plain usernames', value: 'plain', icon: 'person-outline' },
        { label: 'Hashed (private)', value: 'hashed', icon: 'lock-closed-outline' },
      ],
    });
    if (!mode) return;
    try {
      const hashed = mode === 'hashed';
      // Pre-hash every username across all lists so fmt() can stay synchronous.
      const hashMap = new Map<string, string>();
      if (hashed) {
        const all = [
          ...followerData.followers,
          ...followerData.following,
          ...followerData.unfollowers,
          ...followerData.fans,
        ];
        const uniqueNames = Array.from(new Set(all.map((u) => u.username)));
        const hashes = await resolveUsernames(uniqueNames, 'hashed');
        uniqueNames.forEach((name, i) => hashMap.set(name, hashes[i]));
      }

      const escape = (v: string) => `"${(v ?? '').replace(/"/g, '""')}"`;
      const fmt = (u: { username: string; profileUrl: string; timestamp?: number }) => {
        const date = u.timestamp
          ? new Date(u.timestamp * 1000).toLocaleDateString()
          : '';
        // Hashed mode omits the profile URL — it embeds the plaintext handle.
        const name = hashed ? hashMap.get(u.username) ?? u.username : u.username;
        const url = hashed ? '' : u.profileUrl;
        return `${escape(name)},${escape(url)},${escape(date)}`;
      };

      const s = followerData.stats;
      const lines: string[] = [];
      lines.push('# Mutual — Full Report');
      lines.push(`# Generated: ${new Date().toISOString()}`);
      lines.push('');
      lines.push('Metric,Value');
      lines.push(`Followers,${s.followersCount}`);
      lines.push(`Following,${s.followingCount}`);
      lines.push(`Mutual,${s.mutualFollows}`);
      lines.push(`Unfollowers,${s.unfollowersCount}`);
      lines.push(`Fans,${s.fansCount}`);
      lines.push(`Follow-back ratio,${s.followBackRatio.toFixed(1)}%`);
      lines.push('');

      lines.push('## Unfollowers');
      lines.push('Username,Profile URL,Followed On');
      followerData.unfollowers.forEach((u) => lines.push(fmt(u)));
      lines.push('');

      lines.push('## Fans');
      lines.push('Username,Profile URL,Followed On');
      followerData.fans.forEach((u) => lines.push(fmt(u)));
      lines.push('');

      lines.push('## All followers');
      lines.push('Username,Profile URL,Followed On');
      followerData.followers.forEach((u) => lines.push(fmt(u)));
      lines.push('');

      lines.push('## All following');
      lines.push('Username,Profile URL,Followed On');
      followerData.following.forEach((u) => lines.push(fmt(u)));

      const csv = lines.join('\n');
      const today = new Date().toISOString().split('T')[0];
      const fileName = `mutual-full-report${hashed ? '-hashed' : ''}_${today}.csv`;
      const fileUri = (FileSystem.documentDirectory ?? '') + fileName;
      await FileSystem.writeAsStringAsync(fileUri, csv, {
        encoding: FileSystem.EncodingType.UTF8,
      });
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(fileUri, {
          mimeType: 'text/csv',
          dialogTitle: 'Export Mutual report',
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
        message: err?.message || 'Could not export report.',
        icon: 'alert-circle',
        iconColor: colors.error,
      });
    }
  };

  const handleExportBackup = async () => {
    if (backupBusy) return;

    const choice = await dialog.actionSheet({
      title: 'Export backup',
      message: 'Save your data, whitelist, and history to a file.',
      options: [
        {
          label: 'Encrypt with passphrase',
          value: 'encrypt',
          icon: 'lock-closed-outline',
        },
        { label: 'Plain (unencrypted) file', value: 'plain', icon: 'document-outline' },
      ],
    });
    if (choice === null) return;

    let passphrase: string | undefined;
    if (choice === 'encrypt') {
      const p1 = await dialog.prompt({
        title: 'Set a passphrase',
        message: 'You will need this exact passphrase to restore the backup.',
        placeholder: 'Passphrase',
        confirmLabel: 'Next',
        secureTextEntry: true,
        icon: 'key-outline',
      });
      if (p1 === null) return;
      if (p1.length === 0) {
        dialog.alert({
          title: 'Passphrase required',
          message: 'An empty passphrase is not allowed.',
          icon: 'alert-circle',
          iconColor: colors.warning,
        });
        return;
      }
      const p2 = await dialog.prompt({
        title: 'Confirm passphrase',
        message: 'Type it again to avoid a typo locking you out.',
        placeholder: 'Re-enter passphrase',
        confirmLabel: 'Encrypt & export',
        secureTextEntry: true,
        icon: 'key-outline',
      });
      if (p2 === null) return;
      if (p1 !== p2) {
        dialog.alert({
          title: 'Passphrases don’t match',
          message: 'Please try again.',
          icon: 'alert-circle',
          iconColor: colors.error,
        });
        return;
      }
      passphrase = p1;
    }

    if (passphrase) setBackupBusy('Encrypting…');
    try {
      await backupService.exportToFile(passphrase);
    } catch (err: any) {
      dialog.alert({
        title: 'Backup failed',
        message: err?.message || 'Could not export backup.',
        icon: 'alert-circle',
        iconColor: colors.error,
      });
    } finally {
      setBackupBusy(null);
    }
  };

  const applyRestoredPayload = (payload: BackupPayload) => {
    setFollowerData(payload.followerData ?? null);
    setWhitelist(payload.whitelist);
    setUnfollowed(payload.unfollowed);
    setHistory(payload.history);
    dialog.alert({
      title: 'Backup restored',
      message: 'Your data, whitelist, and history have been restored.',
      icon: 'checkmark-circle',
      iconColor: '#4CAF50',
    });
  };

  const promptAndDecrypt = async (envelope: EncryptedEnvelope) => {
    for (let attempt = 0; attempt < 3; attempt++) {
      const pass = await dialog.prompt({
        title: 'Enter passphrase',
        message:
          attempt === 0 ? 'This backup is encrypted.' : 'Wrong passphrase. Try again.',
        placeholder: 'Passphrase',
        confirmLabel: 'Decrypt',
        secureTextEntry: true,
        icon: 'key-outline',
      });
      if (pass === null) return;
      if (pass.length === 0) continue;

      setBackupBusy('Decrypting…');
      try {
        const payload = await backupService.restoreFromEnvelope(envelope, pass);
        applyRestoredPayload(payload);
        return;
      } catch (e: any) {
        if (e instanceof WrongPassphraseError) {
          continue;
        }
        dialog.alert({
          title: 'Restore failed',
          message: e?.message || 'Could not restore backup.',
          icon: 'alert-circle',
          iconColor: colors.error,
        });
        return;
      } finally {
        setBackupBusy(null);
      }
    }
    dialog.alert({
      title: 'Restore failed',
      message: 'Wrong passphrase or corrupted file.',
      icon: 'alert-circle',
      iconColor: colors.error,
    });
  };

  const handleRestoreBackup = async () => {
    if (backupBusy) return;

    const ok = await dialog.confirm({
      title: 'Restore from backup?',
      message:
        'This replaces your current data, whitelist, and history with whatever is in the backup file. Continue?',
      confirmLabel: 'Choose file',
      destructive: true,
      icon: 'cloud-download-outline',
    });
    if (!ok) return;
    try {
      const payload = await backupService.restoreFromFile();
      applyRestoredPayload(payload);
    } catch (err: any) {
      if (err?.message === 'File selection cancelled') return;
      if (err instanceof PassphraseRequiredError) {
        await promptAndDecrypt(err.envelope);
        return;
      }
      dialog.alert({
        title: 'Restore failed',
        message: err?.message || 'Could not restore backup.',
        icon: 'alert-circle',
        iconColor: colors.error,
      });
    }
  };

  const handleRemoveFromWhitelist = async (username: string) => {
    await dataStore.removeFromWhitelist(username);
    const updated = await dataStore.getWhitelist();
    setWhitelist(updated);
  };

  const handleEditNote = async (user: { username: string; note?: string }) => {
    const note = await dialog.prompt({
      title: `Note for @${user.username}`,
      message: 'A private label, kept on this device only.',
      placeholder: 'e.g. school friend, work, do not engage',
      initialValue: user.note ?? '',
      confirmLabel: 'Save',
      icon: 'create-outline',
      multiline: true,
    });
    if (note === null) return; // cancelled
    const updated = await dataStore.setWhitelistNote(user.username, note);
    setWhitelist(updated);
  };

  const handleRemoveFromUnfollowed = async (username: string) => {
    await dataStore.removeFromUnfollowed(username);
    const updated = await dataStore.getUnfollowed();
    setUnfollowed(updated);
  };

  const handleOpenGitHub = () => {
    Linking.openURL('https://github.com/NuhaadhHasn/mutual-instagram-tracker').catch(() => {});
  };

  const handleReportIssue = () => {
    Linking.openURL('https://github.com/NuhaadhHasn/mutual-instagram-tracker/issues').catch(() => {});
  };

  const handleToggleBlockScreenshots = (value: boolean) => {
    haptic.tap();
    setBlockScreenshots(value);
    dataStore.setBlockScreenshots(value);
  };

  const handleToggleAppLock = async (value: boolean) => {
    haptic.tap();
    if (value) {
      // Don't let the user lock themselves out — require a biometric OR passcode.
      const level = await LocalAuthentication.getEnrolledLevelAsync();
      if (level === LocalAuthentication.SecurityLevel.NONE) {
        dialog.alert({
          title: 'No screen lock found',
          message:
            'Set up a fingerprint, Face ID, or device passcode in your phone settings first, then enable this.',
          icon: 'lock-open-outline',
          iconColor: colors.warning,
        });
        return;
      }
    }
    setAppLock(value);
    dataStore.setAppLock(value);
  };

  const handleShareApp = async () => {
    haptic.tap();
    try {
      await Share.share({
        message:
          "Mutual — see who's really with you. A privacy-first Instagram follower tracker that runs 100% on your phone, no login required. https://github.com/NuhaadhHasn/mutual-instagram-tracker",
      });
    } catch {
      // User dismissed the share sheet, or it's unavailable — ignore.
    }
  };

  const SettingRow = ({
    icon,
    iconBg,
    iconColor,
    title,
    subtitle,
    onPress,
  }: {
    icon: any;
    iconBg: string;
    iconColor: string;
    title: string;
    subtitle?: string;
    onPress?: () => void;
    isLast?: boolean;
  }) => {
    const inner = (
      <View style={styles.row}>
        <View style={[styles.rowIconBg, { backgroundColor: iconBg }]}>
          <Ionicons name={icon} size={18} color={iconColor} />
        </View>
        <View style={styles.rowText}>
          <Text style={styles.rowTitle}>{title}</Text>
          {subtitle && <Text style={styles.rowSubtitle}>{subtitle}</Text>}
        </View>
        {onPress && (
          <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
        )}
      </View>
    );
    return onPress ? (
      <TouchableOpacity activeOpacity={0.6} onPress={onPress}>
        {inner}
      </TouchableOpacity>
    ) : (
      inner
    );
  };

  const Separator = () => <View style={styles.separator} />;

  const ThemeSegment = ({ option }: { option: ThemeMode }) => {
    const active = mode === option;
    const iconName =
      option === 'light' ? 'sunny' : option === 'dark' ? 'moon' : 'phone-portrait';
    const label = option[0].toUpperCase() + option.slice(1);
    return (
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={() => setMode(option)}
        style={[
          styles.segment,
          active && { backgroundColor: colors.primary },
        ]}
      >
        <Ionicons
          name={iconName as any}
          size={16}
          color={active ? '#fff' : colors.textSecondary}
        />
        <Text
          style={[
            styles.segmentText,
            { color: active ? '#fff' : colors.textSecondary },
          ]}
        >
          {label}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator={false}
      stickyHeaderIndices={[]}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={refresh}
          tintColor={colors.primary}
        />
      }
    >
      <StatusBar style="light" />
      <Modal
        visible={backupBusy !== null}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => {}}
      >
        <View style={styles.busyOverlay}>
          <View style={styles.busyCard}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.busyText}>{backupBusy}</Text>
          </View>
        </View>
      </Modal>
      <View style={[styles.appHeader, { paddingTop: insets.top + Spacing.md }]}>
        <LinearGradient
          colors={[...heroGradient]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.appHeaderGradient}
        >
          <View style={styles.appIcon}>
            <Ionicons name="infinite" size={28} color="#fff" />
          </View>
          <Text style={styles.appName}>Mutual</Text>
          <Text style={styles.appVersion}>v1.0.0</Text>
        </LinearGradient>
      </View>

      <AnimatedFadeSlide index={0}>
      <Text style={styles.sectionLabel}>Appearance</Text>
      <View style={styles.segmentedControl}>
        <ThemeSegment option="light" />
        <ThemeSegment option="system" />
        <ThemeSegment option="dark" />
      </View>
      </AnimatedFadeSlide>

      <AnimatedFadeSlide index={1}>
      <Text style={styles.sectionLabel}>Data</Text>
      <View style={styles.groupCard}>
        <SettingRow
          icon="refresh"
          iconBg={colors.primary + '15'}
          iconColor={colors.primary}
          title="Update Data"
          subtitle="Import a fresh Instagram export"
          onPress={() => navigation.navigate('Import')}
          isLast={!hasData && !isHydrating}
        />
        {isHydrating && !hasData ? (
          <>
            <Separator />
            <View style={styles.inlineEmptyRow}>
              <SkeletonBox width="65%" height={14} style={{ marginBottom: 6 }} />
              <SkeletonBox width="45%" height={11} />
            </View>
          </>
        ) : hasData ? (
          <>
            <Separator />
            <SettingRow
              icon="information-circle-outline"
              iconBg={colors.info + '15'}
              iconColor={colors.info}
              title="Data Info"
              subtitle={`Last updated · ${new Date(followerData!.lastUpdated).toLocaleDateString()}`}
            />
            <Separator />
            <SettingRow
              icon="document-text-outline"
              iconBg={colors.success + '15'}
              iconColor={colors.success}
              title="Export full report"
              subtitle="CSV with stats, unfollowers, fans, followers, following"
              onPress={handleExportFullReport}
            />
            <Separator />
            <SettingRow
              icon="time-outline"
              iconBg={colors.warning + '15'}
              iconColor={colors.warning}
              title="Clear History"
              subtitle={`${history.length} saved ${
                history.length === 1 ? 'import' : 'imports'
              }`}
              onPress={history.length > 0 ? handleClearHistory : undefined}
              isLast
            />
          </>
        ) : (
          <>
            <Separator />
            <View style={styles.inlineEmptyRow}>
              <Text style={styles.inlineEmptyText}>No data imported yet</Text>
            </View>
          </>
        )}
      </View>
      </AnimatedFadeSlide>

      <AnimatedFadeSlide index={2}>
        <Text style={styles.sectionLabel}>Backup</Text>
        <View style={styles.groupCard}>
          <SettingRow
            icon="cloud-upload-outline"
            iconBg={colors.info + '15'}
            iconColor={colors.info}
            title="Export app state"
            subtitle="Save data, whitelist, and history to a JSON file"
            onPress={handleExportBackup}
          />
          <Separator />
          <SettingRow
            icon="cloud-download-outline"
            iconBg={colors.success + '15'}
            iconColor={colors.success}
            title="Restore from backup"
            subtitle="Replace current data with a backup JSON"
            onPress={handleRestoreBackup}
            isLast
          />
        </View>
      </AnimatedFadeSlide>

      {whitelist.length > 0 && (
        <AnimatedFadeSlide index={3}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionLabel}>Whitelist ({whitelist.length})</Text>
            {wlMulti.isActive && (
              <View style={styles.bulkActions}>
                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={bulkRemoveWhitelist}
                  style={styles.bulkRemoveBtn}
                >
                  <Ionicons name="trash-outline" size={13} color="#fff" />
                  <Text style={styles.bulkRemoveText}>Remove ({wlMulti.count})</Text>
                </TouchableOpacity>
                <TouchableOpacity activeOpacity={0.7} onPress={wlMulti.clear} hitSlop={8}>
                  <Text style={styles.bulkCancel}>Cancel</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
          {whitelist.length > SEARCH_THRESHOLD && (
            <TextInput
              style={styles.sectionSearch}
              placeholder="Search whitelist…"
              placeholderTextColor={colors.textSecondary}
              value={whitelistQuery}
              onChangeText={setWhitelistQuery}
              autoCapitalize="none"
              autoCorrect={false}
              clearButtonMode="while-editing"
            />
          )}
          <View style={styles.groupCard}>
            {filteredWhitelist.length === 0 ? (
              <Text style={styles.sectionEmpty}>No matches.</Text>
            ) : (
              filteredWhitelist.map((user, idx) => {
                const selected = wlMulti.has(user.username);
                return (
              <View key={user.username}>
                {idx > 0 && <Separator />}
                <View style={[styles.whitelistRow, selected && styles.rowSelected]}>
                  {wlMulti.isActive ? (
                    <View
                      style={[
                        styles.checkbox,
                        selected && { backgroundColor: colors.primary, borderColor: colors.primary },
                      ]}
                    >
                      {selected && <Ionicons name="checkmark" size={14} color="#fff" />}
                    </View>
                  ) : (
                    <UserAvatar username={user.username} size={36} />
                  )}
                  <TouchableOpacity
                    activeOpacity={0.7}
                    onLongPress={() => {
                      haptic.longPress();
                      wlMulti.select(user.username);
                    }}
                    delayLongPress={350}
                    onPress={() => {
                      if (wlMulti.isActive) wlMulti.toggle(user.username);
                      else handleEditNote(user);
                    }}
                    style={{ flex: 1, marginLeft: 12 }}
                  >
                    <Text
                      style={[styles.whitelistUsername, { marginLeft: 0 }]}
                      numberOfLines={1}
                      ellipsizeMode="tail"
                    >
                      @{user.username}
                    </Text>
                    {user.note ? (
                      <Text style={styles.whitelistNote} numberOfLines={1}>
                        {user.note}
                      </Text>
                    ) : (
                      <Text style={styles.whitelistAddNote}>Add note</Text>
                    )}
                  </TouchableOpacity>
                  {!wlMulti.isActive && (
                    <TouchableOpacity
                      activeOpacity={0.7}
                      onPress={() => handleRemoveFromWhitelist(user.username)}
                      hitSlop={10}
                    >
                      <Ionicons
                        name="close-circle"
                        size={22}
                        color={colors.error}
                      />
                    </TouchableOpacity>
                  )}
                </View>
              </View>
                );
              })
            )}
          </View>
          {!wlMulti.isActive && whitelist.length > 1 && (
            <Text style={styles.bulkHint}>Tip: long-press to select multiple.</Text>
          )}
        </AnimatedFadeSlide>
      )}

      {unfollowed.length > 0 && (
        <AnimatedFadeSlide index={3}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionLabel}>Unfollowed ({unfollowed.length})</Text>
            {ufMulti.isActive && (
              <View style={styles.bulkActions}>
                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={bulkRemoveUnfollowed}
                  style={styles.bulkRemoveBtn}
                >
                  <Ionicons name="trash-outline" size={13} color="#fff" />
                  <Text style={styles.bulkRemoveText}>Remove ({ufMulti.count})</Text>
                </TouchableOpacity>
                <TouchableOpacity activeOpacity={0.7} onPress={ufMulti.clear} hitSlop={8}>
                  <Text style={styles.bulkCancel}>Cancel</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
          {unfollowed.length > SEARCH_THRESHOLD && (
            <TextInput
              style={styles.sectionSearch}
              placeholder="Search unfollowed…"
              placeholderTextColor={colors.textSecondary}
              value={unfollowedQuery}
              onChangeText={setUnfollowedQuery}
              autoCapitalize="none"
              autoCorrect={false}
              clearButtonMode="while-editing"
            />
          )}
          <View style={styles.groupCard}>
            {filteredUnfollowed.length === 0 ? (
              <Text style={styles.sectionEmpty}>No matches.</Text>
            ) : (
              filteredUnfollowed.map((user, idx) => {
                const selected = ufMulti.has(user.username);
                return (
              <View key={user.username}>
                {idx > 0 && <Separator />}
                <TouchableOpacity
                  activeOpacity={0.7}
                  onLongPress={() => {
                    haptic.longPress();
                    ufMulti.select(user.username);
                  }}
                  delayLongPress={350}
                  onPress={() => {
                    if (ufMulti.isActive) ufMulti.toggle(user.username);
                  }}
                  style={[styles.whitelistRow, selected && styles.rowSelected]}
                >
                  {ufMulti.isActive ? (
                    <View
                      style={[
                        styles.checkbox,
                        selected && { backgroundColor: colors.primary, borderColor: colors.primary },
                      ]}
                    >
                      {selected && <Ionicons name="checkmark" size={14} color="#fff" />}
                    </View>
                  ) : (
                    <UserAvatar username={user.username} size={36} />
                  )}
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text
                      style={[styles.whitelistUsername, { marginLeft: 0 }]}
                      numberOfLines={1}
                      ellipsizeMode="tail"
                    >
                      @{user.username}
                    </Text>
                    <Text style={styles.unfollowedDate}>
                      {new Date(user.unfollowedAt).toLocaleDateString()}
                    </Text>
                  </View>
                  {!ufMulti.isActive && (
                    <TouchableOpacity
                      activeOpacity={0.7}
                      onPress={() => handleRemoveFromUnfollowed(user.username)}
                      hitSlop={10}
                    >
                      <Ionicons
                        name="close-circle"
                        size={22}
                        color={colors.error}
                      />
                    </TouchableOpacity>
                  )}
                </TouchableOpacity>
              </View>
                );
              })
            )}
          </View>
          {!ufMulti.isActive && unfollowed.length > 1 && (
            <Text style={styles.bulkHint}>Tip: long-press to select multiple.</Text>
          )}
        </AnimatedFadeSlide>
      )}

      {hasData && (
        <AnimatedFadeSlide index={4}>
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={handleClearData}
          style={styles.dangerButtonShadow}
        >
          <View style={styles.dangerButton}>
            <Ionicons name="trash-outline" size={18} color="#fff" />
            <Text style={styles.dangerButtonText}>Clear All Data</Text>
          </View>
        </TouchableOpacity>
        </AnimatedFadeSlide>
      )}

      <AnimatedFadeSlide index={5}>
      <Text style={styles.sectionLabel}>About</Text>
      <View style={styles.groupCard}>
        <SettingRow
          icon="share-social-outline"
          iconBg={colors.primary + '15'}
          iconColor={colors.primary}
          title="Tell a friend"
          subtitle="Share Mutual with someone"
          onPress={handleShareApp}
        />
        <Separator />
        <SettingRow
          icon="logo-github"
          iconBg="#2C2C2E15"
          iconColor={isDark ? '#FFFFFF' : '#2C2C2E'}
          title="GitHub"
          subtitle="View source code"
          onPress={handleOpenGitHub}
        />
        <Separator />
        <SettingRow
          icon="bug-outline"
          iconBg={colors.warning + '15'}
          iconColor={colors.warning}
          title="Report an Issue"
          subtitle="Help us improve the app"
          onPress={handleReportIssue}
          isLast
        />
      </View>
      </AnimatedFadeSlide>

      <AnimatedFadeSlide index={6}>
      <Text style={styles.sectionLabel}>Privacy</Text>
      <View style={styles.privacyCard}>
        <View style={styles.privacyIconWrap}>
          <Ionicons name="lock-closed" size={20} color={colors.success} />
        </View>
        <View style={styles.privacyText}>
          <Text style={styles.privacyTitle}>100% Local Storage</Text>
          <Text style={styles.privacyDescription}>
            All your data stays on your device. No network requests, no logins, no tracking.
          </Text>
        </View>
      </View>
      <View style={[styles.groupCard, { marginTop: Spacing.sm }]}>
        <View style={styles.toggleRow}>
          <View style={[styles.rowIconBg, { backgroundColor: colors.secondary + '15' }]}>
            <Ionicons name="eye-off-outline" size={20} color={colors.secondary} />
          </View>
          <View style={styles.toggleText}>
            <Text style={styles.rowTitle}>Block screenshots</Text>
            <Text style={styles.rowSubtitle}>
              Hide the app from screenshots & screen recording
            </Text>
          </View>
          <Switch
            value={blockScreenshots}
            onValueChange={handleToggleBlockScreenshots}
            trackColor={{ false: colors.border, true: colors.primary }}
            thumbColor="#fff"
          />
        </View>
        <Separator />
        <View style={styles.toggleRow}>
          <View style={[styles.rowIconBg, { backgroundColor: colors.success + '15' }]}>
            <Ionicons name="finger-print" size={20} color={colors.success} />
          </View>
          <View style={styles.toggleText}>
            <Text style={styles.rowTitle}>Require unlock to open</Text>
            <Text style={styles.rowSubtitle}>
              Face ID / fingerprint / passcode on launch
            </Text>
          </View>
          <Switch
            value={appLock}
            onValueChange={handleToggleAppLock}
            trackColor={{ false: colors.border, true: colors.primary }}
            thumbColor="#fff"
          />
        </View>
      </View>
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={handleOpenGitHub}
        style={styles.osBadge}
      >
        <Ionicons name="shield-checkmark" size={15} color={colors.success} />
        <Text style={styles.osBadgeText}>
          Open source · auditable — anyone can verify there's no hidden network code
        </Text>
        <Ionicons name="open-outline" size={14} color={colors.textSecondary} />
      </TouchableOpacity>
      </AnimatedFadeSlide>

      <View style={styles.footer}>
        <Text style={styles.footerText}>Made with care for Instagram users</Text>
        <Text style={styles.footerSubtext}>Free · Open Source · Privacy First</Text>
      </View>
    </ScrollView>
  );
}

function makeStyles(colors: ColorSet) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.surface,
    },
    busyOverlay: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(0,0,0,0.45)',
    },
    busyCard: {
      alignItems: 'center',
      paddingVertical: Spacing.lg,
      paddingHorizontal: Spacing.xl,
      borderRadius: BorderRadius.lg,
      backgroundColor: colors.surfaceElevated,
      ...Shadows.lg,
    },
    busyText: {
      marginTop: Spacing.md,
      color: colors.text,
      fontWeight: '600',
      fontSize: 15,
    },
    contentContainer: {
      paddingBottom: Spacing.xl + Spacing.md,
    },
    appHeader: {
      marginBottom: Spacing.lg,
    },
    appHeaderGradient: {
      paddingHorizontal: Spacing.lg,
      paddingTop: Spacing.lg,
      paddingBottom: Spacing.xl,
      alignItems: 'center',
      borderBottomLeftRadius: 24,
      borderBottomRightRadius: 24,
    },
    appIcon: {
      width: 56,
      height: 56,
      borderRadius: 16,
      backgroundColor: 'rgba(255,255,255,0.2)',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: Spacing.sm,
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.3)',
    },
    appName: {
      fontSize: 18,
      fontWeight: '700',
      color: '#fff',
      letterSpacing: -0.3,
    },
    appVersion: {
      fontSize: 12,
      color: 'rgba(255,255,255,0.8)',
      marginTop: 2,
    },
    sectionLabel: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.textSecondary,
      letterSpacing: 0.8,
      textTransform: 'uppercase',
      marginHorizontal: Spacing.lg,
      marginTop: Spacing.md,
      marginBottom: Spacing.sm,
    },
    segmentedControl: {
      flexDirection: 'row',
      backgroundColor: colors.surfaceElevated,
      borderRadius: 12,
      padding: 4,
      marginHorizontal: Spacing.lg,
      ...Shadows.sm,
    },
    segment: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 8,
      borderRadius: 8,
      gap: 4,
    },
    segmentText: {
      fontSize: 13,
      fontWeight: '600',
    },
    groupCard: {
      backgroundColor: colors.cardBackground,
      borderRadius: 16,
      marginHorizontal: Spacing.lg,
      ...Shadows.sm,
      overflow: 'hidden',
    },
    sectionSearch: {
      backgroundColor: colors.inputBackground,
      borderRadius: 12,
      marginHorizontal: Spacing.lg,
      marginBottom: Spacing.sm,
      paddingHorizontal: Spacing.md,
      paddingVertical: 10,
      fontSize: 15,
      color: colors.text,
    },
    sectionEmpty: {
      fontSize: 14,
      color: colors.textSecondary,
      padding: Spacing.md,
    },
    sectionHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingRight: Spacing.lg,
    },
    bulkActions: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: Spacing.md,
      marginBottom: Spacing.sm,
    },
    bulkRemoveBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.error,
      borderRadius: 14,
      paddingHorizontal: 12,
      paddingVertical: 6,
      marginRight: Spacing.md,
    },
    bulkRemoveText: {
      color: '#fff',
      fontSize: 12,
      fontWeight: '700',
      marginLeft: 4,
    },
    bulkCancel: {
      color: colors.primary,
      fontSize: 13,
      fontWeight: '700',
    },
    bulkHint: {
      fontSize: 12,
      color: colors.textSecondary,
      marginHorizontal: Spacing.lg,
      marginTop: Spacing.sm,
    },
    rowSelected: {
      backgroundColor: colors.primary + '12',
    },
    checkbox: {
      width: 36,
      height: 36,
      borderRadius: 18,
      borderWidth: 2,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    osBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      marginHorizontal: Spacing.lg,
      marginTop: Spacing.sm,
      paddingHorizontal: Spacing.md,
      paddingVertical: 10,
      borderRadius: 12,
      backgroundColor: colors.success + '12',
    },
    osBadgeText: {
      flex: 1,
      fontSize: 12,
      color: colors.textSecondary,
      marginHorizontal: 8,
      lineHeight: 16,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: Spacing.md,
      paddingVertical: 14,
    },
    rowIconBg: {
      width: 32,
      height: 32,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 12,
    },
    toggleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: Spacing.md,
      paddingVertical: 12,
    },
    toggleText: {
      flex: 1,
      marginRight: Spacing.sm,
    },
    rowText: {
      flex: 1,
    },
    rowTitle: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.text,
    },
    rowSubtitle: {
      fontSize: 12,
      color: colors.textSecondary,
      marginTop: 2,
    },
    separator: {
      height: 1,
      backgroundColor: colors.border,
      marginLeft: Spacing.md + 32 + 12,
    },
    inlineEmptyRow: {
      paddingHorizontal: Spacing.md + 32 + 12,
      paddingVertical: 12,
    },
    inlineEmptyText: {
      fontSize: 13,
      color: colors.textSecondary,
      fontStyle: 'italic',
    },
    whitelistRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: Spacing.md,
      paddingVertical: 12,
    },
    whitelistUsername: {
      flex: 1,
      fontSize: 14,
      fontWeight: '600',
      color: colors.text,
      marginLeft: 12,
    },
    whitelistNote: {
      fontSize: 12,
      color: colors.textSecondary,
      marginTop: 2,
    },
    whitelistAddNote: {
      fontSize: 12,
      color: colors.primary,
      marginTop: 2,
      fontWeight: '600',
    },
    unfollowedDate: {
      fontSize: 11,
      color: colors.textSecondary,
      marginTop: 2,
    },
    dangerButtonShadow: {
      marginHorizontal: Spacing.lg,
      marginTop: Spacing.md,
      borderRadius: 14,
      ...Shadows.md,
    },
    dangerButton: {
      height: 50,
      borderRadius: 14,
      backgroundColor: colors.error,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
    },
    dangerButtonText: {
      color: '#fff',
      fontSize: 15,
      fontWeight: '700',
      marginLeft: Spacing.sm,
    },
    privacyCard: {
      flexDirection: 'row',
      backgroundColor: '#E8F5E9',
      marginHorizontal: Spacing.lg,
      padding: Spacing.md,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: '#C8E6C9',
    },
    privacyIconWrap: {
      width: 36,
      height: 36,
      borderRadius: 12,
      backgroundColor: '#fff',
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 12,
    },
    privacyText: {
      flex: 1,
    },
    privacyTitle: {
      fontSize: 14,
      fontWeight: '700',
      color: '#1B5E20',
      marginBottom: 2,
    },
    privacyDescription: {
      fontSize: 12,
      color: '#2E7D32',
      lineHeight: 17,
    },
    footer: {
      alignItems: 'center',
      marginTop: Spacing.xl,
    },
    footerText: {
      fontSize: 12,
      color: colors.textSecondary,
      marginBottom: 2,
    },
    footerSubtext: {
      fontSize: 11,
      color: colors.textSecondary,
      letterSpacing: 0.3,
    },
  });
}
