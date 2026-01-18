export { useLanguage, useLanguageSwitch } from './useLanguage'
export type { UseLanguageResult } from './useLanguage'

export { useNamespace, useNamespaces, useLazyNamespace } from './useNamespace'
export type { UseNamespaceResult } from './useNamespace'

export { useI18nContext, useI18nReady, useCurrentLanguage, useI18nError } from '../context'

export {
  useTranslation,
  useNamespaceTranslation,
  useTranslationKey,
  useTranslationKeyWithParams
} from '../../hooks/useTranslation'
export type { UseTranslationResult, TranslationSelector } from '../../hooks/useTranslation'
