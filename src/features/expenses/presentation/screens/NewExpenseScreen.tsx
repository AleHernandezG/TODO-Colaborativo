import { Redirect } from 'expo-router'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Pressable, ScrollView, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import type { CommunityMember } from '@/features/community'
import { useActiveCommunityStore, useCommunityMembers } from '@/features/community'
import { Button } from '@/shared/ui/Button'
import { Checkbox } from '@/shared/ui/Checkbox'
import { Input } from '@/shared/ui/Input'
import { minTouchTarget } from '@/theme'

import { formatCents, parseCurrencyToCents, splitEvenly } from '../../domain/money'
import { ExpensesHeader } from '../components/ExpensesHeader'
import { MemberAvatar } from '../components/MemberAvatar'
import { useCreateExpense } from '../hooks/use-create-expense'
import { useGoBack } from '../hooks/use-go-back'

export function NewExpenseScreen() {
  const membership = useActiveCommunityStore((state) => state.membership)

  if (!membership) {
    return <Redirect href="/" />
  }

  return <NewExpenseForm communityId={membership.community.id} />
}

function NewExpenseForm({ communityId }: { communityId: string }) {
  const { t } = useTranslation()
  const goBack = useGoBack('/expenses')

  const { data: members = [] } = useCommunityMembers(communityId)
  const { mutate: createExpense } = useCreateExpense(communityId)

  const [description, setDescription] = useState('')
  const [amountText, setAmountText] = useState('')
  const [paidByMemberId, setPaidByMemberId] = useState<string | null>(null)
  const [unselectedIds, setUnselectedIds] = useState<string[]>([])
  const [descriptionError, setDescriptionError] = useState<string | null>(null)
  const [amountError, setAmountError] = useState<string | null>(null)

  const payerId = paidByMemberId ?? members.find((m) => m.isSelf)?.id ?? members[0]?.id ?? ''
  const selectedIds = members.map((m) => m.id).filter((id) => !unselectedIds.includes(id))

  const parsedCents = parseCurrencyToCents(amountText)
  const shares = parsedCents ? splitEvenly(parsedCents, selectedIds) : {}
  const perPerson = selectedIds.length > 0 ? shares[selectedIds[0]] : undefined

  const toggleMember = (memberId: string) => {
    setUnselectedIds((current) =>
      current.includes(memberId) ? current.filter((id) => id !== memberId) : [...current, memberId],
    )
  }

  const save = () => {
    setDescriptionError(null)
    setAmountError(null)

    const trimmed = description.trim()
    if (!trimmed) {
      setDescriptionError(t('expenses.errors.descriptionRequired'))
      return
    }

    if (!parsedCents) {
      setAmountError(t('expenses.errors.invalidAmount'))
      return
    }

    if (selectedIds.length === 0) {
      setAmountError(t('expenses.errors.noParticipants'))
      return
    }

    createExpense({
      itemId: null,
      paidByMemberId: payerId,
      amountCents: parsedCents,
      description: trimmed,
      shares: Object.entries(shares).map(([memberId, shareCents]) => ({ memberId, shareCents })),
    })

    goBack()
  }

  return (
    <SafeAreaView className="flex-1 bg-background dark:bg-background-dark">
      <ExpensesHeader
        title={t('expenses.newExpenseTitle')}
        backLabel={t('expenses.back')}
        onBack={goBack}
      />

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 24, gap: 20 }}
        keyboardShouldPersistTaps="handled"
      >
        <Input
          label={t('expenses.descriptionLabel')}
          placeholder={t('expenses.descriptionPlaceholder')}
          value={description}
          onChangeText={setDescription}
          error={descriptionError}
          autoFocus
        />

        <Input
          label={t('expenses.amountLabel')}
          placeholder="0,00 €"
          value={amountText}
          onChangeText={setAmountText}
          error={amountError}
          keyboardType="numeric"
        />

        <View className="gap-3">
          <Text className="text-base font-medium text-content dark:text-content-dark">
            {t('expenses.whoPaidLabel')}
          </Text>
          <View className="flex-row flex-wrap gap-2">
            {members.map((member) => (
              <PayerChip
                key={member.id}
                member={member}
                selected={member.id === payerId}
                onPress={() => setPaidByMemberId(member.id)}
              />
            ))}
          </View>
        </View>

        <View className="gap-3">
          <Text className="text-base font-medium text-content dark:text-content-dark">
            {t('expenses.splitAmongLabel')}
          </Text>

          <View className="gap-1 rounded-lg border border-line bg-surface p-2 dark:border-line-dark dark:bg-surface-dark">
            {members.map((member) => {
              const checked = selectedIds.includes(member.id)
              const share = shares[member.id]
              return (
                <Pressable
                  key={member.id}
                  onPress={() => toggleMember(member.id)}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked }}
                  accessibilityLabel={member.isSelf ? t('expenses.you') : member.username}
                  style={{ minHeight: minTouchTarget }}
                  className="flex-row items-center gap-3 rounded-md px-1 active:opacity-70"
                >
                  <Checkbox
                    checked={checked}
                    onToggle={() => toggleMember(member.id)}
                    accessibilityLabel={member.username}
                  />
                  <MemberAvatar name={member.username} size="sm" highlighted={member.isSelf} />
                  <Text
                    numberOfLines={1}
                    className="flex-1 text-base text-content dark:text-content-dark"
                  >
                    {member.isSelf ? t('expenses.you') : member.username}
                  </Text>
                  {checked && share ? (
                    <Text className="text-base font-semibold text-content dark:text-content-dark">
                      {formatCents(share)}
                    </Text>
                  ) : null}
                </Pressable>
              )
            })}
          </View>

          {perPerson ? (
            <Text
              accessibilityLiveRegion="polite"
              className="text-sm text-muted dark:text-muted-dark"
            >
              {t('expenses.perPerson', { amount: formatCents(perPerson) })}
            </Text>
          ) : null}
        </View>
      </ScrollView>

      <View className="gap-2 border-t border-line px-4 py-3 dark:border-line-dark">
        <Button label={t('expenses.saveExpense')} onPress={save} />
        <Button label={t('common.cancel')} onPress={goBack} variant="secondary" size="sm" />
      </View>
    </SafeAreaView>
  )
}

function PayerChip({
  member,
  selected,
  onPress,
}: {
  member: CommunityMember
  selected: boolean
  onPress: () => void
}) {
  const { t } = useTranslation()

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={member.isSelf ? t('expenses.you') : member.username}
      style={{ minHeight: minTouchTarget }}
      className={`flex-row items-center justify-center rounded-full border px-4 active:opacity-70 ${
        selected
          ? 'border-primary bg-primary dark:border-primary-dark dark:bg-primary-dark'
          : 'border-line-strong bg-surface dark:border-line-strong-dark dark:bg-surface-dark'
      }`}
    >
      <Text
        className={`text-base font-semibold ${
          selected
            ? 'text-on-primary dark:text-on-primary-dark'
            : 'text-content dark:text-content-dark'
        }`}
      >
        {selected ? '✓ ' : ''}
        {member.isSelf ? t('expenses.you') : member.username}
      </Text>
    </Pressable>
  )
}
