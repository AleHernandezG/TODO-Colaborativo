import { useQuery } from '@tanstack/react-query'

import { supabaseCommunityRepository } from '../data/supabase-community-repository'
import type { CommunityMember } from '../domain/community-repository'

export function useCommunityMembers(communityId: string | null | undefined) {
  return useQuery({
    queryKey: ['community-members', communityId],
    queryFn: (): Promise<CommunityMember[]> => {
      if (!communityId) return Promise.resolve([])
      return supabaseCommunityRepository.listMembers(communityId)
    },
    enabled: Boolean(communityId),
    networkMode: 'offlineFirst',
  })
}
