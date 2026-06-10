import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import * as ImageManipulator from 'expo-image-manipulator';
import { signInAnonymously } from 'firebase/auth';
import { auth } from '../firebase/config';
import {
  getOrCreateUserDoc,
  subscribeToProfile,
  updateProfileFields,
  updateShowcase,
  grantMilestone,
  purchaseItem,
  equipItem,
  updateStreak,
  runLikedTracksMigration,
  claimUsername,
  type UserProfile,
  type EquippedItems,
  type EquipSlot,
  type ShowcaseArtist,
} from '../firebase/profileService';
import { useToastStore } from './toastStore';
import { registerProfileRef } from './profileRef';
import { MILESTONE_MAP } from '../data/milestones';
import type { DeezerTrack } from '../api/types';
import { uploadProfileImage, uploadGifBackground, deleteProfileImage } from '../firebase/storageService';

interface ProfileState {
  uid: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  bannerUrl: string | null;
  avatarPending: string | null;
  bannerPending: string | null;
  points: number;
  totalEarned: number;
  currentStreak: number;
  longestStreak: number;
  earnedMilestones: string[];
  ownedItems: string[];
  equippedItems: EquippedItems;
  showcaseTracks: DeezerTrack[];
  showcaseArtists: ShowcaseArtist[];
  isPrivate: boolean;
  followerCount: number;
  followingCount: number;
  likedCount: number;
  username: string | null;
  gifBgUrl: string | null;
  isLoading: boolean;
  isInitialized: boolean;

  initialize: (spotifyUserId?: string) => Promise<void>;
  syncFromFirestore: (profile: UserProfile) => void;
  updateDisplayName: (name: string) => Promise<void>;
  uploadAvatar: (localUri: string) => Promise<void>;
  uploadBanner: (localUri: string) => Promise<void>;
  removeAvatar: () => Promise<void>;
  removeBanner: () => Promise<void>;
  uploadGifBg: (localUri: string) => Promise<void>;
  removeGifBg: () => Promise<void>;
  grantMilestone: (milestoneId: string) => Promise<void>;
  purchase: (itemId: string) => Promise<void>;
  equip: (slot: EquipSlot, itemId: string | null) => Promise<void>;
  streakAnimFrom: number | null;
  clearStreakAnim: () => void;
  checkAndUpdateStreak: () => Promise<void>;
  setShowcase: (tracks: DeezerTrack[], artists: ShowcaseArtist[]) => Promise<void>;
  togglePrivate: () => Promise<void>;
  updateUsername: (username: string) => Promise<void>;
}

let unsubscribeSnapshot: (() => void) | null = null;

export const useProfileStore = create<ProfileState>((set, get) => ({
  uid: null,
  displayName: null,
  avatarUrl: null,
  bannerUrl: null,
  avatarPending: null,
  bannerPending: null,
  points: 0,
  totalEarned: 0,
  currentStreak: 0,
  longestStreak: 0,
  earnedMilestones: [],
  ownedItems: ['theme_default'],
  equippedItems: {
    avatarFrame: null,
    profileBackground: null,
    badge1: null,
    badge2: null,
    badge3: null,
    cardTheme: 'theme_default',
    equippedRank: null,
    profileTheme: null,
  },
  showcaseTracks: [],
  showcaseArtists: [],
  isPrivate: false,
  followerCount: 0,
  followingCount: 0,
  likedCount: 0,
  username: null,
  gifBgUrl: null,
  isLoading: false,
  isInitialized: false,
  streakAnimFrom: null,

  initialize: async (spotifyUserId?: string) => {
    // Always allow re-initialization so a second login after logout works.
    // The previous onSnapshot listener is cleaned up below before creating a new one.
    set({ isLoading: true });
    try {
      // Wait for Firebase Auth SDK to restore any persisted session before
      // deciding whether to sign in anonymously.
      await auth.authStateReady();

      let uid: string;
      if (auth.currentUser) {
        uid = auth.currentUser.uid;
      } else {
        try {
          const credential = await signInAnonymously(auth);
          uid = credential.user.uid;
        } catch {
          // No network on first launch — fall back to a temporary local UID.
          // The next launch will sign in anonymously once connectivity returns.
          uid = Crypto.randomUUID();
        }
      }
      set({ uid });

      // Always set up the realtime listener first so profile loads as soon
      // as Firestore becomes reachable, even if the initial fetch fails.
      if (unsubscribeSnapshot) unsubscribeSnapshot();
      unsubscribeSnapshot = subscribeToProfile(uid, (p) => get().syncFromFirestore(p));

      // Try initial fetch — if Firestore is temporarily unavailable this is
      // non-fatal; the snapshot listener will deliver the data once online.
      try {
        const profile = await getOrCreateUserDoc(uid);
        get().syncFromFirestore(profile);
      } catch (e) {
        console.warn('Firestore initial load failed, will retry via snapshot:', e);
      }

      set({ isInitialized: true, isLoading: false });

      // One-time migration: sync existing liked tracks to Firestore
      try {
        const raw = await AsyncStorage.getItem(`sm_liked_${spotifyUserId ?? uid}`);
        const likedTracks: DeezerTrack[] = raw ? JSON.parse(raw) : [];
        if (likedTracks.length > 0) {
          runLikedTracksMigration(uid, likedTracks).catch(() => {});
        }
      } catch {
        // Non-critical
      }
    } catch {
      set({ isLoading: false });
    }
  },

  syncFromFirestore: (profile) => {
    set({
      displayName: profile.displayName,
      avatarUrl: profile.avatarUrl,
      bannerUrl: profile.bannerUrl,
      avatarPending: profile.avatarPending,
      bannerPending: profile.bannerPending,
      points: profile.points,
      totalEarned: profile.totalEarned,
      currentStreak: profile.currentStreak,
      longestStreak: profile.longestStreak,
      earnedMilestones: profile.earnedMilestones,
      ownedItems: profile.ownedItems,
      equippedItems: profile.equippedItems,
      showcaseTracks: profile.showcaseTracks ?? [],
      showcaseArtists: profile.showcaseArtists ?? [],
      isPrivate: profile.isPrivate ?? false,
      followerCount: profile.followerCount ?? 0,
      followingCount: profile.followingCount ?? 0,
      likedCount: profile.likedCount ?? 0,
      username: profile.username ?? null,
      gifBgUrl: profile.gifBgUrl ?? null,
    });

    // Follower milestone checks (fire-and-forget, idempotent)
    const fc = profile.followerCount ?? 0;
    if (fc >= 1) get().grantMilestone('ms_first_follower').catch(() => {});
    if (fc >= 10) get().grantMilestone('ms_followers_10').catch(() => {});
  },

  updateDisplayName: async (name) => {
    const { uid } = get();
    if (!uid) return;
    const trimmed = name.trim().slice(0, 32);
    set({ displayName: trimmed });
    await updateProfileFields(uid, { displayName: trimmed });
  },

  uploadAvatar: async (localUri) => {
    const { uid } = get();
    if (!uid) return;

    const compressed = await ImageManipulator.manipulateAsync(
      localUri,
      [{ resize: { width: 400, height: 400 } }],
      { compress: 0.85, format: ImageManipulator.SaveFormat.JPEG }
    );

    const publicUrl = await uploadProfileImage(uid, 'avatar', compressed.uri);
    set({ avatarUrl: publicUrl });
    await updateProfileFields(uid, { avatarUrl: publicUrl });
    get().grantMilestone('ms_set_avatar').catch(() => {});
  },

  uploadBanner: async (localUri) => {
    const { uid } = get();
    if (!uid) return;

    const compressed = await ImageManipulator.manipulateAsync(
      localUri,
      [{ resize: { width: 1200, height: 400 } }],
      { compress: 0.85, format: ImageManipulator.SaveFormat.JPEG }
    );

    const publicUrl = await uploadProfileImage(uid, 'banner', compressed.uri);
    set({ bannerUrl: publicUrl });
    await updateProfileFields(uid, { bannerUrl: publicUrl });
  },

  removeAvatar: async () => {
    const { uid, avatarUrl } = get();
    if (!uid) return;
    set({ avatarUrl: null });
    await updateProfileFields(uid, { avatarUrl: null });
    if (avatarUrl) deleteProfileImage(avatarUrl).catch(() => {});
  },

  removeBanner: async () => {
    const { uid, bannerUrl } = get();
    if (!uid) return;
    set({ bannerUrl: null });
    await updateProfileFields(uid, { bannerUrl: null });
    if (bannerUrl) deleteProfileImage(bannerUrl).catch(() => {});
  },

  uploadGifBg: async (localUri) => {
    const { uid } = get();
    if (!uid) return;
    const url = await uploadGifBackground(uid, localUri);
    set({ gifBgUrl: url });
    await updateProfileFields(uid, { gifBgUrl: url });
  },

  removeGifBg: async () => {
    const { uid, gifBgUrl } = get();
    if (!uid) return;
    set({ gifBgUrl: null });
    await updateProfileFields(uid, { gifBgUrl: null });
    if (gifBgUrl) deleteProfileImage(gifBgUrl).catch(() => {});
  },

  grantMilestone: async (milestoneId) => {
    const { uid, earnedMilestones } = get();
    if (!uid || earnedMilestones.includes(milestoneId)) return;
    try {
      const result = await grantMilestone(uid, milestoneId);
      if (!result.alreadyGranted) {
        const ms = MILESTONE_MAP[milestoneId];
        if (ms) {
          useToastStore.getState().push(ms.pointsReward, ms.label);
        }
      }
    } catch {
      // Silently fail
    }
  },

  purchase: async (itemId) => {
    const { uid } = get();
    if (!uid) throw new Error('Not initialized');
    await purchaseItem(uid, itemId);
  },

  equip: async (slot, itemId) => {
    const { uid } = get();
    if (!uid) return;
    set((s) => ({ equippedItems: { ...s.equippedItems, [slot]: itemId } }));
    await equipItem(uid, slot, itemId);
  },

  clearStreakAnim: () => set({ streakAnimFrom: null }),

  checkAndUpdateStreak: async () => {
    const { uid } = get();
    if (!uid) return;
    const prevStreak = get().currentStreak;
    try {
      const { currentStreak: newStreak } = await updateStreak(uid);
      if (newStreak > prevStreak) {
        if (__DEV__) console.log('[streak] incremented', prevStreak, '→', newStreak);
        set({ streakAnimFrom: prevStreak });
      }
    } catch {
      // Non-critical
    }
  },

  setShowcase: async (tracks, artists) => {
    const { uid } = get();
    if (!uid) return;
    set({ showcaseTracks: tracks, showcaseArtists: artists });
    await updateShowcase(uid, tracks, artists);
  },

  togglePrivate: async () => {
    const { uid, isPrivate } = get();
    if (!uid) return;
    const next = !isPrivate;
    set({ isPrivate: next });
    await updateProfileFields(uid, { isPrivate: next });
  },

  updateUsername: async (newUsername) => {
    const { uid, username: oldUsername } = get();
    if (!uid) return;
    await claimUsername(uid, newUsername, oldUsername);
    set({ username: newUsername });
    get().grantMilestone('ms_set_username').catch(() => {});
  },
}));

registerProfileRef(
  () => useProfileStore.getState().uid,
  (id) => { useProfileStore.getState().grantMilestone(id).catch(() => {}); },
);
