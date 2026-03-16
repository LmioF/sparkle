import { Button } from '@heroui/react'
import { JSX, ReactNode } from 'react'
import { ErrorBoundary, FallbackProps } from 'react-error-boundary'
import { useTranslation } from '@renderer/hooks/useTranslation'

const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message
  }
  return String(error)
}

const getErrorStack = (error: unknown): string => {
  if (error instanceof Error && typeof error.stack === 'string') {
    return error.stack
  }
  return ''
}

const ErrorFallback = ({ error }: FallbackProps): JSX.Element => {
  const message = getErrorMessage(error)
  const stack = getErrorStack(error)
  const { t } = useTranslation('common')

  return (
    <div className="p-4">
      <h2 className="my-2 text-lg font-bold">{t('errors.appCrashed')}</h2>

      <Button
        size="sm"
        color="primary"
        variant="flat"
        className="ml-2"
        onPress={() => open('https://t.me/+y7rcYjEKIiI1NzZl')}
      >
        Telegram
      </Button>

      <Button
        size="sm"
        variant="flat"
        className="ml-2"
        onPress={() => navigator.clipboard.writeText('```\n' + message + '\n' + stack + '\n```')}
      >
        {t('errors.copyError')}
      </Button>

      <p className="my-2">{message}</p>

      <details title="Error Stack">
        <summary>Error Stack</summary>
        <pre>{stack}</pre>
      </details>
    </div>
  )
}

interface Props {
  children?: ReactNode
}

const BaseErrorBoundary = (props: Props): JSX.Element => {
  return <ErrorBoundary FallbackComponent={ErrorFallback}>{props.children}</ErrorBoundary>
}

export default BaseErrorBoundary
