import BasePage from '@renderer/components/base/base-page'
import GeoData from '@renderer/components/resources/geo-data'
import ProxyProvider from '@renderer/components/resources/proxy-provider'
import RuleProvider from '@renderer/components/resources/rule-provider'
import { useTranslation } from '@renderer/hooks/useTranslation'

const Resources: React.FC = () => {
  const { t } = useTranslation('resource')

  return (
    <BasePage title={t('title')}>
      <GeoData />
      <ProxyProvider />
      <RuleProvider />
    </BasePage>
  )
}

export default Resources
