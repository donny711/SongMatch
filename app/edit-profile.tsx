import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Image,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { Image as ExpoImage } from 'expo-image';
import { useProfileStore } from '../src/store/profileStore';
import { checkUsernameAvailable, USERNAME_RE } from '../src/firebase/profileService';
import { AvatarWithFrame } from '../src/components/profile/AvatarWithFrame';
import { COLORS, SPACING, RADIUS } from '../src/theme';

export default function EditProfileScreen() {
  const insets = useSafeAreaInsets();

  const avatarUrl = useProfileStore((s) => s.avatarUrl);
  const bannerUrl = useProfileStore((s) => s.bannerUrl);
  const displayName = useProfileStore((s) => s.displayName);
  const currentUsername = useProfileStore((s) => s.username);
  const equippedItems = useProfileStore((s) => s.equippedItems);
  const updateDisplayName = useProfileStore((s) => s.updateDisplayName);
  const updateUsername = useProfileStore((s) => s.updateUsername);
  const uploadAvatar = useProfileStore((s) => s.uploadAvatar);
  const removeAvatarAction = useProfileStore((s) => s.removeAvatar);
  const uploadBanner = useProfileStore((s) => s.uploadBanner);
  const removeBannerAction = useProfileStore((s) => s.removeBanner);
  const gifBgUrl = useProfileStore((s) => s.gifBgUrl);
  const uploadGifBg = useProfileStore((s) => s.uploadGifBg);
  const removeGifBgAction = useProfileStore((s) => s.removeGifBg);

  const [nameInput, setNameInput] = useState(displayName ?? '');
  const [usernameInput, setUsernameInput] = useState(currentUsername ?? '');
  const [usernameStatus, setUsernameStatus] = useState<'idle' | 'checking' | 'available' | 'taken' | 'invalid'>('idle');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [localAvatarUri, setLocalAvatarUri] = useState<string | null>(null);
  const [avatarRemoved, setAvatarRemoved] = useState(false);
  const [localBannerUri, setLocalBannerUri] = useState<string | null>(null);
  const [bannerRemoved, setBannerRemoved] = useState(false);
  const [localGifUri, setLocalGifUri] = useState<string | null>(null);
  const [gifRemoved, setGifRemoved] = useState(false);
  const [saving, setSaving] = useState(false);

  const usernameChanged = usernameInput !== (currentUsername ?? '');

  useEffect(() => {
    if (!usernameChanged) { setUsernameStatus('idle'); return; }
    if (usernameInput === '') { setUsernameStatus(currentUsername ? 'invalid' : 'idle'); return; }
    if (!USERNAME_RE.test(usernameInput)) { setUsernameStatus('invalid'); return; }

    setUsernameStatus('checking');
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        const available = await checkUsernameAvailable(usernameInput);
        setUsernameStatus(available ? 'available' : 'taken');
      } catch {
        setUsernameStatus('idle');
      }
    }, 400);
  }, [usernameInput, usernameChanged]);

  const isDirty =
    nameInput.trim() !== (displayName ?? '') ||
    usernameChanged ||
    localAvatarUri !== null ||
    localBannerUri !== null ||
    avatarRemoved ||
    bannerRemoved ||
    localGifUri !== null ||
    gifRemoved;

  const canSave = isDirty && usernameStatus !== 'taken' && usernameStatus !== 'invalid' && usernameStatus !== 'checking';

  const pickAvatar = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images',
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.9,
    });
    if (!result.canceled && result.assets[0]) {
      setLocalAvatarUri(result.assets[0].uri);
    }
  };

  const pickBanner = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images',
      allowsEditing: true,
      aspect: [3, 1],
      quality: 0.9,
    });
    if (!result.canceled && result.assets[0]) {
      setLocalBannerUri(result.assets[0].uri);
    }
  };

  const pickGif = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images',
      allowsEditing: false,
      quality: 1,
    });
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      if (asset.fileSize && asset.fileSize > 8 * 1024 * 1024) {
        Alert.alert('File too large', 'GIF must be under 8 MB.');
        return;
      }
      setLocalGifUri(asset.uri);
      setGifRemoved(false);
    }
  };

  const handleSave = async () => {
    const trimmedName = nameInput.trim();
    if (trimmedName && !/^[\w\s\-\.]+$/.test(trimmedName)) {
      Alert.alert('Invalid name', 'Display name can only contain letters, numbers, spaces, hyphens, and dots.');
      return;
    }

    setSaving(true);
    try {
      await Promise.all([
        trimmedName !== (displayName ?? '') ? updateDisplayName(trimmedName) : Promise.resolve(),
        usernameChanged && usernameInput ? updateUsername(usernameInput) : Promise.resolve(),
        localAvatarUri ? uploadAvatar(localAvatarUri) : avatarRemoved ? removeAvatarAction() : Promise.resolve(),
        localBannerUri ? uploadBanner(localBannerUri) : bannerRemoved ? removeBannerAction() : Promise.resolve(),
        localGifUri ? uploadGifBg(localGifUri) : gifRemoved ? removeGifBgAction() : Promise.resolve(),
      ]);
      router.back();
    } catch (e: any) {
      Alert.alert('Save failed', e?.message ?? 'Something went wrong. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const displayAvatarUri = avatarRemoved ? null : (localAvatarUri ?? avatarUrl);
  const displayBannerUri = localBannerUri ?? bannerUrl;
  const displayGifUri = gifRemoved ? null : (localGifUri ?? gifBgUrl);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.75}>
          <Ionicons name="chevron-back" size={22} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Edit Profile</Text>
        <TouchableOpacity
          style={[styles.saveBtn, (!canSave || saving) && styles.saveBtnDisabled]}
          onPress={handleSave}
          disabled={!canSave || saving}
          activeOpacity={0.8}
        >
          {saving ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.saveBtnText}>Save</Text>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + SPACING.xxl }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Banner */}
        <TouchableOpacity onPress={pickBanner} activeOpacity={0.85}>
          <View style={styles.bannerWrap}>
            {displayBannerUri ? (
              <Image source={{ uri: displayBannerUri }} style={styles.banner} resizeMode="cover" />
            ) : (
              <View style={[styles.banner, styles.bannerEmpty]}>
                <Ionicons name="image-outline" size={28} color={COLORS.textMuted} />
                <Text style={styles.bannerEmptyText}>Tap to add a banner</Text>
              </View>
            )}
            <View style={styles.bannerOverlay}>
              <Ionicons name="camera" size={18} color="#fff" />
            </View>
          </View>
        </TouchableOpacity>

        {/* Avatar */}
        <View style={styles.avatarSection}>
          <TouchableOpacity onPress={pickAvatar} activeOpacity={0.85} style={styles.avatarTapTarget}>
            <AvatarWithFrame
              uri={displayAvatarUri}
              frameId={equippedItems.avatarFrame}
              size={86}
            />
            <View style={styles.avatarCameraOverlay}>
              <Ionicons name="camera" size={14} color="#fff" />
            </View>
          </TouchableOpacity>
        </View>

        {/* Remove avatar */}
        {(displayAvatarUri) && !avatarRemoved && (
          <TouchableOpacity
            style={styles.removeBannerBtn}
            onPress={() => { setLocalAvatarUri(null); setAvatarRemoved(true); }}
            activeOpacity={0.75}
          >
            <Ionicons name="trash-outline" size={15} color={COLORS.pink} />
            <Text style={styles.removeBannerText}>Remove photo</Text>
          </TouchableOpacity>
        )}

        {/* Display name */}
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>Display Name</Text>
          <View style={styles.inputWrap}>
            <TextInput
              style={styles.input}
              value={nameInput}
              onChangeText={(t) => setNameInput(t.slice(0, 32))}
              placeholder="Your display name"
              placeholderTextColor={COLORS.textMuted}
              maxLength={32}
              autoCorrect={false}
              returnKeyType="done"
            />
            <Text style={styles.charCount}>{nameInput.length}/32</Text>
          </View>
        </View>

        {/* Username */}
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>Username</Text>
          <View style={[
            styles.inputWrap,
            usernameStatus === 'taken' || usernameStatus === 'invalid' ? styles.inputWrapError :
            usernameStatus === 'available' ? styles.inputWrapOk : null,
          ]}>
            <Text style={styles.atSign}>@</Text>
            <TextInput
              style={styles.input}
              value={usernameInput}
              onChangeText={(t) => setUsernameInput(t.toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 20))}
              placeholder="your_username"
              placeholderTextColor={COLORS.textMuted}
              maxLength={20}
              autoCorrect={false}
              autoCapitalize="none"
              returnKeyType="done"
            />
            {usernameStatus === 'checking' && <ActivityIndicator size="small" color={COLORS.textMuted} />}
            {usernameStatus === 'available' && <Ionicons name="checkmark-circle" size={18} color={COLORS.green} />}
            {usernameStatus === 'taken' && <Ionicons name="close-circle" size={18} color={COLORS.pink} />}
            {usernameStatus === 'invalid' && <Ionicons name="close-circle" size={18} color={COLORS.pink} />}
          </View>
          {usernameStatus === 'invalid' && (
            <Text style={styles.fieldHint}>3–20 chars, letters, numbers, underscores only</Text>
          )}
          {usernameStatus === 'taken' && (
            <Text style={styles.fieldHintError}>That username is taken</Text>
          )}
          {usernameStatus === 'available' && (
            <Text style={styles.fieldHintOk}>Username available</Text>
          )}
        </View>

        {/* Remove banner option */}
        {displayBannerUri && !bannerRemoved && (
          <TouchableOpacity
            style={styles.removeBannerBtn}
            onPress={() => { setLocalBannerUri(null); setBannerRemoved(true); }}
            activeOpacity={0.75}
          >
            <Ionicons name="trash-outline" size={15} color={COLORS.pink} />
            <Text style={styles.removeBannerText}>Remove banner</Text>
          </TouchableOpacity>
        )}

        {/* GIF Background */}
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>GIF Background</Text>
          <TouchableOpacity onPress={pickGif} activeOpacity={0.85}>
            <View style={styles.gifWrap}>
              {displayGifUri ? (
                <ExpoImage
                  source={{ uri: displayGifUri }}
                  style={styles.gifPreview}
                  contentFit="cover"
                />
              ) : (
                <View style={styles.gifEmpty}>
                  <Ionicons name="image-outline" size={24} color={COLORS.textMuted} />
                  <Text style={styles.gifEmptyText}>Tap to add a GIF</Text>
                </View>
              )}
              <View style={styles.bannerOverlay}>
                <Ionicons name="camera" size={18} color="#fff" />
              </View>
            </View>
          </TouchableOpacity>
          {displayGifUri && (
            <TouchableOpacity
              style={styles.removeBannerBtn}
              onPress={() => { setLocalGifUri(null); setGifRemoved(true); }}
              activeOpacity={0.75}
            >
              <Ionicons name="trash-outline" size={15} color={COLORS.pink} />
              <Text style={styles.removeBannerText}>Remove GIF background</Text>
            </TouchableOpacity>
          )}
          <Text style={styles.fieldHint}>Shown when no banner photo is set. Max 8 MB.</Text>
        </View>

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    gap: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    flex: 1,
    color: COLORS.text,
    fontSize: 20,
    fontWeight: '800',
  },
  saveBtn: {
    backgroundColor: COLORS.purple,
    paddingHorizontal: SPACING.md,
    paddingVertical: 8,
    borderRadius: RADIUS.full,
    minWidth: 60,
    alignItems: 'center',
  },
  saveBtnDisabled: {
    opacity: 0.4,
  },
  saveBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  scroll: { flex: 1 },
  content: { gap: SPACING.lg },

  bannerWrap: {
    position: 'relative',
  },
  banner: {
    width: '100%',
    height: 140,
  },
  bannerEmpty: {
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
  },
  bannerEmptyText: {
    color: COLORS.textMuted,
    fontSize: 13,
  },
  bannerOverlay: {
    position: 'absolute',
    bottom: SPACING.sm,
    right: SPACING.sm,
    width: 32,
    height: 32,
    borderRadius: RADIUS.full,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  avatarSection: {
    paddingHorizontal: SPACING.lg,
    alignItems: 'flex-start',
    gap: SPACING.xs,
    marginTop: -20,
  },
  avatarTapTarget: {
    position: 'relative',
  },
  avatarCameraOverlay: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 26,
    height: 26,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.purple,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: COLORS.bg,
  },
  pendingChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(251,191,36,0.12)',
    borderRadius: RADIUS.full,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  pendingText: {
    color: '#FBBF24',
    fontSize: 11,
    fontWeight: '600',
  },

  field: {
    paddingHorizontal: SPACING.lg,
    gap: SPACING.xs,
  },
  fieldLabel: {
    color: COLORS.textMuted,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  inputWrap: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    flexDirection: 'row',
    alignItems: 'center',
  },
  inputWrapError: { borderColor: COLORS.pink },
  inputWrapOk: { borderColor: COLORS.green },
  atSign: { color: COLORS.textMuted, fontSize: 16, fontWeight: '600', marginRight: 2 },
  fieldHint: { color: COLORS.textMuted, fontSize: 11, paddingHorizontal: 2 },
  fieldHintError: { color: COLORS.pink, fontSize: 11, paddingHorizontal: 2 },
  fieldHintOk: { color: COLORS.green, fontSize: 11, paddingHorizontal: 2 },
  input: {
    flex: 1,
    color: COLORS.text,
    fontSize: 16,
    fontWeight: '500',
  },
  charCount: {
    color: COLORS.textMuted,
    fontSize: 12,
  },

  gifWrap: {
    position: 'relative',
    borderRadius: RADIUS.lg,
    overflow: 'hidden',
  },
  gifPreview: {
    width: '100%',
    height: 120,
    borderRadius: RADIUS.lg,
  },
  gifEmpty: {
    width: '100%',
    height: 120,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
  },
  gifEmptyText: {
    color: COLORS.textMuted,
    fontSize: 13,
  },
  removeBannerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: SPACING.lg,
  },
  removeBannerText: {
    color: COLORS.pink,
    fontSize: 14,
    fontWeight: '600',
  },

  notice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.xs,
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.md,
  },
  noticeText: {
    flex: 1,
    color: COLORS.textMuted,
    fontSize: 12,
    lineHeight: 18,
  },
});
