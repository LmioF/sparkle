import { Drawer, Input, InputGroup, ListBox, Select, Switch } from '@heroui-v3/react'
import React, { useState, useEffect, useRef } from 'react'
import SettingItem from '../base/base-setting-item'
import { SettingTabs, settingItemProps } from '../base/base-controls'
import { useAppConfig } from '@renderer/hooks/use-app-config'
import { useTranslation } from '@renderer/hooks/useTranslation'
import debounce from '@renderer/utils/debounce'
import {
  MAX_DELAY_TEST_CONCURRENCY,
  MIN_DELAY_TEST_CONCURRENCY,
  normalizeDelayTestConcurrency
} from '@renderer/utils/delay-test'

interface Props {
  onClose: () => void
  reopenSignal?: number
}

const DRAWER_CLOSE_ANIMATION_MS = 700

const ProxySettingDrawer: React.FC<Props> = (props) => {
  const { onClose, reopenSignal } = props
  const { t } = useTranslation('proxy')
  const { appConfig, patchAppConfig } = useAppConfig()

  const {
    proxyCols = 'auto',
    proxyDisplayOrder = 'default',
    groupDisplayLayout = 'single',
    proxyDisplayLayout = 'double',
    showGroupSelectedProxy = true,
    showProxyDetailTooltip = false,
    autoCloseConnection = true,
    closeMode = 'all',
    delayTestUrl,
    delayTestUrlScope = 'group',
    delayTestUseGroupApi = false,
    delayTestConcurrency,
    delayTestTimeout,
    rememberProxyGroupOpenState = false
  } = appConfig || {}

  const [url, setUrl] = useState(delayTestUrl ?? '')
  const [isOpen, setIsOpen] = useState(true)
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const setUrlDebounce = useRef(
    debounce((v: string) => {
      patchAppConfig({ delayTestUrl: v })
    }, 500)
  ).current

  useEffect(() => {
    setUrl(delayTestUrl ?? '')
  }, [delayTestUrl])

  useEffect(() => {
    return () => {
      if (closeTimer.current) {
        clearTimeout(closeTimer.current)
      }
    }
  }, [])

  useEffect(() => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current)
      closeTimer.current = null
    }
    setIsOpen(true)
  }, [reopenSignal])

  const closeWithAnimation = (): void => {
    if (closeTimer.current) return

    setIsOpen(false)
    closeTimer.current = setTimeout(() => {
      closeTimer.current = null
      onClose()
    }, DRAWER_CLOSE_ANIMATION_MS)
  }

  return (
    <Drawer.Backdrop
      isOpen={isOpen}
      onOpenChange={(open) => {
        if (!open) closeWithAnimation()
      }}
      variant="blur"
      className="top-12 h-[calc(100%-48px)]"
    >
      <Drawer.Content placement="right" className="top-12 h-[calc(100%-48px)] p-3 pl-0">
        <Drawer.Dialog className="flex h-full w-[min(520px,calc(100vw-32px))] max-w-none flex-col overflow-hidden rounded-2xl! border border-separator/70 bg-overlay p-0 shadow-overlay flag-emoji">
          <Drawer.Header className="border-b border-separator/70 px-5 py-4">
            <Drawer.Heading className="text-base font-semibold">{t('settings')}</Drawer.Heading>
          </Drawer.Header>
          <Drawer.Body className="no-scrollbar flex-1 overflow-y-auto px-5 py-3">
            <div className="flex flex-col gap-1">
              <SettingItem title={t('proxyCols')} {...settingItemProps} divider>
                <Select
                  aria-label={t('proxyCols')}
                  value={proxyCols}
                  variant="secondary"
                  onChange={async (value) => {
                    if (Array.isArray(value) || value == null) return
                    if (value === proxyCols) return

                    await patchAppConfig({
                      proxyCols: value as 'auto' | '1' | '2' | '3' | '4'
                    })
                  }}
                >
                  <Select.Trigger>
                    <Select.Value />
                    <Select.Indicator />
                  </Select.Trigger>
                  <Select.Popover>
                    <ListBox>
                      <ListBox.Item id="auto" textValue={t('proxyColsAuto')}>
                        {t('proxyColsAuto')}
                        <ListBox.ItemIndicator />
                      </ListBox.Item>
                      <ListBox.Item id="1" textValue={t('proxyCols1')}>
                        {t('proxyCols1')}
                        <ListBox.ItemIndicator />
                      </ListBox.Item>
                      <ListBox.Item id="2" textValue={t('proxyCols2')}>
                        {t('proxyCols2')}
                        <ListBox.ItemIndicator />
                      </ListBox.Item>
                      <ListBox.Item id="3" textValue={t('proxyCols3')}>
                        {t('proxyCols3')}
                        <ListBox.ItemIndicator />
                      </ListBox.Item>
                      <ListBox.Item id="4" textValue={t('proxyCols4')}>
                        {t('proxyCols4')}
                        <ListBox.ItemIndicator />
                      </ListBox.Item>
                    </ListBox>
                  </Select.Popover>
                </Select>
              </SettingItem>
              <SettingItem title={t('proxyDisplayOrder')} {...settingItemProps} divider>
                <SettingTabs
                  ariaLabel={t('proxyDisplayOrder')}
                  selectedKey={proxyDisplayOrder}
                  options={[
                    { id: 'default', label: t('orderBy.default') },
                    { id: 'delay', label: t('orderBy.delay') },
                    { id: 'name', label: t('orderBy.name') }
                  ]}
                  onChange={async (v) => {
                    await patchAppConfig({
                      proxyDisplayOrder: v as 'default' | 'delay' | 'name'
                    })
                  }}
                />
              </SettingItem>
              <SettingItem title={t('groupDisplayLayout')} {...settingItemProps} divider>
                <SettingTabs
                  ariaLabel={t('groupDisplayLayout')}
                  selectedKey={groupDisplayLayout}
                  options={[
                    { id: 'hidden', label: t('displayLayout.hidden') },
                    { id: 'single', label: t('displayLayout.single') },
                    { id: 'double', label: t('displayLayout.double') }
                  ]}
                  onChange={async (v) => {
                    await patchAppConfig({
                      groupDisplayLayout: v as 'hidden' | 'single' | 'double'
                    })
                  }}
                />
              </SettingItem>
              <SettingItem title={t('proxyDisplayLayout')} {...settingItemProps} divider>
                <SettingTabs
                  ariaLabel={t('proxyDisplayLayout')}
                  selectedKey={proxyDisplayLayout}
                  options={[
                    { id: 'hidden', label: t('displayLayout.hidden') },
                    { id: 'single', label: t('displayLayout.single') },
                    { id: 'double', label: t('displayLayout.double') }
                  ]}
                  onChange={async (v) => {
                    await patchAppConfig({
                      proxyDisplayLayout: v as 'hidden' | 'single' | 'double'
                    })
                  }}
                />
              </SettingItem>
              <SettingItem title={t('showGroupSelectedProxy')} {...settingItemProps} divider>
                <Switch
                  aria-label={t('showGroupSelectedProxy')}
                  isSelected={showGroupSelectedProxy}
                  onChange={(v) => {
                    patchAppConfig({ showGroupSelectedProxy: v })
                  }}
                >
                  <Switch.Control>
                    <Switch.Thumb />
                  </Switch.Control>
                </Switch>
              </SettingItem>
              <SettingItem title={t('showProxyDetailTooltip')} {...settingItemProps} divider>
                <Switch
                  aria-label={t('showProxyDetailTooltip')}
                  isSelected={showProxyDetailTooltip}
                  onChange={(v) => {
                    patchAppConfig({ showProxyDetailTooltip: v })
                  }}
                >
                  <Switch.Control>
                    <Switch.Thumb />
                  </Switch.Control>
                </Switch>
              </SettingItem>
              <SettingItem title={t('rememberProxyGroupOpenState')} {...settingItemProps} divider>
                <Switch
                  aria-label={t('rememberProxyGroupOpenState')}
                  isSelected={rememberProxyGroupOpenState}
                  onChange={(v) => {
                    patchAppConfig({ rememberProxyGroupOpenState: v })
                  }}
                >
                  <Switch.Control>
                    <Switch.Thumb />
                  </Switch.Control>
                </Switch>
              </SettingItem>
              <SettingItem title={t('autoCloseConnection')} {...settingItemProps} divider>
                <Switch
                  aria-label={t('autoCloseConnection')}
                  isSelected={autoCloseConnection}
                  onChange={(v) => {
                    patchAppConfig({ autoCloseConnection: v })
                  }}
                >
                  <Switch.Control>
                    <Switch.Thumb />
                  </Switch.Control>
                </Switch>
              </SettingItem>
              {autoCloseConnection && (
                <SettingItem title={t('closeMode')} {...settingItemProps} divider>
                  <SettingTabs
                    ariaLabel={t('closeMode')}
                    selectedKey={closeMode}
                    options={[
                      { id: 'all', label: t('closeModeAll') },
                      { id: 'group', label: t('closeModeGroup') }
                    ]}
                    onChange={async (v) => {
                      await patchAppConfig({
                        closeMode: v as 'all' | 'group'
                      })
                    }}
                  />
                </SettingItem>
              )}
              <SettingItem title={t('delayTestUrl')} {...settingItemProps} divider>
                <Input
                  aria-label={t('delayTestUrl')}
                  data-setting-input="url"
                  value={url}
                  placeholder={t('delayTestUrlPlaceholder')}
                  variant="secondary"
                  onChange={(event) => {
                    const v = event.target.value
                    setUrl(v)
                    setUrlDebounce(v)
                  }}
                />
              </SettingItem>
              <SettingItem title={t('delayTestUrlScope')} {...settingItemProps} divider>
                <SettingTabs
                  ariaLabel={t('delayTestUrlScope')}
                  selectedKey={delayTestUrlScope}
                  options={[
                    { id: 'group', label: t('delayTestUrlScopeGroup') },
                    { id: 'global', label: t('delayTestUrlScopeGlobal') }
                  ]}
                  onChange={async (v) => {
                    await patchAppConfig({
                      delayTestUrlScope: v as 'group' | 'global'
                    })
                  }}
                />
              </SettingItem>
              <SettingItem title={t('delayTestUseGroupApi')} {...settingItemProps} divider>
                <Switch
                  aria-label={t('delayTestUseGroupApi')}
                  isSelected={delayTestUseGroupApi}
                  onChange={(v) => {
                    patchAppConfig({ delayTestUseGroupApi: v })
                  }}
                >
                  <Switch.Control>
                    <Switch.Thumb />
                  </Switch.Control>
                </Switch>
              </SettingItem>
              {!delayTestUseGroupApi && (
                <SettingItem title={t('delayTestConcurrency')} {...settingItemProps} divider>
                  <InputGroup data-setting-input="number" variant="secondary">
                    <InputGroup.Input
                      aria-label={t('delayTestConcurrency')}
                      type="number"
                      value={delayTestConcurrency?.toString()}
                      min={MIN_DELAY_TEST_CONCURRENCY}
                      max={MAX_DELAY_TEST_CONCURRENCY}
                      placeholder={t('delayTestConcurrencyPlaceholder')}
                      onChange={(event) => {
                        const v = event.target.value
                        patchAppConfig({
                          delayTestConcurrency: normalizeDelayTestConcurrency(parseInt(v))
                        })
                      }}
                    />
                  </InputGroup>
                </SettingItem>
              )}
              <SettingItem title={t('delayTestTimeout')} {...settingItemProps}>
                <InputGroup data-setting-input="number" variant="secondary">
                  <InputGroup.Input
                    aria-label={t('delayTestTimeout')}
                    type="number"
                    value={delayTestTimeout?.toString()}
                    placeholder={t('delayTestTimeoutPlaceholder')}
                    onChange={(event) => {
                      const v = event.target.value
                      patchAppConfig({ delayTestTimeout: parseInt(v) })
                    }}
                  />
                  <InputGroup.Suffix>ms</InputGroup.Suffix>
                </InputGroup>
              </SettingItem>
            </div>
          </Drawer.Body>
          <Drawer.CloseTrigger className="app-nodrag" />
        </Drawer.Dialog>
      </Drawer.Content>
    </Drawer.Backdrop>
  )
}

export default ProxySettingDrawer
