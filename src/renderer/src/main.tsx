import React from 'react'
import ReactDOM from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import { ThemeProvider as NextThemesProvider } from 'next-themes'
import { HeroUIProvider } from '@heroui/react'
import { SWRConfig } from 'swr'
import { init } from '@renderer/utils/init'
import '@renderer/assets/main.css'
import App from '@renderer/App'
import BaseErrorBoundary from './components/base/base-error-boundary'
import { swrConfig } from './utils/swr-config'

import { AppConfigProvider } from './hooks/use-app-config'
import { ControledMihomoConfigProvider } from './hooks/use-controled-mihomo-config'
import { OverrideConfigProvider } from './hooks/use-override-config'
import { ProfileConfigProvider } from './hooks/use-profile-config'
import { RulesProvider } from './hooks/use-rules'
import { GroupsProvider } from './hooks/use-groups'
import { ProxiesStateProvider } from './hooks/use-proxies-state'

import { I18nProvider, DefaultLoadingFallback, DefaultErrorFallback } from './i18n/provider'
import { I18nErrorBoundary } from './i18n/error-boundary'
import { GlobalKeyboardHandler } from './components/base/global-keyboard-handler'

async function bootstrap(): Promise<void> {
  try {
    await init()

    ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
      <React.StrictMode>
        <SWRConfig value={swrConfig}>
          <HeroUIProvider>
            <NextThemesProvider attribute="class" enableSystem defaultTheme="dark">
              <BaseErrorBoundary>
                <GlobalKeyboardHandler />

                <I18nErrorBoundary
                  onError={(error, errorInfo) => {
                    console.error('[i18n] Error caught by boundary:', error, errorInfo)
                  }}
                  onReset={() => {
                    console.log('[i18n] Error boundary reset, reloading page...')
                    window.location.reload()
                  }}
                >
                  <I18nProvider
                    fallback={<DefaultLoadingFallback />}
                    errorFallback={(error, retry) => (
                      <DefaultErrorFallback error={error} retry={retry} />
                    )}
                    onInitialized={(language) => {
                      console.log('[i18n] Initialized with language:', language)
                    }}
                    onLanguageChanged={(from, to) => {
                      console.log('[i18n] Language changed:', from, '→', to)
                    }}
                    onError={(error) => {
                      console.error('[i18n] Error:', error)
                    }}
                  >
                    <HashRouter>
                      <AppConfigProvider>
                        <ControledMihomoConfigProvider>
                          <ProfileConfigProvider>
                            <OverrideConfigProvider>
                              <GroupsProvider>
                                <ProxiesStateProvider>
                                  <RulesProvider>
                                    <App />
                                  </RulesProvider>
                                </ProxiesStateProvider>
                              </GroupsProvider>
                            </OverrideConfigProvider>
                          </ProfileConfigProvider>
                        </ControledMihomoConfigProvider>
                      </AppConfigProvider>
                    </HashRouter>
                  </I18nProvider>
                </I18nErrorBoundary>
              </BaseErrorBoundary>
            </NextThemesProvider>
          </HeroUIProvider>
        </SWRConfig>
      </React.StrictMode>
    )
  } catch (error) {
    console.error('Failed to bootstrap application:', error)
    const root = document.getElementById('root')
    if (root) {
      root.innerHTML = ''

      const errorContainer = document.createElement('div')
      errorContainer.style.cssText =
        'display: flex; align-items: center; justify-content: center; height: 100vh; font-family: sans-serif;'

      const contentDiv = document.createElement('div')
      const title = document.createElement('h1')
      title.style.cssText = 'color: #ef4444; margin-bottom: 10px;'
      title.textContent = 'Application Failed to Start'

      const description = document.createElement('p')
      description.style.cssText = 'color: #6b7280; margin-bottom: 20px;'
      description.textContent = 'Please check the console for more details.'

      const errorMessage = document.createElement('p')
      errorMessage.style.cssText = 'color: #9ca3af; font-size: 14px; margin-bottom: 20px;'

      errorMessage.textContent =
        'An error occurred during initialization. Please check the console for details.'

      const reloadButton = document.createElement('button')
      reloadButton.style.cssText =
        'padding: 10px 20px; font-size: 16px; background-color: #3498db; color: white; border: none; border-radius: 4px; cursor: pointer;'
      reloadButton.textContent = 'Reload Application'
      reloadButton.onclick = () => window.location.reload()

      contentDiv.appendChild(title)
      contentDiv.appendChild(description)
      contentDiv.appendChild(errorMessage)
      contentDiv.appendChild(reloadButton)
      errorContainer.appendChild(contentDiv)
      root.appendChild(errorContainer)
    }
  }
}

bootstrap().catch((error) => {
  console.error('Failed to bootstrap application:', error)
})
