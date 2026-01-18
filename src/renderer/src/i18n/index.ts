export {
  I18nContext,
  useI18nContext,
  useI18nReady,
  useCurrentLanguage,
  useI18nError
} from './context'
export type { I18nContextState } from './context'

export {
  I18nProvider,
  I18nProviderWithDefaults,
  DefaultLoadingFallback,
  DefaultErrorFallback
} from './provider'
export type { I18nProviderProps } from './provider'

export { I18nErrorBoundary, useErrorBoundary } from './error-boundary'
export type { I18nErrorBoundaryProps, I18nErrorBoundaryState } from './error-boundary'

export { initRendererI18n, cleanupRendererI18n, isI18nInitialized, i18n } from '../i18n'

export {
  useLanguage,
  useLanguageSwitch,
  useNamespace,
  useNamespaces,
  useLazyNamespace
} from './hooks'
export type { UseLanguageResult, UseNamespaceResult } from './hooks'

export type {
  LanguageCode,
  Namespace,
  TranslationKey,
  TranslationResource,
  LanguageInfo,
  I18nConfig
} from '../../../shared/i18n/types'

export {
  createLanguageCode,
  createNamespace,
  createTranslationKey
} from '../../../shared/i18n/types'
