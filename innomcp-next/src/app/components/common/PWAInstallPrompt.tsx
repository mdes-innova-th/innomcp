'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { isIOS } from '@/lib/userAgent' // assume a utility exists; if not, inline check

// Extend window to include beforeinstallprompt (non‑standard)
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}

interface PWAInstallPromptProps {
  className?: string
}

const LOCAL_STORAGE_KEY = 'innomcp_pwa_dismissed'

export default function PWAInstallPrompt({ className = '' }: PWAInstallPromptProps) {
  const [visible, setVisible] = useState(false)
  const [showIOSInstructions, setShowIOSInstructions] = useState(false)
  const deferredPrompt = useRef<BeforeInstallPromptEvent | null>(null)

  // Detect standalone mode (already installed as PWA)
  const isStandalone = useRef(false)
  useEffect(() => {
    if (typeof window !== 'undefined' && 'matchMedia' in window) {
      isStandalone.current = window.matchMedia('(display-mode: standalone)').matches
    }
  }, [])

  // Handle beforeinstallprompt event
  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault()
      deferredPrompt.current = e as BeforeInstallPromptEvent
      // Show banner only if not dismissed, not standalone, not on iOS (will handle separately)
      if (!isIOS() && !localStorage.getItem(LOCAL_STORAGE_KEY) && !isStandalone.current) {
        setVisible(true)
      }
    }

    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  // On iOS, show instructions if not already dismissed/installed
  useEffect(() => {
    if (isIOS() && !isStandalone.current && !localStorage.getItem(LOCAL_STORAGE_KEY)) {
      setShowIOSInstructions(true)
    }
  }, [])

  const installApp = useCallback(async () => {
    if (!deferredPrompt.current) return
    deferredPrompt.current.prompt()
    const { outcome } = await deferredPrompt.current.userChoice
    deferredPrompt.current = null
    setVisible(false)
    if (outcome === 'accepted') {
      localStorage.setItem(LOCAL_STORAGE_KEY, 'true')
    }
  }, [])

  const dismiss = useCallback(() => {
    setVisible(false)
    setShowIOSInstructions(false)
    localStorage.setItem(LOCAL_STORAGE_KEY, 'true')
  }, [])

  // Do not render if nothing to show
  if (!visible && !showIOSInstructions) return null

  return (
    <div className={className}>
      {/* iOS instructions */}
      {showIOSInstructions && (
        <div className="fixed bottom-0 left-0 right-0 z-50 flex items-center justify-between gap-4 bg-gradient-to-r from-blue-600 to-blue-800 px-4 py-3 text-white shadow-lg">
          <p className="text-sm font-medium">
            📱 เปิด Safari → กดปุ่มแชร์ → เลือก &quot;เพิ่มที่หน้าจอโฮม&quot; เพื่อติดตั้ง INNOMCP
          </p>
          <button
            onClick={dismiss}
            className="rounded bg-white/20 px-3 py-1 text-sm font-semibold hover:bg-white/30"
          >
            ไม่แสดงอีก
          </button>
        </div>
      )}

      {/* Standard PWA prompt */}
      {visible && (
        <div className="fixed bottom-0 left-0 right-0 z-50 flex items-center justify-between gap-4 bg-gradient-to-r from-blue-600 to-blue-800 px-4 py-3 text-white shadow-lg">
          <p className="text-sm font-medium">
            ติดตั้ง INNOMCP เป็นแอปบนหน้าจอของคุณ
          </p>
          <div className="flex gap-2">
            <button
              onClick={dismiss}
              className="rounded bg-white/20 px-3 py-1 text-sm font-semibold hover:bg-white/30"
            >
              ไม่ตอนนี้
            </button>
            <button
              onClick={installApp}
              className="rounded bg-white px-3 py-1 text-sm font-semibold text-blue-800 hover:bg-gray-100"
            >
              ติดตั้ง
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// Inline iOS detection utility if not provided elsewhere
function isIOS(): boolean {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent
  return /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && typeof navigator.standalone !== 'undefined')
}