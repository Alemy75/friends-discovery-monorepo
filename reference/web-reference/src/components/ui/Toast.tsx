import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from 'react'

interface ToastData {
  id: number
  title: string
  description?: string
}

const ToastContext = createContext<((t: Omit<ToastData, 'id'>) => void) | null>(null)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastData[]>([])
  const nextId = useRef(1)

  const show = useCallback((t: Omit<ToastData, 'id'>) => {
    const id = nextId.current++
    setToasts((list) => [...list, { ...t, id }])
    window.setTimeout(() => {
      setToasts((list) => list.filter((x) => x.id !== id))
    }, 3200)
  }, [])

  return (
    <ToastContext.Provider value={show}>
      {children}
      <div className="fixed left-1/2 bottom-6 z-50 flex flex-col items-center gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className="bg-ink text-surface-alt rounded-pill pl-4 pr-5 py-2.5 shadow-[var(--shadow-card)] flex items-center gap-3 min-w-[240px]"
            style={{ animation: 'toast-in 180ms ease-out' }}
          >
            <span className="inline-flex h-6 w-6 items-center justify-center rounded-full accent-gradient text-white text-[13px] font-semibold shrink-0">
              ✓
            </span>
            <div className="leading-tight">
              <div className="text-[14px] font-medium">{t.title}</div>
              {t.description && (
                <div className="text-[12px] text-mid-gray">{t.description}</div>
              )}
            </div>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return ctx
}
