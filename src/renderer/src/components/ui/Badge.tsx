import type { ComponentPropsWithoutRef } from 'react'
import { cn } from './utils'
import { CheckIcon } from './Icons'

export type BadgeStatus = 'success' | 'warning' | 'danger' | 'neutral'

export interface BadgeProps extends ComponentPropsWithoutRef<'span'> {
  status?: BadgeStatus
}

const statusClasses: Record<BadgeStatus, string> = {
  success: 'bg-dusty-grape-900 text-dusty-grape-300 border-dusty-grape-700',
  warning: 'bg-parchment-900 text-parchment-300 border-parchment-700',
  danger: 'bg-almond-silk-900 text-almond-silk-300 border-almond-silk-700',
  neutral: 'bg-lilac-ash-800 text-lilac-ash-300 border-lilac-ash-700'
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
        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium',
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
