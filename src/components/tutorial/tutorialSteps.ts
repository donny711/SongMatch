export interface TutorialStep {
  id: string;
  targetId: string;
  text: string;
  icon: string;
  tooltipPosition: 'above' | 'below';
  padding?: number;
  shape?: 'rect' | 'circle';
}

export const TUTORIAL_STEPS: TutorialStep[] = [
  {
    id: 'swipe-right',
    targetId: 'swipe-card',
    text: 'Swipe right to like a song',
    icon: 'heart-outline',
    tooltipPosition: 'below',
    padding: 8,
    shape: 'rect',
  },
  {
    id: 'swipe-left',
    targetId: 'swipe-card',
    text: 'Swipe left to skip',
    icon: 'close-outline',
    tooltipPosition: 'below',
    padding: 8,
    shape: 'rect',
  },
  {
    id: 'action-buttons',
    targetId: 'action-buttons',
    text: 'Or use the buttons to skip, undo, or like',
    icon: 'apps-outline',
    tooltipPosition: 'above',
    padding: 12,
    shape: 'rect',
  },
  {
    id: 'tab-switcher',
    targetId: 'tab-switcher',
    text: 'Switch between For You and Friends',
    icon: 'swap-horizontal-outline',
    tooltipPosition: 'below',
    padding: 8,
    shape: 'rect',
  },
  {
    id: 'audio-player',
    targetId: 'audio-player',
    text: 'Tap to preview the song',
    icon: 'play-outline',
    tooltipPosition: 'above',
    padding: 8,
    shape: 'rect',
  },
  {
    id: 'tab-hear',
    targetId: 'tab-hear',
    text: 'Record or search a song to find similar music',
    icon: 'mic-outline',
    tooltipPosition: 'above',
    padding: 6,
    shape: 'rect',
  },
  {
    id: 'tab-liked',
    targetId: 'tab-liked',
    text: 'Your liked songs live here',
    icon: 'heart-outline',
    tooltipPosition: 'above',
    padding: 6,
    shape: 'rect',
  },
  {
    id: 'tab-profile',
    targetId: 'tab-profile',
    text: 'View your profile and stats',
    icon: 'person-outline',
    tooltipPosition: 'above',
    padding: 6,
    shape: 'rect',
  },
];

export const TOTAL_STEPS = TUTORIAL_STEPS.length;
