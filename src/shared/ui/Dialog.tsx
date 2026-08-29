import type { ReactNode } from 'react'
import { ScrollView, View } from 'react-native'
import { Dialog as PaperDialog, Portal } from 'react-native-paper'

import { radius, usePalette } from '@/theme'

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
  const palette = usePalette()

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
            contentContainerStyle={{ paddingHorizontal: 20, paddingVertical: 8 }}
            keyboardShouldPersistTaps="handled"
          >
            {children}
          </ScrollView>
        </PaperDialog.ScrollArea>

        <PaperDialog.Actions style={{ paddingHorizontal: 20, paddingVertical: 16 }}>
          <View className="w-full flex-row gap-2">
            <View className="flex-1">
              <Button label={cancelLabel} onPress={onDismiss} variant="secondary" size="sm" />
            </View>
            <View className="flex-1">
              <Button
                label={confirmLabel}
                onPress={onConfirm}
                disabled={confirmDisabled}
                size="sm"
              />
            </View>
          </View>
        </PaperDialog.Actions>
      </PaperDialog>
    </Portal>
  )
}
