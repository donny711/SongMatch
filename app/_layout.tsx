import { useEffect, useRef } from 'react';
import { AppState, type AppStateStatus, StyleSheet } from 'react-native';
import * as Sentry from '@sentry/react-native';
import { Stack, router } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuthStore } from '../src/store/authStore';
import { MPToast } from '../src/components/profile/MPToast';
import { StreakCelebration } from '../src/components/profile/StreakCelebration';
import type { SoundCloudUser } from '../src/store/authStore';
import { useDeckStore } from '../src/store/deckStore';
import { useSettingsStore } from '../src/store/settingsStore';
import { useProfileStore } from '../src/store/profileStore';
import { useSubscriptionStore } from '../src/store/subscriptionStore';
import { TokenStorage } from '../src/auth/TokenStorage';
import { getMe, getRecommendationsForSeeds } from '../src/api/endpoints';
import { sampleLikedSeeds } from '../src/utils/sampleLikedSeeds';
import { ONBOARDING_KEY } from './onboarding';
import { useReferral } from '../src/hooks/useReferral';
import { TutorialMeasureProvider } from '../src/components/tutorial/TutorialMeasureContext';
import { TutorialOverlay } from '../src/components/tutorial/TutorialOverlay';
import { useTutorialStore } from '../src/store/tutorialStore';
import { configureHandler, addTapListener } from '../src/notifications/notificationService';
import { syncReengagementNotifications } from '../src/notifications/coordinator';

Sentry.init({
  // DSN is public by design (it can only receive crash reports); env var
  // allows pointing dev builds elsewhere without a code change.
  dsn: process.env.EXPO_PUBLIC_SENTRY_DSN
    ?? 'https://661540bd58cbb568ab579e3eb070ba95@o4511540761853952.ingest.de.sentry.io/4511540770766928',
  enabled: !__DEV__,
  sendDefaultPii: false,
  tracesSampleRate: 0.2,
});

// Load tutorial state from AsyncStorage on app start
useTutorialStore.getState().load();

// How local notifications present while the app is foregrounded.
configureHandler();

async function prefetchRecommendations() {
  const { likedTracks, seenTrackIds, artistSkipCounts, appendQueue } =
    useDeckStore.getState();

  if (likedTracks.length < 3) return;

  try {
    const likedArtistKeys = new Set(likedTracks.map((t) => t.artist.name.toLowerCase()));
    const skipFilteredKeys = new Set(
      Object.entries(artistSkipCounts)
        .filter(([, entry]) => entry.count >= 2)
        .map(([artist]) => artist)
    );
    const filteredArtistKeys = new Set([...likedArtistKeys, ...skipFilteredKeys]);

    const n = likedTracks.length;
    const seedCount = n >= 50 ? 6 : n >= 20 ? 5 : n >= 10 ? 4 : 3;
    const seeds = sampleLikedSeeds(likedTracks, seedCount);
    if (seeds.length === 0) return;

    // Apple artist-id seeds: sample up to 4 from recently-liked tracks.
    const likedArtistIds = likedTracks
      .slice(0, 20)
      .map((t) => t.appleArtistId)
      .filter((v): v is string => !!v);
    const seedArtistIds = likedArtistIds.length <= 4
      ? likedArtistIds
      : [...likedArtistIds].sort(() => Math.random() - 0.5).slice(0, 4);

    const seenIds = new Set<number>([
      ...likedTracks.map((t) => t.id),
      ...seenTrackIds,
    ]);
    const cards = await getRecommendationsForSeeds(seeds, 20, seenIds, filteredArtistKeys, seedArtistIds);
    if (cards.length > 0) appendQueue(cards);
  } catch {
    // silent — the normal in-app fetch will handle it
  }
}

const queryClient = new QueryClient();

async function restoreSoundCloudSession() {
  const scToken = await TokenStorage.getSoundCloudAccessToken();
  if (!scToken) return;
  try {
    const meRes = await fetch('https://api.soundcloud.com/me', {
      headers: { Authorization: `OAuth ${scToken}` },
    });
    if (!meRes.ok) {
      await TokenStorage.clearSoundCloudTokens();
      return;
    }
    const me = await meRes.json();
    const user: SoundCloudUser = {
      id: me.id,
      username: me.username,
      full_name: me.full_name ?? me.username,
      avatar_url: me.avatar_url ?? null,
    };
    useAuthStore.getState().setSoundCloudUser(user);
    useAuthStore.getState().addPlatform('soundcloud');
  } catch {
    await TokenStorage.clearSoundCloudTokens();
  }
}

function RootLayout() {
  const setAccessToken = useAuthStore((s) => s.setAccessToken);
  const setUser = useAuthStore((s) => s.setUser);
  const loadForUser = useDeckStore((s) => s.loadForUser);
  const loadSettings = useSettingsStore((s) => s.load);
  const appState = useRef<AppStateStatus>(AppState.currentState);
  useReferral();

  useEffect(() => {
    (async () => {
      await loadSettings();
      await useAuthStore.getState().loadPlatforms();

      let spotifyUserId: string | undefined;
      const token = await TokenStorage.getAccessToken();
      if (token) {
        setAccessToken(token);
        try {
          const user = await getMe();
          setUser(user);
          spotifyUserId = user.id;
          useAuthStore.getState().addPlatform('spotify');
          await loadForUser(user.id);
        } catch {
          await TokenStorage.clearTokens();
          await loadForUser('anonymous');
        }
      } else {
        await loadForUser('anonymous');
      }

      // Initialize Firebase profile (non-blocking)
      useProfileStore.getState().initialize(spotifyUserId).then(() => {
        // Grant first-launch milestone if not yet earned
        const { earnedMilestones, uid } = useProfileStore.getState();
        if (!earnedMilestones.includes('ms_first_launch')) {
          useProfileStore.getState().grantMilestone('ms_first_launch');
        }
        // Catch-up for users whose Spotify was connected before this milestone
        // existed (or whose OAuth-callback grant failed) — idempotent.
        if (spotifyUserId) {
          useProfileStore.getState().grantMilestone('ms_connect_spotify').catch(() => {});
        }
        // Check streak on launch, then schedule re-engagement notifications.
        useProfileStore.getState().checkAndUpdateStreak().then(syncReengagementNotifications);
        // Initialize subscription store
        if (uid) {
          useSubscriptionStore.getState().initialize(uid).catch(() => {});
        }
      }).catch(() => {});

      // Restore SoundCloud session in the background
      restoreSoundCloudSession();

      const onboarded = await AsyncStorage.getItem(ONBOARDING_KEY);
      if (!onboarded) {
        router.replace('/onboarding');
        return;
      }
      router.replace('/(tabs)/home');
      prefetchRecommendations();
      useTutorialStore.getState().load();
    })().catch((err: unknown) => {
      console.error('[SongMatch] Startup error:', err);
      Sentry.captureException(err);
    });

    // Keep streak + re-engagement notifications in sync with app state.
    const sub = AppState.addEventListener('change', (nextState) => {
      if (appState.current.match(/inactive|background/) && nextState === 'active') {
        // Foreground: refresh streak, then reschedule from the fresh state.
        useProfileStore.getState().checkAndUpdateStreak().then(syncReengagementNotifications);
      } else if (nextState.match(/inactive|background/)) {
        // Backgrounding: (re)schedule the come-back + streak nudges from now.
        syncReengagementNotifications();
      }
      appState.current = nextState;
    });

    // All nudges deep-link to the discovery deck.
    const tapSub = addTapListener(() => router.navigate('/(tabs)/home'));

    return () => { sub.remove(); tapSub.remove(); };
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <GestureHandlerRootView style={styles.root}>
        <TutorialMeasureProvider>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="settings" options={{ presentation: 'card' }} />
          <Stack.Screen name="shop" options={{ presentation: 'card' }} />
          <Stack.Screen name="edit-profile" options={{ presentation: 'card' }} />
          <Stack.Screen name="edit-showcase" options={{ presentation: 'card' }} />
          <Stack.Screen name="followers" options={{ presentation: 'card' }} />
          <Stack.Screen name="following" options={{ presentation: 'card' }} />
          <Stack.Screen name="user/[uid]" options={{ presentation: 'card' }} />
          <Stack.Screen name="who-liked/[trackId]" options={{ presentation: 'modal' }} />
          <Stack.Screen name="earn-mp" options={{ presentation: 'modal' }} />
          <Stack.Screen name="referral" options={{ presentation: 'card' }} />
        </Stack>
        <MPToast />
        <StreakCelebration />
        <TutorialOverlay />
        </TutorialMeasureProvider>
      </GestureHandlerRootView>
    </QueryClientProvider>
  );
}

const styles = StyleSheet.create({ root: { flex: 1 } });

// Sentry.wrap adds the top-level error boundary + touch/navigation breadcrumbs.
export default Sentry.wrap(RootLayout);
