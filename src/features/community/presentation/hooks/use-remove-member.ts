import { useMutation, useQueryClient } from '@tanstack/react-query'

import { supabaseCommunityRepository } from '../../data/supabase-community-repository'

export function useRemoveMember(communityId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (memberId: string) =>
      supabaseCommunityRepository.removeMember(communityId, memberId),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ['community-members', communityId],
      })
      void queryClient.invalidateQueries({
        queryKey: ['expenses', communityId],
      })
      void queryClient.invalidateQueries({
        queryKey: ['settlements', communityId],
      })
    },
  })
}
