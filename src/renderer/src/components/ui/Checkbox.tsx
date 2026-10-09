import type { ComponentPropsWithoutRef, ReactNode } from 'react'
import { useId } from 'react'
import { cn, focusRing } from './utils'

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
        'flex items-center gap-2 text-sm text-bone-white',
        disabled && 'cursor-not-allowed opacity-50'
      )}
    >
      <input
        id={checkboxId}
        type="checkbox"
        disabled={disabled}
        aria-disabled={disabled || undefined}
        className={cn(
          'h-4 w-4 cursor-pointer rounded accent-electric-iris transition-colors duration-150',
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

export { Checkbox }
