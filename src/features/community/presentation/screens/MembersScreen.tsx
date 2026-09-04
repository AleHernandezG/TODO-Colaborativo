import { Redirect, useRouter } from 'expo-router'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  FlatList,
  Pressable,
  RefreshControl,
  Text,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { useErrorSnackbar } from '@/shared/hooks/use-error-snackbar'
import { useSnackbar } from '@/shared/hooks/use-snackbar'
import { Button } from '@/shared/ui/Button'
import { minTouchTarget } from '@/theme'

import type { CommunityMember } from '../../domain/community-repository'
import { AddGuestDialog } from '../components/AddGuestDialog'
import { ConfirmRemoveMemberDialog } from '../components/ConfirmRemoveMemberDialog'
import { useCommunityMembers } from '../hooks/use-community-members'
import { useSetMemberAdmin } from '../hooks/use-set-member-admin'
import { useActiveCommunityStore } from '../stores/active-community-store'

export function MembersScreen() {
  const membership = useActiveCommunityStore((state) => state.membership)

  if (!membership) {
    return <Redirect href="/" />
  }

  return (
    <MembersContent
      communityId={membership.community.id}
      communityName={membership.community.name}
    />
  )
}

function MembersContent({
  communityId,
  communityName,
}: {
  communityId: string
  communityName: string
}) {
  const { t } = useTranslation()
  const router = useRouter()
  const showSnackbar = useSnackbar()
  const showError = useErrorSnackbar()

  const { data: members = [], isLoading, isFetching, refetch } = useCommunityMembers(communityId)
  const setMemberAdmin = useSetMemberAdmin(communityId)

  const [addGuestVisible, setAddGuestVisible] = useState(false)
  const [memberToRemove, setMemberToRemove] = useState<CommunityMember | null>(null)

  const currentMember = members.find((m) => m.isSelf)
  const currentUserIsAdmin = Boolean(currentMember?.isAdmin)

  const handleToggleAdmin = (target: CommunityMember) => {
    const nextAdmin = !target.isAdmin
    setMemberAdmin.mutate(
      { memberId: target.id, isAdmin: nextAdmin },
      {
        onSuccess: () => {
          showSnackbar(
            nextAdmin
              ? t('members.makeAdmin') + ': ' + target.username
              : t('members.removeAdmin') + ': ' + target.username,
          )
        },
        onError: (cause) => {
          showError(cause, t('members.errors.roleFailed'))
        },
      },
    )
  }

  return (
    <SafeAreaView className="flex-1 bg-background dark:bg-background-dark">
      {/* Header */}
      <View className="flex-row items-center justify-between border-b border-line px-2 py-2 dark:border-line-dark">
        <View className="flex-row items-center gap-1 flex-1">
          <Pressable
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel={t('members.back')}
            style={{ minWidth: minTouchTarget, minHeight: minTouchTarget }}
            className="items-center justify-center rounded-md active:opacity-60"
          >
            <Text className="text-2xl text-primary dark:text-primary-dark">←</Text>
          </Pressable>

          <View className="flex-1">
            <Text
              accessibilityRole="header"
              numberOfLines={1}
              className="text-xl font-bold text-content dark:text-content-dark"
            >
              {t('members.title')}
            </Text>
            <Text
              numberOfLines={1}
              className="text-xs text-muted dark:text-muted-dark"
            >
              {communityName}
            </Text>
          </View>
        </View>

        {currentUserIsAdmin ? (
          <Button
            label={t('members.addGuest')}
            onPress={() => setAddGuestVisible(true)}
            size="sm"
            fullWidth={false}
            accessibilityHint={t('members.addGuestHint')}
          />
        ) : null}
      </View>

      {/* Lista de miembros */}
      <FlatList
        data={members}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 16, gap: 12 }}
        refreshControl={
          <RefreshControl refreshing={isFetching && !isLoading} onRefresh={() => void refetch()} />
        }
        ListEmptyComponent={
          <View className="py-12 items-center">
            <Text className="text-base text-muted dark:text-muted-dark">
              {isLoading ? t('list.joinCodeLoading') : t('members.empty')}
            </Text>
          </View>
        }
        renderItem={({ item }) => {
          const initial = item.username.charAt(0).toUpperCase()

          return (
            <View
              className="flex-row items-center justify-between rounded-lg border border-line bg-surface p-3 dark:border-line-dark dark:bg-surface-dark"
            >
              {/* Info del miembro */}
              <View className="flex-row items-center gap-3 flex-1 mr-2">
                <View className="h-10 w-10 items-center justify-center rounded-full bg-primary/10 dark:bg-primary-dark/20">
                  <Text className="text-base font-bold text-primary dark:text-primary-dark">
                    {initial}
                  </Text>
                </View>

                <View className="flex-1 gap-1">
                  <Text
                    numberOfLines={1}
                    className="text-base font-semibold text-content dark:text-content-dark"
                  >
                    {item.username}
                  </Text>

                  {/* Badges / Chips */}
                  <View className="flex-row flex-wrap gap-1">
                    {item.isSelf ? (
                      <View className="rounded-full bg-primary/15 px-2 py-0.5 dark:bg-primary-dark/25">
                        <Text className="text-xs font-semibold text-primary dark:text-primary-dark">
                          {t('members.badgeYou')}
                        </Text>
                      </View>
                    ) : null}

                    {item.isAdmin ? (
                      <View className="rounded-full bg-accent/15 px-2 py-0.5 dark:bg-accent-dark/25">
                        <Text className="text-xs font-semibold text-accent dark:text-accent-dark">
                          {t('members.badgeAdmin')}
                        </Text>
                      </View>
                    ) : null}

                    {item.isGuest ? (
                      <View className="rounded-full bg-amber-500/15 px-2 py-0.5 dark:bg-amber-400/25">
                        <Text className="text-xs font-semibold text-amber-700 dark:text-amber-300">
                          {t('members.badgeGuest')}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                </View>
              </View>

              {/* Acciones de administración */}
              {currentUserIsAdmin && !item.isSelf ? (
                <View className="flex-row items-center gap-1">
                  <Button
                    label={item.isAdmin ? t('members.removeAdmin') : t('members.makeAdmin')}
                    onPress={() => handleToggleAdmin(item)}
                    variant="secondary"
                    size="sm"
                    fullWidth={false}
                    disabled={setMemberAdmin.isPending}
                  />

                  <Pressable
                    onPress={() => setMemberToRemove(item)}
                    accessibilityRole="button"
                    accessibilityLabel={`${t('members.removeMember')} ${item.username}`}
                    style={{ minWidth: minTouchTarget, minHeight: minTouchTarget }}
                    className="items-center justify-center rounded-md px-2 active:opacity-60"
                  >
                    <Text className="text-base font-semibold text-danger dark:text-danger-dark">
                      ✕
                    </Text>
                  </Pressable>
                </View>
              ) : null}
            </View>
          )
        }}
      />

      {/* Diálogos */}
      <AddGuestDialog
        communityId={communityId}
        visible={addGuestVisible}
        onDismiss={() => setAddGuestVisible(false)}
      />

      <ConfirmRemoveMemberDialog
        communityId={communityId}
        member={memberToRemove}
        onDismiss={() => setMemberToRemove(null)}
      />
    </SafeAreaView>
  )
}
