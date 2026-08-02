import type { ComponentPropsWithoutRef } from 'react'
import { createContext, useContext } from 'react'
import { cn } from './utils'

const TableDenseContext = createContext(false)

export interface TableProps extends ComponentPropsWithoutRef<'table'> {
  dense?: boolean
}

function TableRoot({
  dense = false,
  className,
  children,
  ...props
}: TableProps): React.JSX.Element {
  return (
    <TableDenseContext.Provider value={dense}>
      <div className="w-full overflow-x-auto">
        <table className={cn('w-full border-collapse text-left', className)} {...props}>
          {children}
        </table>
      </div>
    </TableDenseContext.Provider>
  )
}

export type TableHeadProps = ComponentPropsWithoutRef<'thead'>

function TableHead({ className, ...props }: TableHeadProps): React.JSX.Element {
  return (
    <thead className={cn('border-b border-lilac-ash-700 bg-lilac-ash-950', className)} {...props} />
  )
}

export type TableBodyProps = ComponentPropsWithoutRef<'tbody'>

function TableBody({ className, ...props }: TableBodyProps): React.JSX.Element {
  return <tbody className={className} {...props} />
}

export interface TableRowProps extends ComponentPropsWithoutRef<'tr'> {
  selected?: boolean
}

function TableRow({ selected = false, className, ...props }: TableRowProps): React.JSX.Element {
  const dense = useContext(TableDenseContext)

  return (
    <tr
      className={cn(
        'border-b border-lilac-ash-800 transition-colors duration-150 last:border-0 hover:bg-lilac-ash-800',
        dense ? 'h-8' : 'h-11',
        selected && 'border-l-2 border-l-space-indigo-400 bg-space-indigo-900',
        className
      )}
      {...props}
    />
  )
}

export type TableCellProps = ComponentPropsWithoutRef<'td'>

function TableCell({ className, ...props }: TableCellProps): React.JSX.Element {
  const dense = useContext(TableDenseContext)

  return (
    <td
      className={cn(
        'text-lilac-ash-100',
        dense ? 'px-3 py-1.5 text-xs' : 'px-4 py-3 text-sm',
        className
      )}
      {...props}
    />
  )
}

export type TableHeaderCellProps = ComponentPropsWithoutRef<'th'>

function TableHeaderCell({ className, ...props }: TableHeaderCellProps): React.JSX.Element {
  const dense = useContext(TableDenseContext)

  return (
    <th
      className={cn(
        'text-xs font-medium uppercase tracking-wide text-lilac-ash-300',
        dense ? 'px-3 py-1.5' : 'px-4 py-3',
        className
      )}
      {...props}
    />
  )
}

const Table = Object.assign(TableRoot, {
  Head: TableHead,
  Body: TableBody,
  Row: TableRow,
  Cell: TableCell,
  HeaderCell: TableHeaderCell
})

export { Table }
