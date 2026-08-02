import type { ComponentPropsWithoutRef, ReactNode } from 'react'
import { cn } from './utils'
import { Spinner } from './Spinner'

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'
export type ButtonSize = 'default' | 'icon'

export interface ButtonProps extends ComponentPropsWithoutRef<'button'> {
  variant?: ButtonVariant
  size?: ButtonSize
  loading?: boolean
  icon?: ReactNode
}

const baseClasses =
  'inline-flex items-center justify-center gap-2 rounded-md text-sm font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-space-indigo-400 focus-visible:ring-offset-2 focus-visible:ring-offset-lilac-ash-900 disabled:opacity-50 disabled:cursor-not-allowed'

const sizeClasses: Record<ButtonSize, string> = {
  default: 'h-10 px-4',
  icon: 'h-8 w-8 p-0'
}

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    'bg-space-indigo-500 text-lilac-ash-50 hover:bg-space-indigo-400 active:bg-space-indigo-600 disabled:bg-space-indigo-800 disabled:text-lilac-ash-500',
  secondary:
    'bg-dusty-grape-700 text-lilac-ash-50 border border-dusty-grape-600 hover:bg-dusty-grape-600 active:bg-dusty-grape-800 disabled:bg-dusty-grape-900 disabled:text-lilac-ash-500',
  ghost:
    'bg-transparent text-lilac-ash-100 hover:bg-lilac-ash-800 active:bg-lilac-ash-700 disabled:text-lilac-ash-500',
  danger:
    'bg-almond-silk-600 text-lilac-ash-50 hover:bg-almond-silk-500 active:bg-almond-silk-700 disabled:bg-almond-silk-900 disabled:text-lilac-ash-500'
}

function Button({
  variant = 'primary',
  size = 'default',
  loading = false,
  icon,
  disabled,
  className,
  children,
  ...props
}: ButtonProps): React.JSX.Element {
  const isDisabled = Boolean(disabled) || loading

  return (
    <button
      type="button"
      className={cn(baseClasses, sizeClasses[size], variantClasses[variant], className)}
      disabled={isDisabled}
      aria-disabled={isDisabled || undefined}
      {...props}
    >
      {loading ? <Spinner size="sm" /> : icon}
      {children}
    </button>
  )
}

export { Button }
