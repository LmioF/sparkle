import { useEffect, useState } from 'react'
import { Button, Input, Select, SelectItem, Switch, Tooltip } from '@heroui/react'
import { IoIosHelpCircle } from 'react-icons/io'
import SettingCard from '@renderer/components/base/base-setting-card'
import SettingItem from '@renderer/components/base/base-setting-item'
import { useAppConfig } from '@renderer/hooks/use-app-config'
import { useControledMihomoConfig } from '@renderer/hooks/use-controled-mihomo-config'
import { useTranslation } from '@renderer/hooks/useTranslation'
import { restartCore } from '@renderer/utils/ipc'

const LogSetting: React.FC = () => {
  const { t } = useTranslation('mihomo')
  const { appConfig, patchAppConfig } = useAppConfig()
  const { controledMihomoConfig, patchControledMihomoConfig } = useControledMihomoConfig()
  const {
    saveLogs = true,
    maxLogDays = 7,
    maxLogFileSizeMB = 20,
    maxLogEntries = 500
  } = appConfig || {}
  const { 'log-level': logLevel = 'info' } = controledMihomoConfig || {}

  const [maxLogDaysInput, setMaxLogDaysInput] = useState(maxLogDays)
  const [maxLogFileSizeMBInput, setMaxLogFileSizeMBInput] = useState(maxLogFileSizeMB)
  const [maxLogEntriesInput, setMaxLogEntriesInput] = useState(maxLogEntries)

  useEffect(() => {
    setMaxLogDaysInput(maxLogDays)
  }, [maxLogDays])

  useEffect(() => {
    setMaxLogFileSizeMBInput(maxLogFileSizeMB)
  }, [maxLogFileSizeMB])

  useEffect(() => {
    setMaxLogEntriesInput(maxLogEntries)
  }, [maxLogEntries])

  const onChangeNeedRestart = async (patch: Partial<MihomoConfig>): Promise<void> => {
    await patchControledMihomoConfig(patch)
    await restartCore()
  }

  return (
    <SettingCard header={t('logSettingTitle')}>
      <SettingItem
        compatKey="legacy"
        title={t('saveLogs')}
        actions={
          <Tooltip content={t('saveLogsTip')}>
            <Button isIconOnly size="sm" variant="light">
              <IoIosHelpCircle className="text-lg" />
            </Button>
          </Tooltip>
        }
        divider
      >
        <Switch
          size="sm"
          isSelected={saveLogs}
          onValueChange={(value) => {
            patchAppConfig({ saveLogs: value })
          }}
        />
      </SettingItem>
      <SettingItem compatKey="legacy" title={t('logRetentionDays')} divider>
        <div className="flex">
          {saveLogs && maxLogDaysInput !== maxLogDays && (
            <Button
              size="sm"
              color="primary"
              className="mr-2"
              onPress={() => {
                patchAppConfig({ maxLogDays: maxLogDaysInput })
              }}
            >
              {t('common:actions.confirm')}
            </Button>
          )}
          <Input
            size="sm"
            type="number"
            className="w-25"
            endContent={t('days')}
            value={maxLogDaysInput.toString()}
            min={1}
            isDisabled={!saveLogs}
            onValueChange={(value) => {
              setMaxLogDaysInput(Math.max(parseInt(value) || 0, 1))
            }}
          />
        </div>
      </SettingItem>
      <SettingItem
        compatKey="legacy"
        title={t('maxLogFileSizeMB')}
        actions={
          <Tooltip content={t('maxLogFileSizeTip')}>
            <Button isIconOnly size="sm" variant="light">
              <IoIosHelpCircle className="text-lg" />
            </Button>
          </Tooltip>
        }
        divider
      >
        <div className="flex">
          {saveLogs && maxLogFileSizeMBInput !== maxLogFileSizeMB && (
            <Button
              size="sm"
              color="primary"
              className="mr-2"
              onPress={() => {
                patchAppConfig({ maxLogFileSizeMB: maxLogFileSizeMBInput })
              }}
            >
              {t('common:actions.confirm')}
            </Button>
          )}
          <Input
            size="sm"
            type="number"
            className="w-25"
            endContent="MB"
            value={maxLogFileSizeMBInput.toString()}
            min={1}
            isDisabled={!saveLogs}
            onValueChange={(value) => {
              setMaxLogFileSizeMBInput(Math.max(parseInt(value) || 0, 1))
            }}
          />
        </div>
      </SettingItem>
      <SettingItem
        compatKey="legacy"
        title={t('maxLogEntries')}
        actions={
          <Tooltip content={t('maxLogEntriesTip')}>
            <Button isIconOnly size="sm" variant="light">
              <IoIosHelpCircle className="text-lg" />
            </Button>
          </Tooltip>
        }
        divider
      >
        <div className="flex">
          {maxLogEntriesInput !== maxLogEntries && (
            <Button
              size="sm"
              color="primary"
              className="mr-2"
              onPress={() => {
                patchAppConfig({ maxLogEntries: maxLogEntriesInput })
              }}
            >
              {t('common:actions.confirm')}
            </Button>
          )}
          <Input
            size="sm"
            type="number"
            className="w-25"
            endContent={t('entries')}
            value={maxLogEntriesInput.toString()}
            min={1}
            onValueChange={(value) => {
              setMaxLogEntriesInput(Math.max(parseInt(value) || 0, 1))
            }}
          />
        </div>
      </SettingItem>
      <SettingItem compatKey="legacy" title={t('logLevel')}>
        <Select
          classNames={{ trigger: 'data-[hover=true]:bg-default-200' }}
          className="w-25"
          size="sm"
          selectedKeys={new Set([logLevel])}
          disallowEmptySelection={true}
          onSelectionChange={(value) =>
            onChangeNeedRestart({ 'log-level': value.currentKey as LogLevel })
          }
        >
          <SelectItem key="silent">{t('logLevelSilent')}</SelectItem>
          <SelectItem key="error">{t('logLevelError')}</SelectItem>
          <SelectItem key="warning">{t('logLevelWarning')}</SelectItem>
          <SelectItem key="info">{t('logLevelInfo')}</SelectItem>
          <SelectItem key="debug">{t('logLevelDebug')}</SelectItem>
        </Select>
      </SettingItem>
    </SettingCard>
  )
}

export default LogSetting
