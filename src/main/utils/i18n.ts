import { app, ipcMain } from 'electron'
import { readFileSync, existsSync } from 'fs'
import { join } from 'path'

interface TranslationData {
  [key: string]: string | TranslationData
}

let translations: TranslationData = {}
let currentLanguage = 'zh-CN'

function deepMerge(target: TranslationData, source: TranslationData): TranslationData {
  const result = { ...target }

  for (const key in source) {
    if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      if (result[key] && typeof result[key] === 'object' && !Array.isArray(result[key])) {
        result[key] = deepMerge(result[key] as TranslationData, source[key] as TranslationData)
      } else {
        result[key] = source[key]
      }
    } else {
      result[key] = source[key]
    }
  }

  return result
}

export function initMainI18n(): void {
  const locale = app.getLocale()
  currentLanguage =
    locale.startsWith('zh-TW') || locale.startsWith('zh-HK')
      ? 'zh-TW'
      : locale.startsWith('en')
        ? 'en-US'
        : 'zh-CN'

  loadTranslations()

  ipcMain.on('languageChanged', (_event, language: string) => {
    changeLanguage(language)
  })
}

function loadTranslations(): void {
  try {
    let builtinPath: string
    let customPath: string
    let fallbackPath: string

    if (app.isPackaged) {
      builtinPath = join(process.resourcesPath, 'resources', 'locales', `${currentLanguage}.json`)
      customPath = join(app.getPath('userData'), 'locales', `${currentLanguage}.json`)
      fallbackPath = join(process.resourcesPath, 'resources', 'locales', 'zh-CN.json')
    } else {
      builtinPath = join(__dirname, '../../src/shared/locales', `${currentLanguage}.json`)
      customPath = join(app.getPath('userData'), 'locales', `${currentLanguage}.json`)
      fallbackPath = join(__dirname, '../../src/shared/locales', 'zh-CN.json')
    }

    let builtinData: TranslationData = {}
    if (existsSync(builtinPath)) {
      const data = readFileSync(builtinPath, 'utf-8')
      builtinData = JSON.parse(data)
    } else if (existsSync(fallbackPath)) {
      const data = readFileSync(fallbackPath, 'utf-8')
      builtinData = JSON.parse(data)
    }

    let customData: TranslationData = {}
    if (existsSync(customPath)) {
      try {
        const data = readFileSync(customPath, 'utf-8')
        customData = JSON.parse(data)
      } catch (error) {
        console.warn('[i18n] Failed to load custom translations:', error)
      }
    }

    translations = deepMerge(builtinData, customData)
  } catch (error) {
    console.error('[i18n] Failed to load translations:', error)
    translations = {}
  }
}

export function t(keyPath: string, params?: Record<string, string | number>): string {
  const keys = keyPath.split('.')
  let value: string | TranslationData | undefined = translations

  for (const key of keys) {
    if (typeof value === 'object' && value !== null) {
      value = value[key]
    } else {
      return keyPath
    }
  }

  if (typeof value !== 'string') {
    return keyPath
  }

  if (params) {
    return value.replace(/\{(\w+)\}/g, (match, key) => {
      return params[key]?.toString() ?? match
    })
  }

  return value
}

export function changeLanguage(lang: string): void {
  currentLanguage = lang
  loadTranslations()
}

export function getCurrentLanguage(): string {
  return currentLanguage
}
