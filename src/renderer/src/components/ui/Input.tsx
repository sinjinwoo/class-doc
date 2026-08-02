import type { ComponentPropsWithoutRef } from 'react'
import { useId } from 'react'
import { cn } from './utils'

export interface InputProps extends ComponentPropsWithoutRef<'input'> {
  label?: string
  helperText?: string
  error?: string
}

function Input({
  label,
  helperText,
  error,
  className,
  id,
  disabled,
  ...props
}: InputProps): React.JSX.Element {
  const generatedId = useId()
  const inputId = id ?? generatedId
  const helperId = `${inputId}-helper`
  const hasError = Boolean(error)
  const helper = error ?? helperText

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label
          htmlFor={inputId}
          className="text-xs font-medium uppercase tracking-wide text-lilac-ash-300"
        >
          {label}
        </label>
      )}
      <input
        id={inputId}
        aria-invalid={hasError || undefined}
        aria-describedby={helper ? helperId : undefined}
        disabled={disabled}
        aria-disabled={disabled || undefined}
        className={cn(
          'h-10 w-full rounded-md border bg-lilac-ash-900 px-3 py-2 text-sm text-lilac-ash-50 placeholder:text-lilac-ash-500 transition-colors duration-150',
          'focus-visible:outline-none focus-visible:border-space-indigo-400 focus-visible:ring-1 focus-visible:ring-space-indigo-400',
          hasError ? 'border-almond-silk-500' : 'border-lilac-ash-700',
          disabled && 'cursor-not-allowed border-lilac-ash-800 bg-lilac-ash-950 text-lilac-ash-500',
          className
        )}
        {...props}
      />
      {helper && (
        <p
          id={helperId}
          className={cn('mt-1 text-xs', hasError ? 'text-almond-silk-300' : 'text-lilac-ash-300')}
        >
          {helper}
        </p>
      )}
    </div>
  )
}

export { Input }
