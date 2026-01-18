import type { LanguageCode, Namespace, I18nConfig } from './types'
import { createLanguageCode, createNamespace } from './types'

const BUILTIN_LANGUAGES = ['zh-CN', 'zh-TW', 'en-US'] as const

const NAMESPACES = [
  'common',
  'settings',
  'proxy',
  'profile',
  'connection',
  'rule',
  'log',
  'resource',
  'override',
  'mihomo',
  'tun',
  'sysproxy',
  'sniffer',
  'dns',
  'updater',
  'substore'
] as const

export const I18N_CONFIG: I18nConfig = {
  builtinLanguages: BUILTIN_LANGUAGES.map(createLanguageCode),

  defaultLanguage: createLanguageCode('zh-CN'),

  fallbackLanguage: [
    createLanguageCode('zh-CN'),
    createLanguageCode('zh-TW'),
    createLanguageCode('en-US')
  ],

  namespaces: NAMESPACES.map(createNamespace),

  defaultNamespace: createNamespace('common'),

  paths: {
    builtin: 'src/shared/locales',
    external: 'resources/locales',
    custom: 'locales'
  },

  cache: {
    maxSize: 100,
    ttl: undefined
  },

  performance: {
    enableMetrics: false,
    enablePreload: false
  }
} as const

export const LANGUAGE_NAMES = {
  'zh-CN': '简体中文',
  'en-US': 'English',
  'zh-TW': '繁體中文',
  'zh-MIAO': '喵语',
  'ru-RU': 'Русский',
  'fa-IR': 'فارسی',
  'ja-JP': '日本語',
  'ko-KR': '한국어',
  'fr-FR': 'Français',
  'de-DE': 'Deutsch',
  'es-ES': 'Español',
  'pt-BR': 'Português',
  'ar-SA': 'العربية',
  'vi-VN': 'Tiếng Việt',
  'th-TH': 'ไทย',
  'it-IT': 'Italiano',
  'nl-NL': 'Nederlands',
  'pl-PL': 'Polski',
  'tr-TR': 'Türkçe',
  'sv-SE': 'Svenska',
  'da-DK': 'Dansk',
  'fi-FI': 'Suomi',
  'no-NO': 'Norsk',
  'cs-CZ': 'Čeština',
  'hu-HU': 'Magyar',
  'ro-RO': 'Română',
  'uk-UA': 'Українська',
  'el-GR': 'Ελληνικά',
  'he-IL': 'עברית',
  'id-ID': 'Bahasa Indonesia',
  'ms-MY': 'Bahasa Melayu',
  'hi-IN': 'हिन्दी',
  'bn-BD': 'বাংলা',
  'ta-IN': 'தமிழ்',
  'te-IN': 'తెలుగు'
} as const

export function validateConfig(config: I18nConfig): boolean {
  if (!config.builtinLanguages || config.builtinLanguages.length === 0) {
    console.error('[i18n] Config validation failed: builtinLanguages is empty')
    return false
  }

  if (!config.defaultLanguage) {
    console.error('[i18n] Config validation failed: defaultLanguage is missing')
    return false
  }

  if (!config.fallbackLanguage || config.fallbackLanguage.length === 0) {
    console.error('[i18n] Config validation failed: fallbackLanguage is empty')
    return false
  }

  if (!config.namespaces || config.namespaces.length === 0) {
    console.error('[i18n] Config validation failed: namespaces is empty')
    return false
  }

  if (!config.defaultNamespace) {
    console.error('[i18n] Config validation failed: defaultNamespace is missing')
    return false
  }

  if (!config.builtinLanguages.includes(config.defaultLanguage)) {
    console.warn('[i18n] Config warning: defaultLanguage is not in builtinLanguages')
  }

  if (!config.namespaces.includes(config.defaultNamespace)) {
    console.error('[i18n] Config validation failed: defaultNamespace is not in namespaces')
    return false
  }

  if (config.cache) {
    if (config.cache.maxSize !== undefined && config.cache.maxSize <= 0) {
      console.error('[i18n] Config validation failed: cache.maxSize must be greater than 0')
      return false
    }

    if (config.cache.ttl !== undefined && config.cache.ttl <= 0) {
      console.error('[i18n] Config validation failed: cache.ttl must be greater than 0')
      return false
    }
  }

  return true
}

export function createConfig(overrides: Partial<I18nConfig> = {}): I18nConfig {
  const config: I18nConfig = {
    ...I18N_CONFIG,
    ...overrides,
    paths: {
      ...I18N_CONFIG.paths,
      ...(overrides.paths || {})
    },
    cache: {
      ...I18N_CONFIG.cache,
      ...(overrides.cache || {})
    },
    performance: {
      ...I18N_CONFIG.performance,
      ...(overrides.performance || {})
    }
  }

  if (!validateConfig(config)) {
    throw new Error('Invalid i18n configuration')
  }

  return config
}

export function getLanguageName(languageCode: LanguageCode): string {
  return LANGUAGE_NAMES[languageCode as string] || languageCode
}

export function isBuiltinLanguage(languageCode: LanguageCode): boolean {
  return I18N_CONFIG.builtinLanguages.includes(languageCode)
}

export function isValidNamespace(namespace: Namespace): boolean {
  return I18N_CONFIG.namespaces.includes(namespace)
}
