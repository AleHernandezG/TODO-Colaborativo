import type { ReactNode } from 'react'
import { Pressable, Text, View } from 'react-native'

import { minTouchTarget } from '@/theme'

type Props = {
  title: string
  backLabel: string
  onBack: () => void
  right?: ReactNode
}

export function ExpensesHeader({ title, backLabel, onBack, right }: Props) {
  return (
    <View className="flex-row items-center gap-1 border-b border-line px-2 py-2 dark:border-line-dark">
      <Pressable
        onPress={onBack}
        accessibilityRole="button"
        accessibilityLabel={backLabel}
        style={{ minWidth: minTouchTarget, minHeight: minTouchTarget }}
        className="items-center justify-center rounded-md active:opacity-60"
      >
        <Text className="text-2xl text-primary dark:text-primary-dark">←</Text>
      </Pressable>

      <Text
        accessibilityRole="header"
        numberOfLines={1}
        className="flex-1 text-xl font-bold text-content dark:text-content-dark"
      >
        {title}
      </Text>

      {right}
    </View>
  )
}
