import { useEffect, useRef } from 'react';
import { AppState, type AppStateStatus, StyleSheet, View } from 'react-native';
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

// Load tutorial state from AsyncStorage on app start
useTutorialStore.getState().load();

async function prefetchRecommendations() {
  const { likedTracks, seenTrackIds, artistSkipCounts, onboardingSongId, onboardingArtistTrackIds, appendQueue } =
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

    const recentLikedIds = likedTracks.slice(0, 3).map(t => t.id);
    const deezerSeedIds = [
      ...recentLikedIds,
      ...(onboardingSongId !== null && !recentLikedIds.includes(onboardingSongId) ? [onboardingSongId] : []),
      ...onboardingArtistTrackIds.filter(id => !recentLikedIds.includes(id) && id !== onboardingSongId),
    ];

    const seenIds = new Set<number>([
      ...likedTracks.map((t) => t.id),
      ...seenTrackIds,
    ]);
    const cards = await getRecommendationsForSeeds(seeds, 20, seenIds, filteredArtistKeys, deezerSeedIds);
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

export default function RootLayout() {
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
        // Check streak on launch
        useProfileStore.getState().checkAndUpdateStreak();
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
    });

    // Check streak whenever app comes back to foreground
    const sub = AppState.addEventListener('change', (nextState) => {
      if (appState.current.match(/inactive|background/) && nextState === 'active') {
        useProfileStore.getState().checkAndUpdateStreak();
      }
      appState.current = nextState;
    });

    return () => sub.remove();
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
          <Stack.Screen name="upgrade" options={{ presentation: 'modal' }} />
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
