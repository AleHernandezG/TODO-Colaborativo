import { create } from 'zustand'

type SnackbarAction = {
  label: string
  onPress: () => void
}

type SnackbarState = {
  message: string | null
  action: SnackbarAction | null
  show: (message: string, action?: SnackbarAction) => void
  dismiss: () => void
}

export const useSnackbarStore = create<SnackbarState>((set) => ({
  message: null,
  action: null,
  show: (message, action) => set({ message, action: action ?? null }),
  dismiss: () => set({ message: null, action: null }),
}))

export function useSnackbar() {
  return useSnackbarStore((state) => state.show)
}
