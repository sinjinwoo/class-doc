import type { ComponentPropsWithoutRef } from 'react'
import { useId } from 'react'
import { cn } from './utils'
import { ChevronDownIcon } from './Icons'

export interface SelectOption {
  value: string
  label: string
  disabled?: boolean
}

export interface SelectProps extends ComponentPropsWithoutRef<'select'> {
  label?: string
  helperText?: string
  error?: string
  options?: SelectOption[]
}

function Select({
  label,
  helperText,
  error,
  options,
  className,
  id,
  disabled,
  children,
  ...props
}: SelectProps): React.JSX.Element {
  const generatedId = useId()
  const selectId = id ?? generatedId
  const helperId = `${selectId}-helper`
  const hasError = Boolean(error)
  const helper = error ?? helperText

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label
          htmlFor={selectId}
          className="text-xs font-medium uppercase tracking-wide text-lilac-ash-300"
        >
          {label}
        </label>
      )}
      <div className="relative">
        <select
          id={selectId}
          aria-invalid={hasError || undefined}
          aria-describedby={helper ? helperId : undefined}
          disabled={disabled}
          aria-disabled={disabled || undefined}
          className={cn(
            'h-10 w-full appearance-none rounded-md border bg-lilac-ash-900 px-3 py-2 pr-8 text-sm text-lilac-ash-50 transition-colors duration-150',
            'focus-visible:outline-none focus-visible:border-space-indigo-400 focus-visible:ring-1 focus-visible:ring-space-indigo-400',
            hasError ? 'border-almond-silk-500' : 'border-lilac-ash-700',
            disabled &&
              'cursor-not-allowed border-lilac-ash-800 bg-lilac-ash-950 text-lilac-ash-500',
            className
          )}
          {...props}
        >
          {options
            ? options.map((option) => (
                <option key={option.value} value={option.value} disabled={option.disabled}>
                  {option.label}
                </option>
              ))
            : children}
        </select>
        <ChevronDownIcon className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-lilac-ash-400" />
      </div>
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

export { Select }
