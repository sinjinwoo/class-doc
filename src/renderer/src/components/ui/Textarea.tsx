import type { ComponentPropsWithoutRef } from 'react'
import { useId } from 'react'
import { cn } from './utils'

export interface TextareaProps extends ComponentPropsWithoutRef<'textarea'> {
  label?: string
  helperText?: string
  error?: string
}

function Textarea({
  label,
  helperText,
  error,
  className,
  id,
  disabled,
  ...props
}: TextareaProps): React.JSX.Element {
  const generatedId = useId()
  const textareaId = id ?? generatedId
  const helperId = `${textareaId}-helper`
  const hasError = Boolean(error)
  const helper = error ?? helperText

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={textareaId} className="text-label font-medium uppercase text-ash-gray">
          {label}
        </label>
      )}
      <textarea
        id={textareaId}
        aria-invalid={hasError || undefined}
        aria-describedby={helper ? helperId : undefined}
        disabled={disabled}
        aria-disabled={disabled || undefined}
        className={cn(
          'h-auto min-h-24 w-full rounded-field border px-3.5 py-2.5 text-sm placeholder:text-dim transition-colors duration-150',
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
      />
      {helper && (
        <p id={helperId} className={cn('text-xs', hasError ? 'text-danger' : 'text-ash-gray')}>
          {helper}
        </p>
      )}
    </div>
  )
}

export { Textarea }
