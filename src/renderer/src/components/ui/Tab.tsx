import type { ComponentPropsWithoutRef } from 'react'
import { cn, focusRing } from './utils'
import { panelId, tabId, useTabsContext } from './TabsContext'

export interface TabProps extends Omit<ComponentPropsWithoutRef<'button'>, 'value'> {
  value: string
}

function Tab({ value, className, children, ...props }: TabProps): React.JSX.Element {
  const { value: activeValue, onValueChange, idPrefix } = useTabsContext('Tab')
  const isActive = activeValue === value

  return (
    <button
      type="button"
      role="tab"
      id={tabId(idPrefix, value)}
      aria-selected={isActive}
      aria-controls={panelId(idPrefix, value)}
      tabIndex={isActive ? 0 : -1}
      onClick={() => onValueChange(value)}
      className={cn(
        '-mb-px border-b-2 px-4 py-2.5 text-sm font-medium transition-colors duration-150',
        focusRing,
        // Mutually exclusive (not "base + override") — two border/text color
        // utilities on one element resolve by stylesheet order, not class
        // order, which previously hid the active underline entirely.
        isActive
          ? 'border-electric-iris text-bone-white'
          : 'border-transparent text-ash-gray hover:text-bone-white',
        className
      )}
      {...props}
    >
      {children}
    </button>
  )
}

export { Tab }
