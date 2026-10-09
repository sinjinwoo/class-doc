import type { ComponentPropsWithoutRef } from 'react'
import { cn } from './utils'

export type SpinnerSize = 'sm' | 'md' | 'lg'

export interface SpinnerProps extends ComponentPropsWithoutRef<'div'> {
  size?: SpinnerSize
}

const sizeClasses: Record<SpinnerSize, string> = {
  sm: 'h-4 w-4',
  md: 'h-8 w-8',
  lg: 'h-12 w-12'
}

function Spinner({ size = 'md', className, ...props }: SpinnerProps): React.JSX.Element {
  return (
    <div
      role="status"
      aria-label="불러오는 중"
      className={cn(
        'animate-spin rounded-full border-2 border-white/15 border-t-electric-iris',
        sizeClasses[size],
        className
      )}
      {...props}
    />
  )
}

export { Spinner }
