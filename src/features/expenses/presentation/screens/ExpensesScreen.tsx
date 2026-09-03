import { Redirect, useRouter } from 'expo-router'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ActivityIndicator, RefreshControl, ScrollView, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { useActiveCommunityStore, useCommunityMembers } from '@/features/community'
import { useFailureMessage } from '@/shared/hooks/use-failure-message'
import { useSyncStatus } from '@/shared/hooks/use-sync-status'
import { Button } from '@/shared/ui/Button'
import { OfflineBanner } from '@/shared/ui/OfflineBanner'
import { RealtimeStatus } from '@/shared/ui/RealtimeStatus'

import type { DebtTransfer } from '../../domain/expense'
import { toMovements } from '../../domain/movements'
import { BalanceSummaryCard } from '../components/BalanceSummaryCard'
import { DebtTransfersCard } from '../components/DebtTransfersCard'
import { ExpensesHeader } from '../components/ExpensesHeader'
import { MemberBalanceList } from '../components/MemberBalanceList'
import { MovementRow } from '../components/MovementRow'
import { SettleDebtModal } from '../components/SettleDebtModal'
import { useExpenseSummary } from '../hooks/use-expense-summary'
import { useExpenses } from '../hooks/use-expenses'
import { useExpensesRealtime } from '../hooks/use-expenses-realtime'
import { useGoBack } from '../hooks/use-go-back'
import { useSettlements } from '../hooks/use-settlements'

const recentCount = 3

export function ExpensesScreen() {
  const membership = useActiveCommunityStore((state) => state.membership)

  if (!membership) {
    return <Redirect href="/" />
  }

  return <ExpensesSummary communityId={membership.community.id} />
}

function ExpensesSummary({ communityId }: { communityId: string }) {
  const { t } = useTranslation()
  const router = useRouter()
  const goBack = useGoBack('/list')

  const { data: members = [] } = useCommunityMembers(communityId)
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
  const { balances, myBalance, totalSpentCents, transfers } = useExpenseSummary(communityId)

  const { online, pendingChanges } = useSyncStatus()
  const realtimeStatus = useExpensesRealtime(communityId)
  const failureMessage = useFailureMessage()

  const [selectedTransfer, setSelectedTransfer] = useState<DebtTransfer | null>(null)

  const movements = useMemo(() => toMovements(expenses, settlements), [expenses, settlements])

  const loadErrorMessage = useMemo(
    () => (isError ? failureMessage(error, t('expenses.loadError')) : ''),
    [isError, error, failureMessage, t],
  )

  const nothingYet = movements.length === 0 && !isLoading && !isError && !isPaused

  return (
    <SafeAreaView className="flex-1 bg-background dark:bg-background-dark">
      <ExpensesHeader
        title={t('expenses.screenTitle')}
        backLabel={t('expenses.backToList')}
        onBack={goBack}
      />

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 24, gap: 16, flexGrow: 1 }}
        refreshControl={
          <RefreshControl refreshing={isFetching && !isLoading} onRefresh={() => void refetch()} />
        }
      >
        {online ? (
          <RealtimeStatus status={realtimeStatus} />
        ) : (
          <OfflineBanner pendingChanges={pendingChanges} />
        )}

        {isLoading ? (
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
        ) : isError && movements.length === 0 ? (
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
        ) : isPaused && movements.length === 0 ? (
          <View accessible className="flex-1 items-center justify-center gap-2 py-10">
            <Text className="text-5xl">☁</Text>
            <Text className="text-center text-base text-muted dark:text-muted-dark">
              {t('expenses.noCachedExpenses')}
            </Text>
          </View>
        ) : nothingYet ? (
          <View accessible className="flex-1 items-center justify-center gap-2 py-10">
            <Text className="text-5xl">🧾</Text>
            <Text
              accessibilityRole="header"
              className="text-center text-lg font-semibold text-content dark:text-content-dark"
            >
              {t('expenses.emptyTitle')}
            </Text>
            <Text className="text-center text-base text-muted dark:text-muted-dark">
              {t('expenses.emptyHint')}
            </Text>
          </View>
        ) : (
          <>
            <BalanceSummaryCard myBalance={myBalance} totalSpentCents={totalSpentCents} />

            <DebtTransfersCard transfers={transfers} onSettle={setSelectedTransfer} />

            <MemberBalanceList balances={balances} members={members} />

            <View className="gap-2">
              <Text
                accessibilityRole="header"
                className="text-sm font-semibold uppercase text-muted dark:text-muted-dark"
              >
                {t('expenses.recentMovementsTitle')}
              </Text>

              {movements.slice(0, recentCount).map((movement) => (
                <MovementRow
                  key={movement.id}
                  movement={movement}
                  members={members}
                  onOpen={
                    movement.kind === 'expense'
                      ? () =>
                          router.push({
                            pathname: '/expenses/[id]',
                            params: { id: movement.id },
                          })
                      : undefined
                  }
                />
              ))}

              <Button
                label={t('expenses.seeAllMovements', { count: movements.length })}
                onPress={() => router.push('/expenses/history')}
                variant="secondary"
                size="sm"
              />
            </View>
          </>
        )}
      </ScrollView>

      <View className="border-t border-line px-4 py-3 dark:border-line-dark">
        <Button
          label={t('expenses.addExpenseButton')}
          onPress={() => router.push('/expenses/new')}
        />
      </View>

      <SettleDebtModal
        visible={Boolean(selectedTransfer)}
        onDismiss={() => setSelectedTransfer(null)}
        communityId={communityId}
        transfer={selectedTransfer}
      />
    </SafeAreaView>
  )
}
