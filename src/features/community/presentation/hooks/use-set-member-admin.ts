import { useMutation, useQueryClient } from '@tanstack/react-query'

import { supabaseCommunityRepository } from '../../data/supabase-community-repository'
import { allCommunityMembersKey } from './use-community-members'

export function useSetMemberAdmin(communityId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ memberId, isAdmin }: { memberId: string; isAdmin: boolean }) =>
      supabaseCommunityRepository.setMemberAdmin(communityId, memberId, isAdmin),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: allCommunityMembersKey(communityId) })
    },
  })
}
