import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Pressable, Text, View } from 'react-native'

import { useErrorSnackbar } from '../../../shared/hooks/use-error-snackbar'
import { Checkbox } from '../../../shared/ui/Checkbox'
import { Dialog } from '../../../shared/ui/Dialog'
import { Input } from '../../../shared/ui/Input'
import type { CommunityMember } from '../../community/domain/community-repository'
import { formatCents, parseCurrencyToCents, splitEvenly } from '../domain/money'
import { useCreateExpense } from './use-expense-mutations'

type Props = {
  visible: boolean
  onDismiss: () => void
  communityId: string
  members: CommunityMember[]
  initialDescription?: string
  initialAmountCents?: number | null
  itemId?: string | null
  onSuccess?: () => void
}

export function AddExpenseModal({
  visible,
  onDismiss,
  communityId,
  members,
  initialDescription = '',
  initialAmountCents = null,
  itemId = null,
  onSuccess,
}: Props) {
  const { t } = useTranslation()
  const showError = useErrorSnackbar()
  const { mutate: createExpense, isPending } = useCreateExpense(communityId)

  const [description, setDescription] = useState(initialDescription)
  const [amountText, setAmountText] = useState(
    initialAmountCents ? (initialAmountCents / 100).toFixed(2).replace('.', ',') : '',
  )
  const selfMember = members.find((m) => m.isSelf)
  const [paidByMemberId, setPaidByMemberId] = useState<string>(
    selfMember?.id ?? members[0]?.id ?? '',
  )
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>(members.map((m) => m.id))

  const [descriptionError, setDescriptionError] = useState<string | null>(null)
  const [amountError, setAmountError] = useState<string | null>(null)

  useEffect(() => {
    if (visible) {
      setDescription(initialDescription)
      setAmountText(
        initialAmountCents ? (initialAmountCents / 100).toFixed(2).replace('.', ',') : '',
      )
      setPaidByMemberId(selfMember?.id ?? members[0]?.id ?? '')
      setSelectedMemberIds(members.map((m) => m.id))
      setDescriptionError(null)
      setAmountError(null)
    }
  }, [visible, initialDescription, initialAmountCents, selfMember, members])

  const parsedCents = parseCurrencyToCents(amountText)
  const calculatedShares = parsedCents ? splitEvenly(parsedCents, selectedMemberIds) : {}

  const toggleMember = (memberId: string) => {
    setSelectedMemberIds((prev) =>
      prev.includes(memberId) ? prev.filter((id) => id !== memberId) : [...prev, memberId],
    )
  }

  const handleConfirm = () => {
    setDescriptionError(null)
    setAmountError(null)

    const trimmedDesc = description.trim()
    if (!trimmedDesc) {
      setDescriptionError(t('expenses.errors.descriptionRequired'))
      return
    }

    if (!parsedCents) {
      setAmountError(t('expenses.errors.invalidAmount'))
      return
    }

    if (selectedMemberIds.length === 0) {
      setAmountError(t('expenses.errors.noParticipants'))
      return
    }

    const shares = Object.entries(calculatedShares).map(([memberId, shareCents]) => ({
      memberId,
      shareCents,
    }))

    createExpense(
      {
        communityId,
        itemId,
        paidByMemberId,
        amountCents: parsedCents,
        description: trimmedDesc,
        shares,
      },
      {
        onSuccess: () => {
          onDismiss()
          onSuccess?.()
        },
        onError: (cause) => {
          showError(cause)
        },
      },
    )
  }

  return (
    <Dialog
      visible={visible}
      title={t('expenses.addExpenseModalTitle')}
      onDismiss={onDismiss}
      confirmLabel={t('expenses.saveExpense')}
      onConfirm={handleConfirm}
      confirmDisabled={isPending}
      cancelLabel={t('common.cancel')}
    >
      <View className="gap-4">
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

        {/* Quién pagó */}
        <View className="gap-2">
          <Text className="text-sm font-medium text-content dark:text-content-dark">
            {t('expenses.whoPaidLabel')}
          </Text>
          <View className="flex-row flex-wrap gap-2">
            {members.map((member) => {
              const isSelected = member.id === paidByMemberId
              return (
                <Pressable
                  key={member.id}
                  onPress={() => setPaidByMemberId(member.id)}
                  className={`rounded-full px-3 py-1.5 border ${
                    isSelected
                      ? 'border-primary bg-primary/10 dark:border-primary-dark dark:bg-primary-dark/20'
                      : 'border-line bg-surface dark:border-line-dark dark:bg-surface-dark'
                  }`}
                >
                  <Text
                    className={`text-sm ${
                      isSelected
                        ? 'font-bold text-primary dark:text-primary-dark'
                        : 'text-content dark:text-content-dark'
                    }`}
                  >
                    {member.isSelf ? t('expenses.you') : member.username}
                  </Text>
                </Pressable>
              )
            })}
          </View>
        </View>

        {/* Entre quiénes se reparte */}
        <View className="gap-2">
          <Text className="text-sm font-medium text-content dark:text-content-dark">
            {t('expenses.splitAmongLabel')}
          </Text>
          <View className="gap-2">
            {members.map((member) => {
              const isChecked = selectedMemberIds.includes(member.id)
              const memberShare = calculatedShares[member.id]
              return (
                <Pressable
                  key={member.id}
                  onPress={() => toggleMember(member.id)}
                  className="flex-row items-center justify-between py-1 active:opacity-70"
                >
                  <View className="flex-row items-center gap-3">
                    <Checkbox
                      checked={isChecked}
                      onToggle={() => toggleMember(member.id)}
                      accessibilityLabel={member.username}
                    />
                    <Text className="text-sm text-content dark:text-content-dark">
                      {member.isSelf ? t('expenses.you') : member.username}
                    </Text>
                  </View>

                  {isChecked && memberShare ? (
                    <Text className="text-sm font-medium text-muted dark:text-muted-dark">
                      {formatCents(memberShare)}
                    </Text>
                  ) : null}
                </Pressable>
              )
            })}
          </View>
        </View>
      </View>
    </Dialog>
  )
}
