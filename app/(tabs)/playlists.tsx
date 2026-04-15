import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import PlaylistPicker from '../../src/components/PlaylistPicker';
import { getMyPlaylists } from '../../src/api/endpoints';
import { useDeckStore } from '../../src/store/deckStore';
import { useAuthStore } from '../../src/store/authStore';
import { COLORS, SPACING, RADIUS } from '../../src/theme';
import type { SpotifyPlaylist } from '../../src/api/types';
import LottieEmptyState from '../../src/components/LottieEmptyState';
const emptyPlaylistsAnim = require('../../assets/lottie/empty-playlists.json');

export default function PlaylistsScreen() {
  const { sourcePlaylist, setSourcePlaylist, targetPlaylistId, setTargetPlaylistId, setQueue } =
    useDeckStore();
  const accessToken = useAuthStore((s) => s.accessToken);
  const [mode, setMode] = useState<'source' | 'target'>('source');
  const insets = useSafeAreaInsets();

  const { data, isLoading } = useQuery({
    queryKey: ['playlists'],
    queryFn: () => getMyPlaylists(),
    enabled: !!accessToken,
  });

  const playlists = data?.items ?? [];

  const handleSelect = (playlist: SpotifyPlaylist) => {
    if (mode === 'source') { setSourcePlaylist(playlist); setQueue([]); }
    else setTargetPlaylistId(playlist.id);
  };

  const selectedId = mode === 'source' ? sourcePlaylist?.id ?? null : targetPlaylistId;

  if (!accessToken) {
    return (
      <View style={[styles.container, { paddingTop: insets.top + SPACING.md }]}>
        <View style={styles.header}>
          <Text style={styles.title}>Playlists</Text>
        </View>
        <LottieEmptyState
          animationSource={emptyPlaylistsAnim}
          title="Connect Spotify"
          subtitle="Link your Spotify account to seed recommendations from your playlists and save liked songs."
        />
        <TouchableOpacity
          style={styles.connectBtn}
          onPress={() => router.navigate('/(auth)/login')}
          accessibilityLabel="Connect Spotify"
          accessibilityRole="button"
        >
          <Text style={styles.connectBtnText}>Connect Spotify</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top + SPACING.md }]}>
      <View style={styles.header}>
        <Text style={styles.title}>Playlists</Text>

        {/* Toggle */}
        <View style={styles.toggle}>
          <TouchableOpacity
            style={[styles.toggleBtn, mode === 'source' && styles.toggleActive]}
            onPress={() => setMode('source')}
          >
            <Text style={[styles.toggleText, mode === 'source' && styles.toggleTextActive]}>
              Seed source
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toggleBtn, mode === 'target' && styles.toggleActive]}
            onPress={() => setMode('target')}
          >
            <Text style={[styles.toggleText, mode === 'target' && styles.toggleTextActive]}>
              Save likes to
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {isLoading ? (
        <ActivityIndicator color={COLORS.green} style={{ marginTop: SPACING.xxl }} />
      ) : (
        <PlaylistPicker
          playlists={playlists}
          selectedId={selectedId}
          onSelect={handleSelect}
          label={
            mode === 'source'
              ? 'Pick a playlist to seed recommendations from'
              : 'Liked songs will be added to this playlist'
          }
        />
      )}

      {sourcePlaylist && (
        <TouchableOpacity
          style={styles.discoverBtn}
          onPress={() => router.navigate('/(tabs)/home')}
          accessibilityLabel="Start Discovering"
          accessibilityRole="button"
        >
          <Ionicons name="compass" size={18} color="#000" />
          <Text style={styles.discoverBtnText}>Start Discovering</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  header: {
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.md,
    gap: SPACING.md,
  },
  title: { color: COLORS.text, fontSize: 28, fontWeight: '800', letterSpacing: -0.5 },

  toggle: {
    flexDirection: 'row',
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    padding: 3,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: 9,
    alignItems: 'center',
    borderRadius: RADIUS.sm,
  },
  toggleActive: { backgroundColor: COLORS.green },
  toggleText: { color: COLORS.textSub, fontSize: 14, fontWeight: '600' },
  toggleTextActive: { color: '#000' },

  discoverBtn: {
    margin: SPACING.md,
    backgroundColor: COLORS.green,
    paddingVertical: 16,
    borderRadius: RADIUS.full,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
  },
  discoverBtnText: { color: '#000', fontSize: 16, fontWeight: '700' },

  connectBtn: {
    marginTop: SPACING.sm,
    backgroundColor: COLORS.green,
    paddingVertical: 14,
    paddingHorizontal: SPACING.xxl,
    borderRadius: RADIUS.full,
  },
  connectBtnText: { color: '#000', fontSize: 15, fontWeight: '700' },
});
