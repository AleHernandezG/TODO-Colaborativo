import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'

import { useSnackbar } from '@/shared/hooks/use-snackbar'

import { checkActiveMembership } from '../../domain/my-memberships'
import { useActiveCommunityStore } from '../stores/active-community-store'
import { useMyCommunities } from './use-my-communities'

export function useActiveMembershipSync() {
  const { t } = useTranslation()
  const showSnackbar = useSnackbar()
  const { data, isSuccess, isFetchedAfterMount, isFetching } = useMyCommunities()

  useEffect(() => {
    if (!data || !isSuccess || !isFetchedAfterMount || isFetching) {
      return
    }

    const { membership, setMembership, leave } = useActiveCommunityStore.getState()
    const check = checkActiveMembership(membership, data)

    if (check.status === 'refreshed') {
      setMembership(check.membership)
      return
    }

    if (check.status === 'replaced') {
      setMembership(check.membership)
      showSnackbar(
        t('lists.removedAndMoved', {
          name: check.lostCommunityName,
          next: check.membership.community.name,
        }),
      )
      return
    }

    if (check.status === 'none') {
      leave()
      showSnackbar(t('lists.removed', { name: check.lostCommunityName }))
    }
  }, [data, isSuccess, isFetchedAfterMount, isFetching, showSnackbar, t])
}
