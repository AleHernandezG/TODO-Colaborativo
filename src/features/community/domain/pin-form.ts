import type { PinState } from './community-repository'
import { isValidPin, normalizePin } from './pin'

export type PinFormInput = {
  hasPin: boolean
  currentPin: string
  newPin: string
  repeatPin: string
}

export type PinFormErrors = {
  currentPin?: 'invalid'
  newPin?: 'invalid'
  repeatPin?: 'mismatch'
}

export function needsCurrentPin(state: PinState): boolean {
  return state !== 'none'
}

export function validatePinForm(input: PinFormInput): PinFormErrors {
  const errors: PinFormErrors = {}

  if (input.hasPin && !isValidPin(input.currentPin)) {
    errors.currentPin = 'invalid'
  }
  if (!isValidPin(input.newPin)) {
    errors.newPin = 'invalid'
  } else if (normalizePin(input.repeatPin) !== normalizePin(input.newPin)) {
    errors.repeatPin = 'mismatch'
  }

  return errors
}

export function hasPinFormErrors(errors: PinFormErrors): boolean {
  return Object.keys(errors).length > 0
}
