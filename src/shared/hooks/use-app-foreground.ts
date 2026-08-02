import { useEffect, useRef } from 'react'
import { AppState } from 'react-native'

export function useAppForeground(onForeground: () => void) {
  const callback = useRef(onForeground)

  useEffect(() => {
    callback.current = onForeground
  }, [onForeground])

  useEffect(() => {
    let previous = AppState.currentState

    const subscription = AppState.addEventListener('change', (next) => {
      if (previous !== 'active' && next === 'active') {
        callback.current()
      }
      previous = next
    })

    return () => subscription.remove()
  }, [])
}
