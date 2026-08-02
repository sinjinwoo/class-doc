import type { ReactNode } from 'react'
import { useId } from 'react'
import { TabsContext } from './TabsContext'

export interface TabsProps {
  value: string
  onValueChange: (value: string) => void
  children?: ReactNode
  className?: string
}

function Tabs({ value, onValueChange, children, className }: TabsProps): React.JSX.Element {
  const idPrefix = useId()

  return (
    <TabsContext.Provider value={{ value, onValueChange, idPrefix }}>
      <div className={className}>{children}</div>
    </TabsContext.Provider>
  )
}

export { Tabs }
