import { Redirect, useLocalSearchParams } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { ActivityIndicator, ScrollView, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { useActiveCommunityStore, useCommunityMembers } from '@/features/community'
import { useSessionStore } from '@/features/session'
import { Button } from '@/shared/ui/Button'

import { formatCents } from '../../domain/money'
import { dayOf, timeOf } from '../../domain/movements'
import { isOwnExpense } from '../../domain/ownership'
import { ExpensesHeader } from '../components/ExpensesHeader'
import { MemberAvatar } from '../components/MemberAvatar'
import { useDayLabel } from '../hooks/use-day-label'
import { useDeleteExpense } from '../hooks/use-delete-expense'
import { useExpenses } from '../hooks/use-expenses'
import { useGoBack } from '../hooks/use-go-back'
import { useMemberName, useMemberUsername } from '../hooks/use-member-name'

export function ExpenseDetailScreen() {
  const membership = useActiveCommunityStore((state) => state.membership)
  const { id } = useLocalSearchParams<{ id: string }>()

  if (!membership) {
    return <Redirect href="/" />
  }

  return <ExpenseDetail communityId={membership.community.id} expenseId={id} />
}

function ExpenseDetail({ communityId, expenseId }: { communityId: string; expenseId: string }) {
  const { t } = useTranslation()
  const goBack = useGoBack('/expenses')

  const { data: members = [] } = useCommunityMembers(communityId)
  const { data: expenses = [], isLoading } = useExpenses(communityId)
  const authUserId = useSessionStore((state) => state.session?.userId ?? null)
  const removeExpense = useDeleteExpense(communityId)

  const nameOf = useMemberName(members)
  const usernameOf = useMemberUsername(members)
  const dayLabel = useDayLabel()

  const expense = expenses.find((candidate) => candidate.id === expenseId)

  const header = (
    <ExpensesHeader
      title={t('expenses.detailTitle')}
      backLabel={t('expenses.back')}
      onBack={goBack}
    />
  )

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-background dark:bg-background-dark">
        {header}
        <View
          accessible
          accessibilityLabel={t('expenses.loading')}
          className="flex-1 items-center justify-center"
        >
          <ActivityIndicator size="large" />
        </View>
      </SafeAreaView>
    )
  }

  if (!expense) {
    return (
      <SafeAreaView className="flex-1 bg-background dark:bg-background-dark">
        {header}
        <View className="flex-1 items-center justify-center gap-4 p-6">
          <Text className="text-5xl">🧾</Text>
          <Text className="text-center text-base text-muted dark:text-muted-dark">
            {t('expenses.expenseNotFound')}
          </Text>
          <Button
            label={t('expenses.back')}
            onPress={goBack}
            variant="secondary"
            fullWidth={false}
          />
        </View>
      </SafeAreaView>
    )
  }

  const mine = isOwnExpense(expense, authUserId)
  const time = timeOf(expense.createdAt)
  const date = `${dayLabel(dayOf(expense.createdAt))}${time ? ` · ${time}` : ''}`

  return (
    <SafeAreaView className="flex-1 bg-background dark:bg-background-dark">
      {header}

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 24, gap: 16 }}>
        <View className="gap-2 rounded-lg border border-line bg-surface p-5 dark:border-line-dark dark:bg-surface-dark">
          <Text
            accessibilityRole="header"
            className="text-xl font-semibold text-content dark:text-content-dark"
          >
            {expense.description}
          </Text>
          <Text className="text-4xl font-bold text-content dark:text-content-dark">
            {formatCents(expense.amountCents, expense.currency)}
          </Text>
        </View>

        <View className="gap-3 rounded-lg border border-line bg-surface p-4 dark:border-line-dark dark:bg-surface-dark">
          <View className="flex-row items-center justify-between gap-3">
            <Text className="text-sm text-muted dark:text-muted-dark">
              {t('expenses.paidByLabel')}
            </Text>
            <View className="flex-row items-center gap-2">
              <MemberAvatar name={usernameOf(expense.paidByMemberId)} size="sm" />
              <Text className="text-base font-semibold text-content dark:text-content-dark">
                {nameOf(expense.paidByMemberId)}
              </Text>
            </View>
          </View>

          <View className="h-px bg-line dark:bg-line-dark" />

          <View className="flex-row items-center justify-between gap-3">
            <Text className="text-sm text-muted dark:text-muted-dark">
              {t('expenses.dateLabel')}
            </Text>
            <Text className="text-base text-content dark:text-content-dark">{date}</Text>
          </View>
        </View>

        <View className="gap-3 rounded-lg border border-line bg-surface p-4 dark:border-line-dark dark:bg-surface-dark">
          <Text
            accessibilityRole="header"
            className="text-sm font-semibold uppercase text-muted dark:text-muted-dark"
          >
            {t('expenses.sharesTitle')}
          </Text>

          {expense.shares.map((share) => (
            <View
              key={share.id}
              accessible
              accessibilityLabel={`${nameOf(share.memberId)}: ${formatCents(share.shareCents, expense.currency)}`}
              className="flex-row items-center gap-3"
            >
              <MemberAvatar name={usernameOf(share.memberId)} size="sm" />
              <Text
                numberOfLines={1}
                className="flex-1 text-base text-content dark:text-content-dark"
              >
                {nameOf(share.memberId)}
              </Text>
              <Text className="text-base font-semibold text-content dark:text-content-dark">
                {formatCents(share.shareCents, expense.currency)}
              </Text>
            </View>
          ))}
        </View>

        {mine ? (
          <Button
            label={t('expenses.deleteExpense')}
            onPress={() => {
              removeExpense(expense)
              goBack()
            }}
            variant="danger"
            accessibilityHint={t('expenses.deleteExpenseHint')}
          />
        ) : (
          <Text className="px-2 text-center text-sm text-muted dark:text-muted-dark">
            {t('expenses.onlyOwnerDeletes')}
          </Text>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}
