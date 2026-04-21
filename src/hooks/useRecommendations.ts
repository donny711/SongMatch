import { useEffect, useCallback, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getRecommendationsForSeeds, getPlaylistTracks, getMyTopTracks } from '../api/endpoints';
import { getDeezerChart } from '../api/deezerClient';
import { buildTasteSeeds } from '../api/tasteEngine';
import { sampleLikedSeeds } from '../utils/sampleLikedSeeds';
import { useDeckStore } from '../store/deckStore';
import { useAuthStore } from '../store/authStore';
import { useSettingsStore } from '../store/settingsStore';
import type { SpotifyTrack } from '../api/types';
import { DECK_REFETCH_AT } from '../utils/constants';

function pickSeeds(tracks: SpotifyTrack[], count = 3): Array<{ name: string; artist: string }> {
  const shuffled = [...tracks].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count).map((t) => ({
    name: t.name,
    artist: t.artists[0]?.name ?? '',
  }));
}

export function useRecommendations() {
  const {
    sourcePlaylist,
    seedTrack,
    queue,
    setQueue,
    appendQueue,
    likedTracks,
    recentSkips,
    seenTrackIds,
    onboardingGenres,
    consecutiveSkips,
    artistSkipCounts,
  } = useDeckStore();
  const accessToken = useAuthStore((s) => s.accessToken);
  const genreShiftAfter = useSettingsStore((s) => s.genreShiftAfter);
  const exhaustedRef = useRef(false);
  const genreShiftRef = useRef(false);
  const lastShiftRef = useRef(0);
  const [isShifting, setIsShifting] = useState(false);

  useEffect(() => {
    exhaustedRef.current = false;
  }, [seedTrack?.name, sourcePlaylist?.id, accessToken]);

  const fetchRecs = useCallback(async () => {
    const forceShift = genreShiftRef.current;
    genreShiftRef.current = false;

    // Build the filter set: liked artists + artists skipped 2+ times
    const likedArtistKeys = new Set(likedTracks.map((t) => t.artist.name.toLowerCase()));
    const skipFilteredKeys = new Set(
      Object.entries(artistSkipCounts)
        .filter(([, count]) => count >= 2)
        .map(([artist]) => artist)
    );
    const filteredArtistKeys = new Set([...likedArtistKeys, ...skipFilteredKeys]);

    const n = likedTracks.length;
    const seedCount = n >= 50 ? 6 : n >= 20 ? 5 : n >= 10 ? 4 : 3;
    let seeds: Array<{ name: string; artist: string }> = [];

    if (seedTrack) {
      // "Hear a Song": recognised track + up to 2 taste-based seeds for context
      const tasteSeeds = await buildTasteSeeds(
        likedTracks, recentSkips, onboardingGenres, false, filteredArtistKeys
      );
      seeds = [seedTrack, ...tasteSeeds.slice(0, 2)];

    } else if (forceShift) {
      // Genre shift: pivot away from current taste using buildTasteSeeds
      const tasteSeeds = await buildTasteSeeds(
        likedTracks, recentSkips, onboardingGenres, true, filteredArtistKeys
      );
      seeds = tasteSeeds;

    } else if (sourcePlaylist && accessToken) {
      // User explicitly picked a Spotify playlist
      const res = await getPlaylistTracks(sourcePlaylist.id);
      const tracks = res.items.map((i) => i.track).filter(Boolean) as SpotifyTrack[];
      seeds = pickSeeds(tracks, seedCount);

    } else if (n >= 3) {
      // PRIMARY PATH: sample directly from liked songs.
      // track.getSimilar(artist, title) gives musically similar tracks in one hop —
      // no indirect artist-graph traversal that loses the original taste signal.
      seeds = sampleLikedSeeds(likedTracks, seedCount);

    } else if (onboardingGenres.length > 0) {
      // New user: no likes yet, use declared genre preferences
      const tasteSeeds = await buildTasteSeeds(
        likedTracks, recentSkips, onboardingGenres, false, filteredArtistKeys
      );
      seeds = tasteSeeds;

    } else if (accessToken) {
      // Bootstrap: Spotify top tracks for users with no history at all
      const top = await getMyTopTracks();
      seeds = pickSeeds(top.items, seedCount);

    } else {
      // Last resort: Deezer chart minus filtered artists
      try {
        const chart = await getDeezerChart(20);
        seeds = [...chart]
          .filter((t) => !filteredArtistKeys.has(t.artist.name.toLowerCase()))
          .sort(() => Math.random() - 0.5)
          .slice(0, 3)
          .map((t) => ({ name: t.title, artist: t.artist.name }));
      } catch {
        seeds = [];
      }
    }

    const seenIds = new Set<number>([
      ...likedTracks.map((t) => t.id),
      ...seenTrackIds,
    ]);
    return getRecommendationsForSeeds(seeds, 20, seenIds, filteredArtistKeys);
  }, [sourcePlaylist, seedTrack, accessToken, likedTracks, recentSkips, seenTrackIds, onboardingGenres, artistSkipCounts]);

  const { refetch, isFetching } = useQuery({
    queryKey: ['recommendations', sourcePlaylist?.id, seedTrack?.name, !!accessToken],
    queryFn: async () => {
      const cards = await fetchRecs();
      if (cards.length === 0) exhaustedRef.current = true;
      appendQueue(cards);
      return cards;
    },
    enabled: false,
  });

  // Genre-shift trigger: every N consecutive skips, clear queue and refetch
  useEffect(() => {
    if (
      consecutiveSkips > 0 &&
      consecutiveSkips % genreShiftAfter === 0 &&
      consecutiveSkips !== lastShiftRef.current
    ) {
      lastShiftRef.current = consecutiveSkips;
      genreShiftRef.current = true;
      setIsShifting(true);
      setQueue([]);
      exhaustedRef.current = false;
      refetch();
    }
  }, [consecutiveSkips]);

  // Clear shift banner once the fresh batch arrives
  useEffect(() => {
    if (!isFetching && isShifting) setIsShifting(false);
  }, [isFetching, isShifting]);

  // Bootstrap + auto-fetch when queue is running low
  useEffect(() => {
    if (queue.length <= DECK_REFETCH_AT && !isFetching && !exhaustedRef.current) {
      refetch();
    }
  }, [queue.length, isFetching]);

  return { isFetching, isShifting };
}
