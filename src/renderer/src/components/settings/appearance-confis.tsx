import React, { useEffect, useState, useRef } from 'react'
import SettingCard from '../base/base-setting-card'
import SettingItem from '../base/base-setting-item'
import { Button, Select, SelectItem, Switch, Tab, Tabs, Tooltip } from '@heroui/react'
import { BiSolidFileImport } from 'react-icons/bi'
import {
  applyTheme,
  closeFloatingWindow,
  closeTrayIcon,
  fetchThemes,
  getFilePath,
  importThemes,
  readImageFileDataURL,
  relaunchApp,
  resolveThemes,
  setDockVisible,
  showFloatingWindow,
  showTrayIcon,
  startMonitor,
  updateTrayIcon,
  writeTheme
} from '@renderer/utils/ipc'
import { useAppConfig } from '@renderer/hooks/use-app-config'
import { useTranslation } from '@renderer/hooks/useTranslation'
import { platform } from '@renderer/utils/init'
import { useTheme } from 'next-themes'
import { IoIosHelpCircle, IoMdCloudDownload } from 'react-icons/io'
import { MdEditDocument } from 'react-icons/md'
import CSSEditorModal from './css-editor-modal'
import { LanguageSwitcher } from './language-switcher'
import TrayIconCropModal from './tray-icon-crop-modal'

const rasterTrayIconPattern = /\.(png|jpe?g|webp)$/i

const AppearanceConfig: React.FC = () => {
  const { t } = useTranslation('settings')
  const { appConfig, patchAppConfig } = useAppConfig()
  const [customThemes, setCustomThemes] = useState<{ key: string; label: string }[]>()
  const [openCSSEditor, setOpenCSSEditor] = useState(false)
  const [trayIconCropDataURL, setTrayIconCropDataURL] = useState('')
  const [fetching, setFetching] = useState(false)
  const { setTheme } = useTheme()
  const {
    useDockIcon = true,
    showTraffic = false,
    proxyInTray = true,
    trayProxyDelayLayout = 'auto',
    customTrayIcon = '',
    disableTray = false,
    showFloatingWindow: showFloating = false,
    spinFloatingIcon = true,
    useWindowFrame = false,
    customTheme = 'default.css',
    appTheme = 'system'
  } = appConfig || {}
  const [localShowFloating, setLocalShowFloating] = useState(showFloating)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)
  const isMountedRef = useRef(true)

  useEffect(() => {
    resolveThemes().then((themes) => {
      setCustomThemes(themes)
    })
  }, [])

  useEffect(() => {
    return (): void => {
      isMountedRef.current = false
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [])

  return (
    <>
      {openCSSEditor && (
        <CSSEditorModal
          theme={customTheme}
          onCancel={() => setOpenCSSEditor(false)}
          onConfirm={async (css: string) => {
            await writeTheme(customTheme, css)
            await applyTheme(customTheme)
            setOpenCSSEditor(false)
          }}
        />
      )}
      {trayIconCropDataURL && (
        <TrayIconCropModal
          imageDataURL={trayIconCropDataURL}
          onCancel={() => setTrayIconCropDataURL('')}
          onConfirm={async (dataURL) => {
            await patchAppConfig({ customTrayIcon: dataURL })
            setTrayIconCropDataURL('')
            await updateTrayIcon()
          }}
        />
      )}
      <SettingCard header={t('appearance.title')}>
        <SettingItem
          title={t('appearance.language')}
          divider
          /* 暂时隐藏打开自定义语言目录的按钮
          actions={
            <Tooltip content={t('appearance.openCustomLocalesDir')}>
              <Button
                size="sm"
                isIconOnly
                variant="light"
                onPress={async () => {
                  try {
                    await openCustomLocalesDir()
                  } catch (e) {
                    alert(e)
                  }
                }}
              >
                <FaFolderOpen className="text-lg" />
              </Button>
            </Tooltip>
          }
          */
        >
          <LanguageSwitcher />
        </SettingItem>
        <SettingItem
          title={t('appearance.showFloatingWindow')}
          actions={
            <Tooltip content={t('appearance.showFloatingWindowTip')}>
              <Button isIconOnly size="sm" variant="light">
                <IoIosHelpCircle className="text-lg" />
              </Button>
            </Tooltip>
          }
          divider
        >
          <Switch
            size="sm"
            isSelected={localShowFloating}
            onValueChange={async (v) => {
              if (timeoutRef.current) {
                clearTimeout(timeoutRef.current)
                timeoutRef.current = null
              }

              setLocalShowFloating(v)
              if (v) {
                await showFloatingWindow()
                timeoutRef.current = setTimeout(async () => {
                  if (isMountedRef.current) {
                    await patchAppConfig({ showFloatingWindow: v })
                  }
                  timeoutRef.current = null
                }, 1000)
              } else {
                patchAppConfig({ showFloatingWindow: v })
                await closeFloatingWindow()
              }
            }}
          />
        </SettingItem>
        {localShowFloating && (
          <>
            <SettingItem title={t('appearance.spinFloatingIcon')} divider>
              <Switch
                size="sm"
                isSelected={spinFloatingIcon}
                onValueChange={async (v) => {
                  await patchAppConfig({ spinFloatingIcon: v })
                  window.electron.ipcRenderer.send('updateFloatingWindow')
                }}
              />
            </SettingItem>
            <SettingItem title={t('appearance.disableTray')} divider>
              <Switch
                size="sm"
                isSelected={disableTray}
                onValueChange={async (v) => {
                  await patchAppConfig({ disableTray: v })
                  if (v) {
                    closeTrayIcon()
                  } else {
                    showTrayIcon()
                  }
                }}
              />
            </SettingItem>
          </>
        )}
        {!disableTray && (
          <SettingItem
            compatKey="legacy"
            title={t('appearance.customTrayIcon')}
            actions={
              <Tooltip content={t('appearance.customTrayIconTip')}>
                <Button isIconOnly size="sm" variant="light">
                  <IoIosHelpCircle className="text-lg" />
                </Button>
              </Tooltip>
            }
            divider
          >
            <div className="flex min-w-0 max-w-[65%] items-center justify-end gap-2">
              {customTrayIcon && (
                <span className="truncate text-xs text-default-500">
                  {customTrayIcon.startsWith('data:image/')
                    ? t('appearance.customTrayIconStored')
                    : customTrayIcon}
                </span>
              )}
              <Button
                size="sm"
                variant="flat"
                onPress={async () => {
                  const files = await getFilePath(
                    ['png', 'jpg', 'jpeg', 'webp', 'ico', 'icns'],
                    t('appearance.trayIconFileDialogTitle'),
                    t('appearance.trayIconFileFilter')
                  )
                  if (!files?.[0]) return
                  if (rasterTrayIconPattern.test(files[0])) {
                    setTrayIconCropDataURL(await readImageFileDataURL(files[0]))
                    return
                  }
                  await patchAppConfig({ customTrayIcon: files[0] })
                  await updateTrayIcon()
                }}
              >
                {customTrayIcon
                  ? t('appearance.customTrayIconChange')
                  : t('appearance.customTrayIconChoose')}
              </Button>
              {customTrayIcon && (
                <Button
                  size="sm"
                  variant="light"
                  onPress={async () => {
                    await patchAppConfig({ customTrayIcon: '' })
                    await updateTrayIcon()
                  }}
                >
                  {t('appearance.customTrayIconReset')}
                </Button>
              )}
            </div>
          </SettingItem>
        )}
        {platform !== 'linux' && (
          <>
            <SettingItem title={t('appearance.proxyInTray')} divider>
              <Switch
                size="sm"
                isSelected={proxyInTray}
                onValueChange={async (v) => {
                  await patchAppConfig({ proxyInTray: v })
                }}
              />
            </SettingItem>
            {proxyInTray && (
              <SettingItem title={t('appearance.trayProxyDelayLayout')} divider>
                <Tabs
                  size="sm"
                  color="primary"
                  selectedKey={trayProxyDelayLayout}
                  onSelectionChange={async (v) => {
                    await patchAppConfig({
                      trayProxyDelayLayout: v as 'same-line' | 'new-line'
                    })
                    window.electron.ipcRenderer.send('updateTrayMenu')
                  }}
                >
                  <Tab key="same-line" title={t('appearance.trayProxyDelaySameLine')} />
                  <Tab key="new-line" title={t('appearance.trayProxyDelayNewLine')} />
                </Tabs>
              </SettingItem>
            )}
            <SettingItem
              title={
                platform === 'win32'
                  ? t('appearance.showTrafficTaskbar')
                  : t('appearance.showTrafficStatusbar')
              }
              divider
            >
              <Switch
                size="sm"
                isSelected={showTraffic}
                onValueChange={async (v) => {
                  await patchAppConfig({ showTraffic: v })
                  await startMonitor()
                }}
              />
            </SettingItem>
          </>
        )}
        {platform === 'darwin' && (
          <>
            <SettingItem title={t('appearance.useDockIcon')} divider>
              <Switch
                size="sm"
                isSelected={useDockIcon}
                onValueChange={async (v) => {
                  await patchAppConfig({ useDockIcon: v })
                  setDockVisible(v)
                }}
              />
            </SettingItem>
          </>
        )}
        <SettingItem title={t('appearance.useWindowFrame')} divider>
          <Switch
            size="sm"
            isSelected={useWindowFrame}
            onValueChange={async (v) => {
              await patchAppConfig({ useWindowFrame: v })
              await relaunchApp()
            }}
          />
        </SettingItem>
        <SettingItem title={t('appearance.theme')} divider>
          <Tabs
            size="sm"
            color="primary"
            selectedKey={appTheme}
            onSelectionChange={(key) => {
              setTheme(key.toString())
              patchAppConfig({ appTheme: key as AppTheme })
            }}
          >
            <Tab key="system" title={t('appearance.themeAuto')} />
            <Tab key="dark" title={t('appearance.themeDark')} />
            <Tab key="light" title={t('appearance.themeLight')} />
          </Tabs>
        </SettingItem>
        <SettingItem
          title={t('appearance.customTheme')}
          actions={
            <>
              <Button
                size="sm"
                isLoading={fetching}
                isIconOnly
                title={t('appearance.fetchTheme')}
                variant="light"
                onPress={async () => {
                  setFetching(true)
                  try {
                    await fetchThemes()
                    setCustomThemes(await resolveThemes())
                  } catch (e) {
                    alert(e)
                  } finally {
                    setFetching(false)
                  }
                }}
              >
                <IoMdCloudDownload className="text-lg" />
              </Button>
              <Button
                size="sm"
                isIconOnly
                title={t('appearance.importTheme')}
                variant="light"
                onPress={async () => {
                  const files = await getFilePath(['css'])
                  if (!files) return
                  try {
                    await importThemes(files)
                    setCustomThemes(await resolveThemes())
                  } catch (e) {
                    alert(e)
                  }
                }}
              >
                <BiSolidFileImport className="text-lg" />
              </Button>
              <Button
                size="sm"
                isIconOnly
                title={t('appearance.editTheme')}
                variant="light"
                onPress={async () => {
                  setOpenCSSEditor(true)
                }}
              >
                <MdEditDocument className="text-lg" />
              </Button>
            </>
          }
        >
          {customThemes && (
            <Select
              classNames={{ trigger: 'data-[hover=true]:bg-default-200' }}
              className="w-[60%]"
              size="sm"
              selectedKeys={new Set([customTheme])}
              disallowEmptySelection={true}
              onSelectionChange={async (v) => {
                try {
                  await patchAppConfig({ customTheme: v.currentKey as string })
                } catch (e) {
                  alert(e)
                }
              }}
            >
              {customThemes.map((theme) => (
                <SelectItem key={theme.key}>{theme.label}</SelectItem>
              ))}
            </Select>
          )}
        </SettingItem>
      </SettingCard>
    </>
  )
}

export default AppearanceConfig
