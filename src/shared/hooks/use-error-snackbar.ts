import { useCallback } from 'react'

import { type MessagesByFailure, useFailureMessage } from './use-failure-message'
import { useSnackbar } from './use-snackbar'

export function useErrorSnackbar() {
  const failureMessage = useFailureMessage()
  const showSnackbar = useSnackbar()

  return useCallback(
    (cause: unknown, actionMessage?: string, byFailure?: MessagesByFailure) => {
      showSnackbar(failureMessage(cause, actionMessage, byFailure))
    },
    [failureMessage, showSnackbar],
  )
}
