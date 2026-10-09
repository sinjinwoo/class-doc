import type { ComponentPropsWithoutRef, ReactNode } from 'react'
import { cn } from './utils'

export interface CardProps extends Omit<ComponentPropsWithoutRef<'div'>, 'title'> {
  title?: ReactNode
  action?: ReactNode
}

function Card({ title, action, className, children, ...props }: CardProps): React.JSX.Element {
  return (
    <div className={cn('rounded-card border border-line bg-surface p-6', className)} {...props}>
      {(title || action) && (
        <div className={cn('flex items-center justify-between gap-3', children != null && 'mb-4')}>
          {title && (
            <h3 className="min-w-0 truncate text-heading font-normal text-bone-white">{title}</h3>
          )}
          {action}
        </div>
      )}
      {children}
    </div>
  )
}

export { Card }
