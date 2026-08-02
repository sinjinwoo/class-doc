import type { ComponentPropsWithoutRef, ReactNode } from 'react'
import { useId } from 'react'
import { cn } from './utils'

export interface RadioProps extends ComponentPropsWithoutRef<'input'> {
  children?: ReactNode
}

function Radio({ children, className, id, disabled, ...props }: RadioProps): React.JSX.Element {
  const generatedId = useId()
  const radioId = id ?? generatedId

  return (
    <label
      htmlFor={radioId}
      className={cn(
        'flex items-center gap-2 text-sm text-lilac-ash-100',
        disabled && 'cursor-not-allowed opacity-50'
      )}
    >
      <input
        id={radioId}
        type="radio"
        disabled={disabled}
        aria-disabled={disabled || undefined}
        className={cn(
          'h-4 w-4 rounded-full border border-lilac-ash-600 bg-lilac-ash-900 accent-space-indigo-500 transition-colors duration-150',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-space-indigo-400 focus-visible:ring-offset-2 focus-visible:ring-offset-lilac-ash-900',
          disabled && 'cursor-not-allowed',
          className
        )}
        {...props}
      />
      {children}
    </label>
  )
}

export { Radio }
