import type { ReactNode } from 'react'
import { cn } from './utils'

export interface PageHeaderProps {
  /** Small amber uppercase label above the title (DESIGN.md's "saffron" eyebrow). */
  eyebrow?: ReactNode
  title: ReactNode
  description?: ReactNode
  /** Rendered before the title block, e.g. a "← 목록" back button. */
  leading?: ReactNode
  /** Right-aligned page-level actions. Keep at most one `primary` button here. */
  actions?: ReactNode
  className?: string
}

// The shared page-title treatment: DESIGN.md's weight-400 headline with
// negative tracking, scaled down to app size (text-title = 28px), plus an
// optional amber eyebrow and a gray one-line description.
function PageHeader({
  eyebrow,
  title,
  description,
  leading,
  actions,
  className
}: PageHeaderProps): React.JSX.Element {
  return (
    <div className={cn('flex flex-wrap items-end justify-between gap-x-6 gap-y-4', className)}>
      <div className="flex min-w-0 flex-col gap-3">
        {leading && <div className="flex">{leading}</div>}
        <div className="flex min-w-0 flex-col gap-1.5">
          {eyebrow && (
            <p className="text-label font-medium uppercase text-saffron-spark">{eyebrow}</p>
          )}
          <h2 className="truncate text-title font-normal text-bone-white">{title}</h2>
          {description && <p className="max-w-2xl text-sm text-ash-gray">{description}</p>}
        </div>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}

export { PageHeader }
