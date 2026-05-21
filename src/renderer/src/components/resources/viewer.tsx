import {
  Button,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  Spinner
} from '@heroui/react'
import React, { useEffect, useState } from 'react'
import { BaseEditor } from '../base/base-editor-lazy'
import { useTranslation } from '@renderer/hooks/useTranslation'
import {
  getFilePreviewStr,
  getFileStr,
  saveFileStrWithElevation,
  setFileStr
} from '@renderer/utils/ipc'
import yaml from 'js-yaml'
import { useAppConfig } from '@renderer/hooks/use-app-config'
import ConfirmModal from '../base/base-confirm'
import { notify } from '@renderer/utils/notification'

type Language = 'yaml' | 'javascript' | 'css' | 'json' | 'text'
const FILE_PERMISSION_ELEVATION_REQUIRED = 'FILE_PERMISSION_ELEVATION_REQUIRED'

interface Props {
  onClose: () => void
  path: string
  type: string
  title: string
  providerType: string
  format?: string
}

function getDefaultLanguage(format?: string): Language {
  return !format || format === 'YamlRule' ? 'yaml' : 'text'
}

function getViewerContent(fileContent: string, providerType: string, title: string): string {
  try {
    const parsedYaml = yaml.load(fileContent)
    if (!parsedYaml || typeof parsedYaml !== 'object') {
      return fileContent
    }

    const yamlObj = parsedYaml as Record<string, unknown>
    const payload = yamlObj[providerType]?.[title]?.payload
    if (payload) {
      return yaml.dump(
        providerType === 'proxy-providers' ? { proxies: payload } : { rules: payload }
      )
    }

    const targetObj = yamlObj[providerType]?.[title]
    return targetObj ? yaml.dump(targetObj) : fileContent
  } catch {
    return fileContent
  }
}

const Viewer: React.FC<Props> = (props) => {
  const { type, path, title, format, providerType, onClose } = props
  const { t } = useTranslation('resource')
  const { appConfig: { disableAnimation = false } = {} } = useAppConfig()
  const [currData, setCurrData] = useState('')
  const [showPermissionConfirm, setShowPermissionConfirm] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const language = type === 'Inline' ? 'yaml' : getDefaultLanguage(format)
  const editorLanguage = format === 'MrsRule' ? 'text' : language

  const save = async (elevated = false): Promise<void> => {
    setIsSaving(true)
    try {
      await (elevated ? saveFileStrWithElevation(path, currData) : setFileStr(path, currData))
      onClose()
    } catch (e) {
      if (!elevated && typeof e === 'string' && e.includes(FILE_PERMISSION_ELEVATION_REQUIRED)) {
        setShowPermissionConfirm(true)
        return
      }
      notify(e, { variant: 'danger' })
    } finally {
      setIsSaving(false)
    }
  }

  useEffect(() => {
    let canceled = false

    if (type !== 'Inline' && !path) {
      setIsLoading(true)
      setCurrData('')
      return () => {
        canceled = true
      }
    }

    const loadContent = async (): Promise<void> => {
      setIsLoading(true)
      try {
        const fileContent = await (format === 'MrsRule'
          ? getFilePreviewStr(path, format)
          : getFileStr(type === 'Inline' ? 'config.yaml' : path))

        if (canceled) return
        setCurrData(
          format === 'MrsRule' ? fileContent : getViewerContent(fileContent, providerType, title)
        )
      } catch (e) {
        if (!canceled) {
          notify(e, { variant: 'danger' })
        }
      } finally {
        if (!canceled) {
          setIsLoading(false)
        }
      }
    }

    loadContent()
    return () => {
      canceled = true
    }
  }, [format, path, providerType, title, type])

  return (
    <Modal
      backdrop={disableAnimation ? 'transparent' : 'blur'}
      disableAnimation={disableAnimation}
      classNames={{
        base: 'max-w-none w-full',
        backdrop: 'top-[48px]'
      }}
      size="5xl"
      hideCloseButton
      isOpen={true}
      onOpenChange={onClose}
      scrollBehavior="inside"
    >
      {showPermissionConfirm && (
        <ConfirmModal
          onChange={setShowPermissionConfirm}
          title={t('permissionSaveTitle')}
          description={t('permissionSaveDesc')}
          buttons={[
            {
              key: 'cancel',
              text: t('common:actions.cancel'),
              variant: 'light',
              onPress: () => {}
            },
            {
              key: 'elevate',
              text: t('permissionSaveElevate'),
              color: 'primary',
              onPress: () => save(true)
            }
          ]}
          className="w-120"
        />
      )}
      <ModalContent className="h-full w-[calc(100%-100px)]">
        <ModalHeader className="flex pb-0 app-drag">{title}</ModalHeader>
        <ModalBody className="h-full">
          {isLoading ? (
            <div className="flex h-full items-center justify-center">
              <Spinner size="lg" />
            </div>
          ) : (
            <BaseEditor
              language={editorLanguage}
              value={currData}
              readOnly={type !== 'File'}
              onChange={(value) => setCurrData(value)}
            />
          )}
        </ModalBody>
        <ModalFooter className="pt-0">
          <Button size="sm" variant="light" onPress={onClose}>
            {t('common:actions.close')}
          </Button>
          {type === 'File' && !isLoading && (
            <Button size="sm" color="primary" isLoading={isSaving} onPress={() => save()}>
              {t('common:actions.save')}
            </Button>
          )}
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}

export default Viewer
