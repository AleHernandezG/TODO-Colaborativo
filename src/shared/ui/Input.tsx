import { Text, TextInput, View } from 'react-native'

import { minTouchTarget, usePalette } from '@/theme'

type InputProps = {
  label: string
  value: string
  onChangeText: (value: string) => void
  placeholder?: string
  error?: string | null
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters'
  autoCorrect?: boolean
  maxLength?: number
  autoFocus?: boolean
  returnKeyType?: 'next' | 'done'
  onSubmitEditing?: () => void
  testID?: string
  secureTextEntry?: boolean
  keyboardType?: 'default' | 'numeric' | 'email-address' | 'number-pad'
}

export function Input({
  label,
  value,
  onChangeText,
  placeholder,
  error = null,
  autoCapitalize = 'sentences',
  autoCorrect = true,
  maxLength,
  autoFocus = false,
  returnKeyType = 'done',
  onSubmitEditing,
  testID,
  secureTextEntry = false,
  keyboardType = 'default',
}: InputProps) {
  const palette = usePalette()

  return (
    <View className="gap-2">
      <Text className="text-base font-medium text-content dark:text-content-dark">{label}</Text>

      <TextInput
        testID={testID}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={palette.textMuted}
        autoCapitalize={autoCapitalize}
        autoCorrect={autoCorrect}
        maxLength={maxLength}
        autoFocus={autoFocus}
        returnKeyType={returnKeyType}
        onSubmitEditing={onSubmitEditing}
        secureTextEntry={secureTextEntry}
        keyboardType={keyboardType}
        accessibilityLabel={label}
        accessibilityHint={error ?? undefined}
        style={{ minHeight: minTouchTarget, color: palette.text }}
        className={`rounded-md border bg-surface px-4 py-3 text-lg dark:bg-surface-dark ${
          error
            ? 'border-danger dark:border-danger-dark'
            : 'border-line-strong dark:border-line-strong-dark'
        }`}
      />

      {error ? (
        <Text
          accessibilityLiveRegion="polite"
          className="text-sm text-danger dark:text-danger-dark"
        >
          {error}
        </Text>
      ) : null}
    </View>
  )
}
