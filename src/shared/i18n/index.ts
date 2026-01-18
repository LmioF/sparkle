import i18next from 'i18next'
import { I18N_CONFIG } from './config'
import { createTranslationLoader } from './loader'
import { createLRUCache } from './cache'
import type { LanguageCode, TranslationResource, LoadResult } from './types'

const cache = createLRUCache<string, LoadResult>({ maxSize: 100 })

const loader = createTranslationLoader(cache)

export async function initI18n(language?: LanguageCode): Promise<typeof i18next> {
  const lng = language || I18N_CONFIG.defaultLanguage

  const resources: Record<string, Record<string, TranslationResource>> = {}

  const languagesToLoad = [lng, ...I18N_CONFIG.fallbackLanguage].filter(
    (lang, index, self) => self.indexOf(lang) === index
  )

  for (const lang of languagesToLoad) {
    resources[lang] = {}

    for (const ns of I18N_CONFIG.namespaces) {
      try {
        const result = await loader.load(lang, ns)
        if (result.success) {
          resources[lang][ns] = result.data.merged
        } else {
          console.error(`Failed to load translation: ${lang}/${ns}`, result.error)
          resources[lang][ns] = {}
        }
      } catch (error) {
        console.error(`Failed to load translation: ${lang}/${ns}`, error)
        resources[lang][ns] = {}
      }
    }
  }

  await i18next.init({
    lng,
    fallbackLng: I18N_CONFIG.fallbackLanguage,
    defaultNS: I18N_CONFIG.defaultNamespace,
    ns: I18N_CONFIG.namespaces,
    resources,

    // 禁用 HTML 转义
    interpolation: {
      escapeValue: false
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

  return i18next
}

export async function reloadLanguage(language: LanguageCode): Promise<void> {
  loader.clearLanguageCache(language)

  for (const ns of I18N_CONFIG.namespaces) {
    try {
      const result = await loader.load(language, ns)
      if (result.success) {
        i18next.addResourceBundle(language, ns, result.data.merged, true, true)
      } else {
        console.error(`Failed to reload translation: ${language}/${ns}`, result.error)
      }
    } catch (error) {
      console.error(`Failed to reload translation: ${language}/${ns}`, error)
    }
  }
}

export function clearCache(): void {
  loader.clearCache()
}

export { i18next as i18n }

export * from './types'
export * from './config'
export * from './utils'
