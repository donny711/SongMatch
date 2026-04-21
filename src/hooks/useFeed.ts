import { useQuery } from '@tanstack/react-query';
import { getFollowingIds, getFeedItems, type FeedItem } from '../firebase/socialService';
import { useProfileStore } from '../store/profileStore';

export function useFeed() {
  const myUid = useProfileStore((s) => s.uid);

  return useQuery<FeedItem[]>({
    queryKey: ['feed', myUid],
    queryFn: async () => {
      if (!myUid) return [];
      const followingUids = await getFollowingIds(myUid);
      if (followingUids.length === 0) return [];
      return getFeedItems(followingUids);
    },
    enabled: !!myUid,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}
