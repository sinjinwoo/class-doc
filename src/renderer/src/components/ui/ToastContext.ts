import type { ReactNode } from 'react'
import { createContext, useContext } from 'react'
import type { AlertType } from './Alert'

export interface ToastOptions {
  type?: AlertType
  message: ReactNode
  detail?: ReactNode
}

export interface ToastContextValue {
  toast: (options: ToastOptions) => void
}

export const ToastContext = createContext<ToastContextValue | null>(null)

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext)
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider')
  }
  return context
}
