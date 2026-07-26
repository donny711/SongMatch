import { Linking } from 'react-native';
import type { DeezerTrack } from '../api/types';

/** Open a track in Apple Music (search). SongMatch links out to Apple Music only. */
export async function openTrackInAppleMusic(track: DeezerTrack): Promise<void> {
  const q = encodeURIComponent(`${track.title} ${track.artist.name}`);
  await Linking.openURL(`https://music.apple.com/search?term=${q}`);
}
