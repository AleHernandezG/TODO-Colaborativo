import { useRouter } from 'expo-router'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ScrollView, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { useErrorSnackbar } from '@/shared/hooks/use-error-snackbar'
import { ServerError } from '@/shared/lib/errors'
import { Button } from '@/shared/ui/Button'
import { Input } from '@/shared/ui/Input'

import { normalizeJoinCode } from '../../domain/join-code'
import { usernameMaxLength } from '../../domain/names'
import { pinLength } from '../../domain/pin'
import { useGoToList } from '../hooks/use-go-to-list'
import { useJoinCommunity } from '../hooks/use-join-community'

export function JoinCommunityScreen() {
  const { t } = useTranslation()
  const router = useRouter()
  const showError = useErrorSnackbar()
  const goToList = useGoToList()
  const { mutate, isPending } = useJoinCommunity()

  const [joinCode, setJoinCode] = useState('')
  const [username, setUsername] = useState('')
  const [pin, setPin] = useState('')
  const [joinCodeError, setJoinCodeError] = useState<string | null>(null)
  const [usernameError, setUsernameError] = useState<string | null>(null)
  const [pinError, setPinError] = useState<string | null>(null)

  const submit = () => {
    if (isPending) {
      return
    }
    setJoinCodeError(null)
    setUsernameError(null)
    setPinError(null)

    mutate(
      { joinCode, username, pin },
      {
        onSuccess: (result) => {
          switch (result.status) {
            case 'ok':
              goToList()
              return
            case 'invalid_username':
              setUsernameError(t('community.errors.invalidUsername'))
              return
            case 'invalid_pin':
              setPinError(t('community.errors.invalidPin'))
              return
            case 'wrong_pin':
              setPinError(t('community.errors.wrongPin'))
              return
            case 'username_taken':
              setUsernameError(t('community.errors.usernameTaken'))
              return
            case 'too_many_attempts':
              setPinError(t('community.errors.tooManyAttempts'))
              return
            case 'expired_join_code':
              setJoinCodeError(t('community.errors.expiredJoinCode'))
              return
            case 'invalid_join_code':
              setJoinCodeError(t('community.errors.invalidJoinCode'))
              return
            default: {
              const unhandled: never = result
              showError(
                new ServerError(
                  'join_community',
                  `estado sin pintar en la pantalla: ${JSON.stringify(unhandled)}`,
                ),
              )
            }
          }
        },
        onError: (cause) => showError(cause),
      },
    )
  }

  return (
    <SafeAreaView className="flex-1 bg-background dark:bg-background-dark">
      <ScrollView
        contentContainerStyle={{ flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        <View className="flex-1 justify-between gap-8 px-6 py-8">
          <View className="gap-6">
            <View className="gap-2">
              <Text
                accessibilityRole="header"
                className="text-3xl font-bold text-content dark:text-content-dark"
              >
                {t('community.join.title')}
              </Text>
              <Text className="text-base text-muted dark:text-muted-dark">
                {t('community.join.subtitle')}
              </Text>
            </View>

            <Input
              label={t('community.join.codeLabel')}
              placeholder={t('community.join.codePlaceholder')}
              value={joinCode}
              onChangeText={(value) => setJoinCode(normalizeJoinCode(value))}
              error={joinCodeError}
              autoCapitalize="characters"
              autoCorrect={false}
              autoFocus
              returnKeyType="next"
            />

            <Input
              testID="join-community-username"
              label={t('community.usernameLabel')}
              placeholder={t('community.usernamePlaceholder')}
              value={username}
              onChangeText={setUsername}
              error={usernameError}
              maxLength={usernameMaxLength}
              autoCapitalize="words"
              autoCorrect={false}
              returnKeyType="next"
            />

            <Input
              testID="join-community-pin"
              label={t('community.pinLabel')}
              placeholder={t('community.pinPlaceholder')}
              value={pin}
              onChangeText={setPin}
              error={pinError}
              maxLength={pinLength}
              keyboardType="numeric"
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              onSubmitEditing={submit}
            />
          </View>

          <View className="gap-3">
            <Button
              label={t('community.join.submit')}
              onPress={submit}
              loading={isPending}
              accessibilityHint={t('community.join.submitHint')}
            />
            <Button label={t('common.cancel')} onPress={router.back} variant="secondary" />
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}
