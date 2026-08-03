import type { ReactNode } from 'react'
import { ScrollView, useColorScheme, View } from 'react-native'
import { Dialog as PaperDialog, Portal } from 'react-native-paper'

import { colors, radius } from '../../theme'
import { Button } from './Button'

type DialogProps = {
  visible: boolean
  title: string
  onDismiss: () => void
  confirmLabel: string
  onConfirm: () => void
  confirmDisabled?: boolean
  cancelLabel: string
  children: ReactNode
}

export function Dialog({
  visible,
  title,
  onDismiss,
  confirmLabel,
  onConfirm,
  confirmDisabled = false,
  cancelLabel,
  children,
}: DialogProps) {
  const scheme = useColorScheme()
  const palette = scheme === 'dark' ? colors.dark : colors.light

  return (
    <Portal>
      <PaperDialog
        visible={visible}
        onDismiss={onDismiss}
        style={{ backgroundColor: palette.surface, borderRadius: radius.lg }}
      >
        <PaperDialog.Title style={{ color: palette.text }}>{title}</PaperDialog.Title>

        <PaperDialog.ScrollArea style={{ paddingHorizontal: 0, borderColor: palette.border }}>
          <ScrollView
            contentContainerStyle={{ paddingHorizontal: 24, paddingVertical: 8 }}
            keyboardShouldPersistTaps="handled"
          >
            {children}
          </ScrollView>
        </PaperDialog.ScrollArea>

        <PaperDialog.Actions>
          <View className="w-full flex-row gap-3">
            <View className="flex-1">
              <Button label={cancelLabel} onPress={onDismiss} variant="secondary" />
            </View>
            <View className="flex-1">
              <Button label={confirmLabel} onPress={onConfirm} disabled={confirmDisabled} />
            </View>
          </View>
        </PaperDialog.Actions>
      </PaperDialog>
    </Portal>
  )
}
