import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as AppleAuthentication from 'expo-apple-authentication';
import { useSpotifyAuth } from '../../src/auth/useSpotifyAuth';
import { useAppleAuth } from '../../src/auth/useAppleAuth';
import { COLORS, SPACING, RADIUS } from '../../src/theme';

const PERKS = [
  { icon: 'heart' as const,       color: COLORS.green,  text: 'Save liked songs to a Spotify playlist' },
  { icon: 'albums' as const,      color: COLORS.cyan,   text: 'Seed recommendations from your playlists' },
  { icon: 'stats-chart' as const, color: COLORS.orange, text: 'Recommendations based on your top tracks' },
];

export default function LoginScreen() {
  const { request, promptAsync } = useSpotifyAuth();
  const { signIn: signInWithApple } = useAppleAuth();
  const insets = useSafeAreaInsets();
  const [appleAvailable, setAppleAvailable] = useState(false);

  useEffect(() => {
    if (Platform.OS === 'ios') {
      AppleAuthentication.isAvailableAsync().then(setAppleAvailable);
    }
  }, []);

  return (
    <View style={[styles.container, { paddingTop: insets.top + SPACING.lg, paddingBottom: insets.bottom + SPACING.lg }]}>
      {/* Back */}
      <TouchableOpacity
        style={styles.backBtn}
        onPress={() => router.back()}
        accessibilityLabel="Go back"
        accessibilityRole="button"
        activeOpacity={0.7}
      >
        <Ionicons name="chevron-back" size={22} color={COLORS.textSub} />
        <Text style={styles.backText}>Back</Text>
      </TouchableOpacity>

      {/* Hero */}
      <View style={styles.hero}>
        <View style={styles.logoWrap}>
          <Ionicons name="musical-notes" size={42} color={COLORS.purple} />
        </View>
        <Text style={styles.title}>Connect Spotify</Text>
        <Text style={styles.subtitle}>
          Link your Spotify account to save liked songs to your playlists and personalise recommendations.
        </Text>
      </View>

      {/* Perks */}
      <View style={styles.perks}>
        {PERKS.map(({ icon, color, text }) => (
          <View key={text} style={styles.perkRow}>
            <View style={[styles.perkIconWrap, { backgroundColor: `${color}18` }]}>
              <Ionicons name={icon} size={18} color={color} />
            </View>
            <Text style={styles.perkText}>{text}</Text>
          </View>
        ))}
      </View>

      {/* CTAs */}
      <View style={styles.ctaGroup}>
        <TouchableOpacity
          style={[styles.button, !request && styles.buttonDisabled]}
          onPress={() => promptAsync()}
          disabled={!request}
          accessibilityLabel="Connect with Spotify"
          accessibilityRole="button"
          activeOpacity={0.85}
        >
          <Ionicons name="musical-notes" size={20} color="#fff" />
          <Text style={styles.buttonText}>Connect with Spotify</Text>
        </TouchableOpacity>

        {appleAvailable && (
          <>
            <View style={styles.dividerRow}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>or</Text>
              <View style={styles.dividerLine} />
            </View>
            <AppleAuthentication.AppleAuthenticationButton
              buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
              buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
              cornerRadius={RADIUS.full}
              style={styles.appleButton}
              onPress={async () => {
                try {
                  await signInWithApple();
                  router.back();
                } catch (e: any) {
                  if (e.code !== 'ERR_REQUEST_CANCELED') console.warn('Apple sign in error:', e);
                }
              }}
            />
          </>
        )}
      </View>

      <Text style={styles.legal}>
        SongMatch only requests the permissions needed to read your playlists and save songs.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.xl,
  },

  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
  },
  backText: { color: COLORS.textSub, fontSize: 16 },

  hero: { alignItems: 'center', gap: SPACING.md },
  logoWrap: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: 'rgba(167,139,250,0.13)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(167,139,250,0.30)',
    shadowColor: COLORS.purple,
    shadowOpacity: 0.4,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 4 },
    elevation: 10,
  },
  title: {
    color: COLORS.text,
    fontSize: 34,
    fontWeight: '900',
    letterSpacing: -1,
  },
  subtitle: {
    color: COLORS.textSub,
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
  },

  perks: {
    gap: SPACING.sm,
    alignSelf: 'stretch',
  },
  perkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  perkIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  perkText: { color: COLORS.textSub, fontSize: 14, flex: 1 },

  ctaGroup: {
    gap: SPACING.md,
    alignSelf: 'stretch',
  },
  button: {
    backgroundColor: COLORS.purple,
    paddingVertical: 18,
    borderRadius: RADIUS.full,
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    shadowColor: COLORS.purple,
    shadowOpacity: 0.55,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 5 },
    elevation: 12,
  },
  buttonDisabled: { opacity: 0.4 },
  buttonText: { color: '#fff', fontSize: 17, fontWeight: '700' },

  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: COLORS.border,
  },
  dividerText: {
    color: COLORS.textMuted,
    fontSize: 13,
  },
  appleButton: {
    width: '100%',
    height: 56,
  },

  legal: {
    color: COLORS.textMuted,
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
  },
});
