import type { ComponentPropsWithoutRef } from 'react'
import { cn } from './utils'

export type TabListProps = ComponentPropsWithoutRef<'div'>

function TabList({ className, ...props }: TabListProps): React.JSX.Element {
  return (
    <div
      role="tablist"
      className={cn('flex gap-1 border-b border-lilac-ash-700', className)}
      {...props}
    />
  )
}

export { TabList }
