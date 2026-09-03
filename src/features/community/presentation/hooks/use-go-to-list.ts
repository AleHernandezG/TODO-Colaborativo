import { useRouter } from 'expo-router'
import { useCallback } from 'react'

export function useGoToList() {
  const router = useRouter()

  return useCallback(() => {
    if (router.canDismiss()) {
      router.dismissAll()
    }
    router.replace('/list')
  }, [router])
}
