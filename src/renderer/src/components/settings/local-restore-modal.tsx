import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, Button } from '@heroui/react'
import { useAppConfig } from '@renderer/hooks/use-app-config'
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
        <ModalHeader className="flex app-drag">恢复本地备份</ModalHeader>
        <ModalBody>
          {filenames.length === 0 ? (
            <div className="flex justify-center">该目录下没有备份文件</div>
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
                          '配置已恢复',
                          '配置恢复成功，但应用重启失败，请手动重启应用'
                        )
                        setRestoring(false)
                      }
                    } catch (e) {
                      showNotification('恢复失败', `${e instanceof Error ? e.message : e}`)
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
                      showNotification('删除成功', `已删除备份文件：${filename}`)
                    } catch (e) {
                      showNotification('删除失败', `${e instanceof Error ? e.message : e}`)
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
            关闭
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}

export default LocalRestoreModal
