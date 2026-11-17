import { ActivityIndicator, Pressable, Text, View } from 'react-native'

import { minTouchTarget, usePalette } from '@/theme'

type ButtonProps = {
  label: string
  onPress: () => void
  variant?: 'primary' | 'secondary' | 'danger'
  size?: 'md' | 'sm'
  disabled?: boolean
  loading?: boolean
  loadingLabel?: string
  fullWidth?: boolean
  accessibilityLabel?: string
  accessibilityHint?: string
}

const container = {
  primary: 'bg-primary dark:bg-primary-dark',
  secondary:
    'bg-surface dark:bg-surface-dark border border-line-strong dark:border-line-strong-dark',
  danger: 'bg-surface dark:bg-surface-dark border border-danger dark:border-danger-dark',
}

const label = {
  primary: 'text-on-primary dark:text-on-primary-dark',
  secondary: 'text-content dark:text-content-dark',
  danger: 'text-danger dark:text-danger-dark',
}

const padding = {
  md: 'px-6 py-3',
  sm: 'px-4 py-2',
}

const labelSize = {
  md: 'text-lg',
  sm: 'text-base',
}

export function Button({
  label: text,
  onPress,
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  loadingLabel,
  fullWidth = true,
  accessibilityLabel,
  accessibilityHint,
}: ButtonProps) {
  const palette = usePalette()
  const blocked = disabled || loading

  return (
    <Pressable
      onPress={onPress}
      disabled={blocked}
      accessibilityRole="button"
      accessibilityLabel={loading && loadingLabel ? loadingLabel : (accessibilityLabel ?? text)}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: blocked, busy: loading }}
      style={{ minHeight: minTouchTarget }}
      className={`${fullWidth ? 'w-full' : 'self-start'} items-center justify-center rounded-md ${
        padding[size]
      } ${container[variant]} ${blocked ? 'opacity-50' : 'active:opacity-80'}`}
    >
      {loading ? (
        <View className="flex-row items-center gap-2">
          <ActivityIndicator
            color={
              variant === 'primary'
                ? palette.onPrimary
                : variant === 'danger'
                  ? palette.danger
                  : palette.text
            }
          />
          {loadingLabel ? (
            <Text className={`${labelSize[size]} font-semibold ${label[variant]}`}>
              {loadingLabel}
            </Text>
          ) : null}
        </View>
      ) : (
        <Text className={`${labelSize[size]} font-semibold ${label[variant]}`}>{text}</Text>
      )}
    </Pressable>
  )
}
