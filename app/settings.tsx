import React, { useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Switch,
  Alert,
  Linking,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useDeckStore } from '../src/store/deckStore';
import { useSettingsStore, type GenreShiftAfter } from '../src/store/settingsStore';
import { useProfileStore } from '../src/store/profileStore';
import { useSubscriptionStore } from '../src/store/subscriptionStore';
import { COLORS, SPACING, RADIUS } from '../src/theme';
import { GENRE_COLORS } from '../src/utils/genres';
import { ONBOARDING_KEY, ONBOARDING_GENRES_KEY } from './onboarding';
import { PRIVACY_POLICY_URL } from '../src/utils/constants';
import { signOut } from 'firebase/auth';
import { auth } from '../src/firebase/config';
import { useAuthStore } from '../src/store/authStore';
import { TokenStorage } from '../src/auth/TokenStorage';
import { useTutorialStore } from '../src/store/tutorialStore';
import { ensurePermission, sendTestNotification } from '../src/notifications/notificationService';
import { syncReengagementNotifications } from '../src/notifications/coordinator';

// ── Reusable row ───────────────────────────────────────────────────────────────

function SettingRow({
  icon,
  iconColor,
  label,
  sublabel,
  right,
  onPress,
  danger,
}: {
  icon: string;
  iconColor?: string;
  label: string;
  sublabel?: string;
  right?: React.ReactNode;
  onPress?: () => void;
  danger?: boolean;
}) {
  return (
    <TouchableOpacity
      style={styles.row}
      onPress={onPress}
      activeOpacity={onPress ? 0.7 : 1}
      disabled={!onPress && right === undefined}
    >
      <View style={[styles.rowIcon, { backgroundColor: `${iconColor ?? COLORS.purple}22` }]}>
        <Ionicons name={icon as any} size={16} color={iconColor ?? COLORS.purple} />
      </View>
      <View style={styles.rowText}>
        <Text style={[styles.rowLabel, danger && { color: COLORS.pink }]}>{label}</Text>
        {sublabel ? <Text style={styles.rowSub}>{sublabel}</Text> : null}
      </View>
      {right !== undefined
        ? right
        : onPress
          ? <Ionicons name="chevron-forward" size={16} color={COLORS.textMuted} />
          : null}
    </TouchableOpacity>
  );
}

function SectionCard({ children }: { children: React.ReactNode }) {
  return <View style={styles.card}>{children}</View>;
}

function Divider() {
  return <View style={styles.divider} />;
}

// ── Screen ─────────────────────────────────────────────────────────────────────

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const { onboardingGenres, clearSeenTracks, clearHistory } = useDeckStore();
  const { genreShiftAfter, autoPlayPreviews, notificationsEnabled, setGenreShiftAfter, setAutoPlayPreviews, setNotificationsEnabled } =
    useSettingsStore();
  const isPrivate = useProfileStore((s) => s.isPrivate);
  const togglePrivate = useProfileStore((s) => s.togglePrivate);
  const isPro = useSubscriptionStore((s) => s.isPro);
  const tier = useSubscriptionStore((s) => s.tier);
  const isLoggedIn = !!auth.currentUser;

  const handleToggleNotifications = useCallback(async (value: boolean) => {
    if (value) {
      const granted = await ensurePermission();
      if (!granted) {
        Alert.alert(
          'Turn on notifications',
          'Enable notifications for SongMatch in your device Settings to get reminders.',
          [
            { text: 'Not now', style: 'cancel' },
            { text: 'Open Settings', onPress: () => Linking.openSettings() },
          ]
        );
        return; // leave the toggle off
      }
      setNotificationsEnabled(true);
    } else {
      setNotificationsEnabled(false);
    }
    await syncReengagementNotifications();
  }, [setNotificationsEnabled]);

  const handleTestNotification = useCallback(async () => {
    const ok = await sendTestNotification();
    Alert.alert(
      ok ? 'Test scheduled' : 'Notifications are off',
      ok
        ? 'Lock or background the app now — it arrives in about 5 seconds.'
        : 'Turn on Reminders above (or in device Settings) first.'
    );
  }, []);

  const handleRedoQuiz = useCallback(() => {
    Alert.alert(
      'Redo Genre Quiz?',
      "Your genre preferences will be reset and you'll go through the quiz again.",
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Redo',
          style: 'destructive',
          onPress: async () => {
            await AsyncStorage.multiRemove([ONBOARDING_GENRES_KEY, ONBOARDING_KEY]);
            useDeckStore.setState({ onboardingGenres: [] });
            router.replace('/onboarding');
          },
        },
      ]
    );
  }, []);

  const handleClearSeen = useCallback(() => {
    Alert.alert(
      'Clear Seen Tracks?',
      "Songs you've already seen can reappear in your discovery feed.",
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Clear', onPress: clearSeenTracks },
      ]
    );
  }, [clearSeenTracks]);

  const handleResetHistory = useCallback(() => {
    Alert.alert(
      'Reset All History?',
      'This will permanently delete all your liked songs, skips, and stats.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Reset', style: 'destructive', onPress: clearHistory },
      ]
    );
  }, [clearHistory]);

  const handleLogOut = useCallback(() => {
    Alert.alert(
      'Log Out',
      'You will be signed out and returned to the login screen.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Log Out',
          style: 'destructive',
          onPress: async () => {
            useDeckStore.getState().cancelArtistIdsTimer();
            const prevUserId = useDeckStore.getState().userId;
            try {
              await TokenStorage.clearTokens();
              await TokenStorage.clearSoundCloudTokens();
            } catch {}
            useAuthStore.getState().logout();
            useDeckStore.setState({
              queue: [],
              likedTracks: [],
              recentSkips: [],
              seenTrackIds: [],
              artistSkipCounts: {},
              likedCount: 0,
              skippedCount: 0,
              consecutiveSkips: 0,
              sourcePlaylist: null,
              targetPlaylistId: null,
              seedTrack: null,
              userId: 'anonymous',
              lastSwipedCard: null,
              lastSwipeDirection: null,
            });
            if (auth) await signOut(auth).catch(() => {});
            const userKeys = prevUserId !== 'anonymous'
              ? [
                  `sm_liked_${prevUserId}`,
                  `sm_stats_${prevUserId}`,
                  `sm_skips_${prevUserId}`,
                  `sm_seen_${prevUserId}`,
                  `sm_artist_skips_${prevUserId}`,
                ]
              : [];
            await AsyncStorage.multiRemove([
              ONBOARDING_KEY,
              ONBOARDING_GENRES_KEY,
              'sm_onboarding_song_id',
              'sm_onboarding_artists',
              'sm_onboarding_artist_track_ids',
              'sm_liked_anonymous',
              'sm_skips_anonymous',
              'sm_seen_anonymous',
              'sm_stats_anonymous',
              'sm_artist_skips_anonymous',
              ...userKeys,
            ]);
            useDeckStore.setState({ onboardingGenres: [] });
            router.replace('/onboarding');
          },
        },
      ]
    );
  }, []);

  const handleReplayTutorial = useCallback(() => {
    useTutorialStore.getState().replay();
    router.navigate('/(tabs)/home');
  }, []);

  const handleDeleteAccount = useCallback(() => {
    Alert.alert(
      'Delete Account?',
      'This permanently deletes your profile, liked songs, followers and points. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Continue',
          style: 'destructive',
          onPress: () => {
            Alert.prompt(
              'Confirm Password',
              'Enter your password to permanently delete your account.',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Delete Forever',
                  style: 'destructive',
                  onPress: async (password?: string) => {
                    if (!password) return;
                    try {
                      const { deleteAccount } = await import('../src/firebase/authService');
                      await deleteAccount(password);
                    } catch (e: any) {
                      const code = e?.code ?? '';
                      Alert.alert(
                        'Could Not Delete Account',
                        code === 'auth/wrong-password' || code === 'auth/invalid-credential'
                          ? 'The password you entered is incorrect.'
                          : 'Something went wrong. Check your connection and try again.'
                      );
                      return;
                    }
                    // Same local cleanup as logout (auth user is already gone).
                    useDeckStore.getState().cancelArtistIdsTimer();
                    const prevUserId = useDeckStore.getState().userId;
                    try {
                      await TokenStorage.clearTokens();
                      await TokenStorage.clearSoundCloudTokens();
                    } catch {}
                    useAuthStore.getState().logout();
                    useDeckStore.setState({
                      queue: [],
                      likedTracks: [],
                      recentSkips: [],
                      seenTrackIds: [],
                      artistSkipCounts: {},
                      likedCount: 0,
                      skippedCount: 0,
                      consecutiveSkips: 0,
                      sourcePlaylist: null,
                      targetPlaylistId: null,
                      seedTrack: null,
                      userId: 'anonymous',
                      lastSwipedCard: null,
                      lastSwipeDirection: null,
                    });
                    const userKeys = prevUserId !== 'anonymous'
                      ? [
                          `sm_liked_${prevUserId}`,
                          `sm_stats_${prevUserId}`,
                          `sm_skips_${prevUserId}`,
                          `sm_seen_${prevUserId}`,
                          `sm_artist_skips_${prevUserId}`,
                        ]
                      : [];
                    await AsyncStorage.multiRemove([
                      ONBOARDING_KEY,
                      ONBOARDING_GENRES_KEY,
                      'sm_onboarding_song_id',
                      'sm_onboarding_artists',
                      'sm_onboarding_artist_track_ids',
                      'sm_liked_anonymous',
                      'sm_skips_anonymous',
                      'sm_seen_anonymous',
                      'sm_stats_anonymous',
                      'sm_artist_skips_anonymous',
                      ...userKeys,
                    ]);
                    useDeckStore.setState({ onboardingGenres: [] });
                    router.replace('/onboarding');
                  },
                },
              ],
              'secure-text'
            );
          },
        },
      ]
    );
  }, []);

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {/* ── Header ── */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => router.back()}
          hitSlop={12}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={22} color={COLORS.textSub} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Settings</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Subscription ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Subscription</Text>
          <SectionCard>
            {isPro ? (
              <View style={styles.row}>
                <View style={[styles.rowIcon, { backgroundColor: 'rgba(167,139,250,0.15)' }]}>
                  <Ionicons name="flash" size={16} color={COLORS.purple} />
                </View>
                <View style={styles.rowText}>
                  <Text style={styles.rowLabel}>SongMatch Pro</Text>
                  <Text style={styles.rowSub}>
                    {tier === 'monthly' ? 'Monthly plan' : tier === 'quarterly' ? 'Quarterly plan' : 'Annual plan'}
                    {' · '}Active
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.manageBtn}
                  onPress={() => router.push('/referral')}
                  activeOpacity={0.8}
                >
                  <Text style={styles.manageBtnText}>Invite</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                style={styles.upgradeRow}
                onPress={() => router.push('/upgrade')}
                activeOpacity={0.85}
              >
                <LinearGradient
                  colors={['rgba(167,139,250,0.15)', 'rgba(232,121,249,0.10)']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.upgradeGrad}
                >
                  <View style={styles.upgradeLeft}>
                    <LinearGradient
                      colors={['#A78BFA', '#E879F9']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.upgradeIconWrap}
                    >
                      <Ionicons name="flash" size={16} color="#fff" />
                    </LinearGradient>
                    <View style={styles.rowText}>
                      <Text style={styles.rowLabel}>Go Pro</Text>
                      <Text style={styles.rowSub}>Unlimited · No ads · All features</Text>
                    </View>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={COLORS.purple} />
                </LinearGradient>
              </TouchableOpacity>
            )}
          </SectionCard>
        </View>


        {/* ── Appearance ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Appearance</Text>
          <SectionCard>
            <SettingRow
              icon="apps-outline"
              iconColor={COLORS.purple}
              label="App Icon"
              sublabel="22 icons — Pro exclusive"
              right={isPro ? undefined : (
                <View style={styles.proBadge}>
                  <MaterialCommunityIcons name="crown" size={10} color="#ffd700" />
                  <Text style={styles.proBadgeText}>PRO</Text>
                </View>
              )}
              onPress={() => isPro ? router.push('/app-icons') : router.push('/upgrade')}
            />
          </SectionCard>
        </View>

        {/* ── Taste Profile ── */}
        {onboardingGenres.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Taste Profile</Text>
            <SectionCard>
              <View style={styles.genreGrid}>
                {onboardingGenres.map((g) => {
                  const color = GENRE_COLORS[g] ?? COLORS.purple;
                  return (
                    <View
                      key={g}
                      style={[styles.genreChip, { backgroundColor: `${color}22`, borderColor: `${color}55` }]}
                    >
                      <View style={[styles.genreDot, { backgroundColor: color }]} />
                      <Text style={[styles.genreChipText, { color }]}>{g}</Text>
                    </View>
                  );
                })}
              </View>
              <Divider />
              <SettingRow
                icon="refresh-outline"
                iconColor={COLORS.orange}
                label="Re-do Genre Quiz"
                sublabel="Update your music preferences"
                onPress={handleRedoQuiz}
              />
            </SectionCard>
          </View>
        )}

        {/* ── Discovery ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Discovery</Text>
          <SectionCard>
            <View style={styles.row}>
              <View style={[styles.rowIcon, { backgroundColor: `${COLORS.cyan}22` }]}>
                <Ionicons name="shuffle-outline" size={16} color={COLORS.cyan} />
              </View>
              <View style={styles.rowText}>
                <Text style={styles.rowLabel}>Genre shift after</Text>
                <Text style={styles.rowSub}>Skips before switching genre</Text>
              </View>
              <View style={styles.segmented}>
                {([3, 5, 10] as GenreShiftAfter[]).map((v) => (
                  <TouchableOpacity
                    key={v}
                    style={[styles.segBtn, genreShiftAfter === v && styles.segBtnActive]}
                    onPress={() => setGenreShiftAfter(v)}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.segText, genreShiftAfter === v && styles.segTextActive]}>
                      {v}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </SectionCard>
        </View>

        {/* ── Privacy ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Privacy</Text>
          <SectionCard>
            <View style={styles.row}>
              <View style={[styles.rowIcon, { backgroundColor: `${COLORS.cyan}22` }]}>
                <Ionicons name="lock-closed-outline" size={16} color={COLORS.cyan} />
              </View>
              <View style={styles.rowText}>
                <Text style={styles.rowLabel}>Private profile</Text>
                <Text style={styles.rowSub}>Hide from discovery, search & leaderboards</Text>
              </View>
              <Switch
                value={isPrivate}
                onValueChange={togglePrivate}
                trackColor={{ false: COLORS.border, true: `${COLORS.cyan}88` }}
                thumbColor={isPrivate ? COLORS.cyan : COLORS.textMuted}
              />
            </View>
          </SectionCard>
        </View>

        {/* ── Playback ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Playback</Text>
          <SectionCard>
            <View style={styles.row}>
              <View style={[styles.rowIcon, { backgroundColor: `${COLORS.purple}22` }]}>
                <Ionicons name="play-circle-outline" size={16} color={COLORS.purple} />
              </View>
              <View style={styles.rowText}>
                <Text style={styles.rowLabel}>Auto-play previews</Text>
                <Text style={styles.rowSub}>Play snippet when card appears</Text>
              </View>
              <Switch
                value={autoPlayPreviews}
                onValueChange={setAutoPlayPreviews}
                trackColor={{ false: COLORS.border, true: `${COLORS.purple}88` }}
                thumbColor={autoPlayPreviews ? COLORS.purple : COLORS.textMuted}
              />
            </View>
          </SectionCard>
        </View>

        {/* ── Notifications ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Notifications</Text>
          <SectionCard>
            <View style={styles.row}>
              <View style={[styles.rowIcon, { backgroundColor: `${COLORS.orange}22` }]}>
                <Ionicons name="notifications-outline" size={16} color={COLORS.orange} />
              </View>
              <View style={styles.rowText}>
                <Text style={styles.rowLabel}>Reminders</Text>
                <Text style={styles.rowSub}>Streak alerts & nudges to discover music</Text>
              </View>
              <Switch
                value={notificationsEnabled}
                onValueChange={handleToggleNotifications}
                trackColor={{ false: COLORS.border, true: `${COLORS.orange}88` }}
                thumbColor={notificationsEnabled ? COLORS.orange : COLORS.textMuted}
              />
            </View>
            <Divider />
            <SettingRow
              icon="paper-plane-outline"
              iconColor={COLORS.cyan}
              label="Send test notification"
              sublabel="Fires in ~5s — background the app to see it"
              onPress={handleTestNotification}
            />
          </SectionCard>
        </View>

        {/* ── Data ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Data</Text>
          <SectionCard>
            <SettingRow
              icon="eye-off-outline"
              iconColor={COLORS.cyan}
              label="Clear seen tracks"
              sublabel="Re-discover songs you've already passed"
              onPress={handleClearSeen}
            />
            <Divider />
            <SettingRow
              icon="trash-outline"
              iconColor={COLORS.pink}
              label="Reset all history"
              sublabel="Delete liked songs, skips and stats"
              onPress={handleResetHistory}
              danger
            />
            <Divider />
            <SettingRow
              icon="play-skip-back-outline"
              iconColor={COLORS.purple}
              label="Restart onboarding"
              sublabel="Preview the onboarding flow"
              onPress={handleRedoQuiz}
            />
            <Divider />
            <SettingRow
              icon="school-outline"
              iconColor={COLORS.cyan}
              label="Replay tutorial"
              sublabel="See the guided walkthrough again"
              onPress={handleReplayTutorial}
            />
          </SectionCard>
        </View>

        {/* ── Account ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account</Text>
          <SectionCard>
            {isLoggedIn ? (
              <>
                <SettingRow
                  icon="log-out-outline"
                  iconColor={COLORS.pink}
                  label="Log Out"
                  sublabel="Sign out and return to login"
                  onPress={handleLogOut}
                  danger
                />
                <SettingRow
                  icon="trash-outline"
                  iconColor={COLORS.pink}
                  label="Delete Account"
                  sublabel="Permanently erase your account and data"
                  onPress={handleDeleteAccount}
                  danger
                />
              </>
            ) : (
              <SettingRow
                icon="log-in-outline"
                iconColor={COLORS.cyan}
                label="Log In"
                sublabel="Sign in to sync your data"
                onPress={() => router.push('/onboarding')}
              />
            )}
          </SectionCard>
        </View>

        {/* ── Legal ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Legal</Text>
          <SectionCard>
            <SettingRow
              icon="document-text-outline"
              iconColor={COLORS.textSub}
              label="Privacy Policy"
              sublabel="How we collect and use your data"
              onPress={() => Linking.openURL(PRIVACY_POLICY_URL)}
            />
          </SectionCard>
        </View>

        <Text style={styles.footer}>SongMatch • built with ♥</Text>
        {/* Linked credits required by Deezer trademark guidelines + Last.fm API ToS 2.7 */}
        <Text style={styles.footer}>
          Music previews by{' '}
          <Text style={styles.footerLink} onPress={() => Linking.openURL('https://www.deezer.com')}>
            Deezer
          </Text>
          {' '}· music data by{' '}
          <Text style={styles.footerLink} onPress={() => Linking.openURL('https://www.last.fm')}>
            Last.fm
          </Text>
        </Text>
        {/* Required by Deezer developer terms: users must be informed that
            streaming is limited to strictly private use within a family scope */}
        <Text style={styles.footer}>
          Previews are for private, personal listening only.
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },

  content: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.xxl,
    gap: SPACING.lg,
  },

  section: { gap: SPACING.sm },
  sectionTitle: {
    color: COLORS.textMuted,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    paddingHorizontal: 2,
  },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
  },
  divider: { height: 1, backgroundColor: COLORS.border },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    gap: SPACING.md,
  },
  rowIcon: {
    width: 34,
    height: 34,
    borderRadius: RADIUS.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: { flex: 1, gap: 2 },
  rowLabel: { color: COLORS.text, fontSize: 15, fontWeight: '600' },
  rowSub: { color: COLORS.textMuted, fontSize: 12, lineHeight: 17 },

  // Segmented control
  segmented: {
    flexDirection: 'row',
    backgroundColor: 'rgba(31,31,40,0.80)',
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
  },
  segBtn: { paddingHorizontal: 12, paddingVertical: 7 },
  segBtnActive: { backgroundColor: COLORS.cyan },
  segText: { color: COLORS.textMuted, fontSize: 13, fontWeight: '700' },
  segTextActive: { color: '#0D0D0D' },

  // Genre chips
  genreGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
    padding: SPACING.md,
  },
  genreChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: RADIUS.full,
    borderWidth: 1,
  },
  genreDot: { width: 6, height: 6, borderRadius: 3 },
  genreChipText: { fontSize: 13, fontWeight: '600' },

  headerTitle: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.3,
  },

  footer: {
    color: COLORS.textMuted,
    fontSize: 12,
    textAlign: 'center',
  },
  footerLink: {
    color: COLORS.textSub,
    textDecorationLine: 'underline',
  },

  // Subscription
  upgradeRow: {
    borderRadius: RADIUS.lg,
    overflow: 'hidden',
  },
  upgradeGrad: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: SPACING.md,
  },
  upgradeLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    flex: 1,
  },
  upgradeIconWrap: {
    width: 34,
    height: 34,
    borderRadius: RADIUS.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  manageBtn: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: RADIUS.full,
    borderWidth: 1.5,
    borderColor: 'rgba(167,139,250,0.4)',
    backgroundColor: 'rgba(167,139,250,0.08)',
  },
  manageBtnText: { color: COLORS.purple, fontSize: 12, fontWeight: '700' },

  proBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: 'rgba(255,215,0,0.12)', borderRadius: 8,
    paddingHorizontal: 7, paddingVertical: 3,
    borderWidth: 1, borderColor: 'rgba(255,215,0,0.3)',
  },
  proBadgeText: { color: '#ffd700', fontSize: 9, fontWeight: '800', letterSpacing: 0.5 },
});
