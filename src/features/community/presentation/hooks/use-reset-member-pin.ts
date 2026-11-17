import { useMutation, useQueryClient } from '@tanstack/react-query'

import { supabaseCommunityRepository } from '../../data/supabase-community-repository'
import type { CommunityMember } from '../../domain/community-repository'
import { resetMemberPin } from '../../domain/reset-member-pin'
import { useIssuedPinStore } from '../stores/issued-pin-store'
import { allCommunityMembersKey } from './use-community-members'

export function useResetMemberPin(communityId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    networkMode: 'always',
    mutationFn: (input: { viewer: CommunityMember | undefined; target: CommunityMember }) =>
      resetMemberPin(supabaseCommunityRepository, { ...input, communityId }),
    onSuccess: (result, { target }) => {
      if (result.status === 'ok') {
        useIssuedPinStore.getState().issue({
          communityId,
          memberId: target.id,
          name: target.username,
          tempPin: result.tempPin,
        })
      }
      void queryClient.invalidateQueries({ queryKey: allCommunityMembersKey(communityId) })
    },
  })
}
