'use client'

import { useEffect, useRef, useState } from 'react'

type Status = 'thinking' | 'tool-use' | 'done' | 'idle'

interface FloatingStatusBadgeProps {
  status: Status
}

/**
 * Floating badge that shows MDES AI status at the bottom center.
 * - thinking: spinner emoji + elapsed seconds
 * - tool-use: wrench emoji + elapsed seconds
 * - done: checkmark + total seconds, fades out after 2s
 * - idle: hidden
 */
export default function FloatingStatusBadge({ status }: FloatingStatusBadgeProps) {
  const [elapsed, setElapsed] = useState(0)
  const [fadeOut, setFadeOut] = useState(false)
  const startTimeRef = useRef<number | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const fadeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Clear any running timers
  const clearTimers = () => {
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
    if (fadeTimerRef.current !== null) {
      clearTimeout(fadeTimerRef.current)
      fadeTimerRef.current = null
    }
  }

  useEffect(() => {
    clearTimers()
    setFadeOut(false)

    if (status === 'thinking' || status === 'tool-use') {
      // Start or reset timer
      startTimeRef.current = Date.now()
      setElapsed(0)

      // Update elapsed every 100ms
      intervalRef.current = setInterval(() => {
        if (startTimeRef.current !== null) {
          setElapsed((Date.now() - startTimeRef.current) / 1000)
        }
      }, 100)
    } else if (status === 'done') {
      // Freeze elapsed time to final value
      if (startTimeRef.current !== null) {
        setElapsed((Date.now() - startTimeRef.current) / 1000)
      }
      // Start fade-out after 2 seconds
      fadeTimerRef.current = setTimeout(() => {
        setFadeOut(true)
        // After fade transition, status will become idle (controlled by parent or internal)
      }, 2000)
    } else {
      // idle – no timer needed
      startTimeRef.current = null
    }

    return clearTimers
  }, [status])

  // If idle, hide completely (still render for transition purposes but invisible)
  const isVisible = status !== 'idle'

  const emoji =
    status === 'thinking' ? '🤖' : status === 'tool-use' ? '🔧' : status === 'done' ? '✅' : ''
  const text =
    status === 'thinking'
      ? 'MDES กำลังคิด...'
      : status === 'tool-use'
        ? 'MDES กำลังใช้เครื่องมือ...'
        : status === 'done'
          ? `เสร็จแล้ว ${elapsed.toFixed(1)}s`
          : ''

  const displayTime =
    (status === 'thinking' || status === 'tool-use') ? `${elapsed.toFixed(1)}s` : ''

  return (
    <div
      className={`
        fixed bottom-24 left-1/2 -translate-x-1/2 z-50
        rounded-full bg-indigo-600 text-white
        px-4 py-2 text-sm shadow-lg
        flex items-center gap-2
        transition-opacity duration-500 ease-in-out
        ${isVisible ? (fadeOut ? 'opacity-0' : 'opacity-100') : 'opacity-0 pointer-events-none'}
      `}
    >
      <span className="shrink-0">{emoji}</span>
      <span className="whitespace-nowrap">{text}</span>
      {displayTime && <span className="tabular-nums text-white/80">{displayTime}</span>}
    </div>
  )
}