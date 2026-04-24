import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { doc, getDoc } from 'firebase/firestore';
import { searchDeezer } from '../src/api/deezerClient';
import { getArtistSimilar, getArtistTopTracks } from '../src/api/lastfmClient';
import { getRecommendationsForSeeds } from '../src/api/endpoints';
import { useDeckStore } from '../src/store/deckStore';
import { COLORS, SPACING, RADIUS } from '../src/theme';
import GradientText from '../src/components/GradientText';
import { GENRE_ARTISTS, GENRE_COLORS, GENRES } from '../src/utils/genres';
import type { DeezerTrack } from '../src/api/types';
import { db, auth } from '../src/firebase/config';
import { recordReferralInstall, recordAffiliateInstall } from '../src/firebase/referralService';

export const ONBOARDING_KEY = 'sm_onboarding_complete';
export const ONBOARDING_GENRES_KEY = 'sm_onboarding_genres';

type Step = 'genres' | 'song' | 'referral' | 'loading';

export default function OnboardingScreen() {
  const insets = useSafeAreaInsets();
  const { appendQueue } = useDeckStore();

  const [step, setStep] = useState<Step>('genres');
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResult, setSearchResult] = useState<DeezerTrack | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchEmpty, setSearchEmpty] = useState(false);
  const [selectedSong, setSelectedSong] = useState<DeezerTrack | null>(null);
  const [referralInput, setReferralInput] = useState('');
  const [verifyStatus, setVerifyStatus] = useState<'idle' | 'checking' | 'valid' | 'invalid'>('idle');
  const [codeType, setCodeType] = useState<'referral' | 'affiliate' | null>(null);

  const toggleGenre = (g: string) =>
    setSelectedGenres((prev) =>
      prev.includes(g) ? prev.filter((x) => x !== g) : [...prev, g]
    );

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    setSearchResult(null);
    setSearchEmpty(false);
    try {
      const tracks = await searchDeezer(searchQuery, 1);
      if (tracks.length > 0) {
        setSearchResult(tracks[0]);
        setSearchEmpty(false);
      } else {
        setSearchResult(null);
        setSearchEmpty(true);
      }
    } catch {
      setSearchResult(null);
      setSearchEmpty(false);
    } finally {
      setSearching(false);
    }
  };

  const handleVerify = async () => {
    if (!referralInput.trim()) return;
    setVerifyStatus('checking');
    try {
      const code = referralInput.trim().toUpperCase();
      const referralSnap = await getDoc(doc(db, 'referrals', code));
      if (referralSnap.exists()) {
        setCodeType('referral');
        setVerifyStatus('valid');
        return;
      }
      const affiliateSnap = await getDoc(doc(db, 'affiliates', code));
      if (
        affiliateSnap.exists() &&
        (affiliateSnap.data() as { status: string }).status === 'active'
      ) {
        setCodeType('affiliate');
        setVerifyStatus('valid');
        return;
      }
      setCodeType(null);
      setVerifyStatus('invalid');
    } catch {
      setCodeType(null);
      setVerifyStatus('invalid');
    }
  };

  const goToReferral = (song: DeezerTrack | null) => {
    setSelectedSong(song);
    setStep('referral');
  };

  const finish = async (referralCode?: string) => {
    setStep('loading');

    const seeds: Array<{ name: string; artist: string }> = [];

    if (selectedSong) seeds.push({ name: selectedSong.title, artist: selectedSong.artist.name });

    await Promise.all(
      selectedGenres.slice(0, 3).map(async (genre) => {
        const reps = GENRE_ARTISTS[genre] ?? [];
        if (reps.length === 0) return;
        const rep = reps[Math.floor(Math.random() * reps.length)];
        const similar = await getArtistSimilar(rep, 10);
        const pick =
          similar.length > 0
            ? similar[Math.floor(Math.random() * Math.min(similar.length, 6))]
            : rep;
        const tops = await getArtistTopTracks(pick, 5);
        if (tops.length > 0)
          seeds.push(tops[Math.floor(Math.random() * tops.length)]);
      })
    );

    if (seeds.length > 0) {
      try {
        const cards = await getRecommendationsForSeeds(seeds, 20, new Set());
        if (cards.length > 0) appendQueue(cards);
      } catch {
        // silent
      }
    }

    await AsyncStorage.setItem(ONBOARDING_GENRES_KEY, JSON.stringify(selectedGenres));
    await AsyncStorage.setItem(ONBOARDING_KEY, '1');

    if (referralCode) {
      const uid = auth.currentUser?.uid;
      if (uid) {
        if (codeType === 'affiliate') {
          recordAffiliateInstall(uid, referralCode);
        } else {
          recordReferralInstall(uid, referralCode);
        }
      }
    }

    router.replace('/(tabs)/home');
  };

  // Genres step
  if (step === 'genres') {
    return (
      <View style={[styles.root, { paddingTop: insets.top + SPACING.lg }]}>
        <View style={styles.header}>
          <GradientText fontSize={22} hPad={24} letterSpacing={-0.5}>SongMatch</GradientText>
          <View style={styles.stepRow}>
            <View style={[styles.dot, styles.dotActive]} />
            <View style={styles.dot} />
            <View style={styles.dot} />
          </View>
        </View>

        <GradientText fontSize={30} hPad={24} letterSpacing={-0.5}>What's your vibe?</GradientText>
        <Text style={styles.sub}>Pick the genres you love (at least one)</Text>

        <ScrollView
          contentContainerStyle={styles.chipGrid}
          showsVerticalScrollIndicator={false}
        >
          {GENRES.map((g) => {
            const on = selectedGenres.includes(g);
            const color = GENRE_COLORS[g] ?? COLORS.purple;
            return (
              <TouchableOpacity
                key={g}
                style={[
                  styles.chip,
                  on
                    ? { backgroundColor: color, borderColor: color, shadowColor: color }
                    : { borderColor: `${color}55` },
                ]}
                onPress={() => toggleGenre(g)}
                activeOpacity={0.75}
              >
                <Text style={[styles.chipText, on && styles.chipTextOn]}>{g}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        <View style={[styles.footer, { paddingBottom: insets.bottom + SPACING.lg }]}>
          <TouchableOpacity
            style={[styles.primaryBtn, selectedGenres.length === 0 && styles.btnDisabled]}
            onPress={() => setStep('song')}
            disabled={selectedGenres.length === 0}
            activeOpacity={0.85}
          >
            <Text style={styles.primaryBtnText}>Continue</Text>
            <Ionicons name="arrow-forward" size={18} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // Song step
  if (step === 'song') {
    return (
      <View style={[styles.root, { paddingTop: insets.top + SPACING.lg }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => setStep('genres')} hitSlop={12} activeOpacity={0.7}>
            <Ionicons name="arrow-back" size={22} color={COLORS.textMuted} />
          </TouchableOpacity>
          <View style={styles.stepRow}>
            <View style={styles.dot} />
            <View style={[styles.dot, styles.dotActive]} />
            <View style={styles.dot} />
          </View>
        </View>

        <GradientText fontSize={30} hPad={24} letterSpacing={-0.5}>Got a favourite song?</GradientText>
        <Text style={styles.sub}>
          We'll find you songs with the same energy. You can skip this.
        </Text>

        <View style={styles.searchRow}>
          <View style={styles.inputWrap}>
            <Ionicons name="search-outline" size={18} color={COLORS.textMuted} style={{ marginRight: SPACING.sm }} />
            <TextInput
              style={styles.input}
              placeholder="Song name or artist..."
              placeholderTextColor={COLORS.textMuted}
              value={searchQuery}
              onChangeText={setSearchQuery}
              onSubmitEditing={handleSearch}
              returnKeyType="search"
              keyboardAppearance="dark"
            />
          </View>
          <TouchableOpacity
            style={[styles.searchBtn, !searchQuery.trim() && styles.btnDisabled]}
            onPress={handleSearch}
            disabled={!searchQuery.trim()}
            activeOpacity={0.85}
          >
            <Ionicons name="arrow-forward" size={20} color="#fff" />
          </TouchableOpacity>
        </View>

        {searching && (
          <ActivityIndicator color={COLORS.purple} style={{ marginTop: SPACING.lg }} />
        )}

        {searchEmpty && !searching && (
          <Text style={styles.noResultsText}>No results — try another track name</Text>
        )}

        {searchResult && !searching && (
          <View style={styles.resultCard}>
            <Image source={{ uri: searchResult.album.cover_xl }} style={styles.resultArt} />
            <View style={styles.resultInfo}>
              <Text style={styles.resultTitle} numberOfLines={1}>{searchResult.title}</Text>
              <Text style={styles.resultArtist} numberOfLines={1}>{searchResult.artist.name}</Text>
            </View>
            <TouchableOpacity
              style={styles.useBtn}
              onPress={() => goToReferral(searchResult)}
              activeOpacity={0.85}
            >
              <Ionicons name="checkmark" size={18} color="#fff" />
            </TouchableOpacity>
          </View>
        )}

        <View style={[styles.footer, { paddingBottom: insets.bottom + SPACING.lg }]}>
          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={() => goToReferral(searchResult)}
            activeOpacity={0.85}
          >
            <Ionicons name="sparkles" size={18} color="#fff" />
            <Text style={styles.primaryBtnText}>
              {searchResult ? 'Use this song' : 'Start Discovering'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => goToReferral(null)} style={styles.skipBtn} activeOpacity={0.7}>
            <Text style={styles.skipText}>Skip</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // Referral step
  if (step === 'referral') {
    return (
      <View style={[styles.root, { paddingTop: insets.top + SPACING.lg }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => setStep('song')} hitSlop={12} activeOpacity={0.7}>
            <Ionicons name="arrow-back" size={22} color={COLORS.textMuted} />
          </TouchableOpacity>
          <View style={styles.stepRow}>
            <View style={styles.dot} />
            <View style={styles.dot} />
            <View style={[styles.dot, styles.dotActive]} />
          </View>
        </View>

        <GradientText fontSize={30} hPad={24} letterSpacing={-0.5}>Got an invite code?</GradientText>
        <Text style={styles.sub}>
          Optional - enter a friend's referral code to join their squad.
        </Text>

        <View style={styles.searchRow}>
          <View style={styles.inputWrap}>
            <Ionicons name="ticket-outline" size={18} color={COLORS.textMuted} style={{ marginRight: SPACING.sm }} />
            <TextInput
              style={[styles.input, { letterSpacing: 2 }]}
              placeholder="e.g. K7F2A4B3"
              placeholderTextColor={COLORS.textMuted}
              value={referralInput}
              onChangeText={(t) => {
                setReferralInput(t.toUpperCase());
                setVerifyStatus('idle');
              }}
              maxLength={8}
              autoCapitalize="characters"
              autoCorrect={false}
              returnKeyType="done"
              keyboardAppearance="dark"
            />
          </View>
          <TouchableOpacity
            style={[styles.searchBtn, !referralInput.trim() && styles.btnDisabled]}
            onPress={handleVerify}
            disabled={!referralInput.trim() || verifyStatus === 'checking'}
            activeOpacity={0.85}
          >
            {verifyStatus === 'checking'
              ? <ActivityIndicator color="#fff" size="small" />
              : <Ionicons name="arrow-forward" size={20} color="#fff" />}
          </TouchableOpacity>
        </View>

        {verifyStatus === 'valid' && (
          <Text style={[styles.feedbackText, { color: COLORS.green }]}>
            {codeType === 'affiliate' ? 'Creator code verified!' : "Code verified! You'll join their squad"}
          </Text>
        )}
        {verifyStatus === 'invalid' && (
          <Text style={[styles.feedbackText, { color: '#F87171' }]}>Code not found</Text>
        )}

        <View style={[styles.footer, { paddingBottom: insets.bottom + SPACING.lg, marginTop: SPACING.xl }]}>
          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={() => finish(verifyStatus === 'valid' ? referralInput : undefined)}
            activeOpacity={0.85}
          >
            <Ionicons name="sparkles" size={18} color="#fff" />
            <Text style={styles.primaryBtnText}>Start Discovering</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => finish(undefined)} style={styles.skipBtn} activeOpacity={0.7}>
            <Text style={styles.skipText}>Skip</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // Loading step
  return (
    <View style={[styles.root, styles.centered]}>
      <View style={styles.loadingIconWrap}>
        <ActivityIndicator color={COLORS.purple} size="large" />
      </View>
      <Text style={styles.loadingTitle}>Building your taste profile...</Text>
      <Text style={styles.loadingSub}>This only takes a moment</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: COLORS.bg,
    paddingHorizontal: SPACING.lg,
  },
  centered: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.xl,
  },
  stepRow: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.border,
  },
  dotActive: {
    backgroundColor: COLORS.purple,
    width: 24,
    borderRadius: 4,
  },
  sub: {
    color: COLORS.textSub,
    fontSize: 15,
    lineHeight: 22,
    marginBottom: SPACING.xl,
  },
  chipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
    paddingBottom: SPACING.xxl,
  },
  chip: {
    paddingHorizontal: SPACING.md,
    paddingVertical: 10,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.surface,
    borderWidth: 1.5,
    shadowOpacity: 0,
    shadowRadius: 0,
    shadowOffset: { width: 0, height: 0 },
    elevation: 0,
  },
  chipText: {
    color: COLORS.textSub,
    fontSize: 14,
    fontWeight: '600',
  },
  chipTextOn: {
    color: '#fff',
    fontWeight: '700',
  },
  footer: {
    gap: SPACING.sm,
    paddingTop: SPACING.md,
  },
  primaryBtn: {
    backgroundColor: COLORS.purple,
    paddingVertical: 16,
    borderRadius: RADIUS.full,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    shadowColor: COLORS.purple,
    shadowOpacity: 0.5,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 4 },
    elevation: 10,
  },
  primaryBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  btnDisabled: {
    opacity: 0.35,
  },
  skipBtn: {
    alignItems: 'center',
    paddingVertical: SPACING.sm,
  },
  skipText: {
    color: COLORS.textMuted,
    fontSize: 14,
  },
  searchRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginBottom: SPACING.lg,
  },
  inputWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: SPACING.md,
  },
  input: {
    flex: 1,
    color: COLORS.text,
    paddingVertical: 14,
    fontSize: 15,
  },
  searchBtn: {
    width: 52,
    backgroundColor: COLORS.purple,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: COLORS.purple,
    shadowOpacity: 0.45,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 8,
  },
  resultCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    gap: SPACING.md,
    borderWidth: 1.5,
    borderColor: 'rgba(167,139,250,0.35)',
    marginBottom: SPACING.lg,
  },
  resultArt: {
    width: 52,
    height: 52,
    borderRadius: RADIUS.sm,
    backgroundColor: COLORS.border,
  },
  resultInfo: { flex: 1 },
  resultTitle: { color: COLORS.text, fontSize: 15, fontWeight: '700' },
  resultArtist: { color: COLORS.cyan, fontSize: 13, marginTop: 2, fontWeight: '500' },
  useBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.green,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: COLORS.green,
    shadowOpacity: 0.5,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 6,
  },
  feedbackText: {
    fontSize: 13,
    fontWeight: '600',
    marginTop: -SPACING.sm,
    marginBottom: SPACING.sm,
  },
  loadingIconWrap: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: 'rgba(167,139,250,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(167,139,250,0.28)',
    marginBottom: SPACING.sm,
  },
  loadingTitle: {
    color: COLORS.text,
    fontSize: 22,
    fontWeight: '800',
  },
  loadingSub: {
    color: COLORS.textMuted,
    fontSize: 14,
  },
  noResultsText: {
    color: COLORS.textMuted,
    fontSize: 14,
    textAlign: 'center',
    marginTop: SPACING.md,
    marginBottom: SPACING.sm,
  },
});
