import type { CommunityRepository, SetPinOutcome } from './community-repository'
import { normalizePin } from './pin'
import { hasPinFormErrors, type PinFormErrors, type PinFormInput, validatePinForm } from './pin-form'

export type ChangeMyPinResult = SetPinOutcome | { status: 'invalid_form'; errors: PinFormErrors }

export async function changeMyPin(
  repository: CommunityRepository,
  input: PinFormInput & { communityId: string },
): Promise<ChangeMyPinResult> {
  const errors = validatePinForm(input)
  if (hasPinFormErrors(errors)) {
    return { status: 'invalid_form', errors }
  }

  return repository.setMyPin({
    communityId: input.communityId,
    newPin: normalizePin(input.newPin),
    currentPin: input.hasPin ? normalizePin(input.currentPin) : undefined,
  })
}
