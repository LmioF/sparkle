import { createContext, useContext } from 'react'
import type { i18n as I18nInstance } from 'i18next'
import type { LanguageCode } from '../../../shared/i18n/types'

export interface I18nContextState {
  readonly i18n: I18nInstance | null

  readonly ready: boolean

  readonly language: LanguageCode | null

  readonly error: Error | null

  readonly loading: boolean

  changeLanguage: (language: LanguageCode) => Promise<void>

  reinitialize: () => Promise<void>
}

const defaultContextValue: I18nContextState = {
  i18n: null,
  ready: false,
  language: null,
  error: null,
  loading: true,
  changeLanguage: async () => {
    throw new Error('I18nProvider not found. Make sure to wrap your app with I18nProvider.')
  },
  reinitialize: async () => {
    throw new Error('I18nProvider not found. Make sure to wrap your app with I18nProvider.')
  }
}

export const I18nContext = createContext<I18nContextState>(defaultContextValue)

export function useI18nContext(): I18nContextState {
  const context = useContext(I18nContext)

  if (!context) {
    throw new Error('useI18nContext must be used within I18nProvider')
  }

  return context
}

export function useI18nReady(): boolean {
  const { ready } = useI18nContext()
  return ready
}

export function useCurrentLanguage(): {
  language: LanguageCode | null
  changeLanguage: (language: LanguageCode) => Promise<void>
} {
  const { language, changeLanguage } = useI18nContext()
  return { language, changeLanguage }
}

export function useI18nError(): {
  error: Error | null
  reinitialize: () => Promise<void>
} {
  const { error, reinitialize } = useI18nContext()
  return { error, reinitialize }
}
