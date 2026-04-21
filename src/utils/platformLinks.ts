import { Linking, ActionSheetIOS, Platform, Alert } from 'react-native';
import type { DeezerTrack } from '../api/types';
import type { MusicPlatform } from '../store/authStore';

const PLATFORM_LABELS: Record<MusicPlatform, string> = {
  spotify: 'Spotify',
  apple_music: 'Apple Music',
  soundcloud: 'SoundCloud',
};

function buildUrl(platform: MusicPlatform, track: DeezerTrack): string {
  const q = encodeURIComponent(`${track.title} ${track.artist.name}`);
  switch (platform) {
    case 'spotify':
      return `https://open.spotify.com/search/${q}`;
    case 'apple_music':
      return `https://music.apple.com/search?term=${q}`;
    case 'soundcloud':
      return `https://soundcloud.com/search?q=${q}`;
  }
}

export async function openTrackOnPlatform(
  track: DeezerTrack,
  connectedPlatforms: MusicPlatform[]
): Promise<void> {
  if (connectedPlatforms.length === 0) return;

  if (connectedPlatforms.length === 1) {
    await Linking.openURL(buildUrl(connectedPlatforms[0], track));
    return;
  }

  const labels = connectedPlatforms.map((p) => PLATFORM_LABELS[p]);

  if (Platform.OS === 'ios') {
    ActionSheetIOS.showActionSheetWithOptions(
      { options: [...labels, 'Cancel'], cancelButtonIndex: labels.length },
      (index) => {
        if (index < connectedPlatforms.length) {
          Linking.openURL(buildUrl(connectedPlatforms[index], track));
        }
      }
    );
  } else {
    const buttons = connectedPlatforms.map((p, i) => ({
      text: labels[i],
      onPress: () => Linking.openURL(buildUrl(p, track)),
    }));
    Alert.alert('Open in\u2026', undefined, [
      ...buttons,
      { text: 'Cancel', style: 'cancel' as const },
    ]);
  }
}
