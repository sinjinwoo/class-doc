import type { ReactNode } from 'react'
import { cn } from './utils'

export interface SidebarNavItem {
  key: string
  label: string
  icon?: ReactNode
  active?: boolean
  onClick?: () => void
}

export interface SidebarProps {
  items: SidebarNavItem[]
  header?: ReactNode
  footer?: ReactNode
  className?: string
}

function Sidebar({ items, header, footer, className }: SidebarProps): React.JSX.Element {
  return (
    <aside
      className={cn(
        'flex w-64 shrink-0 flex-col gap-1 border-r border-lilac-ash-700 bg-lilac-ash-950 p-4',
        className
      )}
    >
      {header}
      <nav className="flex flex-1 flex-col gap-1">
        {items.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={item.onClick}
            aria-current={item.active ? 'page' : undefined}
            className={cn(
              'flex items-center gap-2 rounded-md border px-3 py-2.5 text-left text-sm transition-colors duration-150',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-space-indigo-400 focus-visible:ring-offset-2 focus-visible:ring-offset-lilac-ash-950',
              item.active
                ? 'border-space-indigo-700 bg-space-indigo-900 text-space-indigo-200'
                : 'border-lilac-ash-800 bg-lilac-ash-900 text-lilac-ash-200 hover:border-lilac-ash-700 hover:bg-lilac-ash-800 hover:text-lilac-ash-100'
            )}
          >
            {item.icon}
            {item.label}
          </button>
        ))}
      </nav>
      {footer}
    </aside>
  )
}

export { Sidebar }
