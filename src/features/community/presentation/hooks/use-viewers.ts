import { useEffect, useMemo, useState } from 'react'

import { supabasePresenceRepository } from '../../data/supabase-presence-repository'
import { othersViewing } from '../../domain/viewers'

export function useViewers(communityId: string, username: string) {
  const [present, setPresent] = useState<string[]>([])

  useEffect(() => {
    setPresent([])
    return supabasePresenceRepository.watch({ communityId, username }, setPresent)
  }, [communityId, username])

  return useMemo(() => othersViewing(present, username), [present, username])
}
