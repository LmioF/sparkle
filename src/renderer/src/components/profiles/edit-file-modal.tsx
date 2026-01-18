import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  Switch
} from '@heroui/react'
import React, { useEffect, useState } from 'react'
import { useTranslation } from '@renderer/hooks/useTranslation'
import { BaseEditor } from '../base/base-editor-lazy'
import { getProfileStr, setProfileStr } from '@renderer/utils/ipc'
import { useNavigate } from 'react-router-dom'
import { useAppConfig } from '@renderer/hooks/use-app-config'
import ConfirmModal from '../base/base-confirm'

interface Props {
  id: string
  isRemote: boolean
  onClose: () => void
}

const EditFileModal: React.FC<Props> = (props) => {
  const { id, isRemote, onClose } = props
  const { t } = useTranslation('profile')
  const { appConfig: { disableAnimation = false } = {} } = useAppConfig()
  const [currData, setCurrData] = useState('')
  const [originalData, setOriginalData] = useState('')
  const [isDiff, setIsDiff] = useState(false)
  const [sideBySide, setSideBySide] = useState(false)
  const [isConfirmOpen, setIsConfirmOpen] = useState(false)
  const navigate = useNavigate()

  const isModified = currData !== originalData

  const handleClose = (): void => {
    if (isModified) {
      setIsConfirmOpen(true)
    } else {
      onClose()
    }
  }

  const getContent = async (): Promise<void> => {
    try {
      const data = await getProfileStr(id)
      setCurrData(data)
      setOriginalData(data)
    } catch (e) {
      alert(t('fetchConfigFailed') + ': ' + e)
      onClose()
    }
  }

  useEffect(() => {
    getContent()
  }, [])

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
      onOpenChange={handleClose}
      scrollBehavior="inside"
    >
      {isConfirmOpen && (
        <ConfirmModal
          title={t('override:confirmCancel')}
          description={t('override:unsavedChanges')}
          confirmText={t('override:discardChanges')}
          cancelText={t('override:continueEditing')}
          onChange={setIsConfirmOpen}
          onConfirm={onClose}
        />
      )}
      <ModalContent className="h-full w-[calc(100%-100px)]">
        <ModalHeader className="flex pb-0 app-drag">
          <div className="flex justify-start">
            <div className="flex items-center">{t('editProfile')}</div>
            {isRemote && (
              <small className="ml-2 text-foreground-500">
                {t('editProfileWarning')}
                <Button
                  size="sm"
                  color="primary"
                  variant="light"
                  className="app-nodrag"
                  onPress={() => {
                    navigate('/override')
                  }}
                >
                  {t('override:title')}
                </Button>
                {t('feature')}
              </small>
            )}
          </div>
        </ModalHeader>
        <ModalBody className="h-full">
          <BaseEditor
            language="yaml"
            value={currData}
            originalValue={isDiff ? originalData : undefined}
            onChange={(value) => setCurrData(value)}
            diffRenderSideBySide={sideBySide}
          />
        </ModalBody>
        <ModalFooter className="pt-0 flex justify-between">
          <div className="flex items-center space-x-2">
            <Switch size="sm" isSelected={isDiff} onValueChange={setIsDiff}>
              {t('override:showChanges')}
            </Switch>
            <Switch size="sm" isSelected={sideBySide} onValueChange={setSideBySide}>
              {t('override:sideBySide')}
            </Switch>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="light" onPress={handleClose}>
              {t('common:actions.cancel')}
            </Button>
            <Button
              size="sm"
              color="primary"
              onPress={async () => {
                try {
                  await setProfileStr(id, currData)
                  onClose()
                } catch (e) {
                  alert(t('saveConfigFailed') + ': ' + e)
                }
              }}
            >
              {t('common:actions.save')}
            </Button>
          </div>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}

export default EditFileModal
