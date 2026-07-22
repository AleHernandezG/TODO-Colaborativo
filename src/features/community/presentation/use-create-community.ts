import { useMutation } from '@tanstack/react-query'

import { supabaseCommunityRepository } from '../data/supabase-community-repository'
import { createCommunity } from '../domain/create-community'
import { useActiveCommunityStore } from './active-community-store'

export function useCreateCommunity() {
  const setMembership = useActiveCommunityStore((state) => state.setMembership)

  return useMutation({
    mutationFn: (input: { name: string; username: string }) =>
      createCommunity(supabaseCommunityRepository, input),
    onSuccess: (result) => {
      if (result.status === 'ok') {
        setMembership(result.membership)
      }
    },
  })
}
