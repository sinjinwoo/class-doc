import type { ComponentPropsWithoutRef, ReactNode } from 'react'
import { useId } from 'react'
import { cn, focusRing } from './utils'

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
        'flex items-center gap-2 text-sm text-bone-white',
        disabled && 'cursor-not-allowed opacity-50'
      )}
    >
      <input
        id={radioId}
        type="radio"
        disabled={disabled}
        aria-disabled={disabled || undefined}
        className={cn(
          'h-4 w-4 cursor-pointer rounded-full accent-electric-iris transition-colors duration-150',
          focusRing,
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
