import { Input } from '@/shared/ui/Input'

import { pinLength } from '../../domain/pin'

type PinFieldProps = {
  label: string
  value: string
  onChangeText: (value: string) => void
  showDigits: boolean
  error?: string | null
  help?: string
  autoFocus?: boolean
  onSubmitEditing?: () => void
  testID: string
}

export function PinField({
  label,
  value,
  onChangeText,
  showDigits,
  error,
  help,
  autoFocus = false,
  onSubmitEditing,
  testID,
}: PinFieldProps) {
  return (
    <Input
      testID={testID}
      label={label}
      value={value}
      onChangeText={(next) => onChangeText(next.replace(/\D/g, ''))}
      error={error}
      help={help}
      maxLength={pinLength}
      keyboardType="number-pad"
      secureTextEntry={!showDigits}
      autoCapitalize="none"
      autoCorrect={false}
      autoFocus={autoFocus}
      returnKeyType={onSubmitEditing ? 'done' : 'next'}
      onSubmitEditing={onSubmitEditing}
    />
  )
}
