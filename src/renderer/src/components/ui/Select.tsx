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
        <label htmlFor={selectId} className="text-label font-medium uppercase text-ash-gray">
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
            'h-10 w-full cursor-pointer appearance-none rounded-field border px-3.5 py-2 pr-9 text-sm transition-colors duration-150',
            'focus-visible:outline-none focus-visible:border-electric-iris focus-visible:ring-2 focus-visible:ring-electric-iris/40',
            // Exclusive states (not base + override): conflicting color utilities
            // on one element resolve by stylesheet order, not class order.
            disabled
              ? 'cursor-not-allowed border-line bg-void text-dim'
              : cn(
                  'bg-surface text-bone-white',
                  hasError ? 'border-danger' : 'border-line-strong hover:border-white/25'
                ),
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
        <ChevronDownIcon className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ash-gray" />
      </div>
      {helper && (
        <p id={helperId} className={cn('text-xs', hasError ? 'text-danger' : 'text-ash-gray')}>
          {helper}
        </p>
      )}
    </div>
  )
}

export { Select }
