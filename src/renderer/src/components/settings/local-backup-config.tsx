import React, { useState } from 'react'
import SettingCard from '../base/base-setting-card'
import SettingItem from '../base/base-setting-item'
import { Button } from '@heroui/react'
import { localBackup, listLocalBackups } from '@renderer/utils/ipc'
import LocalRestoreModal from './local-restore-modal'
import { useTranslation } from '@renderer/hooks/useTranslation'

const LocalBackupConfig: React.FC = () => {
  const { t } = useTranslation('settings')
  const tCommon = (key: string) => t(`common:${key}`)
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
      showNotification(
        t('backup.local.backupSuccess'),
        `${t('backup.local.backupSuccessDesc')}：${savedPath}`
      )
    } catch (e) {
      if (e instanceof Error && e.message !== tCommon('errors.userCancelled')) {
        showNotification(t('backup.local.backupFailed'), `${e.message}`, true)
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
        showNotification(t('backup.local.noBackup'), t('backup.local.noBackupInDir'), false)
      } else {
        setRestoreOpen(true)
      }
    } catch (e) {
      if (e instanceof Error && e.message !== tCommon('errors.userCancelled')) {
        showNotification(t('backup.local.fetchListFailed'), `${e.message}`, true)
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
      <SettingCard title={t('backup.local.title')}>
        <SettingItem title={t('backup.local.backupDesc')}>
          <div className="text-sm text-default-500 w-[60%] text-right">
            {t('backup.local.description')}
          </div>
        </SettingItem>
        <div className="flex justify-between">
          <Button isLoading={backuping} fullWidth size="sm" className="mr-1" onPress={handleBackup}>
            {t('common:actions.backup')}
          </Button>
          <Button
            isLoading={restoring}
            fullWidth
            size="sm"
            className="ml-1"
            onPress={handleRestore}
          >
            {t('common:actions.restore')}
          </Button>
        </div>
      </SettingCard>
    </>
  )
}

export default LocalBackupConfig
