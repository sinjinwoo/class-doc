import type { ComponentPropsWithoutRef, ReactNode } from 'react'
import { cn, focusRing } from './utils'
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
    classes: 'bg-surface border-line-strong text-silver-mist',
    icon: null,
    role: 'status'
  },
  success: {
    classes: 'bg-success-surface border-success/30 text-success',
    icon: <CheckIcon className="h-4 w-4" />,
    role: 'status'
  },
  warning: {
    classes: 'bg-warning-surface border-warning/30 text-warning',
    icon: <WarningIcon className="h-4 w-4" />,
    role: 'status'
  },
  error: {
    classes: 'bg-danger-surface border-danger/35 text-danger',
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
        'flex items-start gap-3 rounded-panel border px-4 py-3 text-sm',
        config.classes,
        className
      )}
      {...props}
    >
      {config.icon && <span className="mt-0.5 shrink-0">{config.icon}</span>}
      <div className="flex-1">
        <p>{message}</p>
        {detail && <p className="mt-1 font-mono text-xs break-all opacity-80">{detail}</p>}
      </div>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="닫기"
          className={cn(
            'shrink-0 rounded-full p-0.5 text-current transition-colors duration-150 hover:opacity-75',
            focusRing
          )}
        >
          <CloseIcon className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  )
}

export { Alert }
