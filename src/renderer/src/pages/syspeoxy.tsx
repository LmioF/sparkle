import { Button, Input, Switch, Tab, Tabs, Tooltip } from '@heroui/react'
import BasePage from '@renderer/components/base/base-page'
import SettingCard from '@renderer/components/base/base-setting-card'
import SettingItem from '@renderer/components/base/base-setting-item'
import EditableList from '@renderer/components/base/base-list-editor'
import PacEditorModal from '@renderer/components/sysproxy/pac-editor-modal'
import { useAppConfig } from '@renderer/hooks/use-app-config'
import { platform } from '@renderer/utils/init'
import { getAppConfig, openUWPTool, serviceStatus, triggerSysProxy } from '@renderer/utils/ipc'
import React, { Key, useEffect, useState } from 'react'
import ByPassEditorModal from '@renderer/components/sysproxy/bypass-editor-modal'
import { IoIosHelpCircle } from 'react-icons/io'
import { useTranslation } from '@renderer/hooks/useTranslation'
import { notify } from '@renderer/utils/notification'

const defaultPacScript = `
function FindProxyForURL(url, host) {
  return "PROXY 127.0.0.1:%mixed-port%; SOCKS5 127.0.0.1:%mixed-port%; DIRECT;";
}
`

const Sysproxy: React.FC = () => {
  const { t } = useTranslation('sysproxy')
  const defaultBypass: string[] =
    platform === 'linux'
      ? [
          'localhost',
          '.local',
          '127.0.0.1/8',
          '192.168.0.0/16',
          '10.0.0.0/8',
          '172.16.0.0/12',
          '::1'
        ]
      : platform === 'darwin'
        ? [
            '127.0.0.1/8',
            '192.168.0.0/16',
            '10.0.0.0/8',
            '172.16.0.0/12',
            'localhost',
            '*.local',
            '*.crashlytics.com',
            '<local>'
          ]
        : [
            'localhost',
            '127.*',
            '192.168.*',
            '10.*',
            '172.16.*',
            '172.17.*',
            '172.18.*',
            '172.19.*',
            '172.20.*',
            '172.21.*',
            '172.22.*',
            '172.23.*',
            '172.24.*',
            '172.25.*',
            '172.26.*',
            '172.27.*',
            '172.28.*',
            '172.29.*',
            '172.30.*',
            '172.31.*',
            '<local>'
          ]

  const { appConfig, patchAppConfig, mutateAppConfig } = useAppConfig()
  const { sysProxy, onlyActiveDevice = false } =
    appConfig || ({ sysProxy: { enable: false } } as AppConfig)
  const [changed, setChanged] = useState(false)
  const [values, originSetValues] = useState({
    enable: sysProxy.enable,
    host: sysProxy.host ?? '',
    bypass: sysProxy.bypass ?? defaultBypass,
    mode: sysProxy.mode ?? 'manual',
    pacScript: sysProxy.pacScript ?? defaultPacScript,
    settingMode: sysProxy.settingMode ?? 'exec',
    guard: sysProxy.guard ?? false,
    guardNotify: sysProxy.guardNotify ?? false
  })
  const syncValuesFromSysProxy = (nextSysProxy: AppConfig['sysProxy']): void => {
    originSetValues((prev) => ({
      ...prev,
      enable: nextSysProxy.enable,
      host: nextSysProxy.host ?? '',
      bypass: nextSysProxy.bypass ?? defaultBypass,
      mode: nextSysProxy.mode ?? 'manual',
      pacScript: nextSysProxy.pacScript ?? defaultPacScript,
      settingMode: nextSysProxy.settingMode ?? 'exec',
      guard: nextSysProxy.guard ?? false,
      guardNotify: nextSysProxy.guardNotify ?? false
    }))
  }
  useEffect(() => {
    syncValuesFromSysProxy(sysProxy)
  }, [sysProxy])
  const [openEditor, setOpenEditor] = useState(false)
  const [openPacEditor, setOpenPacEditor] = useState(false)

  const setValues = (v: typeof values): void => {
    originSetValues(v)
    setChanged(true)
  }
  const validateHost = (host: string): boolean => {
    if (!host) return true
    const ipMatch = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/)
    if (ipMatch) {
      return ipMatch.slice(1).every((octet) => {
        const num = parseInt(octet, 10)
        return num >= 0 && num <= 255
      })
    }
    const hostnameRegex =
      /^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?)*$|^[a-zA-Z0-9]$/
    return hostnameRegex.test(host)
  }

  const validateBypass = (bypass: string[]): boolean => {
    if (!bypass || bypass.length === 0) return true
    const bypassRegex =
      /^(\*\.)?[a-zA-Z0-9*.-]+(\.\*)?$|^\.[a-zA-Z0-9-]+$|^(\d{1,3}\.){3}\d{1,3}(\/\d{1,2})?$|^\d{1,3}\.\*$|^(\d{1,3}\.){2}\*$|^(\d{1,3}\.){3}\*$|^<[a-z]+>$|^::1$/
    return bypass.every(
      (item) => typeof item === 'string' && item.trim().length > 0 && bypassRegex.test(item.trim())
    )
  }

  const validatePacScript = (script: string): boolean => {
    if (!script) return false
    return /function\s+FindProxyForURL\s*\(/.test(script)
  }

  const normalizeServiceModeValues = async (): Promise<typeof values> => {
    if (values.settingMode !== 'service') {
      return values
    }

    const status = await serviceStatus().catch(() => 'unknown' as const)
    if (status === 'running') {
      return values
    }

    notify(t('serviceUnavailableFallback'))
    const nextValues = {
      ...values,
      settingMode: 'exec' as const,
      guard: false,
      guardNotify: false
    }
    originSetValues(nextValues)
    return nextValues
  }

  const onSave = async (): Promise<void> => {
    if (!validateHost(values.host)) {
      notify(t('hostInvalid'), { variant: 'danger' })
      return
    }

    if (!validateBypass(values.bypass)) {
      notify(t('bypassInvalid'), { variant: 'danger' })
      return
    }

    if (values.mode === 'auto' && !validatePacScript(values.pacScript)) {
      notify(t('pacInvalid'), { variant: 'danger' })
      return
    }

    const normalizedValues = await normalizeServiceModeValues()
    const saveValues = {
      ...normalizedValues,
      host: normalizedValues.host || '127.0.0.1',
      bypass: normalizedValues.bypass.map((item) => item.trim())
    }

    const nextConfig =
      (await patchAppConfig({ sysProxy: saveValues })) ?? (await getAppConfig(true))
    syncValuesFromSysProxy(nextConfig.sysProxy)
    mutateAppConfig()
    setChanged(false)
    if (nextConfig.sysProxy.enable) {
      try {
        await triggerSysProxy(nextConfig.sysProxy.enable, onlyActiveDevice)
      } catch (e) {
        notify(e, { variant: 'danger' })
        await patchAppConfig({ sysProxy: { enable: false } })
      }
    }
  }

  return (
    <BasePage
      title={t('title')}
      contentClassName="no-scrollbar"
      header={
        changed && (
          <Button color="primary" className="app-nodrag" size="sm" onPress={onSave}>
            {t('common:actions.save')}
          </Button>
        )
      }
    >
      {openPacEditor && (
        <PacEditorModal
          script={values.pacScript || defaultPacScript}
          onCancel={() => setOpenPacEditor(false)}
          onConfirm={(script: string) => {
            setValues({ ...values, pacScript: script })
            setOpenPacEditor(false)
          }}
        />
      )}
      {openEditor && (
        <ByPassEditorModal
          bypass={values.bypass}
          onCancel={() => setOpenEditor(false)}
          onConfirm={async (list: string[]) => {
            setOpenEditor(false)
            setValues({
              ...values,
              bypass: list
            })
          }}
        />
      )}
      <SettingCard className="sysproxy-settings">
        <SettingItem title={t('host')} divider>
          <Input
            size="sm"
            className="w-[50%]"
            value={values.host}
            placeholder={t('hostPlaceholder')}
            onValueChange={(v) => {
              setValues({ ...values, host: v })
            }}
          />
        </SettingItem>
        <SettingItem title={t('mode')} divider>
          <Tabs
            size="sm"
            color="primary"
            selectedKey={values.mode}
            onSelectionChange={(key: Key) => setValues({ ...values, mode: key as SysProxyMode })}
          >
            <Tab key="manual" title={t('modeManual')} />
            <Tab key="auto" title={t('modeAuto')} />
          </Tabs>
        </SettingItem>
        {platform === 'win32' && (
          <SettingItem title={t('uwpTool')} divider>
            <Button
              size="sm"
              onPress={async () => {
                await openUWPTool()
              }}
            >
              {t('openUwpTool')}
            </Button>
          </SettingItem>
        )}
        <SettingItem title={t('setMethod')} divider>
          <Tabs
            size="sm"
            color="primary"
            selectedKey={values.settingMode}
            onSelectionChange={(key) => {
              const settingMode = key as 'exec' | 'service'
              setValues({
                ...values,
                settingMode,
                guard: settingMode === 'service' ? values.guard : false,
                guardNotify: settingMode === 'service' ? values.guardNotify : false
              })
            }}
          >
            <Tab key="exec" title={t('setMethodExec')} />
            <Tab key="service" title={t('setMethodService')} />
          </Tabs>
        </SettingItem>
        {platform !== 'linux' && values.settingMode === 'service' && (
          <SettingItem
            title={t('activeInterfaceOnly')}
            actions={
              <Tooltip
                content={
                  <>
                    <div>{t('activeInterfaceOnlyTip')}</div>
                  </>
                }
              >
                <Button isIconOnly size="sm" variant="light">
                  <IoIosHelpCircle className="text-lg" />
                </Button>
              </Tooltip>
            }
            divider
          >
            <Switch
              size="sm"
              isSelected={onlyActiveDevice}
              isDisabled={!values.settingMode || values.settingMode !== 'service'}
              onValueChange={(v) => {
                patchAppConfig({ onlyActiveDevice: v })
              }}
            />
          </SettingItem>
        )}
        {values.settingMode === 'service' && (
          <SettingItem
            compatKey="legacy"
            title={t('guard')}
            actions={
              <Tooltip content={<div>{t('guardTip')}</div>}>
                <Button isIconOnly size="sm" variant="light">
                  <IoIosHelpCircle className="text-lg" />
                </Button>
              </Tooltip>
            }
            divider
          >
            <Switch
              size="sm"
              isSelected={values.guard}
              onValueChange={(v) => {
                setValues({ ...values, guard: v, guardNotify: v ? values.guardNotify : false })
              }}
            />
          </SettingItem>
        )}
        {values.settingMode === 'service' && values.guard && (
          <SettingItem
            compatKey="legacy"
            title={t('guardNotify')}
            actions={
              <Tooltip content={<div>{t('guardNotifyTip')}</div>}>
                <Button isIconOnly size="sm" variant="light">
                  <IoIosHelpCircle className="text-lg" />
                </Button>
              </Tooltip>
            }
            divider
          >
            <Switch
              size="sm"
              isSelected={values.guardNotify}
              isDisabled={!values.guard}
              onValueChange={(v) => {
                setValues({ ...values, guardNotify: v })
              }}
            />
          </SettingItem>
        )}
        {values.mode === 'auto' && (
          <SettingItem title={t('mode')}>
            <Button size="sm" onPress={() => setOpenPacEditor(true)}>
              {t('editPac')}
            </Button>
          </SettingItem>
        )}
        {values.mode === 'manual' && (
          <>
            <SettingItem title={t('addDefaultBypass')} divider>
              <Button
                size="sm"
                onPress={() => {
                  setValues({
                    ...values,
                    bypass: Array.from(new Set([...defaultBypass, ...values.bypass]))
                  })
                }}
              >
                {t('addDefaultBypass')}
              </Button>
            </SettingItem>
            <SettingItem title={t('bypassList')}>
              <Button
                size="sm"
                onPress={async () => {
                  setOpenEditor(true)
                }}
              >
                {t('common:actions.edit')}
              </Button>
            </SettingItem>
            <EditableList
              items={values.bypass}
              onChange={(list) => setValues({ ...values, bypass: list as string[] })}
              placeholder={t('bypassPlaceholder')}
              divider={false}
            />
          </>
        )}
      </SettingCard>
    </BasePage>
  )
}

export default Sysproxy
