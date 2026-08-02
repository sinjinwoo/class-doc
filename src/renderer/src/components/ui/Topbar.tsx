import type { ReactNode } from 'react'
import { cn } from './utils'

export interface TopbarProps {
  title?: ReactNode
  children?: ReactNode
  className?: string
}

function Topbar({ title, children, className }: TopbarProps): React.JSX.Element {
  return (
    <header
      className={cn(
        'flex h-14 shrink-0 items-center justify-between border-b border-lilac-ash-700 bg-lilac-ash-900 px-6',
        className
      )}
    >
      {typeof title === 'string' ? (
        <h1 className="text-lg font-semibold text-lilac-ash-50">{title}</h1>
      ) : (
        title
      )}
      {children && <div className="flex items-center gap-2">{children}</div>}
    </header>
  )
}

export { Topbar }
