import type { ComponentPropsWithoutRef, ReactNode } from 'react'
import { cn } from './utils'

export interface EmptyStateProps extends Omit<ComponentPropsWithoutRef<'div'>, 'title'> {
  icon?: ReactNode
  title: ReactNode
  description?: ReactNode
  action?: ReactNode
}

function EmptyState({
  icon,
  title,
  description,
  action,
  className,
  ...props
}: EmptyStateProps): React.JSX.Element {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-3 rounded-card border border-dashed border-line-strong px-10 py-14 text-center',
        className
      )}
      {...props}
    >
      {icon && (
        <span className="flex h-12 w-12 items-center justify-center rounded-full border border-line-strong text-ash-gray">
          {icon}
        </span>
      )}
      <p className="text-heading font-normal text-bone-white">{title}</p>
      {description && <p className="max-w-md text-sm text-ash-gray">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  )
}

export { EmptyState }
