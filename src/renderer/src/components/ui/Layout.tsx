import type { ReactNode } from 'react'
import { cn } from './utils'

export interface LayoutProps {
  sidebar: ReactNode
  topbar: ReactNode
  children?: ReactNode
  className?: string
}

function Layout({ sidebar, topbar, children, className }: LayoutProps): React.JSX.Element {
  return (
    <div className={cn('flex h-screen w-screen overflow-hidden bg-lilac-ash-950', className)}>
      {sidebar}
      {/* min-h-0 on both flex items below: without it, a flex item's default
          min-height is its content's natural height, so tall page content
          silently grows `main` past the window instead of triggering its own
          overflow-auto scrollbar — the extra height then gets clipped by
          this div's overflow-hidden with nothing scrollable ever appearing,
          which is exactly what made bottom-anchored buttons ("생성", etc.)
          disappear when the window was shrunk. */}
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {topbar}
        <main className="min-h-0 flex-1 overflow-auto bg-lilac-ash-950 p-6">{children}</main>
      </div>
    </div>
  )
}

export { Layout }
