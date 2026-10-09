import type { ComponentPropsWithoutRef } from 'react'
import { cn } from './utils'
import { CheckIcon } from './Icons'

export type BadgeStatus = 'success' | 'warning' | 'danger' | 'neutral'

export interface BadgeProps extends ComponentPropsWithoutRef<'span'> {
  status?: BadgeStatus
}

const statusClasses: Record<BadgeStatus, string> = {
  success: 'border-success/40 text-success',
  warning: 'border-warning/40 text-warning',
  danger: 'border-danger/45 text-danger',
  neutral: 'border-line-strong text-silver-mist'
}

function Badge({
  status = 'neutral',
  className,
  children,
  ...props
}: BadgeProps): React.JSX.Element {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center gap-1 rounded-full border bg-transparent px-2.5 py-0.5 text-xs font-medium whitespace-nowrap',
        statusClasses[status],
        className
      )}
      {...props}
    >
      {status === 'success' && <CheckIcon className="h-3 w-3" />}
      {children}
    </span>
  )
}

export { Badge }
