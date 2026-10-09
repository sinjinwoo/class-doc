import type { ReactNode } from 'react'
import { useCallback, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Alert } from './Alert'
import type { AlertType } from './Alert'
import { ToastContext } from './ToastContext'
import type { ToastOptions } from './ToastContext'

interface ToastItem extends ToastOptions {
  id: number
  type: AlertType
}

const AUTO_DISMISS_MS = 5000

export interface ToastProviderProps {
  children?: ReactNode
}

function ToastProvider({ children }: ToastProviderProps): React.JSX.Element {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const idRef = useRef(0)

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((item) => item.id !== id))
  }, [])

  const toast = useCallback(
    (options: ToastOptions) => {
      const id = idRef.current
      idRef.current += 1
      const type = options.type ?? 'info'
      setToasts((current) => [...current, { ...options, type, id }])

      if (type !== 'error') {
        window.setTimeout(() => dismiss(id), AUTO_DISMISS_MS)
      }
    },
    [dismiss]
  )

  const value = useMemo(() => ({ toast }), [toast])

  return (
    <ToastContext.Provider value={value}>
      {children}
      {typeof document !== 'undefined' &&
        createPortal(
          <div className="fixed right-5 bottom-5 z-[60] flex flex-col gap-2">
            {toasts.map((item) => (
              <Alert
                key={item.id}
                type={item.type}
                message={item.message}
                detail={item.detail}
                onDismiss={() => dismiss(item.id)}
                className="w-[min(420px,calc(100vw-2rem))]"
              />
            ))}
          </div>,
          document.body
        )}
    </ToastContext.Provider>
  )
}

export { ToastProvider }
