import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'

import type { CommunityMember } from '@/features/community'

export function useMemberName(members: CommunityMember[]) {
  const { t } = useTranslation()

  return useCallback(
    (memberId: string) => {
      const member = members.find((m) => m.id === memberId)
      if (!member) {
        return t('expenses.unknownMember')
      }
      return member.isSelf ? t('expenses.you') : member.username
    },
    [members, t],
  )
}

export function useMemberUsername(members: CommunityMember[]) {
  const { t } = useTranslation()

  return useCallback(
    (memberId: string) =>
      members.find((m) => m.id === memberId)?.username ?? t('expenses.unknownMember'),
    [members, t],
  )
}
