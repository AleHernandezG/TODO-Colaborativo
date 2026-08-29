import { supabase } from '@/shared/lib/supabase'

import type { PresenceRepository } from '../domain/presence-repository'

const settleMs = 2000

type PresenceEntry = { username?: string }

export const supabasePresenceRepository: PresenceRepository = {
  watch({ communityId, username }, onChange) {
    const channel = supabase.channel(`presence:${communityId}`, {
      config: { presence: { key: username, enabled: true } },
    })

    let settleTimer: ReturnType<typeof setTimeout> | undefined

    const publish = () => {
      const tracked = Object.values(channel.presenceState<PresenceEntry>()).flat()
      const names = tracked
        .map((entry) => entry.username)
        .filter((name): name is string => typeof name === 'string' && name.length > 0)

      onChange([...new Set(names)])
    }

    channel.on('presence', { event: 'sync' }, publish).subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        void channel.track({ username })
        clearTimeout(settleTimer)
        settleTimer = setTimeout(() => void channel.track({ username }), settleMs)
        return
      }
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
        onChange([])
      }
    })

    return () => {
      clearTimeout(settleTimer)
      void channel.untrack()
      void supabase.removeChannel(channel)
    }
  },
}
