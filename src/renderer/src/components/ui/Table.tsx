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
      <div className="w-full overflow-x-auto rounded-panel border border-line bg-surface">
        {/* `w-full` so the table uses the space its container actually has
            (dropping it entirely made every table shrink-wrap to its content
            and look tiny regardless of screen size — overcorrected). The
            "few short columns get absurdly wide" problem is instead handled
            per-table, by giving short-value columns an explicit modest
            `w-*`/`whitespace-nowrap` (see StudentValueTable.tsx) so they stay
            compact while one designated column absorbs any leftover space —
            plus `divide-x` below, so column boundaries read clearly even
            when a column does end up wider than its content strictly needs. */}
        <table
          className={cn('w-full border-collapse text-left text-bone-white', className)}
          {...props}
        >
          {children}
        </table>
      </div>
    </TableDenseContext.Provider>
  )
}

export type TableHeadProps = ComponentPropsWithoutRef<'thead'>

function TableHead({ className, ...props }: TableHeadProps): React.JSX.Element {
  return (
    <thead className={cn('border-b border-line-strong bg-surface-raised', className)} {...props} />
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
        'border-b border-line transition-colors duration-150 last:border-0 hover:bg-white/[0.03]',
        dense ? 'h-9' : 'h-12',
        // The violet "selected" stripe is an inset line on the first cell, not
        // a border-left on the <tr>: row borders in a border-collapse table
        // lose conflict resolution to adjacent cell borders and rendered on
        // only some rows.
        selected &&
          'bg-white/[0.04] [&>td:first-child]:shadow-[inset_2px_0_0_var(--color-electric-iris)]',
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
        // border-r (not the parent row's divide-x) so header cells can use a
        // different, more visible divider color against their own bg — see
        // TableHeaderCell's identical comment.
        'break-words border-r border-line last:border-r-0',
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
        // A row of th's needs to read as "this is the header" at a glance,
        // not just a slightly-different-colored first row — bigger, bolder,
        // brighter text + the thead's own stronger bg/border above do that.
        // border-r uses a *lighter* divider than TableCell's, since the
        // header's own raised bg differs from the body's — reusing the same
        // divider color the body cells use would read too faint against it.
        'break-words border-r border-line-strong text-[13px] font-semibold uppercase tracking-wide text-silver-mist last:border-r-0',
        dense ? 'px-3 py-2.5' : 'px-4 py-4',
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
