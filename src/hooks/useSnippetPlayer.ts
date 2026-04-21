import { useEffect, useRef, useState } from 'react';
import { Audio } from 'expo-av';
import { usePlayerStore } from '../store/playerStore';

export function useSnippetPlayer(previewUrl: string | null, autoPlay = false) {
  const soundRef = useRef<Audio.Sound | null>(null);
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

  // Stop if another card starts playing
  useEffect(() => {
    if (activePreviewUri !== previewUrl && isPlaying) {
      soundRef.current?.pauseAsync();
      setIsPlaying(false);
    }
  }, [activePreviewUri]);

  // Auto-play when this card becomes the top card
  useEffect(() => {
    if (!autoPlay || !previewUrl) return;
    const t = setTimeout(() => {
      if (mountedRef.current) toggle();
    }, 400);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoPlay, previewUrl]);

  useEffect(() => {
    return () => {
      soundRef.current?.unloadAsync();
      soundRef.current = null;
    };
  }, []);

  const toggle = async () => {
    if (!previewUrl) return;

    if (!soundRef.current) {
      try {
        await Audio.setAudioModeAsync({ playsInSilentModeIOS: true });
        const { sound } = await Audio.Sound.createAsync(
          { uri: previewUrl },
          { shouldPlay: true },
          (status) => {
            if (!status.isLoaded) return;
            setPosition(status.positionMillis);
            setDuration(status.durationMillis ?? 30000);
            if (status.didJustFinish) {
              setIsPlaying(false);
              setPosition(0);
            }
          }
        );
        // Component unmounted while createAsync was in-flight — kill the orphaned sound
        if (!mountedRef.current) {
          sound.unloadAsync();
          return;
        }
        soundRef.current = sound;
        setIsPlaying(true);
        setActivePreviewUri(previewUrl);
      } catch {
        // Preview URL is inaccessible or expired — fail silently
      }
    } else if (isPlaying) {
      await soundRef.current.pauseAsync();
      setIsPlaying(false);
    } else {
      await soundRef.current.playAsync();
      setIsPlaying(true);
      setActivePreviewUri(previewUrl);
    }
  };

  const stop = async () => {
    await soundRef.current?.stopAsync();
    await soundRef.current?.unloadAsync();
    soundRef.current = null;
    setIsPlaying(false);
    setPosition(0);
  };

  return { isPlaying, toggle, stop, position, duration };
}
