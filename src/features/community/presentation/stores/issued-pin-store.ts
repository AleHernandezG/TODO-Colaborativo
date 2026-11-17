import { create } from 'zustand'

export type IssuedPin = {
  communityId: string
  memberId: string
  name: string
  tempPin: string
}

type IssuedPinState = {
  issued: IssuedPin | null
  issue: (pin: IssuedPin) => void
  clear: () => void
}

export const useIssuedPinStore = create<IssuedPinState>((set) => ({
  issued: null,
  issue: (pin) => set({ issued: pin }),
  clear: () => set({ issued: null }),
}))
