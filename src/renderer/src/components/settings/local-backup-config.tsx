import React, { useState } from 'react'
import SettingCard from '../base/base-setting-card'
import SettingItem from '../base/base-setting-item'
import { Button } from '@heroui/react'
import { localBackup, listLocalBackups } from '@renderer/utils/ipc'
import LocalRestoreModal from './local-restore-modal'

const LocalBackupConfig: React.FC = () => {
  const [backuping, setBackuping] = useState(false)
  const [restoring, setRestoring] = useState(false)
  const [backupDir, setBackupDir] = useState('')
  const [filenames, setFilenames] = useState<string[]>([])
  const [restoreOpen, setRestoreOpen] = useState(false)

  const showNotification = (title: string, body: string, isError = false): void => {
    new window.Notification(title, {
      body,
      icon: isError ? undefined : undefined
    })
  }

  const handleBackup = async (): Promise<void> => {
    setBackuping(true)
    try {
      const savedPath = await localBackup()
      showNotification('备份成功', `备份已保存至：${savedPath}`)
    } catch (e) {
      if (e instanceof Error && e.message !== '用户取消操作') {
        showNotification('备份失败', `${e.message}`, true)
      }
    } finally {
      setBackuping(false)
    }
  }

  const handleRestore = async (): Promise<void> => {
    try {
      setRestoring(true)
      const { backupDir, files } = await listLocalBackups()
      setBackupDir(backupDir)
      setFilenames(files)
      if (files.length === 0) {
        showNotification('提示', '该目录下没有备份文件', false)
      } else {
        setRestoreOpen(true)
      }
    } catch (e) {
      if (e instanceof Error && e.message !== '用户取消操作') {
        showNotification('获取备份列表失败', `${e.message}`, true)
      }
    } finally {
      setRestoring(false)
    }
  }

  return (
    <>
      {restoreOpen && (
        <LocalRestoreModal
          backupDir={backupDir}
          filenames={filenames}
          onClose={() => setRestoreOpen(false)}
        />
      )}
      <SettingCard title="本地备份">
        <SettingItem title="备份说明">
          <div className="text-sm text-default-500 w-[60%] text-right">
            备份包含所有配置、订阅和主题
          </div>
        </SettingItem>
        <div className="flex justify-between">
          <Button isLoading={backuping} fullWidth size="sm" className="mr-1" onPress={handleBackup}>
            备份
          </Button>
          <Button
            isLoading={restoring}
            fullWidth
            size="sm"
            className="ml-1"
            onPress={handleRestore}
          >
            恢复
          </Button>
        </div>
      </SettingCard>
    </>
  )
}

export default LocalBackupConfig
