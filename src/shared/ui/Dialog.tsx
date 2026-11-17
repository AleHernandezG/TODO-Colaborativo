import type { ReactNode } from 'react'
import { ScrollView, View } from 'react-native'
import { Dialog as PaperDialog, Portal } from 'react-native-paper'

import { radius, usePalette } from '@/theme'

import { Button } from './Button'

type DialogProps = {
  visible: boolean
  title: string
  onDismiss: () => void
  onCancel?: () => void
  dismissable?: boolean
  confirmLabel: string
  onConfirm: () => void
  confirmDisabled?: boolean
  confirmLoading?: boolean
  confirmLoadingLabel?: string
  cancelLabel: string
  cancelDisabled?: boolean
  children: ReactNode
}

export function Dialog({
  visible,
  title,
  onDismiss,
  onCancel = onDismiss,
  dismissable = true,
  confirmLabel,
  onConfirm,
  confirmDisabled = false,
  confirmLoading = false,
  confirmLoadingLabel,
  cancelLabel,
  cancelDisabled = false,
  children,
}: DialogProps) {
  const palette = usePalette()

  return (
    <Portal>
      <PaperDialog
        visible={visible}
        onDismiss={onDismiss}
        dismissable={dismissable}
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
          <View className="w-full flex-row gap-3">
            <View className="flex-1">
              <Button
                label={cancelLabel}
                onPress={onCancel}
                disabled={cancelDisabled}
                variant="secondary"
                size="sm"
              />
            </View>
            <View className="flex-1">
              <Button
                label={confirmLabel}
                onPress={onConfirm}
                disabled={confirmDisabled}
                loading={confirmLoading}
                loadingLabel={confirmLoadingLabel}
                size="sm"
              />
            </View>
          </View>
        </PaperDialog.Actions>
      </PaperDialog>
    </Portal>
  )
}
