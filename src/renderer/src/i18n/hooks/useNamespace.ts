import { useState, useEffect, useCallback } from 'react'
import { useI18nContext } from '../context'
import type { Namespace } from '../../../../shared/i18n/types'

export interface UseNamespaceResult {
  loading: boolean

  loaded: boolean

  error: Error | null

  reload: () => Promise<void>
}

export function useNamespace(namespace: Namespace | string): UseNamespaceResult {
  const { i18n, ready } = useI18nContext()

  const [loading, setLoading] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const loadNamespace = useCallback(async () => {
    if (!i18n || !ready) {
      return
    }

    try {
      setLoading(true)
      setError(null)

      if (i18n.hasLoadedNamespace(namespace as string)) {
        setLoaded(true)
        setLoading(false)
        return
      }

      await i18n.loadNamespaces(namespace as string)
      setLoaded(true)
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to load namespace')
      setError(error)
      console.error(`[useNamespace] Failed to load namespace: ${namespace}`, error)
    } finally {
      setLoading(false)
    }
  }, [i18n, ready, namespace])

  useEffect(() => {
    loadNamespace()
  }, [loadNamespace])

  return {
    loading,
    loaded,
    error,
    reload: loadNamespace
  }
}

export function useNamespaces(namespaces: (Namespace | string)[]): UseNamespaceResult {
  const { i18n, ready } = useI18nContext()

  const [loading, setLoading] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const loadNamespaces = useCallback(async () => {
    if (!i18n || !ready || namespaces.length === 0) {
      return
    }

    try {
      setLoading(true)
      setError(null)

      const namespacesToLoad = namespaces.filter((ns) => !i18n.hasLoadedNamespace(ns as string))

      if (namespacesToLoad.length === 0) {
        setLoaded(true)
        setLoading(false)
        return
      }

      await Promise.all(namespacesToLoad.map((ns) => i18n.loadNamespaces(ns as string)))

      setLoaded(true)
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to load namespaces')
      setError(error)
      console.error('[useNamespaces] Failed to load namespaces:', namespaces, error)
    } finally {
      setLoading(false)
    }
  }, [i18n, ready, namespaces])

  useEffect(() => {
    loadNamespaces()
  }, [loadNamespaces])

  return {
    loading,
    loaded,
    error,
    reload: loadNamespaces
  }
}

export function useLazyNamespace(namespace: Namespace | string) {
  const { i18n, ready } = useI18nContext()

  const [loading, setLoading] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const load = useCallback(async () => {
    if (!i18n || !ready) {
      throw new Error('i18n not ready')
    }

    if (loaded) {
      return
    }

    try {
      setLoading(true)
      setError(null)

      if (i18n.hasLoadedNamespace(namespace as string)) {
        setLoaded(true)
        setLoading(false)
        return
      }

      await i18n.loadNamespaces(namespace as string)
      setLoaded(true)
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to load namespace')
      setError(error)
      console.error(`[useLazyNamespace] Failed to load namespace: ${namespace}`, error)
      throw error
    } finally {
      setLoading(false)
    }
  }, [i18n, ready, namespace, loaded])

  return {
    loading,
    loaded,
    error,
    load
  }
}
