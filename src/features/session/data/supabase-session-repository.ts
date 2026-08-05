import { assertOnline } from '../../../shared/lib/network'
import { supabase } from '../../../shared/lib/supabase'
import type { SessionRepository } from '../domain/session-repository'

export const supabaseSessionRepository: SessionRepository = {
  async getCurrent() {
    await assertOnline()

    const { data, error } = await supabase.auth.getSession()
    if (error) {
      throw new Error(`No se pudo leer la sesión guardada: ${error.message}`)
    }
    const userId = data.session?.user.id
    return userId ? { userId } : null
  },

  async signInAnonymously() {
    await assertOnline()

    const { data, error } = await supabase.auth.signInAnonymously()
    if (error) {
      if (error.code === 'anonymous_provider_disabled') {
        throw new Error(
          'Las sesiones anónimas están desactivadas en Supabase. Actívalas en Authentication > Sign In / Providers > User Signups.',
        )
      }
      throw new Error(`No se pudo crear la sesión anónima: ${error.message}`)
    }
    if (!data.user) {
      throw new Error('Supabase devolvió una sesión anónima sin usuario.')
    }
    return { userId: data.user.id }
  },
}
