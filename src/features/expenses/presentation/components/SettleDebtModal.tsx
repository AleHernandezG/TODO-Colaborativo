import { useTranslation } from 'react-i18next'
import { Text, View } from 'react-native'

import { Dialog } from '@/shared/ui/Dialog'

import type { DebtTransfer } from '../../domain/expense'
import { formatCents } from '../../domain/money'
import { useCreateSettlement } from '../hooks/use-create-settlement'

type Props = {
  visible: boolean
  onDismiss: () => void
  communityId: string
  transfer: DebtTransfer | null
  onSuccess?: () => void
}

export function SettleDebtModal({ visible, onDismiss, communityId, transfer, onSuccess }: Props) {
  const { t } = useTranslation()
  const { mutate: createSettlement } = useCreateSettlement(communityId)

  if (!transfer) return null

  const handleConfirm = () => {
    createSettlement({
      fromMemberId: transfer.fromMemberId,
      toMemberId: transfer.toMemberId,
      amountCents: transfer.amountCents,
    })

    onDismiss()
    onSuccess?.()
  }

  return (
    <Dialog
      visible={visible}
      title={t('expenses.settleDebtModalTitle')}
      onDismiss={onDismiss}
      confirmLabel={t('expenses.confirmSettle')}
      onConfirm={handleConfirm}
      cancelLabel={t('common.cancel')}
    >
      <View className="gap-3 py-2">
        <Text className="text-base text-content dark:text-content-dark">
          {t('expenses.settleDebtDescription', {
            from: transfer.fromUsername,
            to: transfer.toUsername,
            amount: formatCents(transfer.amountCents),
          })}
        </Text>
      </View>
    </Dialog>
  )
}
