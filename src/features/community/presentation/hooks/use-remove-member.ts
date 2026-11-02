import { useMutation, useQueryClient } from '@tanstack/react-query'

import { supabaseCommunityRepository } from '../../data/supabase-community-repository'
import { allCommunityMembersKey } from './use-community-members'

export function useRemoveMember(communityId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (memberId: string) =>
      supabaseCommunityRepository.removeMember(communityId, memberId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: allCommunityMembersKey(communityId) })
      void queryClient.invalidateQueries({
        queryKey: ['expenses', communityId],
      })
      void queryClient.invalidateQueries({
        queryKey: ['settlements', communityId],
      })
    },
  })
}
