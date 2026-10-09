import type { ReactNode } from 'react'
import { cn, focusRing } from './utils'

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
        'flex w-64 shrink-0 flex-col gap-6 border-r border-line bg-void px-4 py-5',
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
              // DESIGN.md nav: no boxes — inactive items are ash gray,
              // active is white. A small violet dot marks the current page
              // (the only accent here; the filled violet stays reserved for
              // primary actions).
              'flex items-center gap-3 rounded-card px-4 py-2.5 text-left text-sm transition-colors duration-150',
              focusRing,
              item.active
                ? 'bg-white/[0.06] text-bone-white'
                : 'text-ash-gray hover:bg-white/[0.03] hover:text-bone-white'
            )}
          >
            <span
              aria-hidden="true"
              className={cn(
                'h-1.5 w-1.5 shrink-0 rounded-full transition-colors duration-150',
                item.active ? 'bg-electric-iris' : 'bg-transparent'
              )}
            />
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
