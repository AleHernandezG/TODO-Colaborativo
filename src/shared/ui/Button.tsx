import { ActivityIndicator, Pressable, Text } from 'react-native'

import { minTouchTarget, usePalette } from '../../theme'

type ButtonProps = {
  label: string
  onPress: () => void
  variant?: 'primary' | 'secondary'
  disabled?: boolean
  loading?: boolean
  accessibilityHint?: string
}

const container = {
  primary: 'bg-primary dark:bg-primary-dark',
  secondary: 'bg-surface dark:bg-surface-dark border border-line dark:border-line-dark',
}

const label = {
  primary: 'text-on-primary dark:text-on-primary-dark',
  secondary: 'text-content dark:text-content-dark',
}

export function Button({
  label: text,
  onPress,
  variant = 'primary',
  disabled = false,
  loading = false,
  accessibilityHint,
}: ButtonProps) {
  const palette = usePalette()
  const blocked = disabled || loading

  return (
    <Pressable
      onPress={onPress}
      disabled={blocked}
      accessibilityRole="button"
      accessibilityLabel={text}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: blocked, busy: loading }}
      style={{ minHeight: minTouchTarget }}
      className={`w-full items-center justify-center rounded-md px-6 py-3 ${container[variant]} ${
        blocked ? 'opacity-50' : 'active:opacity-80'
      }`}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'primary' ? palette.onPrimary : palette.text} />
      ) : (
        <Text className={`text-lg font-semibold ${label[variant]}`}>{text}</Text>
      )}
    </Pressable>
  )
}
