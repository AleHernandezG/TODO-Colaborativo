import { ServerError, serverError } from '@/shared/lib/errors'
import { assertOnline } from '@/shared/lib/network'
import { supabase } from '@/shared/lib/supabase'

import { SessionError } from '../domain/session-error'
import type { SessionRepository } from '../domain/session-repository'

export const supabaseSessionRepository: SessionRepository = {
  async getCurrent() {
    await assertOnline()

    const { data, error } = await supabase.auth.getSession()
    if (error) {
      throw serverError('auth.getSession', error)
    }
    const userId = data.session?.user.id
    return userId ? { userId } : null
  },

  async signInAnonymously() {
    await assertOnline()

    const { data, error } = await supabase.auth.signInAnonymously()
    if (error) {
      if (error.code === 'anonymous_provider_disabled') {
        throw new SessionError(
          'anonymous_disabled',
          'Las sesiones anónimas están desactivadas en Supabase. Actívalas en Authentication > Sign In / Providers > User Signups.',
        )
      }
      throw serverError('auth.signInAnonymously', error)
    }
    if (!data.user) {
      throw new ServerError('auth.signInAnonymously', 'sesión anónima sin usuario')
    }
    return { userId: data.user.id }
  },
}
