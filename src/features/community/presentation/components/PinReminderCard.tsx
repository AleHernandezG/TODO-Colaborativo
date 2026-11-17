import { useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { Text, View } from 'react-native'

import { Button } from '@/shared/ui/Button'

import { usePinReminder } from '../hooks/use-pin-reminder'

type PinReminderCardProps = {
  communityId: string
  username: string
}

export function PinReminderCard({ communityId, username }: PinReminderCardProps) {
  const { t } = useTranslation()
  const router = useRouter()
  const { reminder, dismiss } = usePinReminder(communityId)

  if (reminder.kind === 'none') {
    return null
  }

  const asksToChange = reminder.kind === 'change_pin'
  const title = asksToChange
    ? t('members.pinReminder.changeTitle')
    : t('members.pinReminder.setTitle')
  const body = asksToChange
    ? t('members.pinReminder.changeBody')
    : reminder.dismissible
      ? t('members.pinReminder.setBody', { name: username })
      : t('members.pinReminder.onlyAdminBody')

  return (
    <View
      testID="pin-reminder"
      className="gap-2 rounded-lg border border-line-strong bg-surface p-4 dark:border-line-strong-dark dark:bg-surface-dark"
    >
      <Text
        accessibilityRole="header"
        className="text-lg font-bold text-content dark:text-content-dark"
      >
        {title}
      </Text>
      <Text className="text-base text-content dark:text-content-dark">{body}</Text>

      <View className="flex-row flex-wrap gap-3">
        <Button
          label={
            asksToChange
              ? t('members.pinReminder.changeAction')
              : t('members.pinReminder.setAction')
          }
          onPress={() => router.push('/members/pin')}
          variant="secondary"
          size="sm"
          fullWidth={false}
        />
        {reminder.dismissible ? (
          <Button
            label={t('members.pinReminder.later')}
            onPress={dismiss}
            variant="secondary"
            size="sm"
            fullWidth={false}
          />
        ) : null}
      </View>
    </View>
  )
}
