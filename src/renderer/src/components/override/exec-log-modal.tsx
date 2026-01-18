import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  Divider
} from '@heroui/react'
import React, { useEffect, useState } from 'react'
import { useTranslation } from '@renderer/hooks/useTranslation'
import { getOverride } from '@renderer/utils/ipc'
import { useAppConfig } from '@renderer/hooks/use-app-config'

interface Props {
  id: string
  onClose: () => void
}

const ExecLogModal: React.FC<Props> = (props) => {
  const { id, onClose } = props
  const { t } = useTranslation('override')
  const { appConfig: { disableAnimation = false } = {} } = useAppConfig()
  const [logs, setLogs] = useState<string[]>([])

  const getLog = async (): Promise<void> => {
    setLogs((await getOverride(id, 'log')).split('\n').filter(Boolean))
  }

  useEffect(() => {
    getLog()
  }, [])

  return (
    <Modal
      backdrop={disableAnimation ? 'transparent' : 'blur'}
      disableAnimation={disableAnimation}
      classNames={{ backdrop: 'top-[48px]' }}
      hideCloseButton
      isOpen={true}
      onOpenChange={onClose}
      scrollBehavior="inside"
    >
      <ModalContent>
        <ModalHeader className="flex app-drag">{t('execLog')}</ModalHeader>
        <ModalBody>
          {logs.map((log, index) => {
            return (
              <React.Fragment key={index}>
                <small className="break-all select-text">{log}</small>
                <Divider />
              </React.Fragment>
            )
          })}
        </ModalBody>
        <ModalFooter>
          <Button size="sm" variant="light" onPress={onClose}>
            {t('common:actions.close')}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}

export default ExecLogModal
