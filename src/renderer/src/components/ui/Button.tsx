import type { ComponentPropsWithoutRef, ReactNode } from 'react'
import { cn, focusRing } from './utils'
import { Spinner } from './Spinner'

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'
export type ButtonSize = 'default' | 'icon'

export interface ButtonProps extends ComponentPropsWithoutRef<'button'> {
  variant?: ButtonVariant
  size?: ButtonSize
  loading?: boolean
  icon?: ReactNode
}

// DESIGN.md: the filled violet pill is the *only* filled button. Every
// other variant is outline/ghost so a screen never shows two competing
// saturated buttons. `danger` is deliberately an outline (not a filled red)
// for the same reason.
const baseClasses = cn(
  'inline-flex shrink-0 items-center justify-center gap-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-40',
  focusRing
)

const sizeClasses: Record<ButtonSize, string> = {
  default: 'h-10 px-5',
  icon: 'h-8 w-8 p-0'
}

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    'bg-electric-iris text-bone-white hover:bg-iris-hover active:bg-iris-active disabled:hover:bg-electric-iris',
  secondary:
    'border border-line-strong bg-transparent text-bone-white hover:border-white/30 hover:bg-white/5 active:bg-white/10 disabled:hover:border-line-strong disabled:hover:bg-transparent',
  ghost:
    'bg-transparent text-ash-gray hover:bg-white/5 hover:text-bone-white active:bg-white/10 disabled:hover:bg-transparent disabled:hover:text-ash-gray',
  danger:
    'border border-danger/50 bg-transparent text-danger hover:border-danger hover:bg-danger-surface active:bg-danger/20 disabled:hover:bg-transparent'
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
