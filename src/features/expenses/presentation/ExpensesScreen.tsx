import { useRouter } from 'expo-router'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Pressable, ScrollView, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { useSnackbar } from '../../../shared/hooks/use-snackbar'
import { OfflineError } from '../../../shared/lib/network'
import { Button } from '../../../shared/ui/Button'
import { useActiveCommunityStore } from '../../community/presentation/active-community-store'
import { useCommunityMembers } from '../../community/presentation/use-community-members'
import type { DebtTransfer } from '../domain/expense'
import { AddExpenseModal } from './AddExpenseModal'
import { BalanceSummaryCard } from './BalanceSummaryCard'
import { DebtTransfersCard } from './DebtTransfersCard'
import { ExpenseListRow } from './ExpenseListRow'
import { SettleDebtModal } from './SettleDebtModal'
import { SettlementListRow } from './SettlementListRow'
import { useDeleteExpense, useDeleteSettlement } from './use-expense-mutations'
import { useExpenseSummary } from './use-expense-summary'
import { useExpenses } from './use-expenses'
import { useSettlements } from './use-settlements'

export function ExpensesScreen() {
  const { t } = useTranslation()
  const router = useRouter()
  const showSnackbar = useSnackbar()
  const membership = useActiveCommunityStore((state) => state.membership)
  const communityId = membership?.community.id

  const { data: members = [] } = useCommunityMembers(communityId)
  const { data: expenses = [] } = useExpenses(communityId)
  const { data: settlements = [] } = useSettlements(communityId)
  const { myBalance, totalSpentCents, transfers } = useExpenseSummary(communityId)

  const { mutate: deleteExpense } = useDeleteExpense(communityId)
  const { mutate: deleteSettlement } = useDeleteSettlement(communityId)

  const [addModalVisible, setAddModalVisible] = useState(false)
  const [selectedTransfer, setSelectedTransfer] = useState<DebtTransfer | null>(null)

  const handleDeleteExpense = (expenseId: string) => {
    deleteExpense(expenseId, {
      onError: (cause) => {
        showSnackbar(cause instanceof OfflineError ? t('errors.offline') : t('errors.network'))
      },
    })
  }

  const handleDeleteSettlement = (settlementId: string) => {
    deleteSettlement(settlementId, {
      onError: (cause) => {
        showSnackbar(cause instanceof OfflineError ? t('errors.offline') : t('errors.network'))
      },
    })
  }

  if (!communityId) {
    return null
  }

  return (
    <SafeAreaView className="flex-1 bg-background dark:bg-background-dark">
      {/* Header */}
      <View className="flex-row items-center justify-between border-b border-line px-4 py-3 dark:border-line-dark">
        <Pressable
          onPress={router.back}
          hitSlop={8}
          accessibilityLabel={t('common.cancel')}
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
      >
        {/* Balance Card */}
        <BalanceSummaryCard myBalance={myBalance} totalSpentCents={totalSpentCents} />

        {/* Deudas pendientes */}
        <DebtTransfersCard transfers={transfers} onSettle={(tr) => setSelectedTransfer(tr)} />

        {/* Historial de gastos */}
        <View className="gap-3">
          <Text className="text-base font-bold text-content dark:text-content-dark">
            {t('expenses.expenseHistoryTitle')} ({expenses.length})
          </Text>

          {expenses.length === 0 ? (
            <View className="rounded-lg border border-line bg-surface p-4 dark:border-line-dark dark:bg-surface-dark">
              <Text className="text-center text-sm text-muted dark:text-muted-dark">
                {t('expenses.noExpensesYet')}
              </Text>
            </View>
          ) : (
            <View className="gap-2">
              {expenses.map((expense) => (
                <ExpenseListRow
                  key={expense.id}
                  expense={expense}
                  members={members}
                  onDelete={handleDeleteExpense}
                />
              ))}
            </View>
          )}
        </View>

        {/* Historial de liquidaciones */}
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
                  onDelete={handleDeleteSettlement}
                />
              ))}
            </View>
          </View>
        ) : null}
      </ScrollView>

      {/* Modal para añadir gasto */}
      <AddExpenseModal
        visible={addModalVisible}
        onDismiss={() => setAddModalVisible(false)}
        communityId={communityId}
        members={members}
      />

      {/* Modal para saldar deuda */}
      <SettleDebtModal
        visible={Boolean(selectedTransfer)}
        onDismiss={() => setSelectedTransfer(null)}
        communityId={communityId}
        transfer={selectedTransfer}
      />
    </SafeAreaView>
  )
}
