import { Button, Select, SelectItem, Switch, Tab, Tabs } from '@heroui/react'
import BasePage from '@renderer/components/base/base-page'
import SettingCard from '@renderer/components/base/base-setting-card'
import SettingItem from '@renderer/components/base/base-setting-item'
import PermissionModal from '@renderer/components/mihomo/permission-modal'
import ServiceModal from '@renderer/components/mihomo/service-modal'
import { useAppConfig } from '@renderer/hooks/use-app-config'
import { useControledMihomoConfig } from '@renderer/hooks/use-controled-mihomo-config'
import PortSetting from '@renderer/components/mihomo/port-setting'
import { platform } from '@renderer/utils/init'
import { IoMdCloudDownload } from 'react-icons/io'
import PubSub from 'pubsub-js'
import {
  manualGrantCorePermition,
  mihomoUpgrade,
  restartCore,
  revokeCorePermission,
  deleteElevateTask,
  installService,
  uninstallService,
  startService,
  initService,
  restartService
} from '@renderer/utils/ipc'
import React, { useState, useEffect } from 'react'
import ControllerSetting from '@renderer/components/mihomo/controller-setting'
import EnvSetting from '@renderer/components/mihomo/env-setting'
import AdvancedSetting from '@renderer/components/mihomo/advanced-settings'
import LogSetting from '@renderer/components/mihomo/log-setting'
import { getSystemCorePaths, getSystemCorePathsCache } from '@renderer/utils/system-core'
import { useTranslation } from '@renderer/hooks/useTranslation'

const Mihomo: React.FC = () => {
  const { t } = useTranslation('mihomo')
  const { appConfig, patchAppConfig } = useAppConfig()
  const {
    core = 'mihomo',
    corePermissionMode = 'elevated',
    coreStartupMode = 'post-up',
    mihomoCpuPriority = 'PRIORITY_NORMAL'
  } = appConfig || {}
  const { controledMihomoConfig, patchControledMihomoConfig } = useControledMihomoConfig()
  const { ipv6 } = controledMihomoConfig || {}

  const [upgrading, setUpgrading] = useState(false)
  const [showPermissionModal, setShowPermissionModal] = useState(false)
  const [showServiceModal, setShowServiceModal] = useState(false)
  const [systemCorePaths, setSystemCorePaths] = useState<string[]>(getSystemCorePathsCache() || [])
  const [loadingPaths, setLoadingPaths] = useState(false)

  useEffect(() => {
    if (core !== 'system') return
    const cached = getSystemCorePathsCache()
    if (cached !== null) {
      setSystemCorePaths(cached)
      return
    }

    setLoadingPaths(true)
    getSystemCorePaths()
      .then(setSystemCorePaths)
      .finally(() => setLoadingPaths(false))
  }, [core])

  const onChangeNeedRestart = async (patch: Partial<MihomoConfig>): Promise<void> => {
    await patchControledMihomoConfig(patch)
    await restartCore()
  }

  const handleConfigChangeWithRestart = async (key: string, value: unknown): Promise<void> => {
    try {
      await patchAppConfig({ [key]: value })
      await restartCore()
      PubSub.publish('mihomo-core-changed')
    } catch (e) {
      alert(e)
    }
  }

  const handleCoreUpgrade = async (): Promise<void> => {
    try {
      setUpgrading(true)
      await mihomoUpgrade(core === 'mihomo' ? 'release' : 'alpha')
      setTimeout(() => PubSub.publish('mihomo-core-changed'), 2000)
    } catch (e) {
      if (typeof e === 'string' && e.includes('already using latest version')) {
        new Notification(t('alreadyLatest'))
      } else {
        alert(e)
      }
    } finally {
      setUpgrading(false)
    }
  }

  const handleCoreChange = async (newCore: 'mihomo' | 'mihomo-alpha' | 'system'): Promise<void> => {
    if (newCore === 'system') {
      const paths = await getSystemCorePaths()

      if (paths.length === 0) {
        new Notification(t('coreNotFound'), {
          body: t('coreNotFoundDesc')
        })
        return
      }

      if (!appConfig?.systemCorePath || !paths.includes(appConfig.systemCorePath)) {
        await patchAppConfig({ systemCorePath: paths[0] })
      }
    }
    await handleConfigChangeWithRestart('core', newCore)
  }

  const handlePermissionModeChange = async (key: string): Promise<void> => {
    if (key === corePermissionMode) return

    try {
      await patchAppConfig({ corePermissionMode: key as 'elevated' | 'service' })
      await restartCore()
    } catch (e) {
      alert(e)
    }
  }

  return (
    <BasePage title={t('title')} contentClassName="no-scrollbar">
      {showPermissionModal && (
        <PermissionModal
          onChange={setShowPermissionModal}
          onRevoke={async () => {
            if (platform === 'win32') {
              await deleteElevateTask()
              new Notification(t('taskCanceled'))
            } else {
              await revokeCorePermission()
              new Notification(t('permissionRevoked'))
            }
            await restartCore()
          }}
          onGrant={async () => {
            await manualGrantCorePermition()
            new Notification(t('permissionGranted'))
            await restartCore()
          }}
        />
      )}
      {showServiceModal && (
        <ServiceModal
          onChange={setShowServiceModal}
          onInit={async () => {
            await initService()
            new Notification(t('serviceInitSuccess'))
          }}
          onInstall={async () => {
            await installService()
            new Notification(t('serviceInstallSuccess'))
          }}
          onUninstall={async () => {
            await uninstallService()
            new Notification(t('serviceUninstallSuccess'))
          }}
          onStart={async () => {
            await startService()
            new Notification(t('serviceStartSuccess'))
          }}
          onRestart={async () => {
            await restartService()
            new Notification(t('serviceRestartSuccess'))
          }}
        />
      )}
      <SettingCard>
        <SettingItem
          title={t('version')}
          actions={
            core === 'mihomo' || core === 'mihomo-alpha' ? (
              <Button
                size="sm"
                isIconOnly
                title={t('upgrade')}
                variant="light"
                isLoading={upgrading}
                onPress={handleCoreUpgrade}
              >
                <IoMdCloudDownload className="text-lg" />
              </Button>
            ) : null
          }
          divider
        >
          <Select
            aria-label="内核版本"
            classNames={{ trigger: 'data-[hover=true]:bg-default-200' }}
            className="w-37.5"
            size="sm"
            selectedKeys={new Set([core])}
            disallowEmptySelection={true}
            onSelectionChange={(v) =>
              handleCoreChange(v.currentKey as 'mihomo' | 'mihomo-alpha' | 'system')
            }
          >
            <SelectItem key="mihomo">{t('coreType.builtin')}</SelectItem>
            <SelectItem key="mihomo-alpha">{t('coreType.builtinAlpha')}</SelectItem>
            <SelectItem key="system">{t('coreType.system')}</SelectItem>
          </Select>
        </SettingItem>
        {core === 'system' && (
          <SettingItem title={t('systemCorePath')} divider>
            <Select
              aria-label="系统内核路径"
              classNames={{ trigger: 'data-[hover=true]:bg-default-200' }}
              className="w-87.5"
              size="sm"
              selectedKeys={new Set([appConfig?.systemCorePath || ''])}
              disallowEmptySelection={systemCorePaths.length > 0}
              isDisabled={loadingPaths}
              onSelectionChange={(v) => {
                const selectedPath = v.currentKey as string
                if (selectedPath) handleConfigChangeWithRestart('systemCorePath', selectedPath)
              }}
            >
              {loadingPaths ? (
                <SelectItem key="">{t('searchingCore')}</SelectItem>
              ) : systemCorePaths.length > 0 ? (
                systemCorePaths.map((path) => <SelectItem key={path}>{path}</SelectItem>)
              ) : (
                <SelectItem key="">{t('coreNotFoundShort')}</SelectItem>
              )}
            </Select>
            {!loadingPaths && systemCorePaths.length === 0 && (
              <div className="mt-2 text-sm text-warning">{t('coreNotFoundTip')}</div>
            )}
          </SettingItem>
        )}
        <SettingItem compatKey="legacy" title={t('settings:advanced.corePriority')} divider>
          <Select
            aria-label="内核进程优先级"
            classNames={{ trigger: 'data-[hover=true]:bg-default-200' }}
            className="w-37.5"
            size="sm"
            selectedKeys={new Set([mihomoCpuPriority])}
            disallowEmptySelection={true}
            onSelectionChange={async (v) => {
              try {
                await patchAppConfig({
                  mihomoCpuPriority: v.currentKey as Priority
                })
                await restartCore()
              } catch (e) {
                alert(e)
              }
            }}
          >
            <SelectItem key="PRIORITY_HIGHEST">
              {t('settings:advanced.priority.realtime')}
            </SelectItem>
            <SelectItem key="PRIORITY_HIGH">{t('settings:advanced.priority.high')}</SelectItem>
            <SelectItem key="PRIORITY_ABOVE_NORMAL">
              {t('settings:advanced.priority.aboveNormal')}
            </SelectItem>
            <SelectItem key="PRIORITY_NORMAL">{t('settings:advanced.priority.normal')}</SelectItem>
            <SelectItem key="PRIORITY_BELOW_NORMAL">
              {t('settings:advanced.priority.belowNormal')}
            </SelectItem>
            <SelectItem key="PRIORITY_LOW">{t('settings:advanced.priority.low')}</SelectItem>
          </Select>
        </SettingItem>
        <SettingItem compatKey="legacy" title={t('runMode')} divider>
          <Tabs
            size="sm"
            color="primary"
            selectedKey={corePermissionMode}
            onSelectionChange={(key) => handlePermissionModeChange(key as string)}
          >
            <Tab
              key="elevated"
              title={platform === 'win32' ? t('runModeElevated') : t('runModeAuth')}
            />
            <Tab key="service" title={t('runModeService')} />
          </Tabs>
        </SettingItem>

        {corePermissionMode !== 'service' && (
          <SettingItem compatKey="legacy" title={t('startupDetectionMode')} divider>
            <Tabs
              size="sm"
              color="primary"
              selectedKey={coreStartupMode}
              onSelectionChange={(key) => handleConfigChangeWithRestart('coreStartupMode', key)}
            >
              <Tab key="post-up" title={t('startupDetectionPostUp')} />
              <Tab key="log" title={t('startupDetectionLog')} />
            </Tabs>
          </SettingItem>
        )}
        <SettingItem
          compatKey="legacy"
          title={platform === 'win32' ? t('taskStatus') : t('authStatus')}
          divider
        >
          <Button size="sm" color="primary" onPress={() => setShowPermissionModal(true)}>
            {t('manage')}
          </Button>
        </SettingItem>
        <SettingItem compatKey="legacy" title={t('serviceStatus')} divider>
          <Button size="sm" color="primary" onPress={() => setShowServiceModal(true)}>
            {t('manage')}
          </Button>
        </SettingItem>
        <SettingItem compatKey="legacy" title={t('ipv6')} divider>
          <Switch
            size="sm"
            isSelected={ipv6}
            onValueChange={(v) => onChangeNeedRestart({ ipv6: v })}
          />
        </SettingItem>
      </SettingCard>
      <PortSetting />
      <ControllerSetting />
      <EnvSetting />
      <LogSetting />
      <AdvancedSetting />
    </BasePage>
  )
}

export default Mihomo
