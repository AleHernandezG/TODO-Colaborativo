import AsyncStorage from '@react-native-async-storage/async-storage'
import { useEffect, useState } from 'react'
import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

import type { Membership } from '../../domain/community'

type ActiveCommunityState = {
  membership: Membership | null
  setMembership: (membership: Membership) => void
  leave: () => void
}

export const useActiveCommunityStore = create<ActiveCommunityState>()(
  persist(
    (set) => ({
      membership: null,
      setMembership: (membership) => set({ membership }),
      leave: () => set({ membership: null }),
    }),
    {
      name: 'active-community',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
)

export function useActiveCommunityHydrated(): boolean {
  const [hydrated, setHydrated] = useState(() => useActiveCommunityStore.persist.hasHydrated())

  useEffect(() => {
    const unsubscribe = useActiveCommunityStore.persist.onFinishHydration(() => setHydrated(true))
    if (useActiveCommunityStore.persist.hasHydrated()) {
      setHydrated(true)
    }
    return unsubscribe
  }, [])

  return hydrated
}
