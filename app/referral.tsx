import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Share,
  ActivityIndicator,
  TextInput,
  ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import { useProfileStore } from '../src/store/profileStore';
import { getOrCreateReferralCode, getReferralStats, recordReferralInstall } from '../src/firebase/referralService';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../src/firebase/config';
import { COLORS, SPACING, RADIUS } from '../src/theme';

const TIER1_TARGET = 3;
const TIER2_TARGET = 7;

interface Stats {
  code: string;
  installCount: number;
  tier1Rewarded: boolean;
  tier2Rewarded: boolean;
}

// ── Milestone row ─────────────────────────────────────────────────────────────

function MilestoneRow({
  icon,
  title,
  sub,
  reached,
  progress,
  target,
}: {
  icon: string;
  title: string;
  sub: string;
  reached: boolean;
  progress: number;
  target: number;
}) {
  const pct = Math.min(1, progress / target);
  return (
    <View style={[styles.milestoneCard, reached && styles.milestoneCardReached]}>
      <View style={styles.milestoneTop}>
        <View style={[styles.milestoneIcon, reached && styles.milestoneIconReached]}>
          <Ionicons name={icon as any} size={18} color={reached ? '#fff' : COLORS.textMuted} />
        </View>
        <View style={styles.milestoneText}>
          <Text style={[styles.milestoneTitle, reached && styles.milestoneTitleReached]}>{title}</Text>
          <Text style={styles.milestoneSub}>{sub}</Text>
        </View>
        {reached && (
          <View style={styles.reachedBadge}>
            <Ionicons name="checkmark-circle" size={20} color={COLORS.purple} />
          </View>
        )}
      </View>
      {!reached && (
        <View style={styles.progressBarBg}>
          <View style={[styles.progressBarFill, { width: `${Math.round(pct * 100)}%` }]} />
        </View>
      )}
      {!reached && (
        <Text style={styles.progressLabel}>{progress} / {target} installs</Text>
      )}
    </View>
  );
}

// ── Screen ────────────────────────────────────────────────────────────────────

export default function ReferralScreen() {
  const insets = useSafeAreaInsets();
  const uid = useProfileStore((s) => s.uid);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const [redeeming, setRedeeming] = useState(false);
  const [redeemError, setRedeemError] = useState<string | null>(null);
  const [redeemSuccess, setRedeemSuccess] = useState(false);
  const [alreadyReferred, setAlreadyReferred] = useState(false);

  useEffect(() => {
    if (!uid) return;
    (async () => {
      try {
        const code = await getOrCreateReferralCode(uid);
        const existing = await getReferralStats(uid);
        setStats(existing ?? { code, installCount: 0, tier1Rewarded: false, tier2Rewarded: false });

        const userSnap = await getDoc(doc(db, 'users', uid));
        if (userSnap.exists() && (userSnap.data() as { referredBy?: string }).referredBy) {
          setAlreadyReferred(true);
        }
      } catch {
        // Non-critical
      } finally {
        setLoading(false);
      }
    })();
  }, [uid]);

  const shareLink = `https://songmatch.net/invite/${stats?.code ?? ''}`;

  const handleCopy = async () => {
    if (!stats?.code) return;
    await Clipboard.setStringAsync(stats.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = async () => {
    await Share.share({
      message: `Join me on SongMatch — the best music discovery app! Use my code ${stats?.code} and we both get 30% off Pro.\n\n${shareLink}`,
      url: shareLink,
    });
  };

  const handleRedeem = async () => {
    const code = manualCode.trim().toUpperCase();
    if (!code || !uid) return;

    setRedeeming(true);
    setRedeemError(null);

    try {
      // Own code check
      if (stats?.code === code) {
        setRedeemError("You can't use your own code");
        return;
      }

      // Code existence check
      const codeSnap = await getDoc(doc(db, 'referrals', code));
      if (!codeSnap.exists()) {
        setRedeemError('Invalid code');
        return;
      }

      await recordReferralInstall(uid, code);
      setRedeemSuccess(true);
      setAlreadyReferred(true);
      setManualCode('');
    } catch {
      setRedeemError('Something went wrong. Please try again.');
    } finally {
      setRedeeming(false);
    }
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => router.back()}
          hitSlop={12}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={22} color={COLORS.textSub} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Invite Friends</Text>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <View style={styles.loader}>
          <ActivityIndicator color={COLORS.purple} />
        </View>
      ) : (
        <ScrollView style={styles.content} contentContainerStyle={styles.contentInner} showsVerticalScrollIndicator={false}>
          {/* Hero */}
          <View style={styles.hero}>
            <LinearGradient
              colors={['#A78BFA', '#E879F9']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.heroIcon}
            >
              <Ionicons name="people" size={28} color="#fff" />
            </LinearGradient>
            <Text style={styles.heroTitle}>Invite friends, get rewards</Text>
            <Text style={styles.heroSub}>
              Share your code. Both you and your friends get 30% off when they install.
            </Text>
          </View>

          {/* Code card */}
          <View style={styles.codeCard}>
            <Text style={styles.codeLabel}>Your referral code</Text>
            <Text style={styles.codeValue}>{stats?.code ?? '—'}</Text>
            <View style={styles.codeActions}>
              <TouchableOpacity style={styles.codeBtn} onPress={handleCopy} activeOpacity={0.8}>
                <Ionicons name={copied ? 'checkmark' : 'copy-outline'} size={15} color={COLORS.purple} />
                <Text style={styles.codeBtnText}>{copied ? 'Copied!' : 'Copy code'}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.codeBtn, styles.codeBtnShare]} onPress={handleShare} activeOpacity={0.8}>
                <Ionicons name="share-outline" size={15} color="#fff" />
                <Text style={[styles.codeBtnText, { color: '#fff' }]}>Share link</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Milestones */}
          <View style={styles.milestones}>
            <Text style={styles.milestonesTitle}>Rewards</Text>
            <MilestoneRow
              icon="pricetag"
              title="Tier 1 — 3 friends install"
              sub="You + all 3 friends get 30% off next billing cycle"
              reached={stats?.tier1Rewarded ?? false}
              progress={Math.min(stats?.installCount ?? 0, TIER1_TARGET)}
              target={TIER1_TARGET}
            />
            <MilestoneRow
              icon="gift"
              title="Tier 2 — 7 friends install"
              sub="You get 1 month completely free"
              reached={stats?.tier2Rewarded ?? false}
              progress={Math.min(stats?.installCount ?? 0, TIER2_TARGET)}
              target={TIER2_TARGET}
            />
          </View>

          <Text style={styles.note}>
            Rewards trigger on install + first open. Discounts apply automatically on next billing cycle. Rewards stack — hit 7 and get both.
          </Text>

          {/* Manual code entry — hidden if already referred */}
          {!alreadyReferred && (
            <View style={styles.redeemSection}>
              <Text style={styles.milestonesTitle}>Have a friend's code?</Text>
              {redeemSuccess ? (
                <View style={styles.redeemSuccess}>
                  <Ionicons name="checkmark-circle" size={18} color={COLORS.green} />
                  <Text style={styles.redeemSuccessText}>Code applied — 30% off for 3 months when your referrer hits 3 installs</Text>
                </View>
              ) : (
                <>
                  <View style={styles.redeemRow}>
                    <TextInput
                      style={styles.redeemInput}
                      value={manualCode}
                      onChangeText={(t) => { setManualCode(t.toUpperCase()); setRedeemError(null); }}
                      placeholder="Enter code"
                      placeholderTextColor={COLORS.textMuted}
                      autoCapitalize="characters"
                      maxLength={8}
                      keyboardAppearance="dark"
                    />
                    <TouchableOpacity
                      style={[styles.redeemBtn, (!manualCode.trim() || redeeming) && styles.redeemBtnDisabled]}
                      onPress={handleRedeem}
                      disabled={!manualCode.trim() || redeeming}
                      activeOpacity={0.85}
                    >
                      {redeeming
                        ? <ActivityIndicator size="small" color="#fff" />
                        : <Text style={styles.redeemBtnText}>Redeem</Text>
                      }
                    </TouchableOpacity>
                  </View>
                  {redeemError && (
                    <Text style={styles.redeemError}>{redeemError}</Text>
                  )}
                </>
              )}
            </View>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { color: COLORS.text, fontSize: 18, fontWeight: '800', letterSpacing: -0.3 },

  loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  content: {
    flex: 1,
  },
  contentInner: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.xl,
    paddingBottom: SPACING.xxl,
    gap: SPACING.xl,
  },

  hero: { alignItems: 'center', gap: SPACING.md },
  heroIcon: {
    width: 64,
    height: 64,
    borderRadius: RADIUS.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroTitle: { color: COLORS.text, fontSize: 22, fontWeight: '900', letterSpacing: -0.4 },
  heroSub: {
    color: COLORS.textMuted,
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 21,
    maxWidth: 280,
  },

  codeCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.lg,
    alignItems: 'center',
    gap: SPACING.sm,
  },
  codeLabel: { color: COLORS.textMuted, fontSize: 12, fontWeight: '600', letterSpacing: 0.8 },
  codeValue: {
    color: COLORS.text,
    fontSize: 32,
    fontWeight: '900',
    letterSpacing: 6,
  },
  codeActions: { flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.sm },
  codeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: SPACING.md,
    paddingVertical: 9,
    borderRadius: RADIUS.full,
    borderWidth: 1.5,
    borderColor: COLORS.purple,
    backgroundColor: 'rgba(167,139,250,0.08)',
  },
  codeBtnShare: {
    backgroundColor: COLORS.purple,
    borderColor: COLORS.purple,
  },
  codeBtnText: { color: COLORS.purple, fontSize: 13, fontWeight: '700' },

  milestones: { gap: SPACING.md },
  milestonesTitle: {
    color: COLORS.textMuted,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  milestoneCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.md,
    gap: SPACING.sm,
  },
  milestoneCardReached: {
    borderColor: 'rgba(167,139,250,0.4)',
    backgroundColor: 'rgba(167,139,250,0.06)',
  },
  milestoneTop: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
  milestoneIcon: {
    width: 38,
    height: 38,
    borderRadius: RADIUS.sm,
    backgroundColor: 'rgba(167,139,250,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  milestoneIconReached: { backgroundColor: COLORS.purple },
  milestoneText: { flex: 1, gap: 2 },
  milestoneTitle: { color: COLORS.textMuted, fontSize: 14, fontWeight: '700' },
  milestoneTitleReached: { color: COLORS.text },
  milestoneSub: { color: COLORS.textMuted, fontSize: 12, lineHeight: 17 },
  reachedBadge: { marginLeft: 'auto' },

  progressBarBg: {
    height: 4,
    backgroundColor: 'rgba(167,139,250,0.15)',
    borderRadius: RADIUS.full,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: COLORS.purple,
    borderRadius: RADIUS.full,
  },
  progressLabel: { color: COLORS.textMuted, fontSize: 11 },

  note: {
    color: COLORS.textMuted,
    fontSize: 11,
    textAlign: 'center',
    lineHeight: 17,
  },
  redeemSection: { gap: SPACING.sm },
  redeemRow: { flexDirection: 'row', gap: SPACING.sm },
  redeemInput: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    color: COLORS.text,
    paddingHorizontal: SPACING.md,
    paddingVertical: 12,
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 2,
  },
  redeemBtn: {
    backgroundColor: COLORS.purple,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.lg,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 88,
    minHeight: 46,
  },
  redeemBtnDisabled: { opacity: 0.4 },
  redeemBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  redeemError: { color: '#F87171', fontSize: 12 },
  redeemSuccess: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingVertical: SPACING.sm,
  },
  redeemSuccessText: { color: COLORS.green, fontSize: 13, fontWeight: '600', flex: 1 },
});
