'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'

// ========== Types ==========
type ToastVariant = 'success' | 'error' | 'warning' | 'info' | 'mdes'

interface Toast {
  id: string
  variant: ToastVariant
  title: string
  message?: string
  duration?: number
  action?: {
    label: string
    onClick: () => void
  }
}

interface MDESToastSystemProps {
  toasts: Toast[]
  onDismiss: (id: string) => void
}

type AnimationPhase = 'entering' | 'entered' | 'exiting'

interface AnimatedToast extends Toast {
  phase: AnimationPhase
}

// ========== Style mapping ==========
const variantStyles: Record<ToastVariant, { bg: string; icon: string }> = {
  success: { bg: 'bg-green-600', icon: '✅' },
  error: { bg: 'bg-red-600', icon: '❌' },
  warning: { bg: 'bg-amber-500', icon: '⚠️' },
  info: { bg: 'bg-blue-600', icon: 'ℹ️' },
  mdes: { bg: 'bg-indigo-700', icon: '🇹🇭' },
}

// ========== Component ==========
const MDESToastSystem: React.FC<MDESToastSystemProps> = ({ toasts, onDismiss }) => {
  const [animatedToasts, setAnimatedToasts] = useState<AnimatedToast[]>([])
  const timersRef = useRef<Map<string, NodeJS.Timeout>>(new Map())

  // ---------- Sync with external toasts ----------
  useEffect(() => {
    const currentIds = new Set(toasts.map(t => t.id))

    // Add new toasts (that are in props but not yet animated)
    const toAdd = toasts.filter(t => !animatedToasts.some(at => at.id === t.id))
    if (toAdd.length > 0) {
      setAnimatedToasts(prev => [
        ...toAdd.map(t => ({ ...t, phase: 'entering' as AnimationPhase })),
        ...prev.filter(at => currentIds.has(at.id)),
      ])
      // move to 'entered' after a tick so CSS transition triggers
      toAdd.forEach(t => {
        setTimeout(() => {
          setAnimatedToasts(prev => prev.map(at => (at.id === t.id ? { ...at, phase: 'entered' } : at)))
        }, 10)
      })
    }

    // Remove toasts that are animated but no longer in props (if not already exiting)
    const toRemove = animatedToasts.filter(t => !currentIds.has(t.id) && t.phase !== 'exiting')
    toRemove.forEach(t => {
      setAnimatedToasts(prev => prev.map(at => (at.id === t.id ? { ...at, phase: 'exiting' } : at)))
      setTimeout(() => {
        setAnimatedToasts(prev => prev.filter(at => at.id !== t.id))
      }, 300)
    })
  }, [toasts])

  // ---------- Auto-dismiss ----------
  useEffect(() => {
    const enteredToasts = animatedToasts.filter(t => t.phase === 'entered')
    enteredToasts.forEach(toast => {
      const duration = toast.duration ?? 4000
      if (!timersRef.current.has(toast.id)) {
        const timer = setTimeout(() => {
          handleDismiss(toast.id)
        }, duration)
        timersRef.current.set(toast.id, timer)
      }
    })

    // Clean up timers for toasts that are no longer entered
    timersRef.current.forEach((timer, id) => {
      if (!animatedToasts.some(t => t.id === id && t.phase === 'entered')) {
        clearTimeout(timer)
        timersRef.current.delete(id)
      }
    })
  }, [animatedToasts])

  // ---------- Dismiss handler ----------
  const handleDismiss = useCallback(
    (id: string) => {
      // start exit animation
      setAnimatedToasts(prev => prev.map(t => (t.id === id ? { ...t, phase: 'exiting' } : t)))
      // clear auto-dismiss timer
      const timer = timersRef.current.get(id)
      if (timer) {
        clearTimeout(timer)
        timersRef.current.delete(id)
      }
      // after animation, remove from internal state and notify parent
      setTimeout(() => {
        setAnimatedToasts(prev => prev.filter(t => t.id !== id))
        onDismiss(id)
      }, 300)
    },
    [onDismiss],
  )

  // ---------- Render ----------
  if (animatedToasts.length === 0) return null

  return (
    <div
      role="region"
      aria-label="การแจ้งเตือน"
      className="fixed bottom-4 right-4 z-50 flex flex-col-reverse gap-2 max-w-sm w-full pointer-events-none"
    >
      {animatedToasts.map(toast => {
        const { bg, icon } = variantStyles[toast.variant]
        const isEntering = toast.phase === 'entering'
        const isExiting = toast.phase === 'exiting'

        const transformClass = isEntering
          ? 'translate-x-full opacity-0'
          : isExiting
            ? 'translate-x-full opacity-0'
            : 'translate-x-0 opacity-100'

        return (
          <div
            key={toast.id}
            className={`flex items-start p-3 rounded-lg shadow-lg text-white ${bg} pointer-events-auto transition-all duration-300 ease-in-out ${transformClass}`}
            role="alert"
            aria-live="assertive"
          >
            <span className="text-lg mr-2 flex-shrink-0">{icon}</span>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm leading-tight">{toast.title}</p>
              {toast.message && <p className="text-xs mt-1 opacity-90">{toast.message}</p>}
              {toast.action && (
                <button
                  onClick={() => {
                    toast.action!.onClick()
                    handleDismiss(toast.id)
                  }}
                  className="mt-2 text-xs font-medium underline hover:no-underline focus:outline-none"
                >
                  {toast.action.label}
                </button>
              )}
            </div>
            <button
              onClick={() => handleDismiss(toast.id)}
              className="ml-3 flex-shrink-0 text-white/80 hover:text-white focus:outline-none"
              aria-label="ปิด"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )
      })}
    </div>
  )
}

// ========== Hook ==========
export function useToastSystem() {
  const [toasts, setToasts] = useState<Toast[]>([])

  const addToast = useCallback((toast: Omit<Toast, 'id'> & { id?: string }) => {
    const id = toast.id ?? generateId()
    const newToast: Toast = { ...toast, id }
    setToasts(prev => [newToast, ...prev]) // newest first – stacked via flex-col-reverse → newest on top
    return id
  }, [])

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  return { toasts, addToast, removeToast }
}

// ========== Helpers ==========
function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 5)
}

export default MDESToastSystem