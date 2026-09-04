import { ServerError, serverError } from '@/shared/lib/errors'
import { assertOnline } from '@/shared/lib/network'
import { supabase } from '@/shared/lib/supabase'

import type { Community, JoinCodeInfo } from '../domain/community'
import type {
  CommunityMember,
  CommunityRepository,
  JoinOutcome,
} from '../domain/community-repository'

const failedJoinStatuses = [
  'invalid_join_code',
  'expired_join_code',
  'username_taken',
  'invalid_pin',
  'wrong_pin',
  'too_many_attempts',
] as const

type FailedJoinStatus = (typeof failedJoinStatuses)[number]

function isFailedJoinStatus(status: string): status is FailedJoinStatus {
  return failedJoinStatuses.includes(status as FailedJoinStatus)
}

async function readCommunity(id: string): Promise<Community> {
  const { data, error } = await supabase
    .from('communities')
    .select('id, name, join_code')
    .eq('id', id)
    .single()

  if (error) {
    throw serverError('communities.select', error)
  }

  return { id: data.id, name: data.name, joinCode: data.join_code }
}

export const supabaseCommunityRepository: CommunityRepository = {
  async create({ name, username, pin }) {
    await assertOnline()

    const { data, error } = await supabase.rpc('create_community', {
      p_name: name,
      p_username: username,
      p_pin: pin,
    })

    if (error) {
      throw serverError('create_community', error)
    }

    const created = data?.[0]
    if (!created) {
      throw new ServerError('create_community', 'la RPC no devolvió la comunidad creada')
    }

    return {
      community: { id: created.community_id, name, joinCode: created.join_code },
      username,
    }
  },

  async join({ joinCode, username, pin }): Promise<JoinOutcome> {
    await assertOnline()

    const { data, error } = await supabase.rpc('join_community', {
      p_join_code: joinCode,
      p_username: username,
      p_pin: pin,
    })

    if (error) {
      throw serverError('join_community', error)
    }

    const result = data?.[0]
    if (!result) {
      throw new ServerError('join_community', 'la RPC no devolvió ningún estado')
    }

    if (isFailedJoinStatus(result.status)) {
      if (result.status === 'invalid_pin') {
        return { status: 'wrong_pin' }
      }
      return { status: result.status }
    }

    if (result.status !== 'ok' || !result.community_id) {
      throw new ServerError('join_community', `estado desconocido: ${result.status}`)
    }

    return {
      status: 'ok',
      membership: { community: await readCommunity(result.community_id), username },
    }
  },

  async getJoinCode(communityId): Promise<JoinCodeInfo> {
    await assertOnline()

    const { data, error } = await supabase
      .from('communities')
      .select('join_code, join_code_expires_at')
      .eq('id', communityId)
      .single()

    if (error) {
      throw serverError('communities.selectJoinCode', error)
    }

    return { code: data.join_code, expiresAt: data.join_code_expires_at }
  },

  async rotateJoinCode(communityId): Promise<JoinCodeInfo> {
    await assertOnline()

    const { data, error } = await supabase.rpc('rotate_join_code', {
      p_community_id: communityId,
    })

    if (error) {
      throw serverError('rotate_join_code', error)
    }

    const rotated = data?.[0]
    if (!rotated) {
      throw new ServerError('rotate_join_code', 'la RPC no devolvió ningún código')
    }

    return { code: rotated.join_code, expiresAt: rotated.expires_at }
  },

  async listMembers(
    communityId: string,
    options?: { includeArchived?: boolean },
  ): Promise<CommunityMember[]> {
    await assertOnline()

    const { data: sessionData } = await supabase.auth.getSession()
    const currentAuthId = sessionData?.session?.user?.id

    let query = supabase
      .from('members')
      .select('id, username, auth_user_id, is_admin, removed_at')
      .eq('community_id', communityId)
      .order('username', { ascending: true })

    if (!options?.includeArchived) {
      query = query.is('removed_at', null)
    }

    const { data, error } = await query

    if (error) {
      throw serverError('members.select', error)
    }

    return (
      (
        data as unknown as {
          id: string
          username: string
          auth_user_id: string | null
          is_admin: boolean
          removed_at: string | null
        }[]
      ) ?? []
    ).map((m) => ({
      id: m.id,
      username: m.username,
      isSelf: Boolean(currentAuthId && m.auth_user_id === currentAuthId),
      isAdmin: Boolean(m.is_admin),
      isGuest: m.auth_user_id === null,
      removedAt: m.removed_at,
    }))
  },

  async removeMember(
    communityId: string,
    memberId: string,
  ): Promise<{ status: 'deleted' | 'archived' }> {
    await assertOnline()

    const { data, error } = await supabase.rpc('remove_member', {
      p_community_id: communityId,
      p_member_id: memberId,
    })

    if (error) {
      throw serverError('remove_member', error)
    }

    const result = data?.[0]
    if (!result || (result.status !== 'deleted' && result.status !== 'archived')) {
      throw new ServerError('remove_member', `respuesta inesperada de la RPC: ${result?.status}`)
    }

    return { status: result.status as 'deleted' | 'archived' }
  },

  async setMemberAdmin(communityId: string, memberId: string, isAdmin: boolean): Promise<void> {
    await assertOnline()

    const { error } = await supabase.rpc('set_member_admin', {
      p_community_id: communityId,
      p_member_id: memberId,
      p_is_admin: isAdmin,
    })

    if (error) {
      throw serverError('set_member_admin', error)
    }
  },

  async addGuestMember(communityId: string, username: string): Promise<CommunityMember> {
    await assertOnline()

    const { data, error } = await supabase.rpc('add_guest_member', {
      p_community_id: communityId,
      p_username: username,
    })

    if (error) {
      throw serverError('add_guest_member', error)
    }

    const created = data?.[0]
    if (!created) {
      throw new ServerError('add_guest_member', 'la RPC no devolvió el invitado creado')
    }

    return {
      id: created.id,
      username: created.username,
      isSelf: false,
      isAdmin: false,
      isGuest: true,
      removedAt: null,
    }
  },

  subscribeMembers(communityId: string, onChange: () => void): () => void {
    const channel = supabase
      .channel(`members:${communityId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'members',
          filter: `community_id=eq.${communityId}`,
        },
        () => {
          onChange()
        },
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  },
}
