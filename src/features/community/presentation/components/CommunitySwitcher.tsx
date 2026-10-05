import { useRouter } from 'expo-router'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AccessibilityInfo, ActivityIndicator, Pressable, Text, View } from 'react-native'

import { useFailureMessage } from '@/shared/hooks/use-failure-message'
import { Button } from '@/shared/ui/Button'
import { PickerDialog } from '@/shared/ui/PickerDialog'
import { minTouchTarget, usePalette } from '@/theme'

import type { Membership } from '../../domain/community'
import { useMyCommunities } from '../hooks/use-my-communities'
import { useActiveCommunityStore } from '../stores/active-community-store'
import { MembershipList } from './MembershipList'

export function CommunitySwitcher({ active }: { active: Membership }) {
  const { t } = useTranslation()
  const router = useRouter()
  const palette = usePalette()
  const failureMessage = useFailureMessage()
  const setMembership = useActiveCommunityStore((state) => state.setMembership)
  const { data, isError, error, isFetching, refetch } = useMyCommunities()
  const [open, setOpen] = useState(false)

  const memberships = data ?? [active]
  const loadErrorMessage = useMemo(
    () => (open && isError ? failureMessage(error, t('lists.loadError')) : ''),
    [open, isError, error, failureMessage, t],
  )

  const show = () => {
    setOpen(true)
    void refetch()
  }

  const select = (membership: Membership) => {
    setOpen(false)
    if (membership.community.id === active.community.id) {
      return
    }
    setMembership(membership)
    AccessibilityInfo.announceForAccessibility(
      t('lists.switched', { name: membership.community.name }),
    )
  }

  const leaveTo = (route: '/create' | '/join') => {
    setOpen(false)
    router.push(route)
  }

  return (
    <>
      <Pressable
        onPress={show}
        accessibilityRole="button"
        accessibilityLabel={t('lists.switcher', { name: active.community.name })}
        accessibilityHint={t('lists.switcherHint')}
        style={{ minHeight: minTouchTarget }}
        className="flex-row items-center gap-2 self-start active:opacity-70"
      >
        <Text className="flex-shrink text-3xl font-bold text-content dark:text-content-dark">
          {active.community.name}
        </Text>
        <Text className="text-2xl font-bold text-muted dark:text-muted-dark">▾</Text>
      </Pressable>

      <PickerDialog
        visible={open}
        title={t('lists.title')}
        onDismiss={() => setOpen(false)}
        closeLabel={t('lists.close')}
      >
        <View className="gap-4">
          <MembershipList
            memberships={memberships}
            activeCommunityId={active.community.id}
            onSelect={select}
          />

          {data === undefined && isFetching ? (
            <ActivityIndicator accessibilityLabel={t('lists.loading')} color={palette.primary} />
          ) : null}

          {loadErrorMessage ? (
            <Text
              accessibilityLiveRegion="polite"
              className="text-sm text-danger dark:text-danger-dark"
            >
              {loadErrorMessage}
            </Text>
          ) : null}

          {memberships.length === 1 && !loadErrorMessage ? (
            <Text className="text-sm text-muted dark:text-muted-dark">{t('lists.onlyOne')}</Text>
          ) : null}

          <View className="gap-2 border-t border-line pt-4 dark:border-line-dark">
            <Button
              label={t('lists.create')}
              onPress={() => leaveTo('/create')}
              variant="secondary"
              size="sm"
              accessibilityHint={t('lists.createHint')}
            />
            <Button
              label={t('lists.join')}
              onPress={() => leaveTo('/join')}
              variant="secondary"
              size="sm"
              accessibilityHint={t('lists.joinHint')}
            />
          </View>
        </View>
      </PickerDialog>
    </>
  )
}
