import type { ReactNode } from 'react'
import { KeyboardAvoidingView, View } from 'react-native'

type ActionBarProps = {
  children: ReactNode
}

export function ActionBar({ children }: ActionBarProps) {
  return (
    <KeyboardAvoidingView behavior="padding">
      <View className="gap-2 border-t border-line bg-background px-4 py-3 dark:border-line-dark dark:bg-background-dark">
        {children}
      </View>
    </KeyboardAvoidingView>
  )
}
