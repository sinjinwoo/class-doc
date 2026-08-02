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
      <div className="flex flex-1 flex-col overflow-hidden">
        {topbar}
        <main className="flex-1 overflow-auto bg-lilac-ash-950 p-6">{children}</main>
      </div>
    </div>
  )
}

export { Layout }
