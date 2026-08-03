import type { ReactNode } from 'react'
import { useEffect, useId, useRef } from 'react'
import { createPortal } from 'react-dom'
import { cn } from './utils'
import { Button } from './Button'
import { CloseIcon } from './Icons'

export interface ModalProps {
  open: boolean
  onClose: () => void
  title?: ReactNode
  footer?: ReactNode
  children?: ReactNode
  className?: string
}

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'

function Modal({
  open,
  onClose,
  title,
  footer,
  children,
  className
}: ModalProps): React.JSX.Element | null {
  const panelRef = useRef<HTMLDivElement>(null)
  const previouslyFocusedRef = useRef<HTMLElement | null>(null)
  const titleId = useId()

  useEffect(() => {
    if (!open) return undefined

    previouslyFocusedRef.current = document.activeElement as HTMLElement | null

    const panel = panelRef.current
    const focusables = panel?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
    focusables?.[0]?.focus()

    function handleKeyDown(event: KeyboardEvent): void {
      if (event.key === 'Escape') {
        onClose()
        return
      }

      if (event.key !== 'Tab') return

      const nodes = panel?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
      if (!nodes || nodes.length === 0) return

      const firstEl = nodes[0]
      const lastEl = nodes[nodes.length - 1]

      if (event.shiftKey && document.activeElement === firstEl) {
        event.preventDefault()
        lastEl.focus()
      } else if (!event.shiftKey && document.activeElement === lastEl) {
        event.preventDefault()
        firstEl.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      previouslyFocusedRef.current?.focus()
    }
  }, [open, onClose])

  if (!open || typeof document === 'undefined') return null

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-lilac-ash-950/80 p-4 transition-opacity duration-150"
      onClick={onClose}
    >
      {/* Capped at 85vh + flex-column with its own overflow-y-auto middle
          section (not the whole panel) — a modal taller than the window
          (a long field list, a big CSV preview) used to just render past the
          screen edges with nothing scrollable, hiding its own footer buttons
          ("다음", "가져오기", ...) below the fold. Header/footer stay
          `shrink-0` so they're always reachable regardless of how tall the
          middle content gets. */}
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        className={cn(
          'flex max-h-[85vh] w-full max-w-lg flex-col rounded-lg border border-lilac-ash-700 bg-lilac-ash-900 shadow-xl transition-transform duration-150',
          className
        )}
        onClick={(event) => event.stopPropagation()}
      >
        {title && (
          <div className="flex shrink-0 items-center justify-between px-6 pt-6 pb-4">
            <h3 id={titleId} className="text-base font-semibold text-lilac-ash-50">
              {title}
            </h3>
            <Button
              variant="ghost"
              size="icon"
              icon={<CloseIcon className="h-4 w-4" />}
              aria-label="닫기"
              onClick={onClose}
            />
          </div>
        )}
        <div className={cn('min-h-0 flex-1 overflow-y-auto px-6', title ? 'pt-0' : 'pt-6', !footer && 'pb-6')}>
          {children}
        </div>
        {footer && (
          <div className="flex shrink-0 justify-end gap-3 border-t border-lilac-ash-800 px-6 py-4">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body
  )
}

export { Modal }
