import { useRouter } from 'expo-router'
import { useCallback } from 'react'

type Fallback = '/list' | '/expenses'

export function useGoBack(fallback: Fallback) {
  const router = useRouter()

  return useCallback(() => {
    if (router.canGoBack()) {
      router.back()
      return
    }
    router.replace(fallback)
  }, [router, fallback])
}
