import { useEffect, useRef, useState } from 'react';
import { createAudioPlayer, setAudioModeAsync } from 'expo-audio';
import type { AudioPlayer } from 'expo-audio';
import { usePlayerStore } from '../store/playerStore';

export function useSnippetPlayer(previewUrl: string | null, autoPlay = false) {
  const playerRef = useRef<AudioPlayer | null>(null);
  const subscriptionRef = useRef<{ remove: () => void } | null>(null);
  const mountedRef = useRef(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const { activePreviewUri, setActivePreviewUri } = usePlayerStore();

  // Mark unmounted so in-flight async ops can bail out
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Destroy this player whenever a different card takes over audio
  useEffect(() => {
    if (activePreviewUri !== previewUrl && playerRef.current) {
      subscriptionRef.current?.remove();
      subscriptionRef.current = null;
      playerRef.current.pause();
      playerRef.current.remove();
      playerRef.current = null;
      setIsPlaying(false);
      setPosition(0);
    }
  }, [activePreviewUri, previewUrl]);

  // Auto-play when this card becomes the top card
  useEffect(() => {
    if (!autoPlay || !previewUrl) return;
    const t = setTimeout(() => {
      if (mountedRef.current) toggle();
    }, 0);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoPlay, previewUrl]);

  useEffect(() => {
    return () => {
      subscriptionRef.current?.remove();
      subscriptionRef.current = null;
      playerRef.current?.pause();
      playerRef.current?.remove();
      playerRef.current = null;
    };
  }, []);

  const toggle = async () => {
    if (!previewUrl) return;

    if (!playerRef.current) {
      try {
        await setAudioModeAsync({ playsInSilentMode: true });
        const player = createAudioPlayer({ uri: previewUrl }, { updateInterval: 250 });
        const sub = player.addListener('playbackStatusUpdate', (status) => {
          if (!mountedRef.current) return;
          setPosition(Math.round(status.currentTime * 1000));
          setDuration(status.duration > 0 ? Math.round(status.duration * 1000) : 30000);
          if (status.didJustFinish) {
            setIsPlaying(false);
            setPosition(0);
          }
        });
        // Component unmounted while player was being set up — kill the orphaned player
        if (!mountedRef.current) {
          sub.remove();
          player.remove();
          return;
        }
        player.play();
        playerRef.current = player;
        subscriptionRef.current = sub;
        setIsPlaying(true);
        setActivePreviewUri(previewUrl);
      } catch {
        // Preview URL is inaccessible or expired — fail silently
      }
    } else if (isPlaying) {
      playerRef.current.pause();
      setIsPlaying(false);
    } else {
      playerRef.current.play();
      setIsPlaying(true);
      setActivePreviewUri(previewUrl);
    }
  };

  const stop = async () => {
    subscriptionRef.current?.remove();
    subscriptionRef.current = null;
    playerRef.current?.pause();
    playerRef.current?.remove();
    playerRef.current = null;
    setIsPlaying(false);
    setPosition(0);
  };

  return { isPlaying, toggle, stop, position, duration };
}
