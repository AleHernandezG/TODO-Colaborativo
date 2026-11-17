import { create } from 'zustand'

type PinReminderState = {
  dismissed: string[]
  dismiss: (communityId: string) => void
}

export const usePinReminderStore = create<PinReminderState>((set) => ({
  dismissed: [],
  dismiss: (communityId) =>
    set((state) =>
      state.dismissed.includes(communityId)
        ? state
        : { dismissed: [...state.dismissed, communityId] },
    ),
}))
