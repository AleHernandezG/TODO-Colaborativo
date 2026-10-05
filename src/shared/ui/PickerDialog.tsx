import type { ReactNode } from 'react'
import { ScrollView } from 'react-native'
import { Dialog as PaperDialog, Portal } from 'react-native-paper'

import { radius, usePalette } from '@/theme'

import { Button } from './Button'

type PickerDialogProps = {
  visible: boolean
  title: string
  onDismiss: () => void
  closeLabel: string
  children: ReactNode
}

export function PickerDialog({
  visible,
  title,
  onDismiss,
  closeLabel,
  children,
}: PickerDialogProps) {
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
            contentContainerStyle={{ paddingHorizontal: 20, paddingVertical: 12 }}
            keyboardShouldPersistTaps="handled"
          >
            {children}
          </ScrollView>
        </PaperDialog.ScrollArea>

        <PaperDialog.Actions style={{ paddingHorizontal: 20, paddingVertical: 16 }}>
          <Button label={closeLabel} onPress={onDismiss} variant="secondary" size="sm" />
        </PaperDialog.Actions>
      </PaperDialog>
    </Portal>
  )
}
