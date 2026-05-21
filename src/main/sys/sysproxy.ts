import { getAppConfig, getControledMihomoConfig } from '../config'
import { getAppConfigSync } from '../config/app'
import { pacPort, startPacServer, stopPacServer } from '../resolve/server'
import { promisify } from 'util'
import { execFile, execFileSync } from 'child_process'
import { servicePath } from '../utils/dirs'
import { net, Notification } from 'electron'
import {
  disableProxy,
  setPac,
  setProxy,
  startServiceSysproxyEventStream,
  stopServiceSysproxyEventStream,
  subscribeServiceSysproxyEvents
} from '../service/api'
import type { ServiceSysproxyEvent } from '../service/api'
import { t } from '../utils/i18n'
import { appendAppLog } from '../utils/log'

let defaultBypass: string[] = []
let triggerSysProxyTimer: NodeJS.Timeout | null = null
const SYSPROXY_RETRY_MAX = 10
let sysProxyRetryCount = 0
let sysproxyGuardEventsStartedAt = 0
let lastSysproxyGuardNotificationKey = ''
let unsubscribeSysproxyGuardEvents: (() => void) | null = null

function registryArgs(useRegistry: boolean): string[] {
  return process.platform === 'win32' && useRegistry ? ['--use-registry'] : []
}

export async function triggerSysProxy(
  enable: boolean,
  onlyActiveDevice: boolean,
  useRegistry = false
): Promise<void> {
  if (triggerSysProxyTimer) {
    clearTimeout(triggerSysProxyTimer)
    triggerSysProxyTimer = null
  }

  if (!enable) {
    try {
      await disableSysProxy(onlyActiveDevice, useRegistry)
      sysProxyRetryCount = 0
    } catch (e) {
      console.warn('[SysProxy] Failed to disable system proxy:', e)
    }
    return
  }

  if (net.isOnline()) {
    sysProxyRetryCount = 0
    await setSysProxy(onlyActiveDevice, useRegistry)
  } else {
    if (sysProxyRetryCount >= SYSPROXY_RETRY_MAX) {
      sysProxyRetryCount = 0
      return
    }
    sysProxyRetryCount++
    triggerSysProxyTimer = setTimeout(
      () => triggerSysProxy(enable, onlyActiveDevice, useRegistry),
      5000
    )
  }
}

async function setSysProxy(onlyActiveDevice: boolean, useRegistry = false): Promise<void> {
  if (process.platform === 'linux')
    defaultBypass = [
      'localhost',
      '.local',
      '127.0.0.1/8',
      '192.168.0.0/16',
      '10.0.0.0/8',
      '172.16.0.0/12',
      '::1'
    ]
  if (process.platform === 'darwin')
    defaultBypass = [
      '127.0.0.1/8',
      '192.168.0.0/16',
      '10.0.0.0/8',
      '172.16.0.0/12',
      'localhost',
      '*.local',
      '*.crashlytics.com',
      '<local>'
    ]
  if (process.platform === 'win32')
    defaultBypass = [
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
  await startPacServer()
  const { sysProxy } = await getAppConfig()
  const { mode, host, bypass = defaultBypass, settingMode = 'exec' } = sysProxy
  const guard = settingMode === 'service' && !!sysProxy.guard
  const guardNotify = guard && !!sysProxy.guardNotify
  const { 'mixed-port': port = 7890 } = await getControledMihomoConfig()
  const execFilePromise = promisify(execFile)

  switch (mode || 'manual') {
    case 'auto': {
      if (settingMode === 'service') {
        try {
          await setPac(
            `http://${host || '127.0.0.1'}:${pacPort}/pac`,
            '',
            onlyActiveDevice,
            useRegistry,
            guard
          )
          updateSysproxyGuardEventStream(guardNotify)
        } catch {
          throw new Error(t('main.errors.serviceMayNotInstalled'))
        }
      } else {
        updateSysproxyGuardEventStream(false)
        await execFilePromise(servicePath(), [
          'pac',
          '--url',
          `http://${host || '127.0.0.1'}:${pacPort}/pac`,
          ...registryArgs(useRegistry)
        ])
      }
      break
    }

    case 'manual': {
      if (port != 0) {
        if (settingMode === 'service') {
          try {
            await setProxy(
              `${host || '127.0.0.1'}:${port}`,
              bypass.join(','),
              '',
              onlyActiveDevice,
              useRegistry,
              guard
            )
            updateSysproxyGuardEventStream(guardNotify)
          } catch {
            throw new Error(t('main.errors.serviceMayNotInstalled'))
          }
        } else {
          updateSysproxyGuardEventStream(false)
          await execFilePromise(servicePath(), [
            'proxy',
            '--server',
            `${host || '127.0.0.1'}:${port}`,
            '--bypass',
            process.platform === 'win32' ? bypass.join(';') : bypass.join(','),
            ...registryArgs(useRegistry)
          ])
        }
      } else {
        updateSysproxyGuardEventStream(false)
      }
      break
    }
  }
}

async function disableSysProxy(onlyActiveDevice: boolean, useRegistry = false): Promise<void> {
  await stopPacServer()
  updateSysproxyGuardEventStream(false)
  const { sysProxy } = await getAppConfig()
  const { settingMode = 'exec' } = sysProxy
  const execFilePromise = promisify(execFile)

  if (settingMode === 'service') {
    try {
      await disableProxy('', onlyActiveDevice, useRegistry)
    } catch (e) {
      throw new Error(t('main.errors.serviceMayNotInstalled'))
    }
  } else {
    await execFilePromise(servicePath(), ['disable', ...registryArgs(useRegistry)])
  }
}

function updateSysproxyGuardEventStream(enabled: boolean): void {
  if (enabled) {
    sysproxyGuardEventsStartedAt = Date.now()
    if (!unsubscribeSysproxyGuardEvents) {
      unsubscribeSysproxyGuardEvents = subscribeServiceSysproxyEvents(handleSysproxyGuardEvent)
    }
    startServiceSysproxyEventStream().catch((error) => {
      appendAppLog(`[Service]: start sysproxy event stream failed, ${error}\n`).catch(() => {})
    })
  } else {
    if (unsubscribeSysproxyGuardEvents) {
      unsubscribeSysproxyGuardEvents()
      unsubscribeSysproxyGuardEvents = null
    }
    stopServiceSysproxyEventStream()
    lastSysproxyGuardNotificationKey = ''
  }
}

async function handleSysproxyGuardEvent(event: ServiceSysproxyEvent): Promise<void> {
  if (!(await shouldNotifySysproxyGuardEvent(event))) return

  if (event.type === 'guard_restored') {
    new Notification({ title: t('main.notifications.sysproxyGuardRestored') }).show()
    return
  }

  new Notification({
    title: t('main.notifications.sysproxyGuardRestoreFailed'),
    body: event.error || event.message
  }).show()
}

async function shouldNotifySysproxyGuardEvent(event: ServiceSysproxyEvent): Promise<boolean> {
  if (event.type !== 'guard_restored' && event.type !== 'guard_restore_failed') return false

  const eventTime = Date.parse(event.time)
  if (Number.isFinite(eventTime) && eventTime < sysproxyGuardEventsStartedAt) return false

  const { sysProxy } = await getAppConfig()
  if (!sysProxy.guardNotify) return false

  const key = `${event.type}:${event.seq ?? ''}:${event.time}`
  if (key === lastSysproxyGuardNotificationKey) return false
  lastSysproxyGuardNotificationKey = key
  return true
}

/**
 * 同步禁用系统代理，作为最后的保障机制。
 * 注意：在 macOS service 模式下，此函数不执行任何操作，
 * 因为 service API 仅支持异步调用。此时依赖 before-quit/shutdown
 * 事件处理器中的异步 disableSysProxy() 调用。
 */
export function disableSysProxySync(useRegistry = false): void {
  try {
    const { sysProxy } = getAppConfigSync()
    const { settingMode = 'exec' } = sysProxy
    const useService = process.platform === 'darwin' && settingMode === 'service'

    if (!useService) {
      execFileSync(servicePath(), ['disable', ...registryArgs(useRegistry)], {
        stdio: 'ignore',
        timeout: 5000
      })
    }
  } catch {
    // ignore errors during sync disable
  }
}
