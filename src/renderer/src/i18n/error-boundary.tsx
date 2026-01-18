import React, { Component, type ReactNode, type ErrorInfo } from 'react'

export interface I18nErrorBoundaryProps {
  children: ReactNode

  fallback?: (error: Error, errorInfo: ErrorInfo | null, reset: () => void) => ReactNode

  onError?: (error: Error, errorInfo: ErrorInfo) => void

  onReset?: () => void
}

export interface I18nErrorBoundaryState {
  hasError: boolean

  error: Error | null

  errorInfo: ErrorInfo | null
}

export class I18nErrorBoundary extends Component<I18nErrorBoundaryProps, I18nErrorBoundaryState> {
  private resetCount = 0
  private readonly MAX_RESETS = 5
  private lastResetTime = 0
  private readonly RESET_WINDOW = 5 * 60 * 1000

  constructor(props: I18nErrorBoundaryProps) {
    super(props)
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null
    }
  }

  static getDerivedStateFromError(error: Error): Partial<I18nErrorBoundaryState> {
    return {
      hasError: true,
      error
    }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('[I18n Error Boundary] Caught error:', error, errorInfo)

    this.setState({
      errorInfo
    })

    if (this.props.onError) {
      this.props.onError(error, errorInfo)
    }
  }

  reset = (): void => {
    const now = Date.now()

    if (now - this.lastResetTime > this.RESET_WINDOW) {
      console.log('[I18nErrorBoundary] Reset window expired, resetting counter')
      this.resetCount = 0
    }
    if (this.resetCount >= this.MAX_RESETS) {
      console.error('[I18nErrorBoundary] Maximum reset attempts reached. Please reload the page.')
      this.setState({
        error: new Error(
          `Maximum reset attempts (${this.MAX_RESETS}) reached. Please reload the page manually.`
        )
      })
      return
    }

    this.resetCount++
    this.lastResetTime = now
    console.log(
      `[I18nErrorBoundary] Resetting error boundary (attempt ${this.resetCount}/${this.MAX_RESETS})`
    )

    const { error } = this.state
    if (error) {
      const errorMessage = error.message.toLowerCase()
      const errorStack = error.stack?.toLowerCase() || ''

      const nonRetryablePatterns = [
        'parse error',
        'syntax error',
        'invalid json',
        'validation error',
        'invalid format'
      ]

      const isNonRetryable = nonRetryablePatterns.some(
        (pattern) => errorMessage.includes(pattern) || errorStack.includes(pattern)
      )

      if (isNonRetryable) {
        console.warn('[I18nErrorBoundary] Non-retryable error detected, suggesting page reload')
        this.setState({
          error: new Error(
            'A permanent error was detected in the translation system. Please reload the page.'
          )
        })
        return
      }
    }

    const delay = Math.min(1000 * Math.pow(2, this.resetCount - 1), 10000)
    console.log(`[I18nErrorBoundary] Resetting after ${delay}ms delay`)

    setTimeout(() => {
      this.setState({
        hasError: false,
        error: null,
        errorInfo: null
      })

      if (this.props.onReset) {
        this.props.onReset()
      } else {
        console.warn('[I18nErrorBoundary] Reset without onReset callback may cause infinite loop')
      }
    }, delay)
  }

  render(): ReactNode {
    const { hasError, error, errorInfo } = this.state
    const { children, fallback } = this.props

    if (hasError && error) {
      const canReset = this.resetCount < this.MAX_RESETS

      if (fallback) {
        return fallback(
          error,
          errorInfo,
          canReset
            ? this.reset
            : () => {
                console.warn('[I18nErrorBoundary] Reset disabled due to max attempts reached')
              }
        )
      }
      return (
        <DefaultErrorFallback
          error={error}
          errorInfo={errorInfo}
          reset={this.reset}
          canReset={canReset}
          resetCount={this.resetCount}
          maxResets={this.MAX_RESETS}
        />
      )
    }

    return children
  }
}

function DefaultErrorFallback({
  error,
  errorInfo,
  reset,
  canReset = true,
  resetCount = 0,
  maxResets = 3
}: {
  error: Error
  errorInfo: ErrorInfo | null
  reset: () => void
  canReset?: boolean
  resetCount?: number
  maxResets?: number
}): React.ReactElement {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        padding: '20px',
        fontFamily: 'sans-serif',
        backgroundColor: '#f5f5f5'
      }}
    >
      <div
        style={{
          maxWidth: '600px',
          width: '100%',
          backgroundColor: 'white',
          borderRadius: '8px',
          padding: '32px',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)'
        }}
      >
        <h1
          style={{
            color: '#e74c3c',
            marginBottom: '16px',
            fontSize: '24px',
            fontWeight: 'bold'
          }}
        >
          Translation Error
        </h1>

        <div
          style={{
            backgroundColor: '#fff5f5',
            border: '1px solid #feb2b2',
            borderRadius: '4px',
            padding: '16px',
            marginBottom: '24px'
          }}
        >
          <p
            style={{
              color: '#c53030',
              margin: '0 0 8px 0',
              fontWeight: 'bold'
            }}
          >
            {error.name}: {error.message}
          </p>
          {error.stack && (
            <pre
              style={{
                color: '#742a2a',
                fontSize: '12px',
                margin: 0,
                overflow: 'auto',
                maxHeight: '200px'
              }}
            >
              {error.stack}
            </pre>
          )}
        </div>

        {errorInfo && errorInfo.componentStack && (
          <details style={{ marginBottom: '24px' }}>
            <summary
              style={{
                cursor: 'pointer',
                color: '#666',
                marginBottom: '8px'
              }}
            >
              Component Stack
            </summary>
            <pre
              style={{
                backgroundColor: '#f7fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '4px',
                padding: '12px',
                fontSize: '12px',
                overflow: 'auto',
                maxHeight: '200px',
                margin: 0
              }}
            >
              {errorInfo.componentStack}
            </pre>
          </details>
        )}

        <div style={{ display: 'flex', gap: '12px' }}>
          <button
            onClick={reset}
            disabled={!canReset}
            style={{
              flex: 1,
              padding: '12px 24px',
              fontSize: '16px',
              fontWeight: 'bold',
              backgroundColor: canReset ? '#3498db' : '#95a5a6',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: canReset ? 'pointer' : 'not-allowed',
              transition: 'background-color 0.2s',
              opacity: canReset ? 1 : 0.6
            }}
            onMouseEnter={(e) => {
              if (canReset) {
                e.currentTarget.style.backgroundColor = '#2980b9'
              }
            }}
            onMouseLeave={(e) => {
              if (canReset) {
                e.currentTarget.style.backgroundColor = '#3498db'
              }
            }}
          >
            {canReset ? `Retry (${resetCount}/${maxResets})` : 'Max Retries Reached'}
          </button>

          <button
            onClick={() => window.location.reload()}
            style={{
              flex: 1,
              padding: '12px 24px',
              fontSize: '16px',
              fontWeight: 'bold',
              backgroundColor: '#95a5a6',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              transition: 'background-color 0.2s'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#7f8c8d'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = '#95a5a6'
            }}
          >
            Reload Page
          </button>
        </div>

        <p
          style={{
            marginTop: '24px',
            color: '#666',
            fontSize: '14px',
            textAlign: 'center'
          }}
        >
          {canReset
            ? 'If the problem persists, please check the console for more details.'
            : 'Maximum retry attempts reached. Please reload the page to continue.'}
        </p>
      </div>
    </div>
  )
}

export function useErrorBoundary(): {
  ErrorBoundary: typeof I18nErrorBoundary
  hasError: boolean
} {
  const [hasError, setHasError] = React.useState(false)

  const setHasErrorRef = React.useRef(setHasError)
  setHasErrorRef.current = setHasError

  const ErrorBoundaryWithState = React.useMemo(
    () =>
      class extends I18nErrorBoundary {
        componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
          super.componentDidCatch(error, errorInfo)
          setHasErrorRef.current(true)
        }
      },
    []
  )

  return {
    ErrorBoundary: ErrorBoundaryWithState,
    hasError
  }
}
