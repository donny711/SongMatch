import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Share,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AvatarWithFrame } from '../profile/AvatarWithFrame';
import {
  getSquadMembers,
  getOrCreateReferralCode,
  type SquadData,
} from '../../firebase/referralService';
import { COLORS, SPACING, RADIUS } from '../../theme';

interface Props {
  uid: string;
  viewerUid: string;
  isOwnProfile: boolean;
}

const TIER1 = 3;

export function SquadSection({ uid, viewerUid, isOwnProfile }: Props) {
  const [squad, setSquad] = useState<SquadData | null>(null);
  const [loading, setLoading] = useState(true);
  const [code, setCode] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    getSquadMembers(uid)
      .then((d) => { if (active) setSquad(d); })
      .catch(() => { if (active) setSquad({ members: [], isReferrer: false, installCount: 0, tier1Rewarded: false, tier2Rewarded: false }); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [uid]);

  useEffect(() => {
    if (!isOwnProfile) return;
    let active = true;
    getOrCreateReferralCode(uid).then((c) => { if (active) setCode(c); }).catch(() => {});
    return () => { active = false; };
  }, [isOwnProfile, uid]);

  if (loading) {
    return (
      <View style={styles.wrap}>
        <Text style={styles.label}>YOUR SQUAD</Text>
        <ActivityIndicator color={COLORS.purple} size="small" style={{ alignSelf: 'flex-start', marginTop: 4 }} />
      </View>
    );
  }

  if (!squad) return null;

  // On other profiles: only visible when viewer is in the squad
  if (!isOwnProfile && !squad.members.some((m) => m.uid === viewerUid)) {
    return null;
  }

  const handleShare = async () => {
    try {
      let shareCode = code;
      if (!shareCode) {
        shareCode = await getOrCreateReferralCode(uid);
        setCode(shareCode);
      }
      await Share.share({ message: `Join me on SoundMatch! Use code: ${shareCode}` });
    } catch {}
  };

  // State 1: No squad yet — CTA (own profile only)
  if (squad.members.length === 0) {
    if (!isOwnProfile) return null;
    return (
      <View style={styles.wrap}>
        <Text style={styles.label}>YOUR SQUAD</Text>
        <View style={styles.ctaCard}>
          <View style={styles.ctaBar} />
          <View style={styles.ctaInner}>
            <Text style={styles.ctaTitle}>Refer 3 friends, get 30% off</Text>
            <Text style={styles.ctaSub}>
              Everyone in your squad gets 30% off their next 3 billing cycles
            </Text>
            <TouchableOpacity style={styles.ctaBtn} onPress={handleShare} activeOpacity={0.8}>
              <Ionicons name="share-outline" size={15} color="#fff" />
              <Text style={styles.ctaBtnText}>Share your code</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }

  // State 3: Tier 1 unlocked
  if (squad.tier1Rewarded) {
    return (
      <View style={styles.wrap}>
        <View style={styles.row}>
          <Text style={styles.label}>YOUR SQUAD</Text>
          <View style={styles.pill}>
            <Ionicons name="checkmark-circle" size={13} color="#10B981" />
            <Text style={styles.pillText}>Tier 1 unlocked · 30% off</Text>
          </View>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.avatarRow}>
          {squad.members.map((m) => (
            <View key={m.uid} style={styles.avatarWrap}>
              <AvatarWithFrame uri={m.avatarUrl} frameId={null} size={52} />
              {m.isReferrer && (
                <View style={styles.crown}>
                  <Ionicons name="ribbon" size={11} color="#F59E0B" />
                </View>
              )}
              <Text style={styles.name} numberOfLines={1}>{m.username ?? m.displayName.split(' ')[0]}</Text>
            </View>
          ))}
        </ScrollView>
      </View>
    );
  }

  // State 2: Building toward tier 1
  const progress = Math.min(squad.installCount / TIER1, 1);
  const remaining = Math.max(TIER1 - squad.installCount, 0);

  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        <Text style={styles.label}>YOUR SQUAD</Text>
        <Text style={styles.hint}>{squad.installCount}/{TIER1} · {remaining} more to unlock</Text>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.avatarRow}>
        {squad.members.map((m) => (
          <View key={m.uid} style={styles.avatarWrap}>
            <AvatarWithFrame uri={m.avatarUrl} frameId={null} size={52} />
            {m.isReferrer && (
              <View style={styles.crown}>
                <Ionicons name="ribbon" size={11} color="#F59E0B" />
              </View>
            )}
            <Text style={styles.name} numberOfLines={1}>{m.username ?? m.displayName.split(' ')[0]}</Text>
          </View>
        ))}
      </ScrollView>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${Math.round(progress * 100)}%` }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: SPACING.lg, paddingHorizontal: SPACING.md },
  label: { fontSize: 11, fontWeight: '700', color: COLORS.textMuted, letterSpacing: 1.2, marginBottom: SPACING.sm, textTransform: 'uppercase' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: SPACING.sm },
  hint: { fontSize: 12, color: COLORS.textMuted },
  avatarRow: { gap: 12, paddingRight: SPACING.md },
  avatarWrap: { alignItems: 'center', gap: 4, position: 'relative' },
  crown: { position: 'absolute', top: -3, right: -3, backgroundColor: COLORS.bg, borderRadius: 8, padding: 2 },
  name: { fontSize: 11, color: COLORS.textMuted, maxWidth: 52, textAlign: 'center' },
  track: { height: 4, backgroundColor: COLORS.border, borderRadius: 2, marginTop: SPACING.sm, overflow: 'hidden' },
  fill: { height: '100%', backgroundColor: COLORS.purple, borderRadius: 2 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#052e16', borderRadius: RADIUS.sm, paddingHorizontal: 8, paddingVertical: 3 },
  pillText: { fontSize: 12, color: '#10B981', fontWeight: '600' },
  ctaCard: { flexDirection: 'row', backgroundColor: COLORS.surface, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.border, overflow: 'hidden' },
  ctaBar: { width: 4, backgroundColor: COLORS.purple },
  ctaInner: { flex: 1, padding: SPACING.md, gap: 4 },
  ctaTitle: { fontSize: 15, fontWeight: '700', color: COLORS.text },
  ctaSub: { fontSize: 13, color: COLORS.textMuted, lineHeight: 18 },
  ctaBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', backgroundColor: COLORS.purple, borderRadius: RADIUS.sm, paddingHorizontal: 14, paddingVertical: 8, marginTop: 8 },
  ctaBtnText: { color: '#fff', fontSize: 13, fontWeight: '600' },
});
