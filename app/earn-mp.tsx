import React from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useProfileStore } from '../src/store/profileStore';
import { useDeckStore } from '../src/store/deckStore';
import { useSubscriptionStore } from '../src/store/subscriptionStore';
import { useRewardedAd } from '../src/hooks/useRewardedAd';
import { MILESTONES, type Milestone } from '../src/data/milestones';
import { COLORS, SPACING, RADIUS } from '../src/theme';

// ── Category definitions ───────────────────────────────────────────────────

interface Category {
  label: string;
  color: string;
  icon: string;
  milestoneIds: string[];
}

const CATEGORIES: Category[] = [
  {
    label: 'Getting Started',
    color: '#A78BFA',
    icon: 'rocket',
    milestoneIds: ['ms_first_launch', 'ms_set_avatar', 'ms_set_username'],
  },
  {
    label: 'Platforms',
    color: '#E879F9',
    icon: 'apps',
    milestoneIds: ['ms_connect_spotify', 'ms_connect_soundcloud', 'ms_two_platforms'],
  },
  {
    label: 'Songs',
    color: '#C96A6A',
    icon: 'heart',
    milestoneIds: ['ms_liked_10', 'ms_liked_25', 'ms_liked_50', 'ms_liked_100', 'ms_liked_250'],
  },
  {
    label: 'Streaks',
    color: '#F59E0B',
    icon: 'flame',
    milestoneIds: ['ms_streak_3', 'ms_streak_7', 'ms_streak_14', 'ms_streak_30'],
  },
  {
    label: 'Social',
    color: '#A78BFA',
    icon: 'people',
    milestoneIds: ['ms_first_follow', 'ms_first_follower', 'ms_followers_10'],
  },
];

const MILESTONE_MAP = Object.fromEntries(MILESTONES.map((m) => [m.id, m]));

// ── Subtitle helpers ───────────────────────────────────────────────────────

function getMilestoneSubtitle(
  ms: Milestone,
  likedCount: number,
  currentStreak: number,
  followerCount: number
): string {
  const t = ms.triggerCondition;
  switch (t.type) {
    case 'first_launch':        return 'Open SoundMatch for the first time';
    case 'set_avatar':          return 'Upload a profile picture';
    case 'set_username':        return 'Set your unique @username';
    case 'platform_connect':
      if (t.platform === 'spotify')    return 'Link your Spotify account';
      if (t.platform === 'soundcloud') return 'Link your SoundCloud account';
      return 'Link both Spotify and SoundCloud';
    case 'liked_count':
      return `Like ${t.count} songs  ·  ${Math.min(likedCount, t.count)}/${t.count}`;
    case 'streak_days':
      return `${t.days}-day listening streak  ·  ${Math.min(currentStreak, t.days)}/${t.days} days`;
    case 'first_follow':        return 'Follow another user';
    case 'first_follower':
      return `Get your first follower  ·  ${Math.min(followerCount, 1)}/1`;
    case 'follower_count':
      return `Reach ${t.count} followers  ·  ${Math.min(followerCount, t.count)}/${t.count}`;
    default:                    return '';
  }
}

// ── Milestone row ──────────────────────────────────────────────────────────

function MilestoneRow({
  ms,
  earned,
  color,
  likedCount,
  currentStreak,
  followerCount,
}: {
  ms: Milestone;
  earned: boolean;
  color: string;
  likedCount: number;
  currentStreak: number;
  followerCount: number;
}) {
  const subtitle = getMilestoneSubtitle(ms, likedCount, currentStreak, followerCount);

  return (
    <View style={[styles.row, earned && styles.rowEarned]}>
      {/* Left: points */}
      <View style={[styles.pointsPill, { borderColor: earned ? 'rgba(167,139,250,0.4)' : `${color}40` }]}>
        <Text style={[styles.pointsText, { color: earned ? '#A78BFA' : color }]}>
          +{ms.pointsReward}
        </Text>
      </View>

      {/* Middle: text */}
      <View style={styles.rowContent}>
        <Text style={[styles.rowTitle, earned && styles.rowTitleEarned]}>{ms.label}</Text>
        {subtitle ? (
          <Text style={styles.rowSub} numberOfLines={1}>{subtitle}</Text>
        ) : null}
      </View>

      {/* Right: status */}
      {earned ? (
        <Ionicons name="checkmark-circle" size={20} color="#A78BFA" />
      ) : (
        <View style={[styles.lockDot, { backgroundColor: `${color}22`, borderColor: `${color}44` }]}>
          <Ionicons name="lock-closed" size={10} color={color} />
        </View>
      )}
    </View>
  );
}

// ── Category section ───────────────────────────────────────────────────────

function CategorySection({
  cat,
  earned,
  likedCount,
  currentStreak,
  followerCount,
}: {
  cat: Category;
  earned: string[];
  likedCount: number;
  currentStreak: number;
  followerCount: number;
}) {
  const milestones = cat.milestoneIds
    .map((id) => MILESTONE_MAP[id])
    .filter(Boolean) as Milestone[];

  const earnedInCat = milestones.filter((m) => earned.includes(m.id)).length;
  const totalPts = milestones.reduce((s, m) => s + m.pointsReward, 0);

  return (
    <View style={styles.section}>
      {/* Category header */}
      <View style={styles.catHeader}>
        <View style={[styles.catIcon, { backgroundColor: `${cat.color}18`, borderColor: `${cat.color}35` }]}>
          <Ionicons name={cat.icon as any} size={14} color={cat.color} />
        </View>
        <Text style={[styles.catLabel, { color: cat.color }]}>{cat.label}</Text>
        <View style={styles.catMeta}>
          <Text style={styles.catProgress}>{earnedInCat}/{milestones.length}</Text>
          <View style={[styles.catPts, { borderColor: `${cat.color}35` }]}>
            <Ionicons name="diamond-outline" size={10} color={cat.color} />
            <Text style={[styles.catPtsText, { color: cat.color }]}>{totalPts} MP</Text>
          </View>
        </View>
      </View>

      {/* Progress bar */}
      <View style={styles.progressTrack}>
        <View
          style={[
            styles.progressFill,
            {
              backgroundColor: cat.color,
              width: `${(earnedInCat / milestones.length) * 100}%` as any,
            },
          ]}
        />
      </View>

      {/* Rows */}
      <View style={styles.rowList}>
        {milestones.map((ms) => (
          <MilestoneRow
            key={ms.id}
            ms={ms}
            earned={earned.includes(ms.id)}
            color={cat.color}
            likedCount={likedCount}
            currentStreak={currentStreak}
            followerCount={followerCount}
          />
        ))}
      </View>
    </View>
  );
}

// ── Screen ─────────────────────────────────────────────────────────────────

function WatchAdCard() {
  const { status, show } = useRewardedAd();
  const isReady = status === 'ready';
  const isLoading = status === 'loading';
  const isUnavailable = status === 'unavailable';

  return (
    <TouchableOpacity
      style={[styles.adCard, !isReady && styles.adCardDisabled]}
      onPress={isReady ? show : undefined}
      activeOpacity={0.8}
      disabled={!isReady}
    >
      <View style={styles.adIconWrap}>
        {isLoading ? (
          <ActivityIndicator size="small" color="#A78BFA" />
        ) : (
          <Ionicons
            name={isReady ? 'play-circle' : 'alert-circle-outline'}
            size={26}
            color={isReady ? '#A78BFA' : COLORS.textMuted}
          />
        )}
      </View>
      <View style={styles.adTextWrap}>
        <Text style={styles.adTitle}>Watch a short ad</Text>
        <Text style={styles.adSub}>
          {isUnavailable ? 'Requires a compiled build (not Expo Go)'
            : isLoading ? 'Loading ad…'
            : isReady ? 'Earn 30 MP instantly · up to 5×/day'
            : 'No ad available right now'}
        </Text>
      </View>
      <View style={[styles.adPill, !isReady && styles.adPillDisabled]}>
        <Ionicons name="diamond" size={11} color={isReady ? '#A78BFA' : COLORS.textMuted} />
        <Text style={[styles.adPillText, !isReady && styles.adPillTextDisabled]}>+30 MP</Text>
      </View>
    </TouchableOpacity>
  );
}

function fmtN(n: number): string {
  return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

export default function EarnMPScreen() {
  const insets = useSafeAreaInsets();
  const earnedMilestones = useProfileStore((s) => s.earnedMilestones);
  const points = useProfileStore((s) => s.points);
  const currentStreak = useProfileStore((s) => s.currentStreak);
  const followerCount = useProfileStore((s) => s.followerCount);
  const likedCount = useDeckStore((s) => s.likedCount);
  const isPro = useSubscriptionStore((s) => s.isPro);

  const totalPossible = MILESTONES.reduce((s, m) => s + m.pointsReward, 0);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.closeBtn}
          onPress={() => router.back()}
          activeOpacity={0.75}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="close" size={20} color={COLORS.text} />
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          <Ionicons name="diamond" size={16} color="#22D3EE" />
          <Text style={styles.headerTitle}>How to Earn MP</Text>
        </View>

        {/* Total MP pill */}
        <View style={styles.totalPill}>
          <Text style={styles.totalText}>{fmtN(points)}</Text>
          <Text style={styles.totalUnit}>/ {fmtN(totalPossible)}</Text>
        </View>
      </View>

      {/* Overall progress bar */}
      <View style={styles.overallTrack}>
        <View
          style={[
            styles.overallFill,
            { width: `${Math.min((points / totalPossible) * 100, 100)}%` as any },
          ]}
        />
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + SPACING.xxl }]}
        showsVerticalScrollIndicator={false}
      >
        {!isPro && <WatchAdCard />}

        {CATEGORIES.map((cat) => (
          <CategorySection
            key={cat.label}
            cat={cat}
            earned={earnedMilestones}
            likedCount={likedCount}
            currentStreak={currentStreak}
            followerCount={followerCount}
          />
        ))}
      </ScrollView>
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    gap: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  headerTitle: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: '800',
  },
  totalPill: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 2,
    backgroundColor: 'rgba(34,211,238,0.1)',
    borderRadius: RADIUS.full,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: 'rgba(34,211,238,0.25)',
  },
  totalText: { color: '#22D3EE', fontSize: 13, fontWeight: '800' },
  totalUnit: { color: 'rgba(34,211,238,0.5)', fontSize: 10, fontWeight: '600' },

  overallTrack: {
    height: 3,
    backgroundColor: COLORS.border,
    marginHorizontal: SPACING.lg,
    borderRadius: 2,
    marginBottom: SPACING.md,
  },
  overallFill: {
    height: '100%',
    borderRadius: 2,
    backgroundColor: '#22D3EE',
  },

  scroll: { paddingHorizontal: SPACING.lg, gap: SPACING.lg },

  // Watch Ad card
  adCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    backgroundColor: 'rgba(167,139,250,0.08)',
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    borderColor: 'rgba(167,139,250,0.3)',
    padding: SPACING.md,
  },
  adCardDisabled: {
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  adIconWrap: {
    width: 46,
    height: 46,
    borderRadius: RADIUS.lg,
    backgroundColor: 'rgba(167,139,250,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(167,139,250,0.25)',
  },
  adTextWrap: { flex: 1, gap: 3 },
  adTitle: { color: COLORS.text, fontSize: 15, fontWeight: '700' },
  adSub: { color: COLORS.textMuted, fontSize: 12 },
  adPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(167,139,250,0.15)',
    borderRadius: RADIUS.full,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: 'rgba(167,139,250,0.35)',
  },
  adPillDisabled: {
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
  },
  adPillText: { color: '#A78BFA', fontSize: 13, fontWeight: '800' },
  adPillTextDisabled: { color: COLORS.textMuted },

  // Category
  section: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
  },
  catHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.sm,
  },
  catIcon: {
    width: 28,
    height: 28,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  catLabel: {
    flex: 1,
    fontSize: 13,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  catMeta: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  catProgress: { color: COLORS.textMuted, fontSize: 12, fontWeight: '600' },
  catPts: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    borderWidth: 1,
    borderRadius: RADIUS.full,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  catPtsText: { fontSize: 11, fontWeight: '700' },

  progressTrack: {
    height: 2,
    backgroundColor: COLORS.border,
    marginHorizontal: SPACING.md,
    marginBottom: SPACING.xs,
    borderRadius: 1,
  },
  progressFill: { height: '100%', borderRadius: 1 },

  rowList: {
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.sm,
    gap: 2,
  },

  // Row
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  rowEarned: { opacity: 0.55 },

  pointsPill: {
    minWidth: 52,
    borderWidth: 1,
    borderRadius: RADIUS.full,
    paddingHorizontal: 8,
    paddingVertical: 4,
    alignItems: 'center',
  },
  pointsText: { fontSize: 12, fontWeight: '800' },

  rowContent: { flex: 1, gap: 2 },
  rowTitle: { color: COLORS.text, fontSize: 14, fontWeight: '700' },
  rowTitleEarned: { color: COLORS.textSub },
  rowSub: { color: COLORS.textMuted, fontSize: 11 },

  lockDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
