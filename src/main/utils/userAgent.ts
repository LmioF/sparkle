import { getAppConfig } from '../config'
import { mihomoVersion } from '../core/mihomoApi'

const TIMEOUT_MS = 300
const DEFAULT_USER_AGENT = 'clash.meta/alpha-e89af72'

export async function getUserAgent(): Promise<string> {
  const { userAgent } = await getAppConfig()
  if (userAgent) {
    return userAgent
  }

  try {
    let timeoutId: ReturnType<typeof setTimeout> | undefined
    const result = await Promise.race([
      mihomoVersion(),
      new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error('timeout')), TIMEOUT_MS)
      })
    ]).finally(() => {
      if (timeoutId) clearTimeout(timeoutId)
    })

    if (result?.version) {
      return `clash.meta/${result.version}`
    }

    return DEFAULT_USER_AGENT
  } catch {
    return DEFAULT_USER_AGENT
  }
}
