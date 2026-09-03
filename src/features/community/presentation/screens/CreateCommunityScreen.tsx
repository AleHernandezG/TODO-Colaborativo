import { useRouter } from 'expo-router'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ScrollView, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { useErrorSnackbar } from '@/shared/hooks/use-error-snackbar'
import { Button } from '@/shared/ui/Button'
import { Input } from '@/shared/ui/Input'

import { communityNameMaxLength, usernameMaxLength } from '../../domain/names'
import { pinLength } from '../../domain/pin'
import { useCreateCommunity } from '../hooks/use-create-community'
import { useGoToList } from '../hooks/use-go-to-list'

export function CreateCommunityScreen() {
  const { t } = useTranslation()
  const router = useRouter()
  const showError = useErrorSnackbar()
  const goToList = useGoToList()
  const { mutate, isPending } = useCreateCommunity()

  const [name, setName] = useState('')
  const [username, setUsername] = useState('')
  const [pin, setPin] = useState('')
  const [nameError, setNameError] = useState<string | null>(null)
  const [usernameError, setUsernameError] = useState<string | null>(null)
  const [pinError, setPinError] = useState<string | null>(null)

  const submit = () => {
    setNameError(null)
    setUsernameError(null)
    setPinError(null)

    mutate(
      { name, username, pin },
      {
        onSuccess: (result) => {
          if (result.status === 'invalid_name') {
            setNameError(t('community.errors.invalidName'))
            return
          }
          if (result.status === 'invalid_username') {
            setUsernameError(t('community.errors.invalidUsername'))
            return
          }
          if (result.status === 'invalid_pin') {
            setPinError(t('community.errors.invalidPin'))
            return
          }
          goToList()
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
                {t('community.create.title')}
              </Text>
              <Text className="text-base text-muted dark:text-muted-dark">
                {t('community.create.subtitle')}
              </Text>
            </View>

            <Input
              testID="create-community-name"
              label={t('community.create.nameLabel')}
              placeholder={t('community.create.namePlaceholder')}
              value={name}
              onChangeText={setName}
              error={nameError}
              maxLength={communityNameMaxLength}
              autoCapitalize="sentences"
              autoFocus
              returnKeyType="next"
            />

            <Input
              testID="create-community-username"
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
              testID="create-community-pin"
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
              label={t('community.create.submit')}
              onPress={submit}
              loading={isPending}
              accessibilityHint={t('community.create.submitHint')}
            />
            <Button label={t('common.cancel')} onPress={router.back} variant="secondary" />
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}
