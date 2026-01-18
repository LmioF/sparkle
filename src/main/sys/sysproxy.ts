import { getAppConfig, getControledMihomoConfig } from '../config'
import { getAppConfigSync } from '../config/app'
import { pacPort, startPacServer, stopPacServer } from '../resolve/server'
import { promisify } from 'util'
import { execFile, execFileSync } from 'child_process'
import { servicePath } from '../utils/dirs'
import { net } from 'electron'
import { disableProxy, setPac, setProxy } from '../service/api'
import { t } from '../utils/i18n'

let defaultBypass: string[] = []
let triggerSysProxyTimer: NodeJS.Timeout | null = null
const SYSPROXY_RETRY_MAX = 10
let sysProxyRetryCount = 0

export async function triggerSysProxy(enable: boolean, onlyActiveDevice: boolean): Promise<void> {
  if (triggerSysProxyTimer) {
    clearTimeout(triggerSysProxyTimer)
    triggerSysProxyTimer = null
  }

  if (!enable) {
    try {
      await disableSysProxy(onlyActiveDevice)
    } catch (e) {
      console.warn('[SysProxy] Failed to disable system proxy:', e)
    }
    return
  }

  if (net.isOnline()) {
    sysProxyRetryCount = 0
    await setSysProxy(onlyActiveDevice)
  } else {
    if (sysProxyRetryCount >= SYSPROXY_RETRY_MAX) {
      sysProxyRetryCount = 0
      return
    }
    sysProxyRetryCount++
    triggerSysProxyTimer = setTimeout(() => triggerSysProxy(enable, onlyActiveDevice), 5000)
  }
}

async function setSysProxy(onlyActiveDevice: boolean): Promise<void> {
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
  const { 'mixed-port': port = 7890 } = await getControledMihomoConfig()
  const execFilePromise = promisify(execFile)
  const useService = process.platform === 'darwin' && settingMode === 'service'

  switch (mode || 'manual') {
    case 'auto': {
      if (useService) {
        try {
          await setPac(`http://${host || '127.0.0.1'}:${pacPort}/pac`, '', onlyActiveDevice)
        } catch {
          throw new Error(t('main.errors.serviceMayNotInstalled'))
        }
      } else {
        await execFilePromise(servicePath(), [
          'pac',
          '--url',
          `http://${host || '127.0.0.1'}:${pacPort}/pac`
        ])
      }
      break
    }

    case 'manual': {
      if (port != 0) {
        if (useService) {
          try {
            await setProxy(`${host || '127.0.0.1'}:${port}`, bypass.join(','), '', onlyActiveDevice)
          } catch {
            throw new Error(t('main.errors.serviceMayNotInstalled'))
          }
        } else {
          await execFilePromise(servicePath(), [
            'proxy',
            '--server',
            `${host || '127.0.0.1'}:${port}`,
            '--bypass',
            process.platform === 'win32' ? bypass.join(';') : bypass.join(',')
          ])
        }
      }
      break
    }
  }
}

export async function disableSysProxy(onlyActiveDevice: boolean): Promise<void> {
  await stopPacServer()
  const { sysProxy } = await getAppConfig()
  const { settingMode = 'exec' } = sysProxy
  const execFilePromise = promisify(execFile)
  const useService = process.platform === 'darwin' && settingMode === 'service'

  if (useService) {
    try {
      await disableProxy('', onlyActiveDevice)
    } catch (e) {
      throw new Error(t('main.errors.serviceMayNotInstalled'))
    }
  } else {
    await execFilePromise(servicePath(), ['disable'])
  }
}

/**
 * 同步禁用系统代理，作为最后的保障机制。
 * 注意：在 macOS service 模式下，此函数不执行任何操作，
 * 因为 service API 仅支持异步调用。此时依赖 before-quit/shutdown
 * 事件处理器中的异步 disableSysProxy() 调用。
 */
export function disableSysProxySync(): void {
  try {
    const { sysProxy } = getAppConfigSync()
    const { settingMode = 'exec' } = sysProxy
    const useService = process.platform === 'darwin' && settingMode === 'service'

    if (!useService) {
      execFileSync(servicePath(), ['disable'], { timeout: 5000 })
    }
  } catch {
    // ignore errors during sync disable
  }
}
