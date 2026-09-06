import React, { createContext, useContext, useState, useCallback } from "react"
import { X, CheckCircle2, AlertCircle, Info, AlertTriangle } from "lucide-react"

const ToastContext = createContext(null)

export function useToast() {
  const context = useContext(ToastContext)
  if (!context) throw new Error("useToast must be used within a ToastProvider")
  return context
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const addToast = useCallback((message, type = "info") => {
    const id = Date.now().toString() + Math.random().toString()
    setToasts((prev) => [...prev, { id, message, type }])

    // Auto remove after 3 seconds
    setTimeout(() => {
      removeToast(id)
    }, 3000)
  }, [])

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  return (
    <ToastContext.Provider value={{ addToast, removeToast }}>
      {children}
      <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 w-full max-w-sm pointer-events-none">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`
              pointer-events-auto flex items-center gap-3 p-4 rounded-lg shadow-lg border backdrop-blur-md transition-all animate-in slide-in-from-right
              ${toast.type === "success" ? "bg-green-900/80 border-green-500/50 text-green-100" : ""}
              ${toast.type === "error" ? "bg-red-900/80 border-red-500/50 text-red-100" : ""}
              ${toast.type === "warning" ? "bg-yellow-900/80 border-yellow-500/50 text-yellow-100" : ""}
              ${toast.type === "info" ? "bg-slate-800/80 border-cyan-500/50 text-cyan-100" : ""}
            `}
          >
            {toast.type === "success" && <CheckCircle2 className="w-5 h-5 text-green-400" />}
            {toast.type === "error" && <AlertCircle className="w-5 h-5 text-red-400" />}
            {toast.type === "warning" && <AlertTriangle className="w-5 h-5 text-yellow-400" />}
            {toast.type === "info" && <Info className="w-5 h-5 text-cyan-400" />}

            <p className="flex-1 text-sm font-medium">{toast.message}</p>

            <button
              onClick={() => removeToast(toast.id)}
              className="p-1 hover:bg-white/10 rounded-full transition-colors"
            >
              <X className="w-4 h-4 opacity-70" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}
