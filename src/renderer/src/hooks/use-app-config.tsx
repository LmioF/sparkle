import React, { createContext, useContext, ReactNode, useRef } from 'react'
import useSWR from 'swr'
import { getAppConfig, patchAppConfig as patch } from '@renderer/utils/ipc'
import {
  getSystemCorePaths,
  getSystemCorePathsCache,
  isSystemCorePathsLoading
} from '@renderer/utils/system-core'
import { notify } from '@renderer/utils/notification'

interface AppConfigContextType {
  appConfig: AppConfig | undefined
  mutateAppConfig: () => void
  patchAppConfig: (value: Partial<AppConfig>) => Promise<AppConfig | undefined>
}

const AppConfigContext = createContext<AppConfigContextType | undefined>(undefined)

export const AppConfigProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { data: appConfig, mutate: mutateAppConfig } = useSWR('getConfig', () => getAppConfig())
  const systemCorePreloaded = useRef(false)

  React.useEffect(() => {
    if (
      appConfig?.core === 'system' &&
      !systemCorePreloaded.current &&
      getSystemCorePathsCache() === null &&
      !isSystemCorePathsLoading()
    ) {
      systemCorePreloaded.current = true
      getSystemCorePaths().catch(() => {})
    }
  }, [appConfig?.core])

  const patchAppConfig = async (value: Partial<AppConfig>): Promise<AppConfig | undefined> => {
    try {
      const nextConfig = await patch(value)
      mutateAppConfig(nextConfig, false)
      return nextConfig
    } catch (e) {
      notify(e, { variant: 'danger' })
      return undefined
    } finally {
      mutateAppConfig()
    }
  }

  React.useEffect(() => {
    const unsubAppConfigUpdated = window.electron.ipcRenderer.on('appConfigUpdated', () => {
      mutateAppConfig()
    })
    return (): void => {
      unsubAppConfigUpdated()
    }
  }, [mutateAppConfig])

  return (
    <AppConfigContext.Provider value={{ appConfig, mutateAppConfig, patchAppConfig }}>
      {children}
    </AppConfigContext.Provider>
  )
}

export const useAppConfig = (): AppConfigContextType => {
  const context = useContext(AppConfigContext)
  if (context === undefined) {
    throw new Error('useAppConfig must be used within an AppConfigProvider')
  }
  return context
}
