import React, { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useFeed } from '../../src/hooks/useFeed';
import { FeedItem } from '../../src/components/social/FeedItem';
import { UserCard } from '../../src/components/social/UserCard';
import { LeaderboardRow } from '../../src/components/social/LeaderboardRow';
import { AvatarWithFrame } from '../../src/components/profile/AvatarWithFrame';
import {
  searchUsers,
  getSuggestedUsers,
  getLeaderboard,
  getFollowing,
  type PublicUser,
  type LeaderboardField,
} from '../../src/firebase/socialService';
import {
  getReferralLeaderboard,
  type ReferralLeaderboardEntry,
} from '../../src/firebase/referralService';
import { useProfileStore } from '../../src/store/profileStore';
import { useDeckStore } from '../../src/store/deckStore';
import { COLORS, SPACING, RADIUS } from '../../src/theme';
import GradientText from '../../src/components/GradientText';
import LottieEmptyState from '../../src/components/LottieEmptyState';
import emptyPeopleAnim from '../../assets/lottie/empty-people.json';

type Segment = 'friends' | 'discover' | 'leaderboard';
type LbField = LeaderboardField;
type TabKey = LbField | 'invites';

// ── Segmented top bar ─────────────────────────────────────────────────────────

function SegmentBar({ active, onChange }: { active: Segment; onChange: (s: Segment) => void }) {
  const segments: { key: Segment; label: string; icon: string }[] = [
    { key: 'friends', label: 'Friends', icon: 'people' },
    { key: 'discover', label: 'Discover', icon: 'compass' },
    { key: 'leaderboard', label: 'Top', icon: 'trophy' },
  ];
  return (
    <View style={styles.segBar}>
      {segments.map((s) => (
        <TouchableOpacity
          key={s.key}
          style={[styles.segBtn, active === s.key && styles.segBtnActive]}
          onPress={() => onChange(s.key)}
          activeOpacity={0.75}
        >
          <Ionicons
            name={s.icon as any}
            size={14}
            color={active === s.key ? '#fff' : COLORS.textMuted}
          />
          <Text style={[styles.segText, active === s.key && styles.segTextActive]}>
            {s.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

// ── Feed segment ──────────────────────────────────────────────────────────────

function fmtN(n: number): string {
  return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

export function FeedSegment() {
  const { data: items = [], isLoading, refetch, isFetching } = useFeed();

  if (isLoading) {
    return <View style={styles.center}><ActivityIndicator color={COLORS.purple} /></View>;
  }

  if (items.length === 0) {
    return (
      <LottieEmptyState
        animationSource={emptyPeopleAnim}
        title="Nothing here yet"
        subtitle="Follow people to see what they are liking"
      />
    );
  }

  return (
    <FlatList
      data={items}
      keyExtractor={(item, i) => `${item.uid}_${item.trackId}_${i}`}
      renderItem={({ item }) => <FeedItem item={item} />}
      contentContainerStyle={styles.feedList}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={isFetching}
          onRefresh={refetch}
          tintColor={COLORS.purple}
        />
      }
      ItemSeparatorComponent={null}
    />
  );
}

// ── Friends segment ───────────────────────────────────────────────────────────

function FriendsSegment() {
  const myUid = useProfileStore((s) => s.uid);
  const [following, setFollowing] = useState<PublicUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback((showRefresh = false) => {
    if (!myUid) return;
    if (showRefresh) setRefreshing(true);
    getFollowing(myUid)
      .then(setFollowing)
      .catch(() => {})
      .finally(() => { setLoading(false); setRefreshing(false); });
  }, [myUid]);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return <View style={styles.center}><ActivityIndicator color={COLORS.purple} /></View>;
  }

  if (following.length === 0) {
    return (
      <LottieEmptyState
        animationSource={emptyPeopleAnim}
        title="Not following anyone yet"
        subtitle="Head to Discover to find people with your taste"
      />
    );
  }

  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={COLORS.purple} />
      }
    >
      {/* Avatar strip */}
      <View style={styles.friendsStripHeader}>
        <Text style={styles.friendsStripLabel}>Following</Text>
        <View style={styles.friendsCountBadge}>
          <Text style={styles.friendsCountText}>{following.length}</Text>
        </View>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.avatarStrip}
      >
        {following.map((u) => (
          <TouchableOpacity
            key={u.uid}
            style={styles.avatarBubble}
            onPress={() => router.push(`/user/${u.uid}`)}
            activeOpacity={0.75}
          >
            <View style={styles.avatarRing}>
              <AvatarWithFrame
                uri={u.avatarUrl}
                frameId={u.equippedItems?.avatarFrame ?? null}
                size={50}
              />
            </View>
            <Text style={styles.bubbleName} numberOfLines={1}>
              {u.displayName?.split(' ')[0] ?? 'User'}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Divider */}
      <View style={styles.friendsDivider} />

      {/* Full list */}
      <View style={styles.friendsList}>
        {following.map((u) => <UserCard key={u.uid} user={u} />)}
      </View>
    </ScrollView>
  );
}

// ── Discover segment ──────────────────────────────────────────────────────────

function DiscoverSegment({ onSeeAll }: { onSeeAll: () => void }) {
  const [searchText, setSearchText] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const myUid = useProfileStore((s) => s.uid) ?? '';
  const myArtistIds = useProfileStore((s) => s.showcaseArtists).map((a) => a.id);
  const likedTracks = useDeckStore((s) => s.likedTracks);

  const likedArtistIds = useMemo(() => {
    const ids = likedTracks.map((t) => t.artist.id);
    return [...new Set(ids)];
  }, [likedTracks]);

  const allArtistIds = useMemo(
    () => [...new Set([...myArtistIds, ...likedArtistIds])],
    [myArtistIds, likedArtistIds]
  );

  const handleSearchChange = (text: string) => {
    setSearchText(text);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setSearchQuery(text), 300);
  };

  const { data: searchResults = [], isFetching: searching } = useQuery<PublicUser[]>({
    queryKey: ['userSearch', searchQuery, myUid],
    queryFn: () => searchUsers(searchQuery, myUid),
    enabled: searchQuery.trim().length > 0,
    staleTime: 30 * 1000,
  });

  const { data: suggested = [], isLoading: loadingSuggested } = useQuery<PublicUser[]>({
    queryKey: ['suggested', myUid, allArtistIds.slice(0, 10).join(',')],
    queryFn: () => getSuggestedUsers(allArtistIds, myUid),
    enabled: !!myUid && searchQuery.trim().length === 0,
    staleTime: 5 * 60 * 1000,
  });

  const { data: topUsers = [] } = useQuery<PublicUser[]>({
    queryKey: ['leaderboard', 'points', 3],
    queryFn: () => getLeaderboard('points', 3),
    staleTime: 5 * 60 * 1000,
  });

  const showSearch = searchQuery.trim().length > 0;

  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.discoverContent}
      keyboardShouldPersistTaps="handled"
    >
      {/* Search */}
      <View style={styles.searchBar}>
        <Ionicons name="search" size={16} color={COLORS.textMuted} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search by name…"
          placeholderTextColor={COLORS.textMuted}
          value={searchText}
          onChangeText={handleSearchChange}
          autoCorrect={false}
          autoCapitalize="none"
          returnKeyType="search"
        />
        {searching && <ActivityIndicator size="small" color={COLORS.textMuted} />}
        {searchText.length > 0 && !searching && (
          <TouchableOpacity onPress={() => { setSearchText(''); setSearchQuery(''); }}>
            <Ionicons name="close-circle" size={16} color={COLORS.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      {showSearch ? (
        /* ── Search results ── */
        searchResults.length === 0 ? (
          <View style={styles.centerInline}>
            <Text style={styles.emptySub}>No users found for "{searchQuery}"</Text>
          </View>
        ) : (
          <View style={styles.cardList}>
            {searchResults.map((u) => <UserCard key={u.uid} user={u} />)}
          </View>
        )
      ) : (
        <>
          {/* ── Suggested ── */}
          {(suggested.length > 0 || loadingSuggested) && (
            <View style={styles.discoverSection}>
              <Text style={styles.discoverSectionTitle}>Suggested for you</Text>
              {loadingSuggested ? (
                <ActivityIndicator color={COLORS.purple} style={{ alignSelf: 'flex-start' }} />
              ) : (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.suggestedScroll}
                >
                  {suggested.map((u) => (
                    <TouchableOpacity
                      key={u.uid}
                      style={styles.suggestedCard}
                      onPress={() => router.push(`/user/${u.uid}`)}
                      activeOpacity={0.8}
                    >
                      <AvatarWithFrame
                        uri={u.avatarUrl}
                        frameId={u.equippedItems?.avatarFrame ?? null}
                        size={56}
                      />
                      <Text style={styles.suggestedName} numberOfLines={1}>
                        {u.displayName ?? 'User'}
                      </Text>
                      <Text style={styles.suggestedMeta}>{u.likedCount} liked</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              )}
            </View>
          )}

          {/* ── Leaderboard preview ── */}
          {topUsers.length > 0 && (
            <View style={styles.discoverSection}>
              <View style={styles.discoverSectionHeader}>
                <Text style={styles.discoverSectionTitle}>Top listeners</Text>
                <TouchableOpacity onPress={onSeeAll}>
                  <Text style={styles.seeAll}>See all</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.cardList}>
                {topUsers.map((u, i) => (
                  <LeaderboardRow key={u.uid} user={u} rank={i + 1} field="points" />
                ))}
              </View>
            </View>
          )}
        </>
      )}
    </ScrollView>
  );
}


// -- Invites leaderboard --
function InvitesLeaderboard({ myUid }: { myUid: string | null }) {
  const { data, isLoading } = useQuery<ReferralLeaderboardEntry[]>({
    queryKey: ['invites-leaderboard'],
    queryFn: () => getReferralLeaderboard(50),
    staleTime: 60_000,
  });

  if (isLoading) {
    return <View style={styles.center}><ActivityIndicator color={COLORS.purple} /></View>;
  }

  const entries = data ?? [];
  if (entries.length === 0) {
    return (
      <View style={styles.center}>
        <Text style={{ color: COLORS.textMuted, fontSize: 14 }}>No referrals yet</Text>
      </View>
    );
  }

  return (
    <FlatList
      data={entries}
      keyExtractor={(item) => item.uid}
      contentContainerStyle={styles.lbList}
      showsVerticalScrollIndicator={false}
      renderItem={({ item, index }) => {
        const isMe = item.uid === myUid;
        return (
          <View style={[styles.invRow, isMe && styles.invRowMe]}>
            <Text style={styles.invRank}>#{index + 1}</Text>
            <AvatarWithFrame uri={item.avatarUrl} frameId={null} size={40} />
            <View style={{ flex: 1 }}>
              <Text style={styles.invName} numberOfLines={1}>{item.displayName}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
                <Text style={styles.invScore}>{item.installCount} {item.installCount === 1 ? 'invite' : 'invites'}</Text>
                {item.tier2Rewarded && <View style={styles.tierBadge}><Text style={styles.tierBadgeText}>T2</Text></View>}
                {item.tier1Rewarded && !item.tier2Rewarded && <View style={[styles.tierBadge, { backgroundColor: '#374151' }]}><Text style={styles.tierBadgeText}>T1</Text></View>}
              </View>
            </View>
          </View>
        );
      }}
    />
  );
}

// ── Leaderboard segment ───────────────────────────────────────────────────────

function LeaderboardSegment() {
  const [field, setField] = useState<TabKey>('points');
  const myUid = useProfileStore((s) => s.uid);
  const myPoints = useProfileStore((s) => s.points);
  const myStreak = useProfileStore((s) => s.currentStreak);
  const myLiked = useProfileStore((s) => s.likedCount);

  const myValue = field === 'points' ? myPoints
    : field === 'currentStreak' ? myStreak
    : myLiked;

  const { data: users = [], isLoading } = useQuery<PublicUser[]>({
    queryKey: ['leaderboard', field],
    queryFn: () => getLeaderboard(field as LbField, 50),
    staleTime: 2 * 60 * 1000,
    enabled: field !== 'invites',
  });

  const myRank = users.findIndex((u) => u.uid === myUid) + 1;

  const fieldOptions: { key: TabKey; label: string }[] = [
    { key: 'points', label: 'Points' },
    { key: 'currentStreak', label: 'Streak' },
    { key: 'likedCount', label: 'Liked' },
    { key: 'invites', label: 'Invites' },
  ];

  return (
    <View style={{ flex: 1 }}>
      {/* Field selector */}
      <View style={styles.lbTabs}>
        {fieldOptions.map((f) => (
          <TouchableOpacity
            key={f.key}
            style={[styles.lbTab, field === f.key && styles.lbTabActive]}
            onPress={() => setField(f.key)}
            activeOpacity={0.75}
          >
            <Text style={[styles.lbTabText, field === f.key && styles.lbTabTextActive]}>
              {f.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* My rank pill */}
      {myUid && field !== 'invites' && (
        <View style={styles.myRankPill}>
          <Text style={styles.myRankText}>
            {myRank > 0 ? `#${myRank}` : 'Unranked'} — {fmtN(myValue)}{' '}
            {field === 'points' ? 'pts' : field === 'currentStreak' ? 'day streak' : 'liked'}
          </Text>
        </View>
      )}

      {field === 'invites' ? (
        <InvitesLeaderboard myUid={myUid ?? null} />
      ) : isLoading ? (
        <View style={styles.center}><ActivityIndicator color={COLORS.purple} /></View>
      ) : (
        <FlatList
          data={users}
          keyExtractor={(u) => u.uid}
          contentContainerStyle={styles.lbList}
          renderItem={({ item, index }) => (
            <LeaderboardRow user={item} rank={index + 1} field={field as LbField} />
          )}
          ItemSeparatorComponent={() => <View style={{ height: SPACING.xs }} />}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────

export default function PeopleScreen() {
  const insets = useSafeAreaInsets();
  const [segment, setSegment] = useState<Segment>('friends');

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <GradientText fontSize={34} hPad={24} letterSpacing={-0.5}>People</GradientText>
      </View>

      {/* Segment bar */}
      <SegmentBar active={segment} onChange={setSegment} />

      {/* Content */}
      <View style={styles.content}>
        {segment === 'friends' && <FriendsSegment />}
        {segment === 'discover' && <DiscoverSegment onSeeAll={() => setSegment('leaderboard')} />}
        {segment === 'leaderboard' && <LeaderboardSegment />}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },

  header: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.md,
  },

  // Segment bar
  segBar: {
    flexDirection: 'row',
    paddingHorizontal: SPACING.lg,
    gap: SPACING.sm,
    paddingBottom: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  segBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 8,
    borderRadius: RADIUS.lg,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  segBtnActive: {
    backgroundColor: COLORS.purple,
    borderColor: COLORS.purple,
  },
  segText: { color: COLORS.textMuted, fontSize: 12, fontWeight: '700' },
  segTextActive: { color: '#fff' },

  content: { flex: 1 },

  // Common
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: SPACING.sm, padding: SPACING.xxl },
  centerInline: { alignItems: 'center', paddingVertical: SPACING.lg },
  emptyTitle: { color: COLORS.textSub, fontSize: 16, fontWeight: '700' },
  emptySub: { color: COLORS.textMuted, fontSize: 13, textAlign: 'center', lineHeight: 19 },
  discoverBtn: {
    marginTop: SPACING.sm,
    backgroundColor: COLORS.purple,
    paddingHorizontal: SPACING.lg,
    paddingVertical: 10,
    borderRadius: RADIUS.full,
  },
  discoverBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },

  // Feed
  feedList: { paddingVertical: SPACING.sm },

  // Friends
  friendsStripHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.sm,
  },
  friendsStripLabel: {
    color: COLORS.textSub,
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  friendsCountBadge: {
    backgroundColor: 'rgba(167,139,250,0.18)',
    borderRadius: RADIUS.full,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: 'rgba(167,139,250,0.30)',
  },
  friendsCountText: {
    color: COLORS.purple,
    fontSize: 11,
    fontWeight: '800',
  },
  avatarStrip: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    gap: SPACING.md,
  },
  avatarBubble: {
    alignItems: 'center',
    gap: 6,
    width: 66,
  },
  avatarRing: {
    width: 58,
    height: 58,
    borderRadius: 29,
    borderWidth: 2,
    borderColor: COLORS.purple,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 2,
  },
  bubbleName: {
    color: COLORS.textSub,
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
  },
  friendsDivider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginHorizontal: SPACING.lg,
    marginVertical: SPACING.sm,
  },
  friendsList: {
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.xxl,
    gap: SPACING.xs,
  },
  feedSep: { height: 1, backgroundColor: COLORS.border, marginHorizontal: SPACING.lg },

  // Discover
  discoverContent: { padding: SPACING.lg, gap: SPACING.lg },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: SPACING.md,
    paddingVertical: 10,
  },
  searchInput: {
    flex: 1,
    color: COLORS.text,
    fontSize: 15,
  },
  discoverSection: { gap: SPACING.sm },
  discoverSectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  discoverSectionTitle: { color: COLORS.textSub, fontSize: 13, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8 },
  seeAll: { color: COLORS.purple, fontSize: 12, fontWeight: '700' },
  cardList: { gap: SPACING.xs },

  suggestedScroll: { gap: SPACING.md, paddingVertical: SPACING.xs },
  suggestedCard: { alignItems: 'center', gap: 5, width: 72 },
  suggestedName: { color: COLORS.textSub, fontSize: 11, fontWeight: '600', textAlign: 'center' },
  suggestedMeta: { color: COLORS.textMuted, fontSize: 10 },

  // Leaderboard
  lbTabs: {
    flexDirection: 'row',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    gap: SPACING.sm,
  },
  lbTab: {
    flex: 1,
    paddingVertical: 7,
    borderRadius: RADIUS.lg,
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  lbTabActive: { backgroundColor: 'rgba(167,139,250,0.2)', borderColor: COLORS.purple },
  lbTabText: { color: COLORS.textMuted, fontSize: 12, fontWeight: '700' },
  lbTabTextActive: { color: COLORS.purple },
  myRankPill: {
    marginHorizontal: SPACING.lg,
    marginBottom: SPACING.sm,
    backgroundColor: 'rgba(167,139,250,0.12)',
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: 'rgba(167,139,250,0.3)',
    paddingHorizontal: SPACING.md,
    paddingVertical: 8,
    alignItems: 'center',
  },
  myRankText: { color: COLORS.purple, fontSize: 13, fontWeight: '700' },
  lbList: { paddingHorizontal: SPACING.lg, paddingBottom: SPACING.xxl },
  invRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACING.md, paddingVertical: 10, gap: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: COLORS.border },
  invRowMe: { borderLeftWidth: 3, borderLeftColor: COLORS.purple, paddingLeft: SPACING.md - 3, backgroundColor: 'rgba(167,139,250,0.06)' },
  invRank: { width: 28, textAlign: 'center', fontSize: 12, fontWeight: '600', color: COLORS.textMuted },
  invName: { fontSize: 14, fontWeight: '600', color: COLORS.text },
  invScore: { fontSize: 12, color: COLORS.textMuted },
  tierBadge: { backgroundColor: COLORS.purple, borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1 },
  tierBadgeText: { color: '#fff', fontSize: 10, fontWeight: '700', letterSpacing: 0.3 },
});
