import type { ComponentPropsWithoutRef, ReactNode } from 'react'
import { useId } from 'react'
import { cn } from './utils'

export interface CheckboxProps extends ComponentPropsWithoutRef<'input'> {
  children?: ReactNode
}

function Checkbox({
  children,
  className,
  id,
  disabled,
  ...props
}: CheckboxProps): React.JSX.Element {
  const generatedId = useId()
  const checkboxId = id ?? generatedId

  return (
    <label
      htmlFor={checkboxId}
      className={cn(
        'flex items-center gap-2 text-sm text-lilac-ash-100',
        disabled && 'cursor-not-allowed opacity-50'
      )}
    >
      <input
        id={checkboxId}
        type="checkbox"
        disabled={disabled}
        aria-disabled={disabled || undefined}
        className={cn(
          'h-4 w-4 rounded border border-lilac-ash-600 bg-lilac-ash-900 accent-space-indigo-500 transition-colors duration-150',
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

export { Checkbox }
