import { useMutation, useQueryClient } from '@tanstack/react-query'

import { supabaseCommunityRepository } from '../../data/supabase-community-repository'

export function useAddGuest(communityId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (username: string) =>
      supabaseCommunityRepository.addGuestMember(communityId, username),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ['community-members', communityId],
      })
    },
  })
}
