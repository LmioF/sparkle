/**
 * 语言切换组件
 *
 * 使用新的 i18n hooks 和性能优化
 *
 * @module renderer/components/settings/language-switcher
 */

/* eslint-disable react/prop-types */

import React, { useEffect, useState, useCallback, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { Select, SelectItem } from '@heroui/react'
import { useCurrentLanguage, useI18nReady } from '@renderer/i18n/context'
import type { LanguageInfo, LanguageCode } from '../../../../shared/i18n/types'
import { createLanguageCode } from '../../../../shared/i18n/types'

// 完整的 fallback 语言列表（包含所有内置语言）
const FALLBACK_LANGUAGES: readonly LanguageInfo[] = [
  { id: createLanguageCode('zh-CN'), name: '简体中文', source: 'builtin' },
  { id: createLanguageCode('zh-TW'), name: '繁體中文', source: 'builtin' },
  { id: createLanguageCode('en-US'), name: 'English', source: 'builtin' }
] as const

/**
 * 语言切换器属性
 */
export interface LanguageSwitcherProps {
  /**
   * 自定义类名
   */
  className?: string

  /**
   * 选择器大小
   */
  size?: 'sm' | 'md' | 'lg'

  /**
   * 是否显示来源标识
   */
  showSource?: boolean

  /**
   * 语言切换回调
   */
  onLanguageChange?: (from: LanguageCode, to: LanguageCode) => void

  /**
   * 加载错误回调
   */
  onLoadError?: (error: Error) => void
}

/**
 * 语言切换组件
 *
 * 使用新的 i18n Context 和 hooks
 * 优化性能和用户体验
 *
 * @example
 * ```tsx
 * <LanguageSwitcher
 *   size="sm"
 *   showSource={true}
 *   onLanguageChange={(from, to) => {
 *     console.log(`Language changed: ${from} → ${to}`)
 *   }}
 * />
 * ```
 */
export const LanguageSwitcher = React.memo<LanguageSwitcherProps>(
  ({ className, size = 'sm', showSource = true, onLanguageChange, onLoadError }) => {
    // 使用新的 hooks
    const { language: currentLanguage, changeLanguage } = useCurrentLanguage()
    const ready = useI18nReady()

    // 状态管理
    const [languages, setLanguages] = useState<LanguageInfo[]>([...FALLBACK_LANGUAGES])
    const [isLoading, setIsLoading] = useState(true)
    const [isSwitching, setIsSwitching] = useState(false)
    const [, setLoadError] = useState<Error | null>(null)

    // 使用 ref 存储回调，避免不必要的 useEffect 重新执行
    const onLoadErrorRef = React.useRef(onLoadError)

    // 更新 ref 当回调变化时
    React.useEffect(() => {
      onLoadErrorRef.current = onLoadError
    }, [onLoadError])

    // 加载可用语言列表
    useEffect(() => {
      let mounted = true

      async function loadLanguages() {
        try {
          setIsLoading(true)

          const langs = await window.electron.ipcRenderer.invoke('i18n:getAvailableLanguages')

          if (!mounted) return

          if (langs && Array.isArray(langs) && langs.length > 0) {
            setLanguages(langs)
            setLoadError(null) // 成功加载，清除错误
          } else {
            // 如果返回空数组，使用 fallback
            console.warn('[LanguageSwitcher] No languages returned from IPC, using fallback')
            const fallbackLangs = [...FALLBACK_LANGUAGES]

            // 确保当前语言在列表中
            if (currentLanguage && !fallbackLangs.some((lang) => lang.id === currentLanguage)) {
              fallbackLangs.push({
                id: currentLanguage,
                name: currentLanguage as string,
                source: 'builtin'
              })
            }

            setLanguages(fallbackLangs)
            // 不设置错误，因为 fallback 是正常行为
          }
        } catch (error) {
          if (!mounted) return

          const err = error instanceof Error ? error : new Error('Failed to load languages')
          console.error('[LanguageSwitcher] Failed to load languages:', err)

          const fallbackLangs = [...FALLBACK_LANGUAGES]

          // 确保当前语言在列表中
          if (currentLanguage && !fallbackLangs.some((lang) => lang.id === currentLanguage)) {
            fallbackLangs.push({
              id: currentLanguage,
              name: currentLanguage as string,
              source: 'builtin'
            })
          }

          setLanguages(fallbackLangs)
          setLoadError(err)

          if (onLoadErrorRef.current) {
            onLoadErrorRef.current(err)
          }
        } finally {
          if (mounted) {
            setIsLoading(false)
          }
        }
      }

      loadLanguages()

      return () => {
        mounted = false
      }
    }, [currentLanguage]) // 只依赖 currentLanguage，不依赖 onLoadError

    // 切换语言（使用 useCallback 优化）
    const handleLanguageSelect = useCallback(
      async (languageId: string) => {
        if (isSwitching || !currentLanguage || languageId === currentLanguage) {
          return
        }

        const newLanguage = createLanguageCode(languageId)
        const oldLanguage = currentLanguage

        setIsSwitching(true)
        setLoadError(null)

        try {
          await changeLanguage(newLanguage)

          // 成功后清除错误状态
          setLoadError(null)

          // 触发回调
          if (onLanguageChange) {
            onLanguageChange(oldLanguage, newLanguage)
          }
        } catch (error) {
          const err = error instanceof Error ? error : new Error('Failed to change language')
          console.error('[LanguageSwitcher] Failed to change language:', err)

          // 设置错误状态
          setLoadError(err)

          // 改进的错误恢复策略：先尝试回滚
          try {
            await changeLanguage(oldLanguage)

            // 回滚成功，显示非阻塞的错误提示

            // 触发错误回调
            if (onLoadError) {
              onLoadError(err)
            }
          } catch (rollbackError) {
            // 回滚也失败，自动重载页面

            // 设置错误消息，提示即将重载
            setLoadError(new Error('Language switch failed. Reloading page in 2 seconds...'))

            // 触发错误回调
            if (onLoadError) {
              onLoadError(err)
            }

            // 2秒后自动重载页面，给用户时间看到错误消息
            setTimeout(() => {
              window.location.reload()
            }, 2000)
          }
        } finally {
          setIsSwitching(false)
        }
      },
      [isSwitching, currentLanguage, changeLanguage, onLanguageChange, onLoadError]
    )

    // 计算选中的键（使用 useMemo 优化）
    const selectedKeys = useMemo(
      () => (currentLanguage ? [currentLanguage as string] : []),
      [currentLanguage]
    )

    // 如果 i18n 未准备好，显示 loading
    if (!ready || isLoading) {
      return (
        <div className={className}>
          <Select placeholder="Loading..." className="w-[140px]" size={size} isDisabled>
            <SelectItem key="loading" textValue="Loading...">
              Loading...
            </SelectItem>
          </Select>
        </div>
      )
    }

    return (
      <>
        <div className={className || ''}>
          <Select
            selectedKeys={selectedKeys}
            onSelectionChange={(keys) => {
              const selectedKey = Array.from(keys)[0] as string
              if (selectedKey) {
                handleLanguageSelect(selectedKey)
              }
            }}
            className="w-[140px]"
            size={size}
            isDisabled={isSwitching}
            aria-label="Select language"
          >
            {languages.map((lang) => (
              <SelectItem key={lang.id as string} textValue={lang.name}>
                <div className="flex items-center gap-2">
                  {/* 显示语言名称 */}
                  <span className="font-medium">{lang.name}</span>

                  {/* 显示来源标识 */}
                  {showSource && lang.source === 'custom' && (
                    <span className="text-xs text-primary">Custom</span>
                  )}
                  {showSource && lang.source === 'external' && (
                    <span className="text-xs text-success">External</span>
                  )}
                </div>
              </SelectItem>
            ))}
          </Select>
        </div>

        {/* 使用 Portal 将全屏覆盖层渲染到 body */}
        {isSwitching &&
          createPortal(
            <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-background/80 backdrop-blur-md">
              <div className="text-center">
                <div className="w-12 h-12 border-4 border-default-200 border-t-primary rounded-full animate-spin mx-auto mb-4" />
                <p className="text-default-600 text-sm">Switching language...</p>
              </div>
            </div>,
            document.body
          )}
      </>
    )
  }
)

LanguageSwitcher.displayName = 'LanguageSwitcher'

/**
 * 简化的语言切换器（只显示下拉框）
 *
 * @example
 * ```tsx
 * <SimpleLanguageSwitcher />
 * ```
 */
export const SimpleLanguageSwitcher = React.memo(() => {
  return <LanguageSwitcher showSource={false} />
})

SimpleLanguageSwitcher.displayName = 'SimpleLanguageSwitcher'
