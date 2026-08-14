import React, { useEffect, useState } from 'react';
import { View, type StyleProp, type ImageStyle, type ViewStyle } from 'react-native';
import { Image } from 'expo-image';
import type { Track } from '../api/types';
import { resolveArtwork } from '../api/musicKitService';

interface Props {
  track: Track;
  style?: StyleProp<ImageStyle>;
}

/**
 * Renders licensed Apple Music artwork for a track. Prefers an already-resolved
 * `track.artworkUrl`; otherwise resolves it lazily via musicKitService (cached).
 * Never falls back to the legacy cover URL — shows a neutral placeholder
 * while resolving or when there is no catalog match.
 */
export default function AppleArtwork({ track, style }: Props) {
  const [uri, setUri] = useState<string | null>(track.artworkUrl ?? null);

  useEffect(() => {
    if (track.artworkUrl) {
      setUri(track.artworkUrl);
      return;
    }
    let alive = true;
    resolveArtwork(track)
      .then((a) => { if (alive) setUri(a.artworkUrl); })
      .catch(() => {});
    return () => { alive = false; };
  }, [track.id, track.artworkUrl]);

  if (!uri) {
    return <View style={[{ backgroundColor: '#1F1F28' }, style as StyleProp<ViewStyle>]} />;
  }
  return (
    <Image source={{ uri }} style={style} contentFit="cover" cachePolicy="disk" transition={120} />
  );
}
