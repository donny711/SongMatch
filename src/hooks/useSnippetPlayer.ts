import { useEffect, useCallback } from 'react';
import { setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { usePlayerStore } from '../store/playerStore';

let audioModeReady = false;
async function ensureAudioMode(): Promise<void> {
  if (audioModeReady) return;
  audioModeReady = true;
  await setAudioModeAsync({ playsInSilentMode: true });
}

export function useSnippetPlayer(previewUrl: string | null, autoPlay = false) {
  const player = useAudioPlayer(previewUrl, { updateInterval: 250 });
  const status = useAudioPlayerStatus(player);
  const { activePreviewUri, setActivePreviewUri } = usePlayerStore();

  // Auto-play when this becomes the top card
  useEffect(() => {
    if (!autoPlay || !previewUrl) return;
    ensureAudioMode()
      .then(() => {
        player.play();
        setActivePreviewUri(previewUrl);
      })
      .catch(() => {});
  // player and setActivePreviewUri are stable refs — intentionally omitted
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoPlay, previewUrl]);

  // Pause when another card takes audio focus
  useEffect(() => {
    if (activePreviewUri !== previewUrl && status.playing) {
      player.pause();
    }
  }, [activePreviewUri, previewUrl, status.playing, player]);

  // Seek back to start when the preview ends
  useEffect(() => {
    if (status.didJustFinish) {
      player.seekTo(0).catch(() => {});
    }
  }, [status.didJustFinish, player]);

  const toggle = useCallback(async () => {
    if (!previewUrl) return;
    if (status.playing) {
      player.pause();
    } else {
      await ensureAudioMode().catch(() => {});
      player.play();
      setActivePreviewUri(previewUrl);
    }
  }, [previewUrl, status.playing, player, setActivePreviewUri]);

  const stop = useCallback(async () => {
    player.pause();
    await player.seekTo(0).catch(() => {});
  }, [player]);

  return {
    isPlaying: status.playing,
    toggle,
    stop,
    position: Math.round(status.currentTime * 1000),
    duration: status.duration > 0 ? Math.round(status.duration * 1000) : 30000,
  };
}
