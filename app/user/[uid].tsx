import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  Image,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { getDoc, getDocs, doc, query, collection, orderBy, limit } from 'firebase/firestore';
import { db } from '../../src/firebase/config';
import { AvatarWithFrame } from '../../src/components/profile/AvatarWithFrame';
import { ProfileBackground, ProfileThemeBackground } from '../../src/components/profile/ProfileBackground';
import { BadgeRow } from '../../src/components/profile/BadgeRow';
import { MatchPointsDisplay } from '../../src/components/profile/MatchPointsDisplay';
import { StreakIndicator } from '../../src/components/profile/StreakIndicator';
import { ShowcaseSection } from '../../src/components/profile/ShowcaseSection';
import { SquadSection } from '../../src/components/referral/SquadSection';
import { FollowButton } from '../../src/components/social/FollowButton';
import { FollowStats } from '../../src/components/profile/FollowStats';
import { Image as ExpoImage } from 'expo-image';
import { useProfileStore } from '../../src/store/profileStore';
import { SHOP_ITEMS_BY_ID } from '../../src/data/shopCatalog';
import { COLORS, SPACING, RADIUS } from '../../src/theme';
import { RankBadge } from '../../src/components/profile/RankBadge';
import { getRankForLikes, getNextRank, getProgressToNext } from '../../src/data/ranks';
import type { UserProfile } from '../../src/firebase/profileService';

const BANNER_HEIGHT = 160;

interface LikedTrackPreview {
  trackId: number;
  title: string;
  artistName: string;
  coverUrl: string;
}

function fmtN(n: number): string {
  return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

export default function UserProfileScreen() {
  const { uid } = useLocalSearchParams<{ uid: string }>();
  const insets = useSafeAreaInsets();
  const myUid = useProfileStore((s) => s.uid);

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [recentLikes, setRecentLikes] = useState<LikedTrackPreview[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!uid) return;
    Promise.all([
      getDoc(doc(db, 'users', uid)),
      getDocs(
        query(
          collection(db, 'likedTracks', uid, 'tracks'),
          orderBy('likedAt', 'desc'),
          limit(10)
        )
      ),
    ])
      .then(([userSnap, tracksSnap]) => {
        if (userSnap.exists()) setProfile(userSnap.data() as UserProfile);
        setRecentLikes(
          tracksSnap.docs.map((d) => ({
            trackId: d.data().trackId as number,
            title: d.data().title as string,
            artistName: d.data().artistName as string,
            coverUrl: d.data().coverUrl as string,
          }))
        );
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [uid]);

  if (loading) {
    return (
      <View style={[styles.center, { paddingTop: insets.top }]}>
        <ActivityIndicator color={COLORS.purple} />
      </View>
    );
  }

  if (!profile || !uid) {
    return (
      <View style={[styles.center, { paddingTop: insets.top }]}>
        <Text style={styles.notFound}>User not found</Text>
      </View>
    );
  }

  const themeItem = profile.equippedItems?.cardTheme
    ? SHOP_ITEMS_BY_ID[profile.equippedItems.cardTheme]
    : null;
  const accentColor = themeItem?.colors[0] ?? COLORS.purple;
  const profileThemeItem = profile.equippedItems?.profileTheme
    ? SHOP_ITEMS_BY_ID[profile.equippedItems.profileTheme]
    : null;
  const profileAccent = profileThemeItem?.colors[0] ?? null;
  const profileUiAccent = profileAccent ?? accentColor;
  const isOwnProfile = myUid === uid;
  const currentRank = getRankForLikes(profile.likedCount ?? 0);
  const nextRank = getNextRank(currentRank);
  const rankProgress = getProgressToNext(profile.likedCount ?? 0);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingBottom: SPACING.xxl }}
      showsVerticalScrollIndicator={false}
    >
      {/* ── Banner ── */}
      <View style={[styles.bannerZone, { paddingTop: insets.top }]}>
        {profile.bannerUrl ? (
          <Image
            source={{ uri: profile.bannerUrl }}
            style={[StyleSheet.absoluteFill, { top: insets.top }]}
            resizeMode="cover"
          />
        ) : profile.gifBgUrl ? (
          <ExpoImage
            source={{ uri: profile.gifBgUrl }}
            style={[StyleSheet.absoluteFill, { top: insets.top }]}
            contentFit="cover"
            autoplay
          />
        ) : (
          <View style={StyleSheet.absoluteFill}>
            <ProfileBackground
              backgroundId={profile.equippedItems?.profileBackground ?? null}
              height={BANNER_HEIGHT + insets.top}
            />
          </View>
        )}
        {/* Back button */}
        <TouchableOpacity
          style={[styles.backBtn, { top: insets.top + SPACING.sm }]}
          onPress={() => router.back()}
          activeOpacity={0.75}
        >
          <Ionicons name="chevron-back" size={20} color={COLORS.text} />
        </TouchableOpacity>
      </View>

      {/* ── Content area below banner (theme background fills this) ── */}
      <View style={{ position: 'relative' }}>
        <View style={[StyleSheet.absoluteFill, { opacity: 0.85 }]} pointerEvents="none">
          <ProfileThemeBackground themeId={profile.equippedItems?.profileTheme ?? null} height={999} />
        </View>

      {/* ── Identity ── */}
      <View style={styles.identityZone}>
        <View style={styles.avatarWrapper}>
          <AvatarWithFrame
            uri={profile.avatarUrl}
            frameId={profile.equippedItems?.avatarFrame ?? null}
            size={82}
          />
          <View style={styles.rankBadgeOverlay}>
            <RankBadge rankId={profile.equippedItems?.equippedRank ?? currentRank.id} size={34} />
          </View>
        </View>
        <View style={styles.nameRow}>
          <View style={styles.nameBlock}>
            <Text style={styles.name}>{profile.displayName ?? 'SongMatch User'}</Text>
            <BadgeRow
              badge1={profile.equippedItems?.badge1 ?? null}
              badge2={profile.equippedItems?.badge2 ?? null}
              badge3={profile.equippedItems?.badge3 ?? null}
            />
          </View>
          <MatchPointsDisplay points={profile.points ?? 0} size="sm" />
        </View>
        <StreakIndicator streak={profile.currentStreak ?? 0} />
        <FollowStats
          uid={uid}
          followerCount={profile.followerCount ?? 0}
          followingCount={profile.followingCount ?? 0}
        />
        {!isOwnProfile && (
          <View style={styles.followRow}>
            <FollowButton theirUid={uid} isPrivate={profile.isPrivate} />
          </View>
        )}
      </View>

      <View style={styles.sections}>
        {/* ── Stats ── */}
        <View style={[styles.statsRow, { borderColor: `${profileUiAccent}30` }]}>
          <View style={styles.statBox}>
            <Text style={[styles.statNumber, { color: COLORS.green }]}>{profile.likedCount ?? 0}</Text>
            <View style={styles.statMeta}>
              <Ionicons name="heart" size={13} color={COLORS.green} />
              <Text style={styles.statLabel}>Liked</Text>
            </View>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statBox}>
            <Text style={[styles.statNumber, { color: COLORS.orange }]}>{profile.currentStreak ?? 0}</Text>
            <View style={styles.statMeta}>
              <Ionicons name="flame" size={13} color={COLORS.orange} />
              <Text style={styles.statLabel}>Streak</Text>
            </View>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statBox}>
            <Text style={[styles.statNumber, { color: COLORS.purple }]}>{fmtN(profile.points ?? 0)}</Text>
            <View style={styles.statMeta}>
              <Ionicons name="sparkles" size={13} color={COLORS.purple} />
              <Text style={styles.statLabel}>Points</Text>
            </View>
          </View>
        </View>

        {/* ── Rank ── */}
        <View style={[styles.rankCard, { backgroundColor: currentRank.bgTint }]}>
          <RankBadge rankId={currentRank.id} size={56} />
          <View style={styles.rankInfo}>
            <Text style={[styles.rankLabel, { color: currentRank.color }]}>{currentRank.label}</Text>
            <View style={styles.rankBarBg}>
              <View style={[styles.rankBarFill, { width: `${Math.round(rankProgress * 100)}%`, backgroundColor: currentRank.color }]} />
            </View>
            {nextRank ? (
              <Text style={styles.rankNext}>{profile.likedCount ?? 0} / {nextRank.minLikes} likes · next: {nextRank.name}</Text>
            ) : (
              <Text style={styles.rankNext}>Max rank achieved!</Text>
            )}
          </View>
        </View>

        {/* ── Showcase ── */}
        <ShowcaseSection
          songs={profile.showcaseTracks ?? []}
          artists={profile.showcaseArtists ?? []}
          accentColor={accentColor}
          readOnly
        />

        {/* Squad */}
        {myUid && <SquadSection uid={uid} viewerUid={myUid} isOwnProfile={false} />}

        {/* ── Recent Likes ── */}
        {!profile.isPrivate && recentLikes.length > 0 && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: profileUiAccent }]}>Recently Liked</Text>
            <View style={styles.likesList}>
              {recentLikes.map((t) => (
                <View key={t.trackId} style={styles.likeRow}>
                  <Image source={{ uri: t.coverUrl }} style={styles.likeArt} />
                  <View style={styles.likeText}>
                    <Text style={styles.likeTitle} numberOfLines={1}>{t.title}</Text>
                    <Text style={styles.likeArtist} numberOfLines={1}>{t.artistName}</Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
        )}
      </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  center: { flex: 1, backgroundColor: COLORS.bg, alignItems: 'center', justifyContent: 'center' },
  notFound: { color: COLORS.textMuted, fontSize: 16 },

  bannerZone: { height: BANNER_HEIGHT + 60, overflow: 'hidden' },
  backBtn: {
    position: 'absolute',
    left: SPACING.lg,
    width: 36,
    height: 36,
    borderRadius: RADIUS.full,
    backgroundColor: 'rgba(13,13,13,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },

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
  nameBlock: { flex: 1, gap: 4 },
  name: { color: COLORS.text, fontSize: 22, fontWeight: '800', letterSpacing: -0.5 },
  followRow: { flexDirection: 'row' },

  sections: { paddingHorizontal: SPACING.lg, gap: SPACING.lg },

  statsRow: {
    flexDirection: 'row',
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.xl,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  statBox: { flex: 1, alignItems: 'center', gap: 6 },
  statDivider: { width: 1, backgroundColor: COLORS.border },
  statNumber: { fontSize: 32, fontWeight: '900', letterSpacing: -1 },
  statMeta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  statLabel: { color: COLORS.textSub, fontSize: 13 },

  rankCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.xl,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
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

  section: { gap: SPACING.sm },
  sectionTitle: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1.2 },

  likesList: { gap: 2 },
  likeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingVertical: 8,
    paddingHorizontal: SPACING.md,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  likeArt: { width: 40, height: 40, borderRadius: RADIUS.sm },
  likeText: { flex: 1, gap: 2 },
  likeTitle: { color: COLORS.text, fontSize: 13, fontWeight: '600' },
  likeArtist: { color: COLORS.textMuted, fontSize: 11 },
});
