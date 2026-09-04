import { Redirect, useRouter } from 'expo-router'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { ActivityIndicator, RefreshControl, SectionList, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { useActiveCommunityStore, useCommunityMembers } from '@/features/community'
import { useSessionStore } from '@/features/session'
import { useFailureMessage } from '@/shared/hooks/use-failure-message'
import { Button } from '@/shared/ui/Button'

import type { Movement } from '../../domain/movements'
import { groupMovementsByDay } from '../../domain/movements'
import { isOwnSettlement } from '../../domain/ownership'
import { ExpensesHeader } from '../components/ExpensesHeader'
import { MovementRow } from '../components/MovementRow'
import { useDayLabel } from '../hooks/use-day-label'
import { useDeleteSettlement } from '../hooks/use-delete-settlement'
import { useExpenses } from '../hooks/use-expenses'
import { useGoBack } from '../hooks/use-go-back'
import { useSettlements } from '../hooks/use-settlements'

export function MovementsScreen() {
  const membership = useActiveCommunityStore((state) => state.membership)

  if (!membership) {
    return <Redirect href="/" />
  }

  return <MovementsList communityId={membership.community.id} />
}

function MovementsList({ communityId }: { communityId: string }) {
  const { t } = useTranslation()
  const router = useRouter()
  const goBack = useGoBack('/expenses')
  const dayLabel = useDayLabel()

  const { data: members = [] } = useCommunityMembers(communityId, { includeArchived: true })
  const {
    data: expenses = [],
    isLoading,
    isError,
    isPaused,
    error,
    isFetching,
    refetch,
  } = useExpenses(communityId)
  const { data: settlements = [] } = useSettlements(communityId)
  const authUserId = useSessionStore((state) => state.session?.userId ?? null)
  const removeSettlement = useDeleteSettlement(communityId)
  const failureMessage = useFailureMessage()

  const sections = useMemo(
    () =>
      groupMovementsByDay(expenses, settlements).map((day) => ({
        title: dayLabel(day.day),
        data: day.movements,
      })),
    [expenses, settlements, dayLabel],
  )

  const loadErrorMessage = isError ? failureMessage(error, t('expenses.loadError')) : ''

  return (
    <SafeAreaView className="flex-1 bg-background dark:bg-background-dark">
      <ExpensesHeader
        title={t('expenses.movementsTitle')}
        backLabel={t('expenses.back')}
        onBack={goBack}
      />

      <SectionList<Movement, { title: string; data: Movement[] }>
        sections={sections}
        keyExtractor={(movement) => movement.id}
        contentContainerStyle={{ padding: 16, paddingBottom: 24, gap: 8, flexGrow: 1 }}
        refreshControl={
          <RefreshControl refreshing={isFetching && !isLoading} onRefresh={() => void refetch()} />
        }
        renderSectionHeader={({ section }) => (
          <Text
            accessibilityRole="header"
            className="pt-2 text-sm font-semibold uppercase text-muted dark:text-muted-dark"
          >
            {section.title}
          </Text>
        )}
        renderItem={({ item }) => (
          <MovementRow
            movement={item}
            members={members}
            onOpen={
              item.kind === 'expense'
                ? () => router.push({ pathname: '/expenses/[id]', params: { id: item.id } })
                : undefined
            }
            onDelete={
              item.kind === 'settlement' && isOwnSettlement(item.settlement, authUserId)
                ? () => removeSettlement(item.settlement)
                : undefined
            }
          />
        )}
        ListEmptyComponent={
          isLoading ? (
            <View
              accessible
              accessibilityLabel={t('expenses.loading')}
              className="flex-1 items-center justify-center gap-3 py-10"
            >
              <ActivityIndicator size="large" />
              <Text className="text-base text-muted dark:text-muted-dark">
                {t('expenses.loading')}
              </Text>
            </View>
          ) : isPaused ? (
            <View accessible className="flex-1 items-center justify-center gap-2 py-10">
              <Text className="text-5xl">☁</Text>
              <Text className="text-center text-base text-muted dark:text-muted-dark">
                {t('expenses.noCachedExpenses')}
              </Text>
            </View>
          ) : isError ? (
            <View className="flex-1 items-center justify-center gap-4 py-10">
              <Text
                accessibilityLiveRegion="polite"
                className="text-center text-base text-muted dark:text-muted-dark"
              >
                {loadErrorMessage}
              </Text>
              <Button
                label={t('common.retry')}
                onPress={() => void refetch()}
                variant="secondary"
                fullWidth={false}
              />
            </View>
          ) : (
            <View accessible className="flex-1 items-center justify-center gap-2 py-10">
              <Text className="text-5xl">🧾</Text>
              <Text className="text-center text-base text-muted dark:text-muted-dark">
                {t('expenses.noMovementsYet')}
              </Text>
            </View>
          )
        }
      />

      <View className="border-t border-line px-4 py-3 dark:border-line-dark">
        <Button
          label={t('expenses.addExpenseButton')}
          onPress={() => router.push('/expenses/new')}
        />
      </View>
    </SafeAreaView>
  )
}
