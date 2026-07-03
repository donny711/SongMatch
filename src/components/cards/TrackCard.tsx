import React, { useRef, useEffect } from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import { Image } from 'expo-image';
import Svg, { Defs, LinearGradient as SvgGradient, Stop, Rect } from 'react-native-svg';
import SnippetPlayer from './SnippetPlayer';
import type { RecommendationCard } from '../../api/types';
import { COLORS } from '../../theme';
import { useTutorialMeasure } from '../tutorial/TutorialMeasureContext';

const { width, height } = Dimensions.get('window');
const CARD_WIDTH = width - 32;
const CARD_HEIGHT = height * 0.64;

interface Props {
  card: RecommendationCard;
  isTop?: boolean;
}

export default function TrackCard({ card, isTop = false }: Props) {
  const cardRef = useRef<View>(null);
  const audioRef = useRef<View>(null);
  const { register } = useTutorialMeasure();
  useEffect(() => {
    if (isTop) {
      register('swipe-card', cardRef);
      register('audio-player', audioRef);
    }
  }, [isTop, register]);

  const track = card.track;
  const duration = track.duration ?? 0;
  const mins = Math.floor(duration / 60);
  const secs = String(duration % 60).padStart(2, '0');

  return (
    // collapsable=false: measured by the tutorial — Fabric view flattening
    // makes measureInWindow return zeros for optimized-away views
    <View ref={cardRef} style={styles.card} collapsable={false}>
      {/* Full-bleed album art — licensed Apple Music artwork only; never the
          unlicensed Deezer cover. Unmatched tracks show the placeholder. */}
      {track.artworkUrl ? (
        <Image
          source={{ uri: track.artworkUrl }}
          style={styles.albumArt}
          contentFit="cover"
          transition={120}
          cachePolicy="disk"
        />
      ) : (
        <View style={[styles.albumArt, styles.albumArtFallback]} />
      )}

      {/* Gradient overlay — top transparent → bottom rich purple-dark */}
      <Svg style={StyleSheet.absoluteFill} width={CARD_WIDTH} height={CARD_HEIGHT}>
        <Defs>
          <SvgGradient id="grad" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0.25" stopColor="#000" stopOpacity="0" />
            <Stop offset="0.60" stopColor="#1F1F28" stopOpacity="0.55" />
            <Stop offset="0.80" stopColor="#0D0D0D" stopOpacity="0.82" />
            <Stop offset="1"   stopColor="#0D0D0D" stopOpacity="0.97" />
          </SvgGradient>
        </Defs>
        <Rect x="0" y="0" width={CARD_WIDTH} height={CARD_HEIGHT} fill="url(#grad)" />
      </Svg>

      {/* Frosted info bar pinned to bottom */}
      <View style={styles.info}>
        <Text style={styles.title} numberOfLines={2}>{track.title}</Text>
        <Text style={styles.artist} numberOfLines={1}>{track.artist.name}</Text>
        <Text style={styles.album} numberOfLines={1}>
          {track.album.title} · {mins}:{secs}
        </Text>
        <View ref={audioRef} collapsable={false}>
          <SnippetPlayer previewUrl={track.preview} autoPlay={isTop} />
        </View>
        {/* API ToS require visible attribution where the content appears */}
        <Text style={styles.attribution}>Audio preview by Deezer</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    borderRadius: 28,
    backgroundColor: COLORS.surface,
    overflow: 'hidden',
    alignSelf: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.65,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 14 },
    elevation: 16,
  },
  albumArt: {
    ...StyleSheet.absoluteFillObject,
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
  },
  albumArtFallback: {
    backgroundColor: '#1F1F28',
  },
  info: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 20,
    paddingBottom: 18,
    gap: 5,
    backgroundColor: 'rgba(13,13,13,0.65)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(167,139,250,0.14)',
  },
  title: {
    color: '#fff',
    fontSize: 25,
    fontWeight: '800',
    letterSpacing: -0.4,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
  },
  artist: {
    color: COLORS.cyan,
    fontSize: 16,
    fontWeight: '700',
    textShadowColor: 'rgba(0,0,0,0.4)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  album: {
    color: '#6B7280',
    fontSize: 13,
    marginBottom: 4,
  },
  attribution: {
    color: 'rgba(107,114,128,0.7)',
    fontSize: 9,
    marginTop: 6,
  },
});
