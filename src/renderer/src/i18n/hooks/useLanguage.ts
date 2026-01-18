import { useCallback, useState, useEffect } from 'react'
import { useCurrentLanguage } from '../context'
import type { LanguageCode, LanguageInfo } from '../../../../shared/i18n/types'

export interface UseLanguageResult {
  currentLanguage: LanguageCode | null

  availableLanguages: LanguageInfo[]

  loading: boolean

  switching: boolean

  error: Error | null

  switchLanguage: (language: LanguageCode) => Promise<void>

  reloadLanguages: () => Promise<void>

  isLanguageAvailable: (language: LanguageCode) => boolean
}

export function useLanguage(): UseLanguageResult {
  const { language: currentLanguage, changeLanguage } = useCurrentLanguage()

  const [availableLanguages, setAvailableLanguages] = useState<LanguageInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [switching, setSwitching] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const loadLanguages = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      const langs = await window.electron.ipcRenderer.invoke('i18n:getAvailableLanguages')

      if (langs && Array.isArray(langs)) {
        setAvailableLanguages(langs)
      } else {
        throw new Error('Invalid languages response')
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to load languages')
      setError(error)
      console.error('[useLanguage] Failed to load languages:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  const switchLanguage = useCallback(
    async (language: LanguageCode) => {
      if (switching || language === currentLanguage) {
        return
      }

      try {
        setSwitching(true)
        setError(null)
        await changeLanguage(language)
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Failed to switch language')
        setError(error)
        console.error('[useLanguage] Failed to switch language:', error)
        throw error
      } finally {
        setSwitching(false)
      }
    },
    [switching, currentLanguage, changeLanguage]
  )

  const isLanguageAvailable = useCallback(
    (language: LanguageCode) => {
      return availableLanguages.some((lang) => lang.id === language)
    },
    [availableLanguages]
  )

  useEffect(() => {
    loadLanguages()
  }, [loadLanguages])

  return {
    currentLanguage,
    availableLanguages,
    loading,
    switching,
    error,
    switchLanguage,
    reloadLanguages: loadLanguages,
    isLanguageAvailable
  }
}

export function useLanguageSwitch() {
  const { language: currentLanguage, changeLanguage } = useCurrentLanguage()
  const [switching, setSwitching] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const switchLanguage = useCallback(
    async (language: LanguageCode) => {
      if (switching || language === currentLanguage) {
        return
      }

      try {
        setSwitching(true)
        setError(null)
        await changeLanguage(language)
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Failed to switch language')
        setError(error)
        throw error
      } finally {
        setSwitching(false)
      }
    },
    [switching, currentLanguage, changeLanguage]
  )

  return {
    currentLanguage,
    switchLanguage,
    switching,
    error
  }
}
