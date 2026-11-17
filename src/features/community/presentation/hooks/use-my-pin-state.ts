import { useQuery } from '@tanstack/react-query'

import { supabaseCommunityRepository } from '../../data/supabase-community-repository'

export function myPinStateKey(communityId: string) {
  return ['member-pin-state', communityId] as const
}

export function useMyPinState(communityId: string) {
  return useQuery({
    queryKey: myPinStateKey(communityId),
    queryFn: () => supabaseCommunityRepository.getMyPinState(communityId),
  })
}
