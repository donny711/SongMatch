import React from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Share,
  NativeModules,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuthStore } from '../../src/store/authStore';
import { useDeckStore } from '../../src/store/deckStore';
import { useProfileStore } from '../../src/store/profileStore';
import { useSubscriptionStore } from '../../src/store/subscriptionStore';
import { TokenStorage } from '../../src/auth/TokenStorage';
import { useSoundCloudAuth } from '../../src/auth/useSoundCloudAuth';
import { AvatarWithFrame } from '../../src/components/profile/AvatarWithFrame';
import { ProfileBackground, ProfileThemeBackground } from '../../src/components/profile/ProfileBackground';
import { BadgeRow } from '../../src/components/profile/BadgeRow';
import { MatchPointsDisplay } from '../../src/components/profile/MatchPointsDisplay';
import { StreakIndicator } from '../../src/components/profile/StreakIndicator';
import { ShowcaseSection } from '../../src/components/profile/ShowcaseSection';
import { SquadSection } from '../../src/components/referral/SquadSection';
import { FollowStats } from '../../src/components/profile/FollowStats';
import { Image as ExpoImage } from 'expo-image';
import { SHOP_ITEMS_BY_ID } from '../../src/data/shopCatalog';
import { COLORS, SPACING, RADIUS } from '../../src/theme';
import { RankBadge } from '../../src/components/profile/RankBadge';
import { getRankForLikes, getNextRank, getProgressToNext } from '../../src/data/ranks';

const BANNER_HEIGHT = 180;
const ADS_AVAILABLE = false; // disabled: react-native-google-mobile-ads crashes on iOS 26
const BANNER_AD_UNIT_ID = Platform.select({
  ios: process.env.EXPO_PUBLIC_ADMOB_BANNER_IOS ?? 'ca-app-pub-3940256099942544/2934735716',
  android: process.env.EXPO_PUBLIC_ADMOB_BANNER_ANDROID ?? 'ca-app-pub-3940256099942544/6300978111',
  default: 'ca-app-pub-3940256099942544/6300978111',
})!;

// ── AdMob Banner ──────────────────────────────────────────────────────────────

function ProfileBanner() {
  if (!ADS_AVAILABLE) return null;
  try {
    const { BannerAd, BannerAdSize } = require('react-native-google-mobile-ads');
    return (
      <View style={{ alignItems: 'center', paddingVertical: SPACING.sm }}>
        <BannerAd unitId={BANNER_AD_UNIT_ID} size={BannerAdSize.BANNER} />
      </View>
    );
  } catch {
    return null;
  }
}

// ── Share SongMatch card (Pro) ─────────────────────────────────────────────────

function ShareCard() {
  const handleShare = async () => {
    await Share.share({
      message: 'Check out SongMatch — the best music discovery app! https://songmatch.net',
      url: 'https://songmatch.net',
    });
  };
  return (
    <TouchableOpacity style={shareCardStyles.card} onPress={handleShare} activeOpacity={0.85}>
      <LinearGradient
        colors={['rgba(167,139,250,0.12)', 'rgba(232,121,249,0.08)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={shareCardStyles.grad}
      >
        <View style={shareCardStyles.iconWrap}>
          <Ionicons name="share-social" size={18} color={COLORS.purple} />
        </View>
        <View style={shareCardStyles.text}>
          <Text style={shareCardStyles.title}>Share SongMatch</Text>
          <Text style={shareCardStyles.sub}>Invite friends & earn rewards</Text>
        </View>
        <Ionicons name="chevron-forward" size={16} color={COLORS.textMuted} />
      </LinearGradient>
    </TouchableOpacity>
  );
}

const shareCardStyles = StyleSheet.create({
  card: {
    borderRadius: RADIUS.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(167,139,250,0.25)',
  },
  grad: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    gap: SPACING.md,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: RADIUS.sm,
    backgroundColor: 'rgba(167,139,250,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: { flex: 1, gap: 2 },
  title: { color: COLORS.text, fontSize: 14, fontWeight: '700' },
  sub: { color: COLORS.textMuted, fontSize: 12 },
});

// ── SoundCloud platform card ────────────────────────────────────────────────

function PlatformRow({
  icon,
  color,
  name,
  subtitle,
  avatarUri,
  actionLabel,
  actionDisabled,
  onAction,
  isConnected,
  divider,
}: {
  icon: string;
  color: string;
  name: string;
  subtitle?: string;
  avatarUri?: string | null;
  actionLabel: string;
  actionDisabled?: boolean;
  onAction?: () => void;
  isConnected?: boolean;
  divider?: boolean;
}) {
  return (
    <>
      <View style={styles.platformRow}>
        {/* Icon / avatar */}
        {isConnected && avatarUri ? (
          <Image source={{ uri: avatarUri }} style={styles.platformAvatar} />
        ) : (
          <View style={[styles.platformIcon, { backgroundColor: `${color}20` }]}>
            <Ionicons name={icon as any} size={16} color={color} />
          </View>
        )}

        {/* Text */}
        <View style={styles.platformText}>
          <View style={styles.platformNameRow}>
            <Text style={styles.platformName}>{name}</Text>
            {isConnected && (
              <View style={[styles.connectedDot, { backgroundColor: color }]} />
            )}
          </View>
          {subtitle ? (
            <Text style={styles.platformSub} numberOfLines={1}>{subtitle}</Text>
          ) : null}
        </View>

        {/* Action button */}
        {actionDisabled ? (
          <View style={styles.platformBtnDisabled}>
            <Text style={styles.platformBtnDisabledText}>{actionLabel}</Text>
          </View>
        ) : (
          <TouchableOpacity
            style={[
              styles.platformBtn,
              isConnected ? styles.platformBtnDisconnect : { backgroundColor: color },
            ]}
            onPress={onAction}
            activeOpacity={0.8}
          >
            <Text style={[
              styles.platformBtnText,
              isConnected && styles.platformBtnTextDisconnect,
            ]}>
              {actionLabel}
            </Text>
          </TouchableOpacity>
        )}
      </View>
      {divider && <View style={styles.platformDivider} />}
    </>
  );
}

function MusicPlatforms() {
  const { promptAsync } = useSoundCloudAuth();
  const user = useAuthStore((s) => s.user);
  const accessToken = useAuthStore((s) => s.accessToken);
  const logout = useAuthStore((s) => s.logout);
  const connectedPlatforms = useAuthStore((s) => s.connectedPlatforms);
  const soundCloudUser = useAuthStore((s) => s.soundCloudUser);
  const removePlatform = useAuthStore((s) => s.removePlatform);
  const setSoundCloudUser = useAuthStore((s) => s.setSoundCloudUser);

  const handleSpotifyDisconnect = async () => {
    await TokenStorage.clearTokens();
    logout();
    await useDeckStore.getState().loadForUser('anonymous');
  };

  const handleSoundCloudDisconnect = async () => {
    await TokenStorage.clearSoundCloudTokens();
    setSoundCloudUser(null);
    removePlatform('soundcloud');
  };

  const scConnected = connectedPlatforms.includes('soundcloud');

  return (
    <View style={styles.platformCard}>
      <PlatformRow
        icon="musical-notes"
        color={COLORS.purple}
        name="Spotify"
        subtitle={accessToken && user ? (user.display_name ?? user.email) : undefined}
        avatarUri={user?.images?.[0]?.url}
        isConnected={!!(accessToken && user)}
        actionLabel={accessToken && user ? 'Disconnect' : 'Connect'}
        onAction={accessToken && user
          ? handleSpotifyDisconnect
          : () => router.navigate('/(auth)/login')}
        divider
      />
      <PlatformRow
        icon="cloud"
        color="#FF5500"
        name="SoundCloud"
        actionLabel="Soon"
        actionDisabled
        divider
      />
      <PlatformRow
        icon="musical-note"
        color="#FC3C44"
        name="Apple Music"
        actionLabel="Soon"
        actionDisabled
      />
    </View>
  );
}

// ── Main Profile Screen ─────────────────────────────────────────────────────

export default function ProfileScreen() {
  const user = useAuthStore((s) => s.user);
  const { likedTracks, skippedCount, likedCount } = useDeckStore();
  const insets = useSafeAreaInsets();
  const isPro = useSubscriptionStore((s) => s.isPro);
  const [statsRowHeight, setStatsRowHeight] = React.useState(96);
  const [contentHeight, setContentHeight] = React.useState(0);

  const profileDisplayName = useProfileStore((s) => s.displayName);
  const profileAvatarUrl = useProfileStore((s) => s.avatarUrl);
  const bannerUrl = useProfileStore((s) => s.bannerUrl);
  const avatarPending = useProfileStore((s) => s.avatarPending);
  const bannerPending = useProfileStore((s) => s.bannerPending);
  const points = useProfileStore((s) => s.points);
  const currentStreak = useProfileStore((s) => s.currentStreak);
  const equippedItems = useProfileStore((s) => s.equippedItems);
  const gifBgUrl = useProfileStore((s) => s.gifBgUrl);
  const showcaseTracks = useProfileStore((s) => s.showcaseTracks);
  const showcaseArtists = useProfileStore((s) => s.showcaseArtists);
  const followerCount = useProfileStore((s) => s.followerCount);
  const followingCount = useProfileStore((s) => s.followingCount);
  const uid = useProfileStore((s) => s.uid);

  // Resolve display name: custom → Spotify → fallback
  const resolvedName = profileDisplayName ?? user?.display_name ?? 'SongMatch User';

  // Resolve avatar: custom approved → Spotify avatar → null
  const resolvedAvatarUri = profileAvatarUrl ?? user?.images?.[0]?.url ?? null;

  // Accent color from equipped card theme
  const themeItem = equippedItems.cardTheme ? SHOP_ITEMS_BY_ID[equippedItems.cardTheme] : null;
  const accentColor = themeItem?.colors[0] ?? COLORS.purple;

  // Profile theme (below-banner background + accent override)
  const profileThemeItem = equippedItems.profileTheme ? SHOP_ITEMS_BY_ID[equippedItems.profileTheme] : null;
  const profileAccent = profileThemeItem?.colors[0] ?? null;
  const profileUiAccent = profileAccent ?? accentColor;

  // Rank
  const currentRank = getRankForLikes(likedTracks.length);
  const nextRank = getNextRank(currentRank);
  const rankCardColor = themeItem?.colors[0] ?? currentRank.bgTint;
  const rankCardBg = rankCardColor + 'B3'; // 70% opacity
  const rankProgress = getProgressToNext(likedTracks.length);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingBottom: SPACING.xxl }}
      showsVerticalScrollIndicator={false}
    >
      {/* ── Banner Zone ─────────────────────────────────────────────── */}
      <View style={[styles.bannerZone, { paddingTop: insets.top }]}>
        {bannerUrl ? (
          <Image
            source={{ uri: bannerUrl }}
            style={[StyleSheet.absoluteFill, { top: insets.top }]}
            resizeMode="cover"
          />
        ) : gifBgUrl ? (
          <ExpoImage
            source={{ uri: gifBgUrl }}
            style={[StyleSheet.absoluteFill, { top: insets.top }]}
            contentFit="cover"
            autoplay
          />
        ) : (
          <View style={StyleSheet.absoluteFill}>
            <ProfileBackground
              backgroundId={equippedItems.profileBackground}
              height={BANNER_HEIGHT + insets.top}
            />
          </View>
        )}
        {/* Pending review chip */}
        {(avatarPending || bannerPending) && (
          <View style={[styles.pendingChip, { top: insets.top + SPACING.sm }]}>
            <Ionicons name="time-outline" size={11} color="#FBBF24" />
            <Text style={styles.pendingText}>Photo pending review</Text>
          </View>
        )}

        {/* Settings button */}
        <TouchableOpacity
          style={[styles.settingsBtn, { top: insets.top + SPACING.sm }]}
          onPress={() => router.push('/settings')}
          accessibilityLabel="Settings"
          activeOpacity={0.75}
        >
          <Ionicons name="settings-outline" size={20} color={COLORS.text} />
        </TouchableOpacity>
      </View>

      {/* ── Content area below banner (theme background fills this) ── */}
      <View
        onLayout={(e) => setContentHeight(e.nativeEvent.layout.height)}
        style={{ position: 'relative' }}
      >
        <View style={[StyleSheet.absoluteFill, { opacity: 0.85 }]} pointerEvents="none">
          <ProfileThemeBackground themeId={equippedItems.profileTheme ?? null} height={contentHeight} />
        </View>

      {/* ── Identity Zone ────────────────────────────────────────────── */}
      <View style={styles.identityZone}>
        {/* Avatar (overlapping banner) */}
        <View style={styles.avatarWrapper}>
          <AvatarWithFrame
            uri={resolvedAvatarUri}
            frameId={equippedItems.avatarFrame}
            size={82}
          />
          <View style={styles.rankBadgeOverlay}>
            <RankBadge rankId={equippedItems.equippedRank ?? currentRank.id} size={34} />
          </View>
        </View>

        {/* Name + badges row */}
        <View style={styles.nameRow}>
          <View style={styles.nameBlock}>
            <Text style={styles.name}>{resolvedName}</Text>
            {user?.email && !profileDisplayName && (
              <Text style={styles.subName}>{user.email}</Text>
            )}
            <BadgeRow
              badge1={equippedItems.badge1}
              badge2={equippedItems.badge2}
              badge3={equippedItems.badge3}
            />
          </View>
          <MatchPointsDisplay points={points} size="sm" onPress={() => router.push('/earn-mp')} />
        </View>

        {/* Streak */}
        <StreakIndicator streak={currentStreak} animate />

        {/* Follower / Following counts */}
        {uid && (
          <FollowStats uid={uid} followerCount={followerCount} followingCount={followingCount} />
        )}

        {/* Action buttons */}
        <View style={styles.actionRow}>
          <TouchableOpacity
            style={[styles.actionBtn, { borderColor: profileUiAccent }]}
            onPress={() => router.push('/edit-profile')}
            activeOpacity={0.85}
          >
            {themeItem && themeItem.animationType !== 'static' && (
              <View style={[StyleSheet.absoluteFill, { opacity: 0.35, borderRadius: RADIUS.full, overflow: 'hidden' }]}>
                <ProfileBackground backgroundId={equippedItems.cardTheme} height={60} />
              </View>
            )}
            <Ionicons name="pencil" size={14} color={profileUiAccent} />
            <Text style={[styles.actionBtnText, { color: profileUiAccent }]}>Edit Profile</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionBtn, styles.actionBtnShop]}
            onPress={() => router.push('/shop')}
            activeOpacity={0.85}
          >
            <Ionicons name="storefront" size={14} color="#22D3EE" />
            <Text style={[styles.actionBtnText, { color: '#22D3EE' }]}>Shop</Text>
          </TouchableOpacity>
          {isPro ? (
            <TouchableOpacity
              style={[styles.actionBtn, styles.actionBtnPro]}
              onPress={() => router.push('/referral')}
              activeOpacity={0.85}
            >
              <Ionicons name="flash" size={14} color="#A78BFA" />
              <Text style={[styles.actionBtnText, { color: '#A78BFA' }]}>Pro</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={styles.upgradeBtn}
              onPress={() => router.push('/upgrade')}
              activeOpacity={0.85}
            >
              {themeItem && themeItem.animationType !== 'static' ? (
                <View style={styles.upgradeBtnGrad}>
                  <View style={StyleSheet.absoluteFill}>
                    <ProfileBackground backgroundId={equippedItems.cardTheme} height={60} />
                  </View>
                  <Ionicons name="flash" size={13} color="#fff" />
                  <Text style={styles.upgradeBtnText}>Go Pro</Text>
                </View>
              ) : (
                <LinearGradient
                  colors={[rankCardColor, rankCardColor, '#ffffff']}
                  locations={[0, 0.55, 1]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.upgradeBtnGrad}
                >
                  <Ionicons name="flash" size={13} color="#fff" />
                  <Text style={styles.upgradeBtnText}>Go Pro</Text>
                </LinearGradient>
              )}
            </TouchableOpacity>
          )}
        </View>
      </View>


      <View style={styles.sections}>
        {/* ── Stats ── */}
        <View
          style={[styles.statsRow, { borderColor: `${profileUiAccent}30` }]}
          onLayout={(e) => setStatsRowHeight(e.nativeEvent.layout.height)}
        >
          {themeItem && themeItem.animationType !== 'static' && (
            <View style={[StyleSheet.absoluteFill, { opacity: 0.55 }]}>
              <ProfileBackground backgroundId={equippedItems.cardTheme} height={statsRowHeight} />
            </View>
          )}
          <View style={styles.statBox}>
            <Text style={[styles.statNumber, { color: profileUiAccent }]}>{likedTracks.length}</Text>
            <View style={styles.statMeta}>
              <Ionicons name="heart" size={13} color={profileUiAccent} />
              <Text style={[styles.statLabel, { color: profileUiAccent }]}>Liked</Text>
            </View>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statBox}>
            <Text style={[styles.statNumber, { color: COLORS.text }]}>{skippedCount}</Text>
            <View style={styles.statMeta}>
              <Ionicons name="close-circle" size={13} color={COLORS.text} />
              <Text style={[styles.statLabel, { color: COLORS.text }]}>Skipped</Text>
            </View>
          </View>
        </View>

        {/* ── Rank ── */}
        <View style={[styles.rankCard, !themeItem || themeItem.animationType === 'static' ? { backgroundColor: rankCardBg } : {}]}>
          {themeItem && themeItem.animationType !== 'static' && (
            <View style={StyleSheet.absoluteFill}>
              <ProfileBackground backgroundId={equippedItems.cardTheme} height={88} />
            </View>
          )}
          <RankBadge rankId={currentRank.id} size={56} />
          <View style={styles.rankInfo}>
            <Text style={[styles.rankLabel, { color: currentRank.labelColor }]}>{currentRank.label}</Text>
            <View style={styles.rankBarBg}>
              <View style={[styles.rankBarFill, { width: `${Math.round(rankProgress * 100)}%`, backgroundColor: currentRank.color }]} />
            </View>
            {nextRank ? (
              <Text style={styles.rankNext}>{likedTracks.length} / {nextRank.minLikes} likes · next: {nextRank.name}</Text>
            ) : (
              <Text style={styles.rankNext}>Max rank achieved!</Text>
            )}
          </View>
        </View>

        {/* ── Showcase ── */}
        <ShowcaseSection
          songs={showcaseTracks}
          artists={showcaseArtists}
          accentColor={profileUiAccent}
        />

        {/* Squad */}
        {uid && <SquadSection uid={uid} viewerUid={uid} isOwnProfile />}

        {/* ── Music Platforms ── */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: profileUiAccent }]}>Music Platforms</Text>
          <MusicPlatforms />
        </View>

        {/* ── Invite / Ad ── */}
        <View style={styles.section}>
          {isPro ? (
            <>
              <Text style={[styles.sectionTitle, { color: profileUiAccent }]}>Invite</Text>
              <ShareCard />
            </>
          ) : (
            <ProfileBanner />
          )}
        </View>
      </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },

  // Banner
  bannerZone: {
    height: BANNER_HEIGHT + 60,
    overflow: 'hidden',
  },
  pendingChip: {
    position: 'absolute',
    left: SPACING.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(251,191,36,0.15)',
    borderRadius: RADIUS.full,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  pendingText: {
    color: '#FBBF24',
    fontSize: 11,
    fontWeight: '600',
  },
  settingsBtn: {
    position: 'absolute',
    right: SPACING.lg,
    width: 36,
    height: 36,
    borderRadius: RADIUS.full,
    backgroundColor: 'rgba(13,13,13,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Identity
  identityZone: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.md,
    gap: SPACING.sm,
    marginTop: -50,
  },
  avatarWrapper: {
    position: 'relative',
    alignSelf: 'flex-start',
  },
  rankBadgeOverlay: {
    position: 'absolute',
    bottom: -6,
    right: -10,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: SPACING.sm,
  },
  nameBlock: {
    flex: 1,
    gap: 4,
  },
  name: {
    color: COLORS.text,
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  subName: {
    color: COLORS.textSub,
    fontSize: 13,
  },
  actionRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: SPACING.md,
    borderRadius: RADIUS.full,
    borderWidth: 1.5,
  },
  actionBtnShop: {
    borderColor: 'rgba(34,211,238,0.4)',
    backgroundColor: 'rgba(34,211,238,0.08)',
  },
  actionBtnPro: {
    borderColor: 'rgba(167,139,250,0.4)',
    backgroundColor: 'rgba(167,139,250,0.08)',
  },
  actionBtnText: {
    fontSize: 13,
    fontWeight: '700',
  },
  upgradeBtn: {
    borderRadius: RADIUS.full,
  },
  upgradeBtnGrad: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 8,
    paddingHorizontal: SPACING.md,
    borderRadius: RADIUS.full,
    overflow: 'hidden',
  },
  upgradeBtnText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '800',
  },

  // Sections
  sections: {
    paddingHorizontal: SPACING.lg,
    gap: SPACING.lg,
  },

  // Stats
  statsRow: {
    flexDirection: 'row',
    borderRadius: RADIUS.xl,
    overflow: 'hidden',
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  statBox: { flex: 1, alignItems: 'center', gap: 6 },
  statDivider: { width: 1, backgroundColor: COLORS.border },
  statNumber: { fontSize: 36, fontWeight: '900', letterSpacing: -1 },
  statMeta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  statLabel: { color: COLORS.textSub, fontSize: 13 },

  // Rank card
  rankCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.xl,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
  },
  rankInfo: { flex: 1, gap: 7 },
  rankLabel: { fontSize: 12, fontWeight: '800', letterSpacing: 1.8 },
  rankBarBg: {
    height: 5,
    backgroundColor: 'rgba(167,139,250,0.15)',
    borderRadius: RADIUS.full,
    overflow: 'hidden',
  },
  rankBarFill: {
    height: '100%',
    borderRadius: RADIUS.full,
  },
  rankNext: { color: COLORS.textMuted, fontSize: 11 },

  // Section
  section: { gap: SPACING.sm },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },

  // Platform rows
  platformCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
  },
  platformRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: 10,
    gap: SPACING.sm,
  },
  platformDivider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginHorizontal: SPACING.md,
  },
  platformIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  platformAvatar: {
    width: 32,
    height: 32,
    borderRadius: 8,
  },
  platformText: { flex: 1, gap: 1 },
  platformNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  platformName: { color: COLORS.text, fontSize: 14, fontWeight: '600' },
  connectedDot: { width: 6, height: 6, borderRadius: 3 },
  platformSub: { color: COLORS.textMuted, fontSize: 12 },
  platformBtn: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: RADIUS.full,
  },
  platformBtnDisconnect: {
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  platformBtnText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  platformBtnTextDisconnect: { color: COLORS.textMuted },
  platformBtnDisabled: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  platformBtnDisabledText: { color: COLORS.textMuted, fontSize: 12, fontWeight: '600' },
});
