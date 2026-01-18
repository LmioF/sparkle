import { i18n } from '@renderer/i18n'

export const getValidationTranslation = (key: string, params?: Record<string, string>): string => {
  const fullKey = `common:validation.${key}`

  if (!i18n) {
    return key
  }

  let translation = i18n.t(fullKey)

  if (params) {
    Object.entries(params).forEach(([paramKey, paramValue]) => {
      translation = translation.replace(`{${paramKey}}`, paramValue)
    })
  }

  return translation
}
