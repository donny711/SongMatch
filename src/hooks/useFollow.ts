import { useState, useEffect, useCallback } from 'react';
import { checkIsFollowing, callFollowUser, callUnfollowUser } from '../firebase/socialService';
import { useProfileStore } from '../store/profileStore';

export function useFollow(theirUid: string) {
  const myUid = useProfileStore((s) => s.uid);
  const [isFollowing, setIsFollowing] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!myUid || !theirUid || myUid === theirUid) {
      setLoading(false);
      return;
    }
    checkIsFollowing(myUid, theirUid)
      .then(setIsFollowing)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [myUid, theirUid]);

  const follow = useCallback(async () => {
    if (!myUid) return;
    setIsFollowing(true);
    try {
      await callFollowUser(myUid, theirUid);
      useProfileStore.getState().grantMilestone('ms_first_follow').catch(() => {});
    } catch (e) {
      if (__DEV__) console.log('[follow] failed:', e);
      setIsFollowing(false);
    }
  }, [myUid, theirUid]);

  const unfollow = useCallback(async () => {
    if (!myUid) return;
    setIsFollowing(false);
    try {
      await callUnfollowUser(myUid, theirUid);
    } catch (e) {
      if (__DEV__) console.log('[unfollow] failed:', e);
      setIsFollowing(true);
    }
  }, [myUid, theirUid]);

  return { isFollowing, loading, follow, unfollow, isOwnProfile: myUid === theirUid };
}
