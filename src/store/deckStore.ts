import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { RecommendationCard, SpotifyPlaylist, DeezerTrack } from '../api/types';
import { syncLikedTrackToFirestore, removeLikedTrackFromFirestore, updateArtistIds } from '../firebase/profileService';

interface DeckState {
  queue: RecommendationCard[];
  likedCount: number;
  skippedCount: number;
  consecutiveSkips: number;
  likedTracks: DeezerTrack[];
  recentSkips: DeezerTrack[];
  seenTrackIds: number[];
  artistSkipCounts: Record<string, { count: number; ts: number }>;
  onboardingGenres: string[];
  onboardingArtists: string[];
  onboardingSongId: number | null;
  onboardingArtistTrackIds: number[];
  sourcePlaylist: SpotifyPlaylist | null;
  targetPlaylistId: string | null;
  seedTrack: { name: string; artist: string } | null;
  userId: string;
  setQueue: (cards: RecommendationCard[]) => void;
  appendQueue: (cards: RecommendationCard[]) => void;
  shiftQueue: () => void;
  incrementLiked: () => void;
  incrementSkipped: () => void;
  addLikedTrack: (track: DeezerTrack) => void;
  removeLikedTrack: (id: number) => void;
  addSkippedTrack: (track: DeezerTrack) => void;
  markSeen: (id: number) => void;
  setSourcePlaylist: (playlist: SpotifyPlaylist | null) => void;
  setTargetPlaylistId: (id: string | null) => void;
  setSeedTrack: (track: { name: string; artist: string } | null) => void;
  clearSeenTracks: () => void;
  clearHistory: () => void;
  loadForUser: (userId: string) => Promise<void>;
  lastSwipedCard: RecommendationCard | null;
  lastSwipeDirection: 'like' | 'skip' | null;
  recordSwipe: (card: RecommendationCard, direction: 'like' | 'skip') => void;
  undoLastSwipe: () => void;
}

const likedKey       = (userId: string) => `sm_liked_${userId}`;
const statsKey       = (userId: string) => `sm_stats_${userId}`;
const skipsKey       = (userId: string) => `sm_skips_${userId}`;
const seenKey        = (userId: string) => `sm_seen_${userId}`;
const artistSkipsKey = (userId: string) => `sm_artist_skips_${userId}`;
const genresKey      = () => 'sm_onboarding_genres';
const onboardingArtistsKey     = () => 'sm_onboarding_artists';
const onboardingSongIdKey      = () => 'sm_onboarding_song_id';
const onboardingArtistIdsKey   = () => 'sm_onboarding_artist_track_ids';

export const useDeckStore = create<DeckState>((set, get) => ({
  queue: [],
  likedCount: 0,
  skippedCount: 0,
  consecutiveSkips: 0,
  likedTracks: [],
  recentSkips: [],
  seenTrackIds: [],
  artistSkipCounts: {},
  onboardingGenres: [],
  onboardingArtists: [],
  onboardingSongId: null,
  onboardingArtistTrackIds: [],
  sourcePlaylist: null,
  targetPlaylistId: null,
  seedTrack: null,
  userId: 'anonymous',
  lastSwipedCard: null,
  lastSwipeDirection: null,
  setQueue: (queue) => set({ queue }),
  appendQueue: (cards) => set((s) => {
    const existingIds = new Set(s.queue.map((c) => c.track.id));
    const fresh = cards.filter((c) => !existingIds.has(c.track.id));
    return { queue: [...s.queue, ...fresh] };
  }),
  shiftQueue: () => set((s) => ({ queue: s.queue.slice(1) })),
  incrementLiked: () => {
    set((s) => ({ likedCount: s.likedCount + 1, consecutiveSkips: 0 }));
    // After set(), get() reflects the already-incremented value — use it directly.
    const { userId, likedCount, skippedCount } = get();
    AsyncStorage.setItem(statsKey(userId), JSON.stringify({ likedCount, skippedCount }));
    // Check liked-count milestones against the already-incremented likedCount.
    const likedMilestones = [10, 25, 50, 100, 250] as const;
    if ((likedMilestones as readonly number[]).includes(likedCount)) {
      // Import-free reference via dynamic require to avoid circular deps
      const { useProfileStore } = require('./profileStore');
      useProfileStore.getState().grantMilestone(`ms_liked_${likedCount}`);
    }
  },
  incrementSkipped: () => {
    set((s) => ({ skippedCount: s.skippedCount + 1, consecutiveSkips: s.consecutiveSkips + 1 }));
    const { userId, likedCount, skippedCount } = get();
    AsyncStorage.setItem(statsKey(userId), JSON.stringify({ likedCount, skippedCount }));
  },
  addLikedTrack: (track) => {
    const alreadyLiked = get().likedTracks.some((t) => t.id === track.id);
    set((s) => ({
      likedTracks: alreadyLiked ? s.likedTracks : [track, ...s.likedTracks],
      seenTrackIds: s.seenTrackIds.includes(track.id)
        ? s.seenTrackIds
        : [track.id, ...s.seenTrackIds].slice(0, 500),
    }));
    const { userId, likedTracks, seenTrackIds } = get();
    AsyncStorage.setItem(likedKey(userId), JSON.stringify(likedTracks));
    AsyncStorage.setItem(seenKey(userId), JSON.stringify(seenTrackIds));
    if (!alreadyLiked) {
      const { useProfileStore } = require('./profileStore');
      const uid = useProfileStore.getState().uid;
      if (uid) {
        syncLikedTrackToFirestore(uid, track).catch(() => {});
        updateArtistIds(uid, get().likedTracks).catch(() => {});
      }
    }
  },
  removeLikedTrack: (id) => {
    set((s) => ({
      likedTracks: s.likedTracks.filter((t) => t.id !== id),
      likedCount: Math.max(0, s.likedCount - 1),
    }));
    const { userId, likedTracks, likedCount, skippedCount } = get();
    AsyncStorage.setItem(likedKey(userId), JSON.stringify(likedTracks));
    AsyncStorage.setItem(statsKey(userId), JSON.stringify({ likedCount, skippedCount }));
    const { useProfileStore } = require('./profileStore');
    const uid = useProfileStore.getState().uid;
    if (uid) {
      removeLikedTrackFromFirestore(uid, id).catch(() => {});
      updateArtistIds(uid, get().likedTracks).catch(() => {});
    }
  },
  addSkippedTrack: (track) => {
    const artistKey = track.artist.name.toLowerCase();
    set((s) => ({
      recentSkips: [track, ...s.recentSkips.filter((t) => t.id !== track.id)].slice(0, 500),
      seenTrackIds: s.seenTrackIds.includes(track.id)
        ? s.seenTrackIds
        : [track.id, ...s.seenTrackIds].slice(0, 500),
      artistSkipCounts: {
        ...s.artistSkipCounts,
        [artistKey]: { count: (s.artistSkipCounts[artistKey]?.count ?? 0) + 1, ts: Date.now() },
      },
    }));
    const { userId, recentSkips, seenTrackIds, artistSkipCounts } = get();
    AsyncStorage.setItem(skipsKey(userId), JSON.stringify(recentSkips));
    AsyncStorage.setItem(seenKey(userId), JSON.stringify(seenTrackIds));
    AsyncStorage.setItem(artistSkipsKey(userId), JSON.stringify(artistSkipCounts));
  },
  markSeen: (id) => {
    set((s) => ({
      seenTrackIds: s.seenTrackIds.includes(id)
        ? s.seenTrackIds
        : [id, ...s.seenTrackIds].slice(0, 500),
    }));
  },
  setSourcePlaylist: (playlist) => set({ sourcePlaylist: playlist }),
  setTargetPlaylistId: (id) => set({ targetPlaylistId: id }),
  setSeedTrack: (track) => set({ seedTrack: track }),
  clearSeenTracks: () => {
    set({ seenTrackIds: [] });
    const { userId } = get();
    AsyncStorage.setItem(seenKey(userId), JSON.stringify([]));
  },
  clearHistory: () => {
    set({ likedTracks: [], recentSkips: [], likedCount: 0, skippedCount: 0, consecutiveSkips: 0, queue: [], artistSkipCounts: {} });
    const { userId } = get();
    AsyncStorage.multiRemove([likedKey(userId), skipsKey(userId), artistSkipsKey(userId)]);
    AsyncStorage.setItem(statsKey(userId), JSON.stringify({ likedCount: 0, skippedCount: 0 }));
  },
  recordSwipe: (card, direction) => set({ lastSwipedCard: card, lastSwipeDirection: direction }),
  undoLastSwipe: () => {
    const {
      lastSwipedCard, lastSwipeDirection,
      likedTracks, recentSkips,
      likedCount, skippedCount, consecutiveSkips,
      artistSkipCounts, userId,
    } = get();
    if (!lastSwipedCard || !lastSwipeDirection) return;

    if (lastSwipeDirection === 'like') {
      const newLiked = likedTracks.filter((t) => t.id !== lastSwipedCard.track.id);
      const newLikedCount = Math.max(0, likedCount - 1);
      set((s) => ({
        queue: [lastSwipedCard, ...s.queue],
        likedTracks: newLiked,
        likedCount: newLikedCount,
        lastSwipedCard: null,
        lastSwipeDirection: null,
      }));
      AsyncStorage.setItem(likedKey(userId), JSON.stringify(newLiked));
      AsyncStorage.setItem(statsKey(userId), JSON.stringify({ likedCount: newLikedCount, skippedCount }));
      const { useProfileStore } = require('./profileStore');
      const uid = useProfileStore.getState().uid;
      if (uid) {
        removeLikedTrackFromFirestore(uid, lastSwipedCard.track.id).catch(() => {});
      }
    } else {
      const artistKey = lastSwipedCard.track.artist.name.toLowerCase();
      const newSkips = recentSkips.filter((t) => t.id !== lastSwipedCard.track.id);
      const newSkippedCount = Math.max(0, skippedCount - 1);
      const newConsecutive = Math.max(0, consecutiveSkips - 1);
      const newArtistCounts = { ...artistSkipCounts };
      const current = newArtistCounts[artistKey];
      if (current && current.count > 0) {
        if (current.count === 1) delete newArtistCounts[artistKey];
        else newArtistCounts[artistKey] = { count: current.count - 1, ts: current.ts };
      }
      set((s) => ({
        queue: [lastSwipedCard, ...s.queue],
        recentSkips: newSkips,
        skippedCount: newSkippedCount,
        consecutiveSkips: newConsecutive,
        artistSkipCounts: newArtistCounts,
        lastSwipedCard: null,
        lastSwipeDirection: null,
      }));
      AsyncStorage.setItem(skipsKey(userId), JSON.stringify(newSkips));
      AsyncStorage.setItem(statsKey(userId), JSON.stringify({ likedCount, skippedCount: newSkippedCount }));
      AsyncStorage.setItem(artistSkipsKey(userId), JSON.stringify(newArtistCounts));
    }
  },
  loadForUser: async (userId) => {
    const [likedRaw, statsRaw, skipsRaw, seenRaw, genresRaw, artistSkipsRaw, onboardingArtistsRaw, onboardingSongIdRaw, onboardingArtistIdsRaw] = await Promise.all([
      AsyncStorage.getItem(likedKey(userId)),
      AsyncStorage.getItem(statsKey(userId)),
      AsyncStorage.getItem(skipsKey(userId)),
      AsyncStorage.getItem(seenKey(userId)),
      AsyncStorage.getItem(genresKey()),
      AsyncStorage.getItem(artistSkipsKey(userId)),
      AsyncStorage.getItem(onboardingArtistsKey()),
      AsyncStorage.getItem(onboardingSongIdKey()),
      AsyncStorage.getItem(onboardingArtistIdsKey()),
    ]);
    function safeParse<T>(raw: string | null, fallback: T): T {
      if (!raw) return fallback;
      try { return JSON.parse(raw); } catch { return fallback; }
    }
    const likedTracks: DeezerTrack[] = safeParse(likedRaw, []);
    const recentSkips: DeezerTrack[] = safeParse(skipsRaw, []);
    const seenTrackIds: number[] = safeParse(seenRaw, []);
    const onboardingGenres: string[] = safeParse(genresRaw, []);
    const onboardingArtists: string[] = safeParse(onboardingArtistsRaw, []);
    const onboardingSongId: number | null = onboardingSongIdRaw ? Number(onboardingSongIdRaw) : null;
    const onboardingArtistTrackIds: number[] = safeParse(onboardingArtistIdsRaw, []);
    // Migrate: old format stored plain numbers, new format is { count, ts }.
    const rawSkipCounts: Record<string, number | { count: number; ts: number }> = safeParse(artistSkipsRaw, {});
    let artistSkipCounts: Record<string, { count: number; ts: number }> = {};
    for (const [key, val] of Object.entries(rawSkipCounts)) {
      artistSkipCounts[key] = typeof val === 'number' ? { count: val, ts: 0 } : val;
    }
    // Bootstrap from recentSkips the first time (migrates pre-feature skips)
    if (!artistSkipsRaw && recentSkips.length > 0) {
      for (const skip of recentSkips) {
        const key = skip.artist.name.toLowerCase();
        const existing = artistSkipCounts[key];
        artistSkipCounts[key] = { count: (existing?.count ?? 0) + 1, ts: 0 };
      }
    }
    // Decay: halve counts for each 7-day window since last skip; remove zeroed entries.
    const DECAY_MS = 7 * 24 * 60 * 60 * 1000;
    const now = Date.now();
    let decayDirty = false;
    for (const [key, entry] of Object.entries(artistSkipCounts)) {
      const halvings = Math.floor((now - entry.ts) / DECAY_MS);
      if (halvings > 0) {
        const decayed = Math.floor(entry.count / Math.pow(2, halvings));
        if (decayed === 0) { delete artistSkipCounts[key]; }
        else { artistSkipCounts[key] = { count: decayed, ts: entry.ts }; }
        decayDirty = true;
      }
    }
    if (decayDirty) AsyncStorage.setItem(artistSkipsKey(userId), JSON.stringify(artistSkipCounts));
    const stats: { likedCount: number; skippedCount: number } = safeParse(statsRaw, { likedCount: 0, skippedCount: 0 });
    set({ userId, likedTracks, recentSkips, seenTrackIds, onboardingGenres, onboardingArtists, onboardingSongId, onboardingArtistTrackIds, artistSkipCounts, likedCount: stats.likedCount, skippedCount: stats.skippedCount });
  },
}));
