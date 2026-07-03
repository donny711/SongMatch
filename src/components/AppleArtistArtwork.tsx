import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, type StyleProp, type ImageStyle, type ViewStyle, type TextStyle } from 'react-native';
import { Image } from 'expo-image';
import { resolveArtistArtwork } from '../api/musicKitService';

interface Props {
  name: string;
  style?: StyleProp<ImageStyle>;
  /** Font size for the fallback initial; defaults to a mid size. */
  initialSize?: number;
}

/**
 * Licensed Apple Music artist image, resolved by name (cached). Never renders a
 * Deezer image — when Apple has no artist match it shows a generated
 * initial-avatar (first letter of the name).
 */
export default function AppleArtistArtwork({ name, style, initialSize = 18 }: Props) {
  const [uri, setUri] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    resolveArtistArtwork(name)
      .then((u) => { if (alive) setUri(u); })
      .catch(() => {});
    return () => { alive = false; };
  }, [name]);

  if (uri) {
    return <Image source={{ uri }} style={style} contentFit="cover" cachePolicy="disk" transition={120} />;
  }

  const initial = (name?.trim()?.[0] ?? '?').toUpperCase();
  return (
    <View style={[style as StyleProp<ViewStyle>, styles.fallback]}>
      <Text style={[styles.initial, { fontSize: initialSize } as TextStyle]}>{initial}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  fallback: { backgroundColor: '#2A2A38', alignItems: 'center', justifyContent: 'center' },
  initial: { color: '#fff', fontWeight: '800' },
});
