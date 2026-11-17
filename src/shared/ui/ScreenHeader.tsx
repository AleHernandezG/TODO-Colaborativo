import type { ReactNode } from 'react'
import { Pressable, Text, View } from 'react-native'

import { minTouchTarget } from '@/theme'

type ScreenHeaderProps = {
  title: string
  onBack: () => void
  backLabel: string
  right?: ReactNode
}

export function ScreenHeader({ title, onBack, backLabel, right }: ScreenHeaderProps) {
  return (
    <View className="flex-row items-center gap-1 border-b border-line px-2 py-2 dark:border-line-dark">
      <Pressable
        onPress={onBack}
        accessibilityRole="button"
        accessibilityLabel={backLabel}
        style={{ minWidth: minTouchTarget, minHeight: minTouchTarget }}
        className="items-center justify-center rounded-full active:opacity-70"
      >
        <Text
          maxFontSizeMultiplier={1}
          importantForAccessibility="no"
          className="text-2xl text-primary dark:text-primary-dark"
        >
          ←
        </Text>
      </Pressable>

      <Text
        accessibilityRole="header"
        numberOfLines={2}
        className="flex-1 text-xl font-bold text-content dark:text-content-dark"
      >
        {title}
      </Text>

      {right}
    </View>
  )
}
