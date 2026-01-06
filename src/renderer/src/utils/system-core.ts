import { findSystemMihomo } from '@renderer/utils/ipc'

let systemCorePathsCache: string[] | null = null
let cachePromise: Promise<string[]> | null = null

export const getSystemCorePaths = async (): Promise<string[]> => {
  if (systemCorePathsCache !== null) return systemCorePathsCache
  if (cachePromise !== null) return cachePromise

  cachePromise = findSystemMihomo()
    .then((paths) => {
      systemCorePathsCache = paths
      cachePromise = null
      return paths
    })
    .catch(() => {
      cachePromise = null
      return []
    })

  return cachePromise
}

export const getSystemCorePathsCache = (): string[] | null => systemCorePathsCache

export const isSystemCorePathsLoading = (): boolean => cachePromise !== null
