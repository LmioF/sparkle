import path from 'path'
import type {
  LanguageCode,
  Namespace,
  TranslationKey,
  TranslationResource,
  ValidationError
} from './types'
import { createLanguageCode, createNamespace, createTranslationKey, ok, err } from './types'
import { ValidationError as ValidationErrorClass } from './types'
import { LANGUAGE_NAMES } from './config'
import type { Result } from './types'

export function getLanguageDisplayName(languageCode: LanguageCode): string {
  const code = languageCode as string

  if (LANGUAGE_NAMES[code]) {
    return LANGUAGE_NAMES[code]
  }

  try {
    const displayNames = new Intl.DisplayNames([code], {
      type: 'language',
      fallback: 'code'
    })
    const name = displayNames.of(code)
    if (name && name !== code) {
      return name
    }
  } catch (error) {
    // ignore
  }

  return code
}

export function validateLanguageCode(code: string): Result<LanguageCode, ValidationError> {
  // 检查是否为空
  if (!code || typeof code !== 'string') {
    return err(
      new ValidationErrorClass('Language code must be a non-empty string', 'languageCode', code)
    )
  }

  if (code.length < 2 || code.length > 20) {
    return err(
      new ValidationErrorClass(
        'Language code length must be between 2 and 20 characters',
        'languageCode',
        code
      )
    )
  }

  const validPattern = /^[a-zA-Z0-9-]+$/
  if (!validPattern.test(code)) {
    return err(
      new ValidationErrorClass(
        'Language code must only contain letters, numbers, and hyphens',
        'languageCode',
        code
      )
    )
  }

  try {
    new Intl.Locale(code)
  } catch {
    console.debug(`[i18n] Non-standard language code: ${code}`)
  }

  return ok(createLanguageCode(code))
}

export function validateNamespace(ns: string): Result<Namespace, ValidationError> {
  if (!ns || typeof ns !== 'string') {
    return err(new ValidationErrorClass('Namespace must be a non-empty string', 'namespace', ns))
  }

  if (ns.length < 1 || ns.length > 50) {
    return err(
      new ValidationErrorClass(
        'Namespace length must be between 1 and 50 characters',
        'namespace',
        ns
      )
    )
  }

  const validPattern = /^[a-zA-Z0-9_-]+$/
  if (!validPattern.test(ns)) {
    return err(
      new ValidationErrorClass(
        'Namespace must only contain letters, numbers, hyphens, and underscores',
        'namespace',
        ns
      )
    )
  }

  return ok(createNamespace(ns))
}

export function validateTranslationKey(key: string): Result<TranslationKey, ValidationError> {
  if (!key || typeof key !== 'string') {
    return err(
      new ValidationErrorClass('Translation key must be a non-empty string', 'translationKey', key)
    )
  }

  if (key.length < 1 || key.length > 200) {
    return err(
      new ValidationErrorClass(
        'Translation key length must be between 1 and 200 characters',
        'translationKey',
        key
      )
    )
  }

  const validPattern = /^[a-zA-Z0-9._-]+$/
  if (!validPattern.test(key)) {
    return err(
      new ValidationErrorClass(
        'Translation key must only contain letters, numbers, dots, hyphens, and underscores',
        'translationKey',
        key
      )
    )
  }

  return ok(createTranslationKey(key))
}

export function isSafePath(filePath: string): boolean {
  if (!filePath || typeof filePath !== 'string') {
    return false
  }

  if (path.isAbsolute(filePath)) {
    return false
  }

  const normalized = path.normalize(filePath).replace(/\\/g, '/')

  if (normalized.startsWith('~') || normalized.includes('..') || normalized.includes('\0')) {
    return false
  }

  return true
}

export function deepMerge<T extends Record<string, unknown>>(...sources: Partial<T>[]): T {
  const result = Object.create(null) as T
  const maxDepth = 10
  const globalVisited = new WeakSet<object>()

  function merge(
    target: Record<string, unknown>,
    source: Record<string, unknown>,
    depth = 0
  ): Record<string, unknown> {
    if (depth > maxDepth) {
      console.warn('[i18n] deepMerge: max depth exceeded')
      return target
    }

    if (typeof source === 'object' && source !== null) {
      if (globalVisited.has(source)) {
        console.warn('[i18n] deepMerge: circular reference detected')
        return target
      }
      globalVisited.add(source)
    }

    for (const key in source) {
      if (Object.prototype.hasOwnProperty.call(source, key)) {
        if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
          console.error(`[i18n] deepMerge: dangerous key detected and rejected: ${key}`)
          continue
        }

        const sourceValue = source[key]
        const targetValue = target[key]

        if (
          typeof sourceValue === 'object' &&
          sourceValue !== null &&
          !Array.isArray(sourceValue) &&
          typeof targetValue === 'object' &&
          targetValue !== null &&
          !Array.isArray(targetValue)
        ) {
          target[key] = merge(
            targetValue as Record<string, unknown>,
            sourceValue as Record<string, unknown>,
            depth + 1
          )
        } else {
          target[key] = sourceValue
        }
      }
    }

    return target
  }

  for (const source of sources) {
    if (!source) continue
    merge(result, source, 0)
  }

  return result
}

export function getAllLanguageNames(): Readonly<Record<string, string>> {
  return { ...LANGUAGE_NAMES }
}

export function isEmptyResource(resource: TranslationResource): boolean {
  return Object.keys(resource).length === 0
}

export function countKeys(resource: TranslationResource): number {
  let count = 0

  for (const key in resource) {
    if (Object.prototype.hasOwnProperty.call(resource, key)) {
      const value = resource[key]
      if (typeof value === 'string') {
        count++
      } else if (typeof value === 'object' && value !== null) {
        count += countKeys(value as TranslationResource)
      }
    }
  }

  return count
}

export function flattenResource(
  resource: TranslationResource,
  prefix = ''
): Record<string, string> {
  const result: Record<string, string> = {}

  for (const key in resource) {
    if (Object.prototype.hasOwnProperty.call(resource, key)) {
      const value = resource[key]
      const fullKey = prefix ? `${prefix}.${key}` : key

      if (typeof value === 'string') {
        result[fullKey] = value
      } else if (typeof value === 'object' && value !== null) {
        Object.assign(result, flattenResource(value as TranslationResource, fullKey))
      }
    }
  }

  return result
}

export function unflattenResource(flat: Record<string, string>): TranslationResource {
  const result: TranslationResource = {}

  for (const key in flat) {
    if (Object.prototype.hasOwnProperty.call(flat, key)) {
      const value = flat[key]
      const keys = key.split('.')
      let current: Record<string, unknown> = result

      for (let i = 0; i < keys.length - 1; i++) {
        const k = keys[i]
        if (!(k in current)) {
          current[k] = {}
        }
        current = current[k] as Record<string, unknown>
      }

      current[keys[keys.length - 1]] = value
    }
  }

  return result
}
