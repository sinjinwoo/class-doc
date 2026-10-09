import type { ComponentPropsWithoutRef, ReactNode } from 'react'
import { cn } from './utils'

export interface ProgressBarProps extends Omit<ComponentPropsWithoutRef<'div'>, 'value'> {
  value: number
  label?: ReactNode
  showValue?: boolean
}

function ProgressBar({
  value,
  label,
  showValue = false,
  className,
  ...props
}: ProgressBarProps): React.JSX.Element {
  const clampedValue = Math.min(100, Math.max(0, value))
  const roundedValue = Math.round(clampedValue)

  return (
    <div
      role="progressbar"
      aria-valuenow={clampedValue}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={typeof label === 'string' ? label : undefined}
      className={cn('w-full', className)}
      {...props}
    >
      {(label || showValue) && (
        <div className="mb-1 flex items-center justify-between gap-2 text-sm text-silver-mist">
          {label && <span>{label}</span>}
          {showValue && <span>{roundedValue}%</span>}
        </div>
      )}
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
        <div
          className="h-1.5 rounded-full bg-electric-iris transition-all duration-150"
          style={{ width: `${clampedValue}%` }}
        />
      </div>
    </div>
  )
}

export { ProgressBar }
