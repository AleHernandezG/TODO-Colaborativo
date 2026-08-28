import { ServerError, serverError } from '../../../shared/lib/errors'
import { assertOnline } from '../../../shared/lib/network'
import { supabase } from '../../../shared/lib/supabase'
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

  async listMembers(communityId: string): Promise<CommunityMember[]> {
    await assertOnline()

    const { data: sessionData } = await supabase.auth.getSession()
    const currentAuthId = sessionData?.session?.user?.id

    const { data, error } = await supabase
      .from('members')
      .select('id, username, auth_user_id')
      .eq('community_id', communityId)
      .order('username', { ascending: true })

    if (error) {
      throw serverError('members.select', error)
    }

    return (
      (data as unknown as { id: string; username: string; auth_user_id: string | null }[]) ?? []
    ).map((m) => ({
      id: m.id,
      username: m.username,
      isSelf: Boolean(currentAuthId && m.auth_user_id === currentAuthId),
    }))
  },
}
