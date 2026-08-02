import type { ComponentPropsWithoutRef, ReactNode } from 'react'
import { cn } from './utils'
import { CheckIcon, CloseIcon, WarningIcon } from './Icons'

export type AlertType = 'info' | 'success' | 'warning' | 'error'

export interface AlertProps extends Omit<ComponentPropsWithoutRef<'div'>, 'title'> {
  type?: AlertType
  message: ReactNode
  detail?: ReactNode
  onDismiss?: () => void
}

interface AlertTypeConfig {
  classes: string
  icon: ReactNode
  role: 'status' | 'alert'
}

const typeConfig: Record<AlertType, AlertTypeConfig> = {
  info: {
    classes: 'bg-lilac-ash-800 border-lilac-ash-700 text-lilac-ash-100',
    icon: null,
    role: 'status'
  },
  success: {
    classes: 'bg-dusty-grape-900 border-dusty-grape-700 text-dusty-grape-200',
    icon: <CheckIcon className="h-4 w-4" />,
    role: 'status'
  },
  warning: {
    classes: 'bg-parchment-900 border-parchment-700 text-parchment-200',
    icon: <WarningIcon className="h-4 w-4" />,
    role: 'status'
  },
  error: {
    classes: 'bg-almond-silk-900 border-almond-silk-700 text-almond-silk-200',
    icon: <CloseIcon className="h-4 w-4" />,
    role: 'alert'
  }
}

function Alert({
  type = 'info',
  message,
  detail,
  onDismiss,
  className,
  ...props
}: AlertProps): React.JSX.Element {
  const config = typeConfig[type]

  return (
    <div
      role={config.role}
      className={cn(
        'flex items-start gap-3 rounded-md border p-3 text-sm',
        config.classes,
        className
      )}
      {...props}
    >
      {config.icon && <span className="mt-0.5 shrink-0">{config.icon}</span>}
      <div className="flex-1">
        <p>{message}</p>
        {detail && <p className="mt-1 font-mono text-xs">{detail}</p>}
      </div>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss"
          className={cn(
            'shrink-0 rounded-md p-0.5 text-current transition-colors duration-150 hover:opacity-75',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-space-indigo-400 focus-visible:ring-offset-2 focus-visible:ring-offset-lilac-ash-900'
          )}
        >
          <CloseIcon className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  )
}

export { Alert }
