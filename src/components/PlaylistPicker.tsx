import React from 'react';
import { View, Text, FlatList, TouchableOpacity, Image, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { SpotifyPlaylist } from '../api/types';
import { COLORS, SPACING, RADIUS } from '../theme';

interface Props {
  playlists: SpotifyPlaylist[];
  selectedId: string | null;
  onSelect: (playlist: SpotifyPlaylist) => void;
  label?: string;
}

export default function PlaylistPicker({ playlists, selectedId, onSelect, label }: Props) {
  return (
    <View style={styles.container}>
      {label && (
        <Text style={styles.label}>{label}</Text>
      )}
      <FlatList
        data={playlists.filter(Boolean)}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => {
          const isSelected = item.id === selectedId;
          return (
            <TouchableOpacity
              style={[styles.item, isSelected && styles.itemSelected]}
              onPress={() => onSelect(item)}
              accessibilityLabel={`Select playlist ${item.name}`}
              accessibilityRole="button"
              accessibilityState={{ selected: isSelected }}
            >
              {item.images?.[0] ? (
                <Image source={{ uri: item.images[0].url }} style={styles.thumb} />
              ) : (
                <View style={[styles.thumb, styles.thumbPlaceholder]}>
                  <Ionicons name="musical-notes" size={20} color={COLORS.textMuted} />
                </View>
              )}
              <View style={styles.meta}>
                <Text style={[styles.name, isSelected && styles.nameSelected]} numberOfLines={1}>
                  {item.name}
                </Text>
                <Text style={styles.count}>{item.tracks?.total ?? 0} tracks</Text>
              </View>
              {isSelected ? (
                <View style={styles.checkWrap}>
                  <Ionicons name="checkmark" size={16} color="#000" />
                </View>
              ) : (
                <View style={styles.uncheckWrap} />
              )}
            </TouchableOpacity>
          );
        }}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  label: {
    color: COLORS.textMuted,
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: SPACING.sm,
    paddingHorizontal: SPACING.md,
  },
  separator: { height: 1, backgroundColor: COLORS.border },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.sm + 2,
    paddingHorizontal: SPACING.md,
    gap: SPACING.md,
  },
  itemSelected: { backgroundColor: 'rgba(29,185,84,0.08)' },
  thumb: {
    width: 52,
    height: 52,
    borderRadius: RADIUS.sm,
  },
  thumbPlaceholder: {
    backgroundColor: COLORS.surface2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  meta: { flex: 1 },
  name: { color: COLORS.text, fontSize: 15, fontWeight: '600' },
  nameSelected: { color: COLORS.green },
  count: { color: COLORS.textSub, fontSize: 12, marginTop: 2 },
  checkWrap: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: COLORS.green,
    alignItems: 'center',
    justifyContent: 'center',
  },
  uncheckWrap: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: COLORS.border,
  },
});
