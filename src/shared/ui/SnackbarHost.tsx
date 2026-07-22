import { Snackbar } from 'react-native-paper'

import { useSnackbarStore } from '../hooks/use-snackbar'

export function SnackbarHost() {
  const message = useSnackbarStore((state) => state.message)
  const action = useSnackbarStore((state) => state.action)
  const dismiss = useSnackbarStore((state) => state.dismiss)

  return (
    <Snackbar
      visible={message !== null}
      onDismiss={dismiss}
      duration={5000}
      action={
        action
          ? {
              label: action.label,
              onPress: () => {
                action.onPress()
                dismiss()
              },
            }
          : undefined
      }
    >
      {message ?? ''}
    </Snackbar>
  )
}
