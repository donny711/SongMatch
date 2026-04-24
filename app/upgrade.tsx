import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useSubscriptionStore, type ProTier } from '../src/store/subscriptionStore';
import { useProfileStore } from '../src/store/profileStore';
import { saveSubscriptionToFirestore } from '../src/firebase/subscriptionService';
import { getPendingRewards, markDiscountRedeemed } from '../src/firebase/referralService';
import { COLORS, SPACING, RADIUS } from '../src/theme';

// ── Plan config ───────────────────────────────────────────────────────────────

const PLANS: {
  tier: ProTier;
  label: string;
  price: string;
  perMonth: string;
  badge?: string;
}[] = [
  { tier: 'monthly',   label: 'Monthly',   price: '€3.99/mo',         perMonth: '€3.99' },
  { tier: 'quarterly', label: 'Quarterly', price: '€9.99 / 3 months', perMonth: '€3.33', badge: 'SAVE 33%' },
  { tier: 'annual',    label: 'Annual',    price: '€39.99/year',       perMonth: '€3.33', badge: 'BEST VALUE' },
];

const PRO_PERKS = [
  { icon: 'infinite',           label: 'Unlimited searches',               sub: 'No daily limit ever' },
  { icon: 'color-palette',      label: '22 exclusive app icons',           sub: 'Swap your home screen icon anytime' },
  { icon: 'ban',                label: 'Zero ads',                         sub: 'Everywhere in the app' },
  { icon: 'trophy',             label: 'Pro badge',                        sub: 'Gold crown on leaderboards & profiles' },
  { icon: 'storefront',         label: 'Full shop access',                 sub: 'All cosmetics, frames & badges' },
  { icon: 'flash',              label: 'Early access',                     sub: 'New features before everyone else' },
];

// ── PlanCard ──────────────────────────────────────────────────────────────────

function PlanCard({
  plan,
  selected,
  onSelect,
}: {
  plan: typeof PLANS[number];
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <TouchableOpacity
      style={[styles.planCard, selected && styles.planCardSelected]}
      onPress={onSelect}
      activeOpacity={0.85}
    >
      {plan.badge && (
        <View style={styles.planBadge}>
          <LinearGradient
            colors={['#A78BFA', '#E879F9']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.planBadgeGrad}
          >
            <Text style={styles.planBadgeText}>{plan.badge}</Text>
          </LinearGradient>
        </View>
      )}

      <View style={styles.planRow}>
        <View style={[styles.planRadio, selected && styles.planRadioSelected]}>
          {selected && <View style={styles.planRadioDot} />}
        </View>
        <View style={styles.planInfo}>
          <Text style={[styles.planLabel, selected && styles.planLabelSelected]}>{plan.label}</Text>
          <Text style={styles.planPrice}>{plan.price}</Text>
        </View>
        <Text style={styles.planPerMonth}>{plan.perMonth}<Text style={styles.planPerMonthSub}>/mo</Text></Text>
      </View>
    </TouchableOpacity>
  );
}

// ── RewardBanner ──────────────────────────────────────────────────────────────

function RewardBanner({ discount, discountMonths, freeMonth }: { discount: number | null; discountMonths: number | null; freeMonth: boolean }) {
  if (!discount && !freeMonth) return null;

  const label = freeMonth
    ? '🎁 You\'ve earned 1 free month — referral reward'
    : `🎁 You have ${Math.round((discount ?? 0) * 100)}% off for ${discountMonths ?? 1} month${(discountMonths ?? 1) > 1 ? 's' : ''} — referral reward`;

  return (
    <View style={rewardBannerStyles.wrap}>
      <LinearGradient
        colors={['rgba(167,139,250,0.18)', 'rgba(232,121,249,0.12)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={rewardBannerStyles.grad}
      >
        <Ionicons name="gift" size={16} color={COLORS.purple} />
        <Text style={rewardBannerStyles.text}>{label}</Text>
      </LinearGradient>
    </View>
  );
}

const rewardBannerStyles = StyleSheet.create({
  wrap: { borderRadius: RADIUS.lg, overflow: 'hidden' },
  grad: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.md,
    paddingVertical: 12,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: 'rgba(167,139,250,0.35)',
  },
  text: { color: COLORS.text, fontSize: 13, fontWeight: '700', flex: 1 },
});

// ── Screen ────────────────────────────────────────────────────────────────────

export default function UpgradeScreen() {
  const insets = useSafeAreaInsets();
  const [selectedTier, setSelectedTier] = useState<ProTier>('annual');
  const [purchasing, setPurchasing] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [pendingDiscount, setPendingDiscount] = useState<number | null>(null);
  const [pendingDiscountMonths, setPendingDiscountMonths] = useState<number | null>(null);
  const [freeMonthGranted, setFreeMonthGranted] = useState(false);

  const { purchase, restore, isPro } = useSubscriptionStore();
  const uid = useProfileStore((s) => s.uid);

  useEffect(() => {
    if (!uid) return;
    let cancelled = false;
    getPendingRewards(uid).then(({ pendingDiscount, pendingDiscountMonths, freeMonthGranted }) => {
      if (!cancelled) {
        setPendingDiscount(pendingDiscount);
        setPendingDiscountMonths(pendingDiscountMonths);
        setFreeMonthGranted(freeMonthGranted);
      }
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [uid]);

  const handlePurchase = useCallback(async () => {
    setPurchasing(true);
    try {
      await purchase(selectedTier);
      if (uid) {
        await saveSubscriptionToFirestore(uid, {
          isPro: true,
          tier: selectedTier,
          expiresAt: null,
        });
      }
      if (uid && (pendingDiscount || freeMonthGranted)) {
        markDiscountRedeemed(uid).catch(() => {});
      }
      Alert.alert('Welcome to Pro!', 'Your subscription is now active.', [
        { text: 'Let\'s go!', onPress: () => router.back() },
      ]);
    } catch (e: any) {
      if (e?.code !== 'PURCHASE_CANCELLED') {
        Alert.alert('Purchase failed', e?.message ?? 'Please try again.');
      }
    } finally {
      setPurchasing(false);
    }
  }, [selectedTier, uid, purchase, pendingDiscount, freeMonthGranted]);

  const handleRestore = useCallback(async () => {
    setRestoring(true);
    try {
      await restore();
      if (isPro) {
        Alert.alert('Restored!', 'Your Pro subscription has been restored.', [
          { text: 'Done', onPress: () => router.back() },
        ]);
      } else {
        Alert.alert('No active subscription', 'No Pro subscription found for this Apple ID.');
      }
    } catch {
      Alert.alert('Restore failed', 'Please try again.');
    } finally {
      setRestoring(false);
    }
  }, [restore, isPro]);

  return (
    <View style={[styles.root, { paddingBottom: insets.bottom }]}>
      {/* ── Header ── */}
      <View style={[styles.header, { paddingTop: insets.top + SPACING.sm }]}>
        <TouchableOpacity
          style={styles.closeBtn}
          onPress={() => router.back()}
          hitSlop={12}
          activeOpacity={0.7}
        >
          <Ionicons name="close" size={22} color={COLORS.textSub} />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Reward banner ── */}
        <RewardBanner discount={pendingDiscount} discountMonths={pendingDiscountMonths} freeMonth={freeMonthGranted} />

        {/* ── Hero ── */}
        <View style={styles.hero}>
          <LinearGradient
            colors={['#A78BFA', '#E879F9']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.heroIcon}
          >
            <Ionicons name="flash" size={32} color="#fff" />
          </LinearGradient>
          <Text style={styles.heroTitle}>SongMatch Pro</Text>
          <Text style={styles.heroSub}>
            Unlimited music discovery. No limits, no ads.
          </Text>
        </View>

        {/* ── Perks ── */}
        <View style={styles.perksCard}>
          {PRO_PERKS.map((perk, i) => (
            <React.Fragment key={perk.icon}>
              <View style={styles.perkRow}>
                <View style={styles.perkIconWrap}>
                  <Ionicons name={perk.icon as any} size={17} color={COLORS.purple} />
                </View>
                <View style={styles.perkText}>
                  <Text style={styles.perkLabel}>{perk.label}</Text>
                  <Text style={styles.perkSub}>{perk.sub}</Text>
                </View>
              </View>
              {i < PRO_PERKS.length - 1 && <View style={styles.perkDivider} />}
            </React.Fragment>
          ))}
        </View>

        {/* ── Plans ── */}
        <View style={styles.plans}>
          <Text style={styles.plansTitle}>Choose your plan</Text>
          {PLANS.map((plan) => (
            <PlanCard
              key={plan.tier}
              plan={plan}
              selected={selectedTier === plan.tier}
              onSelect={() => setSelectedTier(plan.tier)}
            />
          ))}
        </View>

        {/* ── CTA ── */}
        <TouchableOpacity
          style={styles.ctaBtn}
          onPress={handlePurchase}
          activeOpacity={0.88}
          disabled={purchasing}
        >
          <LinearGradient
            colors={['#A78BFA', '#E879F9']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.ctaGrad}
          >
            {purchasing
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.ctaText}>Start Pro · {PLANS.find(p => p.tier === selectedTier)?.perMonth}/mo</Text>
            }
          </LinearGradient>
        </TouchableOpacity>

        {/* ── Restore / legal ── */}
        <TouchableOpacity
          style={styles.restoreBtn}
          onPress={handleRestore}
          disabled={restoring}
          activeOpacity={0.7}
        >
          <Text style={styles.restoreText}>
            {restoring ? 'Restoring…' : 'Restore purchases'}
          </Text>
        </TouchableOpacity>

        <Text style={styles.legal}>
          Subscription renews automatically. Cancel anytime in your App Store settings.
          Prices shown in EUR.
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },

  header: {
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.sm,
    alignItems: 'flex-end',
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },

  content: {
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.xxl,
    gap: SPACING.xl,
  },

  // Hero
  hero: { alignItems: 'center', gap: SPACING.md, paddingVertical: SPACING.sm },
  heroIcon: {
    width: 72,
    height: 72,
    borderRadius: RADIUS.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroTitle: {
    color: COLORS.text,
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: -0.6,
  },
  heroSub: {
    color: COLORS.textMuted,
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
    maxWidth: 260,
  },

  // Perks
  perksCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
  },
  perkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    gap: SPACING.md,
  },
  perkIconWrap: {
    width: 34,
    height: 34,
    borderRadius: RADIUS.sm,
    backgroundColor: 'rgba(167,139,250,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  perkText: { flex: 1, gap: 2 },
  perkLabel: { color: COLORS.text, fontSize: 14, fontWeight: '600' },
  perkSub: { color: COLORS.textMuted, fontSize: 12 },
  perkDivider: { height: 1, backgroundColor: COLORS.border, marginHorizontal: SPACING.md },

  // Plans
  plans: { gap: SPACING.sm },
  plansTitle: {
    color: COLORS.textMuted,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    paddingHorizontal: 2,
  },
  planCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    padding: SPACING.md,
    overflow: 'visible',
  },
  planCardSelected: {
    borderColor: COLORS.purple,
    backgroundColor: 'rgba(167,139,250,0.08)',
  },
  planBadge: {
    position: 'absolute',
    top: -11,
    right: SPACING.md,
    zIndex: 1,
  },
  planBadgeGrad: {
    borderRadius: RADIUS.full,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  planBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  planRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  planRadio: {
    width: 20,
    height: 20,
    borderRadius: RADIUS.full,
    borderWidth: 2,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  planRadioSelected: { borderColor: COLORS.purple },
  planRadioDot: {
    width: 10,
    height: 10,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.purple,
  },
  planInfo: { flex: 1, gap: 2 },
  planLabel: { color: COLORS.textMuted, fontSize: 15, fontWeight: '700' },
  planLabelSelected: { color: COLORS.text },
  planPrice: { color: COLORS.textMuted, fontSize: 12 },
  planPerMonth: { color: COLORS.text, fontSize: 17, fontWeight: '800' },
  planPerMonthSub: { color: COLORS.textMuted, fontSize: 12, fontWeight: '400' },

  // CTA
  ctaBtn: { borderRadius: RADIUS.full, overflow: 'hidden' },
  ctaGrad: {
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 54,
  },
  ctaText: { color: '#fff', fontSize: 16, fontWeight: '800', letterSpacing: -0.3 },

  // Restore
  restoreBtn: { alignItems: 'center', paddingVertical: SPACING.sm },
  restoreText: { color: COLORS.textMuted, fontSize: 13 },

  // Legal
  legal: {
    color: COLORS.textMuted,
    fontSize: 11,
    textAlign: 'center',
    lineHeight: 16,
  },
});
