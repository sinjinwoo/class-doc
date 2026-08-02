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
      className="fixed inset-0 z-50 flex items-center justify-center bg-lilac-ash-950/80 transition-opacity duration-150"
      onClick={onClose}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        className={cn(
          'w-full max-w-lg rounded-lg border border-lilac-ash-700 bg-lilac-ash-900 p-6 shadow-xl transition-transform duration-150',
          className
        )}
        onClick={(event) => event.stopPropagation()}
      >
        {title && (
          <div className="mb-4 flex items-center justify-between">
            <h3 id={titleId} className="text-base font-semibold text-lilac-ash-50">
              {title}
            </h3>
            <Button
              variant="ghost"
              size="icon"
              icon={<CloseIcon className="h-4 w-4" />}
              aria-label="Close"
              onClick={onClose}
            />
          </div>
        )}
        {children}
        {footer && <div className="mt-6 flex justify-end gap-2">{footer}</div>}
      </div>
    </div>,
    document.body
  )
}

export { Modal }
