import * as React from 'react'
import { useTranslation as useI18nextTranslation } from 'react-i18next'
import { useMemo, useCallback } from 'react'
import type { TFunction } from 'i18next'
import { useI18nContext } from '../i18n/context'
import type { LanguageCode, Namespace } from '../../../shared/i18n/types'
import { createLanguageCode } from '../../../shared/i18n/types'

export type TranslationSelector<T = unknown> = (t: TFunction) => T

export interface UseTranslationResult<T = TFunction> {
  t: T

  i18n: ReturnType<typeof useI18nextTranslation>['i18n']

  ready: boolean

  language: LanguageCode

  changeLanguage: (lng: LanguageCode) => Promise<void>
}

export function useTranslation(namespace?: Namespace | string): UseTranslationResult<TFunction>

export function useTranslation<T>(
  namespace?: Namespace | string,
  selector?: TranslationSelector<T>
): UseTranslationResult<T>

export function useTranslation<T = TFunction>(
  namespace: Namespace | string = 'common',
  selector?: TranslationSelector<T>
): UseTranslationResult<T | TFunction> {
  const {
    ready: contextReady,
    language: contextLanguage,
    changeLanguage: contextChangeLanguage
  } = useI18nContext()

  const { t, i18n, ready: i18nextReady } = useI18nextTranslation(namespace as string)

  const ready = contextReady && i18nextReady

  const language = useMemo(
    () => contextLanguage || createLanguageCode(i18n.language),
    [contextLanguage, i18n.language]
  )

  const selected = useMemo(() => {
    if (!ready) {
      return selector ? (undefined as T) : (t as TFunction)
    }
    return selector ? selector(t) : (t as TFunction)
  }, [t, ready, selector])

  const changeLanguage = useCallback(
    async (lng: LanguageCode) => {
      if (contextChangeLanguage) {
        await contextChangeLanguage(lng)
      } else {
        await i18n.changeLanguage(lng)
      }
    },
    [contextChangeLanguage, i18n]
  )

  return {
    t: selected as T | TFunction,
    i18n,
    ready,
    language,
    changeLanguage
  }
}

export function useNamespaceTranslation(namespace: Namespace | string) {
  const { t, i18n, ready } = useTranslation(namespace)
  const [loading, setLoading] = React.useState(!ready)
  const [error, setError] = React.useState<Error | null>(null)

  React.useEffect(() => {
    if (ready) {
      setLoading(false)
      return
    }

    const loadNamespace = async () => {
      try {
        setLoading(true)
        setError(null)
        await i18n.loadNamespaces(namespace as string)
        setLoading(false)
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Failed to load namespace')
        setError(error)
        setLoading(false)
      }
    }

    loadNamespace()
  }, [namespace, ready, i18n])

  return {
    t,
    i18n,
    ready,
    loading,
    error
  }
}

export function useTranslationKey(key: string, namespace: Namespace | string = 'common'): string {
  const { t, ready } = useTranslation(namespace, (t) => t(key))

  return ready ? (t as string) : key
}

export function useTranslationKeyWithParams(
  key: string,
  params: Record<string, unknown>,
  namespace: Namespace | string = 'common'
): string {
  const { t, ready } = useTranslation(namespace, (t) => t(key, params))

  return ready ? (t as string) : key
}
