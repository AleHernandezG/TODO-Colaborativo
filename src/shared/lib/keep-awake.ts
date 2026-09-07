import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake'
import { useEffect } from 'react'

/**
 * Hook seguro para mantener la pantalla encendida mientras el componente esté montado.
 */
export function useKeepAwakeSafe(tag = 'shopping-mode'): void {
  useEffect(() => {
    void activateKeepAwakeAsync(tag).catch(() => undefined)

    return () => {
      try {
        void deactivateKeepAwake(tag)
      } catch {
        // Ignorar
      }
    }
  }, [tag])
}

