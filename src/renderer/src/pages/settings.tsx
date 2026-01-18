import { Button } from '@heroui/react'
import BasePage from '@renderer/components/base/base-page'
// import { CgWebsite } from 'react-icons/cg'
import { IoLogoGithub } from 'react-icons/io5'
import WebdavConfig from '@renderer/components/settings/webdav-config'
import LocalBackupConfig from '@renderer/components/settings/local-backup-config'
import GeneralConfig from '@renderer/components/settings/general-config'
import AdvancedSettings from '@renderer/components/settings/advanced-settings'
import Actions from '@renderer/components/settings/actions'
import ShortcutConfig from '@renderer/components/settings/shortcut-config'
import { FaTelegramPlane } from 'react-icons/fa'
import SiderConfig from '@renderer/components/settings/sider-config'
import SubStoreConfig from '@renderer/components/settings/substore-config'
import AppearanceConfig from '@renderer/components/settings/appearance-confis'
import { useTranslation } from '@renderer/hooks/useTranslation'

const Settings: React.FC = () => {
  const { t } = useTranslation('settings')

  return (
    <BasePage
      title={t('title')}
      header={
        <>
          {/* <Button
            isIconOnly
            size="sm"
            variant="light"
            title={t('common:ui.officialDocs')}
            className="app-nodrag"
            onPress={() => {
              window.open('https://')
            }}
          >
            <CgWebsite className="text-lg" />
          </Button> */}
          <Button
            isIconOnly
            size="sm"
            variant="light"
            className="app-nodrag"
            title={t('common:ui.githubRepo')}
            onPress={() => {
              window.open('https://github.com/INKCR0W/sparkle')
            }}
          >
            <IoLogoGithub className="text-lg" />
          </Button>
          <Button
            isIconOnly
            size="sm"
            variant="light"
            className="app-nodrag"
            title={t('common:ui.telegramChannel')}
            onPress={() => {
              window.open('https://t.me/atri0828')
            }}
          >
            <FaTelegramPlane className="text-lg" />
          </Button>
        </>
      }
    >
      <GeneralConfig />
      <AppearanceConfig />
      <SubStoreConfig />
      <SiderConfig />
      <LocalBackupConfig />
      <WebdavConfig />
      <AdvancedSettings />
      <ShortcutConfig />
      <Actions />
    </BasePage>
  )
}

export default Settings
