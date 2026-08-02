import { create } from 'zustand'

type DeletingItemsState = {
  ids: string[]
  markDeleting: (itemId: string) => void
  clearDeleting: (itemId: string) => void
}

export const useDeletingItemsStore = create<DeletingItemsState>((set) => ({
  ids: [],
  markDeleting: (itemId) =>
    set((state) => (state.ids.includes(itemId) ? state : { ids: [...state.ids, itemId] })),
  clearDeleting: (itemId) =>
    set((state) =>
      state.ids.includes(itemId) ? { ids: state.ids.filter((id) => id !== itemId) } : state,
    ),
}))
