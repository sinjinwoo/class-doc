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
        'flex h-14 shrink-0 items-center justify-between border-b border-line bg-void px-8',
        className
      )}
    >
      {typeof title === 'string' ? (
        // Small uppercase/tracked nav-style label (DESIGN.md "nav-label"), not
        // a big heading — each page renders its own large title below.
        <h1 className="text-label font-medium uppercase text-ash-gray">{title}</h1>
      ) : (
        title
      )}
      {children && (
        <div className="flex items-center gap-2 text-sm text-silver-mist">{children}</div>
      )}
    </header>
  )
}

export { Topbar }
