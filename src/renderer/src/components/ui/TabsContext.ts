import { createContext, useContext } from 'react'

export interface TabsContextValue {
  value: string
  onValueChange: (value: string) => void
  idPrefix: string
}

export const TabsContext = createContext<TabsContextValue | null>(null)

export function useTabsContext(component: string): TabsContextValue {
  const context = useContext(TabsContext)
  if (!context) {
    throw new Error(`${component} must be used within a Tabs component`)
  }
  return context
}

export function tabId(idPrefix: string, value: string): string {
  return `${idPrefix}-tab-${value}`
}

export function panelId(idPrefix: string, value: string): string {
  return `${idPrefix}-panel-${value}`
}
