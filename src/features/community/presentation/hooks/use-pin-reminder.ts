import { useEffect, useMemo } from 'react'

import { describeFailure, logFailure } from '@/shared/lib/errors'

import { type PinReminder, pinReminderFor } from '../../domain/pin-reminder'
import { usePinReminderStore } from '../stores/pin-reminder-store'
import { useCommunityMembers } from './use-community-members'
import { useMyPinState } from './use-my-pin-state'

export function usePinReminder(communityId: string): {
  reminder: PinReminder
  dismiss: () => void
} {
  const { data: pinState, error: pinStateError } = useMyPinState(communityId)
  const { data: members, error: membersError } = useCommunityMembers(communityId)
  const dismissed = usePinReminderStore((state) => state.dismissed.includes(communityId))
  const dismissFor = usePinReminderStore((state) => state.dismiss)

  useEffect(() => {
    if (pinStateError) {
      logFailure(describeFailure(pinStateError))
    }
  }, [pinStateError])

  useEffect(() => {
    if (membersError) {
      logFailure(describeFailure(membersError))
    }
  }, [membersError])

  const reminder = useMemo((): PinReminder => {
    if (!pinState || !members) {
      return { kind: 'none' }
    }
    const next = pinReminderFor(pinState, members)
    if (next.kind !== 'none' && next.dismissible && dismissed) {
      return { kind: 'none' }
    }
    return next
  }, [pinState, members, dismissed])

  return { reminder, dismiss: () => dismissFor(communityId) }
}
