import { cn } from "@/lib/cn"
import type { HTMLAttributes, TdHTMLAttributes, ThHTMLAttributes } from "react"

/*
  Semantic token usage:
  - Table bg:          bg-card          (--card)
  - Header bg:         bg-muted         (--muted)
  - Header text:       text-muted-foreground (--muted-foreground)
  - Row hover:         hover:bg-muted/50
  - Cell text:         text-foreground  (--foreground)
  - Border:            border-border    (--border)
  - Striped even rows: bg-muted/30
  DaisyUI "table" class handles base spacing + responsive behavior.
*/

// ── Table wrapper (handles overflow-x scroll on mobile) ─────

export interface TableContainerProps extends HTMLAttributes<HTMLDivElement> {}

export function TableContainer({ className, children, ...props }: TableContainerProps) {
  return (
    <div
      className={cn(
        "overflow-x-auto rounded-[var(--radius-lg)] border border-border",
        "bg-card shadow-[var(--shadow-sm)]",
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
}

// ── Table ────────────────────────────────────────────────────

export interface TableProps extends HTMLAttributes<HTMLTableElement> {
  striped?: boolean
  hoverable?: boolean
  compact?: boolean
  stickyHeader?: boolean
}

export function Table({
  striped = false,
  hoverable = true,
  compact = false,
  stickyHeader = false,
  className,
  children,
  ...props
}: TableProps) {
  return (
    <table
      className={cn(
        "table w-full",
        striped  && "table-zebra",
        compact  && "table-xs",
        stickyHeader && "table-pin-rows",
        className
      )}
      {...props}
    >
      {children}
    </table>
  )
}

// ── TableHead ────────────────────────────────────────────────

export function TableHead({ className, children, ...props }: HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <thead
      className={cn("bg-muted text-muted-foreground", className)}
      {...props}
    >
      {children}
    </thead>
  )
}

// ── TableBody ────────────────────────────────────────────────

export function TableBody({
  className,
  children,
  ...props
}: HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <tbody
      className={cn("divide-y divide-border", className)}
      {...props}
    >
      {children}
    </tbody>
  )
}

// ── TableRow ─────────────────────────────────────────────────

export interface TableRowProps extends HTMLAttributes<HTMLTableRowElement> {
  selected?: boolean
}

export function TableRow({ selected, className, children, ...props }: TableRowProps) {
  return (
    <tr
      className={cn(
        "transition-colors hover:bg-muted/50",
        selected && "bg-primary/10",
        className
      )}
      aria-selected={selected}
      {...props}
    >
      {children}
    </tr>
  )
}

// ── TableHeaderCell ──────────────────────────────────────────

export interface ThProps extends ThHTMLAttributes<HTMLTableCellElement> {
  sortable?: boolean
  sortDirection?: "asc" | "desc" | "none"
}

export function Th({
  sortable,
  sortDirection,
  className,
  children,
  ...props
}: ThProps) {
  return (
    <th
      className={cn(
        "px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide",
        "text-muted-foreground bg-muted",
        sortable && "cursor-pointer select-none hover:text-foreground transition-colors",
        className
      )}
      aria-sort={
        sortable
          ? sortDirection === "asc"
            ? "ascending"
            : sortDirection === "desc"
            ? "descending"
            : "none"
          : undefined
      }
      {...props}
    >
      <span className="flex items-center gap-1.5">
        {children}
        {sortable && (
          <svg
            className={cn(
              "h-3.5 w-3.5 shrink-0 transition-transform",
              sortDirection === "desc" && "rotate-180",
              sortDirection === "none" && "opacity-30"
            )}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2.5}
            aria-hidden="true"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
          </svg>
        )}
      </span>
    </th>
  )
}

// ── TableCell ────────────────────────────────────────────────

export function Td({
  className,
  children,
  ...props
}: TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td
      className={cn(
        "px-4 py-3 text-sm text-foreground",
        className
      )}
      {...props}
    >
      {children}
    </td>
  )
}

// ── TableFooter ──────────────────────────────────────────────

export function TableFoot({
  className,
  children,
  ...props
}: HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <tfoot
      className={cn(
        "border-t border-border bg-muted/40 text-muted-foreground text-xs",
        className
      )}
      {...props}
    >
      {children}
    </tfoot>
  )
}

/* ── Usage example ─────────────────────────────────────────────
  <TableContainer>
    <Table striped hoverable>
      <TableHead>
        <TableRow>
          <Th sortable sortDirection="asc">Name</Th>
          <Th sortable sortDirection="none">Status</Th>
          <Th>Actions</Th>
        </TableRow>
      </TableHead>
      <TableBody>
        {rows.map(row => (
          <TableRow key={row.id}>
            <Td className="font-medium">{row.name}</Td>
            <Td><Badge variant="success">{row.status}</Badge></Td>
            <Td>
              <Button variant="ghost" size="xs">Edit</Button>
            </Td>
          </TableRow>
        ))}
      </TableBody>
      <TableFoot>
        <TableRow>
          <Td colSpan={3}>Showing {rows.length} results</Td>
        </TableRow>
      </TableFoot>
    </Table>
  </TableContainer>
──────────────────────────────────────────────────────────────── */
