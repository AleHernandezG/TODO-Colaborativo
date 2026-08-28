import { create } from 'zustand'

type DeletingRowsState = {
  ids: string[]
  markDeleting: (rowId: string) => void
  clearDeleting: (rowId: string) => void
}

export const useDeletingRowsStore = create<DeletingRowsState>((set) => ({
  ids: [],
  markDeleting: (rowId) =>
    set((state) => (state.ids.includes(rowId) ? state : { ids: [...state.ids, rowId] })),
  clearDeleting: (rowId) =>
    set((state) =>
      state.ids.includes(rowId) ? { ids: state.ids.filter((id) => id !== rowId) } : state,
    ),
}))

export const deleteUndoWindowMs = 5000
