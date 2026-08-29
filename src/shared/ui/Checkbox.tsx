import { Pressable, Text, View } from 'react-native'

import { minTouchTarget } from '@/theme'

type CheckboxProps = {
  checked: boolean
  onToggle: () => void
  accessibilityLabel: string
}

export function Checkbox({ checked, onToggle, accessibilityLabel }: CheckboxProps) {
  return (
    <Pressable
      onPress={onToggle}
      accessibilityRole="checkbox"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ checked }}
      hitSlop={8}
      style={{ minWidth: minTouchTarget, minHeight: minTouchTarget }}
      className="items-center justify-center active:opacity-70"
    >
      <View
        className={`h-7 w-7 items-center justify-center rounded-md ${
          checked
            ? 'bg-primary dark:bg-primary-dark'
            : 'border-2 border-line-strong dark:border-line-strong-dark'
        }`}
      >
        {checked ? (
          <Text className="text-base font-bold text-on-primary dark:text-on-primary-dark">✓</Text>
        ) : null}
      </View>
    </Pressable>
  )
}
