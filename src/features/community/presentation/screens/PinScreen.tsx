import { Redirect, useRouter } from 'expo-router'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ActivityIndicator, ScrollView, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { useFailureMessage } from '@/shared/hooks/use-failure-message'
import { useSlowPending } from '@/shared/hooks/use-slow-pending'
import { ActionBar } from '@/shared/ui/ActionBar'
import { Button } from '@/shared/ui/Button'
import { Checkbox } from '@/shared/ui/Checkbox'
import { ScreenHeader } from '@/shared/ui/ScreenHeader'
import { usePalette } from '@/theme'

import { needsCurrentPin, type PinFormErrors } from '../../domain/pin-form'
import { PinField } from '../components/PinField'
import { useMyPinState } from '../hooks/use-my-pin-state'
import { useSetMyPin } from '../hooks/use-set-my-pin'
import { useActiveCommunityStore } from '../stores/active-community-store'

type FieldMessages = Partial<Record<keyof PinFormErrors, string>>

export function PinScreen() {
  const membership = useActiveCommunityStore((state) => state.membership)

  if (!membership) {
    return <Redirect href="/" />
  }

  return (
    <PinContent
      key={membership.community.id}
      communityId={membership.community.id}
      username={membership.username}
    />
  )
}

function PinContent({ communityId, username }: { communityId: string; username: string }) {
  const { t } = useTranslation()
  const router = useRouter()
  const palette = usePalette()
  const failureMessage = useFailureMessage()

  const pinState = useMyPinState(communityId)
  const setMyPin = useSetMyPin(communityId)
  const waitingLong = useSlowPending(setMyPin.isPending)

  const [currentPin, setCurrentPin] = useState('')
  const [newPin, setNewPin] = useState('')
  const [repeatPin, setRepeatPin] = useState('')
  const [showDigits, setShowDigits] = useState(false)
  const [fieldMessages, setFieldMessages] = useState<FieldMessages>({})
  const [submitMessage, setSubmitMessage] = useState<string | null>(null)

  const loadErrorMessage = useMemo(
    () => (pinState.isError ? failureMessage(pinState.error, t('members.pin.loadError')) : null),
    [pinState.isError, pinState.error, failureMessage, t],
  )

  const goBack = () => {
    if (router.canGoBack()) {
      router.back()
      return
    }
    router.replace('/members')
  }

  const hasPin = pinState.data !== undefined && needsCurrentPin(pinState.data)

  const messagesFor = (errors: PinFormErrors): FieldMessages => ({
    currentPin: errors.currentPin ? t('members.pin.errors.invalid') : undefined,
    newPin: errors.newPin ? t('members.pin.errors.invalid') : undefined,
    repeatPin: errors.repeatPin ? t('members.pin.errors.mismatch') : undefined,
  })

  const withStatusCode = (message: string, code: string) => t('errors.withCode', { message, code })

  const submit = () => {
    if (setMyPin.isPending || pinState.data === undefined) {
      return
    }
    setFieldMessages({})
    setSubmitMessage(null)

    setMyPin.mutate(
      { hasPin, currentPin, newPin, repeatPin },
      {
        onSuccess: (result) => {
          switch (result.status) {
            case 'ok':
              goBack()
              return
            case 'invalid_form':
              setFieldMessages(messagesFor(result.errors))
              return
            case 'invalid_pin':
              setFieldMessages({ newPin: t('members.pin.errors.invalid') })
              return
            case 'wrong_pin':
              if (!hasPin) {
                setSubmitMessage(withStatusCode(t('members.pin.errors.alreadyHasPin'), 'wrong_pin'))
                return
              }
              setFieldMessages({
                currentPin: withStatusCode(t('members.pin.errors.wrongCurrent'), 'wrong_pin'),
              })
              return
            case 'too_many_attempts':
              setSubmitMessage(
                withStatusCode(t('members.pin.errors.tooManyAttempts'), 'too_many_attempts'),
              )
              return
          }
        },
        onError: (cause) => {
          setSubmitMessage(
            failureMessage(cause, t('members.pin.errors.failed'), {
              offline: t('members.pin.errors.offline'),
              timeout: t('members.pin.errors.timeout'),
              unreachable: t('members.pin.errors.timeout'),
            }),
          )
        },
      },
    )
  }

  const firstFieldMessage = hasPin ? fieldMessages.currentPin : fieldMessages.newPin

  return (
    <SafeAreaView className="flex-1 bg-background dark:bg-background-dark">
      <ScreenHeader title={t('members.pin.title')} onBack={goBack} backLabel={t('members.back')} />

      <ScrollView className="flex-1" keyboardShouldPersistTaps="handled">
        <View className="gap-4 p-4">
          <Text className="text-base text-content dark:text-content-dark">
            {t('members.pin.intro', { name: username })}
          </Text>

          {pinState.data === undefined ? (
            loadErrorMessage || pinState.isPaused ? (
              <View className="gap-3">
                <Text
                  accessibilityLiveRegion="polite"
                  className="text-base text-danger dark:text-danger-dark"
                >
                  {pinState.isPaused ? t('errors.offline') : loadErrorMessage}
                </Text>
                <Button
                  label={t('common.retry')}
                  onPress={() => void pinState.refetch()}
                  variant="secondary"
                  fullWidth={false}
                />
              </View>
            ) : (
              <ActivityIndicator
                color={palette.primary}
                accessibilityLabel={t('members.pin.loading')}
              />
            )
          ) : (
            <View className="gap-4">
              {hasPin ? (
                <PinField
                  testID="pin-current"
                  label={t('members.pin.currentLabel')}
                  value={currentPin}
                  onChangeText={setCurrentPin}
                  showDigits={showDigits}
                  error={firstFieldMessage}
                  autoFocus
                />
              ) : null}

              <PinField
                testID="pin-new"
                label={t('members.pin.newLabel')}
                help={t('members.pin.newHelp')}
                value={newPin}
                onChangeText={setNewPin}
                showDigits={showDigits}
                error={hasPin ? fieldMessages.newPin : firstFieldMessage}
                autoFocus={!hasPin}
              />

              <PinField
                testID="pin-repeat"
                label={t('members.pin.repeatLabel')}
                value={repeatPin}
                onChangeText={setRepeatPin}
                showDigits={showDigits}
                error={fieldMessages.repeatPin}
                onSubmitEditing={submit}
              />

              <View className="flex-row items-center gap-2">
                <Checkbox
                  checked={showDigits}
                  onToggle={() => setShowDigits((shown) => !shown)}
                  accessibilityLabel={t('members.pin.showDigits')}
                />
                <Text
                  importantForAccessibility="no"
                  className="flex-1 text-base text-content dark:text-content-dark"
                >
                  {t('members.pin.showDigits')}
                </Text>
              </View>
            </View>
          )}
        </View>
      </ScrollView>

      <ActionBar>
        {submitMessage ? (
          <Text
            accessibilityLiveRegion="polite"
            className="text-base text-danger dark:text-danger-dark"
          >
            {submitMessage}
          </Text>
        ) : null}
        <Button
          label={hasPin ? t('members.pin.submitChange') : t('members.pin.submitSet')}
          onPress={submit}
          disabled={pinState.data === undefined}
          loading={setMyPin.isPending}
          loadingLabel={waitingLong ? t('members.pin.waiting') : undefined}
        />
      </ActionBar>
    </SafeAreaView>
  )
}
