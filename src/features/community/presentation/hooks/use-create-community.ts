import { useMutation } from '@tanstack/react-query'

import { supabaseCommunityRepository } from '../../data/supabase-community-repository'
import { createCommunity } from '../../domain/create-community'
import { useEnterCommunity } from './use-enter-community'

export function useCreateCommunity() {
  const enterCommunity = useEnterCommunity()

  return useMutation({
    networkMode: 'always',
    mutationFn: (input: { name: string; username: string; pin: string }) =>
      createCommunity(supabaseCommunityRepository, input),
    onSuccess: async (result) => {
      if (result.status === 'ok') {
        await enterCommunity(result.membership)
      }
    },
  })
}
