import type { CommunityMember, PinState } from './community-repository'
import { isOnlyActiveAdmin } from './member-actions'

export type PinReminder =
  | { kind: 'none' }
  | { kind: 'set_pin' | 'change_pin'; dismissible: boolean }

export function pinReminderFor(
  state: PinState,
  members: readonly CommunityMember[],
): PinReminder {
  if (state === 'set') {
    return { kind: 'none' }
  }

  return {
    kind: state === 'none' ? 'set_pin' : 'change_pin',
    dismissible: !isOnlyActiveAdmin(members),
  }
}
