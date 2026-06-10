export type MilestoneTrigger =
  | { type: 'first_launch' }
  | { type: 'platform_connect'; platform: 'spotify' | 'soundcloud' | 'both' }
  | { type: 'liked_count'; count: number }
  | { type: 'streak_days'; days: number }
  | { type: 'set_avatar' }
  | { type: 'set_username' }
  | { type: 'first_follow' }
  | { type: 'first_follower' }
  | { type: 'follower_count'; count: number };

export interface Milestone {
  id: string;
  label: string;
  pointsReward: number;
  badgeGrant?: string;
  triggerCondition: MilestoneTrigger;
}

export const MILESTONES: Milestone[] = [
  {
    id: 'ms_first_launch',
    label: 'Welcome to SongMatch',
    pointsReward: 100,
    badgeGrant: 'badge_early_adopter',
    triggerCondition: { type: 'first_launch' },
  },
  {
    id: 'ms_connect_spotify',
    label: 'Connected Spotify',
    pointsReward: 400,
    triggerCondition: { type: 'platform_connect', platform: 'spotify' },
  },
  {
    id: 'ms_connect_soundcloud',
    label: 'Connected SoundCloud',
    pointsReward: 200,
    triggerCondition: { type: 'platform_connect', platform: 'soundcloud' },
  },
  {
    id: 'ms_two_platforms',
    label: 'Music Everywhere',
    pointsReward: 300,
    badgeGrant: 'badge_double_platform',
    triggerCondition: { type: 'platform_connect', platform: 'both' },
  },
  {
    id: 'ms_liked_10',
    label: 'Just Getting Started',
    pointsReward: 100,
    triggerCondition: { type: 'liked_count', count: 10 },
  },
  {
    id: 'ms_liked_25',
    label: 'Finding Your Groove',
    pointsReward: 200,
    triggerCondition: { type: 'liked_count', count: 25 },
  },
  {
    id: 'ms_liked_50',
    label: 'Half Century',
    pointsReward: 400,
    badgeGrant: 'badge_liked_50',
    triggerCondition: { type: 'liked_count', count: 50 },
  },
  {
    id: 'ms_liked_100',
    label: 'Centurion',
    pointsReward: 800,
    badgeGrant: 'badge_liked_100',
    triggerCondition: { type: 'liked_count', count: 100 },
  },
  {
    id: 'ms_liked_250',
    label: 'Taste Connoisseur',
    pointsReward: 1200,
    triggerCondition: { type: 'liked_count', count: 250 },
  },
  {
    id: 'ms_streak_3',
    label: '3-Day Streak',
    pointsReward: 150,
    triggerCondition: { type: 'streak_days', days: 3 },
  },
  {
    id: 'ms_streak_7',
    label: 'Week Warrior',
    pointsReward: 300,
    badgeGrant: 'badge_streak_7',
    triggerCondition: { type: 'streak_days', days: 7 },
  },
  {
    id: 'ms_streak_14',
    label: 'Two Week Devotee',
    pointsReward: 500,
    triggerCondition: { type: 'streak_days', days: 14 },
  },
  {
    id: 'ms_streak_30',
    label: 'Month of Music',
    pointsReward: 1000,
    badgeGrant: 'badge_streak_30',
    triggerCondition: { type: 'streak_days', days: 30 },
  },

  // ── Profile ────────────────────────────────────────────────────────────────
  {
    id: 'ms_set_avatar',
    label: 'Set a Profile Picture',
    pointsReward: 100,
    triggerCondition: { type: 'set_avatar' },
  },
  {
    id: 'ms_set_username',
    label: 'Choose Your Username',
    pointsReward: 150,
    triggerCondition: { type: 'set_username' },
  },

  // ── Social ─────────────────────────────────────────────────────────────────
  {
    id: 'ms_first_follow',
    label: 'Follow Someone',
    pointsReward: 50,
    triggerCondition: { type: 'first_follow' },
  },
  {
    id: 'ms_first_follower',
    label: 'Get Your First Follower',
    pointsReward: 100,
    triggerCondition: { type: 'first_follower' },
  },
  {
    id: 'ms_followers_10',
    label: 'Reach 10 Followers',
    pointsReward: 400,
    triggerCondition: { type: 'follower_count', count: 10 },
  },
];

export const MILESTONE_MAP: Record<string, Milestone> = Object.fromEntries(
  MILESTONES.map((m) => [m.id, m])
);
