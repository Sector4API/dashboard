"use client"

import * as React from "react"
import { Toast, ToastTitle, ToastDescription } from "@/components/ui/toast"

type ToastType = {
  id: string
  title?: string
  description?: string
  variant?: "default" | "success" | "error"
  duration?: number
}

type ToastContextType = {
  toasts: ToastType[]
  addToast: (toast: Omit<ToastType, "id">) => void
  removeToast: (id: string) => void
}

const ToastContext = React.createContext<ToastContextType | undefined>(undefined)

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<ToastType[]>([])

  const addToast = React.useCallback(
    (toast: Omit<ToastType, "id">) => {
      const id = Math.random().toString(36).substring(2, 9)
      const newToast = { ...toast, id }
      
      setToasts((prev) => [...prev, newToast])
      
      if (toast.duration !== 0) {
        setTimeout(() => {
          removeToast(id)
        }, toast.duration || 5000)
      }
    },
    []
  )

  const removeToast = React.useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id))
  }, [])

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast }}>
      {children}
      <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 w-full max-w-md">
        {toasts.map((toast) => (
          <Toast 
            key={toast.id} 
            variant={toast.variant} 
            onClose={() => removeToast(toast.id)}
          >
            {toast.title && <ToastTitle>{toast.title}</ToastTitle>}
            {toast.description && <ToastDescription>{toast.description}</ToastDescription>}
          </Toast>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const context = React.useContext(ToastContext)
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider")
  }
  return context
}