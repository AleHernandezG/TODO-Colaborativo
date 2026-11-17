import { useEffect, useState } from 'react'

export function useSlowPending(pending: boolean, afterMs = 3000): boolean {
  const [slow, setSlow] = useState(false)

  useEffect(() => {
    if (!pending) {
      return
    }
    const timer = setTimeout(() => setSlow(true), afterMs)
    return () => {
      clearTimeout(timer)
      setSlow(false)
    }
  }, [pending, afterMs])

  return pending && slow
}
