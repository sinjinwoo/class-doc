import type { ComponentPropsWithoutRef } from 'react'
import { panelId, tabId, useTabsContext } from './TabsContext'

export interface TabPanelProps extends ComponentPropsWithoutRef<'div'> {
  value: string
}

function TabPanel({
  value,
  className,
  children,
  ...props
}: TabPanelProps): React.JSX.Element | null {
  const { value: activeValue, idPrefix } = useTabsContext('TabPanel')

  if (activeValue !== value) return null

  return (
    <div
      id={panelId(idPrefix, value)}
      role="tabpanel"
      aria-labelledby={tabId(idPrefix, value)}
      className={className}
      {...props}
    >
      {children}
    </div>
  )
}

export { TabPanel }
