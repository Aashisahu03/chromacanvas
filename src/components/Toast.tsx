import { useState, useEffect, createContext, useContext, useCallback, useRef } from 'react'

interface ToastData { id: number; message: string; type?: 'success' | 'error' | 'info' }
interface ToastCtx { toast: (msg: string, type?: ToastData['type']) => void }

const ToastContext = createContext<ToastCtx>({ toast: () => {} })

export function useToast() { return useContext(ToastContext) }

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastData[]>([])
  const counter = useRef(0)

  const toast = useCallback((message: string, type: ToastData['type'] = 'success') => {
    const id = ++counter.current
    setToasts((prev) => [...prev, { id, message, type }])
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 2500)
  }, [])

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="fixed bottom-8 left-1/2 -translate-x-1/2 flex flex-col gap-2 z-[9999] pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`px-4 py-2 rounded-full text-sm font-mono shadow-xl animate-fade-in
              ${t.type === 'error' ? 'bg-red-900 text-red-200' : 'bg-violet-700 text-white'}`}
          >
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}
