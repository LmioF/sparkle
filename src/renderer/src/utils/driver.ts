import type { NavigateFunction } from 'react-router-dom'
import { i18n } from '@renderer/i18n'

type Driver = {
  drive: () => void
  destroy: () => void
  moveNext: () => void
}

let driverInstance: Driver | null = null
let cssLoaded = false

async function loadDriverModule(): Promise<typeof import('driver.js')> {
  if (!cssLoaded) {
    await import('driver.js/dist/driver.css')
    cssLoaded = true
  }
  return import('driver.js')
}

// Helper function to get translation
const t = (key: string): string => {
  return i18n?.t(`common:tour.${key}`) || key
}

export async function createDriver(
  navigate: NavigateFunction,
  forceRecreate = false
): Promise<Driver> {
  // 如果强制重新创建，先销毁旧实例
  if (forceRecreate && driverInstance) {
    try {
      driverInstance.destroy()
    } catch (error) {
      console.warn('[Driver] Failed to destroy previous instance:', error)
    }
    driverInstance = null
  }

  if (driverInstance) return driverInstance

  const { driver } = await loadDriverModule()

  driverInstance = driver({
    showProgress: true,
    nextBtnText: t('nextBtn'),
    prevBtnText: t('prevBtn'),
    doneBtnText: t('doneBtn'),
    progressText: t('progress'),
    overlayOpacity: 0.9,
    steps: [
      {
        element: 'none',
        popover: {
          title: t('welcome.title'),
          description: t('welcome.description'),
          side: 'over',
          align: 'center'
        }
      },
      {
        element: '.side',
        popover: {
          title: t('sidebar.title'),
          description: t('sidebar.description'),
          side: 'right',
          align: 'center'
        }
      },
      {
        element: '.sysproxy-card',
        popover: {
          title: t('card.title'),
          description: t('card.description'),
          side: 'right',
          align: 'start'
        }
      },
      {
        element: '.main',
        popover: {
          title: t('mainArea.title'),
          description: t('mainArea.description'),
          side: 'left',
          align: 'center'
        }
      },
      {
        element: '.profile-card',
        popover: {
          title: t('profileManagement.title'),
          description: t('profileManagement.description'),
          side: 'right',
          align: 'start',
          onNextClick: async (): Promise<void> => {
            navigate('/profiles')
            setTimeout(() => {
              driverInstance?.moveNext()
            }, 0)
          }
        }
      },
      {
        element: '.profiles-sticky',
        popover: {
          title: t('profileImport.title'),
          description: t('profileImport.description'),
          side: 'bottom',
          align: 'start'
        }
      },
      {
        element: '.substore-import',
        popover: {
          title: t('substore.title'),
          description: t('substore.description'),
          side: 'bottom',
          align: 'start'
        }
      },
      {
        element: '.new-profile',
        popover: {
          title: t('localProfile.title'),
          description: t('localProfile.description'),
          side: 'bottom',
          align: 'start'
        }
      },
      {
        element: '.sysproxy-card',
        popover: {
          title: t('sysproxy.title'),
          description: t('sysproxy.description'),
          side: 'right',
          align: 'start',
          onNextClick: async (): Promise<void> => {
            navigate('/sysproxy')
            setTimeout(() => {
              driverInstance?.moveNext()
            }, 0)
          }
        }
      },
      {
        element: '.sysproxy-settings',
        popover: {
          title: t('sysproxySettings.title'),
          description: t('sysproxySettings.description'),
          side: 'top',
          align: 'start'
        }
      },
      {
        element: '.tun-card',
        popover: {
          title: t('tun.title'),
          description: t('tun.description'),
          side: 'right',
          align: 'start',
          onNextClick: async (): Promise<void> => {
            navigate('/tun')
            setTimeout(() => {
              driverInstance?.moveNext()
            }, 0)
          }
        }
      },
      {
        element: '.tun-settings',
        popover: {
          title: t('tunSettings.title'),
          description: t('tunSettings.description'),
          side: 'bottom',
          align: 'start'
        }
      },
      {
        element: '.override-card',
        popover: {
          title: t('override.title'),
          description: t('override.description'),
          side: 'right',
          align: 'center'
        }
      },
      {
        element: '.dns-card',
        popover: {
          title: t('dns.title'),
          description: t('dns.description'),
          side: 'right',
          align: 'center',
          onNextClick: async (): Promise<void> => {
            navigate('/profiles')
            setTimeout(() => {
              driverInstance?.moveNext()
            }, 0)
          }
        }
      },
      {
        element: 'none',
        popover: {
          title: t('end.title'),
          description: t('end.description'),
          side: 'top',
          align: 'center',
          onNextClick: async (): Promise<void> => {
            navigate('/profiles')
            setTimeout(() => {
              driverInstance?.destroy()
            }, 0)
          }
        }
      }
    ]
  })

  return driverInstance
}

export async function startTour(navigate: NavigateFunction): Promise<void> {
  const d = await createDriver(navigate, true)
  d.drive()
}

export function destroyDriver(): void {
  if (driverInstance) {
    try {
      driverInstance.destroy()
    } catch (error) {
      console.warn('[Driver] Failed to destroy instance:', error)
    }
    driverInstance = null
  }
}

export function getDriver(): Driver | null {
  return driverInstance
}
