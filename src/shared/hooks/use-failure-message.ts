import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'

import { describeFailure, type FailureKind, logFailure } from '../lib/errors'

const messageKeys: Record<FailureKind, string> = {
  offline: 'errors.offline',
  timeout: 'errors.timeout',
  unreachable: 'errors.unreachable',
  rejected: 'errors.rejected',
  unknown: 'errors.unknown',
}

const keepsOwnMessage: FailureKind[] = ['rejected', 'unknown']

export function useFailureMessage() {
  const { t } = useTranslation()

  return useCallback(
    (cause: unknown, actionMessage?: string) => {
      const failure = describeFailure(cause)
      logFailure(failure)

      const message =
        actionMessage && keepsOwnMessage.includes(failure.kind)
          ? actionMessage
          : t(messageKeys[failure.kind])

      return failure.code ? t('errors.withCode', { message, code: failure.code }) : message
    },
    [t],
  )
}
