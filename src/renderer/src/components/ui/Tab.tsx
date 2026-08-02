import type { ComponentPropsWithoutRef } from 'react'
import { cn } from './utils'
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
        'border-b-2 border-transparent px-4 py-2 text-sm font-medium text-lilac-ash-300 transition-colors duration-150 hover:text-lilac-ash-100',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-space-indigo-400 focus-visible:ring-offset-2 focus-visible:ring-offset-lilac-ash-900',
        isActive && 'border-space-indigo-400 text-space-indigo-300',
        className
      )}
      {...props}
    >
      {children}
    </button>
  )
}

export { Tab }
