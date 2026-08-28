import { Redirect, useRouter } from 'expo-router'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { useFailureMessage } from '../../../shared/hooks/use-failure-message'
import { useSyncStatus } from '../../../shared/hooks/use-sync-status'
import { Button } from '../../../shared/ui/Button'
import { RealtimeStatus } from '../../../shared/ui/RealtimeStatus'
import { useActiveCommunityStore } from '../../community/presentation/active-community-store'
import { useCommunityMembers } from '../../community/presentation/use-community-members'
import type { DebtTransfer } from '../domain/expense'
import { AddExpenseModal } from './AddExpenseModal'
import { BalanceSummaryCard } from './BalanceSummaryCard'
import { DebtTransfersCard } from './DebtTransfersCard'
import { ExpenseListRow } from './ExpenseListRow'
import { SettleDebtModal } from './SettleDebtModal'
import { SettlementListRow } from './SettlementListRow'
import { useDeleteExpense } from './use-delete-expense'
import { useDeleteSettlement } from './use-delete-settlement'
import { useExpenseSummary } from './use-expense-summary'
import { useExpenses } from './use-expenses'
import { useExpensesRealtime } from './use-expenses-realtime'
import { useSettlements } from './use-settlements'

export function ExpensesScreen() {
  const membership = useActiveCommunityStore((state) => state.membership)

  if (!membership) {
    return <Redirect href="/" />
  }

  return <ExpensesView communityId={membership.community.id} />
}

function ExpensesView({ communityId }: { communityId: string }) {
  const { t } = useTranslation()
  const router = useRouter()

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
  const { myBalance, totalSpentCents, transfers } = useExpenseSummary(communityId)

  const { online } = useSyncStatus()
  const realtimeStatus = useExpensesRealtime(communityId)
  const failureMessage = useFailureMessage()

  const removeExpense = useDeleteExpense(communityId)
  const removeSettlement = useDeleteSettlement(communityId)

  const [addModalVisible, setAddModalVisible] = useState(false)
  const [selectedTransfer, setSelectedTransfer] = useState<DebtTransfer | null>(null)

  const loadErrorMessage = useMemo(
    () => (isError ? failureMessage(error, t('expenses.loadError')) : ''),
    [isError, error, failureMessage, t],
  )

  return (
    <SafeAreaView className="flex-1 bg-background dark:bg-background-dark">
      <View className="flex-row items-center justify-between border-b border-line px-4 py-3 dark:border-line-dark">
        <Pressable
          onPress={router.back}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={t('expenses.backToList')}
          className="p-2 active:opacity-60"
        >
          <Text className="text-base font-semibold text-primary dark:text-primary-dark">
            ← {t('expenses.backToList')}
          </Text>
        </Pressable>

        <Text
          accessibilityRole="header"
          className="text-lg font-bold text-content dark:text-content-dark"
        >
          {t('expenses.screenTitle')}
        </Text>

        <Button
          label={t('expenses.addExpenseButton')}
          onPress={() => setAddModalVisible(true)}
          size="sm"
        />
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 16, gap: 20 }}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl refreshing={isFetching && !isLoading} onRefresh={() => void refetch()} />
        }
      >
        {online ? <RealtimeStatus status={realtimeStatus} /> : null}

        <BalanceSummaryCard myBalance={myBalance} totalSpentCents={totalSpentCents} />

        <DebtTransfersCard transfers={transfers} onSettle={(tr) => setSelectedTransfer(tr)} />

        <View className="gap-3">
          <Text className="text-base font-bold text-content dark:text-content-dark">
            {t('expenses.expenseHistoryTitle')} ({expenses.length})
          </Text>

          {isLoading ? (
            <View className="items-center gap-3 rounded-lg border border-line bg-surface p-6 dark:border-line-dark dark:bg-surface-dark">
              <ActivityIndicator accessibilityLabel={t('expenses.loading')} />
            </View>
          ) : isPaused && expenses.length === 0 ? (
            <Notice text={t('expenses.noCachedExpenses')} />
          ) : isError && expenses.length === 0 ? (
            <View className="gap-3 rounded-lg border border-line bg-surface p-4 dark:border-line-dark dark:bg-surface-dark">
              <Text className="text-center text-sm text-muted dark:text-muted-dark">
                {loadErrorMessage}
              </Text>
              <Button
                label={t('common.retry')}
                onPress={() => void refetch()}
                variant="secondary"
                size="sm"
              />
            </View>
          ) : expenses.length === 0 ? (
            <Notice text={t('expenses.noExpensesYet')} />
          ) : (
            <View className="gap-2">
              {expenses.map((expense) => (
                <ExpenseListRow
                  key={expense.id}
                  expense={expense}
                  members={members}
                  onDelete={removeExpense}
                />
              ))}
            </View>
          )}
        </View>

        {settlements.length > 0 ? (
          <View className="gap-3">
            <Text className="text-base font-bold text-content dark:text-content-dark">
              {t('expenses.settlementsHistoryTitle')} ({settlements.length})
            </Text>

            <View className="gap-2">
              {settlements.map((settlement) => (
                <SettlementListRow
                  key={settlement.id}
                  settlement={settlement}
                  members={members}
                  onDelete={removeSettlement}
                />
              ))}
            </View>
          </View>
        ) : null}
      </ScrollView>

      <AddExpenseModal
        visible={addModalVisible}
        onDismiss={() => setAddModalVisible(false)}
        communityId={communityId}
        members={members}
      />

      <SettleDebtModal
        visible={Boolean(selectedTransfer)}
        onDismiss={() => setSelectedTransfer(null)}
        communityId={communityId}
        transfer={selectedTransfer}
      />
    </SafeAreaView>
  )
}

function Notice({ text }: { text: string }) {
  return (
    <View className="rounded-lg border border-line bg-surface p-4 dark:border-line-dark dark:bg-surface-dark">
      <Text className="text-center text-sm text-muted dark:text-muted-dark">{text}</Text>
    </View>
  )
}
