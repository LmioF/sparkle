import i18next from 'i18next'
import { initReactI18next } from 'react-i18next'
import { I18N_CONFIG } from '../../shared/i18n/config'
import { createTranslationLoader } from '../../shared/i18n/loader'
import { createLRUCache } from '../../shared/i18n/cache'
import type { TranslationResource, LoadResult } from '../../shared/i18n/types'
import { createLanguageCode } from '../../shared/i18n/types'
import { getAppConfig } from './utils/ipc'

const cache = createLRUCache<string, LoadResult>({ maxSize: 100 })

const loader = createTranslationLoader(cache)

let languageChangeCleanup: (() => void) | null = null

interface RegisteredListener {
  event: string
  handler: (...args: unknown[]) => void | Promise<void>
}
let registeredListeners: RegisteredListener[] = []

class InitializationState {
  private static instance: InitializationState | null = null
  private isInitializing = false
  private isInitialized = false
  private initPromise: Promise<typeof i18next> | null = null
  private initAttempts = 0
  private readonly MAX_ATTEMPTS = 3

  static getInstance(): InitializationState {
    if (!InitializationState.instance) {
      InitializationState.instance = new InitializationState()
    }
    return InitializationState.instance
  }

  static reset(): void {
    InitializationState.instance = null
  }

  canInitialize(): boolean {
    return !this.isInitializing && this.initAttempts < this.MAX_ATTEMPTS
  }

  tryStartInitialization(): boolean {
    if (this.isInitializing || this.initAttempts >= this.MAX_ATTEMPTS) {
      return false
    }
    this.isInitializing = true
    this.initAttempts++
    return true
  }

  setPromise(promise: Promise<typeof i18next>): void {
    this.initPromise = promise
  }

  completeInitialization(): void {
    this.isInitializing = false
    this.isInitialized = true
  }

  failInitialization(): void {
    this.isInitializing = false
    this.initPromise = null
  }

  getPromise(): Promise<typeof i18next> | null {
    return this.initPromise
  }

  getInitialized(): boolean {
    return this.isInitialized
  }

  reset(): void {
    this.isInitializing = false
    this.isInitialized = false
    this.initPromise = null
    this.initAttempts = 0
  }
}

export function isI18nInitialized(): boolean {
  return InitializationState.getInstance().getInitialized()
}

export async function initRendererI18n(): Promise<typeof i18next> {
  const state = InitializationState.getInstance()

  const existingPromise = state.getPromise()
  if (existingPromise) {
    return existingPromise
  }

  if (state.getInitialized()) {
    return i18next
  }

  if (!state.tryStartInitialization()) {
    const promise = state.getPromise()
    if (promise) {
      return promise
    }
    throw new Error('i18n initialization failed after maximum attempts')
  }

  const initPromise = (async () => {
    try {
      if (languageChangeCleanup) {
        languageChangeCleanup()
        languageChangeCleanup = null
      }

      registeredListeners.forEach(({ event, handler }) => {
        i18next.off(event, handler)
      })
      registeredListeners = []

      const config = await getAppConfig()

      let languageCode = config.language || 'zh-CN'

      const validPattern = /^[a-zA-Z0-9][a-zA-Z0-9-]*$/
      if (!validPattern.test(languageCode) || languageCode.length > 20) {
        console.warn(
          `[i18n] Invalid language code in config: ${languageCode}, falling back to zh-CN`
        )
        languageCode = 'zh-CN'
      }

      const language = createLanguageCode(languageCode)

      i18next.use(initReactI18next)

      const resources: Record<string, Record<string, TranslationResource>> = {}

      const languagesToLoad = [language, ...I18N_CONFIG.fallbackLanguage].filter(
        (lang, index, self) => self.indexOf(lang) === index // 去重
      )

      for (const lang of languagesToLoad) {
        resources[lang as string] = {}

        for (const ns of I18N_CONFIG.namespaces) {
          try {
            const result = await loader.load(lang, ns)
            if (result.success) {
              resources[lang as string][ns as string] = result.data.merged
            } else {
              console.error(`Failed to load translation: ${lang}/${ns}`, result.error)
              resources[lang as string][ns as string] = {}
            }
          } catch (error) {
            console.error(`Failed to load translation: ${lang}/${ns}`, error)
            resources[lang as string][ns as string] = {}
          }
        }
      }

      await i18next.init({
        lng: language as string,
        fallbackLng: I18N_CONFIG.fallbackLanguage.map((l) => l as string),
        defaultNS: I18N_CONFIG.defaultNamespace as string,
        ns: I18N_CONFIG.namespaces.map((n) => n as string),
        resources,

        // 禁用 HTML 转义
        interpolation: {
          escapeValue: false
        },

        react: {
          useSuspense: false
        },

        debug: process.env.NODE_ENV === 'development',

        saveMissing: true,
        missingKeyHandler: (lngs, ns, key) => {
          if (process.env.NODE_ENV === 'development') {
            console.warn(`[i18n] Missing translation key: [${lngs.join(', ')}] ${ns}:${key}`)
          }
        },

        returnObjects: false,

        returnEmptyString: false,

        returnNull: false
      })

      const handleLanguageChanged = async (...args: unknown[]): Promise<void> => {
        const lng = args[0] as string
        console.log('[i18n] Language changed to:', lng)

        try {
          await window.electron.ipcRenderer.invoke('i18n:saveLanguage', lng)
        } catch (error) {
          console.error('[i18n] Failed to save language:', error)
        }
      }

      i18next.on('languageChanged', handleLanguageChanged)

      registeredListeners.push({ event: 'languageChanged', handler: handleLanguageChanged })

      languageChangeCleanup = () => {
        i18next.off('languageChanged', handleLanguageChanged)
      }

      state.completeInitialization()
      console.log('[i18n] Renderer i18n initialized with language:', language)
      return i18next
    } catch (error) {
      console.error('[i18n] Failed to initialize renderer i18n:', error)

      if (languageChangeCleanup) {
        languageChangeCleanup()
        languageChangeCleanup = null
      }

      registeredListeners.forEach(({ event, handler }) => {
        i18next.off(event, handler)
      })
      registeredListeners = []

      state.failInitialization()

      throw error
    }
  })()

  state.setPromise(initPromise)

  return initPromise
}

export function cleanupRendererI18n(): void {
  if (languageChangeCleanup) {
    languageChangeCleanup()
    languageChangeCleanup = null
  }

  registeredListeners.forEach(({ event, handler }) => {
    i18next.off(event, handler)
  })
  registeredListeners = []

  InitializationState.getInstance().reset()
}

export { i18next as i18n }
