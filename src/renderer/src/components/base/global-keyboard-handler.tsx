import { useEffect, useRef } from 'react'
import { platform } from '@renderer/utils/init'
import { openDevTools, quitApp } from '@renderer/utils/ipc'

export function GlobalKeyboardHandler(): null {
  const f12CountRef = useRef(0)
  const f12TimerRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent): void => {
      if (platform !== 'darwin' && e.ctrlKey && e.key === 'q') {
        e.preventDefault()
        quitApp()
        return
      }

      if (platform === 'darwin' && e.metaKey && e.key === 'q') {
        e.preventDefault()
        quitApp()
        return
      }

      if (e.key === 'Escape') {
        e.preventDefault()
        window.close()
        return
      }

      if (e.key === 'F12') {
        e.preventDefault()
        f12CountRef.current++

        if (f12TimerRef.current) {
          clearTimeout(f12TimerRef.current)
        }

        if (f12CountRef.current >= 5) {
          openDevTools()
          f12CountRef.current = 0
        } else {
          f12TimerRef.current = setTimeout(() => {
            f12CountRef.current = 0
          }, 2000)
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      if (f12TimerRef.current) {
        clearTimeout(f12TimerRef.current)
      }
    }
  }, [])

  return null
}
