import { ipcMain, app } from 'electron'
import fs from 'fs/promises'
import path from 'path'
import type { LanguageInfo, LanguageMeta } from '../../shared/i18n/types'
import { getLanguageDisplayName, isSafePath } from '../../shared/i18n/utils'
import { I18N_CONFIG } from '../../shared/i18n/config'
import { patchAppConfig } from '../config'

const MAX_TRANSLATION_FILE_SIZE = 10 * 1024 * 1024 // 10MB
const MAX_CONCURRENT_FILE_LOADS = 5

interface LanguageListCache {
  data: LanguageInfo[]
  timestamp: number
}

let languageListCache: LanguageListCache | null = null
const CACHE_TTL = 60000

let cacheCleanupTimer: NodeJS.Timeout | null = null

export function clearLanguageListCache(): void {
  languageListCache = null
}

function startCacheCleanup(): void {
  if (cacheCleanupTimer) {
    return
  }

  cacheCleanupTimer = setInterval(() => {
    if (languageListCache && Date.now() - languageListCache.timestamp > CACHE_TTL) {
      clearLanguageListCache()
    }
  }, CACHE_TTL)
}

export function stopCacheCleanup(): void {
  if (cacheCleanupTimer) {
    clearInterval(cacheCleanupTimer)
    cacheCleanupTimer = null
  }
}

// AI太好用了
function sanitizeTranslationData(data: unknown): Record<string, unknown> {
  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    return {}
  }

  const result = Object.create(null)
  const maxDepth = 10
  const maxKeysPerObject = 10000
  let totalKeys = 0
  const maxTotalKeys = 50000

  function sanitizeValue(value: unknown, depth: number): unknown {
    if (depth > maxDepth) {
      console.warn('[i18n] Translation data exceeds max depth, truncating')
      return ''
    }

    if (totalKeys >= maxTotalKeys) {
      console.error('[i18n] Translation data exceeds max total keys limit')
      return ''
    }

    if (typeof value === 'string') {
      const sanitizedValue = value

      /*
      const htmlTagPattern = /(^|[\s>.,;!?])<\s*\/?[a-z][a-z0-9]* /i
      if (htmlTagPattern.test(sanitizedValue)) {
        sanitizedValue = sanitizedValue.replace(/<\s*\/?[a-z][a-z0-9]*[^>]*>/gi, '')
      }
      */

      /*
      if (/&[a-z]+;|&#\d+;|&#x[0-9a-f]+;/i.test(sanitizedValue)) {
        sanitizedValue = sanitizedValue.replace(/&[a-z]+;|&#\d+;|&#x[0-9a-f]+;/gi, '')
      }
      */

      /*
      if (/javascript:|data:text\/html/i.test(sanitizedValue)) {
        sanitizedValue = sanitizedValue
          .replace(/javascript:/gi, '')
          .replace(/data:text\/html[^,]*,/gi, '')
      }
      */

      return sanitizedValue
    } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      const nested = Object.create(null)
      const entries = Object.entries(value)

      if (entries.length > maxKeysPerObject) {
        console.error(
          `[i18n] Object has too many keys (${entries.length}), max allowed: ${maxKeysPerObject}`
        )
        return Object.create(null)
      }

      for (const [key, val] of entries) {
        if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
          console.error(`[i18n] Dangerous key detected and rejected: ${key}`)
          continue
        }

        if (/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(key)) {
          totalKeys++
          nested[key] = sanitizeValue(val, depth + 1)
        } else {
          console.warn(`[i18n] Invalid translation key format: ${key}`)
        }
      }
      return nested
    }

    return String(value)
  }

  const entries = Object.entries(data)

  if (entries.length > maxKeysPerObject) {
    console.error(
      `[i18n] Root object has too many keys (${entries.length}), max allowed: ${maxKeysPerObject}`
    )
    return result
  }

  for (const [key, value] of entries) {
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
      console.error(`[i18n] Dangerous key detected and rejected: ${key}`)
      continue
    }

    if (/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(key)) {
      totalKeys++
      result[key] = sanitizeValue(value, 0)
    } else {
      console.warn(`[i18n] Invalid translation key format: ${key}`)
    }
  }

  return result
}

interface IpcResult<T = unknown> {
  success: boolean
  data?: T
  error?: string
}

function validateI18nParams(
  language: string,
  namespace: string
): { valid: true } | { valid: false; error: string } {
  if (!language || typeof language !== 'string' || !namespace || typeof namespace !== 'string') {
    console.warn('[i18n] Invalid parameters:', { language, namespace })
    return { valid: false, error: 'INVALID_PARAMS' }
  }

  const validPattern = /^[a-zA-Z0-9_-]+$/
  if (!validPattern.test(language) || !validPattern.test(namespace)) {
    console.warn('[i18n] Invalid parameter format:', { language, namespace })
    return { valid: false, error: 'INVALID_FORMAT' }
  }

  if (language.length > 20 || namespace.length > 50) {
    console.warn('[i18n] Parameter too long:', { language, namespace })
    return { valid: false, error: 'PARAM_TOO_LONG' }
  }

  if (!isSafePath(language) || !isSafePath(namespace)) {
    console.warn('[i18n] Unsafe path detected:', { language, namespace })
    return { valid: false, error: 'UNSAFE_PATH' }
  }

  return { valid: true }
}

function getResourcesBasePath(): string {
  if (app.isPackaged) {
    return process.resourcesPath
  }
  return app.getAppPath()
}

function createLoadHandler(subPath: string) {
  return async (
    _: Electron.IpcMainInvokeEvent,
    language: string,
    namespace: string
  ): Promise<IpcResult> => {
    try {
      const validation = validateI18nParams(language, namespace)
      if (!validation.valid) {
        return { success: false, error: validation.error, data: {} }
      }

      const basePath = getResourcesBasePath()
      const filePath = path.join(basePath, subPath, `${language}.json`)

      let stats
      try {
        stats = await fs.stat(filePath)
      } catch (statError) {
        const errCode = (statError as NodeJS.ErrnoException).code
        if (errCode === 'ENOENT') {
          return { success: true, data: {} }
        }
        console.error(`[i18n] Failed to stat file (${subPath}):`, filePath, statError)
        return { success: false, error: errCode || 'STAT_ERROR', data: {} }
      }

      if (stats.size > MAX_TRANSLATION_FILE_SIZE) {
        console.error(
          `[i18n] File too large (${(stats.size / 1024 / 1024).toFixed(2)}MB, max: ${MAX_TRANSLATION_FILE_SIZE / 1024 / 1024}MB): ${filePath}`
        )
        return { success: false, error: 'FILE_TOO_LARGE', data: {} }
      }

      const content = await fs.readFile(filePath, 'utf-8')

      let data: Record<string, unknown>
      try {
        data = JSON.parse(content)
      } catch (parseError) {
        const errorMsg = parseError instanceof Error ? parseError.message : 'Unknown parse error'
        console.error(`[i18n] Failed to parse translation file (${subPath}):`, filePath, errorMsg)
        return {
          success: false,
          error: 'PARSE_ERROR',
          data: {}
        }
      }

      const namespaceData = data[namespace]
      if (namespaceData && typeof namespaceData === 'object') {
        const sanitized = sanitizeTranslationData(namespaceData)
        return { success: true, data: sanitized }
      }

      return { success: true, data: {} }
    } catch (error) {
      const errCode = (error as NodeJS.ErrnoException).code
      console.error(
        `[i18n] Failed to load translation (${subPath}):`,
        { language, namespace },
        error
      )
      return { success: false, error: errCode || 'UNKNOWN_ERROR', data: {} }
    }
  }
}

export function registerI18nHandlers(): void {
  ipcMain.handle('i18n:loadExternal', createLoadHandler('resources/locales'))

  ipcMain.handle('i18n:loadCustom', async () => {
    return { success: true, data: {} }
  })
  /*
  ipcMain.handle('i18n:loadCustom', async (_: any, language: string, namespace: string): Promise<IpcResult> => {
    try {
      const validation = validateI18nParams(language, namespace)
      if (!validation.valid) {
        return { success: false, error: validation.error, data: {} }
      }

      const customDir = path.join(app.getPath('userData'), 'locales')
      const filePath = path.join(customDir, `${language}.json`)

      let stats
      try {
        stats = await fs.stat(filePath)
      } catch (statError) {
        const errCode = (statError as NodeJS.ErrnoException).code
        if (errCode === 'ENOENT') {
          return { success: true, data: {} }
        }
        console.error(`[i18n] Failed to stat custom file:`, filePath, statError)
        return { success: false, error: errCode || 'STAT_ERROR', data: {} }
      }

      if (stats.size > MAX_TRANSLATION_FILE_SIZE) {
        console.error(
          `[i18n] Custom file too large (${(stats.size / 1024 / 1024).toFixed(2)}MB, max: ${MAX_TRANSLATION_FILE_SIZE / 1024 / 1024}MB): ${filePath}`
        )
        return { success: false, error: 'FILE_TOO_LARGE', data: {} }
      }

      const content = await fs.readFile(filePath, 'utf-8')

      let data: Record<string, unknown>
      try {
        data = JSON.parse(content)
      } catch (parseError) {
        const errorMsg = parseError instanceof Error ? parseError.message : 'Unknown parse error'
        console.error(`[i18n] Failed to parse custom translation file:`, filePath, errorMsg)
        return { 
          success: false, 
          error: 'PARSE_ERROR',
          data: {}
        }
      }

      const namespaceData = data[namespace]
      if (namespaceData && typeof namespaceData === 'object') {
        const sanitized = sanitizeTranslationData(namespaceData)

        const hasValidContent = Object.keys(sanitized).length > 0
        
        if (!hasValidContent) {
          console.error(`[i18n] Custom translation file has no valid content after sanitization: ${filePath}`)
          return { success: false, error: 'VALIDATION_ERROR', data: {} }
        }
        
        return { success: true, data: sanitized }
      }

      return { success: true, data: {} }
    } catch (error) {
      const errCode = (error as NodeJS.ErrnoException).code
      console.error(`[i18n] Failed to load custom translation:`, { language, namespace }, error)
      return { success: false, error: errCode || 'UNKNOWN_ERROR', data: {} }
    }
  })
  */

  ipcMain.handle('i18n:getAvailableLanguages', async () => {
    return await getAvailableLanguages()
  })

  ipcMain.handle('i18n:saveLanguage', async (_, language: string) => {
    try {
      const validation = validateI18nParams(language, 'common')
      if (!validation.valid) {
        console.error('[i18n] Invalid language code:', language, validation.error)
        return false
      }

      await patchAppConfig({ language })
      return true
    } catch (error) {
      console.error('[i18n] Failed to save language:', error)
      return false
    }
  })

  ipcMain.handle('i18n:openCustomLocalesDir', async () => {
    try {
      const customDir = path.join(app.getPath('userData'), 'locales')

      await fs.mkdir(customDir, { recursive: true })

      const { shell } = await import('electron')
      await shell.openPath(customDir)

      return { success: true, path: customDir }
    } catch (error) {
      console.error('[i18n] Failed to open custom locales directory:', error)
      return { success: false, error: String(error) }
    }
  })

  startCacheCleanup()
}

async function getAvailableLanguages(): Promise<LanguageInfo[]> {
  if (languageListCache && Date.now() - languageListCache.timestamp < CACHE_TTL) {
    return languageListCache.data
  }

  const languages = new Map<string, LanguageInfo>()

  const builtinLanguages = I18N_CONFIG.builtinLanguages
  for (const langId of builtinLanguages) {
    languages.set(langId, {
      id: langId,
      name: getLanguageDisplayName(langId),
      source: 'builtin'
    })
  }

  try {
    const basePath = getResourcesBasePath()
    const externalDir = path.join(basePath, 'resources/locales')
    await scanLanguageFiles(externalDir, 'external', languages)
  } catch (error) {
    // ignore
  }

  /*
  try {
    const customDir = path.join(app.getPath('userData'), 'locales')
    await scanLanguageFiles(customDir, 'custom', languages)
  } catch (error) {
    // ignore
  }
  */

  const result = Array.from(languages.values())

  languageListCache = {
    data: result,
    timestamp: Date.now()
  }

  return result
}

async function scanLanguageFiles(
  dir: string,
  source: 'builtin' | 'external' | 'custom',
  languages: Map<string, LanguageInfo>
): Promise<void> {
  try {
    const files = await fs.readdir(dir)
    const jsonFiles = files.filter((file) => file.endsWith('.json'))

    for (let i = 0; i < jsonFiles.length; i += MAX_CONCURRENT_FILE_LOADS) {
      const batch = jsonFiles.slice(i, i + MAX_CONCURRENT_FILE_LOADS)

      await Promise.all(
        batch.map(async (file) => {
          const filePath = path.join(dir, file)

          try {
            const stats = await fs.stat(filePath)
            if (stats.size > MAX_TRANSLATION_FILE_SIZE) {
              console.warn(
                `[i18n] File too large (${(stats.size / 1024 / 1024).toFixed(2)}MB, max: ${MAX_TRANSLATION_FILE_SIZE / 1024 / 1024}MB), skipping: ${file}`
              )
              return
            }

            const content = await fs.readFile(filePath, 'utf-8')

            let data: Record<string, unknown>
            try {
              data = JSON.parse(content)
            } catch (parseError) {
              console.warn(`[i18n] Failed to parse JSON in ${file}:`, parseError)
              return
            }

            const meta = data._meta as LanguageMeta | undefined

            if (!meta || !meta.languageId) {
              console.warn(`[i18n] Missing _meta.languageId in ${file}`)
              return
            }

            const languageId = meta.languageId

            const languageName = meta.languageName || getLanguageDisplayName(languageId)

            if (languages.has(languageId) && source !== 'custom') {
              return
            }

            languages.set(languageId, {
              id: languageId,
              name: languageName,
              source,
              filePath
            })
          } catch (error) {
            const errCode = (error as NodeJS.ErrnoException).code
            if (errCode === 'EACCES') {
              console.error(`[i18n] Permission denied reading file ${file}:`, error)
            } else if (errCode === 'ENOENT') {
              // ignore
            } else {
              console.warn(`[i18n] Failed to process language file ${file}:`, error)
            }
          }
        })
      )
    }
  } catch (error) {
    const errCode = (error as NodeJS.ErrnoException).code
    if (errCode === 'ENOENT') {
      // ignore
    } else if (errCode === 'EACCES') {
      console.error(`[i18n] Permission denied accessing directory ${dir}:`, error)
    } else {
      console.error(`[i18n] Failed to scan directory ${dir}:`, error)
    }
  }
}
