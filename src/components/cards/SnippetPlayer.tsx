import React from 'react';
import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSnippetPlayer } from '../../hooks/useSnippetPlayer';
import { useSettingsStore } from '../../store/settingsStore';
import { COLORS } from '../../theme';

interface Props {
  previewUrl: string | null;
  autoPlay?: boolean;
}

export default function SnippetPlayer({ previewUrl, autoPlay = false }: Props) {
  const autoPlayEnabled = useSettingsStore((s) => s.autoPlayPreviews);
  const { isPlaying, toggle, position, duration } = useSnippetPlayer(previewUrl, autoPlay && autoPlayEnabled);

  if (!previewUrl) {
    return (
      <View style={styles.unavailable}>
        <Ionicons name="musical-note-outline" size={14} color={COLORS.textMuted} />
        <Text style={styles.unavailableText}>Preview unavailable</Text>
      </View>
    );
  }

  const progress = duration > 0 ? position / duration : 0;
  const fmt = (ms: number) => {
    const s = Math.floor(ms / 1000);
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity
        onPress={toggle}
        style={styles.button}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        accessibilityLabel={isPlaying ? 'Pause preview' : 'Play preview'}
        accessibilityRole="button"
      >
        <Ionicons name={isPlaying ? 'pause' : 'play'} size={18} color="#fff" />
      </TouchableOpacity>

      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${progress * 100}%` as any }]} />
      </View>

      <Text style={styles.time}>{fmt(position)} / {fmt(duration)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  button: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.purple,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 5,
  },
  progressTrack: {
    flex: 1,
    height: 5,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: COLORS.purple,
    borderRadius: 3,
  },
  time: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 12,
    width: 68,
  },
  unavailable: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  unavailableText: {
    color: COLORS.textMuted,
    fontSize: 13,
  },
});
