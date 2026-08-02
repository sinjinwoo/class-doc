import type { ComponentPropsWithoutRef, ReactNode } from 'react'
import { cn } from './utils'

export interface CardProps extends Omit<ComponentPropsWithoutRef<'div'>, 'title'> {
  title?: ReactNode
  action?: ReactNode
}

function Card({ title, action, className, children, ...props }: CardProps): React.JSX.Element {
  return (
    <div
      className={cn('rounded-lg border border-lilac-ash-700 bg-lilac-ash-900 p-6', className)}
      {...props}
    >
      {(title || action) && (
        <div className="mb-4 flex items-center justify-between">
          {title && <h3 className="text-base font-semibold text-lilac-ash-50">{title}</h3>}
          {action}
        </div>
      )}
      {children}
    </div>
  )
}

export { Card }
