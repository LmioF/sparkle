import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, Button } from '@heroui/react'
import { useAppConfig } from '@renderer/hooks/use-app-config'
import { useTranslation } from '@renderer/hooks/useTranslation'
import { relaunchApp, localDelete, localRestore } from '@renderer/utils/ipc'
import React, { useState } from 'react'
import { MdDeleteForever } from 'react-icons/md'

interface Props {
  backupDir: string
  filenames: string[]
  onClose: () => void
}

const LocalRestoreModal: React.FC<Props> = (props) => {
  const { backupDir, filenames: names, onClose } = props
  const { t } = useTranslation('settings')
  const { appConfig: { disableAnimation = false } = {} } = useAppConfig()
  const [filenames, setFilenames] = useState<string[]>(names)
  const [restoring, setRestoring] = useState(false)
  const [deletingFile, setDeletingFile] = useState<string | null>(null)

  const showNotification = (title: string, body: string): void => {
    new window.Notification(title, { body })
  }

  const isOperating = restoring || deletingFile !== null

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
        <ModalHeader className="flex app-drag">{t('backup.local.restoreTitle')}</ModalHeader>
        <ModalBody>
          {filenames.length === 0 ? (
            <div className="flex justify-center">{t('backup.local.noBackupInDir')}</div>
          ) : (
            filenames.map((filename) => (
              <div className="flex" key={filename}>
                <Button
                  size="sm"
                  fullWidth
                  isLoading={restoring}
                  isDisabled={isOperating}
                  variant="flat"
                  onPress={async () => {
                    setRestoring(true)
                    try {
                      await localRestore(backupDir, filename)
                      // 恢复成功，尝试重启应用
                      try {
                        await relaunchApp()
                        // 重启成功，关闭模态框（虽然应用即将关闭）
                        onClose()
                      } catch (relaunchError) {
                        // 重启失败，保持模态框打开，显示通知
                        showNotification(
                          t('backup.local.restoreSuccess'),
                          t('backup.local.restoreSuccessDesc')
                        )
                        setRestoring(false)
                      }
                    } catch (e) {
                      showNotification(
                        t('backup.local.restoreFailed'),
                        `${e instanceof Error ? e.message : e}`
                      )
                      setRestoring(false)
                    }
                  }}
                >
                  {filename}
                </Button>
                <Button
                  size="sm"
                  color="warning"
                  variant="flat"
                  className="ml-2"
                  isLoading={deletingFile === filename}
                  isDisabled={isOperating}
                  onPress={async () => {
                    setDeletingFile(filename)
                    try {
                      await localDelete(backupDir, filename)
                      setFilenames(filenames.filter((name) => name !== filename))
                      showNotification(
                        t('backup.local.deleteSuccess'),
                        `${t('backup.local.deleteSuccessDesc')}：${filename}`
                      )
                    } catch (e) {
                      showNotification(
                        t('backup.local.deleteFailed'),
                        `${e instanceof Error ? e.message : e}`
                      )
                    } finally {
                      setDeletingFile(null)
                    }
                  }}
                >
                  <MdDeleteForever className="text-lg" />
                </Button>
              </div>
            ))
          )}
        </ModalBody>
        <ModalFooter>
          <Button size="sm" variant="light" onPress={onClose} isDisabled={isOperating}>
            {t('common:actions.close')}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}

export default LocalRestoreModal
