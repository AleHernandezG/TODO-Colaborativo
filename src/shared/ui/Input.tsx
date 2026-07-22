import { Text, TextInput, useColorScheme, View } from 'react-native'

import { colors, minTouchTarget } from '../../theme'

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
}: InputProps) {
  const scheme = useColorScheme()
  const palette = scheme === 'dark' ? colors.dark : colors.light

  return (
    <View className="gap-2">
      <Text className="text-base font-medium text-content dark:text-content-dark">{label}</Text>

      <TextInput
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
        accessibilityLabel={label}
        accessibilityHint={error ?? undefined}
        style={{ minHeight: minTouchTarget, color: palette.text }}
        className={`rounded-md border bg-surface px-4 py-3 text-lg dark:bg-surface-dark ${
          error ? 'border-danger dark:border-danger-dark' : 'border-line dark:border-line-dark'
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
