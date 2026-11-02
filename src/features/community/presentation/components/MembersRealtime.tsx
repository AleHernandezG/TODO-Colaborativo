import { useMembersRealtime } from '../hooks/use-members-realtime'
import { useActiveCommunityStore } from '../stores/active-community-store'

export function MembersRealtime() {
  const communityId = useActiveCommunityStore((state) => state.membership?.community.id)
  useMembersRealtime(communityId)
  return null
}
