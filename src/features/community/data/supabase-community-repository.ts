import { assertOnline } from '../../../shared/lib/network'
import { supabase } from '../../../shared/lib/supabase'
import type { Community } from '../domain/community'
import type { CommunityRepository, JoinOutcome } from '../domain/community-repository'

const failedJoinStatuses = ['invalid_join_code', 'username_taken', 'too_many_attempts'] as const

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
    throw new Error(`Entraste en la lista pero no se pudo leer: ${error.message}`)
  }

  return { id: data.id, name: data.name, joinCode: data.join_code }
}

export const supabaseCommunityRepository: CommunityRepository = {
  async create({ name, username }) {
    await assertOnline()

    const { data, error } = await supabase.rpc('create_community', {
      p_name: name,
      p_username: username,
    })

    if (error) {
      throw new Error(`No se pudo crear la lista: ${error.message}`)
    }

    const created = data?.[0]
    if (!created) {
      throw new Error('create_community no devolvió la comunidad creada.')
    }

    return {
      community: { id: created.community_id, name, joinCode: created.join_code },
      username,
    }
  },

  async join({ joinCode, username }): Promise<JoinOutcome> {
    await assertOnline()

    const { data, error } = await supabase.rpc('join_community', {
      p_join_code: joinCode,
      p_username: username,
    })

    if (error) {
      throw new Error(`No se pudo entrar en la lista: ${error.message}`)
    }

    const result = data?.[0]
    if (!result) {
      throw new Error('join_community no devolvió ningún estado.')
    }

    if (isFailedJoinStatus(result.status)) {
      return { status: result.status }
    }

    if (result.status !== 'ok' || !result.community_id) {
      throw new Error(`join_community devolvió un estado desconocido: ${result.status}`)
    }

    return {
      status: 'ok',
      membership: { community: await readCommunity(result.community_id), username },
    }
  },
}
