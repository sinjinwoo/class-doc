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
        'flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-lilac-ash-600 bg-lilac-ash-900 p-10 text-center',
        className
      )}
      {...props}
    >
      {icon && (
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-lilac-ash-800 text-lilac-ash-400">
          {icon}
        </span>
      )}
      <p className="text-base font-semibold text-lilac-ash-50">{title}</p>
      {description && <p className="text-sm text-lilac-ash-300">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  )
}

export { EmptyState }
