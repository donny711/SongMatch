import React, { useState, useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, TextInput, ActivityIndicator, Image, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { doc, getDoc } from 'firebase/firestore';
import Animated, { useSharedValue, useAnimatedStyle, withSpring, withDelay, withTiming, withRepeat, withSequence, Easing } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { searchDeezer } from '../src/api/deezerClient';
import { getArtistSimilar, getArtistTopTracks } from '../src/api/lastfmClient';
import { getRecommendationsForSeeds } from '../src/api/endpoints';
import { useDeckStore } from '../src/store/deckStore';
import { useProfileStore } from '../src/store/profileStore';
import { useTutorialStore } from '../src/store/tutorialStore';
import { useSettingsStore } from '../src/store/settingsStore';
import { primeNotificationPermission } from '../src/notifications/notificationService';
import { syncReengagementNotifications } from '../src/notifications/coordinator';
import { COLORS, SPACING, RADIUS } from '../src/theme';
import GradientText from '../src/components/GradientText';
import AppleArtwork from '../src/components/AppleArtwork';
import { GENRE_ARTISTS, GENRE_COLORS, GENRES } from '../src/utils/genres';
import type { DeezerTrack } from '../src/api/types';
import { db, auth } from '../src/firebase/config';
import { recordReferralInstall, recordAffiliateInstall } from '../src/firebase/referralService';
import { signUpWithEmail, logInWithEmail, resetPassword, checkUsernameAvailable } from '../src/firebase/authService';
import { validateUsername } from '../src/utils/profanityFilter';

export const ONBOARDING_KEY = 'sm_onboarding_complete';
export const ONBOARDING_GENRES_KEY = 'sm_onboarding_genres';

type Step = 'auth' | 'genres' | 'song' | 'referral' | 'loading' | 'streak';
type AuthTab = 'signup' | 'login';

export default function OnboardingScreen() {
  const insets = useSafeAreaInsets();
  const { appendQueue } = useDeckStore();
  const [step, setStep] = useState<Step>('auth');
  const [authTab, setAuthTab] = useState<AuthTab>('signup');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState('');
  const [usernameError, setUsernameError] = useState('');
  const [usernameChecking, setUsernameChecking] = useState(false);
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null);
  const usernameTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResult, setSearchResult] = useState<DeezerTrack | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchEmpty, setSearchEmpty] = useState(false);
  const [selectedSong, setSelectedSong] = useState<DeezerTrack | null>(null);
  const [favoriteArtists, setFavoriteArtists] = useState<Array<{ name: string; picture: string }>>([]);
  const [artistQuery, setArtistQuery] = useState('');
  const [artistSearching, setArtistSearching] = useState(false);
  const [artistResults, setArtistResults] = useState<Array<{ name: string; picture: string }>>([]);
  const [referralInput, setReferralInput] = useState('');
  const [verifyStatus, setVerifyStatus] = useState<'idle' | 'checking' | 'valid' | 'invalid'>('idle');
  const [codeType, setCodeType] = useState<'referral' | 'affiliate' | null>(null);
  const [streakCount, setStreakCount] = useState(1);
  const [isNewSignUp, setIsNewSignUp] = useState(false);
  const flameScale = useSharedValue(1);
  const contentOpacity = useSharedValue(0);
  const contentScale = useSharedValue(0.86);
  const numY = useSharedValue(0);
  const NUM_H = 90;

  const toggleGenre = (g: string) => setSelectedGenres((prev) => prev.includes(g) ? prev.filter((x) => x !== g) : [...prev, g]);

  const handleUsernameChange = (text: string) => {
    setUsername(text); setUsernameAvailable(null); setUsernameError('');
    if (usernameTimer.current) clearTimeout(usernameTimer.current);
    const validationError = validateUsername(text);
    if (validationError) { setUsernameError(validationError); return; }
    setUsernameChecking(true);
    usernameTimer.current = setTimeout(async () => {
      try { const available = await checkUsernameAvailable(text); setUsernameAvailable(available); if (!available) setUsernameError('Username already taken'); }
      catch { setUsernameError('Could not check availability'); }
      finally { setUsernameChecking(false); }
    }, 500);
  };

  const handleSignUp = async () => {
    setAuthError('');
    if (!email.trim() || !password.trim() || !username.trim()) { setAuthError('Please fill in all fields'); return; }
    const vErr = validateUsername(username); if (vErr) { setUsernameError(vErr); return; }
    if (password.length < 6) { setAuthError('Password must be at least 6 characters'); return; }
    setAuthLoading(true);
    try { await signUpWithEmail(email.trim(), password, username.trim()); await useProfileStore.getState().initialize(); setIsNewSignUp(true); setStep('genres'); }
    catch (e: any) { const m = e?.message || 'Something went wrong'; if (m.includes('email-already-in-use')) setAuthError('An account with this email already exists'); else if (m.includes('Username already taken')) setUsernameError('Username already taken'); else if (m.includes('invalid-email')) setAuthError('Please enter a valid email address'); else setAuthError(m); }
    finally { setAuthLoading(false); }
  };

  const handleLogIn = async () => {
    setAuthError('');
    if (!email.trim() || !password.trim()) { setAuthError('Please fill in all fields'); return; }
    setAuthLoading(true);
    try {
      await logInWithEmail(email.trim(), password);
      await useProfileStore.getState().initialize();
      await useProfileStore.getState().checkAndUpdateStreak();
      const streak = useProfileStore.getState().currentStreak;
      const streakAnim = useProfileStore.getState().streakAnimFrom;
      await AsyncStorage.setItem(ONBOARDING_KEY, '1');
      if (streakAnim !== null && streak > streakAnim) { setStreakCount(streak); setStep('streak'); }
      else { router.replace('/(tabs)/home'); }
    } catch (e: any) { const m = e?.message || 'Something went wrong'; if (m.includes('wrong-password') || m.includes('invalid-credential')) setAuthError('Incorrect password'); else if (m.includes('user-not-found')) setAuthError('No account found with that email'); else if (m.includes('Username not found')) setAuthError('Username not found'); else if (m.includes('invalid-email')) setAuthError('Please enter a valid email address'); else setAuthError(m); }
    finally { setAuthLoading(false); }
  };

  const handleForgotPassword = () => {
    Alert.prompt('Reset Password', 'Enter your email address', async (input) => {
      if (!input?.trim()) return;
      try { await resetPassword(input.trim()); Alert.alert('Check your email', 'A password reset link has been sent.'); }
      catch (e: any) { Alert.alert('Error', e?.message || 'Could not send reset email'); }
    }, 'plain-text', '', 'email-address');
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setSearching(true); setSearchResult(null); setSearchEmpty(false);
    try { const tracks = await searchDeezer(searchQuery, 1); if (tracks.length > 0) setSearchResult(tracks[0]); else setSearchEmpty(true); }
    catch { setSearchResult(null); }
    finally { setSearching(false); }
  };

  const handleArtistSearch = async () => {
    if (!artistQuery.trim()) return;
    setArtistSearching(true); setArtistResults([]);
    try {
      const tracks = await searchDeezer(artistQuery, 5);
      const seen = new Set<string>();
      const artists: Array<{ name: string; picture: string }> = [];
      for (const t of tracks) {
        const key = t.artist.name.toLowerCase();
        if (!seen.has(key) && !favoriteArtists.some(a => a.name.toLowerCase() === key)) {
          seen.add(key);
          artists.push({ name: t.artist.name, picture: (t.artist as any).picture_xl ?? (t.artist as any).picture ?? '' });
        }
      }
      setArtistResults(artists);
    } catch {}
    finally { setArtistSearching(false); }
  };

  const addArtist = (artist: { name: string; picture: string }) => {
    if (favoriteArtists.length >= 5) return;
    setFavoriteArtists(prev => [...prev, artist]);
    setArtistResults([]);
    setArtistQuery('');
  };

  const removeArtist = (name: string) => {
    setFavoriteArtists(prev => prev.filter(a => a.name !== name));
  };

  const handleVerify = async () => {
    if (!referralInput.trim()) return;
    setVerifyStatus('checking');
    try {
      const code = referralInput.trim().toUpperCase();
      const referralSnap = await getDoc(doc(db, 'referrals', code));
      if (referralSnap.exists()) { setCodeType('referral'); setVerifyStatus('valid'); return; }
      const affiliateSnap = await getDoc(doc(db, 'affiliates', code));
      if (affiliateSnap.exists() && (affiliateSnap.data() as { status: string }).status === 'active') { setCodeType('affiliate'); setVerifyStatus('valid'); return; }
      setCodeType(null); setVerifyStatus('invalid');
    } catch { setCodeType(null); setVerifyStatus('invalid'); }
  };

  const goToReferral = (song: DeezerTrack | null) => { setSelectedSong(song); setStep('referral'); };

  const finish = async (referralCode?: string) => {
    setStep('loading');
    const seeds: Array<{ name: string; artist: string }> = [];
    if (selectedSong) seeds.push({ name: selectedSong.title, artist: selectedSong.artist.name });

    // Run all artist and genre lookups in parallel.
    // Each path collects both a Last.fm text seed (broad coverage via similarity graph)
    // and a Deezer track ID (direct audio-fingerprint radio seed — higher fidelity).
    const [artistRadioIds, genreRadioIds] = await Promise.all([
      Promise.all(favoriteArtists.map(async (a) => {
        const [tops, deezerTracks] = await Promise.all([
          getArtistTopTracks(a.name, 3).catch(() => [] as Array<{ name: string; artist: string }>),
          searchDeezer(a.name, 10).catch(() => [] as DeezerTrack[]),
        ]);
        if (tops.length > 0) seeds.push(tops[Math.floor(Math.random() * tops.length)]);
        const exactMatch = deezerTracks.find(t => t.artist.name.toLowerCase() === a.name.toLowerCase());
        return (exactMatch ?? deezerTracks[0])?.id ?? null;
      })),
      Promise.all(selectedGenres.slice(0, 3).map(async (genre) => {
        const reps = GENRE_ARTISTS[genre] ?? []; if (reps.length === 0) return null;
        const rep = reps[Math.floor(Math.random() * reps.length)];
        const [similar, deezerTracks] = await Promise.all([
          getArtistSimilar(rep, 10).catch(() => [] as string[]),
          searchDeezer(rep, 10).catch(() => [] as DeezerTrack[]),
        ]);
        const pick = similar.length > 0 ? similar[Math.floor(Math.random() * Math.min(similar.length, 6))] : rep;
        const tops = await getArtistTopTracks(pick, 5);
        if (tops.length > 0) seeds.push(tops[Math.floor(Math.random() * tops.length)]);
        const exactMatch = deezerTracks.find(t => t.artist.name.toLowerCase() === rep.toLowerCase());
        return (exactMatch ?? deezerTracks[0])?.id ?? null;
      })),
    ]);

    // Build Deezer radio seeds: selected song (most personal) → favourite artists → genre reps.
    // Capped at 4 (one API call each) so we don't slow down the loading screen.
    const deezerSeedIds: number[] = selectedSong ? [selectedSong.id] : [];
    for (const id of [...artistRadioIds, ...genreRadioIds]) {
      if (id && !deezerSeedIds.includes(id) && deezerSeedIds.length < 4) deezerSeedIds.push(id);
    }

    // Persist artist track IDs so ongoing feed can use them as radio seeds
    // in early sessions before liked history fills up.
    const artistTrackIds = artistRadioIds.filter((id): id is number => id !== null);
    useDeckStore.setState({
      onboardingSongId: selectedSong?.id ?? null,
      onboardingArtists: favoriteArtists.map(a => a.name),
      onboardingArtistTrackIds: artistTrackIds,
    });

    if (seeds.length > 0 || deezerSeedIds.length > 0) {
      try { const cards = await getRecommendationsForSeeds(seeds, 20, new Set(), new Set(), deezerSeedIds); if (cards.length > 0) appendQueue(cards); } catch {}
    }
    await AsyncStorage.setItem(ONBOARDING_GENRES_KEY, JSON.stringify(selectedGenres));
    if (selectedSong) await AsyncStorage.setItem('sm_onboarding_song_id', String(selectedSong.id));
    if (favoriteArtists.length > 0) await AsyncStorage.setItem('sm_onboarding_artists', JSON.stringify(favoriteArtists.map(a => a.name)));
    if (artistTrackIds.length > 0) await AsyncStorage.setItem('sm_onboarding_artist_track_ids', JSON.stringify(artistTrackIds));
    await AsyncStorage.setItem(ONBOARDING_KEY, '1');
    if (referralCode) { const uid = auth.currentUser?.uid; if (uid) { if (codeType === 'affiliate') recordAffiliateInstall(uid, referralCode).catch(() => {}); else recordReferralInstall(uid, referralCode).catch(() => {}); } }
    await useProfileStore.getState().checkAndUpdateStreak();
    const streak = useProfileStore.getState().currentStreak;
    setStreakCount(Math.max(streak, 1));
    setStep('streak');
  };

  useEffect(() => {
    if (step !== 'streak') return;
    contentOpacity.value = 0; contentScale.value = 0.86; flameScale.value = 1;
    contentOpacity.value = withDelay(60, withTiming(1, { duration: 340 }));
    contentScale.value = withDelay(60, withSpring(1, { damping: 13, stiffness: 170 }));
    flameScale.value = withDelay(500, withRepeat(withSequence(withTiming(0.9, { duration: 1000, easing: Easing.inOut(Easing.ease) }), withTiming(1.1, { duration: 1000, easing: Easing.inOut(Easing.ease) })), -1, false));
    numY.value = NUM_H;
    numY.value = withDelay(400, withSpring(0, { damping: 12, stiffness: 210 }));
  }, [step]);

  const streakContentStyle = useAnimatedStyle(() => ({ opacity: contentOpacity.value, transform: [{ scale: contentScale.value }] }));
  const streakFlameStyle = useAnimatedStyle(() => ({ transform: [{ scale: flameScale.value }] }));
  const streakNumStyle = useAnimatedStyle(() => ({ transform: [{ translateY: numY.value }] }));
  const TOTAL_STEPS = 5;
  const renderDots = (activeIdx: number) => (<View style={styles.stepRow}>{Array.from({ length: TOTAL_STEPS }, (_, i) => (<View key={i} style={[styles.dot, i === activeIdx && styles.dotActive]} />))}</View>);

  if (step === 'auth') {
    return (
      <KeyboardAvoidingView style={[styles.root, { paddingTop: insets.top + SPACING.lg }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={{ alignItems: 'center', marginBottom: SPACING.md }}>
          <GradientText fontSize={28} hPad={24} letterSpacing={-0.5}>SongMatch</GradientText>
        </View>
        <View style={styles.header}>
          <View />
          {renderDots(0)}
        </View>
        <GradientText fontSize={28} hPad={24} letterSpacing={-0.5}>{authTab === 'signup' ? 'Create your account' : 'Welcome back'}</GradientText>
        <View style={styles.tabRow}>
          <TouchableOpacity style={[styles.tab, authTab === 'signup' && styles.tabActive]} onPress={() => { setAuthTab('signup'); setAuthError(''); }} activeOpacity={0.7}>
            <Text style={[styles.tabText, authTab === 'signup' && styles.tabTextActive]}>Sign Up</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.tab, authTab === 'login' && styles.tabActive]} onPress={() => { setAuthTab('login'); setAuthError(''); }} activeOpacity={0.7}>
            <Text style={[styles.tabText, authTab === 'login' && styles.tabTextActive]}>Log In</Text>
          </TouchableOpacity>
        </View>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>
          <Text style={styles.fieldLabel}>{authTab === 'login' ? 'Email or Username' : 'Email'}</Text>
          <View style={styles.inputWrap}>
            <Ionicons name="mail-outline" size={18} color={COLORS.textMuted} style={{ marginRight: SPACING.sm }} />
            <TextInput style={styles.input} placeholder="your@email.com" placeholderTextColor={COLORS.textMuted} value={email} onChangeText={(t) => { setEmail(t); setAuthError(''); }} autoCapitalize="none" autoCorrect={false} keyboardType="email-address" keyboardAppearance="dark" />
          </View>
          <Text style={styles.fieldLabel}>Password</Text>
          <View style={styles.inputWrap}>
            <Ionicons name="lock-closed-outline" size={18} color={COLORS.textMuted} style={{ marginRight: SPACING.sm }} />
            <TextInput style={[styles.input, { flex: 1 }]} placeholder="••••••••" placeholderTextColor={COLORS.textMuted} value={password} onChangeText={(t) => { setPassword(t); setAuthError(''); }} secureTextEntry={!showPassword} autoCapitalize="none" autoCorrect={false} keyboardAppearance="dark" />
            <TouchableOpacity onPress={() => setShowPassword(!showPassword)} hitSlop={8}><Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color={COLORS.textMuted} /></TouchableOpacity>
          </View>
          {authTab === 'signup' && (<>
            <Text style={styles.fieldLabel}>Username</Text>
            <View style={styles.inputWrap}>
              <Ionicons name="at-outline" size={18} color={COLORS.textMuted} style={{ marginRight: SPACING.sm }} />
              <TextInput style={styles.input} placeholder="your_username" placeholderTextColor={COLORS.textMuted} value={username} onChangeText={handleUsernameChange} autoCapitalize="none" autoCorrect={false} maxLength={20} keyboardAppearance="dark" />
              {usernameChecking && <ActivityIndicator size="small" color={COLORS.purple} />}
              {!usernameChecking && usernameAvailable === true && !usernameError && <Ionicons name="checkmark-circle" size={20} color="#22C55E" />}
              {!usernameChecking && usernameAvailable === false && <Ionicons name="close-circle" size={20} color="#F87171" />}
            </View>
            <Text style={styles.fieldHint}>This is how others find you and how you log in</Text>
            {usernameError ? <Text style={styles.errorText}>{usernameError}</Text> : null}
          </>)}
          {authTab === 'login' && (<TouchableOpacity onPress={handleForgotPassword} style={{ marginTop: SPACING.sm }}><Text style={styles.forgotText}>Forgot password?</Text></TouchableOpacity>)}
          {authError ? (<View style={styles.errorBanner}><Ionicons name="alert-circle" size={16} color="#F87171" /><Text style={styles.errorBannerText}>{authError}</Text></View>) : null}
        </ScrollView>
        <View style={[styles.footer, { paddingBottom: insets.bottom + SPACING.lg }]}>
          <TouchableOpacity style={[styles.primaryBtn, authLoading && styles.btnDisabled]} onPress={authTab === 'signup' ? handleSignUp : handleLogIn} disabled={authLoading} activeOpacity={0.85}>
            {authLoading ? <ActivityIndicator color="#fff" size="small" /> : (<><Text style={styles.primaryBtnText}>{authTab === 'signup' ? 'Create Account' : 'Log In'}</Text><Ionicons name="arrow-forward" size={18} color="#fff" /></>)}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    );
  }

  if (step === 'genres') {
    return (
      <View style={[styles.root, { paddingTop: insets.top + SPACING.lg }]}>
        <View style={styles.header}><GradientText fontSize={22} hPad={24} letterSpacing={-0.5}>SongMatch</GradientText>{renderDots(1)}</View>
        <GradientText fontSize={30} hPad={24} letterSpacing={-0.5}>{"What's your vibe?"}</GradientText>
        <Text style={styles.sub}>Pick the genres you love (at least one)</Text>
        <ScrollView contentContainerStyle={styles.chipGrid} showsVerticalScrollIndicator={false}>
          {GENRES.map((g) => { const on = selectedGenres.includes(g); const color = GENRE_COLORS[g] ?? COLORS.purple; return (
            <TouchableOpacity key={g} style={[styles.chip, on ? { backgroundColor: color, borderColor: color, shadowColor: color } : { borderColor: `${color}55` }]} onPress={() => toggleGenre(g)} activeOpacity={0.75}><Text style={[styles.chipText, on && styles.chipTextOn]}>{g}</Text></TouchableOpacity>); })}
        </ScrollView>
        <View style={[styles.footer, { paddingBottom: insets.bottom + SPACING.lg }]}>
          <TouchableOpacity style={[styles.primaryBtn, selectedGenres.length === 0 && styles.btnDisabled]} onPress={() => setStep('song')} disabled={selectedGenres.length === 0} activeOpacity={0.85}><Text style={styles.primaryBtnText}>Continue</Text><Ionicons name="arrow-forward" size={18} color="#fff" /></TouchableOpacity>
        </View>
      </View>
    );
  }

  if (step === 'song') {
    return (
      <View style={[styles.root, { paddingTop: insets.top + SPACING.lg }]}>
        <View style={styles.header}><TouchableOpacity onPress={() => setStep('genres')} hitSlop={12} activeOpacity={0.7}><Ionicons name="arrow-back" size={22} color={COLORS.textMuted} /></TouchableOpacity>{renderDots(2)}</View>
        <GradientText fontSize={30} hPad={24} letterSpacing={-0.5}>Personalise your feed</GradientText>
        <Text style={styles.sub}>{"Add a favourite song and up to 5 artists. You can skip this."}</Text>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>
          <Text style={styles.fieldLabel}>Favourite Song</Text>
          <View style={styles.searchRow}>
            <View style={styles.inputWrap}><Ionicons name="search-outline" size={18} color={COLORS.textMuted} style={{ marginRight: SPACING.sm }} /><TextInput style={styles.input} placeholder="Song name or artist..." placeholderTextColor={COLORS.textMuted} value={searchQuery} onChangeText={setSearchQuery} onSubmitEditing={handleSearch} returnKeyType="search" keyboardAppearance="dark" /></View>
            <TouchableOpacity style={[styles.searchBtn, !searchQuery.trim() && styles.btnDisabled]} onPress={handleSearch} disabled={!searchQuery.trim()} activeOpacity={0.85}><Ionicons name="arrow-forward" size={20} color="#fff" /></TouchableOpacity>
          </View>
          {searching && <ActivityIndicator color={COLORS.purple} style={{ marginTop: SPACING.sm }} />}
          {searchEmpty && !searching && <Text style={styles.noResultsText}>No results - try another track name</Text>}
          {searchResult && !searching && (
            <View style={styles.resultCard}><AppleArtwork track={searchResult} style={styles.resultArt} /><View style={styles.resultInfo}><Text style={styles.resultTitle} numberOfLines={1}>{searchResult.title}</Text><Text style={styles.resultArtist} numberOfLines={1}>{searchResult.artist.name}</Text></View><TouchableOpacity style={styles.useBtn} onPress={() => { setSelectedSong(searchResult); setSearchResult(null); setSearchQuery(''); }} activeOpacity={0.85}><Ionicons name="checkmark" size={18} color="#fff" /></TouchableOpacity></View>
          )}
          {selectedSong && !searchResult && (
            <View style={styles.resultCard}><AppleArtwork track={selectedSong} style={styles.resultArt} /><View style={styles.resultInfo}><Text style={styles.resultTitle} numberOfLines={1}>{selectedSong.title}</Text><Text style={styles.resultArtist} numberOfLines={1}>{selectedSong.artist.name}</Text></View><TouchableOpacity onPress={() => setSelectedSong(null)} hitSlop={8}><Ionicons name="close-circle" size={22} color={COLORS.textMuted} /></TouchableOpacity></View>
          )}
          <Text style={[styles.fieldLabel, { marginTop: SPACING.lg }]}>{"Favourite Artists "}<Text style={{ color: COLORS.textMuted, fontWeight: '400' }}>({favoriteArtists.length}/5)</Text></Text>
          {favoriteArtists.length < 5 && (
            <View style={styles.searchRow}>
              <View style={styles.inputWrap}><Ionicons name="person-outline" size={18} color={COLORS.textMuted} style={{ marginRight: SPACING.sm }} /><TextInput style={styles.input} placeholder="Search for an artist..." placeholderTextColor={COLORS.textMuted} value={artistQuery} onChangeText={setArtistQuery} onSubmitEditing={handleArtistSearch} returnKeyType="search" keyboardAppearance="dark" /></View>
              <TouchableOpacity style={[styles.searchBtn, !artistQuery.trim() && styles.btnDisabled]} onPress={handleArtistSearch} disabled={!artistQuery.trim()} activeOpacity={0.85}><Ionicons name="arrow-forward" size={20} color="#fff" /></TouchableOpacity>
            </View>
          )}
          {artistSearching && <ActivityIndicator color={COLORS.purple} style={{ marginTop: SPACING.sm }} />}
          {artistResults.length > 0 && (
            <View style={{ gap: 4, marginBottom: SPACING.sm }}>
              {artistResults.map((a) => (
                <TouchableOpacity key={a.name} style={styles.artistResultRow} onPress={() => addArtist(a)} activeOpacity={0.75}>
                  {a.picture ? <Image source={{ uri: a.picture }} style={styles.artistThumb} /> : <View style={[styles.artistThumb, { backgroundColor: COLORS.border }]} />}
                  <Text style={styles.artistResultName} numberOfLines={1}>{a.name}</Text>
                  <Ionicons name="add-circle" size={22} color={COLORS.green} />
                </TouchableOpacity>
              ))}
            </View>
          )}
          {favoriteArtists.length > 0 && (
            <View style={{ gap: 6, marginTop: SPACING.sm }}>
              {favoriteArtists.map((a) => (
                <View key={a.name} style={styles.artistChip}>
                  {a.picture ? <Image source={{ uri: a.picture }} style={styles.artistChipImg} /> : <View style={[styles.artistChipImg, { backgroundColor: COLORS.border }]} />}
                  <Text style={styles.artistChipName} numberOfLines={1}>{a.name}</Text>
                  <TouchableOpacity onPress={() => removeArtist(a.name)} hitSlop={8}><Ionicons name="close-circle" size={20} color={COLORS.textMuted} /></TouchableOpacity>
                </View>
              ))}
            </View>
          )}
        </ScrollView>
        <View style={[styles.footer, { paddingBottom: insets.bottom + SPACING.lg }]}>
          <TouchableOpacity style={styles.primaryBtn} onPress={() => goToReferral(selectedSong)} activeOpacity={0.85}><Ionicons name="sparkles" size={18} color="#fff" /><Text style={styles.primaryBtnText}>{selectedSong || favoriteArtists.length > 0 ? 'Continue' : 'Start Discovering'}</Text></TouchableOpacity>
          <TouchableOpacity onPress={() => goToReferral(null)} style={styles.skipBtn} activeOpacity={0.7}><Text style={styles.skipText}>Skip</Text></TouchableOpacity>
        </View>
      </View>
    );
  }

  if (step === 'referral') {
    return (
      <View style={[styles.root, { paddingTop: insets.top + SPACING.lg }]}>
        <View style={styles.header}><TouchableOpacity onPress={() => setStep('song')} hitSlop={12} activeOpacity={0.7}><Ionicons name="arrow-back" size={22} color={COLORS.textMuted} /></TouchableOpacity>{renderDots(3)}</View>
        <GradientText fontSize={30} hPad={24} letterSpacing={-0.5}>Got an invite code?</GradientText>
        <Text style={styles.sub}>{"Optional - enter a friend's referral code to join their squad."}</Text>
        <View style={styles.searchRow}>
          <View style={styles.inputWrap}><Ionicons name="ticket-outline" size={18} color={COLORS.textMuted} style={{ marginRight: SPACING.sm }} /><TextInput style={[styles.input, { letterSpacing: 2 }]} placeholder="e.g. K7F2A4B3" placeholderTextColor={COLORS.textMuted} value={referralInput} onChangeText={(t) => { setReferralInput(t.toUpperCase()); setVerifyStatus('idle'); }} maxLength={8} autoCapitalize="characters" autoCorrect={false} returnKeyType="done" keyboardAppearance="dark" /></View>
          <TouchableOpacity style={[styles.searchBtn, !referralInput.trim() && styles.btnDisabled]} onPress={handleVerify} disabled={!referralInput.trim() || verifyStatus === 'checking'} activeOpacity={0.85}>{verifyStatus === 'checking' ? <ActivityIndicator color="#fff" size="small" /> : <Ionicons name="arrow-forward" size={20} color="#fff" />}</TouchableOpacity>
        </View>
        {verifyStatus === 'valid' && <Text style={[styles.feedbackText, { color: COLORS.green }]}>{codeType === 'affiliate' ? 'Creator code verified!' : "Code verified! You'll join their squad"}</Text>}
        {verifyStatus === 'invalid' && <Text style={[styles.feedbackText, { color: '#F87171' }]}>Code not found</Text>}
        <View style={[styles.footer, { paddingBottom: insets.bottom + SPACING.lg, marginTop: SPACING.xl }]}>
          <TouchableOpacity style={styles.primaryBtn} onPress={() => finish(verifyStatus === 'valid' ? referralInput : undefined)} activeOpacity={0.85}><Ionicons name="sparkles" size={18} color="#fff" /><Text style={styles.primaryBtnText}>Start Discovering</Text></TouchableOpacity>
          <TouchableOpacity onPress={() => finish(undefined)} style={styles.skipBtn} activeOpacity={0.7}><Text style={styles.skipText}>Skip</Text></TouchableOpacity>
        </View>
      </View>
    );
  }

  if (step === 'streak') {
    return (
      <View style={StyleSheet.absoluteFill}>
        <LinearGradient colors={['#0D0D0D', '#1E0A3C', '#0D0D0D']} locations={[0, 0.5, 1]} style={StyleSheet.absoluteFill} />
        <Animated.View style={[styles.streakContent, streakContentStyle]}>
          <View style={styles.flameGlow}><Animated.Text style={[styles.flameEmoji, streakFlameStyle]}>{String.fromCodePoint(0x1F525)}</Animated.Text></View>
          <View style={styles.numClip}><Animated.Text style={[styles.numText, streakNumStyle]}>{streakCount}</Animated.Text></View>
          <Text style={styles.streakLabel}>DAY STREAK</Text>
          <Text style={styles.taglineText}>{streakCount <= 1 ? 'Your streak begins!' : 'Welcome back!'}</Text>
        </Animated.View>
        <View style={[styles.streakBtnWrap, { bottom: insets.bottom + SPACING.xl }]}>
          <TouchableOpacity style={styles.primaryBtn} onPress={async () => { useProfileStore.getState().clearStreakAnim(); if (isNewSignUp) useTutorialStore.getState().prime(); const granted = await primeNotificationPermission(); if (granted) { useSettingsStore.getState().setNotificationsEnabled(true); syncReengagementNotifications(); } router.replace('/(tabs)/home'); }} activeOpacity={0.85}>
            <Text style={styles.primaryBtnText}>{"Let's Go"}</Text><Ionicons name="arrow-forward" size={18} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.root, styles.centered]}>
      <View style={styles.loadingIconWrap}><ActivityIndicator color={COLORS.purple} size="large" /></View>
      <Text style={styles.loadingTitle}>Building your taste profile...</Text>
      <Text style={styles.loadingSub}>This only takes a moment</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg, paddingHorizontal: SPACING.lg },
  centered: { alignItems: 'center', justifyContent: 'center', gap: SPACING.md },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: SPACING.xl },
  stepRow: { flexDirection: 'row', gap: 6, alignItems: 'center' },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.border },
  dotActive: { backgroundColor: COLORS.purple, width: 24, borderRadius: 4 },
  sub: { color: COLORS.textSub, fontSize: 15, lineHeight: 22, marginBottom: SPACING.xl },
  tabRow: { flexDirection: 'row', backgroundColor: COLORS.surface, borderRadius: RADIUS.md, padding: 4, marginBottom: SPACING.xl },
  tab: { flex: 1, paddingVertical: 12, borderRadius: RADIUS.sm, alignItems: 'center' },
  tabActive: { backgroundColor: COLORS.purple },
  tabText: { color: COLORS.textMuted, fontSize: 15, fontWeight: '600' },
  tabTextActive: { color: '#fff', fontWeight: '700' },
  fieldLabel: { color: COLORS.textSub, fontSize: 13, fontWeight: '600', marginBottom: 6, marginTop: SPACING.md },
  fieldHint: { color: COLORS.textMuted, fontSize: 12, marginTop: 4 },
  forgotText: { color: COLORS.purple, fontSize: 14, fontWeight: '600' },
  errorText: { color: '#F87171', fontSize: 12, marginTop: 4 },
  errorBanner: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, backgroundColor: 'rgba(248,113,113,0.12)', borderRadius: RADIUS.sm, padding: SPACING.md, marginTop: SPACING.lg },
  errorBannerText: { color: '#F87171', fontSize: 13, flex: 1 },
  chipGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm, paddingBottom: SPACING.xxl },
  chip: { paddingHorizontal: SPACING.md, paddingVertical: 10, borderRadius: RADIUS.full, backgroundColor: COLORS.surface, borderWidth: 1.5, shadowOpacity: 0, shadowRadius: 0, shadowOffset: { width: 0, height: 0 }, elevation: 0 },
  chipText: { color: COLORS.textSub, fontSize: 14, fontWeight: '600' },
  chipTextOn: { color: '#fff', fontWeight: '700' },
  footer: { gap: SPACING.sm, paddingTop: SPACING.md },
  primaryBtn: { backgroundColor: COLORS.purple, paddingVertical: 16, borderRadius: RADIUS.full, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACING.sm, shadowColor: COLORS.purple, shadowOpacity: 0.5, shadowRadius: 14, shadowOffset: { width: 0, height: 4 }, elevation: 10 },
  primaryBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  btnDisabled: { opacity: 0.35 },
  skipBtn: { alignItems: 'center', paddingVertical: SPACING.sm },
  skipText: { color: COLORS.textMuted, fontSize: 14 },
  searchRow: { flexDirection: 'row', gap: SPACING.sm, marginBottom: SPACING.lg },
  inputWrap: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.surface, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.border, paddingHorizontal: SPACING.md },
  input: { flex: 1, color: COLORS.text, paddingVertical: 14, fontSize: 15 },
  searchBtn: { width: 52, backgroundColor: COLORS.purple, borderRadius: RADIUS.md, alignItems: 'center', justifyContent: 'center', shadowColor: COLORS.purple, shadowOpacity: 0.45, shadowRadius: 10, shadowOffset: { width: 0, height: 3 }, elevation: 8 },
  resultCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.surface, borderRadius: RADIUS.lg, padding: SPACING.md, gap: SPACING.md, borderWidth: 1.5, borderColor: 'rgba(167,139,250,0.35)', marginBottom: SPACING.lg },
  resultArt: { width: 52, height: 52, borderRadius: RADIUS.sm, backgroundColor: COLORS.border },
  resultInfo: { flex: 1 },
  resultTitle: { color: COLORS.text, fontSize: 15, fontWeight: '700' },
  resultArtist: { color: COLORS.cyan, fontSize: 13, marginTop: 2, fontWeight: '500' },
  useBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.green, alignItems: 'center', justifyContent: 'center', shadowColor: COLORS.green, shadowOpacity: 0.5, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 6 },
  feedbackText: { fontSize: 13, fontWeight: '600', marginTop: -SPACING.sm, marginBottom: SPACING.sm },
  loadingIconWrap: { width: 88, height: 88, borderRadius: 44, backgroundColor: 'rgba(167,139,250,0.12)', alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: 'rgba(167,139,250,0.28)', marginBottom: SPACING.sm },
  loadingTitle: { color: COLORS.text, fontSize: 22, fontWeight: '800' },
  loadingSub: { color: COLORS.textMuted, fontSize: 14 },
  noResultsText: { color: COLORS.textMuted, fontSize: 14, textAlign: 'center', marginTop: SPACING.md, marginBottom: SPACING.sm },
  streakContent: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: SPACING.xl },
  flameGlow: { marginBottom: SPACING.xl, shadowColor: '#FDBA74', shadowOffset: { width: 0, height: 0 }, shadowRadius: 40, shadowOpacity: 0.7 },
  flameEmoji: { fontSize: 96, lineHeight: 110 },
  numClip: { height: 90, overflow: 'hidden', justifyContent: 'center', marginBottom: SPACING.sm },
  numText: { fontSize: 82, fontWeight: '900', color: COLORS.text, lineHeight: 90, includeFontPadding: false, textAlignVertical: 'center' },
  streakLabel: { fontSize: 13, fontWeight: '700', color: '#FDBA74', letterSpacing: 5, textTransform: 'uppercase', marginBottom: SPACING.md },
  taglineText: { fontSize: 18, fontWeight: '500', color: COLORS.textSub, textAlign: 'center' },
  streakBtnWrap: { position: 'absolute', left: SPACING.xl, right: SPACING.xl, alignItems: 'stretch' },
  artistResultRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, paddingVertical: 8, paddingHorizontal: SPACING.md, backgroundColor: COLORS.surface, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.border },
  artistThumb: { width: 36, height: 36, borderRadius: 18 },
  artistResultName: { flex: 1, color: COLORS.text, fontSize: 14, fontWeight: '600' },
  artistChip: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, backgroundColor: COLORS.surface, borderRadius: RADIUS.lg, paddingVertical: 8, paddingHorizontal: SPACING.md, borderWidth: 1.5, borderColor: 'rgba(167,139,250,0.35)' },
  artistChipImg: { width: 32, height: 32, borderRadius: 16 },
  artistChipName: { flex: 1, color: COLORS.text, fontSize: 14, fontWeight: '600' },
});
