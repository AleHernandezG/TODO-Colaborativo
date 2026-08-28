import { useCallback } from 'react'

import { useFailureMessage } from './use-failure-message'
import { useSnackbar } from './use-snackbar'

export function useErrorSnackbar() {
  const failureMessage = useFailureMessage()
  const showSnackbar = useSnackbar()

  return useCallback(
    (cause: unknown, actionMessage?: string) => {
      showSnackbar(failureMessage(cause, actionMessage))
    },
    [failureMessage, showSnackbar],
  )
}
